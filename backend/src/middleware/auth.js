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
      'SELECT u.id, u.email, u.imie, u.nazwisko, u.status, u.language, aa.item_name as rola FROM user u LEFT JOIN auth_assignment aa ON aa.user_id = u.id WHERE u.id = ?',
      [decoded.id]
    );
    if (!rows.length || rows[0].status !== 10) {
      return res.status(401).json({ error: 'Nieaktywny użytkownik' });
    }
    req.user = rows[0];
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

module.exports = { authenticate, requireRole, requireAdmin, requireWorker };
