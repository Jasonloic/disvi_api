const CategorieModel = require('../models/categorie.model');

function ok(res, data, status = 200) {
  return res.status(status).json({ success: true, data });
}

function fail(res, error, status = 400) {
  return res.status(status).json({ success: false, error });
}

function parseId(param) {
  const id = parseInt(param, 10);
  return Number.isFinite(id) && id > 0 ? id : null;
}

// CRUD Catégories

async function listCategories(req, res, next) {
  try {
    const categories = await CategorieModel.findAllCategories();
    return ok(res, categories);
  } catch (err) { next(err); }
}

async function getCategorie(req, res, next) {
  const id = parseId(req.params.id);
  if (!id) return fail(res, 'Identifiant invalide.');
  try {
    const cat = await CategorieModel.findCategorieById(id);
    if (!cat) return fail(res, 'Catégorie introuvable.', 404);
    return ok(res, cat);
  } catch (err) { next(err); }
}

async function createCategorie(req, res, next) {
  const { nom_cat } = req.body;
  if (!nom_cat || !String(nom_cat).trim())
    return fail(res, 'nom_cat est requis.');
  if (String(nom_cat).trim().length > 100)
    return fail(res, 'nom_cat ne peut pas dépasser 100 caractères.');
  try {
    const cat = await CategorieModel.createCategorie(String(nom_cat).trim());
    return ok(res, cat, 201);
  } catch (err) { next(err); }
}

async function updateCategorie(req, res, next) {
  const id = parseId(req.params.id);
  if (!id) return fail(res, 'Identifiant invalide.');
  const { nom_cat } = req.body;
  if (!nom_cat || !String(nom_cat).trim())
    return fail(res, 'nom_cat est requis.');
  try {
    const cat = await CategorieModel.updateCategorie(id, String(nom_cat).trim());
    if (!cat) return fail(res, 'Catégorie introuvable.', 404);
    return ok(res, cat);
  } catch (err) { next(err); }
}

async function deleteCategorie(req, res, next) {
  const id = parseId(req.params.id);
  if (!id) return fail(res, 'Identifiant invalide.');
  try {
    const deleted = await CategorieModel.deleteCategorie(id);
    if (!deleted) return fail(res, 'Catégorie introuvable.', 404);
    return ok(res, { message: 'Catégorie supprimée.' });
  } catch (err) { next(err); }
}

// Catégories d'un article
async function getCategoriesByArticle(req, res, next) {
  const { idArticle } = req.params;
  try {
    const cats = await CategorieModel.findCategoriesByArticle(idArticle);
    return ok(res, cats);
  } catch (err) { next(err); }
}

async function assignCategorie(req, res, next) {
  const { idArticle } = req.params;
  const id = parseId(req.params.idCat);
  if (!id) return fail(res, 'idCat invalide.');
  try {
    await CategorieModel.assignCategorieToArticle(idArticle, id);
    return ok(res, { message: 'Catégorie assignée.' });
  } catch (err) { next(err); }
}

async function removeCategorie(req, res, next) {
  const { idArticle } = req.params;
  const id = parseId(req.params.idCat);
  if (!id) return fail(res, 'idCat invalide.');
  try {
    const removed = await CategorieModel.removeCategorieFromArticle(idArticle, id);
    if (!removed) return fail(res, 'Association introuvable.', 404);
    return ok(res, { message: 'Catégorie retirée.' });
  } catch (err) { next(err); }
}

// Articles par catégorie 

async function getArticlesByCategorie(req, res, next) {
  const id = parseId(req.params.id);
  if (!id) return fail(res, 'Identifiant invalide.');
  const limit  = Math.min(Number(req.query.limit)  || 20, 100);
  const offset = Math.max(Number(req.query.offset) || 0,  0);
  try {
    const [articles, total] = await Promise.all([
      CategorieModel.findArticlesByCategorie(id, { limit, offset }),
      CategorieModel.countArticlesByCategorie(id),
    ]);
    res.setHeader('X-Total-Count', String(total));
    return ok(res, { articles, total, limit, offset });
  } catch (err) { next(err); }
}

module.exports = {
  listCategories,
  getCategorie,
  createCategorie,
  updateCategorie,
  deleteCategorie,
  getCategoriesByArticle,
  assignCategorie,
  removeCategorie,
  getArticlesByCategorie,
};