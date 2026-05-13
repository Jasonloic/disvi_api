const Redis = require('ioredis');

const redis = new Redis({
  host:              process.env.REDIS_HOST     || '127.0.0.1',
  port:              Number(process.env.REDIS_PORT) || 6379,
  password:          process.env.REDIS_PASSWORD || undefined,
  db:                Number(process.env.REDIS_DB) || 0,
  retryStrategy(times) {
    const delay = Math.min(times * 50, 2000);
    return delay;
  },
  maxRetriesPerRequest: 3,
});

redis.on('connect',  () => console.log('[REDIS] Connexion établie.'));
redis.on('error',    (err) => console.error('[REDIS] Erreur :', err.message));
redis.on('reconnecting', () => console.warn('[REDIS] Reconnexion en cours...'));

module.exports = redis;