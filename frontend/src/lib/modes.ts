export const chatModes = [
  "general",
  "study",
  "assignment",
  "ppt",
  "document",
  "exam",
  "emotion",
  "writing",
  "image",
] as const;

export type ChatMode = (typeof chatModes)[number];

export type ModeMeta = {
  id: ChatMode;
  label: string;
  short: string;
  hint: string;
  studio: boolean;
};

export const MODE_META: ModeMeta[] = [
  { id: "general", label: "General Chat", short: "Chat", hint: "Everyday questions and open conversation.", studio: false },
  { id: "study", label: "Study Assistant", short: "Study", hint: "Explain topics with steps, examples, and practice.", studio: true },
  { id: "assignment", label: "Assignment Maker", short: "Assignment", hint: "Full essays, reports, outlines, and short answers you can edit and export.", studio: true },
  { id: "ppt", label: "PPT Maker", short: "PPT", hint: "Build a slide outline and download a real .pptx file.", studio: true },
  { id: "document", label: "Document Generator", short: "Docs", hint: "Notes, summaries, and reports you can export.", studio: true },
  { id: "exam", label: "Exam Preparation", short: "Exam", hint: "Revision points, practice questions, and short answers.", studio: true },
  { id: "emotion", label: "Emotional Companion", short: "Listen", hint: "Supportive listening when you feel low or stressed — use Chat Listen for a real conversation.", studio: false },
  { id: "writing", label: "Writing Assistant", short: "Writing", hint: "Improve clarity, grammar, and structure.", studio: true },
  {
    id: "image",
    label: "Image Studio",
    short: "Image",
    hint: "Generate, edit, or build educational diagrams, then download them.",
    studio: true,
  },
];

export function modeMeta(id: ChatMode): ModeMeta {
  return MODE_META.find((item) => item.id === id) ?? MODE_META[0];
}

export function downloadBase64File(filename: string, mimeType: string, base64: string) {
  const binary = atob(base64);
  const bytes = new Uint8Array(binary.length);
  for (let i = 0; i < binary.length; i += 1) bytes[i] = binary.charCodeAt(i);
  const blob = new Blob([bytes], { type: mimeType });
  const url = URL.createObjectURL(blob);
  const anchor = document.createElement("a");
  anchor.href = url;
  anchor.download = filename;
  anchor.click();
  URL.revokeObjectURL(url);
}

/** Best-effort slide outline from chat markdown for PPTX export. */
export function presentationFromMarkdown(
  content: string,
  fallbackTitle = "SAHARA Presentation",
): { title: string; slides: { title: string; bullets: string[]; notes?: string }[] } {
  const lines = content.replace(/\r\n/g, "\n").split("\n");
  const slides: { title: string; bullets: string[]; notes?: string }[] = [];
  let title = fallbackTitle;
  let current: { title: string; bullets: string[]; notes?: string } | null = null;
  const flush = () => {
    if (current && (current.title || current.bullets.length)) slides.push(current);
    current = null;
  };
  for (const line of lines) {
    const trimmed = line.trim();
    if (!trimmed) continue;
    const heading = /^(#{1,3})\s+(.+)$/.exec(trimmed);
    if (heading?.[2]) {
      if (!slides.length && !current && heading[1] === "#") {
        title = heading[2].trim().slice(0, 120);
        continue;
      }
      flush();
      current = { title: heading[2].trim().slice(0, 80), bullets: [] };
      continue;
    }
    const slideLabel = /^(?:slide\s*)?\d+\s*[:.\-–—]\s*(.+)$/i.exec(trimmed);
    if (slideLabel?.[1]) {
      flush();
      current = { title: slideLabel[1].trim().slice(0, 80), bullets: [] };
      continue;
    }
    const boldTitle = /^\*\*(.+?)\*\*$/.exec(trimmed);
    if (boldTitle?.[1] && trimmed.length < 100) {
      flush();
      current = { title: boldTitle[1].trim().slice(0, 80), bullets: [] };
      continue;
    }
    if (/^(speaker notes?|notes)\s*:/i.test(trimmed) && current) {
      current.notes = trimmed.replace(/^(speaker notes?|notes)\s*:/i, "").trim().slice(0, 400);
      continue;
    }
    const bullet = trimmed.replace(/^[-*•]\s+/, "").replace(/^\d+[.)]\s+/, "").trim();
    if (!bullet) continue;
    if (!current) current = { title: title.slice(0, 80), bullets: [] };
    if (current.bullets.length < 8) current.bullets.push(bullet.slice(0, 240));
  }
  flush();
  if (!slides.length) slides.push({ title: title.slice(0, 80), bullets: [content.slice(0, 400) || "Empty outline"] });
  return { title: title.slice(0, 120), slides: slides.slice(0, 40) };
}
