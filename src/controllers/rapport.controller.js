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

// ─── Générer un rapport PDF ───────────────────────────────────────────────────

async function genererRapport(req, res, next) {
  const idUser = getUserId(req);
  if (!idUser) return fail(res, 'Utilisateur non identifié.', 401);

  const { periode, id_cat, zone, limit } = req.body;

  const PERIODES_VALIDES = ['quotidienne', 'hebdo', 'mensuelle'];
  if (!periode || !PERIODES_VALIDES.includes(periode))
    return fail(res, 'periode est requis : quotidienne, hebdo ou mensuelle.');

  try {
    // 1. Catégorie
    let nomCategorie = null;
    if (id_cat) {
      const { pool } = require('../config/database');
      const { rows } = await pool.query(
        'SELECT nom_cat FROM categorie WHERE id_cat = $1', [id_cat]
      );
      if (rows.length === 0) return fail(res, 'Catégorie introuvable.', 404);
      nomCategorie = rows[0].nom_cat;
    }

    // 2. Sélectionner les articles
    const { articles, dateDebut, dateFin } = await rapportService.selectionnerArticles({
      periode, id_cat: id_cat || null, zone: zone || null, limit: limit || 50,
    });

    if (articles.length === 0)
      return fail(res, 'Aucun article trouvé pour ces critères.', 404);

    // 3. Sauvegarder en base d'abord pour obtenir l'id_note
    const periodeLabel = { quotidienne: '24h', hebdo: '7j', mensuelle: '30j' }[periode];
    const titre = `Note de synthèse — ${nomCategorie || 'Toutes catégories'} — ${periodeLabel}`;

    const rapport = await rapportService.sauvegarderRapport({
      idCreateur: idUser, titre, periode,
      zone: zone || null, idCat: id_cat || null,
      dateDebut, dateFin, nbArticles: articles.length,
    });

    // 4. Générer le PDF avec l'id_note
    const { buffer, filename } = await rapportService.genererPDF({
      articles, dateDebut, dateFin,
      periode, categorie: nomCategorie, zone,
      idNote: rapport.id_note,
    });

    // 5. Stocker le nom du fichier en base
    await rapportService.updateUrlDocument(rapport.id_note, filename);

    // 6. Lier les articles au rapport
    await rapportService.lierArticlesRapport(rapport.id_note, articles);

    // 7. Retourner le PDF
    res.setHeader('Content-Type',        'application/pdf');
    res.setHeader('Content-Disposition', `attachment; filename="${filename}"`);
    res.setHeader('X-Rapport-Id',        rapport.id_note);
    res.setHeader('X-Nb-Articles',       String(articles.length));
    res.send(buffer);

  } catch (err) { next(err); }
}

// ─── Prévisualiser avant génération ──────────────────────────────────────────

async function previewRapport(req, res, next) {
  const idUser = getUserId(req);
  if (!idUser) return fail(res, 'Utilisateur non identifié.', 401);

  const { periode, id_cat, zone, limit } = req.query;

  const PERIODES_VALIDES = ['quotidienne', 'hebdo', 'mensuelle'];
  if (!periode || !PERIODES_VALIDES.includes(periode))
    return fail(res, 'periode est requis : quotidienne, hebdo ou mensuelle.');

  try {
    const { articles, dateDebut, dateFin } = await rapportService.selectionnerArticles({
      periode, id_cat: id_cat || null, zone: zone || null, limit: Number(limit) || 50,
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

// ─── Lister les rapports ──────────────────────────────────────────────────────

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

// ─── Détail d'un rapport ──────────────────────────────────────────────────────

async function getRapport(req, res, next) {
  const idUser = getUserId(req);
  if (!idUser) return fail(res, 'Utilisateur non identifié.', 401);

  try {
    const rapport = await rapportService.getRapportById(req.params.id, idUser);
    if (!rapport) return fail(res, 'Rapport introuvable.', 404);
    return ok(res, rapport);
  } catch (err) { next(err); }
}

// ─── Télécharger un rapport PDF existant ─────────────────────────────────────

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