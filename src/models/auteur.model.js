const { pool } = require('../config/database');

async function findAuteursBySource(idSource) {
  const { rows } = await pool.query(
    `SELECT id_auteur, id_source, handle_social, created_at
     FROM auteur
     WHERE id_source = $1
     ORDER BY created_at DESC`,
    [idSource]
  );
  return rows;
}

async function createAuteur(idSource, handleSocial) {
  const { rows } = await pool.query(
    `INSERT INTO auteur (id_source, handle_social)
     VALUES ($1, $2)
     RETURNING id_auteur, id_source, handle_social, created_at`,
    [idSource, handleSocial]
  );
  return rows[0];
}

async function deleteAuteur(idAuteur) {
  const { rowCount } = await pool.query(
    'DELETE FROM auteur WHERE id_auteur = $1',
    [idAuteur]
  );
  return (rowCount ?? 0) > 0;
}

module.exports = { findAuteursBySource, createAuteur, deleteAuteur };
