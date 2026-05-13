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

//  Extraction de la vignette 

function extractVignette(item) {
  // 1. Balises media standard
  if (item.mediaContent?.$.url)   return item.mediaContent.$.url;
  if (item.mediaThumbnail?.$.url) return item.mediaThumbnail.$.url;
  if (item.enclosure?.url)        return item.enclosure.url;

  // 2. Chercher dans le contenu HTML de l'item
  const html = item.content || item['content:encoded'] || item.summary || '';
  if (html) {
    const match = html.match(/<img[^>]+src=["']([^"']+)["']/i);
    if (match) return match[1];
  }

  // 3. Chercher dans itunes:image (podcasts)
  if (item.itunes?.image) return item.itunes.image;

  return null;
}

//  Crawl d'une source 

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
  let inserted = 0, updated = 0, errors = 0;

  for (const item of items) {
    const url_origine = item.link || item.guid;
    if (!url_origine) { errors++; continue; }

    try {
      const existing = await pool.query(
        'SELECT id_article FROM article WHERE url_origine = $1',
        [url_origine]
      );
      const isNew = existing.rows.length === 0;

      await upsertArticle({
        id_source:        source.id_source,
        titre:            (item.title || '(sans titre)').slice(0, 1900),
        description:      (item.contentSnippet || item.summary || '').slice(0, 490) || null,
        contenu_brut:     item.contentSnippet || item.content || item.summary || null,
        url_origine,
        vignette:         extractVignette(item),
        date_publication: item.pubDate ? new Date(item.pubDate) : null,
        });

      isNew ? inserted++ : updated++;
    } catch (err) {
      console.error(`[CRAWL] Erreur article "${url_origine}" : ${err.message}`);
      errors++;
    }
  }

  console.log(`[CRAWL] ${source.nom_source} — +${inserted} nouveaux, ${updated} mis à jour, ${errors} erreurs.`);
  return { inserted, updated, errors };
}

//  Crawl de toutes les sources RSS actives

async function crawlAllSources() {
  const { rows: sources } = await pool.query(
    `SELECT id_source, nom_source, url_source, frequence_check
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