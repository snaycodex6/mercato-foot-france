import test from "node:test";
import assert from "node:assert/strict";

import { buildTopicSearchURL, isoDateFromSeenDate } from "../scripts/topic-search.mjs";

test("cite les expressions à plusieurs mots et ajoute le contexte football", () => {
  const url = buildTopicSearchURL("as monaco");
  assert.equal(url.searchParams.get("query"), '"as monaco" football');
  assert.equal(url.searchParams.get("sourcelang"), "french");
  assert.equal(url.searchParams.get("sort"), "datedesc");
});

test("ne cite pas un terme d'un seul mot", () => {
  const url = buildTopicSearchURL("juventus");
  assert.equal(url.searchParams.get("query"), "juventus football");
});

test("convertit une date GDELT compacte en ISO 8601", () => {
  assert.equal(isoDateFromSeenDate("20260808T061500Z"), "2026-08-08T06:15:00.000Z");
});

test("retombe sur l'heure actuelle si la date est illisible", () => {
  const before = Date.now();
  const parsed = new Date(isoDateFromSeenDate("invalide")).getTime();
  assert.ok(parsed >= before);
});
