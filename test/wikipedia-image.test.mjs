import test from "node:test";
import assert from "node:assert/strict";

import { summaryImageURL } from "../scripts/wikipedia-image.mjs";

test("prefers the thumbnail over the original image (smaller download for a badge-sized logo)", () => {
  const url = summaryImageURL({
    type: "standard",
    originalimage: { source: "https://example.com/original.png" },
    thumbnail: { source: "https://example.com/thumb.png" },
  });
  assert.equal(url, "https://example.com/thumb.png");
});

test("downsizes a Wikimedia thumbnail URL that is wider than the target width", () => {
  const url = summaryImageURL({
    type: "standard",
    thumbnail: {
      source: "https://upload.wikimedia.org/wikipedia/commons/thumb/a/ab/Logo.svg/960px-Logo.svg.png",
    },
  });
  assert.equal(url, "https://upload.wikimedia.org/wikipedia/commons/thumb/a/ab/Logo.svg/240px-Logo.svg.png");
});

test("leaves a Wikimedia thumbnail URL untouched when already narrower than the target width", () => {
  const source = "https://upload.wikimedia.org/wikipedia/commons/thumb/a/ab/Logo.svg/120px-Logo.svg.png";
  const url = summaryImageURL({ type: "standard", thumbnail: { source } });
  assert.equal(url, source);
});

test("falls back to the thumbnail when there is no original image", () => {
  const url = summaryImageURL({
    type: "standard",
    thumbnail: { source: "https://example.com/thumb.png" },
  });
  assert.equal(url, "https://example.com/thumb.png");
});

test("rejects disambiguation pages", () => {
  const url = summaryImageURL({
    type: "disambiguation",
    thumbnail: { source: "https://example.com/thumb.png" },
  });
  assert.equal(url, null);
});

test("returns null when no image is present", () => {
  assert.equal(summaryImageURL({ type: "standard" }), null);
});

test("returns null for a missing summary", () => {
  assert.equal(summaryImageURL(null), null);
});
