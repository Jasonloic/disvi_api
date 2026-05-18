const { searchInternal } = require('../services/search.internal.service');
const { searchWeb }      = require('../services/search.web.service');

function ok(res, data, status = 200) {
  return res.status(status).json({ success: true, data });
}

function fail(res, error, status = 400) {
  return res.status(status).json({ success: false, error });
}

// Recherche interne (articles en base)

async function searchInternalHandler(req, res, next) {
  const q          = req.query.q;
  const limit      = Math.min(Number(req.query.limit)  || 20, 100);
  const offset     = Math.max(Number(req.query.offset) || 0,  0);
  const zone       = req.query.zone       || null;
  const id_source  = req.query.id_source  || null;

  if (!q || !q.trim())
    return fail(res, 'Le paramètre q (requête) est requis.');

  try {
    const result = await searchInternal({ q, limit, offset, zone, id_source });
    res.setHeader('X-Total-Count', String(result.total));
    return ok(res, result);
  } catch (err) {
    next(err);
  }
}

// Recherche web externe

async function searchWebHandler(req, res, next) {
  const q    = req.query.q;
  const lang = req.query.lang || 'fr';

  if (!q || !q.trim())
    return fail(res, 'Le paramètre q (requête) est requis.');

  try {
    const result = await searchWeb(q.trim(), lang);
    return ok(res, { query: q.trim(), lang, ...result });
  } catch (err) {
    next(err);
  }
}

// Recherche combinée (interne + web)

async function searchAllHandler(req, res, next) {
  const q    = req.query.q;
  const lang = req.query.lang || 'fr';

  if (!q || !q.trim())
    return fail(res, 'Le paramètre q (requête) est requis.');

  try {
    const [internal, web] = await Promise.allSettled([
      searchInternal({ q: q.trim(), limit: 10, offset: 0 }),
      searchWeb(q.trim(), lang),
    ]);

    return ok(res, {
      query:    q.trim(),
      interne:  internal.status === 'fulfilled' ? internal.value : { error: 'Indisponible' },
      externe:  web.status      === 'fulfilled' ? web.value      : { error: 'Indisponible' },
    });
  } catch (err) {
    next(err);
  }
}

module.exports = { searchInternalHandler, searchWebHandler, searchAllHandler };