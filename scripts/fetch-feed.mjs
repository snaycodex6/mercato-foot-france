import { mkdir, readFile, writeFile } from "node:fs/promises";
import { dirname, resolve } from "node:path";
import { fileURLToPath } from "node:url";
import { gunzipSync } from "node:zlib";

import { acceptableImageURL, mapArticle, rankAndDeduplicate } from "./scoring.mjs";

const scriptDirectory = dirname(fileURLToPath(import.meta.url));
const outputPath = resolve(scriptDirectory, "../feed.json");
const datasetBaseURL = "https://storage.googleapis.com/data.gdeltproject.org/gdeltv5/weblegacy/ngrams";
const lookbackMinutes = 90;

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
