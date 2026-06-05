const axios   = require("axios");
const cheerio = require("cheerio");

const TIMEOUT_MS = Number(process.env.RSS_FETCH_TIMEOUT_MS) || 10000;

const RSS_COMMON_PATHS = [
  "/feed", "/rss", "/rss.xml", "/feed.xml", "/atom.xml",
  "/feed/rss", "/feed/rss2", "/index.xml", "/?feed=rss2",
  "/feeds/posts/default", "/blog/feed", "/actualites/feed", "/news/rss",
  "/actualites/rss.xml", "/fr/rss", "/en/rss",
];


const BROWSER_HEADERS = {
  "User-Agent": "Mozilla/5.0 (Windows NT 10.0; Win64; x64; rv:126.0) Gecko/20100101 Firefox/126.0",
  "Accept": "text/html,application/xhtml+xml,application/xml;q=0.9,image/avif,image/webp,*/*;q=0.8",
  "Accept-Language": "fr,fr-FR;q=0.8,en-US;q=0.5,en;q=0.3",
  "Accept-Encoding": "gzip, deflate, br",
  "Connection": "keep-alive",
  "Upgrade-Insecure-Requests": "1",
  "Sec-Fetch-Dest": "document",
  "Sec-Fetch-Mode": "navigate",
  "Sec-Fetch-Site": "none",
  "Sec-Fetch-User": "?1",
  "Cache-Control": "max-age=0"
};

const sleep = (ms) => new Promise((resolve) => setTimeout(resolve, ms));

const KNOWN_DOMAINS = {
  // --- AFRIQUE CENTRALE ---
  "cameroon tribune": "cameroon-tribune.cm", "cameroontribune": "cameroon-tribune.cm",
  "mutations": "quotidienmutations.info", "le quotidien mutations": "quotidienmutations.info",
  "237online": "237online.com", "actucameroun": "actucameroun.com", "crtv": "crtv.cm",
  "journal du cameroun": "journalducameroun.com", "journalducameroun": "journalducameroun.com",
  "ecomatin": "ecomatin.net", "investir au cameroun": "investiraucameroun.com",
  "mediacongo": "mediacongo.net", "politico": "politico.cd", "actualite cd": "actualite.cd",
  "le potentiel": "lepotentiel.cd", "adiac": "adiac-congo.com", "les echos du congo": "lesechos-congbrazza.com",
  "gabonactu": "gabonactu.com", "gabon review": "gabonreview.com", "union gabon": "lunion-gabon.com",
  "alwihda": "alwihdainfo.com", "tchadinfos": "tchadinfos.com", "journal du tchad": "journaldutchad.com",
  "agendaniamey": "agendaniamey.com", "abangui": "abangui.com",

  // --- AFRIQUE DE L'OUEST ---
  "jeune afrique": "jeuneafrique.com", "jeuneafrique": "jeuneafrique.com",
  "fraternite matin": "fratmat.info", "abidjan net": "abidjan.net", "koaci": "koaci.com",
  "lepatrioteci": "lepatriote.ci", "yeclo": "yeclo.com", "le soleil": "lesoleil.sn",
  "dakaractu": "dakaractu.com", "seneweb": "seneweb.com", "pressafrik": "pressafrik.com",
  "le faso": "lefaso.net", "burkina24": "burkina24.com", "wakat sera": "wakatsera.com",
  "maliweb": "maliweb.net", "malijet": "malijet.com", "l独立报": "lindependant.co",
  "aomalien": "anmali.org", "togofirst": "togofirst.com", "republicoftogo": "republicoftogo.com",
  "ici lome": "icilome.com", "ortb": "ortb.bj", "banouto": "banouto.bj", "la nouvelle tribune": "lanouvelletribune.info",
  "ghanaweb": "ghanaweb.com", "graphic online": "graphic.com.gh", "joy news": "myjoyonline.com",
  "vanguard": "vanguardngr.com", "the punch": "punchng.com", "premium times": "premiumtimesng.com", "thisday": "thisdaylive.com",

  // --- AFRIQUE DE L'EST & CORNE ---
  "the daily nation": "nation.africa", "the standard": "standardmedia.co.ke", "the star ke": "the-star.co.ke",
  "capital fm": "capitalfm.co.ke", "the citizen tz": "thecitizen.co.tz", "dailynews tz": "dailynews.co.tz",
  "the new times": "newtimes.co.rw", "igihe": "igihe.com", "tatarwanda": "tasarwanda.com",
  "the monitor ug": "monitor.co.ug", "new vision": "newvision.co.ug", "the independent ug": "independent.co.ug",
  "addis fortune": "addisfortune.news", "ethiopian monitor": "ethiopianmonitor.com", "fana": "fanabc.com",
  "garowe online": "garoweonline.com", "hiiraan": "hiiraan.com", "sudan tribune": "sudantribune.com",

  // --- AFRIQUE DU NORD ---
  "el watan": "elwatan-dz.com", "aps": "aps.dz", "tsa algerie": "tsa-algerie.com", "echorouk": "echoroukonline.com",
  "le matin ma": "lematin.ma", "hespress": "hespress.com", "medias24": "medias24.com", "telquel": "telquel.ma",
  "la presse de tunisie": "lapresse.tn", "business news tn": "businessnews.com.tn", "kapitalis": "kapitalis.com",
  "ahram": "ahram.org.eg", "egypt today": "egypttoday.com", "cairo post": "thecairopost.com",
  "libya herald": "libyaherald.com", "laayoune": "laayoune24.com",

  // --- AFRIQUE AUSTRALE ---
  "news24": "news24.com", "mail and guardian": "mg.co.za", "timeslive": "timeslive.co.za", "eyewitness news": "ewn.co.za",
  "the herald zw": "herald.co.zw", "newsday zw": "newsday.co.zw", "the namibian": "namibian.com.na",
  "the patriot ls": "thepatriot.co.ls", "mweb": "mweb.co.za", "club of mozambique": "clubofmozambique.com",

  // --- EUROPE ---
  "le monde": "lemonde.fr", "lefigaro": "lefigaro.fr", "liberation": "liberation.fr", "lexpress": "lexpress.fr",
  "lobs": "nouvelobs.com", "la tribune": "latribune.fr", "les echos": "lesechos.fr", "mediapart": "mediapart.fr",
  "bbc": "bbc.com", "the guardian": "theguardian.com", "the telegraph": "telegraph.co.uk", "the independent uk": "independent.co.uk",
  "el pais": "elpais.com", "el mundo": "elmundo.es", "la vanguardia": "lavanguardia.com",
  "corriere della sera": "corriere.it", "la repubblica": "repubblica.it", "la stampa": "lastampa.it",
  "spiegel": "spiegel.de", "die welt": "welt.de", "faz": "faz.net", "zeit": "zeit.de",
  "le soir": "lesoir.be", "la libre": "lalibre.be", "nzz": "nzz.ch", "le temps": "letemps.ch",
  "rt": "rt.com", "tass": "tass.com", "ria": "ria.ru", "the moscow times": "themoscowtimes.com",
  "euronews": "euronews.com", "politico europe": "politico.eu", "deutsche welle": "dw.com",

  // --- AMÉRIQUES ---
  "nytimes": "nytimes.com", "washington post": "washingtonpost.com", "wall street journal": "wsj.com",
  "bloomberg": "bloomberg.com", "forbes": "forbes.com", "reuters": "reuters.com", "ap news": "apnews.com",
  "cnn": "cnn.com", "fox news": "foxnews.com", "cnbc": "cnbc.com", "politico us": "politico.com",
  "the globe and mail": "theglobeandmail.com", "national post": "nationalpost.com", "cbc": "cbc.ca",
  "el universal mx": "eluniversal.com.mx", "reforma": "reforma.com", "la nacion ar": "lanacion.com.ar",
  "clarin": "clarin.com", "o globo": "oglobo.globo.com", "folha": "folha.uol.com.br", "el tiempo co": "eltiempo.com",

  // --- ASIE ---
  "xinhua": "xinhuanet.com", "china daily": "chinadaily.com.cn", "south china morning post": "scmp.com",
  "the japan times": "japantimes.co.jp", "asahi shimbun": "asahi.com", "nikkei": "asia.nikkei.com",
  "the times of india": "timesofindia.indiatimes.com", "the hindu": "thehindu.com", "ndtv": "ndtv.com",
  "the straits times": "straitstimes.com", "channel news asia": "channelnewsasia.com",
  "bangkok post": "bangkokpost.com", "the jakarta post": "thejakartapost.com", "yonhap": "yna.co.kr",
  "al jazeera": "aljazeera.com", "khaleej times": "khaleejtimes.com", "arab news": "arabnews.com",

  // --- OCÉANIE ---
  "the sydney morning herald": "smh.com.au", "the australian": "theaustralian.com.au", "abc news au": "abc.net.au",
  "nz herald": "nzherald.co.nz", "stuff nz": "stuff.co.nz", "rnz": "rnz.co.nz"
};

function normalizeForLookup(str) {
  return str
      .toLowerCase()
      .normalize("NFD")
      .replace(/[\u0300-\u036f]/g, "")
      .replace(/[^a-z0-9\s]/g, "")
      .trim();
}

function lookupKnownDomain(siteName) {
  const normalized = normalizeForLookup(siteName);
  if (KNOWN_DOMAINS[normalized]) return KNOWN_DOMAINS[normalized];

  for (const [key, domain] of Object.entries(KNOWN_DOMAINS)) {
    if (normalized.includes(normalizeForLookup(key)) || normalizeForLookup(key).includes(normalized)) {
      return domain;
    }
  }
  return null;
}

function normalizeUrl(raw) {
  const t = raw.trim();
  return /^https?:\/\//i.test(t) ? t : `https://${t}`;
}

function extractBaseUrl(url) {
  const p = new URL(url);
  return `${p.protocol}//${p.host}`;
}

function nameToCandidateUrls(name) {
  const slug = normalizeForLookup(name).replace(/\s+/g, "-");
  const plain = normalizeForLookup(name).replace(/[\s\-]+/g, "");

  return [
    `https://www.${slug}.com`,
    `https://${slug}.com`,
    `https://www.${slug}.cm`,
    `https://${slug}.cm`,
    `https://www.${slug}.net`,
    `https://www.${plain}.com`,
    `https://${plain}.com`
  ];
}

function extractRSSLinksFromHtml(html, baseUrl) {
  const $          = cheerio.load(html);
  const candidates = [];

  $('link[rel="alternate"]').each((_, el) => {
    const type  = $(el).attr("type") || "";
    const href  = $(el).attr("href") || "";
    const titre = $(el).attr("title") || undefined;

    if (!type.includes("rss") && !type.includes("atom") && !type.includes("xml")) return;
    if (!href) return;

    const url = href.startsWith("http")
        ? href
        : `${baseUrl}${href.startsWith("/") ? "" : "/"}${href}`;

    candidates.push({ url, titre });
  });

  return candidates;
}

async function isValidFeed(url) {
  try {
    const res  = await axios.get(url, {
      timeout:      TIMEOUT_MS,
      headers:      BROWSER_HEADERS,
      responseType: "text",
      maxRedirects: 5,
    });
    const ct   = res.headers["content-type"] || "";
    const body = res.data;

    const ok =
        ct.includes("xml") || ct.includes("rss") || ct.includes("atom") ||
        body.includes("<rss") || body.includes("<feed") || body.includes("<channel");

    if (!ok) return null;

    const $           = cheerio.load(body, { xmlMode: true });
    const titre       = $("channel > title").first().text()
        || $("feed > title").first().text()
        || undefined;
    const description = $("channel > description").first().text()
        || $("feed > subtitle").first().text()
        || undefined;

    return { url, titre: titre || undefined, description: description || undefined };
  } catch {
    return null;
  }
}

async function fetchSiteHtml(candidateUrls) {
  for (const url of candidateUrls) {
    try {
      const res = await axios.get(url, {
        timeout:      TIMEOUT_MS,
        headers:      BROWSER_HEADERS,
        responseType: "text",
        maxRedirects: 5,
      });
      return {
        resolvedUrl: res.request?.res?.responseUrl || url,
        html:        res.data,
      };
    } catch { continue; }
  }
  return null;
}

async function detectRSSFeeds(siteName, urlHint) {
  if (urlHint) {
    const normalized = normalizeUrl(urlHint);
    const site = await fetchSiteHtml([normalized]);

    if (!site) throw new Error(`Impossible de joindre "${urlHint}".`);

    const baseUrl   = extractBaseUrl(site.resolvedUrl);
    const fromHtml  = extractRSSLinksFromHtml(site.html, baseUrl);
    const toProbe   = fromHtml.length > 0
        ? fromHtml.map((c) => c.url)
        : RSS_COMMON_PATHS.map((p) => `${baseUrl}${p}`);

    const confirmed = await probeFeeds(toProbe);
    return { site_url: site.resolvedUrl, candidates: confirmed };
  }

  const knownDomain = lookupKnownDomain(siteName);
  if (knownDomain) {
    const baseUrl  = `https://www.${knownDomain}`;
    const toProbe  = RSS_COMMON_PATHS.map((p) => `${baseUrl}${p}`);
    const confirmed = await probeFeeds(toProbe);

    if (confirmed.length > 0) {
      return { site_url: baseUrl, candidates: confirmed };
    }
    const site = await fetchSiteHtml([baseUrl, `https://${knownDomain}`]);
    if (site) {
      const fromHtml = extractRSSLinksFromHtml(site.html, extractBaseUrl(site.resolvedUrl));
      const extra    = await probeFeeds(fromHtml.map((c) => c.url));
      if (extra.length > 0) return { site_url: site.resolvedUrl, candidates: extra };
    }
  }

  const candidateUrls = nameToCandidateUrls(siteName);
  const site = await fetchSiteHtml(candidateUrls);

  if (!site) {
    throw new Error(`Impossible de joindre "${siteName}". Fournissez l'URL via url_hint.`);
  }

  const baseUrl  = extractBaseUrl(site.resolvedUrl);
  const fromHtml = extractRSSLinksFromHtml(site.html, baseUrl);
  const toProbe  = fromHtml.length > 0
      ? fromHtml.map((c) => c.url)
      : RSS_COMMON_PATHS.map((p) => `${baseUrl}${p}`);

  const confirmed = await probeFeeds(toProbe);
  return { site_url: site.resolvedUrl, candidates: confirmed };
}
async function probeFeeds(urls) {
  const confirmed = [];
  const CONC = 2; // Réduit à 2 requêtes parallèles max pour éviter les bans IP en Datacenter

  for (let i = 0; i < urls.length; i += CONC) {
    const batch   = urls.slice(i, i + CONC);
    const results = await Promise.all(batch.map((u) => isValidFeed(u)));
    results.forEach((r) => { if (r) confirmed.push(r); });
    if (confirmed.length >= 3) break;

    // Légère latence de lissage entre les paquets de requêtes
    if (i + CONC < urls.length) {
      await sleep(350);
    }
  }

  return confirmed;
}

module.exports = { detectRSSFeeds };
