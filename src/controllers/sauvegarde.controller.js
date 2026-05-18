const SauvegardeModel = require('../models/sauvegarde.model');

function ok(res, data, status = 200) {
  return res.status(status).json({ success: true, data });
}

function fail(res, error, status = 400) {
  return res.status(status).json({ success: false, error });
}

// Récupère l'utilisateur depuis req.user (middleware auth à brancher plus tard).
// Pour l'instant, attend req.headers['x-user-id'] en développement.
function getUserId(req) {
  return req.user?.id_user ?? req.headers['x-user-id'] ?? null;
}

// ─── Sauvegarder un article ───────────────────────────────────────────────────

async function sauvegarder(req, res, next) {
  const idUser    = getUserId(req);
  const idArticle = req.params.id;

  if (!idUser)    return fail(res, 'Utilisateur non identifié.', 401);
  if (!idArticle) return fail(res, 'id_article requis.');

  try {
    const result = await SauvegardeModel.sauvegarderArticle(idUser, idArticle);
    if (!result) return fail(res, 'Article introuvable.', 404);
    return ok(res, result, 201);
  } catch (err) {
    next(err);
  }
}

// ─── Retirer de la liste ──────────────────────────────────────────────────────

async function retirer(req, res, next) {
  const idUser    = getUserId(req);
  const idArticle = req.params.id;

  if (!idUser) return fail(res, 'Utilisateur non identifié.', 401);

  try {
    const deleted = await SauvegardeModel.retirerSauvegarde(idUser, idArticle);
    if (!deleted) return fail(res, 'Sauvegarde introuvable.', 404);
    return ok(res, { message: 'Article retiré de la liste.' });
  } catch (err) {
    next(err);
  }
}

// ─── Lister les articles sauvegardés ─────────────────────────────────────────

async function listSauvegardes(req, res, next) {
  const idUser = getUserId(req);
  if (!idUser) return fail(res, 'Utilisateur non identifié.', 401);

  try {
    const articles = await SauvegardeModel.findSauvegardesByUser(idUser);
    return ok(res, articles);
  } catch (err) {
    next(err);
  }
}

// ─── Vérifier si sauvegardé ───────────────────────────────────────────────────

async function checkSauvegarde(req, res, next) {
  const idUser    = getUserId(req);
  const idArticle = req.params.id;

  if (!idUser) return fail(res, 'Utilisateur non identifié.', 401);

  try {
    const saved = await SauvegardeModel.isSauvegarde(idUser, idArticle);
    return ok(res, { saved });
  } catch (err) {
    next(err);
  }
}

module.exports = { sauvegarder, retirer, listSauvegardes, checkSauvegarde };