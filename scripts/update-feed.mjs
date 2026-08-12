import { createHash } from "node:crypto";
import { mkdir, readFile, writeFile } from "node:fs/promises";
import { dirname, resolve } from "node:path";
import { fileURLToPath } from "node:url";

const scriptDirectory = dirname(fileURLToPath(import.meta.url));
const outputPath = resolve(scriptDirectory, "../feed.json");
const endpoint = new URL("https://api.gdeltproject.org/api/v2/doc/doc");
endpoint.search = new URLSearchParams({
  query: '(football OR soccer OR mercato OR transfert OR "Ligue 1") sourcelang:french',
  mode: "artlist",
  maxrecords: "100",
  format: "json",
  sort: "datedesc",
  timespan: "7d",
}).toString();

const footballPattern = /\b(football|foot\b|soccer|mercato|transferts?|ligue 1|ligue des champions|champions league|psg|paris saint-germain|olympique|marseille|lyon|monaco|lille|lens|rennes|bar[çc]a|real madrid|arsenal|liverpool|chelsea|juventus|bayern)\b/i;
const excludedPattern = /\b(euromillions?|keno|loto|fdj|paris sportifs?|casino|jackpot|tirage gagnant|guide achat|code promo|streaming gratuit|marijuana|cocaïne|drogues?)\b/i;
const excludedURLPattern = /\/(guide-achat|bons-plans|pronostics?|paris-sportifs?)\//i;
const rumorPattern = /\b(rumeurs?|gossip|pourrait|piste|vise|cible|intérêt|proche de|pressenti)\b/i;
const transferPattern = /\b(transferts?|mercato|signe|signé|prêt|recrue|quitte|accord|engage|officialise|officiel)\b|s[’']offre/i;
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
  const match = /^(\d{4})(\d{2})(\d{2})T(\d{2})(\d{2})(\d{2})Z$/.exec(value ?? "");
  if (!match) return new Date().toISOString();
  const [, year, month, day, hour, minute, second] = match;
  return `${year}-${month}-${day}T${hour}:${minute}:${second}.000Z`;
}

function mapArticle(item) {
  const title = cleanText(item.title);
  const domain = String(item.domain ?? "").toLowerCase().replace(/^www\./, "").trim();
  let url;
  try {
    url = new URL(item.url);
  } catch {
    return null;
  }
  if (!title || !domain || url.protocol !== "https:" || !footballPattern.test(title) || excludedPattern.test(title) || excludedURLPattern.test(url.pathname)) {
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
    publishedAt: dateFromGDELT(item.seendate),
    category,
    source: { id: domain, name: domain, websiteURL: `https://${domain}` },
    teams,
    reliability,
  };
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
  const response = await fetch(endpoint, {
    headers: { accept: "application/json", "user-agent": "MercatoFootFranceFeed/1.0" },
    signal: AbortSignal.timeout(25_000),
  });
  if (!response.ok) throw new Error(`GDELT HTTP ${response.status}`);
  const document = await response.json();
  const seen = new Set();
  const items = (document.articles ?? [])
    .map(mapArticle)
    .filter(Boolean)
    .filter((article) => !seen.has(article.url) && seen.add(article.url))
    .sort((left, right) => right.publishedAt.localeCompare(left.publishedAt));
  if (items.length < 5) throw new Error(`Flux trop court (${items.length} résultats)`);

  await mkdir(dirname(outputPath), { recursive: true });
  await writeFile(outputPath, `${JSON.stringify({ items, generatedAt: new Date().toISOString(), stale: false }, null, 2)}\n`);
  console.log(`${items.length} publications écrites dans ${outputPath}`);
} catch (error) {
  await keepExistingFeed(error);
}
