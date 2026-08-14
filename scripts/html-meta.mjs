export function metaContent(html, acceptedKeys) {
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
