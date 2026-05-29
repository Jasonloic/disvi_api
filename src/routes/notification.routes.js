const { Router }            = require('express');
const ctrl                  = require('../controllers/notification.controller');
const { authMiddleware }    = require('../middlewares/auth.middleware');
const { sseAuthMiddleware } = require('../middlewares/sse.auth.middleware');

const router = Router();

// SSE — EventSource ne supporte pas les headers custom
// Le token est passé en query param : /stream?token=...
router.get('/stream', sseAuthMiddleware, ctrl.connectSSE);

// Routes REST standard
router.get('/',          authMiddleware, ctrl.listNotifications);
router.patch('/lues',    authMiddleware, ctrl.marquerToutesLues);
router.get('/stats',     authMiddleware, ctrl.sseStats);
router.patch('/:id/lue', authMiddleware, ctrl.marquerLue);

module.exports = router;