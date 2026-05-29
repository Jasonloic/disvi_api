const { Router }         = require('express');
const ctrl               = require('../controllers/rapport.controller');
const { authMiddleware } = require('../middlewares/auth.middleware');

const router = Router();

router.use(authMiddleware);

router.get('/preview',      ctrl.previewRapport);
router.post('/generer',     ctrl.genererRapport);
router.get('/',             ctrl.listerRapports);
router.get('/:id',          ctrl.getRapport);
router.get('/:id/download', ctrl.downloadRapport);

module.exports = router;