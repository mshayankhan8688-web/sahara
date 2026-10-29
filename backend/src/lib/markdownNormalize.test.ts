import assert from "node:assert/strict";
import { test } from "node:test";
import { normalizeStudioMarkdown, stripMarkdownMarkers } from "./markdownNormalize.js";

test("unescapes over-escaped markdown without removing real markers", () => {
  const raw = String.raw`# Best Friends

Here is an outline and draft for your essay.

\*\*Introduction\*\*

Friendship is important.

\---

● Trust
● Honesty

You can change the font colour if needed.`;
  const clean = normalizeStudioMarkdown(raw);
  assert.match(clean, /\*\*Introduction\*\*/);
  assert.doesNotMatch(clean, /\\\*\*/);
  assert.doesNotMatch(clean, /Here is an outline/i);
  assert.doesNotMatch(clean, /font colou?r/i);
  assert.match(clean, /^- Trust/m);
  assert.match(clean, /^---$/m);
});

test("stripMarkdownMarkers keeps words", () => {
  assert.equal(stripMarkdownMarkers("**Bold** and *italic*"), "Bold and italic");
});
