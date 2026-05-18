const jwt = require('jsonwebtoken');

const JWT_SECRET  = process.env.JWT_SECRET;
const JWT_REFRESH = process.env.JWT_REFRESH_SECRET;

function authMiddleware(req, res, next) {
  const header = req.headers['authorization'];
  if (!header || !header.startsWith('Bearer '))
    return res.status(401).json({ success: false, error: 'Token manquant.' });

  const token = header.split(' ')[1];
  try {
    const payload = jwt.verify(token, JWT_SECRET);
    req.user      = payload;
    next();
  } catch (err) {
    if (err.name === 'TokenExpiredError')
      return res.status(401).json({ success: false, error: 'Token expiré.', code: 'TOKEN_EXPIRED' });
    return res.status(401).json({ success: false, error: 'Token invalide.' });
  }
}

function requireRole(...roles) {
  return (req, res, next) => {
    if (!req.user)
      return res.status(401).json({ success: false, error: 'Non authentifié.' });
    if (!roles.includes(req.user.role))
      return res.status(403).json({ success: false, error: `Accès refusé. Rôle requis : ${roles.join(' ou ')}.` });
    next();
  };
}

module.exports = { authMiddleware, requireRole };