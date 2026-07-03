const express = require('express');
const router = express.Router();
const pool = require('../config/db');
const { authenticate, requireWorker, getAuthorizedZespolIds } = require('../middleware/auth');
const { notifyUsers } = require('../utils/webpush');

router.use(authenticate, requireWorker);

// GET /api/opinie — przesłane oceny CSAT, admin widzi wszystkie, kierownik tylko swój zespół
router.get('/', async (req, res) => {
  try {
    const authorized = getAuthorizedZespolIds(req.user);
    const { zespol_id, page = 1, limit = 50 } = req.query;

    if (zespol_id) {
      if (authorized !== 'all' && !authorized.includes(Number(zespol_id))) {
        return res.status(403).json({ error: 'Brak uprawnień do tego zespołu' });
      }
    } else if (authorized !== 'all') {
      return res.status(403).json({ error: 'Wymagana rola admin lub kierownika zespołu' });
    }

    const offset = (page - 1) * limit;
    // LEFT JOIN do wyświetlenia nazwy zespołu — niezależny od filtra poniżej.
    const params = [];
    let filterSql = '';
    if (zespol_id) {
      filterSql = 'AND EXISTS (SELECT 1 FROM zespol_has_ticket zht2 WHERE zht2.ticket_id = t.id AND zht2.zespol_id = ?)';
      params.push(Number(zespol_id));
    }

    const [rows] = await pool.query(
      `SELECT t.id, t.numer, t.message_subject, t.message_from,
              t.csat_rating, t.csat_comment, t.csat_submitted_at, t.csat_przeczytane,
              t.csat_pokazany_user_id, t.csat_pokazany_at,
              pu.imie as csat_pokazany_imie, pu.nazwisko as csat_pokazany_nazwisko,
              GROUP_CONCAT(DISTINCT z.nazwa SEPARATOR ', ') as zespoly
       FROM ticket t
       LEFT JOIN zespol_has_ticket zht ON zht.ticket_id = t.id
       LEFT JOIN zespol z ON z.id = zht.zespol_id
       LEFT JOIN user pu ON pu.id = t.csat_pokazany_user_id
       WHERE t.csat_rating IS NOT NULL ${filterSql}
       GROUP BY t.id
       ORDER BY t.csat_submitted_at DESC
       LIMIT ? OFFSET ?`,
      [...params, parseInt(limit), parseInt(offset)]
    );

    const [[{ total }]] = await pool.query(
      `SELECT COUNT(*) as total FROM ticket t WHERE t.csat_rating IS NOT NULL ${filterSql}`,
      params
    );

    // Wyświetlenie listy = przeczytanie — zdejmuje z licznika nieprzeczytanych opinii,
    // ten sam wzorzec co oznaczanie korespondencji jako przeczytanej po otwarciu ticketu.
    const unreadIds = rows.filter((r) => !r.csat_przeczytane).map((r) => r.id);
    if (unreadIds.length) {
      await pool.query(
        `UPDATE ticket SET csat_przeczytane = 1 WHERE id IN (${unreadIds.map(() => '?').join(',')})`,
        unreadIds
      );
    }

    res.json({ data: rows, total, page: parseInt(page), limit: parseInt(limit) });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

// GET /api/opinie/:id/repliers — pracownicy, którzy odpowiadali na dane zgłoszenie
// (kandydaci do udostępnienia opinii)
router.get('/:id/repliers', async (req, res) => {
  try {
    const [rows] = await pool.query(
      `SELECT DISTINCT u.id, u.imie, u.nazwisko
       FROM korespondencja k
       JOIN user u ON u.id = k.created_by
       WHERE k.ticket_id = ? AND k.created_by IS NOT NULL
       ORDER BY u.imie, u.nazwisko`,
      [req.params.id]
    );
    res.json({ data: rows });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

// POST /api/opinie/:id/pokaz — udostępnij opinię konkretnemu pracownikowi
router.post('/:id/pokaz', async (req, res) => {
  try {
    const { user_id } = req.body;
    if (!user_id) return res.status(400).json({ error: 'Wybierz pracownika' });

    const [[ticket]] = await pool.query(
      'SELECT id, numer, csat_rating FROM ticket WHERE id = ?', [req.params.id]
    );
    if (!ticket) return res.status(404).json({ error: 'Ticket nie znaleziony' });
    if (ticket.csat_rating == null) return res.status(400).json({ error: 'To zgłoszenie nie ma jeszcze oceny' });

    const now = Math.floor(Date.now() / 1000);
    await pool.query(
      'UPDATE ticket SET csat_pokazany_user_id = ?, csat_pokazany_at = ? WHERE id = ?',
      [user_id, now, req.params.id]
    );

    notifyUsers([user_id], {
      title: 'Otrzymałeś ocenę satysfakcji',
      body: `Twoja odpowiedź w zgłoszeniu #${ticket.numer} otrzymała ocenę ${ticket.csat_rating}/5`,
      url: `/tickets/${req.params.id}`,
    }).catch(() => {});

    res.json({ success: true });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

module.exports = router;
