const axios   = require('axios');
const cheerio = require('cheerio');
const { pool } = require('../config/database');

const TIMEOUT = 10_000;
const UA      = 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36';


async function searchDuckDuckGoWeb(query, lang = 'fr') {
  try {
    const res = await axios.post(
      'https://html.duckduckgo.com/html/',
      `q=${encodeURIComponent(query)}&kl=${lang === 'fr' ? 'fr-fr' : 'us-en'}&kp=-1&df=`,
      {
        timeout: TIMEOUT,
        headers: {
          'User-Agent':      UA,
          'Content-Type':    'application/x-www-form-urlencoded',
          'Accept':          'text/html,application/xhtml+xml',
          'Accept-Language': `${lang}-${lang.toUpperCase()},${lang};q=0.9`,
          'Referer':         'https://duckduckgo.com/',
          'Origin':          'https://duckduckgo.com',
        },
      }
    );

    const $     = cheerio.load(res.data);
    const items = [];

    $('.result:not(.result--ad)').each((_, el) => {
      const titre   = $(el).find('.result__title').text().trim();
      const rawUrl  = $(el).find('.result__url').text().trim();
      const extrait = $(el).find('.result__snippet').text().trim();
      const href    = $(el).find('a.result__a').attr('href') || '';

      if (!titre) return;

      let url = rawUrl;
      if (!url && href.includes('uddg=')) {
        try { url = decodeURIComponent(href.split('uddg=')[1]); } catch { url = href; }
      }
      if (url && !url.startsWith('http')) url = `https://${url}`;

      items.push({
        source:  url ? new URL(url).hostname.replace('www.', '') : 'Web',
        titre,
        extrait: extrait.slice(0, 400),
        url,
        moteur:  'DuckDuckGo',
      });
    });

    return items.slice(0, 20);
  } catch (err) {
    console.error('[SEARCH WEB] DuckDuckGo :', err.message);
    return [];
  }
}


async function searchGoogleNews(query, lang = 'fr') {
  const url = `https://news.google.com/rss/search?q=${encodeURIComponent(query)}&hl=${lang}&gl=${lang.toUpperCase()}&ceid=${lang.toUpperCase()}:${lang}`;
  try {
    const res   = await axios.get(url, { timeout: TIMEOUT, headers: { 'User-Agent': UA } });
    const $     = cheerio.load(res.data, { xmlMode: true });
    const items = [];
    $('item').each((_, el) => {
      const titre   = $(el).find('title').first().text().trim();
      const lien    = $(el).find('link').first().text().trim() || $(el).find('guid').text().trim();
      const pubDate = $(el).find('pubDate').text().trim();
      const source  = $(el).find('source').text().trim();
      const desc    = $(el).find('description').first().text().replace(/<[^>]+>/g, '').trim().slice(0, 300);
      if (titre) items.push({ source: source || 'Google News', titre, extrait: desc, url: lien, pubDate: pubDate || null, moteur: 'Google News' });
    });
    return items.slice(0, 15);
  } catch (err) {
    console.error('[SEARCH WEB] Google News :', err.message);
    return [];
  }
}



async function searchBingNews(query) {
  const url = `https://www.bing.com/news/search?q=${encodeURIComponent(query)}&format=RSS`;
  try {
    const res   = await axios.get(url, { timeout: TIMEOUT, headers: { 'User-Agent': UA } });
    const $     = cheerio.load(res.data, { xmlMode: true });
    const items = [];
    $('item').each((_, el) => {
      const titre   = $(el).find('title').first().text().trim();
      const lien    = $(el).find('link').first().text().trim();
      const pubDate = $(el).find('pubDate').text().trim();
      const desc    = $(el).find('description').first().text().replace(/<[^>]+>/g, '').trim().slice(0, 300);
      if (titre) items.push({ source: 'Bing News', titre, extrait: desc, url: lien, pubDate: pubDate || null, moteur: 'Bing News' });
    });
    return items.slice(0, 10);
  } catch (err) {
    console.error('[SEARCH WEB] Bing News :', err.message);
    return [];
  }
}



async function searchFromDB(query) {
  try {
    const { rows } = await pool.query(
      `SELECT a.titre, a.url_origine AS url, a.description AS extrait,
              a.date_publication AS "pubDate", src.nom_source AS source
       FROM article a
       JOIN source src ON src.id_source = a.id_source
       WHERE to_tsvector('french', coalesce(a.titre,'') || ' ' || coalesce(a.contenu_brut,''))
             @@ plainto_tsquery('french', $1)
         AND a.date_expiration > NOW()
       ORDER BY a.date_publication DESC NULLS LAST
       LIMIT 10`,
      [query]
    );
    return rows.map((r) => ({ ...r, moteur: 'Base locale' }));
  } catch {
    return [];
  }
}



async function searchWeb(query, lang = 'fr') {
  const [ddg, google, bing, local] = await Promise.allSettled([
    searchDuckDuckGoWeb(query, lang),
    searchGoogleNews(query, lang),
    searchBingNews(query),
    searchFromDB(query),
  ]);

  return {
    web:         ddg.status    === 'fulfilled' ? ddg.value    : [],
    google_news: google.status === 'fulfilled' ? google.value : [],
    bing_news:   bing.status   === 'fulfilled' ? bing.value   : [],
    base_locale: local.status  === 'fulfilled' ? local.value  : [],
  };
}

module.exports = { searchWeb };