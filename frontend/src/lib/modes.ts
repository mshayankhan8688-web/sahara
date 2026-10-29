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
  { id: "assignment", label: "Assignment Maker", short: "Assignment", hint: "Outline and draft school or university assignments.", studio: true },
  { id: "ppt", label: "PPT Maker", short: "PPT", hint: "Build a slide outline and download a real .pptx file.", studio: true },
  { id: "document", label: "Document Generator", short: "Docs", hint: "Notes, summaries, and reports you can export.", studio: true },
  { id: "exam", label: "Exam Preparation", short: "Exam", hint: "Revision points, practice questions, and short answers.", studio: true },
  { id: "emotion", label: "Emotional Companion", short: "Listen", hint: "Supportive listening when you feel low or stressed.", studio: true },
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
