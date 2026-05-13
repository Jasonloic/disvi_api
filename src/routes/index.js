const { Router } = require('express');
const sourceRoutes    = require('./source.routes');
const articleRoutes   = require('./article.routes');
const categorieRoutes = require('./categorie.routes');

const router = Router();

router.use('/sources',    sourceRoutes);
router.use('/articles',   articleRoutes);
router.use('/categories', categorieRoutes);

module.exports = router;