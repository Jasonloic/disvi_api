const { Router } = require('express');
const ctrl = require('../controllers/rapport.controller');

const router = Router();

// Prévisualiser les articles avant génération
// GET /api/rapports/preview?periode=hebdo&id_cat=1&zone=nationale
router.get('/preview', ctrl.previewRapport);

// Générer et télécharger le PDF
// POST /api/rapports/generer   { periode, id_cat?, zone?, limit? }
router.post('/generer', ctrl.genererRapport);

// Lister les rapports générés
// GET /api/rapports?limit=20&offset=0
router.get('/', ctrl.listerRapports);

// Détail d'un rapport
// GET /api/rapports/:id
router.get('/:id', ctrl.getRapport);

router.get('/:id/download', ctrl.downloadRapport);

module.exports = router;