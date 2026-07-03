const express = require('express');
const router = express.Router();
const pool = require('../config/db');
const { authenticate, requireWorker } = require('../middleware/auth');

router.use(authenticate);

// Admin zarządza każdym szablonem. Pracownik tylko szablonami zespołu(ów),
// których jest członkiem — szablony globalne (zespol_id IS NULL) są dla
// pracownika tylko do odczytu/użycia, nie do edycji/usunięcia.
async function canManageTemplate(user, templateId) {
  if (user.rola === 'admin') return true;
  const [rows] = await pool.query(
    `SELECT 1 FROM szablon_odpowiedzi s
     JOIN zespol_user zu ON zu.zespol_id = s.zespol_id AND zu.user_id = ?
     WHERE s.id = ?`,
    [user.id, templateId]
  );
  return rows.length > 0;
}

// GET /api/szablony — dostępne dla admina i pracownika (wybór szablonu przy odpowiadaniu).
// Admin widzi wszystkie; pracownik widzi globalne + szablony zespołów, których jest członkiem.
router.get('/', async (req, res) => {
  try {
    let rows;
    if (req.user.rola === 'admin') {
      [rows] = await pool.query(
        `SELECT s.*, z.nazwa as zespol_nazwa
         FROM szablon_odpowiedzi s
         LEFT JOIN zespol z ON z.id = s.zespol_id
         WHERE s.aktywny = 1
         ORDER BY s.kolejnosc ASC, s.nazwa ASC`
      );
    } else {
      [rows] = await pool.query(
        `SELECT s.*, z.nazwa as zespol_nazwa
         FROM szablon_odpowiedzi s
         LEFT JOIN zespol z ON z.id = s.zespol_id
         WHERE s.aktywny = 1
           AND (s.zespol_id IS NULL OR s.zespol_id IN (SELECT zespol_id FROM zespol_user WHERE user_id = ?))
         ORDER BY s.kolejnosc ASC, s.nazwa ASC`,
        [req.user.id]
      );
    }
    res.json({ data: rows });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

// POST /api/szablony — admin lub pracownik (dla własnego zespołu)
router.post('/', requireWorker, async (req, res) => {
  const { nazwa, tresc, kolejnosc } = req.body;
  let { zespol_id } = req.body;
  if (!nazwa?.trim()) return res.status(400).json({ error: 'Nazwa szablonu jest wymagana' });
  if (!tresc?.trim()) return res.status(400).json({ error: 'Treść szablonu jest wymagana' });

  zespol_id = zespol_id ? parseInt(zespol_id) : null;

  try {
    if (req.user.rola !== 'admin') {
      if (!zespol_id) return res.status(400).json({ error: 'Wybierz zespół' });
      const [membership] = await pool.query(
        'SELECT 1 FROM zespol_user WHERE zespol_id = ? AND user_id = ?',
        [zespol_id, req.user.id]
      );
      if (!membership.length) return res.status(403).json({ error: 'Nie jesteś członkiem tego zespołu' });
    }

    const now = Math.floor(Date.now() / 1000);
    const [result] = await pool.query(
      'INSERT INTO szablon_odpowiedzi (nazwa, tresc, kolejnosc, zespol_id, aktywny, created_at, updated_at) VALUES (?, ?, ?, ?, 1, ?, ?)',
      [nazwa.trim(), tresc, kolejnosc || 0, zespol_id, now, now]
    );
    res.status(201).json({ id: result.insertId });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

// PUT /api/szablony/:id — admin dowolny; pracownik tylko własnego zespołu
router.put('/:id', requireWorker, async (req, res) => {
  const { nazwa, tresc, kolejnosc, aktywny } = req.body;
  let { zespol_id } = req.body;
  if (nazwa !== undefined && !nazwa?.trim()) {
    return res.status(400).json({ error: 'Nazwa nie może być pusta' });
  }
  if (tresc !== undefined && !tresc?.trim()) {
    return res.status(400).json({ error: 'Treść nie może być pusta' });
  }

  try {
    if (!(await canManageTemplate(req.user, req.params.id))) {
      return res.status(403).json({ error: 'Brak uprawnień do tego szablonu' });
    }

    if (zespol_id !== undefined) {
      zespol_id = zespol_id ? parseInt(zespol_id) : null;
      if (req.user.rola !== 'admin') {
        if (!zespol_id) return res.status(400).json({ error: 'Wybierz zespół' });
        const [membership] = await pool.query(
          'SELECT 1 FROM zespol_user WHERE zespol_id = ? AND user_id = ?',
          [zespol_id, req.user.id]
        );
        if (!membership.length) return res.status(403).json({ error: 'Nie jesteś członkiem tego zespołu' });
      }
    }

    const now = Math.floor(Date.now() / 1000);
    const updates = ['updated_at = ?'];
    const values = [now];

    if (nazwa !== undefined) { updates.push('nazwa = ?'); values.push(nazwa.trim()); }
    if (tresc !== undefined) { updates.push('tresc = ?'); values.push(tresc); }
    if (kolejnosc !== undefined) { updates.push('kolejnosc = ?'); values.push(parseInt(kolejnosc) || 0); }
    if (aktywny !== undefined) { updates.push('aktywny = ?'); values.push(aktywny ? 1 : 0); }
    if (zespol_id !== undefined) { updates.push('zespol_id = ?'); values.push(zespol_id); }

    values.push(req.params.id);
    await pool.query(
      `UPDATE szablon_odpowiedzi SET ${updates.join(', ')} WHERE id = ?`,
      values
    );
    res.json({ success: true });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

// DELETE /api/szablony/:id — admin dowolny; pracownik tylko własnego zespołu
router.delete('/:id', requireWorker, async (req, res) => {
  try {
    if (!(await canManageTemplate(req.user, req.params.id))) {
      return res.status(403).json({ error: 'Brak uprawnień do tego szablonu' });
    }
    const now = Math.floor(Date.now() / 1000);
    await pool.query(
      'UPDATE szablon_odpowiedzi SET aktywny = 0, updated_at = ? WHERE id = ?',
      [now, req.params.id]
    );
    res.json({ success: true });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

module.exports = router;
