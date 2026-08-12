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

const footballPattern = /\b(football|foot|soccer|mercato|transferts?|ligue 1|ligue des champions|champions league|fegafoot|psg|paris saint-germain|olympique|montpellier fc|bar[çc]a|barcelone|real madrid|arsenal|liverpool|chelsea|juventus|bayern|manchester city|manchester united|fenerbah[çc]e)\b/i;
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
  ["real-madrid", ["real madrid"]],
  ["barcelona", ["fc barcelone", "barcelone", "barça"]],
  ["man-city", ["manchester city", "man city"]],
  ["man-united", ["manchester united", "man united"]],
  ["liverpool", ["liverpool"]],
  ["arsenal", ["arsenal"]],
  ["bayern", ["bayern munich"]],
  ["juventus", ["juventus", "juve"]],
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

function mapArticle(item) {
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
  const id = createHash("sha256").update(url.href).digest("hex").slice(0, 24);

  return {
    id: `gdelt-${id}`,
    title,
    summary: `Publication référencée chez ${domain}. Mercato Foot France n’en reproduit ni l’article ni les médias.`,
    url: url.href,
    imageURL: null,
    publishedAt: dateFromGDELT(item.date),
    category,
    source: { id: domain, name: domain, websiteURL: `https://${domain}` },
    teams,
    reliability,
  };
}

function datasetStamp(date) {
  const compact = date.toISOString().replace(/\D/g, "");
  return `${compact.slice(0, 12)}00`;
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

try {
  const [recent, previous] = await Promise.all([collectRecentArticles(), existingItems()]);
  const seen = new Set();
  const seenTitles = new Set();
  const oldestAllowed = Date.now() - 7 * 86_400_000;
  const items = [...recent, ...previous]
    .filter((article) => isFootballTitle(article.title) && !excludedPattern.test(article.title))
    .filter((article) => !seen.has(article.url) && seen.add(article.url))
    .filter((article) => {
      const normalizedTitle = article.title.toLocaleLowerCase("fr").replace(/[^\p{L}\p{N}]+/gu, " ").trim();
      return !seenTitles.has(normalizedTitle) && seenTitles.add(normalizedTitle);
    })
    .filter((article) => new Date(article.publishedAt).getTime() >= oldestAllowed)
    .sort((left, right) => right.publishedAt.localeCompare(left.publishedAt))
    .slice(0, maximumItems);
  if (items.length < 5) throw new Error(`Flux trop court (${items.length} résultats)`);

  await mkdir(dirname(outputPath), { recursive: true });
  await writeFile(outputPath, `${JSON.stringify({ items, generatedAt: new Date().toISOString(), stale: false }, null, 2)}\n`);
  console.log(`${recent.length} nouvelles publications détectées, ${items.length} conservées`);
} catch (error) {
  await keepExistingFeed(error);
}
