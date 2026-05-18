const { Router }        = require('express');
const ctrl              = require('../controllers/auth.controller');
const { authMiddleware } = require('../middlewares/auth.middleware');

const router = Router();

// POST /api/auth/signup   { email, mot_de_passe, role? }
router.post('/signup', ctrl.signup);

// POST /api/auth/login    { email, mot_de_passe }
router.post('/login', ctrl.login);

// POST /api/auth/refresh  (cookie ou body: { refresh_token })
router.post('/refresh', ctrl.refresh);

// POST /api/auth/logout   (cookie ou body: { refresh_token })
router.post('/logout', ctrl.logout);

// POST /api/auth/logout-all  — révoque toutes les sessions
router.post('/logout-all', authMiddleware, ctrl.logoutAll);

// GET  /api/auth/me
router.get('/me', authMiddleware, ctrl.getProfile);

// PATCH /api/auth/password  { ancien_mot_de_passe, nouveau_mot_de_passe }
router.patch('/password', authMiddleware, ctrl.changePassword);

module.exports = router;