const redis = require('../config/redis');

const PREFIX = 'disvi:';

const TTL = {
  ARTICLES_LIST:     2   * 60,
  ARTICLE_DETAIL:    10  * 60,
  ARTICLES_SOURCE:   2   * 60,
  ARTICLES_CATEGORIE:5   * 60,
  SEARCH_INTERNE:    3   * 60,
  SOURCES_USER:      5   * 60,
  SOURCE_DETAIL:     5   * 60,
  CATEGORIES:        60  * 60,
  CATEGORIE_DETAIL:  60  * 60,
};

const keys = {
  // idUser inclus pour isoler le cache par utilisateur
  articlesList:      (limit, offset, idUser)          => `${PREFIX}articles:list:${idUser}:${limit}:${offset}`,
  articleDetail:     (id)                             => `${PREFIX}articles:detail:${id}`,
  articlesSource:    (sourceId, limit, offset, idUser) => `${PREFIX}articles:source:${idUser}:${sourceId}:${limit}:${offset}`,
  articlesCategorie: (catId, limit, offset)           => `${PREFIX}articles:cat:${catId}:${limit}:${offset}`,
  searchInterne:     (q, zone, sourceId, limit, offset) =>
    `${PREFIX}search:${q}:${zone||'all'}:${sourceId||'all'}:${limit}:${offset}`,
  sourcesUser:       (userId)                         => `${PREFIX}sources:user:${userId}`,
  sourceDetail:      (id, userId)                     => `${PREFIX}sources:detail:${id}:${userId}`,
  categories:        ()                               => `${PREFIX}categories:all`,
  categorieDetail:   (id)                             => `${PREFIX}categories:detail:${id}`,
};

async function get(key) {
  try {
    const val = await redis.get(key);
    return val ? JSON.parse(val) : null;
  } catch (err) {
    console.error(`[CACHE] Erreur GET "${key}" :`, err.message);
    return null;
  }
}

async function set(key, value, ttl) {
  try {
    await redis.set(key, JSON.stringify(value), 'EX', ttl);
  } catch (err) {
    console.error(`[CACHE] Erreur SET "${key}" :`, err.message);
  }
}

async function del(...cacheKeys) {
  try {
    if (cacheKeys.length > 0) await redis.del(...cacheKeys);
  } catch (err) {
    console.error(`[CACHE] Erreur DEL :`, err.message);
  }
}

async function delPattern(pattern) {
  try {
    const fullPattern = pattern.startsWith(PREFIX) ? pattern : `${PREFIX}${pattern}`;
    const found = await redis.keys(fullPattern);
    if (found.length > 0) {
      await redis.del(...found);
      console.log(`[CACHE] Invalidé ${found.length} clé(s) — pattern: ${fullPattern}`);
    }
  } catch (err) {
    console.error(`[CACHE] Erreur delPattern "${pattern}" :`, err.message);
  }
}

async function getOrSet(key, ttl, fetchFn) {
  const cached = await get(key);
  if (cached !== null) {
    return { data: cached, fromCache: true };
  }
  const data = await fetchFn();
  await set(key, data, ttl);
  return { data, fromCache: false };
}

const invalidate = {
  // Invalide les listes de tous les utilisateurs après un crawl
  articles: async (sourceId) => {
    await Promise.all([
      delPattern('articles:list:*'),
      delPattern(`articles:source:*:${sourceId}:*`),
      delPattern('articles:cat:*'),
      delPattern('search:*'),
    ]);
  },

  source: async (sourceId, userId) => {
    await Promise.all([
      del(keys.sourceDetail(sourceId, userId)),
      del(keys.sourcesUser(userId)),
      delPattern(`articles:source:${userId}:${sourceId}:*`),
    ]);
  },

  categories: async (catId) => {
    await Promise.all([
      del(keys.categories()),
      catId ? del(keys.categorieDetail(catId)) : Promise.resolve(),
      delPattern('articles:cat:*'),
    ]);
  },

  article: async (articleId) => {
    await Promise.all([
      del(keys.articleDetail(articleId)),
      delPattern('articles:list:*'),
    ]);
  },
};

module.exports = { get, set, del, delPattern, getOrSet, invalidate, keys, TTL };
