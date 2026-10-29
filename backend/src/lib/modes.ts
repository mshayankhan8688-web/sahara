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

export function isChatMode(value: unknown): value is ChatMode {
  return typeof value === "string" && (chatModes as readonly string[]).includes(value);
}

/** Infer a mode from natural language when the user did not pick one. */
export function inferChatMode(text: string): ChatMode {
  const t = text.toLowerCase();
  if (
    /\b(sad|lonely|stress|anxious|depress|worried|hurt|cry|crying|suicide|self[- ]?harm|bohat sad|udaas|tanhai|pareshan|dukhi)\b/i.test(
      t,
    ) ||
    /\b(sun lo|baat suno|listen to me|feelings|emotional)\b/i.test(t)
  ) {
    return "emotion";
  }
  if (
    /\b(generate|create|draw|make)\b.{0,60}\b(image|picture|illustration|logo|poster|diagram|landscape|portrait|uml|er diagram|tasveer)\b/i.test(
      t,
    ) ||
    /\b(illustration|logo|poster|diagram|uml|photosynthesis diagram|image bana|tasveer)\b/i.test(t)
  ) {
    return "image";
  }
  if (/\b(ppt|powerpoint|presentation|slides?|prezentation)\b/i.test(t) || /\bppt\b.*\bbana/i.test(t)) {
    return "ppt";
  }
  if (
    /\b(assignment|homework|essay|report|thesis|coursework|assignment bana|assignment bnao)\b/i.test(t) ||
    /\b(make|write|generate).{0,40}\b(assignment|essay|report)\b/i.test(t)
  ) {
    return "assignment";
  }
  if (/\b(exam|quiz|mcq|past paper|revise|revision|prepare for (the )?exam)\b/i.test(t)) {
    return "exam";
  }
  if (/\b(docx|pdf notes|study notes|revision notes|handout|document)\b/i.test(t) && /\b(make|generate|create|bana)\b/i.test(t)) {
    return "document";
  }
  if (/\b(rewrite|improve|edit|grammar|paraphrase|writing)\b/i.test(t)) {
    return "writing";
  }
  if (
    /\b(study|explain|learn|teach|math|maths|programming|code|algorithm|physics|chemistry|biology|statistics|university|college|school)\b/i.test(
      t,
    ) ||
    /\b(samjhao|seekhni|seekhana|padhao)\b/i.test(t)
  ) {
    return "study";
  }
  return "general";
}

export function modeLabel(mode: ChatMode): string {
  switch (mode) {
    case "study":
      return "Study Assistant";
    case "assignment":
      return "Assignment Maker";
    case "ppt":
      return "PPT Maker";
    case "document":
      return "Document Generator";
    case "exam":
      return "Exam Preparation";
    case "emotion":
      return "Emotional Companion";
    case "writing":
      return "Writing Assistant";
    case "image":
      return "Image Studio";
    default:
      return "General Chat";
  }
}

export function tokensForMode(mode: ChatMode, hasAttachment: boolean): number {
  switch (mode) {
    case "assignment":
    case "document":
      return 4096;
    case "ppt":
      return 3072;
    case "study":
    case "exam":
    case "writing":
      return hasAttachment ? 3072 : 2048;
    case "emotion":
      return 700;
    case "image":
      return 400;
    default:
      return hasAttachment ? 900 : 500;
  }
}
