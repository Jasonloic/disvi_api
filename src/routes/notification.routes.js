const { Router } = require('express');
const ctrl = require('../controllers/notification.controller');

const router = Router();

// Connexion SSE — le client ouvre et garde cette connexion ouverte
// GET /api/notifications/stream
// Header requis : x-user-id
router.get('/stream', ctrl.connectSSE);

// Lister les notifications
// GET /api/notifications?limit=20&offset=0&non_lues=true
router.get('/', ctrl.listNotifications);

// Marquer toutes comme lues
// PATCH /api/notifications/lues
router.patch('/lues', ctrl.marquerToutesLues);

// Marquer une notification comme lue
// PATCH /api/notifications/:id/lue
router.patch('/:id/lue', ctrl.marquerLue);

// Stats SSE (nombre de clients connectés)
// GET /api/notifications/stats
router.get('/stats', ctrl.sseStats);

module.exports = router;