const axios   = require("axios");
const cheerio = require("cheerio");

const TIMEOUT_MS = Number(process.env.RSS_FETCH_TIMEOUT_MS) || 8_000;

const RSS_COMMON_PATHS = [
  "/feed", "/rss", "/rss.xml", "/feed.xml", "/atom.xml",
  "/feed/rss", "/feed/rss2", "/index.xml", "/?feed=rss2",
  "/feeds/posts/default", "/blog/feed", "/actualites/feed", "/news/rss",
  "/actualites/rss.xml", "/fr/rss", "/en/rss",
];

const BROWSER_HEADERS = {
  "User-Agent":      "Mozilla/5.0 (compatible; VeilleStrategique/1.0)",
  Accept:            "text/html,application/xhtml+xml,application/xml;q=0.9,*/*;q=0.8",
  "Accept-Language": "fr-FR,fr;q=0.9,en;q=0.8",
};

// Dictionnaire des sources connues dont le domaine ne se déduit pas du nom.
// Clé : variantes normalisées du nom (minuscules, sans accents, sans espaces).
// Valeur : domaine canonique.
const KNOWN_DOMAINS = {
  // Médias francophones internationaux
  "lemonde":          "lemonde.fr",
  "le monde":         "lemonde.fr",
  "monde":            "lemonde.fr",
  "lefigaro":         "lefigaro.fr",
  "le figaro":        "lefigaro.fr",
  "figaro":           "lefigaro.fr",
  "liberation":       "liberation.fr",
  "libération":       "liberation.fr",
  "lexpress":         "lexpress.fr",
  "lexpres":          "lexpress.fr",
  "l'express":        "lexpress.fr",
  "lobs":             "nouvelobs.com",
  "nouvelobs":        "nouvelobs.com",
  "le nouvel obs":    "nouvelobs.com",
  "france24":         "france24.com",
  "france 24":        "france24.com",
  "france 24":        "france24.fr",
  "rfi":              "rfi.fr",
  "radio france internationale": "rfi.fr",
  "tv5monde":         "tv5monde.com",
  "tv5":              "tv5monde.com",
  "euronews":         "euronews.com",
  "mediacongo":       "mediacongo.net",
  "jeuneafrique":     "jeuneafrique.com",
  "jeune afrique":    "jeuneafrique.com",
  "africanews":       "africanews.com",
  "african news":     "africanews.com",

  // Médias anglophones internationaux
  "bbc":              "bbc.com",
  "bbc news":         "bbc.com",
  "cnn":              "cnn.com",
  "reuters":          "reuters.com",
  "apnews":           "apnews.com",
  "ap news":          "apnews.com",
  "theguardian":      "theguardian.com",
  "the guardian":     "theguardian.com",
  "guardian":         "theguardian.com",
  "nytimes":          "nytimes.com",
  "new york times":   "nytimes.com",
  "techcrunch":       "techcrunch.com",
  "theverge":         "theverge.com",
  "the verge":        "theverge.com",
  "wired":            "wired.com",
  "bloomberg":        "bloomberg.com",
  "forbes":           "forbes.com",

  // Médias camerounais / Afrique centrale
  "cameroon tribune": "cameroon-tribune.cm",
  "cameroontribune":  "cameroon-tribune.cm",
  "tribunal":         "cameroon-tribune.cm",
  "mutations":        "quotidienmutations.info",
  "le quotidien mutations": "quotidienmutations.info",
  "237online":        "237online.com",
  "actucameroun":     "actucameroun.com",
  "crtv":             "crtv.cm",
  "journalducameroun": "journalducameroun.com",
  "journal du cameroun": "journalducameroun.com",
  "camernews":        "camernews.com",
  "ecomatin": "ecomatin.net",
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

  // Correspondance exacte d'abord
  if (KNOWN_DOMAINS[normalized]) return KNOWN_DOMAINS[normalized];

  // Correspondance partielle : le nom saisi contient une clé connue
  for (const [key, domain] of Object.entries(KNOWN_DOMAINS)) {
    if (normalized.includes(normalizeForLookup(key)) ||
        normalizeForLookup(key).includes(normalized)) {
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
    `https://www.${slug}.fr`,
    `https://www.${slug}.cm`,
    `https://${slug}.cm`,
    `https://${slug}.com`,
    `https://www.${plain}.com`,
    `https://www.${plain}.cm`,
    `https://${plain}.com`,
    `https://${plain}.cm`,
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
  // 1. Si urlHint fourni, on cherche directement à partir de cette URL
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

  // 2. Dictionnaire : domaine connu → on sonde directement les paths RSS
  const knownDomain = lookupKnownDomain(siteName);
  if (knownDomain) {
    const baseUrl  = `https://www.${knownDomain}`;
    const toProbe  = RSS_COMMON_PATHS.map((p) => `${baseUrl}${p}`);
    const confirmed = await probeFeeds(toProbe);

    if (confirmed.length > 0) {
      return { site_url: baseUrl, candidates: confirmed };
    }
    // Si les paths standards échouent, on essaie quand même de parser le HTML
    const site = await fetchSiteHtml([baseUrl, `https://${knownDomain}`]);
    if (site) {
      const fromHtml = extractRSSLinksFromHtml(site.html, extractBaseUrl(site.resolvedUrl));
      const extra    = await probeFeeds(fromHtml.map((c) => c.url));
      if (extra.length > 0) return { site_url: site.resolvedUrl, candidates: extra };
    }
  }

  // 3. Fallback : génération de candidats par slug
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
  const CONC      = 4;
  const confirmed = [];

  for (let i = 0; i < urls.length; i += CONC) {
    const batch   = urls.slice(i, i + CONC);
    const results = await Promise.all(batch.map((u) => isValidFeed(u)));
    results.forEach((r) => { if (r) confirmed.push(r); });
    if (confirmed.length >= 3) break;
  }

  return confirmed;
}

module.exports = { detectRSSFeeds };