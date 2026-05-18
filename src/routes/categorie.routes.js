const { Router } = require('express');
const ctrl = require('../controllers/categorie.controller');

const router = Router();

// CRUD catégories
// GET    /api/categories
router.get('/',    ctrl.listCategories);

// POST   /api/categories   { nom_cat }
router.post('/',   ctrl.createCategorie);

// GET    /api/categories/:id
router.get('/:id', ctrl.getCategorie);

// PATCH  /api/categories/:id   { nom_cat }
router.patch('/:id', ctrl.updateCategorie);

// DELETE /api/categories/:id
router.delete('/:id', ctrl.deleteCategorie);

// Articles d'une catégorie
// GET /api/categories/:id/articles?limit=20&offset=0
router.get('/:id/articles', ctrl.getArticlesByCategorie);

// Catégories d'un article
// GET    /api/categories/article/:idArticle
router.get('/article/:idArticle', ctrl.getCategoriesByArticle);

// POST   /api/categories/article/:idArticle/:idCat
router.post('/article/:idArticle/:idCat', ctrl.assignCategorie);

// DELETE /api/categories/article/:idArticle/:idCat
router.delete('/article/:idArticle/:idCat', ctrl.removeCategorie);

module.exports = router;