const jwt = require('jsonwebtoken');

function sseAuthMiddleware(req, res, next) {
    const header = req.headers['authorization'];
    const token  = header?.startsWith('Bearer ')
        ? header.split(' ')[1]
        : req.query.token;

    if (!token) {
        res.status(401).json({ success: false, error: 'Token manquant.' });
        return;
    }

    try {
        req.user = jwt.verify(token, process.env.JWT_SECRET);
        next();
    } catch {
        res.status(401).json({ success: false, error: 'Token invalide ou expiré.' });
    }
}

module.exports = { sseAuthMiddleware };