const { pool }  = require('../config/database');
const cache     = require('../services/cache.service');

const SELECT_FIELDS = `
  a.id_article, a.id_source, a.id_auteur,
  a.titre, a.description, a.contenu_brut,
  a.url_origine, a.vignette,
  a.date_publication, a.date_expiration,
  a.est_indexe, a.zone, a.pays, a.created_at,
  src.nom_source, src.type_source
`;

const CATEGORIES_SUBQUERY = `
  COALESCE((
    SELECT array_agg(c.nom_cat ORDER BY c.nom_cat)
    FROM art_cat ac
    JOIN categorie c ON c.id_cat = ac.id_cat
    WHERE ac.id_article = a.id_article
  ), '{}') AS categories
`;

async function findAllArticles({ limit = 20, offset = 0, idUser } = {}) {
    if (!idUser) throw new Error('idUser requis');

    const key = cache.keys.articlesList(limit, offset, idUser);
    const { data } = await cache.getOrSet(key, cache.TTL.ARTICLES_LIST, async () => {
        const [rows, count] = await Promise.all([
            pool.query(
                `SELECT DISTINCT ON (a.id_article)
                    ${SELECT_FIELDS}, ${CATEGORIES_SUBQUERY}
                 FROM article a
                     JOIN source src         ON src.id_source   = a.id_source
                     JOIN source src_user    ON src_user.url_source = src.url_source
                     AND src_user.id_user    = $3
                 WHERE a.date_expiration > NOW()
                 ORDER BY a.id_article, a.date_publication DESC NULLS LAST
                     LIMIT $1 OFFSET $2`,
                [limit, offset, idUser]
            ),
            pool.query(
                `SELECT COUNT(DISTINCT a.id_article) AS total
                 FROM article a
                          JOIN source src         ON src.id_source   = a.id_source
                          JOIN source src_user    ON src_user.url_source = src.url_source
                     AND src_user.id_user    = $1
                 WHERE a.date_expiration > NOW()`,
                [idUser]
            ),
        ]);

        // Trier par date après DISTINCT ON
        const articles = rows.rows.sort(
            (a, b) => new Date(b.date_publication).getTime() - new Date(a.date_publication).getTime()
        );

        return { articles, total: Number(count.rows[0].total) };
    });
    return data;
}

async function findArticlesBySource(idSource, { limit = 20, offset = 0, idUser } = {}) {
    if (!idUser) throw new Error('idUser requis');

    const key = cache.keys.articlesSource(idSource, limit, offset, idUser);
    const { data } = await cache.getOrSet(key, cache.TTL.ARTICLES_SOURCE, async () => {
        // Récupérer l'url_source de la source demandée
        const { rows: srcRows } = await pool.query(
            'SELECT url_source FROM source WHERE id_source = $1',
            [idSource]
        );
        if (!srcRows[0]) return { articles: [], total: 0 };

        const urlSource = srcRows[0].url_source;

        const [rows, count] = await Promise.all([
            pool.query(
                `SELECT DISTINCT ON (a.id_article)
                ${SELECT_FIELDS}, ${CATEGORIES_SUBQUERY}
         FROM article a
         JOIN source src ON src.id_source = a.id_source
                        AND src.url_source = $1
         WHERE a.date_expiration > NOW()
         ORDER BY a.id_article, a.date_publication DESC NULLS LAST
         LIMIT $2 OFFSET $3`,
                [urlSource, limit, offset]
            ),
            pool.query(
                `SELECT COUNT(DISTINCT a.id_article) AS total
         FROM article a
         JOIN source src ON src.id_source = a.id_source
                        AND src.url_source = $1
         WHERE a.date_expiration > NOW()`,
                [urlSource]
            ),
        ]);

        const articles = rows.rows.sort(
            (a, b) => new Date(b.date_publication).getTime() - new Date(a.date_publication).getTime()
        );

        return { articles, total: Number(count.rows[0].total) };
    });
    return data;
}

async function findArticleById(id) {
    const key = cache.keys.articleDetail(id);
    const { data } = await cache.getOrSet(key, cache.TTL.ARTICLE_DETAIL, async () => {
        const { rows } = await pool.query(
            `SELECT ${SELECT_FIELDS},
                    ai.resume_auto, ai.score_confiance, ai.entites_nommees,
                    ai.zone_inferee, ai.pays_infere, ai.est_valide,
                    COALESCE(array_agg(DISTINCT c.nom_cat) FILTER (WHERE c.nom_cat IS NOT NULL), '{}') AS categories
             FROM article a
                      JOIN source src ON src.id_source = a.id_source
                      LEFT JOIN analyse_ia ai ON ai.id_article = a.id_article
                      LEFT JOIN art_cat ac    ON ac.id_article  = a.id_article
                      LEFT JOIN categorie c   ON c.id_cat        = ac.id_cat
             WHERE a.id_article = $1
             GROUP BY a.id_article, a.id_source, a.id_auteur,
                      a.titre, a.description, a.contenu_brut,
                      a.url_origine, a.vignette, a.date_publication,
                      a.date_expiration, a.est_indexe, a.zone, a.pays, a.created_at,
                      src.nom_source, src.type_source,
                      ai.resume_auto, ai.score_confiance, ai.entites_nommees,
                      ai.zone_inferee, ai.pays_infere, ai.est_valide`,
            [id]
        );
        return rows[0] ?? null;
    });
    return data;
}

async function upsertArticle({
                                 id_source, titre, description, contenu_brut,
                                 url_origine, vignette, date_publication,
                             }) {
    const { rows } = await pool.query(
        `INSERT INTO article
         (id_source, titre, description, contenu_brut, url_origine, vignette, date_publication)
         VALUES ($1, $2, $3, $4, $5, $6, $7)
             ON CONFLICT (url_origine) DO UPDATE
                                              SET titre            = EXCLUDED.titre,
                                              description      = EXCLUDED.description,
                                              contenu_brut     = EXCLUDED.contenu_brut,
                                              vignette         = EXCLUDED.vignette,
                                              date_publication = EXCLUDED.date_publication
                                              RETURNING id_article, id_source, titre, description, url_origine, vignette, date_publication, created_at`,
        [id_source, titre, description ?? null, contenu_brut, url_origine, vignette ?? null, date_publication ?? null]
    );
    return rows[0];
}

async function updateDescription(idArticle, description) {
    const { rows } = await pool.query(
        `UPDATE article SET description = $1
         WHERE id_article = $2
             RETURNING id_article, titre, description`,
        [description, idArticle]
    );
    await cache.invalidate.article(idArticle);
    return rows[0] ?? null;
}

module.exports = {
    findAllArticles,
    findArticlesBySource,
    findArticleById,
    upsertArticle,
    updateDescription,
};