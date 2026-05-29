const { Router } = require('express');
const ctrl = require('../controllers/categorie.controller');
const { authMiddleware } = require('../middlewares/auth.middleware');
const { findSourcesGroupedByCategorie } = require('../models/categorie.model');

const router = Router();

router.use(authMiddleware);

// Routes spécifiques AVANT les routes paramétriques
router.get('/with-sources', async (req, res, next) => {
    try {
        const idUser = req.user?.id_user ?? null;
        if (!idUser) return res.status(401).json({ success: false, error: 'Utilisateur non identifié.' });
        const data = await findSourcesGroupedByCategorie(idUser);
        return res.json({ success: true, data });
    } catch (err) { next(err); }
});

router.get('/article/:idArticle',              ctrl.getCategoriesByArticle);
router.post('/article/:idArticle/:idCat',      ctrl.assignCategorie);
router.delete('/article/:idArticle/:idCat',    ctrl.removeCategorie);

// CRUD
router.get('/',       ctrl.listCategories);
router.post('/',      ctrl.createCategorie);
router.get('/:id',    ctrl.getCategorie);
router.patch('/:id',  ctrl.updateCategorie);
router.delete('/:id', ctrl.deleteCategorie);

router.get('/:id/articles', ctrl.getArticlesByCategorie);

module.exports = router;