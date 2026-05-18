const axios   = require("axios");
const cheerio = require("cheerio");

const TIMEOUT_MS = Number(process.env.RSS_FETCH_TIMEOUT_MS) || 8_000;

const RSS_COMMON_PATHS = [
  "/feed", "/rss", "/rss.xml", "/feed.xml", "/atom.xml",
  "/feed/rss", "/feed/rss2", "/index.xml", "/?feed=rss2",
  "/feeds/posts/default", "/blog/feed", "/actualites/feed", "/news/rss",
];

const BROWSER_HEADERS = {
  "User-Agent":    "Mozilla/5.0 (compatible; VeilleStrategique/1.0)",
  Accept:          "text/html,application/xhtml+xml,application/xml;q=0.9,*/*;q=0.8",
  "Accept-Language": "fr-FR,fr;q=0.9,en;q=0.8",
};

function normalizeUrl(raw) {
  const t = raw.trim();
  return /^https?:\/\//i.test(t) ? t : `https://${t}`;
}

function extractBaseUrl(url) {
  const p = new URL(url);
  return `${p.protocol}//${p.host}`;
}

function nameToCandidateUrls(name) {
  const slug = name
    .toLowerCase()
    .replace(/[àâä]/g, "a").replace(/[éèêë]/g, "e")
    .replace(/[îï]/g, "i").replace(/[ôö]/g, "o")
    .replace(/[ùûü]/g, "u")
    .replace(/[^a-z0-9\-\s]/g, "").trim();

  const d = slug.replace(/\s+/g, "-");
  const n = slug.replace(/[\s\-]+/g, "");

  return [
    `https://www.${d}.com`, `https://www.${d}.fr`, `https://www.${d}.cm`,
    `https://${d}.cm`,      `https://${d}.com`,
    `https://www.${n}.com`, `https://www.${n}.cm`,
    `https://${n}.com`,     `https://${n}.cm`,
  ];
}

function extractRSSLinksFromHtml(html, baseUrl) {
  const $          = cheerio.load(html);
  const candidates = [];

  $("link[rel=\"alternate\"]").each((_, el) => {
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

    const ok = ct.includes("xml") || ct.includes("rss") || ct.includes("atom")
      || body.includes("<rss") || body.includes("<feed") || body.includes("<channel");

    if (!ok) return null;

    const $           = cheerio.load(body, { xmlMode: true });
    const titre       = $("channel > title").first().text() || $("feed > title").first().text() || undefined;
    const description = $("channel > description").first().text() || $("feed > subtitle").first().text() || undefined;

    return { url, titre: titre || undefined, description: description || undefined };
  } catch {
    return null;
  }
}

async function detectRSSFeeds(siteName, urlHint) {
  const candidateUrls = urlHint ? [normalizeUrl(urlHint)] : nameToCandidateUrls(siteName);

  let resolvedSiteUrl = "";
  let htmlBody        = "";

  for (const url of candidateUrls) {
    try {
      const res   = await axios.get(url, {
        timeout:      TIMEOUT_MS,
        headers:      BROWSER_HEADERS,
        responseType: "text",
        maxRedirects: 5,
      });
      resolvedSiteUrl = res.request?.res?.responseUrl || url;
      htmlBody        = res.data;
      break;
    } catch { continue; }
  }

  if (!resolvedSiteUrl)
    throw new Error(`Impossible de joindre "${siteName}". Fournissez l URL via url_hint.`);

  const baseUrl      = extractBaseUrl(resolvedSiteUrl);
  const fromHtml     = extractRSSLinksFromHtml(htmlBody, baseUrl);
  const fallbackUrls = fromHtml.length === 0
    ? RSS_COMMON_PATHS.map((p) => `${baseUrl}${p}`)
    : [];

  const allUrls  = [...fromHtml.map((c) => c.url), ...fallbackUrls];
  const CONC     = 4;
  const confirmed = [];

  for (let i = 0; i < allUrls.length; i += CONC) {
    const batch   = allUrls.slice(i, i + CONC);
    const results = await Promise.all(batch.map((u) => isValidFeed(u)));
    results.forEach((r) => { if (r) confirmed.push(r); });
    if (confirmed.length > 0 && fromHtml.length > 0) break;
  }

  return { site_url: resolvedSiteUrl, candidates: confirmed };
}

module.exports = { detectRSSFeeds };
