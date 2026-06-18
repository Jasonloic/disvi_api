const RSSParser = require('rss-parser');
const { pool }  = require('../config/database');
const { upsertArticle } = require('../models/article.model');

const parser = new RSSParser({
  timeout: Number(process.env.RSS_FETCH_TIMEOUT_MS) || 8_000,
  headers: {
    'User-Agent': 'Mozilla/5.0 (compatible; VeilleStrategique/1.0)',
    Accept:       'application/rss+xml, application/xml, text/xml',
  },
  customFields: {
    item: [
      ['media:content',   'mediaContent'],
      ['media:thumbnail', 'mediaThumbnail'],
      ['enclosure',       'enclosure'],
      ['content:encoded', 'content:encoded'],
    ],
  },
});

const BLOCKED_KEYWORDS = [
  '1xbet', 'pari sportif', 'paris sportifs', 'bookmaker',
  'cashback garanti', 'freebet', 'cote sportive', 'mise sportive',
  'casino', 'jackpot', 'slot', 'machine à sous',
];

function isBlockedContent(titre, contenu) {
  const text = `${titre} ${contenu}`.toLowerCase();
  return BLOCKED_KEYWORDS.some((kw) => text.includes(kw.toLowerCase()));
}

// Retourne null si la date est invalide — évite "0NaN-NaN-NaN..." dans PostgreSQL
function parseDateSafe(raw) {
  if (!raw) return null;
  const d = new Date(raw);
  return isNaN(d.getTime()) ? null : d;
}

function extractVignette(item) {
  if (item.mediaContent?.$.url)   return item.mediaContent.$.url;
  if (item.mediaThumbnail?.$.url) return item.mediaThumbnail.$.url;
  if (item.enclosure?.url)        return item.enclosure.url;
  const html = item.content || item['content:encoded'] || item.summary || '';
  if (html) {
    const match = html.match(/<img[^>]+src=["']([^"']+)["']/i);
    if (match) return match[1];
  }
  if (item.itunes?.image) return item.itunes.image;
  return null;
}

// Nettoie les URLs avec espaces ou sauts de ligne (problème Jeune Afrique)
function cleanUrl(raw) {
  if (!raw) return null;
  return raw.trim().replace(/\s+/g, '');
}

async function crawlSource(source) {
  if (!source.url_source) {
    console.warn(`[CRAWL] Source ${source.id_source} (${source.nom_source}) — url_source manquante, ignorée.`);
    return { inserted: 0, updated: 0, errors: 0 };
  }

  console.log(`[CRAWL] Démarrage — ${source.nom_source} (${source.url_source})`);

  let feed;
  try {
    feed = await parser.parseURL(source.url_source);
  } catch (err) {
    console.error(`[CRAWL] Échec parsing ${source.nom_source} : ${err.message}`);
    return { inserted: 0, updated: 0, errors: 1 };
  }

  const items = feed.items ?? [];
  let inserted = 0, updated = 0, errors = 0, blocked = 0;

  for (const item of items) {
    const url_origine = cleanUrl(item.link || item.guid);
    if (!url_origine) { errors++; continue; }

    const titre   = (item.title || '(sans titre)').slice(0, 1900);
    const contenu = item.contentSnippet || item.content || item.summary || '';

    if (isBlockedContent(titre, contenu)) {
      console.log(`[CRAWL] Bloqué — "${titre.slice(0, 60)}"`);
      blocked++;
      continue;
    }

    try {
      const existing = await pool.query(
        'SELECT id_article FROM article WHERE url_origine = $1',
        [url_origine]
      );
      const isNew = existing.rows.length === 0;

      const result = await upsertArticle({
        id_source:        source.id_source,
        titre,
        description:      contenu.slice(0, 490) || null,
        contenu_brut:     contenu,
        url_origine,
        vignette:         extractVignette(item),
        date_publication: parseDateSafe(item.pubDate),
      });

      if (isNew) {
        inserted++;

        try {
          const cache = require('../services/cache.service');
          await cache.invalidate.articles(source.id_source);
        } catch { /* ne pas bloquer le crawl */ }

        try {
          const { assignCategories } = require('./auto.categorie.service');
          const categories = await assignCategories(result.id_article, titre, contenu);
          if (categories.length > 0) {
            console.log(`[CRAWL] "${titre.slice(0, 50)}" → ${categories.map(c => c.nom_cat).join(', ')}`);
          }
        } catch { /* ne pas bloquer le crawl */ }

        try {
          const { notifyNouvelArticle } = require('./notification.service');
          await notifyNouvelArticle({
            id_article:  result.id_article,
            titre:       result.titre,
            url_origine: result.url_origine,
            vignette:    result.vignette || null,
            nom_source:  source.nom_source,
            id_user:     source.id_user,
          });
        } catch { /* ne pas bloquer le crawl */ }

      } else {
        updated++;
      }

    } catch (err) {
      console.error(`[CRAWL] Erreur article "${url_origine}" : ${err.message}`);
      errors++;
    }
  }

  console.log(`[CRAWL] ${source.nom_source} — +${inserted} nouveaux, ${updated} mis à jour, ${blocked} bloqués, ${errors} erreurs.`);
  return { inserted, updated, blocked, errors };
}

async function crawlAllSources() {
  const { rows: sources } = await pool.query(
    `SELECT id_source, nom_source, url_source, frequence_check, id_user
     FROM source
     WHERE type_source = 'RSS' AND url_source IS NOT NULL`
  );

  if (sources.length === 0) {
    console.log('[CRAWL] Aucune source RSS configurée.');
    return;
  }

  console.log(`[CRAWL] ${sources.length} source(s) à crawler.`);
  for (const source of sources) {
    await crawlSource(source);
  }
}

module.exports = { crawlSource, crawlAllSources };
