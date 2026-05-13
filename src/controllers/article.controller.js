const ArticleModel = require('../models/article.model');

function ok(res, data, status = 200) {
  return res.status(status).json({ success: true, data });
}

function fail(res, error, status = 400) {
  return res.status(status).json({ success: false, error });
}

function parsePagination(query) {
  const limit  = Math.min(Number(query.limit)  || 20, 100);
  const offset = Math.max(Number(query.offset) || 0,  0);
  return { limit, offset };
}

//  Tous les articles 

async function listArticles(req, res, next) {
  const { limit, offset } = parsePagination(req.query);
  try {
    const [articles, total] = await Promise.all([
      ArticleModel.findAllArticles({ limit, offset }),
      ArticleModel.countAllArticles(),
    ]);
    res.setHeader('X-Total-Count', String(total));
    return ok(res, { articles, total, limit, offset });
  } catch (err) {
    next(err);
  }
}

//  Articles par source 
async function listArticlesBySource(req, res, next) {
  const idSource = parseInt(req.params.idSource, 10);
  if (!Number.isFinite(idSource) || idSource < 1)
    return fail(res, 'idSource invalide.');

  const { limit, offset } = parsePagination(req.query);
  try {
    const [articles, total] = await Promise.all([
      ArticleModel.findArticlesBySource(idSource, { limit, offset }),
      ArticleModel.countArticlesBySource(idSource),
    ]);
    res.setHeader('X-Total-Count', String(total));
    return ok(res, { articles, total, limit, offset });
  } catch (err) {
    next(err);
  }
}

//  Détail d'un article 

async function getArticle(req, res, next) {
  const { id } = req.params;
  try {
    const article = await ArticleModel.findArticleById(id);
    if (!article) return fail(res, 'Article introuvable.', 404);
    return ok(res, article);
  } catch (err) {
    next(err);
  }
}
// Mise a jour de la description

async function patchDescription(req, res, next) {
  const { id }          = req.params;
  const { description } = req.body;

  if (!description || !String(description).trim())
    return fail(res, 'description est requise.');

  if (String(description).trim().length > 500)
    return fail(res, 'description ne peut pas dépasser 500 caractères.');

  try {
    const article = await ArticleModel.updateDescription(
      id,
      String(description).trim()
    );
    if (!article) return fail(res, 'Article introuvable.', 404);
    return ok(res, article);
  } catch (err) {
    next(err);
  }
}

module.exports = {
  listArticles,
  listArticlesBySource,
  getArticle,
  patchDescription,
};