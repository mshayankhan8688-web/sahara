import assert from "node:assert/strict";
import { test } from "node:test";
import { renderDiagramSvg, svgToBase64 } from "./diagrams.js";

test("renders educational SVG diagrams with labels", () => {
  const svg = renderDiagramSvg({
    title: "Photosynthesis",
    kind: "cycle",
    nodes: [
      { id: "n1", label: "Sunlight" },
      { id: "n2", label: "Chloroplast" },
      { id: "n3", label: "Glucose" },
      { id: "n4", label: "Oxygen" },
    ],
    edges: [
      { from: "n1", to: "n2", label: "energy" },
      { from: "n2", to: "n3" },
      { from: "n2", to: "n4" },
    ],
    notes: ["Review with your textbook."],
  });
  assert.match(svg, /^<\?xml/);
  assert.match(svg, /Photosynthesis/);
  assert.match(svg, /Chloroplast/);
  assert.match(svg, /marker-end/);
  const encoded = svgToBase64(svg);
  assert.equal(Buffer.from(encoded, "base64").toString("utf8"), svg);
});
