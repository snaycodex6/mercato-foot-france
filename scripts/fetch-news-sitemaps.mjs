// Certains médias publient un sitemap d'actualités public (format standard
// Google News : <loc>, <news:title>, <news:publication_date>, parfois
// <image:image>) qui ne contient que des métadonnées — jamais le corps d'un
// article. On le lit à chaque rafraîchissement du fil pour repérer les
// nouvelles publications, exactement comme un moteur de recherche indexerait
// ce sitemap. Chaque source ci-dessous a été vérifiée manuellement :
// robots.txt public qui n'exclut pas les robots génériques, sitemap
// d'actualités accessible, contenu en français (l'app est en français).
export const newsSitemapSources = [
  { name: "Foot National", url: "https://www.foot-national.com/sitemap/footnational/article-news.xml" },
  { name: "Foot Mercato", url: "https://www.footmercato.net/sitemap-news.xml" },
  { name: "Eurosport", url: "https://www.eurosport.fr/sitemaps/news/sitemap-news-recent.xml" },
  { name: "Onze Mondial", url: "https://www.onzemondial.com/sitemap/onze/article-news.xml" },
  { name: "Made in Foot", url: "https://madeinfoot.ouest-france.fr/sitemaps-news.xml" },
  { name: "Le Phocéen", url: "https://www.lephoceen.fr/sitemaps/google-news.xml" },
];

// D'autres sites (souvent des blogs WordPress dédiés à un club) n'exposent
// pas de sitemap d'actus exploitable — leur sitemap classique Yoast/AIOSEO ne
// contient ni titre ni ordre chronologique fiable. Ils publient en revanche
// tous un flux RSS standard WordPress (titre, lien, date déjà inclus), qui
// est justement fait pour ça : on le lit comme n'importe quel lecteur RSS.
export const wordpressFeedSources = [
  { name: "Real France", url: "https://real-france.fr/feed/" },
  { name: "Mercato Foot Anglais", url: "https://mercatofootanglais.com/feed/" },
  { name: "Paris Fans", url: "https://www.parisfans.fr/feed/" },
  { name: "Allez Paillade", url: "https://www.allezpaillade.com/feed/" },
  { name: "Esprit Gones", url: "https://espritgones.fr/feed/" },
];

const userAgent = "MercatoFootFranceFeed/1.1 (+https://snaycodex6.github.io/mercato-foot-france/sources/)";

const namedEntities = {
  amp: "&", lt: "<", gt: ">", quot: '"', apos: "'", nbsp: " ",
};

function decodeEntities(value) {
  return value
    .replace(/&#(\d+);/g, (_, code) => String.fromCodePoint(Number(code)))
    .replace(/&#x([0-9a-f]+);/gi, (_, code) => String.fromCodePoint(parseInt(code, 16)))
    .replace(/&(amp|lt|gt|quot|apos|nbsp);/g, (_, name) => namedEntities[name]);
}

function stripCDATA(value) {
  return value?.replace(/^<!\[CDATA\[/, "").replace(/\]\]>$/, "").trim() ?? null;
}

async function fetchXML(url) {
  const response = await fetch(url, {
    headers: { "user-agent": userAgent, accept: "application/xml" },
    signal: AbortSignal.timeout(15_000),
  });
  if (!response.ok) throw new Error(`HTTP ${response.status}`);
  return response.text();
}

function parseNewsSitemap(xml) {
  const records = [];
  const urlBlocks = xml.match(/<url>[\s\S]*?<\/url>/g) ?? [];
  for (const block of urlBlocks) {
    const loc = block.match(/<loc>([^<]+)<\/loc>/)?.[1]?.trim();
    const titleRaw = block.match(/<news:title>(?:<!\[CDATA\[)?([\s\S]*?)(?:\]\]>)?<\/news:title>/)?.[1]?.trim();
    const date = block.match(/<news:publication_date>([^<]+)<\/news:publication_date>/)?.[1]?.trim();
    const img = block.match(/<image:loc>([^<]+)<\/image:loc>/)?.[1]?.trim() ?? null;
    if (!loc || !titleRaw || !date) continue;
    records.push({ title: decodeEntities(titleRaw), url: loc, img, date, lang: "fr" });
  }
  return records;
}

function parseRSS(xml) {
  const records = [];
  const itemBlocks = xml.match(/<item>[\s\S]*?<\/item>/g) ?? [];
  for (const block of itemBlocks) {
    const titleRaw = stripCDATA(block.match(/<title>([\s\S]*?)<\/title>/)?.[1]);
    const link = block.match(/<link>([\s\S]*?)<\/link>/)?.[1]?.trim();
    const pubDate = block.match(/<pubDate>([\s\S]*?)<\/pubDate>/)?.[1]?.trim();
    if (!titleRaw || !link || !pubDate) continue;
    const date = new Date(pubDate);
    if (Number.isNaN(date.getTime())) continue;
    const description = block.match(/<description>([\s\S]*?)<\/description>/)?.[1]
      ?? block.match(/<content:encoded>([\s\S]*?)<\/content:encoded>/)?.[1]
      ?? "";
    const img = description.match(/<img[^>]+src=["']([^"']+)["']/)?.[1] ?? null;
    records.push({ title: decodeEntities(titleRaw), url: link, img, date: date.toISOString(), lang: "fr" });
  }
  return records;
}

async function fetchOneNewsSitemap({ name, url }) {
  try {
    return parseNewsSitemap(await fetchXML(url));
  } catch (error) {
    console.warn(`${name} ignoré : ${error.message}`);
    return [];
  }
}

async function fetchOneWordPressFeed({ name, url }) {
  try {
    return parseRSS(await fetchXML(url));
  } catch (error) {
    console.warn(`${name} ignoré : ${error.message}`);
    return [];
  }
}

export async function fetchNewsSitemapArticles(
  sources = newsSitemapSources,
  feedSources = wordpressFeedSources,
) {
  const [fromNewsSitemaps, fromFeeds] = await Promise.all([
    Promise.all(sources.map(fetchOneNewsSitemap)),
    Promise.all(feedSources.map(fetchOneWordPressFeed)),
  ]);
  return [...fromNewsSitemaps.flat(), ...fromFeeds.flat()];
}
