const { Router } = require('express');
const ctrl = require('../controllers/search.controller');

const router = Router();

// Recherche combinée interne + web
// GET /api/search?q=cameroun&lang=fr
router.get('/', ctrl.searchAllHandler);

// Recherche interne uniquement (articles en base)
// GET /api/search/interne?q=cameroun&zone=nationale&id_source=1&limit=20&offset=0
router.get('/interne', ctrl.searchInternalHandler);

// Recherche web externe uniquement (DuckDuckGo + SearXNG)
// GET /api/search/web?q=cameroun&lang=fr
router.get('/web', ctrl.searchWebHandler);

module.exports = router;