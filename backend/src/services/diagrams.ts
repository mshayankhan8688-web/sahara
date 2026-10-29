import { Type } from "@google/genai";
import { HttpError } from "../http.js";
import { generateStructured } from "./gemini.js";

export type DiagramKind = "flowchart" | "network" | "er" | "uml" | "cycle" | "labeled";

type DiagramNode = { id: string; label: string; x?: number; y?: number };
type DiagramEdge = { from: string; to: string; label?: string };

type DiagramSpec = {
  title: string;
  kind: DiagramKind;
  nodes: DiagramNode[];
  edges: DiagramEdge[];
  notes?: string[];
};

function escapeXml(value: string): string {
  return value
    .replaceAll("&", "&amp;")
    .replaceAll("<", "&lt;")
    .replaceAll(">", "&gt;")
    .replaceAll('"', "&quot;")
    .replaceAll("'", "&apos;");
}

function wrapLabel(label: string, max = 18): string[] {
  const words = label.trim().split(/\s+/).filter(Boolean);
  const lines: string[] = [];
  let current = "";
  for (const word of words) {
    const next = current ? `${current} ${word}` : word;
    if (next.length > max && current) {
      lines.push(current);
      current = word;
    } else {
      current = next;
    }
  }
  if (current) lines.push(current);
  return lines.slice(0, 3);
}

function layoutNodes(nodes: DiagramNode[], kind: DiagramKind): Array<DiagramNode & { x: number; y: number }> {
  if (kind === "cycle") {
    const cx = 420;
    const cy = 260;
    const radius = Math.min(160, 40 + nodes.length * 18);
    return nodes.map((node, index) => {
      const angle = (Math.PI * 2 * index) / Math.max(nodes.length, 1) - Math.PI / 2;
      return { ...node, x: cx + Math.cos(angle) * radius, y: cy + Math.sin(angle) * radius };
    });
  }
  if (kind === "network" || kind === "uml") {
    const cols = Math.ceil(Math.sqrt(nodes.length));
    return nodes.map((node, index) => ({
      ...node,
      x: 120 + (index % cols) * 180,
      y: 110 + Math.floor(index / cols) * 130,
    }));
  }
  // flowchart / er / labeled: left-to-right rows
  return nodes.map((node, index) => ({
    ...node,
    x: 110 + (index % 4) * 180,
    y: 100 + Math.floor(index / 4) * 120,
  }));
}

export function renderDiagramSvg(spec: DiagramSpec): string {
  const nodes = layoutNodes(spec.nodes.slice(0, 16), spec.kind);
  const byId = new Map(nodes.map((node) => [node.id, node]));
  const width = 840;
  const height = Math.max(420, 140 + Math.ceil(nodes.length / 4) * 130);
  const edges = spec.edges
    .filter((edge) => byId.has(edge.from) && byId.has(edge.to))
    .slice(0, 24)
    .map((edge) => {
      const from = byId.get(edge.from)!;
      const to = byId.get(edge.to)!;
      const label = edge.label ? escapeXml(edge.label.slice(0, 28)) : "";
      const mx = (from.x + to.x) / 2;
      const my = (from.y + to.y) / 2;
      return `
      <line x1="${from.x}" y1="${from.y}" x2="${to.x}" y2="${to.y}" stroke="#FF8A4C" stroke-width="2" marker-end="url(#arrow)" />
      ${label ? `<text x="${mx}" y="${my - 8}" fill="#C4B8AE" font-size="11" text-anchor="middle">${label}</text>` : ""}`;
    })
    .join("");

  const boxes = nodes
    .map((node) => {
      const lines = wrapLabel(node.label);
      const text = lines
        .map(
          (line, index) =>
            `<text x="${node.x}" y="${node.y - 6 + index * 14}" fill="#FFF7F0" font-size="12" text-anchor="middle">${escapeXml(line)}</text>`,
        )
        .join("");
      return `
      <rect x="${node.x - 70}" y="${node.y - 34}" rx="14" ry="14" width="140" height="68" fill="#1A1410" stroke="#FF8A4C" stroke-width="2" />
      ${text}`;
    })
    .join("");

  const notes = (spec.notes || [])
    .slice(0, 4)
    .map((note, index) => `<text x="40" y="${height - 60 + index * 14}" fill="#C4B8AE" font-size="11">${escapeXml(note.slice(0, 90))}</text>`)
    .join("");

  return `<?xml version="1.0" encoding="UTF-8"?>
<svg xmlns="http://www.w3.org/2000/svg" width="${width}" height="${height}" viewBox="0 0 ${width} ${height}">
  <defs>
    <marker id="arrow" markerWidth="10" markerHeight="10" refX="8" refY="3" orient="auto">
      <path d="M0,0 L8,3 L0,6 Z" fill="#FF8A4C" />
    </marker>
  </defs>
  <rect width="100%" height="100%" fill="#0F0C0A" />
  <text x="40" y="42" fill="#FF8A4C" font-size="22" font-family="Segoe UI, Arial, sans-serif">${escapeXml(spec.title.slice(0, 80))}</text>
  <text x="40" y="64" fill="#8A7F76" font-size="11">SAHARA educational diagram · review labels for your course</text>
  ${edges}
  ${boxes}
  ${notes}
</svg>`;
}

export async function buildEducationalDiagram(input: {
  prompt: string;
  kind?: DiagramKind;
}): Promise<{ title: string; svg: string; mimeType: "image/svg+xml"; name: string; notes: string }> {
  const kindHint = input.kind ? `Prefer diagram kind "${input.kind}".` : "Choose the best kind among flowchart, network, er, uml, cycle, labeled.";
  const structured = await generateStructured<DiagramSpec>({
    latest: `${input.prompt.trim()}\n\n${kindHint}\nReturn JSON only. Keep node labels short and accurate. Do not invent fake relationships.`,
    systemInstruction: [
      "You design educational diagram structures for SAHARA students.",
      "Return JSON with title, kind, nodes[{id,label}], edges[{from,to,label?}], notes[string].",
      "Use 4 to 12 nodes. ids must be short tokens like n1.",
      "Never invent citations. Prefer clear academic relationships only.",
    ].join(" "),
    schema: {
      type: Type.OBJECT,
      properties: {
        title: { type: Type.STRING },
        kind: { type: Type.STRING, enum: ["flowchart", "network", "er", "uml", "cycle", "labeled"] },
        nodes: {
          type: Type.ARRAY,
          items: {
            type: Type.OBJECT,
            properties: {
              id: { type: Type.STRING },
              label: { type: Type.STRING },
            },
            required: ["id", "label"],
          },
        },
        edges: {
          type: Type.ARRAY,
          items: {
            type: Type.OBJECT,
            properties: {
              from: { type: Type.STRING },
              to: { type: Type.STRING },
              label: { type: Type.STRING },
            },
            required: ["from", "to"],
          },
        },
        notes: { type: Type.ARRAY, items: { type: Type.STRING } },
      },
      required: ["title", "kind", "nodes", "edges"],
    },
    maxOutputTokens: 1600,
    timeoutMs: 45_000,
  });

  if (!Array.isArray(structured.nodes) || structured.nodes.length < 2) {
    throw new HttpError(502, "Could not build a usable diagram outline.", "DIAGRAM_EMPTY");
  }

  const svg = renderDiagramSvg({
    title: structured.title || "SAHARA Diagram",
    kind: structured.kind || input.kind || "flowchart",
    nodes: structured.nodes,
    edges: structured.edges || [],
    notes: structured.notes,
  });

  return {
    title: structured.title || "SAHARA Diagram",
    svg,
    mimeType: "image/svg+xml",
    name: `sahara-diagram-${Date.now().toString(36)}.svg`,
    notes: (structured.notes || []).join(" ").slice(0, 400),
  };
}

export function svgToBase64(svg: string): string {
  return Buffer.from(svg, "utf8").toString("base64");
}
