const { pool } = require('../config/database');

// ─── Sauvegarder un article ───────────────────────────────────────────────────
// 1. Récupère la date_expiration actuelle de l'article
// 2. Insère dans article_sauvegarde
// 3. Prolonge date_expiration à 10 ans dans le futur (suspension effective)
// Utilise une transaction pour garantir la cohérence des deux opérations.

async function sauvegarderArticle(idUser, idArticle) {
  const client = await pool.connect();
  try {
    await client.query('BEGIN');

    const { rows: artRows } = await client.query(
      'SELECT date_expiration FROM article WHERE id_article = $1',
      [idArticle]
    );

    if (artRows.length === 0) {
      await client.query('ROLLBACK');
      return null;
    }

    const dateExpirationOriginale = artRows[0].date_expiration;

    await client.query(
      `INSERT INTO article_sauvegarde (id_user, id_article, date_expiration_originale)
       VALUES ($1, $2, $3)
       ON CONFLICT (id_user, id_article) DO NOTHING`,
      [idUser, idArticle, dateExpirationOriginale]
    );

    await client.query(
      `UPDATE article
       SET date_expiration = NOW() + INTERVAL '10 years'
       WHERE id_article = $1`,
      [idArticle]
    );

    await client.query('COMMIT');
    return { id_user: idUser, id_article: idArticle, saved_at: new Date() };
  } catch (err) {
    await client.query('ROLLBACK');
    throw err;
  } finally {
    client.release();
  }
}

async function retirerSauvegarde(idUser, idArticle) {
  const client = await pool.connect();
  try {
    await client.query('BEGIN');

    const { rows } = await client.query(
      `DELETE FROM article_sauvegarde
       WHERE id_user = $1 AND id_article = $2
       RETURNING date_expiration_originale`,
      [idUser, idArticle]
    );

    if (rows.length === 0) {
      await client.query('ROLLBACK');
      return false;
    }

    const originale      = new Date(rows[0].date_expiration_originale);
    const dateRestauree  = originale > new Date()
      ? originale
      : new Date(Date.now() + 7 * 24 * 60 * 60 * 1000); // +7 jours de grâce

    await client.query(
      'UPDATE article SET date_expiration = $1 WHERE id_article = $2',
      [dateRestauree, idArticle]
    );

    await client.query('COMMIT');
    return true;
  } catch (err) {
    await client.query('ROLLBACK');
    throw err;
  } finally {
    client.release();
  }
}

async function findSauvegardesByUser(idUser) {
  const { rows } = await pool.query(
    `SELECT
       a.id_article, a.titre, a.url_origine, a.vignette,
       a.date_publication, a.zone, a.pays,
       s.saved_at,
       src.nom_source
     FROM article_sauvegarde s
     JOIN article a  ON a.id_article  = s.id_article
     JOIN source  src ON src.id_source = a.id_source
     WHERE s.id_user = $1
     ORDER BY s.saved_at DESC`,
    [idUser]
  );
  return rows;
}

async function isSauvegarde(idUser, idArticle) {
  const { rows } = await pool.query(
    `SELECT 1 FROM article_sauvegarde
     WHERE id_user = $1 AND id_article = $2`,
    [idUser, idArticle]
  );
  return rows.length > 0;
}

module.exports = {
  sauvegarderArticle,
  retirerSauvegarde,
  findSauvegardesByUser,
  isSauvegarde,
};