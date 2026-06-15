const express = require('express');
const router = express.Router();
const path = require('path');
const fs = require('fs');
const multer = require('multer');
const pool = require('../config/db');
const { authenticate, requireWorker, requireAdmin } = require('../middleware/auth');
const mailer = require('../utils/mailer');
const { getAppName, sendTicketRegisteredEmail } = require('../utils/mailer');
const { t: tr, resolveLang } = require('../i18n/index');
const { notifyAllAdmins, notifyUsers } = require('../utils/webpush');
const { getSiteUrl } = require('../utils/siteUrl');
const { normalizePriority, computeDeadlines, enrichTicketSla } = require('../utils/sla');
const { classifyAndSave, generateReply } = require('../utils/groqClassifier');

const uploadDir = process.env.UPLOAD_DIR || '/var/www/html/pomoc/pliki';
const uploadStorage = multer.diskStorage({
  destination: (req, file, cb) => {
    const now = new Date();
    const subdir = `${now.getFullYear()}-${String(now.getMonth() + 1).padStart(2, '0')}`;
    const dir = path.join(uploadDir, subdir);
    fs.mkdirSync(dir, { recursive: true });
    cb(null, dir);
  },
  filename: (req, file, cb) => {
    const unique = Date.now() + '-' + Math.round(Math.random() * 1e9);
    cb(null, unique + path.extname(file.originalname));
  },
});
const upload = multer({ storage: uploadStorage, limits: { fileSize: 20 * 1024 * 1024 } });

// Wszystkie endpointy wymagają zalogowania + roli pracownik/admin
router.use(authenticate, requireWorker);

// GET /api/tickets - lista ticketów
router.get('/', async (req, res) => {
  try {
    const { status, odlozone, moje, page = 1, limit = 20, q, priority, przypisany, data_od, data_do } = req.query;
    const offset = (page - 1) * limit;
    const params = [];
    let where = "(t.ai_tag != 'spam' OR t.ai_tag IS NULL)";

    if (status) {
      where += ' AND t.status = ?';
      params.push(status);
    } else if (!odlozone) {
      where += ' AND t.status != 3';
    }

    if (odlozone === '1') {
      where += ' AND t.odlozony = 1';
    } else {
      where += ' AND (t.odlozony = 0 OR t.odlozony IS NULL)';
    }

    if (moje === '1') {
      where += ' AND uht.user_id = ?';
      params.push(req.user.id);
    }

    if (priority) {
      where += ' AND t.priority = ?';
      params.push(parseInt(priority));
    }

    if (przypisany) {
      where += ' AND EXISTS (SELECT 1 FROM user_has_ticket x WHERE x.ticket_id = t.id AND x.user_id = ?)';
      params.push(parseInt(przypisany));
    }

    if (data_od) {
      where += ' AND t.data_utworzenia >= ?';
      params.push(parseInt(data_od));
    }

    if (data_do) {
      where += ' AND t.data_utworzenia <= ?';
      params.push(parseInt(data_do));
    }

    if (q) {
      where += ' AND (t.message_subject LIKE ? OR t.message_from LIKE ? OR t.numer LIKE ? OR t.tresc LIKE ?)';
      params.push(`%${q}%`, `%${q}%`, `%${q}%`, `%${q}%`);
    }

    const joinMoje = moje === '1' ? 'INNER JOIN user_has_ticket uht ON uht.ticket_id = t.id' : 'LEFT JOIN user_has_ticket uht ON uht.ticket_id = t.id';

    const [rows] = await pool.query(
      `SELECT t.*,
              GROUP_CONCAT(DISTINCT CONCAT(u.imie, ' ', u.nazwisko) SEPARATOR ', ') as przypisani
       FROM ticket t
       ${joinMoje}
       LEFT JOIN user u ON u.id = uht.user_id
       WHERE ${where}
       GROUP BY t.id
       ORDER BY t.id DESC
       LIMIT ? OFFSET ?`,
      [...params, parseInt(limit), parseInt(offset)]
    );

    const [[{ total }]] = await pool.query(
      `SELECT COUNT(DISTINCT t.id) as total FROM ticket t ${joinMoje} WHERE ${where}`,
      params
    );

    const nowTs = Math.floor(Date.now() / 1000);
    const enriched = rows.map((row) => enrichTicketSla(row, nowTs));

    res.json({ data: enriched, total, page: parseInt(page), limit: parseInt(limit) });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

// GET /api/tickets/moje
router.get('/moje', async (req, res) => {
  try {
    const [rows] = await pool.query(
      `SELECT t.*, GROUP_CONCAT(DISTINCT CONCAT(u.imie, ' ', u.nazwisko) SEPARATOR ', ') as przypisani
       FROM ticket t
       INNER JOIN user_has_ticket uht ON uht.ticket_id = t.id AND uht.user_id = ?
       LEFT JOIN user u ON u.id = uht.user_id
       WHERE t.status = 2 AND (t.odlozony = 0 OR t.odlozony IS NULL)
       GROUP BY t.id
       ORDER BY t.id DESC`,
      [req.user.id]
    );
    const nowTs = Math.floor(Date.now() / 1000);
    res.json({ data: rows.map((row) => enrichTicketSla(row, nowTs)) });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

// GET /api/tickets/odlozone
router.get('/odlozone', async (req, res) => {
  try {
    const isAdmin = req.user.rola === 'admin';
    let query = `SELECT t.*, GROUP_CONCAT(DISTINCT CONCAT(u.imie, ' ', u.nazwisko) SEPARATOR ', ') as przypisani
                 FROM ticket t
                 LEFT JOIN user_has_ticket uht ON uht.ticket_id = t.id
                 LEFT JOIN user u ON u.id = uht.user_id
                 WHERE t.odlozony = 1`;
    const params = [];
    if (!isAdmin) {
      query += ' AND uht.user_id = ?';
      params.push(req.user.id);
    }
    query += ' GROUP BY t.id ORDER BY t.odlozony_data ASC';

    const [rows] = await pool.query(query, params);
    const nowTs = Math.floor(Date.now() / 1000);
    res.json({ data: rows.map((row) => enrichTicketSla(row, nowTs)) });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

// GET /api/tickets/spam — lista spamu (paginacja)
router.get('/spam', requireAdmin, async (req, res) => {
  try {
    const { page = 1, limit = 50 } = req.query;
    const offset = (page - 1) * limit;
    const [rows] = await pool.query(
      `SELECT t.id, t.numer, t.message_from, t.message_subject, t.data_utworzenia, t.ai_reason, t.status
       FROM ticket t WHERE t.ai_tag = 'spam'
       ORDER BY t.id DESC LIMIT ? OFFSET ?`,
      [parseInt(limit), parseInt(offset)]
    );
    const [[{ total }]] = await pool.query("SELECT COUNT(*) as total FROM ticket WHERE ai_tag = 'spam'");
    res.json({ data: rows, total, page: parseInt(page), limit: parseInt(limit) });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

// DELETE /api/tickets/spam/masowe — trwałe usunięcie zaznaczonych
router.delete('/spam/masowe', requireAdmin, async (req, res) => {
  try {
    const { ids } = req.body;
    if (!ids?.length) return res.status(400).json({ error: 'Brak ids' });
    await pool.query(
      `DELETE FROM ticket WHERE id IN (${ids.map(() => '?').join(',')}) AND ai_tag = 'spam'`,
      ids
    );
    res.json({ success: true, deleted: ids.length });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

// DELETE /api/tickets/spam/wszystkie — usuń cały spam
router.delete('/spam/wszystkie', requireAdmin, async (req, res) => {
  try {
    const [result] = await pool.query("DELETE FROM ticket WHERE ai_tag = 'spam'");
    res.json({ success: true, deleted: result.affectedRows });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

// GET /api/tickets/:id
router.get('/:id', async (req, res) => {
  try {
    const [rows] = await pool.query(
      `SELECT t.*,
              GROUP_CONCAT(DISTINCT uht.user_id) as przypisani_ids,
              GROUP_CONCAT(DISTINCT CONCAT(u.imie, ' ', u.nazwisko) SEPARATOR ', ') as przypisani
       FROM ticket t
       LEFT JOIN user_has_ticket uht ON uht.ticket_id = t.id
       LEFT JOIN user u ON u.id = uht.user_id
       WHERE t.id = ?
       GROUP BY t.id`,
      [req.params.id]
    );
    if (!rows.length) return res.status(404).json({ error: 'Ticket nie znaleziony' });

    // oznacz jako otwarty
    const ticket = rows[0];
    if (!ticket.data_otwarcia) {
      await pool.query('UPDATE ticket SET data_otwarcia = ?, podswietl = 0 WHERE id = ?', [Math.floor(Date.now() / 1000), req.params.id]);
    } else {
      await pool.query('UPDATE ticket SET podswietl = 0 WHERE id = ?', [req.params.id]);
    }

    // LDAP lookup — jeśli jeszcze nie wykonany (ldap_ou == null), spróbuj teraz (1.5s timeout)
    if (ticket.ldap_ou === null && ticket.message_from) {
      try {
        const { lookupEmail } = require('../utils/ldap');
        const ldap = await Promise.race([
          lookupEmail(ticket.message_from),
          new Promise(r => setTimeout(() => r(undefined), 1500)),
        ]);
        if (ldap) {
          await pool.query(
            'UPDATE ticket SET ldap_name=?, ldap_ou=?, ldap_num=?, ldap_data=? WHERE id=?',
            [ldap.name, ldap.ou, ldap.num, JSON.stringify(ldap.extra || {}), ticket.id]
          );
          ticket.ldap_name = ldap.name;
          ticket.ldap_ou = ldap.ou;
          ticket.ldap_num = ldap.num;
          ticket.ldap_data = JSON.stringify(ldap.extra || {});
        } else if (ldap === null) {
          // Brak w LDAP — zapisz żeby nie odpytywać przy każdym otwarciu
          await pool.query("UPDATE ticket SET ldap_ou='not_found' WHERE id=?", [ticket.id]);
          ticket.ldap_ou = 'not_found';
        }
        // ldap === undefined oznacza timeout — nie zapisujemy, spróbujemy następnym razem
      } catch {}
    }

    // korespondencja
    const [koresp] = await pool.query(
      `SELECT k.*, u.imie, u.nazwisko FROM korespondencja k
       LEFT JOIN user u ON u.id = k.created_by
       WHERE k.ticket_id = ? ORDER BY k.data ASC`,
      [req.params.id]
    );

    // notatki
    const [notatki] = await pool.query(
      'SELECT * FROM notatka WHERE ticket_id = ? ORDER BY data ASC',
      [req.params.id]
    );

    // pliki ticketu (tabela=1)
    const [plikiTicket] = await pool.query(
      'SELECT * FROM plik WHERE tabela = 1 AND ticket_id = ?',
      [req.params.id]
    );

    // pliki korespondencji (tabela=2, ticket_id = korespondencja.id) — dołącz do każdego wpisu
    const korIds = koresp.map(k => k.id);
    let korWithPliki = koresp;
    if (korIds.length) {
      const placeholders = korIds.map(() => '?').join(',');
      const [plikiKor] = await pool.query(
        `SELECT * FROM plik WHERE tabela = 2 AND ticket_id IN (${placeholders})`,
        korIds
      );
      const byKorId = {};
      for (const p of plikiKor) {
        if (!byKorId[p.ticket_id]) byKorId[p.ticket_id] = [];
        byKorId[p.ticket_id].push(p);
      }
      korWithPliki = koresp.map(k => ({ ...k, pliki: byKorId[k.id] || [] }));
    }

    // przypisania
    const [przypisania] = await pool.query(
      `SELECT uht.*, u.imie, u.nazwisko, u.email FROM user_has_ticket uht
       LEFT JOIN user u ON u.id = uht.user_id
       WHERE uht.ticket_id = ?`,
      [req.params.id]
    );

    const enrichedTicket = enrichTicketSla(ticket);
    res.json({ ticket: enrichedTicket, korespondencja: korWithPliki, notatki, pliki: plikiTicket, przypisania });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

// POST /api/tickets - nowy ticket
router.post('/', requireAdmin, async (req, res) => {
  try {
    const { message_from, message_to, message_subject, tresc, html, message_cc, priority } = req.body;
    const numer = Math.random().toString().slice(2, 8);
    const now = Math.floor(Date.now() / 1000);
    const normalizedPriority = normalizePriority(priority);
    const deadlines = computeDeadlines(now, normalizedPriority);

    const [result] = await pool.query(
      `INSERT INTO ticket (numer, message_from, message_to, message_subject, tresc, html, message_cc, status, data_utworzenia, odlozony, podswietl)
       VALUES (?, ?, ?, ?, ?, ?, ?, 1, ?, 0, 0)`,
      [numer, message_from, message_to, message_subject, tresc, html, message_cc || '', now]
    );

    try {
      await pool.query(
        'UPDATE ticket SET priority = ?, sla_response_deadline = ?, sla_resolution_deadline = ?, sla_warning_sent_at = NULL WHERE id = ?',
        [normalizedPriority, deadlines.responseDeadline, deadlines.resolutionDeadline, result.insertId]
      );
    } catch {
      // Gdy kolumny SLA nie istnieją, endpoint tworzenia ticketu nadal działa.
    }

    notifyAllAdmins({
      title: 'Nowe zgłoszenie',
      body: `Od: ${message_from} | Temat: ${message_subject}`,
      url: `/tickets/${result.insertId}`,
    }).catch(() => {});

    classifyAndSave(result.insertId, { subject: message_subject, body: tresc, from: message_from }).catch(() => {});

    sendTicketRegisteredEmail({ numer, from: message_from, subject: message_subject }).catch(() => {});

    res.status(201).json({ id: result.insertId, numer, priority: normalizedPriority });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

// PUT /api/tickets/:id
router.put('/:id', requireAdmin, async (req, res) => {
  try {
    const { message_from, message_to, message_subject, tresc, html, message_cc } = req.body;
    await pool.query(
      'UPDATE ticket SET message_from=?, message_to=?, message_subject=?, tresc=?, html=?, message_cc=? WHERE id=?',
      [message_from, message_to, message_subject, tresc, html, message_cc || '', req.params.id]
    );
    res.json({ success: true });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

// DELETE /api/tickets/:id (soft close)
router.delete('/:id', requireAdmin, async (req, res) => {
  try {
    const now = Math.floor(Date.now() / 1000);
    await pool.query('UPDATE ticket SET status=3, data_zamkniecia=? WHERE id=?', [now, req.params.id]);
    res.json({ success: true });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

// DELETE /api/tickets/:id/trwale — trwałe usunięcie (tylko admin, tylko zamknięte)
router.delete('/:id/trwale', requireAdmin, async (req, res) => {
  try {
    const [[ticket]] = await pool.query('SELECT id, status FROM ticket WHERE id = ?', [req.params.id]);
    if (!ticket) return res.status(404).json({ error: 'Ticket nie znaleziony' });
    if (ticket.status !== 3) return res.status(400).json({ error: 'Można usunąć tylko zamknięte zgłoszenia' });

    const [files] = await pool.query('SELECT filepath FROM plik WHERE ticket_id = ?', [req.params.id]);
    for (const f of files) {
      try { fs.unlinkSync(path.join(uploadDir, f.filepath)); } catch {}
    }

    await pool.query('DELETE FROM plik WHERE ticket_id = ?', [req.params.id]);
    await pool.query('DELETE FROM korespondencja WHERE ticket_id = ?', [req.params.id]);
    await pool.query('DELETE FROM notatka WHERE ticket_id = ?', [req.params.id]).catch(() => {});
    await pool.query('DELETE FROM user_has_ticket WHERE ticket_id = ?', [req.params.id]);
    await pool.query('DELETE FROM alert WHERE ticket_id = ?', [req.params.id]).catch(() => {});
    await pool.query('DELETE FROM ticket WHERE id = ?', [req.params.id]);

    res.json({ success: true });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

// POST /api/tickets/:id/przydziel
router.post('/:id/przydziel', async (req, res) => {
  try {
    const { user_id } = req.body;
    if (!user_id) return res.status(400).json({ error: 'Brak user_id' });

    const now = Math.floor(Date.now() / 1000);
    const [existing] = await pool.query(
      'SELECT id FROM user_has_ticket WHERE ticket_id = ? AND user_id = ?',
      [req.params.id, user_id]
    );
    if (!existing.length) {
      await pool.query(
        'INSERT INTO user_has_ticket (ticket_id, user_id, data, created_by, updated_by, created_at, updated_at) VALUES (?, ?, ?, ?, ?, ?, ?)',
        [req.params.id, user_id, now, req.user.id, req.user.id, now, now]
      );

      // Powiadom przypisanego pracownika
      const [[ticket]] = await pool.query(
        'SELECT numer, message_subject, message_from FROM ticket WHERE id = ?', [req.params.id]
      );
      const [[worker]] = await pool.query(
        'SELECT email, imie, nazwisko FROM user WHERE id = ?', [user_id]
      );
      if (worker?.email && ticket) {
        const baseUrl = await getSiteUrl();
        const appName = await getAppName();
        const lang = await resolveLang(pool, user_id);
        const ticketSubj = ticket.message_subject || '(brak tematu)';
        const assignedBy = [req.user.imie, req.user.nazwisko].filter(Boolean).join(' ') || req.user.email;
        const greeting = worker.imie ? tr(lang, 'greeting_day_with_name', { name: worker.imie }) : tr(lang, 'greeting_formal');
        mailer.sendNotification({
          to: worker.email,
          subject: tr(lang, 'subject_assigned', { appName, numer: ticket.numer }),
          greeting,
          lang,
          html: `
            <p>${tr(lang, 'assigned_intro')}</p>
            <table style="width:100%;border-collapse:collapse;font-size:13px;margin:16px 0">
              <tr style="background:#f9fafb">
                <td style="padding:8px 12px;border:1px solid #e5e7eb;font-weight:600;width:140px;color:#374151">${tr(lang, 'col_ticket_no')}</td>
                <td style="padding:8px 12px;border:1px solid #e5e7eb;color:#111827">#${ticket.numer}</td>
              </tr>
              <tr>
                <td style="padding:8px 12px;border:1px solid #e5e7eb;font-weight:600;color:#374151">${tr(lang, 'col_subject')}</td>
                <td style="padding:8px 12px;border:1px solid #e5e7eb;color:#111827">${ticketSubj.replace(/</g, '&lt;')}</td>
              </tr>
              <tr style="background:#f9fafb">
                <td style="padding:8px 12px;border:1px solid #e5e7eb;font-weight:600;color:#374151">${tr(lang, 'col_from')}</td>
                <td style="padding:8px 12px;border:1px solid #e5e7eb;color:#111827">${(ticket.message_from || '').replace(/</g, '&lt;')}</td>
              </tr>
              <tr>
                <td style="padding:8px 12px;border:1px solid #e5e7eb;font-weight:600;color:#374151">${tr(lang, 'col_assigned_by')}</td>
                <td style="padding:8px 12px;border:1px solid #e5e7eb;color:#111827">${assignedBy.replace(/</g, '&lt;')}</td>
              </tr>
            </table>
            <p style="margin-top:16px">
              <a href="${baseUrl}/tickets/${req.params.id}" style="display:inline-block;background:#1d4ed8;color:#fff;padding:10px 20px;border-radius:6px;text-decoration:none;font-size:14px">
                ${tr(lang, 'btn_view_ticket')}
              </a>
            </p>`,
        }).catch(e => console.warn('[Assign] Email nie wysłany:', e.message));
      }
    }
    await pool.query('UPDATE ticket SET status=2 WHERE id=?', [req.params.id]);
    res.json({ success: true });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

// DELETE /api/tickets/:id/przydziel/:user_id
router.delete('/:id/przydziel/:user_id', async (req, res) => {
  try {
    const [[ticket]] = await pool.query(
      'SELECT numer, message_subject, message_from FROM ticket WHERE id = ?', [req.params.id]
    );
    const [[worker]] = await pool.query(
      'SELECT email, imie, nazwisko FROM user WHERE id = ?', [req.params.user_id]
    );

    await pool.query(
      'DELETE FROM user_has_ticket WHERE ticket_id = ? AND user_id = ?',
      [req.params.id, req.params.user_id]
    );
    const [[{ cnt }]] = await pool.query(
      'SELECT COUNT(*) as cnt FROM user_has_ticket WHERE ticket_id = ?',
      [req.params.id]
    );
    if (cnt === 0) {
      await pool.query('UPDATE ticket SET status=1 WHERE id=?', [req.params.id]);
    }

    // Powiadom odpiętego pracownika
    if (worker?.email && ticket) {
      const baseUrl = await getSiteUrl();
      const appName = await getAppName();
      const lang = await resolveLang(pool, req.params.user_id);
      const ticketSubj = ticket.message_subject || '(brak tematu)';
      const removedBy = [req.user.imie, req.user.nazwisko].filter(Boolean).join(' ') || req.user.email;
      const greeting = worker.imie ? tr(lang, 'greeting_day_with_name', { name: worker.imie }) : tr(lang, 'greeting_formal');
      mailer.sendNotification({
        to: worker.email,
        subject: tr(lang, 'subject_unassigned_from', { appName, numer: ticket.numer }),
        greeting,
        lang,
        html: `
          <p>${tr(lang, 'unassigned_from_intro')}</p>
          <table style="width:100%;border-collapse:collapse;font-size:13px;margin:16px 0">
            <tr style="background:#f9fafb">
              <td style="padding:8px 12px;border:1px solid #e5e7eb;font-weight:600;width:140px;color:#374151">${tr(lang, 'col_ticket_no')}</td>
              <td style="padding:8px 12px;border:1px solid #e5e7eb;color:#111827">#${ticket.numer}</td>
            </tr>
            <tr>
              <td style="padding:8px 12px;border:1px solid #e5e7eb;font-weight:600;color:#374151">${tr(lang, 'col_subject')}</td>
              <td style="padding:8px 12px;border:1px solid #e5e7eb;color:#111827">${ticketSubj.replace(/</g, '&lt;')}</td>
            </tr>
            <tr style="background:#f9fafb">
              <td style="padding:8px 12px;border:1px solid #e5e7eb;font-weight:600;color:#374151">${tr(lang, 'col_removed_by')}</td>
              <td style="padding:8px 12px;border:1px solid #e5e7eb;color:#111827">${removedBy.replace(/</g, '&lt;')}</td>
            </tr>
          </table>`,
      }).catch(e => console.warn('[Unassign] Email nie wysłany:', e.message));
    }

    res.json({ success: true });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

// POST /api/tickets/:id/ldap-refresh — odśwież dane LDAP zgłaszającego
router.post('/:id/ldap-refresh', async (req, res) => {
  try {
    const [[ticket]] = await pool.query('SELECT id, message_from FROM ticket WHERE id=?', [req.params.id]);
    if (!ticket) return res.status(404).json({ error: 'Ticket nie znaleziony' });

    const { lookupEmail } = require('../utils/ldap');
    const ldap = await Promise.race([
      lookupEmail(ticket.message_from),
      new Promise(r => setTimeout(() => r(undefined), 5000)),
    ]);

    if (ldap) {
      await pool.query(
        'UPDATE ticket SET ldap_name=?, ldap_ou=?, ldap_num=?, ldap_data=? WHERE id=?',
        [ldap.name, ldap.ou, ldap.num, JSON.stringify(ldap.extra || {}), ticket.id]
      );
      return res.json({ found: true, ldap });
    } else if (ldap === null) {
      await pool.query("UPDATE ticket SET ldap_ou='not_found', ldap_name=NULL, ldap_num=NULL, ldap_data=NULL WHERE id=?", [ticket.id]);
      return res.json({ found: false });
    } else {
      return res.status(504).json({ error: 'Timeout LDAP' });
    }
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

// POST /api/tickets/:id/zamknij
router.post('/:id/zamknij', async (req, res) => {
  try {
    const now = Math.floor(Date.now() / 1000);
    const sendNotification = req.body?.send_notification !== false && req.body?.send_notification !== 0;

    const [[ticket]] = await pool.query(
      'SELECT numer, message_from, message_subject FROM ticket WHERE id = ?',
      [req.params.id]
    );

    await pool.query('UPDATE ticket SET status=3, data_zamkniecia=?, odlozony=0 WHERE id=?', [now, req.params.id]);

    // Email do zgłaszającego o zamknięciu
    if (sendNotification && ticket?.message_from) {
      mailer.sendNotification({
        to: ticket.message_from,
        subject: `Zgłoszenie #${ticket.numer} zostało zamknięte`,
        html: `
          <p>Uprzejmie informujemy, że Państwa zgłoszenie zostało rozwiązane i zamknięte przez nasz zespół wsparcia.</p>
          <table style="width:100%;max-width:480px;border-collapse:collapse;font-size:14px;margin:16px 0">
            <tr style="background:#f9fafb">
              <td style="padding:8px 12px;border:1px solid #e5e7eb;font-weight:600;width:160px;color:#374151">Numer zgłoszenia</td>
              <td style="padding:8px 12px;border:1px solid #e5e7eb;color:#111827;font-weight:700">#${ticket.numer}</td>
            </tr>
            <tr>
              <td style="padding:8px 12px;border:1px solid #e5e7eb;font-weight:600;color:#374151">Temat</td>
              <td style="padding:8px 12px;border:1px solid #e5e7eb;color:#111827">${(ticket.message_subject || '').replace(/</g, '&lt;')}</td>
            </tr>
            <tr style="background:#f9fafb">
              <td style="padding:8px 12px;border:1px solid #e5e7eb;font-weight:600;color:#374151">Status</td>
              <td style="padding:8px 12px;border:1px solid #e5e7eb;color:#16a34a;font-weight:600">Zamknięte</td>
            </tr>
          </table>
          <p>Dziękujemy za skorzystanie z naszego systemu obsługi zgłoszeń. Jeżeli problem powróci lub pojawią się nowe kwestie wymagające wsparcia, prosimy o kontakt — chętnie pomożemy.</p>
        `,
      }).catch(err => console.warn(`[tickets/zamknij] Email nie wysłany: ${err.message}`));
    }

    res.json({ success: true });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

// POST /api/tickets/:id/otworz
router.post('/:id/otworz', async (req, res) => {
  try {
    await pool.query('UPDATE ticket SET status=2, data_zamkniecia=NULL WHERE id=?', [req.params.id]);
    res.json({ success: true });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

// POST /api/tickets/:id/status — ręczna zmiana statusu (1/2/3)
router.post('/:id/status', async (req, res) => {
  try {
    const newStatus = parseInt(req.body.status);
    if (![1, 2, 3].includes(newStatus)) return res.status(400).json({ error: 'Nieprawidłowy status' });
    const now = Math.floor(Date.now() / 1000);
    if (newStatus === 3) {
      await pool.query('UPDATE ticket SET status=3, data_zamkniecia=? WHERE id=?', [now, req.params.id]);
    } else if (newStatus === 1) {
      await pool.query('UPDATE ticket SET status=1, data_zamkniecia=NULL WHERE id=?', [req.params.id]);
    } else {
      await pool.query('UPDATE ticket SET status=2, data_zamkniecia=NULL WHERE id=?', [req.params.id]);
    }
    res.json({ success: true });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

// POST /api/tickets/:id/odloz
router.post('/:id/odloz', async (req, res) => {
  try {
    const { data } = req.body;
    await pool.query('UPDATE ticket SET odlozony=1, odlozony_data=? WHERE id=?', [data, req.params.id]);
    res.json({ success: true });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

// POST /api/tickets/:id/redact — usuń treść zawierającą dane osobowe (RODO)
router.post('/:id/redact', requireAdmin, async (req, res) => {
  try {
    const [[ticket]] = await pool.query('SELECT id, numer FROM ticket WHERE id = ?', [req.params.id]);
    if (!ticket) return res.status(404).json({ error: 'Ticket nie znaleziony' });

    const redactedText = '[Treść usunięta — zawierała dane osobowe lub poufne informacje. Usunięto przez administratora.]';
    const redactedHtml = `<p style="color:#6b7280;font-style:italic">${redactedText}</p>`;

    await pool.query(
      'UPDATE ticket SET tresc = ?, html = ? WHERE id = ?',
      [redactedText, redactedHtml, req.params.id]
    );

    // Zaloguj akcję w notatkach wewnętrznych
    const now = Math.floor(Date.now() / 1000);
    try {
      await pool.query(
        `INSERT INTO notatka (ticket_id, tresc, data, created_by, updated_by, created_at, updated_at)
         VALUES (?, ?, ?, ?, ?, ?, ?)`,
        [
          req.params.id,
          `[RODO] Treść zgłoszenia została zanonimizowana przez ${req.user.imie} ${req.user.nazwisko}.`,
          now, req.user.id, req.user.id, now, now,
        ]
      );
    } catch { /* tabela notatka może mieć inną strukturę */ }

    res.json({ success: true });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

// POST /api/tickets/:id/przywroc
router.post('/:id/przywroc', async (req, res) => {
  try {
    await pool.query('UPDATE ticket SET odlozony=0, odlozony_data=NULL WHERE id=?', [req.params.id]);
    res.json({ success: true });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

// POST /api/tickets/:id/autor-token — generuj token dostępu dla autora zgłoszenia
router.post('/:id/autor-token', async (req, res) => {
  try {
    const [[ticket]] = await pool.query('SELECT id, numer, message_from, message_subject, autor_token FROM ticket WHERE id = ?', [req.params.id]);
    if (!ticket) return res.status(404).json({ error: 'Ticket nie znaleziony' });

    const token = require('crypto').randomUUID();
    await pool.query('UPDATE ticket SET autor_token = ? WHERE id = ?', [token, req.params.id]);

    const { getSiteUrl } = require('../utils/siteUrl');
    const frontendUrl = await getSiteUrl();
    const link = `${frontendUrl}/status/${token}`;

    // Opcjonalnie wyślij email do autora
    const { sendEmail } = req.body;
    if (sendEmail && ticket.message_from) {
      try {
        await mailer.sendNotification({
          to: ticket.message_from,
          subject: `Dostęp do Twojego zgłoszenia #${ticket.numer}`,
          greeting: 'Szanowni Państwo,',
          html: `
            <p>Przesyłamy link umożliwiający podgląd statusu Państwa zgłoszenia oraz kontakt z obsługą.</p>
            <table style="width:100%;max-width:480px;border-collapse:collapse;font-size:14px;margin:16px 0">
              <tr style="background:#f9fafb">
                <td style="padding:8px 12px;border:1px solid #e5e7eb;font-weight:600;width:160px;color:#374151">Numer zgłoszenia</td>
                <td style="padding:8px 12px;border:1px solid #e5e7eb;color:#111827;font-weight:700">#${ticket.numer}</td>
              </tr>
              <tr>
                <td style="padding:8px 12px;border:1px solid #e5e7eb;font-weight:600;color:#374151">Temat</td>
                <td style="padding:8px 12px;border:1px solid #e5e7eb;color:#111827">${(ticket.message_subject || '').replace(/</g, '&lt;')}</td>
              </tr>
            </table>
            <p style="margin:20px 0">
              <a href="${link}" style="display:inline-block;background:#1e40af;color:#ffffff;text-decoration:none;padding:12px 24px;border-radius:6px;font-weight:600">
                Sprawdź status zgłoszenia →
              </a>
            </p>
            <p style="font-size:12px;color:#6b7280">Jeżeli przycisk nie działa, skopiuj i wklej poniższy link do przeglądarki:<br>${link}</p>
          `,
        });
      } catch (mailErr) {
        console.warn('[autor-token] email error:', mailErr.message);
      }
    }

    res.json({ token, link });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

// DELETE /api/tickets/:id/autor-token — cofnij dostęp autora
router.delete('/:id/autor-token', async (req, res) => {
  try {
    const [[ticket]] = await pool.query('SELECT id FROM ticket WHERE id = ?', [req.params.id]);
    if (!ticket) return res.status(404).json({ error: 'Ticket nie znaleziony' });
    await pool.query('UPDATE ticket SET autor_token = NULL WHERE id = ?', [req.params.id]);
    res.json({ success: true });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

// POST /api/tickets/:id/odpowiedz
router.post('/:id/odpowiedz', upload.array('files', 10), async (req, res) => {
  try {
    const { to, cc, tresc, html, zamknij, close_notify } = req.body;
    const now = Math.floor(Date.now() / 1000);

    const [ticket] = await pool.query('SELECT * FROM ticket WHERE id=?', [req.params.id]);
    if (!ticket.length) return res.status(404).json({ error: 'Ticket nie znaleziony' });

    const [kResult] = await pool.query(
      `INSERT INTO korespondencja (ticket_id, data, created_by, updated_by, created_at, updated_at, tresc, html, message_to, message_cc, message_subject, message_from, przeczytane)
       VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, 1)`,
      [req.params.id, now, req.user.id, req.user.id, now, now, tresc, html,
       to, cc || '', ticket[0].message_subject, req.user.email]
    );

    // upewnij się że przypisany
    const [existing] = await pool.query(
      'SELECT id FROM user_has_ticket WHERE ticket_id=? AND user_id=?',
      [req.params.id, req.user.id]
    );
    if (!existing.length) {
      await pool.query(
        'INSERT INTO user_has_ticket (ticket_id, user_id, data, created_by, updated_by, created_at, updated_at) VALUES (?, ?, ?, ?, ?, ?, ?)',
        [req.params.id, req.user.id, now, req.user.id, req.user.id, now, now]
      );
      await pool.query('UPDATE ticket SET status=2 WHERE id=?', [req.params.id]);
    }

    try {
      await pool.query('UPDATE ticket SET first_response_at = COALESCE(first_response_at, ?) WHERE id = ?', [now, req.params.id]);
    } catch {
      // Kolumna first_response_at może nie istnieć przed migracją schematu.
    }

    // Zamknij ticket jeśli zaznaczono (zamknij przychodzi jako string '0'/'1' z FormData)
    if (zamknij === '1' || zamknij === true || zamknij === 1) {
      await pool.query('UPDATE ticket SET status=3, data_zamkniecia=?, odlozony=0 WHERE id=?', [now, req.params.id]);
    }

    // Zapisz załączniki do DB
    const savedFiles = [];
    if (req.files && req.files.length) {
      for (const file of req.files) {
        const filepath = file.path.replace(uploadDir + '/', '');
        const [fResult] = await pool.query(
          'INSERT INTO plik (tabela, ticket_id, filepath, originalname) VALUES (?, ?, ?, ?)',
          [2, kResult.insertId, filepath, file.originalname]
        );
        savedFiles.push({ id: fResult.insertId, filepath: file.path, originalname: file.originalname, mimetype: file.mimetype });
      }
    }

    // wyślij email
    let mailError = null;
    try {
      const rawSubject = ticket[0].message_subject || '(brak tematu)';
      const numerTag = `[#${ticket[0].numer}]`;
      let subject = rawSubject.startsWith('Re:') ? rawSubject : `Re: ${rawSubject}`;
      if (!subject.includes(numerTag)) subject += ` ${numerTag}`;

      // Dołącz informację o zamknięciu do treści emaila (tylko jeśli close_notify=1)
      const isClosing = zamknij === '1' || zamknij === true || zamknij === 1;
      const includeCloseNote = isClosing && (close_notify === '1' || close_notify === true || close_notify === 1);
      const closingNote = includeCloseNote
        ? `<div style="margin-top:20px;padding:12px 16px;background:#f0fdf4;border:1px solid #86efac;border-radius:6px;font-size:13px;color:#166534">
             <strong>Zgłoszenie zostało zamknięte.</strong> Uznajemy sprawę za rozwiązaną. Jeżeli problem powróci lub pojawią się nowe pytania, prosimy o ponowny kontakt — chętnie pomożemy.
           </div>`
        : '';
      const emailHtml = html ? `${html}${closingNote}` : null;
      const emailTresc = includeCloseNote
        ? `${tresc}\n\n---\nZgłoszenie zostało zamknięte. Jeżeli problem powróci, prosimy o kontakt.`
        : tresc;

      const emailAttachments = savedFiles.map(f => ({
        filename: f.originalname,
        path: f.filepath,
        contentType: f.mimetype,
      }));

      console.log(`[Mail] Wysyłam odpowiedź na ticket #${ticket[0].numer} do: ${to}, temat: ${subject}, załączników: ${emailAttachments.length}`);
      const sentMsgId = await mailer.sendReply({ to, cc, subject, html: emailHtml, tresc: emailTresc, attachments: emailAttachments });
      console.log(`[Mail] Wysłano pomyślnie do ${to}`);
      if (sentMsgId) {
        await pool.query('UPDATE korespondencja SET message_id = ? WHERE id = ?', [sentMsgId, kResult.insertId]);
      }
    } catch (mailErr) {
      mailError = mailErr.message;
      console.error(`[Mail] BŁĄD wysyłki do ${to}:`, mailErr.message);
      // Zapisz błąd trwale przy wiadomości — widoczny w wątku korespondencji
      await pool.query('UPDATE korespondencja SET mail_error = ? WHERE id = ?', [mailErr.message, kResult.insertId]).catch(() => {});
    }

    // push do przypisanych (z wyłączeniem autora odpowiedzi)
    const [przypisani] = await pool.query(
      'SELECT user_id FROM user_has_ticket WHERE ticket_id = ? AND user_id != ?',
      [req.params.id, req.user.id]
    );
    const idsDoNotify = przypisani.map((r) => r.user_id);
    notifyUsers(idsDoNotify, {
      title: `Nowa odpowiedź: ${ticket[0].message_subject}`,
      body: `Odpowiedź od: ${req.user.imie} ${req.user.nazwisko}`,
      url: `/tickets/${req.params.id}`,
    }).catch(() => {});

    res.json({ success: true, korespondencja_id: kResult.insertId, mailError });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

// POST /api/tickets/masowe-usun - trwałe masowe usunięcie (tylko zamknięte, tylko admin)
router.post('/masowe-usun', requireAdmin, async (req, res) => {
  try {
    const { ids } = req.body;
    if (!ids?.length) return res.status(400).json({ error: 'Brak ids' });

    const ph = ids.map(() => '?').join(',');
    const [closed] = await pool.query(`SELECT id FROM ticket WHERE id IN (${ph}) AND status = 3`, ids);
    if (!closed.length) return res.status(400).json({ error: 'Żaden z wybranych ticketów nie jest zamknięty' });

    const closedIds = closed.map(r => r.id);
    const cph = closedIds.map(() => '?').join(',');

    const [files] = await pool.query(`SELECT filepath FROM plik WHERE ticket_id IN (${cph})`, closedIds);
    for (const f of files) {
      try { fs.unlinkSync(path.join(uploadDir, f.filepath)); } catch {}
    }

    await pool.query(`DELETE FROM plik WHERE ticket_id IN (${cph})`, closedIds);
    await pool.query(`DELETE FROM korespondencja WHERE ticket_id IN (${cph})`, closedIds);
    await pool.query(`DELETE FROM notatka WHERE ticket_id IN (${cph})`, closedIds).catch(() => {});
    await pool.query(`DELETE FROM user_has_ticket WHERE ticket_id IN (${cph})`, closedIds);
    await pool.query(`DELETE FROM alert WHERE ticket_id IN (${cph})`, closedIds).catch(() => {});
    await pool.query(`DELETE FROM ticket WHERE id IN (${cph})`, closedIds);

    res.json({ success: true, deleted: closedIds.length, skipped: ids.length - closedIds.length });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

// POST /api/tickets/masowe - bulk close
router.post('/masowe', requireAdmin, async (req, res) => {
  try {
    const { ids } = req.body;
    if (!ids?.length) return res.status(400).json({ error: 'Brak ids' });
    const now = Math.floor(Date.now() / 1000);
    await pool.query(
      `UPDATE ticket SET status=3, data_zamkniecia=? WHERE id IN (${ids.map(() => '?').join(',')})`,
      [now, ...ids]
    );
    res.json({ success: true, count: ids.length });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

// Stan masowej klasyfikacji (w pamięci procesu)
const bulkJob = { running: false, total: 0, done: 0, errors: 0, startedAt: null };

// POST /api/tickets/klasyfikuj-masowo — start masowej klasyfikacji AI
router.post('/klasyfikuj-masowo', requireAdmin, async (req, res) => {
  if (bulkJob.running) {
    return res.json({ alreadyRunning: true, progress: bulkJob });
  }

  const tylkoNowe = req.query.tylko_nowe !== '0';
  const where = tylkoNowe ? 'ai_tag IS NULL AND status != 3' : 'status != 3';
  const [rows] = await pool.query(`SELECT id, message_subject, tresc, message_from FROM ticket WHERE ${where} ORDER BY id DESC`);

  if (!rows.length) return res.json({ success: true, total: 0, message: 'Brak ticketów do klasyfikacji' });

  bulkJob.running = true;
  bulkJob.total = rows.length;
  bulkJob.done = 0;
  bulkJob.errors = 0;
  bulkJob.startedAt = Date.now();

  res.json({ started: true, total: rows.length });

  // Przetwarzaj w tle z throttlingiem (2s między requestami = ~30 req/min)
  (async () => {
    for (const ticket of rows) {
      try {
        await classifyAndSave(ticket.id, {
          subject: ticket.message_subject,
          body: ticket.tresc,
          from: ticket.message_from,
        });
        bulkJob.done++;
      } catch {
        bulkJob.errors++;
        bulkJob.done++;
      }
      if (bulkJob.done < rows.length) {
        await new Promise(r => setTimeout(r, 2100));
      }
    }
    bulkJob.running = false;
    console.log(`[Groq] Masowa klasyfikacja zakończona: ${bulkJob.done} / ${bulkJob.total}`);
  })();
});

// GET /api/tickets/klasyfikuj-masowo/status
router.get('/klasyfikuj-masowo/status', requireAdmin, (req, res) => {
  res.json({ ...bulkJob });
});

// POST /api/tickets/:id/classify — ręczna reklasyfikacja AI
router.post('/:id/classify', async (req, res) => {
  try {
    const [[ticket]] = await pool.query('SELECT message_subject, tresc, message_from FROM ticket WHERE id = ?', [req.params.id]);
    if (!ticket) return res.status(404).json({ error: 'Ticket nie znaleziony' });
    await classifyAndSave(req.params.id, { subject: ticket.message_subject, body: ticket.tresc, from: ticket.message_from });
    const [[updated]] = await pool.query('SELECT ai_tag, ai_reason FROM ticket WHERE id = ?', [req.params.id]);
    res.json({ success: true, ai_tag: updated.ai_tag, ai_reason: updated.ai_reason });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});


// POST /api/tickets/:id/nie-spam — cofnij oznaczenie jako spam
router.post('/:id/nie-spam', requireAdmin, async (req, res) => {
  try {
    await pool.query("UPDATE ticket SET ai_tag = 'normalne', ai_reason = NULL WHERE id = ?", [req.params.id]);
    res.json({ success: true });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

// POST /api/tickets/:id/ai-reply — generuj propozycję odpowiedzi AI
router.post('/:id/ai-reply', async (req, res) => {
  try {
    const [[ticket]] = await pool.query(
      'SELECT message_subject, tresc, message_from FROM ticket WHERE id = ?',
      [req.params.id]
    );
    if (!ticket) return res.status(404).json({ error: 'Nie znaleziono' });

    const [history] = await pool.query(
      `SELECT CONCAT(u.imie, ' ', u.nazwisko) as autor, k.tresc
       FROM korespondencja k
       LEFT JOIN user u ON u.id = k.created_by
       WHERE k.ticket_id = ? ORDER BY k.data ASC LIMIT 10`,
      [req.params.id]
    );

    const suggestion = await generateReply({
      subject: ticket.message_subject,
      body: ticket.tresc,
      from: ticket.message_from,
      history,
      workerName: `${req.user.imie || ''} ${req.user.nazwisko || ''}`.trim(),
    });

    if (!suggestion) return res.status(503).json({ error: 'Groq niedostępne lub brak klucza API' });
    res.json({ suggestion });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

// POST /api/tickets/:id/przekaz — przekaż ticket mailem do zewnętrznego adresata
router.post('/:id/przekaz', async (req, res) => {
  const { email_do, wiadomosc } = req.body;
  if (!email_do) return res.status(400).json({ error: 'Podaj adres email odbiorcy' });

  try {
    const [[ticket]] = await pool.query('SELECT * FROM ticket WHERE id = ?', [req.params.id]);
    if (!ticket) return res.status(404).json({ error: 'Ticket nie znaleziony' });

    const now = Math.floor(Date.now() / 1000);
    const ticketDate = ticket.data_utworzenia
      ? new Date(ticket.data_utworzenia * 1000).toLocaleString('pl-PL', { dateStyle: 'short', timeStyle: 'short' })
      : null;

    let mailError = null;
    let msgId = null;

    try {
      msgId = await mailer.sendForward({
        to: email_do,
        ticketNumer: ticket.numer,
        ticketSubject: ticket.message_subject || '(brak tematu)',
        ticketFrom: ticket.message_from,
        ticketDate,
        ticketTresc: ticket.tresc,
        ticketHtml: ticket.html,
        wiadomoscOd: wiadomosc || null,
        inReplyTo: ticket.message_id || null,
      });
    } catch (err) {
      mailError = err.message;
      console.error('[tickets/przekaz] Błąd wysyłki:', err.message);
    }

    // Zapisz w korespondencji niezależnie od błędu maila
    const notaBody = wiadomosc
      ? `Przekazano do: ${email_do}\n\n${wiadomosc}`
      : `Przekazano do: ${email_do}`;

    await pool.query(
      `INSERT INTO korespondencja
         (ticket_id, data, created_by, updated_by, created_at, updated_at,
          tresc, html, message_to, message_cc, message_subject, message_from, message_id, typ)
       VALUES (?, ?, ?, ?, ?, ?, ?, NULL, ?, '', ?, ?, ?, 'forward', 1)`,
      [
        req.params.id, now, req.user.id, req.user.id, now, now,
        notaBody,
        email_do,
        `[FWD #${ticket.numer}] ${ticket.message_subject || '(brak tematu)'}`,
        req.user.email,
        msgId || null,
      ]
    );

    res.json({ success: true, mailError });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

// GET /api/tickets/:id/next, /api/tickets/:id/prev
router.get('/:id/next', async (req, res) => {
  const [[row]] = await pool.query(
    'SELECT id FROM ticket WHERE id > ? AND status != 3 ORDER BY id ASC LIMIT 1',
    [req.params.id]
  );
  res.json({ id: row?.id || null });
});

router.get('/:id/prev', async (req, res) => {
  const [[row]] = await pool.query(
    'SELECT id FROM ticket WHERE id < ? AND status != 3 ORDER BY id DESC LIMIT 1',
    [req.params.id]
  );
  res.json({ id: row?.id || null });
});

module.exports = router;
