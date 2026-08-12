import test from "node:test";
import assert from "node:assert/strict";

import {
  acceptableImageURL,
  canonicalTitle,
  isFootballTitle,
  mapArticle,
  qualityScore,
  rankAndDeduplicate,
  sourceTier,
  titlesAreSimilar,
} from "../scripts/scoring.mjs";

const now = new Date("2026-08-12T14:00:00.000Z").getTime();

function article(overrides = {}) {
  return {
    id: "article-1",
    title: "Mercato PSG : Paris accélère pour recruter un attaquant",
    summary: "Résumé",
    url: "https://example.com/football/psg-attaquant",
    imageURL: "https://example.com/images/psg-attaquant-1200x675.jpg",
    publishedAt: "2026-08-12T13:00:00.000Z",
    category: "transfers",
    source: { id: "example.com", name: "Example", websiteURL: "https://example.com" },
    teams: ["psg"],
    topics: ["psg", "ligue-1"],
    reliability: "reported",
    ...overrides,
  };
}

test("normalise les accents et détecte des titres sémantiquement proches", () => {
  assert.equal(canonicalTitle("  PSG : marché accéléré ! "), "psg marche accelere");
  assert.equal(
    titlesAreSimilar(
      "Mercato PSG : Paris accélère pour recruter un nouvel attaquant cet été",
      "PSG mercato - Paris accélère cet été pour recruter un nouvel attaquant",
    ),
    true,
  );
  assert.equal(
    titlesAreSimilar(
      "PSG : un attaquant attendu avant dimanche",
      "PSG : le calendrier complet de la Ligue des champions",
    ),
    false,
  );
});

test("reconnaît un club, une compétition ou une sélection sans le mot football", () => {
  assert.equal(isFootballTitle("L'AS Monaco recrute un latéral droit"), true);
  assert.equal(isFootballTitle("Naples s'impose face à l'Inter Milan"), true);
  assert.equal(isFootballTitle("L'équipe du Maroc se qualifie pour la finale"), true);
  assert.equal(isFootballTitle("Le Borussia Dortmund tenu en échec"), true);
});

test("ignore les faux positifs sur des mots trop génériques", () => {
  assert.equal(isFootballTitle("Castres Olympique bat le Racing 92 en Top 14"), false);
  assert.equal(isFootballTitle("Le champion olympique de biathlon savoure sa médaille"), false);
});

test("refuse les images non sécurisées, trop petites ou assimilables à un logo", () => {
  assert.equal(acceptableImageURL("http://media.test/photo.jpg"), null);
  assert.equal(acceptableImageURL("https://media.test/assets/club-logo.png"), null);
  assert.equal(acceptableImageURL("https://media.test/photo.jpg?width=120&height=120"), null);
  assert.equal(acceptableImageURL("https://media.test/photo.jpg?type=placeholder"), null);
  assert.equal(
    acceptableImageURL("/media/match-1200x675.jpg", "https://media.test/article"),
    "https://media.test/media/match-1200x675.jpg",
  );
});

test("classe les domaines officiels et reconnus", () => {
  assert.equal(sourceTier("news.psg.fr"), "official");
  assert.equal(sourceTier("rmcsport.bfmtv.com"), "recognized");
  assert.equal(sourceTier("blog-inconnu.example"), "other");
});

test("mappe les sujets tout en rejetant une image de remplacement", () => {
  const mapped = mapArticle({
    title: "Mercato PSG : accord officiel en Ligue 1",
    url: "https://www.psg.fr/equipes/equipe-premiere/content/accord",
    img: "https://www.psg.fr/images/default-logo.png",
    date: "2026-08-12T13:30:00Z",
  });
  assert.ok(mapped);
  assert.deepEqual(mapped.topics, ["psg", "ligue-1"]);
  assert.equal(mapped.imageURL, null);
  assert.equal(mapped.sourceTier, "official");
  assert.equal(mapped.reliability, "confirmed");
});

test("le score favorise une source officielle à fraîcheur comparable", () => {
  const unknown = article({ sourceTier: "other" });
  const official = article({ id: "official", url: "https://psg.fr/article", sourceTier: "official" });
  assert.ok(qualityScore(official, now) > qualityScore(unknown, now));
});

test("déduplique une même information et conserve la meilleure source", () => {
  const unknown = article({
    title: "Mercato PSG : Paris accélère pour recruter un nouvel attaquant cet été",
    sourceTier: "other",
  });
  const official = article({
    id: "official",
    title: "PSG mercato - Paris accélère cet été pour recruter un nouvel attaquant",
    url: "https://psg.fr/equipes/article-officiel",
    source: { id: "psg.fr", name: "PSG", websiteURL: "https://psg.fr" },
    sourceTier: "official",
  });
  const distinct = article({
    id: "distinct",
    title: "PSG : le calendrier complet de la Ligue des champions dévoilé",
    url: "https://example.com/football/calendrier-psg",
  });

  const result = rankAndDeduplicate([unknown, official, distinct], now);
  assert.deepEqual(result.map((item) => item.id), ["official", "distinct"]);
  assert.ok(result.every((item) => typeof item.qualityScore === "number"));
});

test("écarte les articles anciens et les dates futures incohérentes", () => {
  const stale = article({ id: "stale", publishedAt: "2026-08-07T12:00:00Z" });
  const future = article({ id: "future", publishedAt: "2026-08-12T15:00:00Z" });
  const valid = article({ id: "valid" });
  assert.deepEqual(rankAndDeduplicate([stale, future, valid], now).map((item) => item.id), ["valid"]);
});
