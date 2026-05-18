const { pool } = require('../config/database');

async function searchInternal({ q, limit = 20, offset = 0, zone, id_source }) {
  if (!q || !q.trim()) return { articles: [], total: 0 };

  const params  = [];
  const filters = [];
  let   idx     = 1;

  // Requête Full-Text PostgreSQL avec ranking
  params.push(q.trim());
  const tsQuery = `plainto_tsquery('french', $${idx++})`;

  filters.push(`to_tsvector('french', coalesce(a.titre,'') || ' ' || coalesce(a.contenu_brut,'')) @@ ${tsQuery}`);
  filters.push(`a.date_expiration > NOW()`);

  if (zone) {
    params.push(zone);
    filters.push(`a.zone = $${idx++}`);
  }

  if (id_source) {
    params.push(id_source);
    filters.push(`a.id_source = $${idx++}`);
  }

  const where = filters.join(' AND ');

  // Compte total
  const countRes = await pool.query(
    `SELECT COUNT(*) AS total
     FROM article a
     WHERE ${where}`,
    params
  );
  const total = Number(countRes.rows[0].total);

  // Résultats avec ranking et surlignage
  params.push(limit, offset);

  const { rows } = await pool.query(
    `SELECT
       a.id_article, a.titre, a.url_origine, a.vignette,
       a.date_publication, a.zone, a.pays,
       a.description,
       src.nom_source,
       ts_rank(
         to_tsvector('french', coalesce(a.titre,'') || ' ' || coalesce(a.contenu_brut,'')),
         ${tsQuery}
       ) AS score,
       ts_headline(
         'french',
         coalesce(a.contenu_brut, ''),
         ${tsQuery},
         'MaxWords=30, MinWords=15, StartSel=<mark>, StopSel=</mark>'
       ) AS extrait
     FROM article a
     JOIN source src ON src.id_source = a.id_source
     WHERE ${where}
     ORDER BY score DESC, a.date_publication DESC NULLS LAST
     LIMIT $${idx++} OFFSET $${idx++}`,
    params
  );

  return { articles: rows, total, limit, offset };
}

module.exports = { searchInternal };