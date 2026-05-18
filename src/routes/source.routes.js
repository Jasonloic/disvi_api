const { Router } = require('express');
const ctrl = require('../controllers/source.controller');

const router = Router();

// Détection automatique d'URL RSS depuis un nom de site
// POST /api/sources/detect-rss   { site_name, url_hint? }
router.post('/detect-rss', ctrl.detectRSS);

// Ajout d'un flux RSS confirmé
// POST /api/sources/rss   { nom_source, url_source, frequence_check? }
router.post('/rss', ctrl.addRSSSource);

// Ajout d'un réseau social (métadonnées seulement)
// POST /api/sources/social   { nom_source, handle_social, config_auth? }
router.post('/social', ctrl.addSocialSource);

// Liste toutes les sources
// GET /api/sources
router.get('/', ctrl.listSources);

// Détail d'une source
// GET /api/sources/:id
router.get('/:id', ctrl.getSource);

// Comptes suivis d'une source sociale
// GET /api/sources/:id/auteurs
router.get('/:id/auteurs', ctrl.getAuteursBySource);

// Mise à jour partielle
// PATCH /api/sources/:id
router.patch('/:id', ctrl.patchSource);

// Suppression
// DELETE /api/sources/:id
router.delete('/:id', ctrl.removeSource);

module.exports = router;