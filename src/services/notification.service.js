const { pool }   = require('../config/database');
const sseService = require('./sse.service');

async function createAlerte({ type_alerte, id_article, id_rapport, id_destinataire }) {
  const { rows } = await pool.query(
    `INSERT INTO alerte (type_alerte, id_article, id_rapport, id_destinataire, statut_envoi)
     VALUES ($1, $2, $3, $4, false)
     RETURNING id_alerte, type_alerte, id_article, id_rapport, id_destinataire, created_at`,
    [type_alerte, id_article || null, id_rapport || null, id_destinataire]
  );
  return rows[0];
}

async function notifyNouvelArticle(article) {
  try {
    if (!article.id_user) return;

    const alerte = await createAlerte({
      type_alerte:     'in_app',
      id_article:      article.id_article,
      id_destinataire: article.id_user,
    });

    sseService.sendToUser(article.id_user, 'nouvel_article', {
      id_alerte:  alerte.id_alerte,
      type:       'nouvel_article',
      titre:      article.titre,
      source:     article.nom_source || '',
      url:        article.url_origine,
      vignette:   article.vignette,
      created_at: alerte.created_at,
    });
  } catch (err) {
    console.error('[NOTIFICATION] Erreur :', err.message);
  }
}

async function notifyNoteGeneree(note, idCreateur) {
  try {
    const alerte = await createAlerte({
      type_alerte:     'in_app',
      id_rapport:      note.id_note,
      id_destinataire: idCreateur,
    });

    sseService.sendToUser(idCreateur, 'note_generee', {
      id_alerte:  alerte.id_alerte,
      type:       'note_generee',
      titre:      note.titre_note,
      id_note:    note.id_note,
      created_at: alerte.created_at,
    });
  } catch (err) {
    console.error('[NOTIFICATION] Erreur :', err.message);
  }
}

async function marquerEnvoyee(idAlerte) {
  await pool.query(
    'UPDATE alerte SET statut_envoi = true WHERE id_alerte = $1',
    [idAlerte]
  );
}

async function getAlertesByUser(idUser, { limit = 20, offset = 0, nonLues = false } = {}) {
  const condition = nonLues ? 'AND a.statut_envoi = false' : '';
  const { rows } = await pool.query(
    `SELECT
       a.id_alerte, a.type_alerte, a.statut_envoi, a.created_at,
       a.id_article, a.id_rapport,
       art.titre       AS article_titre,
       art.url_origine AS article_url,
       art.vignette    AS article_vignette,
       n.titre_note    AS note_titre
     FROM alerte a
     LEFT JOIN article art ON art.id_article = a.id_article
     LEFT JOIN note    n   ON n.id_note      = a.id_rapport
     WHERE a.id_destinataire = $1
       AND a.type_alerte = 'in_app'
       ${condition}
     ORDER BY a.created_at DESC
     LIMIT $2 OFFSET $3`,
    [idUser, limit, offset]
  );
  return rows;
}

async function countNonLues(idUser) {
  const { rows } = await pool.query(
    `SELECT COUNT(*) AS total FROM alerte
     WHERE id_destinataire = $1
       AND type_alerte = 'in_app'
       AND statut_envoi = false`,
    [idUser]
  );
  return Number(rows[0].total);
}

module.exports = {
  createAlerte,
  notifyNouvelArticle,
  notifyNoteGeneree,
  marquerEnvoyee,
  getAlertesByUser,
  countNonLues,
};