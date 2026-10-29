import { Type } from "@google/genai";
import { HttpError } from "../http.js";
import type { ChatMode } from "../lib/modes.js";
import { inferChatMode, tokensForMode } from "../lib/modes.js";
import type { ReplyLanguage } from "../lib/replyLanguage.js";
import { Companion } from "../models/Companion.js";
import { asObjectId } from "../lib/objectId.js";
import { parseAttachment } from "../lib/attachment.js";
import { extractOfficeText } from "../lib/officeText.js";
import { composeReply, generateStructured } from "./gemini.js";
import { loadPreferences } from "./chat.js";
import { STUDIO_PPT_JSON_PROMPT } from "./prompt.js";
import {
  exportDocument,
  parsePresentationJson,
  type ExportFormat,
  type PresentationSpec,
} from "./documents.js";
import { normalizeStudioMarkdown } from "../lib/markdownNormalize.js";

export type StudioGenerateInput = {
  userId: string;
  mode?: ChatMode;
  prompt: string;
  title?: string;
  subject?: string;
  level?: string;
  assignmentType?: "essay" | "assignment" | "report" | "outline" | "short-answer" | "detailed-answer";
  wordCount?: number;
  writingStyle?: "simple" | "academic";
  slideCount?: number;
  language?: ReplyLanguage;
  companionId?: string;
  attachment?: { name: string; mimeType: string; data: string };
  includeSpeakerNotes?: boolean;
};

function assignmentBrief(input: StudioGenerateInput): string {
  const typeLabel: Record<NonNullable<StudioGenerateInput["assignmentType"]>, string> = {
    essay: "full essay (not an outline)",
    assignment: "structured academic assignment",
    report: "academic report",
    outline: "outline only",
    "short-answer": "short answer",
    "detailed-answer": "detailed answer",
  };
  const parts = [
    input.assignmentType ? `Deliverable type: ${typeLabel[input.assignmentType]}.` : "",
    input.subject?.trim() ? `Subject: ${input.subject.trim()}.` : "",
    input.wordCount ? `Target length: about ${input.wordCount} words.` : "",
    input.writingStyle === "simple"
      ? "Writing style: simple clear English, easy vocabulary."
      : input.writingStyle === "academic"
        ? "Writing style: clear academic English."
        : "",
    input.assignmentType === "essay" || input.assignmentType === "short-answer"
      ? "Output the essay/answer body only. No outline-first preamble. No font or formatting tips."
      : input.assignmentType === "outline"
        ? "Output a structured outline only."
        : "Output the academic document body only. No meta commentary.",
  ];
  return parts.filter(Boolean).join(" ");
}

async function resolveCompanion(userId: string, companionId?: string) {
  const companion = companionId
    ? await Companion.findOne({ _id: asObjectId(companionId), userId })
    : await Companion.findOne({ userId, isDefault: true });
  if (!companion) throw new HttpError(400, "Choose a companion first.", "NO_COMPANION");
  return companion;
}

async function attachmentContext(attachment?: { name: string; mimeType: string; data: string }) {
  if (!attachment) return { geminiAttachment: undefined as undefined | { mimeType: string; data: string }, textExtra: "" };
  const office = await extractOfficeText(attachment);
  if (office) {
    return {
      geminiAttachment: undefined,
      textExtra: `\n\n---\nExtracted text from ${office.name}:\n${office.text}`,
    };
  }
  const parsed = parseAttachment(attachment);
  return { geminiAttachment: { mimeType: parsed.mimeType, data: parsed.data }, textExtra: "" };
}

export async function generateStudioContent(input: StudioGenerateInput) {
  const mode = input.mode ?? inferChatMode(input.prompt);
  const companion = await resolveCompanion(input.userId, input.companionId);
  const preferences = await loadPreferences(input.userId);
  const { geminiAttachment, textExtra } = await attachmentContext(input.attachment);

  const level = input.level?.trim() ? `Academic level: ${input.level.trim()}.` : "";
  const slides = input.slideCount ? `Target about ${Math.min(Math.max(input.slideCount, 4), 20)} slides.` : "";
  const notes = input.includeSpeakerNotes ? "Include brief speaker notes in the outline." : "";
  const titleHint = input.title?.trim() ? `Working title: ${input.title.trim()}.` : "";
  const assignment = mode === "assignment" ? assignmentBrief(input) : "";

  const userPrompt = input.prompt.trim();
  const hasFile = Boolean(geminiAttachment || textExtra);
  const shortWithFile = hasFile && userPrompt.length > 0 && userPrompt.length < 40;
  const studyFileHint =
    mode === "study" && shortWithFile
      ? "Read the attached document carefully. Solve or explain the tasks in it step by step with clear answers, examples, and short notes where useful. Do not invent content that is not in the file."
      : mode === "assignment" && shortWithFile
        ? "Read the attached instructions carefully and produce the requested academic deliverable from what is actually in the file."
        : "";

  let latest = [userPrompt, studyFileHint, titleHint, level, assignment, slides, notes].filter(Boolean).join("\n");
  latest += textExtra;
  if (!latest.trim()) throw new HttpError(400, "Describe what you need.", "EMPTY_PROMPT");

  const requestTimeoutMs = hasFile ? 90_000 : 60_000;

  if (mode === "ppt") {
    const structured = await generateStructured<{ title: string; slides: { title: string; bullets: string[]; notes?: string }[] }>({
      latest,
      attachment: geminiAttachment,
      systemInstruction: [
        STUDIO_PPT_JSON_PROMPT,
        `Companion voice: ${companion.name}. ${companion.style}`,
        `Reply language preference: ${input.language ?? "auto"}`,
      ].join("\n"),
      schema: {
        type: Type.OBJECT,
        properties: {
          title: { type: Type.STRING },
          slides: {
            type: Type.ARRAY,
            items: {
              type: Type.OBJECT,
              properties: {
                title: { type: Type.STRING },
                bullets: { type: Type.ARRAY, items: { type: Type.STRING } },
                notes: { type: Type.STRING },
              },
              required: ["title", "bullets"],
            },
          },
        },
        required: ["title", "slides"],
      },
      maxOutputTokens: tokensForMode("ppt", Boolean(geminiAttachment || textExtra)),
      timeoutMs: requestTimeoutMs,
    });
    const presentation = parsePresentationJson(JSON.stringify(structured), input.title?.trim() || "SAHARA Presentation");
    const markdown = [
      `# ${presentation.title}`,
      ...presentation.slides.map(
        (slide, index) =>
          `## Slide ${index + 1}: ${slide.title}\n${slide.bullets.map((b) => `- ${b}`).join("\n")}${slide.notes ? `\n\nNotes: ${slide.notes}` : ""}`,
      ),
    ].join("\n\n");
    return { mode, title: presentation.title, content: markdown, presentation };
  }

  const raw = await composeReply({
    companionName: companion.name,
    companionStyle: companion.style,
    preferences,
    history: [],
    latest,
    attachment: geminiAttachment,
    search: { status: "not_requested", results: [] },
    replyLanguage: input.language,
    mode,
    maxOutputTokens: tokensForMode(mode, Boolean(geminiAttachment || textExtra)),
    timeoutMs: requestTimeoutMs,
  });

  const content = normalizeStudioMarkdown(raw);
  const derivedTitle =
    input.title?.trim() ||
    content.match(/^#\s+(.+)$/m)?.[1]?.trim() ||
    input.prompt.trim().slice(0, 80) ||
    "SAHARA document";

  return {
    mode,
    title: derivedTitle.slice(0, 120),
    content,
    presentation: undefined as PresentationSpec | undefined,
  };
}

export async function exportStudioDocument(input: {
  format: ExportFormat;
  title: string;
  content: string;
  presentation?: PresentationSpec;
}) {
  if (!input.content.trim() && !input.presentation) {
    throw new HttpError(400, "There is nothing to export yet.", "EMPTY_EXPORT");
  }
  return exportDocument({
    format: input.format,
    title: input.title,
    content: input.content || input.title,
    presentation: input.presentation,
  });
}
