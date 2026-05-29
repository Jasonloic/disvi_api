const rapportService = require('../services/rapport.service');

function ok(res, data, status = 200) {
  return res.status(status).json({ success: true, data });
}

function fail(res, error, status = 400) {
  return res.status(status).json({ success: false, error });
}

function getUserId(req) {
  return req.user?.id_user ?? req.headers['x-user-id'] ?? null;
}

function parseIdCat(val) {
  const n = Number(val);
  return Number.isFinite(n) && n > 0 ? n : null;
}

function parseZone(val) {
  // Ne filtrer par zone que si explicitement fournie et non vide
  if (!val || val === 'all' || val === '') return null;
  return val;
}

async function genererRapport(req, res, next) {
  const idUser = getUserId(req);
  if (!idUser) return fail(res, 'Utilisateur non identifié.', 401);

  const { periode, id_cat, zone, limit } = req.body;

  const PERIODES_VALIDES = ['quotidienne', 'hebdo', 'mensuelle'];
  if (!periode || !PERIODES_VALIDES.includes(periode))
    return fail(res, 'periode est requis : quotidienne, hebdo ou mensuelle.');

  const idCatNum = parseIdCat(id_cat);
  const zoneVal  = parseZone(zone);

  try {
    let nomCategorie = null;
    if (idCatNum) {
      const { pool } = require('../config/database');
      const { rows } = await pool.query(
          'SELECT nom_cat FROM categorie WHERE id_cat = $1', [idCatNum]
      );
      if (rows.length === 0) return fail(res, 'Catégorie introuvable.', 404);
      nomCategorie = rows[0].nom_cat;
    }

    const { articles, dateDebut, dateFin } = await rapportService.selectionnerArticles({
      periode,
      id_cat: idCatNum,
      zone:   zoneVal,
      limit:  Number(limit) || 50,
      idUser,
    });

    if (articles.length === 0)
      return fail(res, 'Aucun article trouvé pour ces critères.', 404);

    const periodeLabel = { quotidienne: '24h', hebdo: '7j', mensuelle: '30j' }[periode];
    const titre = `Note de synthèse — ${nomCategorie || 'Toutes catégories'} — ${periodeLabel}`;

    const rapport = await rapportService.sauvegarderRapport({
      idCreateur: idUser, titre, periode,
      zone: zoneVal, idCat: idCatNum,
      dateDebut, dateFin, nbArticles: articles.length,
    });

    const { buffer, filename } = await rapportService.genererPDF({
      articles, dateDebut, dateFin,
      periode, categorie: nomCategorie, zone: zoneVal,
      idNote: rapport.id_note,
    });

    await rapportService.updateUrlDocument(rapport.id_note, filename);
    await rapportService.lierArticlesRapport(rapport.id_note, articles);

    res.setHeader('Content-Type',        'application/pdf');
    res.setHeader('Content-Disposition', `attachment; filename="${filename}"`);
    res.setHeader('X-Rapport-Id',        rapport.id_note);
    res.setHeader('X-Nb-Articles',       String(articles.length));
    res.send(buffer);

  } catch (err) { next(err); }
}

async function previewRapport(req, res, next) {
  const idUser = getUserId(req);
  if (!idUser) return fail(res, 'Utilisateur non identifié.', 401);

  const { periode, id_cat, zone, limit } = req.query;

  const PERIODES_VALIDES = ['quotidienne', 'hebdo', 'mensuelle'];
  if (!periode || !PERIODES_VALIDES.includes(periode))
    return fail(res, 'periode est requis : quotidienne, hebdo ou mensuelle.');

  const idCatNum = parseIdCat(id_cat);
  const zoneVal  = parseZone(zone);

  try {
    const { articles, dateDebut, dateFin } = await rapportService.selectionnerArticles({
      periode,
      id_cat: idCatNum,
      zone:   zoneVal,
      limit:  Number(limit) || 50,
      idUser,
    });

    return ok(res, {
      nb_articles: articles.length,
      date_debut:  dateDebut,
      date_fin:    dateFin,
      articles:    articles.map(a => ({
        id_article:       a.id_article,
        titre:            a.titre,
        nom_source:       a.nom_source,
        date_publication: a.date_publication,
        zone:             a.zone,
        categories:       a.categories,
        score_confiance:  a.score_confiance,
      })),
    });
  } catch (err) { next(err); }
}

async function listerRapports(req, res, next) {
  const idUser = getUserId(req);
  if (!idUser) return fail(res, 'Utilisateur non identifié.', 401);

  const limit  = Math.min(Number(req.query.limit)  || 20, 100);
  const offset = Math.max(Number(req.query.offset) || 0,  0);

  try {
    const rapports = await rapportService.listerRapports(idUser, { limit, offset });
    return ok(res, rapports);
  } catch (err) { next(err); }
}

async function getRapport(req, res, next) {
  const idUser = getUserId(req);
  if (!idUser) return fail(res, 'Utilisateur non identifié.', 401);

  try {
    const rapport = await rapportService.getRapportById(req.params.id, idUser);
    if (!rapport) return fail(res, 'Rapport introuvable.', 404);
    return ok(res, rapport);
  } catch (err) { next(err); }
}

async function downloadRapport(req, res, next) {
  const idUser = getUserId(req);
  if (!idUser) return fail(res, 'Utilisateur non identifié.', 401);

  try {
    const filepath = await rapportService.getFilePath(req.params.id, idUser);

    if (!filepath)
      return fail(res, 'Rapport introuvable.', 404);

    if (!require('fs').existsSync(filepath))
      return fail(res, 'Fichier PDF introuvable sur le serveur.', 404);

    const filename = require('path').basename(filepath);
    res.setHeader('Content-Type',        'application/pdf');
    res.setHeader('Content-Disposition', `attachment; filename="${filename}"`);
    require('fs').createReadStream(filepath).pipe(res);

  } catch (err) { next(err); }
}

module.exports = {
  genererRapport,
  previewRapport,
  listerRapports,
  getRapport,
  downloadRapport,
};