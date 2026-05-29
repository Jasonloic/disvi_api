const jwt = require('jsonwebtoken');

const JWT_SECRET  = process.env.JWT_SECRET;
const JWT_REFRESH = process.env.JWT_REFRESH_SECRET;

function authMiddleware(req, res, next) {
  const header = req.headers['authorization'];
  
  if (!header || !header.startsWith('Bearer ')) {
    return res.status(401).json({ success: false, error: 'Token manquant.' });
  }

  const token = header.split(' ')[1];

  // Diagnostic de sécurité : s'assurer que le serveur possède bien la clé secrète pour décoder
  if (!JWT_SECRET) {
    console.error("[AUTH ERROR] La variable d'environnement JWT_SECRET n'est pas définie sur le serveur.");
    return res.status(500).json({ success: false, error: 'Erreur de configuration interne du serveur.' });
  }

  try {
    // Tentative de vérification du jeton
    const payload = jwt.verify(token, JWT_SECRET);
    
    // Le token est valide, on injecte le payload dans l'objet req
    req.user = payload;
    next();
  } catch (err) {
    // Log précis du motif du rejet de la session
    console.error(`[AUTH ERROR] Échec de la vérification du token (${req.method} ${req.originalUrl}) :`, err.message);

    if (err.name === 'TokenExpiredError') {
      return res.status(401).json({ 
        success: false, 
        error: 'Token expiré.', 
        code: 'TOKEN_EXPIRED' 
      });
    }
    
    return res.status(401).json({ success: false, error: 'Token invalide.' });
  }
}

function requireRole(...roles) {
  return (req, res, next) => {
    if (!req.user) {
      return res.status(401).json({ success: false, error: 'Non authentifié.' });
    }
    
    // Vérification de la correspondance du rôle utilisateur avec les rôles autorisés
    if (!roles.includes(req.user.role)) {
      console.warn(`[AUTH WARN] Accès refusé - Rôle de l'utilisateur : '${req.user.role}', Rôles requis : [${roles.join(', ')}]`);
      return res.status(403).json({ 
        success: false, 
        error: `Accès refusé. Rôle requis : ${roles.join(' ou ')}.` 
      });
    }
    next();
  };
}

module.exports = { authMiddleware, requireRole };
