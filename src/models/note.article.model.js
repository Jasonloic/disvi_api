const { pool } = require('../config/database');

async function findNoteByUserAndArticle(idUser, idArticle) {
  const { rows } = await pool.query(
    `SELECT id_note, id_user, id_article, contenu, created_at, updated_at
     FROM article_note
     WHERE id_user = $1 AND id_article = $2`,
    [idUser, idArticle]
  );
  return rows[0] ?? null;
}

async function findNotesByUser(idUser) {
  const { rows } = await pool.query(
    `SELECT
       n.id_note, n.contenu, n.created_at, n.updated_at,
       a.id_article, a.titre, a.url_origine, a.vignette, a.date_publication,
       src.nom_source
     FROM article_note n
     JOIN article a   ON a.id_article  = n.id_article
     JOIN source  src ON src.id_source = a.id_source
     WHERE n.id_user = $1
     ORDER BY n.updated_at DESC`,
    [idUser]
  );
  return rows;
}

async function upsertNote(idUser, idArticle, contenu) {
  const { rows } = await pool.query(
    `INSERT INTO article_note (id_user, id_article, contenu)
     VALUES ($1, $2, $3)
     ON CONFLICT (id_user, id_article)
     DO UPDATE SET contenu = EXCLUDED.contenu, updated_at = NOW()
     RETURNING id_note, id_user, id_article, contenu, created_at, updated_at`,
    [idUser, idArticle, contenu]
  );
  return rows[0];
}

async function deleteNote(idUser, idArticle) {
  const { rowCount } = await pool.query(
    `DELETE FROM article_note
     WHERE id_user = $1 AND id_article = $2`,
    [idUser, idArticle]
  );
  return (rowCount ?? 0) > 0;
}

module.exports = {
  findNoteByUserAndArticle,
  findNotesByUser,
  upsertNote,
  deleteNote,
};