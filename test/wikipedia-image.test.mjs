import test from "node:test";
import assert from "node:assert/strict";

import { summaryImageURL } from "../scripts/wikipedia-image.mjs";

test("prefers the original image over the thumbnail", () => {
  const url = summaryImageURL({
    type: "standard",
    originalimage: { source: "https://example.com/original.png" },
    thumbnail: { source: "https://example.com/thumb.png" },
  });
  assert.equal(url, "https://example.com/original.png");
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
