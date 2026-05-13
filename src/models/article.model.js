const { pool } = require('../config/database');

const SELECT_FIELDS = `
  a.id_article, a.id_source, a.id_auteur,
  a.titre, a.description, a.contenu_brut,
  a.url_origine, a.vignette,
  a.date_publication, a.date_expiration,
  a.est_indexe, a.zone, a.pays,
  a.created_at,
  src.nom_source, src.type_source
`;

// Lecture

async function findAllArticles({ limit = 20, offset = 0 } = {}) {
  const { rows } = await pool.query(
    `SELECT ${SELECT_FIELDS}
     FROM article a
     JOIN source src ON src.id_source = a.id_source
     WHERE a.date_expiration > NOW()
     ORDER BY a.date_publication DESC NULLS LAST
     LIMIT $1 OFFSET $2`,
    [limit, offset]
  );
  return rows;
}

async function countAllArticles() {
  const { rows } = await pool.query(
    `SELECT COUNT(*) AS total FROM article WHERE date_expiration > NOW()`
  );
  return Number(rows[0].total);
}

async function findArticlesBySource(idSource, { limit = 20, offset = 0 } = {}) {
  const { rows } = await pool.query(
    `SELECT ${SELECT_FIELDS}
     FROM article a
     JOIN source src ON src.id_source = a.id_source
     WHERE a.id_source = $1
       AND a.date_expiration > NOW()
     ORDER BY a.date_publication DESC NULLS LAST
     LIMIT $2 OFFSET $3`,
    [idSource, limit, offset]
  );
  return rows;
}

async function countArticlesBySource(idSource) {
  const { rows } = await pool.query(
    `SELECT COUNT(*) AS total FROM article
     WHERE id_source = $1 AND date_expiration > NOW()`,
    [idSource]
  );
  return Number(rows[0].total);
}

async function findArticleById(idArticle) {
  const { rows } = await pool.query(
    `SELECT ${SELECT_FIELDS}
     FROM article a
     JOIN source src ON src.id_source = a.id_source
     WHERE a.id_article = $1`,
    [idArticle]
  );
  return rows[0] ?? null;
}

// Création
// Upsert sur url_origine — évite les doublons lors des crawls successifs.

async function upsertArticle({
  id_source, titre, description, contenu_brut,
  url_origine, vignette, date_publication,
}) {
  const { rows } = await pool.query(
    `INSERT INTO article
       (id_source, titre, description, contenu_brut, url_origine, vignette, date_publication)
     VALUES ($1, $2, $3, $4, $5, $6, $7)
     ON CONFLICT (url_origine) DO UPDATE
       SET
         titre            = EXCLUDED.titre,
         description      = EXCLUDED.description,
         contenu_brut     = EXCLUDED.contenu_brut,
         vignette         = EXCLUDED.vignette,
         date_publication = EXCLUDED.date_publication
     RETURNING id_article, id_source, titre, description, url_origine, date_publication, created_at`,
    [id_source, titre, description ?? null, contenu_brut, url_origine, vignette ?? null, date_publication ?? null]
  );
  return rows[0];
}
// Modifier la description
async function updateDescription(idArticle, description) {
  const { rows } = await pool.query(
    `UPDATE article
     SET description = $1
     WHERE id_article = $2
     RETURNING id_article, titre, description`,
    [description, idArticle]
  );
  return rows[0] ?? null;
}

module.exports = {
  findAllArticles,
  countAllArticles,
  findArticlesBySource,
  countArticlesBySource,
  findArticleById,
  upsertArticle,
  updateDescription,
};