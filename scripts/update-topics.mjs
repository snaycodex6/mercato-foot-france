import { mkdir, readFile, writeFile } from "node:fs/promises";
import { dirname, resolve } from "node:path";
import { fileURLToPath } from "node:url";

import { topicWikipediaTitles } from "./topic-wikipedia-titles.mjs";
import { summaryImageURL } from "./wikipedia-image.mjs";

const scriptDirectory = dirname(fileURLToPath(import.meta.url));
const outputPath = resolve(scriptDirectory, "../topics.json");
const summaryBaseURL = "https://fr.wikipedia.org/api/rest_v1/page/summary/";
const userAgent = "MercatoFootFranceTopics/1.0 (+https://snaycodex6.github.io/mercato-foot-france/sources/)";
const requestDelayMs = 300;

function sleep(ms) {
  return new Promise((doneWaiting) => setTimeout(doneWaiting, ms));
}

async function fetchSummary(title, retries = 4) {
  const url = summaryBaseURL + encodeURIComponent(title.replaceAll(" ", "_"));
  for (let attempt = 0; attempt < retries; attempt += 1) {
    const response = await fetch(url, {
      headers: { "user-agent": userAgent, accept: "application/json" },
      signal: AbortSignal.timeout(10_000),
    });
    if (response.status === 429 || response.status === 503) {
      await sleep(1_000 * (attempt + 1));
      continue;
    }
    if (!response.ok) return null;
    return response.json();
  }
  return null;
}

async function existingImages() {
  try {
    const current = JSON.parse(await readFile(outputPath, "utf8"));
    return current.images && typeof current.images === "object" ? current.images : {};
  } catch {
    return {};
  }
}

export async function resolveTopicImages(previousImages = {}) {
  const images = { ...previousImages };
  const entries = Object.entries(topicWikipediaTitles);
  let resolved = 0;
  let failed = 0;

  for (const [id, title] of entries) {
    try {
      const summary = await fetchSummary(title);
      const imageURL = summaryImageURL(summary);
      if (imageURL) {
        images[id] = imageURL;
        resolved += 1;
      } else {
        failed += 1;
        console.warn(`${id} (${title}) : aucune image trouvée, valeur précédente conservée`);
      }
    } catch (error) {
      failed += 1;
      console.warn(`${id} (${title}) ignoré : ${error.message}`);
    }
    await sleep(requestDelayMs);
  }

  return { images, resolved, failed, total: entries.length };
}

export async function updateTopics() {
  const previousImages = await existingImages();
  const { images, resolved, failed, total } = await resolveTopicImages(previousImages);

  await mkdir(dirname(outputPath), { recursive: true });
  await writeFile(outputPath, `${JSON.stringify({ images, generatedAt: new Date().toISOString() }, null, 2)}\n`);
  console.log(`${resolved}/${total} logos résolus, ${failed} conservés depuis la version précédente`);
}

if (process.argv[1] && resolve(process.argv[1]) === fileURLToPath(import.meta.url)) {
  await updateTopics();
}
