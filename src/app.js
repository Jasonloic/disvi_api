const express      = require('express');
const cors         = require('cors');
const cookieParser = require('cookie-parser');
const { corsOptions }                        = require('./config/cors');
const routes                                 = require('./routes/index');
const { errorMiddleware, notFoundMiddleware } = require('./middlewares/error.middleware');
const {
  globalLimiter,
  normalLimiter,
  writeLimiter,
  strictLimiter,
} = require('./middlewares/rate.limit.middleware');

const app = express();

// 1. CORS en premier — Appliqué de manière globale pour TOUTES les méthodes (y compris OPTIONS)
app.use(cors(corsOptions));

// 2. Réponse immédiate aux requêtes Preflight OPTIONS (évite de descendre dans les routeurs)
app.options('*', (req, res) => {
  // On s'assure que les headers CORS configurés sont renvoyés et on stoppe la requête ici
  res.sendStatus(204);
});

// Parsing
app.use(express.json({ limit: '1mb' }));
app.use(express.urlencoded({ extended: true }));
app.use(cookieParser());
app.set('trust proxy', 1);

// 3. Sécurité globale : On court-circuite TOUTES les requêtes OPTIONS pour les limiter
app.use((req, res, next) => {
  if (req.method === 'OPTIONS') return next();
  globalLimiter(req, res, next);
});

// Health
app.get('/health', (req, res) => {
  res.status(200).json({
    status:    'ok',
    instance:  process.env.INSTANCE_ID || 'single',
    timestamp: new Date().toISOString(),
  });
});

// --- Configuration des Rate Limiters par route (OPTIONS déjà géré globalement en amont) ---

// Inscription / Connexion : On applique un Strict Limiter pour éviter le bruteforce
app.use('/api/auth', strictLimiter);

// Lecture standard (GET)
app.use('/api/sources',    normalLimiter);
app.use('/api/articles',   normalLimiter);
app.use('/api/categories', normalLimiter);

// Écriture (POST, PUT, PATCH, DELETE)
const isWriteMethod = (req) => ['POST', 'PATCH', 'DELETE', 'PUT'].includes(req.method);

app.use('/api/sources',    (req, res, next) => isWriteMethod(req) ? writeLimiter(req, res, next) : next());
app.use('/api/articles',   (req, res, next) => isWriteMethod(req) ? writeLimiter(req, res, next) : next());
app.use('/api/categories', (req, res, next) => isWriteMethod(req) ? writeLimiter(req, res, next) : next());

// Routes spécifiques de détection et réseaux (Strict)
app.use('/api/sources/detect-rss', strictLimiter);
app.use('/api/sources/rss',        strictLimiter);
app.use('/api/sources/social',     strictLimiter);

// 4. Chargement des routes principales
app.use('/api', routes);

app.use(notFoundMiddleware);
app.use(errorMiddleware);

module.exports = app;