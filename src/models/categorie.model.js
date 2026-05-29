const { pool }  = require('../config/database');
const cache     = require('../services/cache.service');

async function findAll() {
  const key = cache.keys.categories();
  const { data } = await cache.getOrSet(key, cache.TTL.CATEGORIES, async () => {
    const { rows } = await pool.query(
        'SELECT id_cat, nom_cat FROM categorie ORDER BY nom_cat ASC'
    );
    return rows;
  });
  return data;
}

async function findById(id) {
  const key = cache.keys.categorieDetail(id);
  const { data } = await cache.getOrSet(key, cache.TTL.CATEGORIE_DETAIL, async () => {
    const { rows } = await pool.query(
        'SELECT id_cat, nom_cat FROM categorie WHERE id_cat = $1',
        [id]
    );
    return rows[0] ?? null;
  });
  return data;
}

async function create(nom_cat) {
  const { rows } = await pool.query(
      `INSERT INTO categorie (nom_cat) VALUES ($1)
     ON CONFLICT (nom_cat) DO UPDATE SET nom_cat = EXCLUDED.nom_cat
     RETURNING id_cat, nom_cat`,
      [nom_cat]
  );
  await cache.invalidate.categories(null);
  return rows[0];
}

async function update(id, nom_cat) {
  const { rows } = await pool.query(
      `UPDATE categorie SET nom_cat = $1 WHERE id_cat = $2
     RETURNING id_cat, nom_cat`,
      [nom_cat, id]
  );
  await cache.invalidate.categories(id);
  return rows[0] ?? null;
}

async function remove(id) {
  const { rowCount } = await pool.query(
      'DELETE FROM categorie WHERE id_cat = $1',
      [id]
  );
  await cache.invalidate.categories(id);
  return (rowCount ?? 0) > 0;
}

async function findArticlesByCategorie(idCat, { limit = 20, offset = 0 } = {}) {
  const key = cache.keys.articlesCategorie(idCat, limit, offset);
  const { data } = await cache.getOrSet(key, cache.TTL.ARTICLES_CATEGORIE, async () => {
    const { rows } = await pool.query(
        `SELECT a.id_article, a.titre, a.description, a.url_origine,
              a.vignette, a.date_publication, a.zone,
              src.nom_source
       FROM article a
       JOIN source src ON src.id_source = a.id_source
       JOIN art_cat ac ON ac.id_article = a.id_article
       WHERE ac.id_cat = $1 AND a.date_expiration > NOW()
       ORDER BY a.date_publication DESC NULLS LAST
       LIMIT $2 OFFSET $3`,
        [idCat, limit, offset]
    );
    return rows;
  });
  return data;
}

async function findCategoriesByArticle(idArticle) {
  const { rows } = await pool.query(
      `SELECT c.id_cat, c.nom_cat FROM categorie c
     JOIN art_cat ac ON ac.id_cat = c.id_cat
     WHERE ac.id_article = $1`,
      [idArticle]
  );
  return rows;
}

async function assignCategorie(idArticle, idCat) {
  await pool.query(
      `INSERT INTO art_cat (id_article, id_cat) VALUES ($1, $2) ON CONFLICT DO NOTHING`,
      [idArticle, idCat]
  );
  await cache.invalidate.categories(idCat);
}

async function removeCategorie(idArticle, idCat) {
  const { rowCount } = await pool.query(
      'DELETE FROM art_cat WHERE id_article = $1 AND id_cat = $2',
      [idArticle, idCat]
  );
  await cache.invalidate.categories(idCat);
  return (rowCount ?? 0) > 0;
}

async function findSourcesGroupedByCategorie(idUser) {
  if (!idUser) throw new Error('idUser requis');

  const { rows } = await pool.query(`
    SELECT
      c.id_cat,
      c.nom_cat,
      s_user.id_source,
      s_user.nom_source,
      s_user.url_source,
      COUNT(DISTINCT a.id_article)::int AS article_count
    FROM categorie c
           JOIN art_cat ac       ON ac.id_cat      = c.id_cat
           JOIN article a        ON a.id_article   = ac.id_article
      AND a.date_expiration > NOW()
           JOIN source s_art     ON s_art.id_source = a.id_source
           JOIN source s_user    ON s_user.url_source = s_art.url_source
      AND s_user.id_user    = $1
    GROUP BY c.id_cat, c.nom_cat, s_user.id_source, s_user.nom_source, s_user.url_source
    ORDER BY c.nom_cat ASC, s_user.nom_source ASC
  `, [idUser]);

  const seen = new Set();
  const map  = new Map();

  for (const row of rows) {
    const pairKey = `${row.id_cat}:${row.id_source}`;
    if (seen.has(pairKey)) continue;
    seen.add(pairKey);

    if (!map.has(row.id_cat)) {
      map.set(row.id_cat, { id_cat: row.id_cat, nom_cat: row.nom_cat, sources: [] });
    }

    map.get(row.id_cat).sources.push({
      id_source:     row.id_source,
      nom_source:    row.nom_source,
      url_source:    row.url_source,
      article_count: row.article_count,
    });
  }

  return Array.from(map.values());
}

module.exports = {
  findAll,
  findById,
  create,
  update,
  remove,
  findArticlesByCategorie,
  findCategoriesByArticle,
  assignCategorie,
  removeCategorie,
  findSourcesGroupedByCategorie,
};