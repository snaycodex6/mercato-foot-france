import { createHash } from "node:crypto";
import { mkdir, readFile, writeFile } from "node:fs/promises";
import { dirname, resolve } from "node:path";
import { fileURLToPath } from "node:url";
import { gunzipSync } from "node:zlib";

const scriptDirectory = dirname(fileURLToPath(import.meta.url));
const outputPath = resolve(scriptDirectory, "../feed.json");
const datasetBaseURL = "https://storage.googleapis.com/data.gdeltproject.org/gdeltv5/weblegacy/ngrams";
const lookbackMinutes = 90;
const maximumItems = 100;
const maximumArticleAgeMs = 4 * 86_400_000;

const officialSourceDomains = [
  "fff.fr", "fifa.com", "uefa.com", "ligue1.fr", "lfp.fr",
  "psg.fr", "om.fr", "ol.fr", "asmonaco.com", "losc.fr", "rclens.fr",
  "realmadrid.com", "fcbarcelona.com", "mancity.com", "manutd.com", "liverpoolfc.com",
  "arsenal.com", "chelseafc.com", "fcbayern.com", "bvb.de", "juventus.com", "inter.it", "acmilan.com",
];
const recognizedSourceDomains = [
  "lequipe.fr", "rmcsport.bfmtv.com", "eurosport.fr", "franceinfo.fr", "francetvinfo.fr",
  "lemonde.fr", "lefigaro.fr", "ouest-france.fr", "20minutes.fr", "footmercato.net",
  "sofoot.com", "goal.com", "beinsports.com", "francebleu.fr", "radiofrance.fr",
];
const suspiciousImagePattern = /(logo|favicon|avatar|author|profile|placeholder|default|fallback|sprite|blank|transparent|tracking[_-]?pixel)/i;
const titleStopWords = new Set([
  "a", "au", "aux", "avec", "ce", "ces", "dans", "de", "des", "du", "elle", "en", "et",
  "est", "il", "la", "le", "les", "mais", "ne", "ou", "par", "pas", "pour", "que", "qui",
  "se", "son", "sur", "un", "une", "vers", "mercato", "football", "foot", "transfert", "transferts",
]);

const footballPattern = /\b(football|foot|soccer|mercato|transferts?|ligue [12]|ligue des champions|champions league|premier league|la ?liga|serie a|bundesliga|europa league|ligue europa|conference league|coupe du monde|mondial des clubs|euro 20\d{2}|can 20\d{2}|fegafoot|psg|paris saint-germain|olympique|montpellier fc|bar[çc]a|barcelone|real madrid|arsenal|liverpool|chelsea|juventus|bayern|manchester city|manchester united|fenerbah[çc]e)\b/i;
const clubAcronymPattern = /(?:^|[^\p{L}\p{N}])(OM|OL)(?=$|[^\p{L}\p{N}])/u;
const excludedPattern = /\b(euromillions?|keno|loto|fdj|paris sportifs?|casino|jackpot|tirage gagnant|guide achat|code promo|streaming gratuit|marijuana|cocaïne|drogues?)\b/i;
const excludedURLPattern = /\/(guide-achat|bons-plans|pronostics?|paris-sportifs?)\//i;
const rumorPattern = /\b(rumeurs?|gossip|pourrait|piste|vise|cible|intérêt|proche de|pressenti|vers (un|le) départ)\b/i;
const transferPattern = /\b(transferts?|mercato|signe|signé|prêt|recrue|recrute|rejoint|quitte|départ|accord|engage|officialise|officiel)\b|s[’']offre/i;
const officialPattern = /\b(officiel|officialisé|confirmé|a signé|annonce|communiqué)\b/i;

const teamAliases = [
  ["psg", ["psg", "paris saint-germain"]],
  ["om", ["olympique de marseille", "marseille"]],
  ["ol", ["olympique lyonnais", "lyon"]],
  ["monaco", ["as monaco", "monaco"]],
  ["lille", ["losc", "lille"]],
  ["lens", ["rc lens", "lens"]],
  ["rennes", ["stade rennais", "rennes"]],
  ["nice", ["ogc nice", "nice"]],
  ["nantes", ["fc nantes", "nantes"]],
  ["strasbourg", ["rc strasbourg", "strasbourg"]],
  ["brest", ["stade brestois", "brest"]],
  ["auxerre", ["aj auxerre", "auxerre"]],
  ["real-madrid", ["real madrid"]],
  ["barcelona", ["fc barcelone", "barcelone", "barça"]],
  ["atletico", ["atlético de madrid", "atletico madrid"]],
  ["man-city", ["manchester city", "man city"]],
  ["man-united", ["manchester united", "man united"]],
  ["liverpool", ["liverpool"]],
  ["arsenal", ["arsenal"]],
  ["chelsea", ["chelsea"]],
  ["tottenham", ["tottenham", "spurs"]],
  ["newcastle", ["newcastle"]],
  ["bayern", ["bayern munich"]],
  ["dortmund", ["borussia dortmund", "dortmund"]],
  ["leverkusen", ["bayer leverkusen", "leverkusen"]],
  ["juventus", ["juventus", "juve"]],
  ["inter", ["inter milan", "internazionale"]],
  ["ac-milan", ["ac milan"]],
  ["napoli", ["naples", "napoli"]],
  ["roma", ["as roma", "roma"]],
  ["benfica", ["benfica"]],
  ["porto", ["fc porto", "porto"]],
  ["sporting", ["sporting cp", "sporting portugal"]],
  ["ajax", ["ajax amsterdam", "ajax"]],
  ["feyenoord", ["feyenoord"]],
  ["psv", ["psv eindhoven", "psv"]],
  ["galatasaray", ["galatasaray"]],
  ["fenerbahce", ["fenerbahçe", "fenerbahce"]],
  ["al-hilal", ["al-hilal", "al hilal"]],
  ["inter-miami", ["inter miami"]],
];

const competitionAliases = [
  ["ligue-1", ["ligue 1"]],
  ["ligue-2", ["ligue 2"]],
  ["premier-league", ["premier league"]],
  ["la-liga", ["laliga", "la liga"]],
  ["serie-a", ["serie a"]],
  ["bundesliga", ["bundesliga"]],
  ["liga-portugal", ["liga portugal"]],
  ["eredivisie", ["eredivisie"]],
  ["champions-league", ["ligue des champions", "champions league"]],
  ["europa-league", ["ligue europa", "europa league"]],
  ["conference-league", ["ligue conférence", "conference league"]],
  ["club-world-cup", ["mondial des clubs", "coupe du monde des clubs"]],
];

const nationAliases = [
  ["france", ["équipe de france", "bleus", "les bleues"]],
  ["belgium", ["équipe de belgique", "diables rouges"]],
  ["switzerland", ["équipe de suisse", "nati"]],
  ["morocco", ["équipe du maroc", "lions de l'atlas"]],
  ["algeria", ["équipe d'algérie", "fennecs"]],
  ["senegal", ["équipe du sénégal", "lions de la teranga"]],
  ["ivory-coast", ["équipe de côte d'ivoire", "éléphants"]],
  ["cameroon", ["équipe du cameroun", "lions indomptables"]],
  ["england", ["équipe d'angleterre", "three lions"]],
  ["spain", ["équipe d'espagne", "la roja"]],
  ["italy", ["équipe d'italie", "squadra azzurra"]],
  ["germany", ["équipe d'allemagne", "mannschaft"]],
  ["portugal", ["équipe du portugal", "seleção portugaise"]],
  ["netherlands", ["équipe des pays-bas", "oranje"]],
  ["brazil", ["équipe du brésil", "seleção brésilienne"]],
  ["argentina", ["équipe d'argentine", "albiceleste"]],
  ["uruguay", ["équipe d'uruguay", "celeste"]],
  ["usa", ["équipe des états-unis", "team usa"]],
  ["japan", ["équipe du japon", "samurai blue"]],
  ["south-korea", ["équipe de corée du sud"]],
];

function cleanText(value, maximum = 220) {
  const clean = String(value ?? "")
    .replace(/<[^>]+>/g, " ")
    .replace(/&amp;/g, "&")
    .replace(/&quot;/g, '"')
    .replace(/&#39;|&apos;/g, "'")
    .replace(/&nbsp;/g, " ")
    .replace(/\s+/g, " ")
    .trim();
  return clean.length <= maximum ? clean : `${clean.slice(0, maximum - 1).trim()}…`;
}

function dateFromGDELT(value) {
  const parsed = new Date(value ?? "");
  return Number.isNaN(parsed.getTime()) ? new Date().toISOString() : parsed.toISOString();
}

function isFootballTitle(title) {
  return footballPattern.test(title) || clubAcronymPattern.test(title);
}

function domainMatches(domain, candidates) {
  return candidates.some((candidate) => domain === candidate || domain.endsWith(`.${candidate}`));
}

export function sourceTier(domain) {
  if (domainMatches(domain, officialSourceDomains)) return "official";
  if (domainMatches(domain, recognizedSourceDomains)) return "recognized";
  return "other";
}

export function acceptableImageURL(value, baseURL) {
  try {
    const image = new URL(value, baseURL);
    if (image.protocol !== "https:" || suspiciousImagePattern.test(`${image.pathname}${image.search}`)) return null;
    const width = Number(image.searchParams.get("w") ?? image.searchParams.get("width"));
    const height = Number(image.searchParams.get("h") ?? image.searchParams.get("height"));
    if ((Number.isFinite(width) && width > 0 && width < 300) || (Number.isFinite(height) && height > 0 && height < 180)) return null;
    return image.href;
  } catch {
    return null;
  }
}

export function canonicalTitle(value) {
  return cleanText(value, 400)
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "")
    .toLocaleLowerCase("fr")
    .replace(/[^\p{L}\p{N}]+/gu, " ")
    .trim();
}

function titleTokens(title) {
  return new Set(canonicalTitle(title).split(" ").filter((token) => token.length > 2 && !titleStopWords.has(token)));
}

export function titlesAreSimilar(left, right) {
  const canonicalLeft = canonicalTitle(left);
  const canonicalRight = canonicalTitle(right);
  if (!canonicalLeft || !canonicalRight) return false;
  if (canonicalLeft === canonicalRight) return true;
  const leftTokens = titleTokens(left);
  const rightTokens = titleTokens(right);
  if (leftTokens.size < 3 || rightTokens.size < 3) return false;
  const common = [...leftTokens].filter((token) => rightTokens.has(token)).length;
  const union = new Set([...leftTokens, ...rightTokens]).size;
  const smaller = Math.min(leftTokens.size, rightTokens.size);
  return common / union >= 0.68 || (common / smaller >= 0.82 && common >= 4);
}

export function mapArticle(item) {
  const title = cleanText(item.title);
  let url;
  try {
    url = new URL(item.url);
  } catch {
    return null;
  }
  const domain = url.hostname.toLowerCase().replace(/^www\./, "").trim();
  if (!title || !domain || url.protocol !== "https:" || !isFootballTitle(title) || excludedPattern.test(title) || excludedURLPattern.test(url.pathname)) {
    return null;
  }

  const category = rumorPattern.test(title) ? "rumors" : transferPattern.test(title) ? "transfers" : "news";
  const reliability = category === "rumors" ? "rumor" : officialPattern.test(title) ? "confirmed" : "reported";
  const normalized = title.toLowerCase();
  const teams = teamAliases.flatMap(([id, aliases]) => aliases.some((alias) => normalized.includes(alias)) ? [id] : []);
  const competitions = competitionAliases.flatMap(([id, aliases]) => aliases.some((alias) => normalized.includes(alias)) ? [id] : []);
  const nations = nationAliases.flatMap(([id, aliases]) => aliases.some((alias) => normalized.includes(alias)) ? [id] : []);
  const topics = [...new Set([...teams, ...competitions, ...nations])];
  const imageURL = acceptableImageURL(item.img);
  const id = createHash("sha256").update(url.href).digest("hex").slice(0, 24);

  return {
    id: `gdelt-${id}`,
    title,
    summary: `Publication référencée chez ${domain}. Mercato Foot France ne reproduit pas le texte et renvoie vers la page originale.`,
    url: url.href,
    imageURL,
    publishedAt: dateFromGDELT(item.date),
    category,
    source: { id: domain, name: domain, websiteURL: `https://${domain}` },
    teams,
    topics,
    reliability,
    sourceTier: sourceTier(domain),
  };
}

export function qualityScore(article, now = Date.now()) {
  const published = new Date(article.publishedAt).getTime();
  const ageHours = Math.max(0, (now - published) / 3_600_000);
  const freshness = Math.max(0, 48 - Math.min(ageHours, 96) * 0.5);
  const source = article.sourceTier === "official" ? 28 : article.sourceTier === "recognized" ? 18 : 7;
  const relevance = Math.min(16, (article.topics?.length ?? article.teams?.length ?? 0) * 4)
    + (article.category === "transfers" ? 8 : article.category === "rumors" ? 3 : 5);
  const reliability = article.reliability === "confirmed" ? 8 : article.reliability === "rumor" ? -4 : 2;
  // Une carte principale avec photo est nettement plus utile qu'un visuel de
  // secours, sans toutefois permettre à une source faible de dépasser une
  // publication officielle à pertinence comparable.
  const image = article.imageURL ? 12 : 0;
  return Math.round((freshness + source + relevance + reliability + image) * 10) / 10;
}

export function rankAndDeduplicate(articles, now = Date.now(), maximum = maximumItems) {
  const oldestAllowed = now - maximumArticleAgeMs;
  const scored = articles
    .filter((article) => article?.title && article?.url && isFootballTitle(article.title) && !excludedPattern.test(article.title))
    .filter((article) => {
      const published = new Date(article.publishedAt).getTime();
      return Number.isFinite(published) && published >= oldestAllowed && published <= now + 15 * 60_000;
    })
    .map((article) => {
      const domain = article.source?.id ?? (() => {
        try { return new URL(article.url).hostname.replace(/^www\./, ""); } catch { return ""; }
      })();
      const enriched = { ...article, sourceTier: article.sourceTier ?? sourceTier(domain) };
      return { ...enriched, qualityScore: qualityScore(enriched, now) };
    })
    .sort((left, right) => right.qualityScore - left.qualityScore || right.publishedAt.localeCompare(left.publishedAt));

  const selected = [];
  const seenURLs = new Set();
  for (const article of scored) {
    const normalizedURL = article.url.replace(/[?#].*$/, "").replace(/\/$/, "");
    if (seenURLs.has(normalizedURL) || selected.some((candidate) => titlesAreSimilar(candidate.title, article.title))) continue;
    seenURLs.add(normalizedURL);
    selected.push(article);
    if (selected.length >= maximum) break;
  }
  return selected;
}

function datasetStamp(date) {
  const compact = date.toISOString().replace(/\D/g, "");
  return `${compact.slice(0, 12)}00`;
}

function metaContent(html, acceptedKeys) {
  const tags = html.match(/<meta\b[^>]*>/gi) ?? [];
  for (const tag of tags) {
    const attributes = Object.fromEntries(
      [...tag.matchAll(/([:\w-]+)\s*=\s*(["'])(.*?)\2/gis)]
        .map((match) => [match[1].toLowerCase(), match[3].replace(/&amp;/g, "&")]),
    );
    const key = String(attributes.property ?? attributes.name ?? "").toLowerCase();
    if (acceptedKeys.includes(key) && attributes.content) return attributes.content.trim();
  }
  return null;
}

async function enrichImage(article) {
  const existingImage = acceptableImageURL(article.imageURL);
  if (existingImage) return { ...article, imageURL: existingImage };
  try {
    const response = await fetch(article.url, {
      headers: {
        accept: "text/html,application/xhtml+xml",
        "user-agent": "MercatoFootFranceFeed/1.1 (+https://snaycodex6.github.io/mercato-foot-france/sources/)",
      },
      redirect: "follow",
      signal: AbortSignal.timeout(12_000),
    });
    const contentType = response.headers.get("content-type") ?? "";
    if (!response.ok || !contentType.includes("text/html")) return article;
    const html = await response.text();
    const declaredImage = metaContent(html, ["og:image:secure_url", "og:image", "twitter:image", "twitter:image:src"]);
    if (!declaredImage) return article;
    const imageURL = acceptableImageURL(declaredImage, response.url);
    if (!imageURL) return { ...article, imageURL: null };
    return { ...article, imageURL };
  } catch {
    return article;
  }
}

async function enrichImages(articles, concurrency = 5) {
  const enriched = new Array(articles.length);
  let cursor = 0;
  async function worker() {
    while (cursor < articles.length) {
      const index = cursor++;
      enriched[index] = await enrichImage(articles[index]);
    }
  }
  await Promise.all(Array.from({ length: Math.min(concurrency, articles.length) }, worker));
  return enriched;
}

async function fetchMinute(stamp) {
  const url = `${datasetBaseURL}/${stamp}.toc.json.gz`;
  const head = await fetch(url, {
    method: "HEAD",
    headers: { "user-agent": "MercatoFootFranceFeed/1.0" },
    signal: AbortSignal.timeout(10_000),
  });
  if (head.status === 404) return null;
  if (!head.ok) throw new Error(`GDELT dataset HTTP ${head.status}`);

  const response = await fetch(url, {
    headers: { "user-agent": "MercatoFootFranceFeed/1.0" },
    signal: AbortSignal.timeout(20_000),
  });
  if (!response.ok) throw new Error(`GDELT dataset HTTP ${response.status}`);
  const text = gunzipSync(Buffer.from(await response.arrayBuffer())).toString("utf8");
  return text
    .split("\n")
    .filter(Boolean)
    .map((line) => JSON.parse(line))
    .filter((item) => item.lang === "fr");
}

async function collectRecentArticles() {
  const now = Date.now();
  const records = [];
  let availableFiles = 0;

  for (let offset = 5; offset < lookbackMinutes + 5; offset += 1) {
    const stamp = datasetStamp(new Date(now - offset * 60_000));
    try {
      const minuteRecords = await fetchMinute(stamp);
      if (minuteRecords !== null) {
        availableFiles += 1;
        records.push(...minuteRecords);
        if (availableFiles >= 5) break;
      }
    } catch (error) {
      console.warn(`${stamp} ignoré : ${error.message}`);
    }
  }

  if (availableFiles === 0) throw new Error("aucun catalogue GDELT récent disponible");
  return records.map(mapArticle).filter(Boolean);
}

async function existingItems() {
  try {
    const current = JSON.parse(await readFile(outputPath, "utf8"));
    return Array.isArray(current.items) ? current.items : [];
  } catch {
    return [];
  }
}

async function keepExistingFeed(error) {
  try {
    const current = JSON.parse(await readFile(outputPath, "utf8"));
    if (Array.isArray(current.items) && current.items.length > 0) {
      console.warn(`Mise à jour différée, dernier flux conservé : ${error.message}`);
      return;
    }
  } catch {
    // No usable fallback exists yet.
  }
  throw error;
}

export async function updateFeed() {
  try {
    const [recent, previous] = await Promise.all([collectRecentArticles(), existingItems()]);
    const items = rankAndDeduplicate([...recent, ...previous]);
    if (items.length < 5) throw new Error(`Flux trop court (${items.length} résultats)`);

    const enrichedItems = await enrichImages(items);
    const imageCount = enrichedItems.filter((article) => article.imageURL).length;

    await mkdir(dirname(outputPath), { recursive: true });
    await writeFile(outputPath, `${JSON.stringify({ items: enrichedItems, generatedAt: new Date().toISOString(), stale: false }, null, 2)}\n`);
    console.log(`${recent.length} nouvelles publications détectées, ${items.length} conservées, ${imageCount} avec image`);
  } catch (error) {
    await keepExistingFeed(error);
  }
}

if (process.argv[1] && resolve(process.argv[1]) === fileURLToPath(import.meta.url)) {
  await updateFeed();
}
