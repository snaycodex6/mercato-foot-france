// Recherche ciblée par club/compétition/nation via l'API de recherche
// documentée de GDELT (DOC 2.0, api.gdeltproject.org) — distincte du flux
// d'échantillons GDELT ngrams déjà utilisé pour la découverte en continu.
// Sert à garantir une couverture même pour un club à faible trafic (ex:
// Auxerre) qui n'apparaît que rarement dans un échantillon aléatoire.
//
// GDELT documente et autorise explicitement cet usage (contrairement au flux
// RSS de Google Actualités, qui interdit tout usage hors lecteur personnel).
// Il demande cependant de limiter les requêtes à une toutes les 5 secondes et
// recommande le jeu de données ngrams pour un usage à fort volume — cette
// recherche par sujet n'est donc lancée qu'une fois par heure, pas à chaque
// cycle, voir updateFeed() dans fetch-feed.mjs.

import { topicGatePhrases } from "./domain-data.mjs";
import { mapArticle } from "./scoring.mjs";

const docSearchURL = "https://api.gdeltproject.org/api/v2/doc/doc";
const requestDelayMs = 8_000;
const maximumRecordsPerTopic = 10;

function sleep(ms) {
  return new Promise((doneWaiting) => setTimeout(doneWaiting, ms));
}

export function buildTopicSearchURL(phrase) {
  const term = phrase.includes(" ") ? `"${phrase}"` : phrase;
  const url = new URL(docSearchURL);
  url.searchParams.set("query", `${term} football`);
  url.searchParams.set("mode", "artlist");
  url.searchParams.set("maxrecords", String(maximumRecordsPerTopic));
  url.searchParams.set("format", "json");
  url.searchParams.set("sort", "datedesc");
  url.searchParams.set("sourcelang", "french");
  url.searchParams.set("timespan", "7d");
  return url;
}

export function isoDateFromSeenDate(value) {
  const match = /^(\d{4})(\d{2})(\d{2})T(\d{2})(\d{2})(\d{2})Z$/.exec(value ?? "");
  if (!match) return new Date().toISOString();
  const [, year, month, day, hour, minute, second] = match;
  return `${year}-${month}-${day}T${hour}:${minute}:${second}.000Z`;
}

async function searchTopic(phrase) {
  const response = await fetch(buildTopicSearchURL(phrase), {
    headers: { "user-agent": "MercatoFootFranceFeed/1.0" },
    signal: AbortSignal.timeout(15_000),
  });
  if (response.status === 429 || !response.ok) return null;
  const data = await response.json().catch(() => null);
  return Array.isArray(data?.articles) ? data.articles : null;
}

export async function collectTopicArticles(phrases = topicGatePhrases) {
  const collected = [];
  for (const phrase of phrases) {
    try {
      const articles = await searchTopic(phrase);
      if (articles === null) {
        console.warn(`${phrase} : recherche GDELT ignorée (indisponible ou limite de requêtes)`);
      } else {
        for (const item of articles) {
          const mapped = mapArticle({
            title: item.title,
            url: item.url,
            img: item.socialimage,
            date: isoDateFromSeenDate(item.seendate),
          });
          if (mapped) collected.push(mapped);
        }
      }
    } catch (error) {
      console.warn(`${phrase} ignoré : ${error.message}`);
    }
    await sleep(requestDelayMs);
  }
  return collected;
}
