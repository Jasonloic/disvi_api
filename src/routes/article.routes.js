const { Router } = require('express');
const ArticleCtrl    = require('../controllers/article.controller');
const SauvegardeCtrl = require('../controllers/sauvegarde.controller');
const AnnotationCtrl = require('../controllers/annotation.controller');
const { authMiddleware } = require('../middlewares/auth.middleware');

const router = Router();

router.use(authMiddleware);

router.get('/',                   ArticleCtrl.listArticles);
router.get('/source/:idSource',   ArticleCtrl.listArticlesBySource);
router.get('/sauvegardes',        SauvegardeCtrl.listSauvegardes);
router.get('/notes',              AnnotationCtrl.listNotes);

router.get('/:id',                ArticleCtrl.getArticle);

router.post('/:id/sauvegarder',   SauvegardeCtrl.sauvegarder);
router.get('/:id/sauvegarde',     SauvegardeCtrl.checkSauvegarde);
router.delete('/:id/sauvegarder', SauvegardeCtrl.retirer);

router.get('/:id/note',           AnnotationCtrl.getNote);
router.put('/:id/note',           AnnotationCtrl.upsertNote);
router.delete('/:id/note',        AnnotationCtrl.deleteNote);

router.patch('/:id/description',  ArticleCtrl.patchDescription);

module.exports = router;