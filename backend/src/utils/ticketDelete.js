const fs = require('fs');
const path = require('path');
const pool = require('../config/db');

const uploadDir = process.env.UPLOAD_DIR || '/var/www/html/pomoc/pliki';

// Usuwa zależne wiersze (plik/korespondencja/notatka/user_has_ticket) przed DELETE z ticket —
// inaczej pojedynczy ticket z odpowiedzią/notatką/przydziałem blokuje (FK constraint) usunięcie
// całej partii na raz, bo DELETE FROM ticket WHERE id IN (...) jest jednym atomowym zapytaniem.
// Współdzielone przez routes/tickets.js (ręczne usuwanie spamu) i utils/reminderScheduler.js
// (automatyczne usuwanie spamu starszego niż 30 dni).
async function deleteTicketsCascade(ids) {
  if (!ids.length) return 0;
  const placeholders = ids.map(() => '?').join(',');

  const [files] = await pool.query(`SELECT filepath FROM plik WHERE ticket_id IN (${placeholders})`, ids);
  for (const f of files) {
    try { fs.unlinkSync(path.join(uploadDir, f.filepath)); } catch {}
  }

  await pool.query(`DELETE FROM plik WHERE ticket_id IN (${placeholders})`, ids);
  await pool.query(`DELETE FROM korespondencja WHERE ticket_id IN (${placeholders})`, ids);
  await pool.query(`DELETE FROM notatka WHERE ticket_id IN (${placeholders})`, ids).catch(() => {});
  await pool.query(`DELETE FROM user_has_ticket WHERE ticket_id IN (${placeholders})`, ids);
  await pool.query(`DELETE FROM zespol_has_ticket WHERE ticket_id IN (${placeholders})`, ids).catch(() => {});
  await pool.query(`UPDATE ticket SET merged_into_id = NULL WHERE merged_into_id IN (${placeholders})`, ids).catch(() => {});

  const [result] = await pool.query(
    `DELETE FROM ticket WHERE id IN (${placeholders}) AND ai_tag = 'spam'`, ids
  );
  return result.affectedRows;
}

module.exports = { deleteTicketsCascade };
