const express = require('express');
const router = express.Router();
const pool = require('../config/db');
const { authenticate, requireWorker, getAuthorizedZespolIds } = require('../middleware/auth');
const { enrichTicketSla } = require('../utils/sla');

router.use(authenticate, requireWorker);

// GET /api/statystyki — admin: bez zespol_id widzi całość; z zespol_id (lub kierownik
// zespołu) widzi dane ograniczone do tego zespołu. Plain pracownik bez flagi kierownika
// i bez uprawnień admina nie dostaje nic (403) — to jedyne miejsce broniące tej granicy,
// dlatego sprawdzenie jest pierwszą instrukcją w handlerze.
router.get('/', async (req, res) => {
  try {
    const authorized = getAuthorizedZespolIds(req.user);
    const zespolIdRaw = req.query.zespol_id;
    if (zespolIdRaw) {
      if (authorized !== 'all' && !authorized.includes(Number(zespolIdRaw))) {
        return res.status(403).json({ error: 'Brak uprawnień do tego zespołu' });
      }
    } else if (authorized !== 'all') {
      return res.status(403).json({ error: 'Wymagana rola admin lub kierownika zespołu' });
    }
    const zespolId = zespolIdRaw ? Number(zespolIdRaw) : null;

    // Predykat "AND zespol_id = ?" jest obowiązkowy w obu poniższych join-ach — i
    // zespol_has_ticket, i zespol_user mają unikalny klucz (zespol_id, ticket_id)/
    // (zespol_id, user_id), więc filtrowanie do JEDNEGO zespołu gwarantuje maksymalnie
    // jeden dopasowany wiersz na ticket/użytkownika (brak duplikacji w COUNT/AVG/SUM).
    // Join bez tego predykatu (np. "pokaż wszystkie zespoły naraz") by to złamał.
    const zJoin = zespolId ? 'JOIN zespol_has_ticket zht ON zht.ticket_id = t.id AND zht.zespol_id = ?' : '';
    const zParam = zespolId ? [zespolId] : [];
    const wJoin = zespolId ? 'JOIN zespol_user zu ON zu.user_id = u.id AND zu.zespol_id = ?' : '';
    const wParam = zespolId ? [zespolId] : [];

    const nowTs = Math.floor(Date.now() / 1000);
    const days = Math.max(1, Math.min(365, parseInt(req.query.days || '30', 10)));
    const periodStart = nowTs - (days * 24 * 60 * 60);

    const [[nowe]] = await pool.query(`SELECT COUNT(*) as cnt FROM ticket t ${zJoin} WHERE t.status = 1`, zParam);
    const [[przypisane]] = await pool.query(`SELECT COUNT(*) as cnt FROM ticket t ${zJoin} WHERE t.status = 2`, zParam);
    const [[zamkniete]] = await pool.query(`SELECT COUNT(*) as cnt FROM ticket t ${zJoin} WHERE t.status = 3`, zParam);
    const [[odlozone]] = await pool.query(`SELECT COUNT(*) as cnt FROM ticket t ${zJoin} WHERE t.odlozony = 1`, zParam);
    const [[razem]] = await pool.query(`SELECT COUNT(*) as cnt FROM ticket t ${zJoin}`, zParam);
    const [[csatRow]] = await pool.query(
      `SELECT AVG(t.csat_rating) as avg_rating, COUNT(*) as cnt FROM ticket t ${zJoin} WHERE t.csat_rating IS NOT NULL AND t.csat_submitted_at >= ?`,
      [...zParam, periodStart]
    );

    // tickety wg dnia ostatnie 30 dni
    const [ostatnie30] = await pool.query(
      `SELECT DATE(FROM_UNIXTIME(t.data_utworzenia)) as dzien, COUNT(*) as cnt
       FROM ticket t ${zJoin}
       WHERE t.data_utworzenia >= UNIX_TIMESTAMP(DATE_SUB(NOW(), INTERVAL 30 DAY))
       GROUP BY dzien ORDER BY dzien ASC`,
      zParam
    );

    // top pracownicy — filtr po członkostwie w zespole, nie po pochodzeniu ticketu
    // (to są "wyniki moich ludzi", niezależnie skąd przyszło zgłoszenie).
    const [topPracownicy] = await pool.query(
      `SELECT u.imie, u.nazwisko, COUNT(uht.id) as cnt
       FROM user_has_ticket uht
       JOIN user u ON u.id = uht.user_id
       ${wJoin}
       GROUP BY uht.user_id ORDER BY cnt DESC LIMIT 10`,
      wParam
    );

    const [kpiRows] = await pool.query(
      `SELECT t.id, t.status, t.data_utworzenia, t.data_zamkniecia, t.priority,
              t.sla_response_deadline, t.sla_resolution_deadline, t.first_response_at,
              (SELECT MIN(k.data) FROM korespondencja k WHERE k.ticket_id = t.id) as first_reply_at
       FROM ticket t ${zJoin}
       WHERE t.data_utworzenia >= ?`,
      [...zParam, periodStart]
    );

    const responseTimes = [];
    const resolutionTimes = [];
    let responseEligible = 0;
    let responseMet = 0;
    let resolutionEligible = 0;
    let resolutionMet = 0;
    let warningOpen = 0;
    let breachOpen = 0;

    for (const row of kpiRows) {
      const ticket = enrichTicketSla(row, nowTs);
      const firstReplyAt = Number(ticket.first_response_at || row.first_reply_at || 0) || null;

      if (firstReplyAt) {
        responseTimes.push(firstReplyAt - Number(ticket.data_utworzenia || 0));
      }

      if (ticket.status === 3 && ticket.data_zamkniecia) {
        resolutionTimes.push(Number(ticket.data_zamkniecia) - Number(ticket.data_utworzenia || 0));
      }

      if (ticket.sla_response_deadline) {
        if (firstReplyAt) {
          responseEligible += 1;
          if (firstReplyAt <= ticket.sla_response_deadline) {
            responseMet += 1;
          }
        } else if (nowTs > ticket.sla_response_deadline) {
          responseEligible += 1;
        }
      }

      if (ticket.sla_resolution_deadline) {
        if (ticket.status === 3 && ticket.data_zamkniecia) {
          resolutionEligible += 1;
          if (Number(ticket.data_zamkniecia) <= ticket.sla_resolution_deadline) {
            resolutionMet += 1;
          }
        } else if (nowTs > ticket.sla_resolution_deadline) {
          resolutionEligible += 1;
        }
      }

      if (ticket.status !== 3) {
        if (ticket.sla_status === 'warning') {
          warningOpen += 1;
        }
        if (ticket.sla_status === 'breach') {
          breachOpen += 1;
        }
      }
    }

    const [workload] = await pool.query(
      `SELECT u.id, u.imie, u.nazwisko,
              COUNT(DISTINCT uht.ticket_id) as wszystkie,
              SUM(CASE
                    WHEN t.status != 3
                     AND t.sla_resolution_deadline IS NOT NULL
                     AND t.sla_resolution_deadline < ?
                    THEN 1 ELSE 0 END) as przeterminowane
       FROM user_has_ticket uht
       JOIN user u ON u.id = uht.user_id
       JOIN ticket t ON t.id = uht.ticket_id
       ${wJoin}
       GROUP BY u.id, u.imie, u.nazwisko
       ORDER BY wszystkie DESC
       LIMIT 20`,
      [nowTs, ...wParam]
    );

    const avgSeconds = (arr) => (arr.length ? Math.round(arr.reduce((a, b) => a + b, 0) / arr.length) : null);
    const percent = (met, eligible) => (eligible ? Number(((met / eligible) * 100).toFixed(2)) : null);

    const kpi = {
      periodDays: days,
      mttaSeconds: avgSeconds(responseTimes),
      mttrSeconds: avgSeconds(resolutionTimes),
      responseCompliancePercent: percent(responseMet, responseEligible),
      resolutionCompliancePercent: percent(resolutionMet, resolutionEligible),
      responseEligible,
      resolutionEligible,
      warningOpen,
      breachOpen,
    };

    res.json({
      nowe: nowe.cnt,
      przypisane: przypisane.cnt,
      zamkniete: zamkniete.cnt,
      odlozone: odlozone.cnt,
      razem: razem.cnt,
      ostatnie30,
      topPracownicy,
      kpi,
      workload,
      csat: {
        avg: csatRow.avg_rating !== null ? parseFloat(csatRow.avg_rating) : null,
        count: csatRow.cnt,
      },
    });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

module.exports = router;
