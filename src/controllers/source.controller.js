const SourceModel  = require('../models/source.model');
const AuteurModel  = require('../models/auteur.model');
const { detectRSSFeeds } = require('../services/rss.detector.service');

const { scheduleSource, unscheduleSource } = require('../services/scheduler.service');


function isValidUrl(value) {
  try {
    const url = new URL(value);
    return url.protocol === 'http:' || url.protocol === 'https:';
  } catch {
    return false;
  }
}

function parseId(param) {
  const id = parseInt(param, 10);
  return Number.isFinite(id) && id > 0 ? id : null;
}

function ok(res, data, status = 200) {
  return res.status(status).json({ success: true, data });
}

function fail(res, error, status = 400) {
  return res.status(status).json({ success: false, error });
}


async function detectRSS(req, res, next) {
  const { site_name, url_hint } = req.body;

  if (!site_name || !String(site_name).trim())
    return fail(res, 'site_name est requis.');

  if (url_hint && !isValidUrl(url_hint))
    return fail(res, 'url_hint doit être une URL valide.');

  try {
    const result = await detectRSSFeeds(String(site_name).trim(), url_hint?.trim());

    if (result.candidates.length === 0)
      return fail(
        res,
        `Aucun flux RSS trouvé pour "${site_name}". Essayez avec url_hint.`,
        404
      );

    return ok(res, result);
  } catch (err) {
    next(err);
  }
}



async function listSources(req, res, next) {
  try {
    const sources = await SourceModel.findAllSources();
    return ok(res, sources);
  } catch (err) {
    next(err);
  }
}



async function getSource(req, res, next) {
  const id = parseId(req.params.id);
  if (!id) return fail(res, 'Identifiant invalide.');

  try {
    const source = await SourceModel.findSourceById(id);
    if (!source) return fail(res, 'Source introuvable.', 404);
    return ok(res, source);
  } catch (err) {
    next(err);
  }
}


async function addRSSSource(req, res, next) {
  const { nom_source, url_source, frequence_check } = req.body;

  if (!nom_source || !String(nom_source).trim())
    return fail(res, 'nom_source est requis.');

  if (!url_source || !isValidUrl(url_source))
    return fail(res, 'url_source doit être une URL valide (http/https).');

  if (frequence_check !== undefined && (frequence_check < 1 || !Number.isFinite(Number(frequence_check))))
    return fail(res, 'frequence_check doit être un entier >= 1.');

  try {
    const existing = await SourceModel.findSourceByUrl(url_source);
    if (existing)
      return fail(
        res,
        `Un flux avec cette URL existe déjà (id: ${existing.id_source}).`,
        409
      );

    const source = await SourceModel.createRSSSource({
      nom_source:      String(nom_source).trim(),
      url_source,
      frequence_check: frequence_check ? Number(frequence_check) : undefined,
    });

    return ok(res, source, 201);
  } catch (err) {
    next(err);
  }
}

// Ajout réseau social

async function addSocialSource(req, res, next) {
  const { nom_source, handle_social, config_auth } = req.body;

  if (!nom_source || !String(nom_source).trim())
    return fail(res, 'nom_source est requis.');

  if (!handle_social || !String(handle_social).trim())
    return fail(res, 'handle_social est requis (ex: @moncompte).');

  try {
    const source = await SourceModel.createSocialSource({
      nom_source:  String(nom_source).trim(),
      config_auth: config_auth || null,
    });

    const auteur = await AuteurModel.createAuteur(
      source.id_source,
      String(handle_social).trim()
    );

    return ok(res, { source, auteur }, 201);
  } catch (err) {
    next(err);
  }
}



async function patchSource(req, res, next) {
  const id = parseId(req.params.id);
  if (!id) return fail(res, 'Identifiant invalide.');

  const { nom_source, url_source, frequence_check, config_auth } = req.body;

  if (url_source && !isValidUrl(url_source))
    return fail(res, 'url_source doit être une URL valide.');

  try {
    const updated = await SourceModel.updateSource(id, {
      nom_source, url_source, frequence_check, config_auth,
    });
    if (!updated) return fail(res, 'Source introuvable.', 404);

    // Replanifier le cron si c'est une source RSS
    if (updated.type_source === 'RSS' && updated.url_source) {
      scheduleSource(updated);
    }

    return ok(res, updated);
  } catch (err) {
    next(err);
  }
}

async function removeSource(req, res, next) {
  const id = parseId(req.params.id);
  if (!id) return fail(res, 'Identifiant invalide.');

  try {
    const deleted = await SourceModel.deleteSource(id);
    if (!deleted) return fail(res, 'Source introuvable.', 404);

    // Arrêter le job cron associé
    unscheduleSource(id);

    return ok(res, { message: 'Source supprimée.' });
  } catch (err) {
    next(err);
  }
}



async function getAuteursBySource(req, res, next) {
  const id = parseId(req.params.id);
  if (!id) return fail(res, 'Identifiant invalide.');

  try {
    const auteurs = await AuteurModel.findAuteursBySource(id);
    return ok(res, auteurs);
  } catch (err) {
    next(err);
  }
}

module.exports = {
  detectRSS,
  listSources,
  getSource,
  addRSSSource,
  addSocialSource,
  patchSource,
  removeSource,
  getAuteursBySource,
};