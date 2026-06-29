const express = require('express');
const router = express.Router();
const pool = require('../config/db');
const { authenticate, requireAdmin } = require('../middleware/auth');
const { testConnection, assertSafeIdentifier } = require('../utils/zewnetrznaBaza');

router.use(authenticate);

const SILNIKI = ['mysql', 'firebird'];

function validateIdentifiers(tabela, kolumna_email, mapowanie_pol) {
  assertSafeIdentifier(tabela, 'tabeli');
  assertSafeIdentifier(kolumna_email, 'kolumny email');
  if (Array.isArray(mapowanie_pol)) {
    for (const m of mapowanie_pol) assertSafeIdentifier(m.column, 'kolumny mapowania');
  }
}

// GET /api/zewnetrzne-bazy — lista (każdy zalogowany — potrzebne do panelu w widoku ticketu)
router.get('/', async (req, res) => {
  try {
    const [rows] = await pool.query('SELECT * FROM zewnetrzna_baza ORDER BY nazwa ASC');
    rows.forEach((r) => { delete r.haslo; });
    res.json({ data: rows });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

// POST /api/zewnetrzne-bazy
router.post('/', requireAdmin, async (req, res) => {
  const { nazwa, silnik, host, port, baza, login, haslo, tabela, kolumna_email, mapowanie_pol, aktywna } = req.body;
  if (!nazwa?.trim()) return res.status(400).json({ error: 'Nazwa jest wymagana' });
  if (!SILNIKI.includes(silnik)) return res.status(400).json({ error: 'Nieprawidłowy silnik' });
  if (!tabela?.trim()) return res.status(400).json({ error: 'Nazwa tabeli jest wymagana' });
  if (!kolumna_email?.trim()) return res.status(400).json({ error: 'Kolumna email jest wymagana' });

  try {
    validateIdentifiers(tabela.trim(), kolumna_email.trim(), mapowanie_pol);
  } catch (err) {
    return res.status(400).json({ error: err.message });
  }

  try {
    const now = Math.floor(Date.now() / 1000);
    const [result] = await pool.query(
      `INSERT INTO zewnetrzna_baza
        (nazwa, silnik, host, port, baza, login, haslo, tabela, kolumna_email, mapowanie_pol, aktywna, created_at, updated_at)
       VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`,
      [
        nazwa.trim(), silnik, host?.trim() || null, port || null, baza?.trim() || null,
        login?.trim() || null, haslo || null, tabela.trim(), kolumna_email.trim(),
        mapowanie_pol ? JSON.stringify(mapowanie_pol) : null,
        aktywna !== undefined ? (aktywna ? 1 : 0) : 1, now, now,
      ]
    );
    res.status(201).json({ id: result.insertId });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

// PUT /api/zewnetrzne-bazy/:id
router.put('/:id', requireAdmin, async (req, res) => {
  const { nazwa, silnik, host, port, baza, login, haslo, tabela, kolumna_email, mapowanie_pol, aktywna } = req.body;
  if (nazwa !== undefined && !nazwa?.trim()) return res.status(400).json({ error: 'Nazwa nie może być pusta' });
  if (silnik !== undefined && !SILNIKI.includes(silnik)) return res.status(400).json({ error: 'Nieprawidłowy silnik' });

  try {
    if (tabela !== undefined) assertSafeIdentifier(tabela.trim(), 'tabeli');
    if (kolumna_email !== undefined) assertSafeIdentifier(kolumna_email.trim(), 'kolumny email');
    if (mapowanie_pol !== undefined && Array.isArray(mapowanie_pol)) {
      for (const m of mapowanie_pol) assertSafeIdentifier(m.column, 'kolumny mapowania');
    }
  } catch (err) {
    return res.status(400).json({ error: err.message });
  }

  try {
    const now = Math.floor(Date.now() / 1000);
    const updates = ['updated_at = ?'];
    const values = [now];

    if (nazwa !== undefined) { updates.push('nazwa = ?'); values.push(nazwa.trim()); }
    if (silnik !== undefined) { updates.push('silnik = ?'); values.push(silnik); }
    if (host !== undefined) { updates.push('host = ?'); values.push(host?.trim() || null); }
    if (port !== undefined) { updates.push('port = ?'); values.push(port || null); }
    if (baza !== undefined) { updates.push('baza = ?'); values.push(baza?.trim() || null); }
    if (login !== undefined) { updates.push('login = ?'); values.push(login?.trim() || null); }
    // haslo: aktualizowane tylko gdy faktycznie przyszło w body — front nie wysyła go,
    // jeśli admin nie wpisał nowej wartości (GET nigdy nie zwraca prawdziwego hasła).
    if (haslo) { updates.push('haslo = ?'); values.push(haslo); }
    if (tabela !== undefined) { updates.push('tabela = ?'); values.push(tabela.trim()); }
    if (kolumna_email !== undefined) { updates.push('kolumna_email = ?'); values.push(kolumna_email.trim()); }
    if (mapowanie_pol !== undefined) { updates.push('mapowanie_pol = ?'); values.push(JSON.stringify(mapowanie_pol)); }
    if (aktywna !== undefined) { updates.push('aktywna = ?'); values.push(aktywna ? 1 : 0); }

    values.push(req.params.id);
    await pool.query(`UPDATE zewnetrzna_baza SET ${updates.join(', ')} WHERE id = ?`, values);
    res.json({ success: true });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

// DELETE /api/zewnetrzne-bazy/:id
router.delete('/:id', requireAdmin, async (req, res) => {
  try {
    await pool.query('DELETE FROM zewnetrzna_baza WHERE id = ?', [req.params.id]);
    res.json({ success: true });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

// POST /api/zewnetrzne-bazy/:id/test — testuje połączenie; :id="new" dla niezapisanego formularza,
// dla edycji body może zostawić haslo puste — wtedy używane jest zapisane hasło.
router.post('/:id/test', requireAdmin, async (req, res) => {
  try {
    let source;
    if (req.params.id === 'new') {
      source = req.body;
    } else {
      const [[row]] = await pool.query('SELECT * FROM zewnetrzna_baza WHERE id = ?', [req.params.id]);
      if (!row) return res.status(404).json({ error: 'Źródło nie znalezione' });
      source = { ...row, ...req.body, haslo: req.body.haslo || row.haslo };
    }
    if (!SILNIKI.includes(source.silnik)) return res.status(400).json({ error: 'Nieprawidłowy silnik' });
    assertSafeIdentifier(source.tabela, 'tabeli');

    await testConnection(source);
    res.json({ success: true, message: 'Połączenie nawiązane poprawnie' });
  } catch (err) {
    res.status(400).json({ error: err.message });
  }
});

module.exports = router;
