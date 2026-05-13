const { pool } = require('../config/database');

// ─── Lire l'analyse courante ──────────────────────────────────────────────────

async function findAnalyseByArticle(idArticle) {
  const { rows } = await pool.query(
    `SELECT
       a.id_article, a.resume_auto, a.score_confiance,
       a.entites_nommees, a.zone_inferee, a.pays_infere,
       a.est_valide, a.correction,
       a.annotation_validee, a.annotation_at,
       a.id_validateur
     FROM analyse_ia a
     WHERE a.id_article = $1`,
    [idArticle]
  );
  return rows[0] ?? null;
}

// ─── Mettre à jour les entités nommées (annotation NER) ──────────────────────
// entitesNommees : objet JS conforme au schéma strict
// { organisations: [...], personnes: [...], lieux: [{nom, type, pays, zone}] }
// idValidateur   : UUID du veilleur qui annote

async function validerAnnotation(idArticle, entitesNommees, idValidateur) {
  const { rows } = await pool.query(
    `UPDATE analyse_ia
     SET
       entites_nommees   = $1,
       annotation_validee = TRUE,
       annotation_at      = NOW(),
       id_validateur      = $2,
       updated_at         = NOW()
     WHERE id_article = $3
     RETURNING
       id_article, entites_nommees, annotation_validee,
       annotation_at, id_validateur`,
    [JSON.stringify(entitesNommees), idValidateur, idArticle]
  );
  return rows[0] ?? null;
}

// ─── Articles annotés (dataset NER) ──────────────────────────────────────────
// Utilisé par l'export CoNLL pour récupérer l'ensemble du corpus annoté.

async function findArticlesAnnotes({ limit = 500, offset = 0 } = {}) {
  const { rows } = await pool.query(
    `SELECT
       art.id_article, art.titre, art.contenu_brut,
       ai.entites_nommees, ai.annotation_at
     FROM analyse_ia ai
     JOIN article art ON art.id_article = ai.id_article
     WHERE ai.annotation_validee = TRUE
       AND art.contenu_brut IS NOT NULL
     ORDER BY ai.annotation_at DESC
     LIMIT $1 OFFSET $2`,
    [limit, offset]
  );
  return rows;
}

// ─── Comptage articles annotés ────────────────────────────────────────────────

async function countArticlesAnnotes() {
  const { rows } = await pool.query(
    `SELECT COUNT(*) AS total
     FROM analyse_ia
     WHERE annotation_validee = TRUE`
  );
  return Number(rows[0].total);
}

module.exports = {
  findAnalyseByArticle,
  validerAnnotation,
  findArticlesAnnotes,
  countArticlesAnnotes,
};