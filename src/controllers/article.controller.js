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

function getUserId(req) {
  return req.user?.id_user ?? req.headers['x-user-id'] ?? null;
}

async function listArticles(req, res, next) {
  const idUser = getUserId(req);
  if (!idUser) return fail(res, 'Utilisateur non identifié.', 401);

  const { limit, offset } = parsePagination(req.query);
  try {
    const { articles, total } = await ArticleModel.findAllArticles({ limit, offset, idUser });
    res.setHeader('X-Total-Count', String(total));
    return ok(res, { articles, total, limit, offset });
  } catch (err) {
    next(err);
  }
}

async function listArticlesBySource(req, res, next) {
  const idUser   = getUserId(req);
  const idSource = parseInt(req.params.idSource, 10);

  if (!idUser) return fail(res, 'Utilisateur non identifié.', 401);
  if (!Number.isFinite(idSource) || idSource < 1)
    return fail(res, 'idSource invalide.');

  const { limit, offset } = parsePagination(req.query);
  try {
    const { articles, total } = await ArticleModel.findArticlesBySource(idSource, { limit, offset, idUser });
    res.setHeader('X-Total-Count', String(total));
    return ok(res, { articles, total, limit, offset });
  } catch (err) {
    next(err);
  }
}

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