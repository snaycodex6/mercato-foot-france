import { createHash } from "node:crypto";

import {
  clubAcronymPattern,
  competitionAliases,
  excludedPattern,
  excludedURLPattern,
  footballPattern,
  nationAliases,
  officialPattern,
  officialSourceDomains,
  recognizedSourceDomains,
  rumorPattern,
  suspiciousImagePattern,
  teamAliases,
  titleStopWords,
  topicGatePhrases,
  transferPattern,
} from "./domain-data.mjs";

const maximumItems = 100;
const maximumArticleAgeMs = 4 * 86_400_000;

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

export function isFootballTitle(title) {
  const normalized = title.toLowerCase();
  return footballPattern.test(title)
    || clubAcronymPattern.test(title)
    || topicGatePhrases.some((phrase) => normalized.includes(phrase));
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
