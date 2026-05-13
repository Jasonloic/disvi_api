const { pool } = require('../config/database');

async function findAllCategories() {
  const { rows } = await pool.query(
    `SELECT id_cat, nom_cat FROM categorie ORDER BY nom_cat ASC`
  );
  return rows;
}

async function findCategorieById(id) {
  const { rows } = await pool.query(
    `SELECT id_cat, nom_cat FROM categorie WHERE id_cat = $1`,
    [id]
  );
  return rows[0] ?? null;
}

async function createCategorie(nom_cat) {
  const { rows } = await pool.query(
    `INSERT INTO categorie (nom_cat)
     VALUES ($1)
     ON CONFLICT (nom_cat) DO UPDATE SET nom_cat = EXCLUDED.nom_cat
     RETURNING id_cat, nom_cat`,
    [nom_cat]
  );
  return rows[0];
}

async function updateCategorie(id, nom_cat) {
  const { rows } = await pool.query(
    `UPDATE categorie SET nom_cat = $1
     WHERE id_cat = $2
     RETURNING id_cat, nom_cat`,
    [nom_cat, id]
  );
  return rows[0] ?? null;
}

async function deleteCategorie(id) {
  const { rowCount } = await pool.query(
    `DELETE FROM categorie WHERE id_cat = $1`,
    [id]
  );
  return (rowCount ?? 0) > 0;
}

//  Catégories d'un article

async function findCategoriesByArticle(idArticle) {
  const { rows } = await pool.query(
    `SELECT c.id_cat, c.nom_cat
     FROM categorie c
     JOIN art_cat ac ON ac.id_cat = c.id_cat
     WHERE ac.id_article = $1
     ORDER BY c.nom_cat ASC`,
    [idArticle]
  );
  return rows;
}

async function assignCategorieToArticle(idArticle, idCat) {
  await pool.query(
    `INSERT INTO art_cat (id_article, id_cat)
     VALUES ($1, $2)
     ON CONFLICT (id_article, id_cat) DO NOTHING`,
    [idArticle, idCat]
  );
}

async function removeCategorieFromArticle(idArticle, idCat) {
  const { rowCount } = await pool.query(
    `DELETE FROM art_cat
     WHERE id_article = $1 AND id_cat = $2`,
    [idArticle, idCat]
  );
  return (rowCount ?? 0) > 0;
}

//  Articles par catégorie

async function findArticlesByCategorie(idCat, { limit = 20, offset = 0 } = {}) {
  const { rows } = await pool.query(
    `SELECT
       a.id_article, a.titre, a.url_origine, a.vignette,
       a.date_publication, a.zone, a.pays,
       src.nom_source
     FROM article a
     JOIN art_cat ac  ON ac.id_article = a.id_article
     JOIN source  src ON src.id_source  = a.id_source
     WHERE ac.id_cat = $1
       AND a.date_expiration > NOW()
     ORDER BY a.date_publication DESC NULLS LAST
     LIMIT $2 OFFSET $3`,
    [idCat, limit, offset]
  );
  return rows;
}

async function countArticlesByCategorie(idCat) {
  const { rows } = await pool.query(
    `SELECT COUNT(*) AS total
     FROM art_cat ac
     JOIN article a ON a.id_article = ac.id_article
     WHERE ac.id_cat = $1 AND a.date_expiration > NOW()`,
    [idCat]
  );
  return Number(rows[0].total);
}

module.exports = {
  findAllCategories,
  findCategorieById,
  createCategorie,
  updateCategorie,
  deleteCategorie,
  findCategoriesByArticle,
  assignCategorieToArticle,
  removeCategorieFromArticle,
  findArticlesByCategorie,
  countArticlesByCategorie,
};