// Extraction de l'image d'infobox depuis la réponse de l'API REST
// https://<lang>.wikipedia.org/api/rest_v1/page/summary/<title>.

// Les logos sont affichés en petit (badge ~25-80pt) dans l'app : une vignette
// Wikimedia suffit largement, pas besoin de l'image originale (souvent >1000px).
const TARGET_WIDTH_PX = 240;

// Les URLs de miniatures Wikimedia encodent la largeur dans le chemin, par ex.
// .../thumb/a/ab/Name.svg/960px-Name.svg.png -> on peut demander une largeur
// plus petite en remplaçant ce segment, le service de thumbnails la génère à la volée.
function resizedThumbnail(url, targetWidth) {
  const match = url.match(/\/(\d+)px-([^/]+)$/);
  if (!match) return url;
  const currentWidth = Number(match[1]);
  if (!Number.isFinite(currentWidth) || currentWidth <= targetWidth) return url;
  return url.replace(/\/\d+px-/, `/${targetWidth}px-`);
}

export function summaryImageURL(summary) {
  if (!summary || summary.type === "disambiguation") return null;
  const image = summary.thumbnail ?? summary.originalimage;
  const source = typeof image?.source === "string" ? image.source : null;
  return source ? resizedThumbnail(source, TARGET_WIDTH_PX) : null;
}
