const { rateLimit } = require('express-rate-limit');
const { RedisStore } = require('rate-limit-redis');
const redis = require('../config/redis');

function makeStore(prefix) {
  return new RedisStore({
    sendCommand: (...args) => redis.call(...args),
    prefix,
  });
}


function rateLimitHandler(req, res) {
  const retryAfter = res.getHeader('Retry-After');
  const minutes    = Math.ceil(Number(retryAfter) / 60);
  const seconds    = Number(retryAfter);

  let message;
  if (seconds < 60) {
    message = `Vous avez effectué trop de requêtes. Veuillez patienter ${seconds} seconde${seconds > 1 ? 's' : ''} avant de réessayer.`;
  } else {
    message = `Vous avez effectué trop de requêtes. Veuillez patienter ${minutes} minute${minutes > 1 ? 's' : ''} avant de réessayer.`;
  }

  res.status(429).json({
    success:    false,
    code:       'RATE_LIMIT_EXCEEDED',
    message,
    retryAfter: seconds,
    limit: {
      resetDans:  `${seconds} secondes`,
      conseil:    req.method === 'POST'
        ? 'Réduisez la fréquence de vos soumissions.'
        : 'Réduisez la fréquence de vos consultations.',
    },
  });
}


// detect-rss, ajout de sources
// 10 requêtes par minute par IP

const strictLimiter = rateLimit({
  windowMs:         60 * 1000,
  max:              10,
  standardHeaders:  'draft-7',
  legacyHeaders:    false,
  store:            makeStore('rl:strict:'),
  handler:          rateLimitHandler,
  skip: (req) => process.env.NODE_ENV === 'development' && req.ip === '::1',
});

// Articles, catégories, sources : lecture simple
// 300 requêtes par minute par IP

const normalLimiter = rateLimit({
  windowMs:         60 * 1000,
  max:              300,
  standardHeaders:  'draft-7',
  legacyHeaders:    false,
  store:            makeStore('rl:normal:'),
  handler:          rateLimitHandler,
});

// 60 requêtes par minute par IP

const writeLimiter = rateLimit({
  windowMs:         60 * 1000,
  max:              60,
  standardHeaders:  'draft-7',
  legacyHeaders:    false,
  store:            makeStore('rl:write:'),
  handler:          rateLimitHandler,
});

// Plafond absolu toutes routes confondues
// 1000 requêtes par minute par IP

const globalLimiter = rateLimit({
  windowMs:         60 * 1000,
  max:              1000,
  standardHeaders:  'draft-7',
  legacyHeaders:    false,
  store:            makeStore('rl:global:'),
  handler:          rateLimitHandler,
});

module.exports = { strictLimiter, normalLimiter, writeLimiter, globalLimiter };