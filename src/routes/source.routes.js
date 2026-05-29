const { Router } = require('express');
const ctrl = require('../controllers/source.controller');
const { authMiddleware, requireRole } = require('../middlewares/auth.middleware');

const router = Router();

// Toutes les routes de ce fichier exigent un utilisateur authentifié
router.use(authMiddleware);

// Détection automatique — tout utilisateur connecté
router.post('/detect-rss', ctrl.detectRSS);

// Ajout flux RSS — Veilleur ou Administrateur (spec §3.2)
router.post('/rss',    requireRole('Veilleur', 'Administrateur'), ctrl.addRSSSource);
router.post('/social', requireRole('Veilleur', 'Administrateur'), ctrl.addSocialSource);

// Lecture — tous rôles
router.get('/',              ctrl.listSources);
router.get('/:id',           ctrl.getSource);
router.get('/:id/auteurs',   ctrl.getAuteursBySource);

// Modification / suppression — Veilleur ou Administrateur
router.patch('/:id',   requireRole('Veilleur', 'Administrateur'), ctrl.patchSource);
router.delete('/:id',  requireRole('Veilleur', 'Administrateur'), ctrl.removeSource);

module.exports = router;