const express     = require('express');
const cors        = require('cors');
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

app.use(cors(corsOptions));
app.options('*', cors(corsOptions));
app.use(express.json({ limit: '1mb' }));
app.use(express.urlencoded({ extended: true }));

app.use(globalLimiter);

// Health
app.get('/health', (req, res) => {
  res.status(200).json({
    status:    'ok',
    instance:  process.env.INSTANCE_ID || 'single',
    timestamp: new Date().toISOString(),
  });
});

app.use('/api/sources',    normalLimiter);
app.use('/api/articles',   normalLimiter);
app.use('/api/categories', normalLimiter);

app.use('/api/sources', (req, res, next) => {
  if (['POST', 'PATCH', 'DELETE'].includes(req.method)) return writeLimiter(req, res, next);
  next();
});
app.use('/api/articles', (req, res, next) => {
  if (['POST', 'PATCH', 'DELETE', 'PUT'].includes(req.method)) return writeLimiter(req, res, next);
  next();
});
app.use('/api/categories', (req, res, next) => {
  if (['POST', 'PATCH', 'DELETE'].includes(req.method)) return writeLimiter(req, res, next);
  next();
});

app.use('/api/sources/detect-rss', strictLimiter);
app.use('/api/sources/rss',        strictLimiter);
app.use('/api/sources/social',     strictLimiter);

app.use('/api', routes);

app.use(notFoundMiddleware);
app.use(errorMiddleware);

module.exports = app;