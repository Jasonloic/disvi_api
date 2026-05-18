const { Router } = require('express');
const authRoutes         = require('./auth.routes');
const sourceRoutes       = require('./source.routes');
const articleRoutes      = require('./article.routes');
const categorieRoutes    = require('./categorie.routes');
const searchRoutes       = require('./search.routes');
const notificationRoutes = require('./notification.routes');
const rapportRoutes = require('./rapport.routes');

const router = Router();

router.use('/auth',          authRoutes);
router.use('/sources',       sourceRoutes);
router.use('/articles',      articleRoutes);
router.use('/categories',    categorieRoutes);
router.use('/search',        searchRoutes);
router.use('/notifications', notificationRoutes);
router.use('/rapports', rapportRoutes);

module.exports = router;