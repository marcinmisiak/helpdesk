const express = require('express');
const router = express.Router();
const pool = require('../config/db');
const { authenticate, requireWorker, getAuthorizedZespolIds } = require('../middleware/auth');

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
              t.csat_rating, t.csat_comment, t.csat_submitted_at,
              GROUP_CONCAT(DISTINCT z.nazwa SEPARATOR ', ') as zespoly
       FROM ticket t
       LEFT JOIN zespol_has_ticket zht ON zht.ticket_id = t.id
       LEFT JOIN zespol z ON z.id = zht.zespol_id
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

    res.json({ data: rows, total, page: parseInt(page), limit: parseInt(limit) });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

module.exports = router;
