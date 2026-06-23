const jwt = require('jsonwebtoken');
const pool = require('../config/db');

async function authenticate(req, res, next) {
  const authHeader = req.headers.authorization;
  if (!authHeader || !authHeader.startsWith('Bearer ')) {
    return res.status(401).json({ error: 'Brak tokenu autoryzacji' });
  }

  const token = authHeader.split(' ')[1];
  try {
    const decoded = jwt.verify(token, process.env.JWT_SECRET);
    const [rows] = await pool.query(
      `SELECT u.id, u.email, u.imie, u.nazwisko, u.status, u.language, aa.item_name as rola,
              (SELECT GROUP_CONCAT(zespol_id) FROM zespol_user WHERE user_id = u.id AND is_kierownik = 1) as kierownik_zespol_ids_raw
       FROM user u LEFT JOIN auth_assignment aa ON aa.user_id = u.id WHERE u.id = ?`,
      [decoded.id]
    );
    if (!rows.length || rows[0].status !== 10) {
      return res.status(401).json({ error: 'Nieaktywny użytkownik' });
    }
    const user = rows[0];
    user.kierownik_zespol_ids = user.kierownik_zespol_ids_raw
      ? user.kierownik_zespol_ids_raw.split(',').map(Number)
      : [];
    delete user.kierownik_zespol_ids_raw;
    req.user = user;
    next();
  } catch {
    return res.status(401).json({ error: 'Nieprawidłowy token' });
  }
}

function requireRole(...roles) {
  return (req, res, next) => {
    if (!roles.includes(req.user?.rola)) {
      return res.status(403).json({ error: 'Brak uprawnień' });
    }
    next();
  };
}

function requireAdmin(req, res, next) {
  if (req.user?.rola !== 'admin') {
    return res.status(403).json({ error: 'Wymagana rola admin' });
  }
  next();
}

function requireWorker(req, res, next) {
  if (!['admin', 'pracownik'].includes(req.user?.rola)) {
    return res.status(403).json({ error: 'Wymagana rola pracownik lub admin' });
  }
  next();
}

// Zwraca 'all' dla admina (bez ograniczeń), albo tablicę zespol_id, których dany
// użytkownik jest kierownikiem — czyta z req.user.kierownik_zespol_ids, już
// wyliczonego raz w authenticate() (jedna wspólna zapytanie SQL, nie druga
// zapytanie per route). Współdzielone przez routes/statystyki.js i routes/opinie.js.
function getAuthorizedZespolIds(user) {
  if (user.rola === 'admin') return 'all';
  return user.kierownik_zespol_ids || [];
}

module.exports = { authenticate, requireRole, requireAdmin, requireWorker, getAuthorizedZespolIds };
