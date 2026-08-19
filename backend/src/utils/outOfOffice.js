// Wspólny fragment SQL sprawdzający, czy użytkownik `u` ma aktualnie aktywny okres
// "poza biurem" (urlop/przerwa) — jeden placeholder `?` na bieżący unix timestamp.
// Używane zarówno przy wykluczaniu z sprawdzania obecności zespołu/adminów (mailer.js),
// jak i przy fladze poza_biurem_aktywne w listach użytkowników (routes/users.js).
const OUT_OF_OFFICE_ACTIVE_SQL =
  'u.poza_biurem_od IS NOT NULL AND u.poza_biurem_do IS NOT NULL AND ? BETWEEN u.poza_biurem_od AND u.poza_biurem_do';

// JS-owy odpowiednik powyższego, dla pojedynczego usera już wczytanego z bazy (auth.js, login) —
// tam dopisywanie kolejnego SQL-owego CASE do zapytania byłoby przerostem formy nad treścią.
function isOutOfOfficeActive(od, doTs, nowTs = Math.floor(Date.now() / 1000)) {
  return !!(od && doTs && nowTs >= od && nowTs <= doTs);
}

module.exports = { OUT_OF_OFFICE_ACTIVE_SQL, isOutOfOfficeActive };
