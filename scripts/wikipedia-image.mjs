// Extraction de l'image d'infobox depuis la réponse de l'API REST
// https://<lang>.wikipedia.org/api/rest_v1/page/summary/<title>.

export function summaryImageURL(summary) {
  if (!summary || summary.type === "disambiguation") return null;
  const image = summary.originalimage ?? summary.thumbnail;
  return typeof image?.source === "string" ? image.source : null;
}
