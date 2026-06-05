const axios   = require("axios");
const cheerio = require("cheerio");

const TIMEOUT_MS = Number(process.env.RSS_FETCH_TIMEOUT_MS) || 10000;

const RSS_COMMON_PATHS = [
  "/feed", "/rss", "/rss.xml", "/feed.xml", "/atom.xml",
  "/feed/rss", "/feed/rss2", "/index.xml", "/?feed=rss2",
  "/feeds/posts/default", "/blog/feed", "/actualites/feed", "/news/rss"
];

const BROWSER_HEADERS = {
  "User-Agent": "Mozilla/5.0 (Windows NT 10.0; Win64; x64; rv:126.0) Gecko/20100101 Firefox/126.0",
  "Accept": "text/html,application/xhtml+xml,application/xml;q=0.9,*/*;q=0.8",
  "Accept-Language": "fr,fr-FR;q=0.8,en-US;q=0.5,en;q=0.3",
  "Connection": "keep-alive"
};

const sleep = (ms) => new Promise((resolve) => setTimeout(resolve, ms));

const DIRECT_RSS_MAPPING = {
  // === CAMEROUN & AFRIQUE CENTRALE ===
  "cameroon tribune": { site_url: "https://www.cameroon-tribune.cm", feeds: [{ url: "https://www.cameroon-tribune.cm/feed.xml", titre: "Cameroon Tribune" }] },
  "cameroontribune": { site_url: "https://www.cameroon-tribune.cm", feeds: [{ url: "https://www.cameroon-tribune.cm/feed.xml", titre: "Cameroon Tribune" }] },
  "mutations": { site_url: "https://quotidienmutations.info", feeds: [{ url: "https://quotidienmutations.info/feed/", titre: "Mutations" }] },
  "le quotidien mutations": { site_url: "https://quotidienmutations.info", feeds: [{ url: "https://quotidienmutations.info/feed/", titre: "Mutations" }] },
  "237online": { site_url: "https://237online.com", feeds: [{ url: "https://237online.com/feed/", titre: "237Online" }] },
  "actucameroun": { site_url: "https://actucameroun.com", feeds: [{ url: "https://actucameroun.com/feed/", titre: "Actu Cameroun" }] },
  "crtv": { site_url: "https://www.crtv.cm", feeds: [{ url: "https://www.crtv.cm/feed/", titre: "CRTV" }] },
  "journal du cameroun": { site_url: "https://journalducameroun.com", feeds: [{ url: "https://journalducameroun.com/feed/", titre: "Journal du Cameroun" }] },
  "journalducameroun": { site_url: "https://journalducameroun.com", feeds: [{ url: "https://journalducameroun.com/feed/", titre: "Journal du Cameroun" }] },
  "ecomatin": { site_url: "https://ecomatin.net", feeds: [{ url: "https://ecomatin.net/feed/", titre: "EcoMatin" }] },
  "investir au cameroun": { site_url: "https://www.investiraucameroun.com", feeds: [{ url: "https://www.investiraucameroun.com/rss.xml", titre: "Investir au Cameroun" }] },
  "investiraucameroun": { site_url: "https://www.investiraucameroun.com", feeds: [{ url: "https://www.investiraucameroun.com/rss.xml", titre: "Investir au Cameroun" }] },
  "mediacongo": { site_url: "https://www.mediacongo.net", feeds: [{ url: "https://www.mediacongo.net/rss.xml", titre: "MediaCongo" }] },
  "politico cd": { site_url: "https://www.politico.cd", feeds: [{ url: "https://www.politico.cd/feed", titre: "Politico.cd" }] },
  "actualite cd": { site_url: "https://actualite.cd", feeds: [{ url: "https://actualite.cd/feed", titre: "Actualite.cd" }] },
  "le potentiel": { site_url: "https://lepotentiel.cd", feeds: [{ url: "https://lepotentiel.cd/feed/", titre: "Le Potentiel" }] },
  "adiac congo": { site_url: "https://www.adiac-congo.com", feeds: [{ url: "https://www.adiac-congo.com/backend/rss.xml", titre: "ADIAC" }] },
  "gabonactu": { site_url: "https://www.gabonactu.com", feeds: [{ url: "https://www.gabonactu.com/feed/", titre: "Gabon Actu" }] },
  "gabon review": { site_url: "https://www.gabonreview.com", feeds: [{ url: "https://www.gabonreview.com/feed/", titre: "Gabon Review" }] },
  "union gabon": { site_url: "https://www.lunion-gabon.com", feeds: [{ url: "https://www.lunion-gabon.com/index.php?format=feed&type=rss", titre: "L'Union Gabon" }] },
  "alwihda": { site_url: "https://www.alwihdainfo.com", feeds: [{ url: "https://www.alwihdainfo.com/xml/syndication.rss", titre: "Alwihda Info" }] },
  "tchadinfos": { site_url: "https://tchadinfos.com", feeds: [{ url: "https://tchadinfos.com/feed/", titre: "Tchadinfos" }] },
  "journal du tchad": { site_url: "https://journaldutchad.com", feeds: [{ url: "https://journaldutchad.com/feed/", titre: "Journal du Tchad" }] },
  "abangui": { site_url: "https://www.abangui.com", feeds: [{ url: "https://www.abangui.com/rss.xml", titre: "Abangui" }] },
  "rjdh centrafrique": { site_url: "https://rjdh.org", feeds: [{ url: "https://rjdh.org/feed/", titre: "RJDH" }] },
  "journal de brazza": { site_url: "https://journaldebrazza.com", feeds: [{ url: "https://journaldebrazza.com/feed/", titre: "Journal de Brazza" }] },
  "digital congo": { site_url: "https://www.digitalcongo.net", feeds: [{ url: "https://www.digitalcongo.net/rss.xml", titre: "Digital Congo" }] },

  // === AFRIQUE DE L'OUEST ===
  "jeune afrique": { site_url: "https://www.jeuneafrique.com", feeds: [{ url: "https://www.jeuneafrique.com/feed/", titre: "Jeune Afrique" }] },
  "jeuneafrique": { site_url: "https://www.jeuneafrique.com", feeds: [{ url: "https://www.jeuneafrique.com/feed/", titre: "Jeune Afrique" }] },
  "fraternite matin": { site_url: "https://www.fratmat.info", feeds: [{ url: "https://www.fratmat.info/feed", titre: "Fraternité Matin" }] },
  "abidjan net": { site_url: "https://www.abidjan.net", feeds: [{ url: "https://www.abidjan.net/rss/les-nouvelles.xml", titre: "Abidjan.net" }] },
  "koaci": { site_url: "https://www.koaci.com", feeds: [{ url: "https://www.koaci.com/rss.xml", titre: "KOACI" }] },
  "yeclo": { site_url: "https://www.yeclo.com", feeds: [{ url: "https://www.yeclo.com/feed/", titre: "Yeclo" }] },
  "le soleil": { site_url: "https://lesoleil.sn", feeds: [{ url: "https://lesoleil.sn/feed/", titre: "Le Soleil" }] },
  "dakaractu": { site_url: "https://www.dakaractu.com", feeds: [{ url: "https://www.dakaractu.com/xml/syndication.rss", titre: "Dakaractu" }] },
  "seneweb": { site_url: "https://www.seneweb.com", feeds: [{ url: "https://www.seneweb.com/news.xml", titre: "Seneweb" }] },
  "pressafrik": { site_url: "https://www.pressafrik.com", feeds: [{ url: "https://www.pressafrik.com/xml/syndication.rss", titre: "PressAfrik" }] },
  "le faso": { site_url: "https://lefaso.net", feeds: [{ url: "https://lefaso.net/spip.php?page=backend", titre: "LeFaso.net" }] },
  "burkina24": { site_url: "https://burkina24.com", feeds: [{ url: "https://burkina24.com/feed/", titre: "Burkina24" }] },
  "wakat sera": { site_url: "https://wakatsera.com", feeds: [{ url: "https://wakatsera.com/feed/", titre: "Wakat Sera" }] },
  "maliweb": { site_url: "https://www.maliweb.net", feeds: [{ url: "https://www.maliweb.net/feed", titre: "Maliweb" }] },
  "malijet": { site_url: "https://malijet.com", feeds: [{ url: "https://malijet.com/feed/", titre: "Malijet" }] },
  "togofirst": { site_url: "https://www.togofirst.com", feeds: [{ url: "https://www.togofirst.com/rss.xml", titre: "Togo First" }] },
  "republic of togo": { site_url: "https://www.republicoftogo.com", feeds: [{ url: "https://www.republicoftogo.com/rss.xml", titre: "Republic of Togo" }] },
  "ici lome": { site_url: "https://icilome.com", feeds: [{ url: "https://icilome.com/feed/", titre: "Ici Lomé" }] },
  "banouto": { site_url: "https://www.banouto.bj", feeds: [{ url: "https://www.banouto.bj/feed", titre: "Banouto" }] },
  "la nouvelle tribune": { site_url: "https://lanouvelletribune.info", feeds: [{ url: "https://lanouvelletribune.info/feed/", titre: "La Nouvelle Tribune" }] },
  "ghanaweb": { site_url: "https://www.ghanaweb.com", feeds: [{ url: "https://www.ghanaweb.com/GhanaHomePage/rss/feed.php", titre: "GhanaWeb" }] },
  "graphic online": { site_url: "https://www.graphic.com.gh", feeds: [{ url: "https://www.graphic.com.gh/?format=feed&type=rss", titre: "Graphic Online" }] },
  "vanguard nigeria": { site_url: "https://www.vanguardngr.com", feeds: [{ url: "https://www.vanguardngr.com/feed/", titre: "Vanguard" }] },
  "the punch": { site_url: "https://punchng.com", feeds: [{ url: "https://punchng.com/feed/", titre: "The Punch Nigeria" }] },
  "premium times": { site_url: "https://www.premiumtimesng.com", feeds: [{ url: "https://www.premiumtimesng.com/feed", titre: "Premium Times" }] },
  "thisday": { site_url: "https://www.thisdaylive.com", feeds: [{ url: "https://www.thisdaylive.com/feed", titre: "ThisDay Live" }] },
  "linfodrome": { site_url: "https://www.linfodrome.com", feeds: [{ url: "https://www.linfodrome.com/rss.xml", titre: "Linfodrome" }] },
  "sidwaya": { site_url: "https://www.sidwaya.info", feeds: [{ url: "https://www.sidwaya.info/feed/", titre: "Sidwaya" }] },
  "studio tamani": { site_url: "https://www.studiotamani.org", feeds: [{ url: "https://www.studiotamani.org/feed/", titre: "Studio Tamani" }] },
  "actuniger": { site_url: "https://www.actuniger.com", feeds: [{ url: "https://www.actuniger.com/index.php?format=feed&type=rss", titre: "ActuNiger" }] },
  "sud quotidien": { site_url: "https://www.sudonline.sn", feeds: [{ url: "https://www.sudonline.sn/feed/", titre: "Sud Quotidien" }] },
  "daily trust": { site_url: "https://dailytrust.com", feeds: [{ url: "https://dailytrust.com/feed/", titre: "Daily Trust" }] },
  "the guardian nigeria": { site_url: "https://guardian.ng", feeds: [{ url: "https://guardian.ng/feed/", titre: "The Guardian NG" }] },
  "saharareporters": { site_url: "https://saharareporters.com", feeds: [{ url: "https://saharareporters.com/feeds/news.xml", titre: "Sahara Reporters" }] },
  "modern ghana": { site_url: "https://www.modernghana.com", feeds: [{ url: "https://www.modernghana.com/rss/rss.php", titre: "Modern Ghana" }] },
  "frontpage africa": { site_url: "https://frontpageafricaonline.com", feeds: [{ url: "https://frontpageafricaonline.com/feed/", titre: "FrontPage Africa" }] },
  "liberian observer": { site_url: "https://www.liberianobserver.com", feeds: [{ url: "https://www.liberianobserver.com/feed/", titre: "Daily Observer" }] },
  "guineenews": { site_url: "https://guineenews.org", feeds: [{ url: "https://guineenews.org/feed/", titre: "Guinée News" }] },
  "aminata": { site_url: "https://aminata.com", feeds: [{ url: "https://aminata.com/feed/", titre: "Aminata" }] },
  "guinee7": { site_url: "https://guinee7.com", feeds: [{ url: "https://guinee7.com/feed/", titre: "Guinée7" }] },
  "sierra leone telegraph": { site_url: "https://www.thesierraleonetelegraph.com", feeds: [{ url: "https://www.thesierraleonetelegraph.com/feed/", titre: "SL Telegraph" }] },

  // === AFRIQUE DE L'EST & CORNE ===
  "the daily nation": { site_url: "https://nation.africa", feeds: [{ url: "https://nation.africa/service/search/feed/972/972/rss.xml", titre: "Daily Nation" }] },
  "the standard ke": { site_url: "https://www.standardmedia.co.ke", feeds: [{ url: "https://www.standardmedia.co.ke/rss/headlines.xml", titre: "The Standard Kenya" }] },
  "the star ke": { site_url: "https://www.the-star.co.ke", feeds: [{ url: "https://www.the-star.co.ke/rss/", titre: "The Star" }] },
  "the citizen tanzania": { site_url: "https://www.thecitizen.co.tz", feeds: [{ url: "https://www.thecitizen.co.tz/service/search/feed/2324/2324/rss.xml", titre: "The Citizen TZ" }] },
  "the new times rwanda": { site_url: "https://www.newtimes.co.rw", feeds: [{ url: "https://www.newtimes.co.rw/rss/all.xml", titre: "The New Times" }] },
  "igihe": { site_url: "https://igihe.com", feeds: [{ url: "https://igihe.com/spip.php?page=backend", titre: "IGIHE" }] },
  "the monitor uganda": { site_url: "https://www.monitor.co.ug", feeds: [{ url: "https://www.monitor.co.ug/service/search/feed/1638/1638/rss.xml", titre: "The Monitor" }] },
  "new vision": { site_url: "https://www.newvision.co.ug", feeds: [{ url: "https://www.newvision.co.ug/feed/", titre: "New Vision" }] },
  "addis fortune": { site_url: "https://addisfortune.news", feeds: [{ url: "https://addisfortune.news/feed/", titre: "Addis Fortune" }] },
  "fana broadcasting": { site_url: "https://www.fanabc.com", feeds: [{ url: "https://www.fanabc.com/english/feed/", titre: "FBC" }] },
  "garowe online": { site_url: "https://www.garoweonline.com", feeds: [{ url: "https://www.garoweonline.com/en?format=feed&type=rss", titre: "Garowe Online" }] },
  "hiiraan": { site_url: "https://www.hiiraan.com", feeds: [{ url: "https://www.hiiraan.com/rss/news.xml", titre: "Hiiraan Online" }] },
  "sudan tribune": { site_url: "https://sudantribune.com", feeds: [{ url: "https://sudantribune.com/feed/", titre: "Sudan Tribune" }] },
  "business daily africa": { site_url: "https://www.businessdailyafrica.com", feeds: [{ url: "https://www.businessdailyafrica.com/service/search/feed/2132/2132/rss.xml", titre: "Business Daily" }] },
  "mwananchi": { site_url: "https://www.mwananchi.co.tz", feeds: [{ url: "https://www.mwananchi.co.tz/service/search/feed/2422/2422/rss.xml", titre: "Mwananchi" }] },
  "kt press": { site_url: "https://www.ktpress.rw", feeds: [{ url: "https://www.ktpress.rw/feed/", titre: "KT Press" }] },
  "addis standard": { site_url: "https://addisstandard.com", feeds: [{ url: "https://addisstandard.com/feed/", titre: "Addis Standard" }] },
  "borkena": { site_url: "https://borkena.com", feeds: [{ url: "https://borkena.com/feed/", titre: "Borkena" }] },
  "dabanga": { site_url: "https://www.dabangasudan.org", feeds: [{ url: "https://www.dabangasudan.org/en/feed", titre: "Radio Dabanga" }] },
  "madagascar tribune": { site_url: "https://www.madagascar-tribune.com", feeds: [{ url: "https://www.madagascar-tribune.com/index.php?page=backend", titre: "Madagascar Tribune" }] },
  "lexpress de madagascar": { site_url: "https://lexpress.mg", feeds: [{ url: "https://lexpress.mg/feed/", titre: "L'Express" }] },
  "midi madagasikara": { site_url: "https://midi-madagasikara.mg", feeds: [{ url: "https://midi-madagasikara.mg/feed/", titre: "Midi Madagasikara" }] },
  "le mauricien": { site_url: "https://www.lemauricien.com", feeds: [{ url: "https://www.lemauricien.com/feed/", titre: "Le Mauricien" }] },
  "lexpress maurice": { site_url: "https://lexpress.mu", feeds: [{ url: "https://lexpress.mu/rss.xml", titre: "L'Express mu" }] },

  // === AFRIQUE DU NORD ===
  "el watan": { site_url: "https://elwatan-dz.com", feeds: [{ url: "https://elwatan-dz.com/feed", titre: "El Watan" }] },
  "tsa algerie": { site_url: "https://www.tsa-algerie.com", feeds: [{ url: "https://www.tsa-algerie.com/feed", titre: "TSA" }] },
  "echorouk": { site_url: "https://www.echoroukonline.com", feeds: [{ url: "https://www.echoroukonline.com/feed", titre: "Echorouk" }] },
  "le matin maroc": { site_url: "https://lematin.ma", feeds: [{ url: "https://lematin.ma/rss.xml", titre: "Le Matin.ma" }] },
  "hespress": { site_url: "https://www.hespress.com", feeds: [{ url: "https://www.hespress.com/feed", titre: "Hespress" }] },
  "medias24": { site_url: "https://medias24.com", feeds: [{ url: "https://medias24.com/feed/", titre: "Médias24" }] },
  "telquel": { site_url: "https://telquel.ma", feeds: [{ url: "https://telquel.ma/feed/", titre: "TelQuel" }] },
  "la presse de tunisie": { site_url: "https://lapresse.tn", feeds: [{ url: "https://lapresse.tn/feed/", titre: "La Presse" }] },
  "business news tunisie": { site_url: "https://www.businessnews.com.tn", feeds: [{ url: "https://www.businessnews.com.tn/rss.xml", titre: "Business News" }] },
  "kapitalis": { site_url: "http://kapitalis.com", feeds: [{ url: "http://kapitalis.com/tunisie/feed/", titre: "Kapitalis" }] },
  "ahram online": { site_url: "https://english.ahram.org.eg", feeds: [{ url: "https://english.ahram.org.eg/rss/all", titre: "Al-Ahram" }] },
  "egypt today": { site_url: "https://www.egypttoday.com", feeds: [{ url: "https://www.egypttoday.com/rss", titre: "Egypt Today" }] },
  "libya herald": { site_url: "https://www.libyaherald.com", feeds: [{ url: "https://www.libyaherald.com/feed/", titre: "Libya Herald" }] },
  "le soir dalgerie": { site_url: "https://www.lesoirdalgerie.com", feeds: [{ url: "https://www.lesoirdalgerie.com/rss.xml", titre: "Le Soir d'Algérie" }] },
  "yabiladi": { site_url: "https://www.yabiladi.com", feeds: [{ url: "https://www.yabiladi.com/yabiladi.xml", titre: "Yabiladi" }] },
  "morocco world news": { site_url: "https://www.moroccoworldnews.com", feeds: [{ url: "https://www.moroccoworldnews.com/feed", titre: "Morocco World News" }] },
  "tunisie numerique": { site_url: "https://www.tunisienumerique.com", feeds: [{ url: "https://www.tunisienumerique.com/feed/", titre: "Tunisie Numérique" }] },
  "realites tunisie": { site_url: "https://www.realites.com.tn", feeds: [{ url: "https://www.realites.com.tn/feed/", titre: "Réalités" }] },
  "libya observer": { site_url: "https://www.libyaobserver.ly", feeds: [{ url: "https://www.libyaobserver.ly/rss.xml", titre: "Libya Observer" }] },

  // === AFRIQUE AUSTRALE ===
  "news24": { site_url: "https://www.news24.com", feeds: [{ url: "http://feeds.news24.com/articles/news24/TopStories/rss", titre: "News24" }] },
  "mail and guardian": { site_url: "https://mg.co.za", feeds: [{ url: "https://mg.co.za/feed/", titre: "Mail & Guardian" }] },
  "timeslive": { site_url: "https://www.timeslive.co.za", feeds: [{ url: "https://www.timeslive.co.za/rss/", titre: "TimesLIVE" }] },
  "eyewitness news": { site_url: "https://ewn.co.za", feeds: [{ url: "https://ewn.co.za/rss/Feed/ewn", titre: "EWN" }] },
  "the herald zimbabwe": { site_url: "https://www.herald.co.zw", feeds: [{ url: "https://www.herald.co.zw/feed/", titre: "The Herald" }] },
  "newsday zimbabwe": { site_url: "https://www.newsday.co.zw", feeds: [{ url: "https://www.newsday.co.zw/feed", titre: "NewsDay" }] },
  "the namibian": { site_url: "https://www.namibian.com.na", feeds: [{ url: "https://www.namibian.com.na/feed/", titre: "The Namibian" }] },
  "daily maverick": { site_url: "https://www.dailymaverick.co.za", feeds: [{ url: "https://www.dailymaverick.co.za/feed/", titre: "Daily Maverick" }] },
  "sabc news": { site_url: "https://www.sabcnews.com", feeds: [{ url: "https://www.sabcnews.com/sabcnews/feed/", titre: "SABC News" }] },
  "iol news": { site_url: "https://www.iol.co.za", feeds: [{ url: "https://www.iol.co.za/rss", titre: "IOL" }] },
  "business tech": { site_url: "https://businesstech.co.za", feeds: [{ url: "https://businesstech.co.za/news/feed/", titre: "BusinessTech" }] },
  "lusaka times": { site_url: "https://www.lusakatimes.com", feeds: [{ url: "https://www.lusakatimes.com/feed/", titre: "Lusaka Times" }] },
  "mmegi": { site_url: "https://www.mmegi.bw", feeds: [{ url: "https://www.mmegi.bw/index.php?page=backend", titre: "Mmegi Online" }] },

  // === EUROPE ===
  "le monde": { site_url: "https://www.lemonde.fr", feeds: [{ url: "https://www.lemonde.fr/rss/une.xml", titre: "Le Monde" }] },
  "lefigaro": { site_url: "https://www.lefigaro.fr", feeds: [{ url: "https://www.lefigaro.fr/rss/figaro_actualites.xml", titre: "Le Figaro" }] },
  "liberation": { site_url: "https://www.liberation.fr", feeds: [{ url: "https://www.liberation.fr/arc/outboundfeeds/rss-all/", titre: "Libération" }] },
  "les echos": { site_url: "https://www.lesechos.fr", feeds: [{ url: "https://lesechos.fr/rss/rss_une.xml", titre: "Les Echos" }] },
  "la tribune": { site_url: "https://www.latribune.fr", feeds: [{ url: "https://www.latribune.fr/feed.xml", titre: "La Tribune" }] },
  "lexpress": { site_url: "https://www.lexpress.fr", feeds: [{ url: "https://www.lexpress.fr/rss/alaune.xml", titre: "L'Express" }] },
  "lobs": { site_url: "https://www.nouvelobs.com", feeds: [{ url: "https://www.nouvelobs.com/rss.xml", titre: "L'Obs" }] },
  "mediapart": { site_url: "https://www.mediapart.fr", feeds: [{ url: "https://www.mediapart.fr/articles/feed", titre: "Mediapart" }] },
  "le point": { site_url: "https://www.lepoint.fr", feeds: [{ url: "https://www.lepoint.fr/rss.xml", titre: "Le Point" }] },
  "marianne": { site_url: "https://www.marianne.net", feeds: [{ url: "https://www.marianne.net/rss.xml", titre: "Marianne" }] },
  "20 minutes fr": { site_url: "https://www.20minutes.fr", feeds: [{ url: "https://www.20minutes.fr/rss/une.xml", titre: "20 Minutes" }] },
  "le parisien": { site_url: "https://www.leparisien.fr", feeds: [{ url: "https://www.leparisien.fr/rss.xml", titre: "Le Parisien" }] },
  "la croix": { site_url: "https://www.la-croix.com", feeds: [{ url: "https://www.la-croix.com/rss/univers", titre: "La Croix" }] },
  "bbc": { site_url: "https://www.bbc.com", feeds: [{ url: "https://feeds.bbci.co.uk/news/rss.xml", titre: "BBC News" }] },
  "the guardian": { site_url: "https://www.theguardian.com", feeds: [{ url: "https://www.theguardian.com/world/rss", titre: "The Guardian" }] },
  "the telegraph": { site_url: "https://www.telegraph.co.uk", feeds: [{ url: "https://www.telegraph.co.uk/rss.xml", titre: "The Telegraph" }] },
  "the independent uk": { site_url: "https://www.independent.co.uk", feeds: [{ url: "https://www.independent.co.uk/rss", titre: "The Independent" }] },
  "financial times": { site_url: "https://www.ft.com", feeds: [{ url: "https://www.ft.com/?format=rss", titre: "Financial Times" }] },
  "the economist": { site_url: "https://www.economist.com", feeds: [{ url: "https://www.economist.com/sections/international/rss.xml", titre: "The Economist" }] },
  "el pais": { site_url: "https://elpais.com", feeds: [{ url: "https://ep00.epimg.net/rss/tags/ultimas_noticias.xml", titre: "El País" }] },
  "el mundo": { site_url: "https://www.elmundo.es", feeds: [{ url: "https://e00-elmundo.uecdn.es/elmundo/rss/portada.xml", titre: "El Mundo" }] },
  "la vanguardia": { site_url: "https://www.lavanguardia.com", feeds: [{ url: "https://www.lavanguardia.com/rss/home.xml", titre: "La Vanguardia" }] },
  "corriere della sera": { site_url: "https://www.corriere.it", feeds: [{ url: "https://xml2.corriereobjects.it/rss/homepage.xml", titre: "Corriere della Sera" }] },
  "la repubblica": { site_url: "https://www.repubblica.it", feeds: [{ url: "https://www.repubblica.it/rss/homepage/rss2.0.xml", titre: "La Repubblica" }] },
  "spiegel": { site_url: "https://www.spiegel.de", feeds: [{ url: "https://www.spiegel.de/index.rss", titre: "DER SPIEGEL" }] },
  "die welt": { site_url: "https://www.welt.de", feeds: [{ url: "https://www.welt.de/feeds/topnews.rss", titre: "DIE WELT" }] },
  "faz": { site_url: "https://www.faz.net", feeds: [{ url: "https://www.faz.net/rss/aktuell/", titre: "FAZ" }] },
  "zeit": { site_url: "https://www.zeit.de", feeds: [{ url: "https://newsfeed.zeit.de/index", titre: "ZEIT Online" }] },
  "le soir": { site_url: "https://www.lesoir.be", feeds: [{ url: "https://www.lesoir.be/rss/feeds", titre: "Le Soir" }] },
  "la libre": { site_url: "https://www.lalibre.be", feeds: [{ url: "https://www.lalibre.be/rss.xml", titre: "La Libre" }] },
  "nzz": { site_url: "https://www.nzz.ch", feeds: [{ url: "https://www.nzz.ch/recent.rss", titre: "NZZ" }] },
  "le temps ch": { site_url: "https://www.letemps.ch", feeds: [{ url: "https://www.letemps.ch/feed", titre: "Le Temps" }] },
  "rt": { site_url: "https://www.rt.com", feeds: [{ url: "https://www.rt.com/rss/news/", titre: "RT News" }] },
  "tass": { site_url: "https://tass.com", feeds: [{ url: "https://tass.com/rss/v2.xml", titre: "TASS" }] },
  "euronews": { site_url: "https://www.euronews.com", feeds: [{ url: "https://www.euronews.com/rss?level=theme&name=news", titre: "Euronews" }] },
  "politico europe": { site_url: "https://www.politico.eu", feeds: [{ url: "https://www.politico.eu/feed/", titre: "Politico Europe" }] },
  "deutsche welle": { site_url: "https://www.dw.com", feeds: [{ url: "https://rss.dw.com/rdf/rss-fr-all", titre: "DW French" }] },
  "novaya gazeta": { site_url: "https://novayagazeta.eu", feeds: [{ url: "https://novayagazeta.eu/feed.xml", titre: "Novaya Gazeta" }] },
  "sputnik news": { site_url: "https://sputniknews.africa", feeds: [{ url: "https://sputniknews.africa/rss/", titre: "Sputnik Africa" }] },
  "kyiv independent": { site_url: "https://kyivindependent.com", feeds: [{ url: "https://kyivindependent.com/feed/", titre: "Kyiv Independent" }] },
  "kyiv post": { site_url: "https://www.kyivpost.com", feeds: [{ url: "https://www.kyivpost.com/feed", titre: "Kyiv Post" }] },

  // === AMÉRIQUES ===
  "nytimes": { site_url: "https://www.nytimes.com", feeds: [{ url: "https://rss.nytimes.com/services/xml/rss/nyt/HomePage.xml", titre: "The New York Times" }] },
  "washington post": { site_url: "https://www.washingtonpost.com", feeds: [{ url: "https://feeds.washingtonpost.com/rss/world", titre: "Washington Post" }] },
  "wall street journal": { site_url: "https://www.wsj.com", feeds: [{ url: "https://feeds.a.dj.com/rss/RSSWorldNews.xml", titre: "WSJ World" }] },
  "bloomberg": { site_url: "https://www.bloomberg.com", feeds: [{ url: "https://www.bloomberg.com/feeds/bcom/html/podcasts.rss", titre: "Bloomberg" }] },
  "forbes": { site_url: "https://www.forbes.com", feeds: [{ url: "https://www.forbes.com/most-popular/feed/", titre: "Forbes" }] },
  "reuters": { site_url: "https://www.reuters.com", feeds: [{ url: "https://www.reutersagency.com/feed/", titre: "Reuters Agency" }] },
  "ap news": { site_url: "https://apnews.com", feeds: [{ url: "https://apnews.com/rss/index.xml", titre: "AP News" }] },
  "cnn": { site_url: "https://www.cnn.com", feeds: [{ url: "http://rss.cnn.com/rss/edition.rss", titre: "CNN Global" }] },
  "fox news": { site_url: "https://www.foxnews.com", feeds: [{ url: "http://feeds.foxnews.com/foxnews/latest", titre: "Fox News" }] },
  "cnbc": { site_url: "https://www.cnbc.com", feeds: [{ url: "https://www.cnbc.com/id/100003114/device/rss/rss.html", titre: "CNBC" }] },
  "politico us": { site_url: "https://www.politico.com", feeds: [{ url: "https://rss.politico.com/politics-policy.xml", titre: "Politico" }] },
  "the globe and mail": { site_url: "https://www.theglobeandmail.com", feeds: [{ url: "https://www.theglobeandmail.com/?service=rss", titre: "The Globe and Mail" }] },
  "cbc": { site_url: "https://www.cbc.ca", feeds: [{ url: "https://www.cbc.ca/cconline/rss/frontpage", titre: "CBC News" }] },
  "la nacion argentina": { site_url: "https://www.lanacion.com.ar", feeds: [{ url: "https://servicios.lanacion.com.ar/la-nacion-rss", titre: "La Nación" }] },
  "clarin": { site_url: "https://www.clarin.com", feeds: [{ url: "https://www.clarin.com/rss/lo-ultimo/", titre: "Clarín" }] },
  "o globo": { site_url: "https://oglobo.globo.com", feeds: [{ url: "https://oglobo.globo.com/rss.xml", titre: "O Globo" }] },
  "folha": { site_url: "https://www.folha.uol.com.br", feeds: [{ url: "https://feeds.folha.uol.com.br/emcima/rss091.xml", titre: "Folha de S.Paulo" }] },
  "el tiempo colombia": { site_url: "https://www.eltiempo.com", feeds: [{ url: "https://www.eltiempo.com/rss", titre: "El Tiempo" }] },
  "infobae": { site_url: "https://www.infobae.com", feeds: [{ url: "https://www.infobae.com/feeds/rss/", titre: "Infobae" }] },

  // === ASIE & MOYEN-ORIENT ===
  "china daily": { site_url: "https://www.chinadaily.com.cn", feeds: [{ url: "https://www.chinadaily.com.cn/rss/cndy_rss.xml", titre: "China Daily" }] },
  "south china morning post": { site_url: "https://www.scmp.com", feeds: [{ url: "https://www.scmp.com/rss/91/feed", titre: "SCMP" }] },
  "the japan times": { site_url: "https://www.japantimes.co.jp", feeds: [{ url: "https://www.japantimes.co.jp/feed/", titre: "The Japan Times" }] },
  "nikkei asia": { site_url: "https://asia.nikkei.com", feeds: [{ url: "https://asia.nikkei.com/rss/feed/nar", titre: "Nikkei Asia" }] },
  "the times of india": { site_url: "https://timesofindia.indiatimes.com", feeds: [{ url: "https://timesofindia.indiatimes.com/rssfeeds/default.cms", titre: "Times of India" }] },
  "the straits times": { site_url: "https://www.straitstimes.com", feeds: [{ url: "https://www.straitstimes.com/news/world/rss.xml", titre: "Straits Times" }] },
  "al jazeera": { site_url: "https://www.aljazeera.com", feeds: [{ url: "https://www.aljazeera.com/xml/rss/all.xml", titre: "Al Jazeera" }] },
  "arab news": { site_url: "https://www.arabnews.com", feeds: [{ url: "https://www.arabnews.com/cat/1/rss.xml", titre: "Arab News" }] },
  "global times": { site_url: "https://www.globaltimes.cn", feeds: [{ url: "https://www.globaltimes.cn/conversations/rss.xml", titre: "Global Times" }] },
  "haaretz": { site_url: "https://www.haaretz.com", feeds: [{ url: "https://www.haaretz.com/misc/article-print-page/rss-feeds/1.6212564", titre: "Haaretz" }] },
  "jerusalem post": { site_url: "https://www.jpost.com", feeds: [{ url: "https://www.jpost.com/Rss/RssFeedsHeadlines.aspx", titre: "JPost" }] },
  "anadolu agency": { site_url: "https://www.aa.com.tr", feeds: [{ url: "https://www.aa.com.tr/fr/rss/default?cat=actualite", titre: "Anadolu Agency" }] },

  // === OCÉANIE ===
  "the sydney morning herald": { site_url: "https://www.smh.com.au", feeds: [{ url: "https://www.smh.com.au/rss/feed.xml", titre: "SMH" }] },
  "the australian": { site_url: "https://www.theaustralian.com.au", feeds: [{ url: "https://www.theaustralian.com.au/feed", titre: "The Australian" }] },
  "abc news au": { site_url: "https://www.abc.net.au", feeds: [{ url: "https://www.abc.net.au/news/feed/51120/rss.xml", titre: "ABC News AU" }] },
  "nz herald": { site_url: "https://www.nzherald.co.nz", feeds: [{ url: "https://www.nzherald.co.nz/c-rss/win-headline.xml", titre: "NZ Herald" }] }
};

function normalizeForLookup(str) {
  return str
      .toLowerCase()
      .normalize("NFD")
      .replace(/[\u0300-\u036f]/g, "")
      .replace(/[^a-z0-9\s]/g, "")
      .trim();
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
    `https://www.${slug}.net`,
    `https://www.${plain}.com`
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
      maxRedirects: 3,
    });
    const ct   = res.headers["content-type"] || "";
    const body = res.data;

    const ok =
        ct.includes("xml") || ct.includes("rss") || ct.includes("atom") ||
        body.includes("<rss") || body.includes("<feed") || body.includes("<channel");

    if (!ok) return null;

    const $     = cheerio.load(body, { xmlMode: true });
    const titre = $("channel > title").first().text() || $("feed > title").first().text() || undefined;

    return { url, titre: titre || undefined };
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
        maxRedirects: 3,
      });
      return {
        resolvedUrl: res.request?.res?.responseUrl || url,
        html:        res.data,
      };
    } catch { continue; }
  }
  return null;
}

async function probeFeeds(urls) {
  const confirmed = [];
  const CONC = 2;

  for (let i = 0; i < urls.length; i += CONC) {
    const batch   = urls.slice(i, i + CONC);
    const results = await Promise.all(batch.map((u) => isValidFeed(u)));
    results.forEach((r) => { if (r) confirmed.push(r); });
    if (confirmed.length >= 2) break;

    if (i + CONC < urls.length) {
      await sleep(200);
    }
  }
  return confirmed;
}

// FONCTION PRINCIPALE : FLUX DIRECT EN PRIORITÉ, SCRAPER EN FALLBACK
async function detectRSSFeeds(siteName, urlHint) {
  // 1. Si un urlHint ressemble déjà à un flux direct, on le valide instantanément
  if (urlHint) {
    const normalized = normalizeUrl(urlHint);
    if (normalized.includes("/feed") || normalized.includes(".xml") || normalized.includes("/rss")) {
      const check = await isValidFeed(normalized);
      if (check) return { site_url: extractBaseUrl(normalized), candidates: [check] };
    }
  }

  // 2. Recherche par nom dans la base de données intégrée (Performance maximale)
  const lookupKey = normalizeForLookup(siteName);
  if (DIRECT_RSS_MAPPING[lookupKey]) {
    const match = DIRECT_RSS_MAPPING[lookupKey];
    return {
      site_url: match.site_url,
      candidates: match.feeds
    };
  }

  // 3. FALLBACK : Recherche approfondie par scraping (uniquement si inconnu)
  console.log(`[RSS DETECTOR] Cache-miss pour "${siteName}". Lancement de la détection réseau...`);
  
  let targetUrls = urlHint ? [normalizeUrl(urlHint)] : nameToCandidateUrls(siteName);
  const site = await fetchSiteHtml(targetUrls);

  if (!site) {
    throw new Error(`Impossible de localiser ou joindre "${siteName}". Veuillez fournir une URL précise.`);
  }

  const baseUrl  = extractBaseUrl(site.resolvedUrl);
  const fromHtml = extractRSSLinksFromHtml(site.html, baseUrl);
  const toProbe  = fromHtml.length > 0
      ? fromHtml.map((c) => c.url)
      : RSS_COMMON_PATHS.map((p) => `${baseUrl}${p}`);

  const confirmed = await probeFeeds(toProbe);
  return { site_url: site.resolvedUrl, candidates: confirmed };
}

module.exports = { detectRSSFeeds };
