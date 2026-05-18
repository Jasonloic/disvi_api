const redis = require('../config/redis');

const PREFIX = 'disvi:';

// TTL par domaine (secondes)
const TTL = {
  ARTICLES_LIST:     2   * 60,  // 2 min
  ARTICLE_DETAIL:    10  * 60,  // 10 min
  ARTICLES_SOURCE:   2   * 60,  // 2 min
  ARTICLES_CATEGORIE:5   * 60,  // 5 min
  SEARCH_INTERNE:    3   * 60,  // 3 min
  SOURCES_USER:      5   * 60,  // 5 min
  SOURCE_DETAIL:     5   * 60,  // 5 min
  CATEGORIES:        60  * 60,  // 1 heure
  CATEGORIE_DETAIL:  60  * 60,  // 1 heure
};

// Clés normalisées

const keys = {
  articlesList:      (limit, offset)         => `${PREFIX}articles:list:${limit}:${offset}`,
  articleDetail:     (id)                    => `${PREFIX}articles:detail:${id}`,
  articlesSource:    (sourceId, limit, offset)=> `${PREFIX}articles:source:${sourceId}:${limit}:${offset}`,
  articlesCategorie: (catId, limit, offset)  => `${PREFIX}articles:cat:${catId}:${limit}:${offset}`,
  searchInterne:     (q, zone, sourceId, limit, offset) =>
    `${PREFIX}search:${q}:${zone||'all'}:${sourceId||'all'}:${limit}:${offset}`,
  sourcesUser:       (userId)                => `${PREFIX}sources:user:${userId}`,
  sourceDetail:      (id, userId)            => `${PREFIX}sources:detail:${id}:${userId}`,
  categories:        ()                      => `${PREFIX}categories:all`,
  categorieDetail:   (id)                    => `${PREFIX}categories:detail:${id}`,
};

// Opérations de base

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

// Supprime toutes les clés correspondant à un pattern
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

// Cache-aside helper 
// Évite le boilerplate : get → si absent → fetch → set

async function getOrSet(key, ttl, fetchFn) {
  const cached = await get(key);
  if (cached !== null) {
    return { data: cached, fromCache: true };
  }
  const data = await fetchFn();
  await set(key, data, ttl);
  return { data, fromCache: false };
}

// Invalidations groupées 

const invalidate = {
  // Appelé après crawl d'une source → invalider listes d'articles
  articles: async (sourceId) => {
    await Promise.all([
      delPattern('articles:list:*'),
      delPattern(`articles:source:${sourceId}:*`),
      delPattern('articles:cat:*'),
      delPattern('search:*'),
    ]);
  },

  // Appelé après modif/suppression d'une source
  source: async (sourceId, userId) => {
    await Promise.all([
      del(keys.sourceDetail(sourceId, userId)),
      del(keys.sourcesUser(userId)),
      delPattern(`articles:source:${sourceId}:*`),
    ]);
  },

  // Appelé après modif d'une catégorie
  categories: async (catId) => {
    await Promise.all([
      del(keys.categories()),
      catId ? del(keys.categorieDetail(catId)) : Promise.resolve(),
      delPattern('articles:cat:*'),
    ]);
  },

  // Appelé après modif d'un article (description, note, sauvegarde)
  article: async (articleId) => {
    await Promise.all([
      del(keys.articleDetail(articleId)),
      delPattern('articles:list:*'),
    ]);
  },
};

module.exports = { get, set, del, delPattern, getOrSet, invalidate, keys, TTL };