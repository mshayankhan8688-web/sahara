import assert from "node:assert/strict";
import { test } from "node:test";
import { buildDocx, buildPdf, buildPptx, parsePresentationFromMarkdown } from "./documents.js";

test("builds pptx docx and pdf buffers from markdown", async () => {
  const markdown = `# Databases\n\n## Intro\n- What is a DB\n- Why index\n\n## Normal forms\n- 1NF\n- 2NF\n- 3NF`;
  const presentation = parsePresentationFromMarkdown(markdown, "Databases");
  assert.ok(presentation.slides.length >= 2);
  const pptx = await buildPptx(presentation);
  const docx = await buildDocx("Databases", markdown);
  const pdf = await buildPdf("Databases", markdown);
  assert.ok(pptx.length > 1000);
  assert.ok(docx.length > 1000);
  assert.ok(pdf.length > 500);
  assert.equal(pptx.subarray(0, 2).toString("utf8"), "PK");
  assert.equal(docx.subarray(0, 2).toString("utf8"), "PK");
  assert.equal(pdf.subarray(0, 4).toString("utf8"), "%PDF");
});

test("multi-page PDF export succeeds with bufferPages", async () => {
  const longBody = Array.from({ length: 40 }, (_, i) => `## Section ${i + 1}\n\n${"Paragraph text about databases and indexing. ".repeat(12)}`).join("\n\n");
  const pdf = await buildPdf("Long Report", longBody);
  assert.ok(pdf.length > 2000);
  assert.equal(pdf.subarray(0, 4).toString("utf8"), "%PDF");
});
