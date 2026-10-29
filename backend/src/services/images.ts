import { GoogleGenAI, Modality } from "@google/genai";
import { aiConfigured, config } from "../config.js";
import { HttpError } from "../http.js";
import { parseAttachment } from "../lib/attachment.js";

export type GeneratedImage = {
  mimeType: "image/png" | "image/jpeg" | "image/webp";
  data: string;
  name: string;
  caption: string;
  model: string;
};

const IMAGE_MODELS = [
  config.geminiImageModel,
  "gemini-2.5-flash-image",
  "gemini-nano-banana-2.1",
  "gemini-2.5-flash-image-preview",
].filter((model, index, all) => model && all.indexOf(model) === index);

let gemini: GoogleGenAI | null = null;

function client(): GoogleGenAI {
  if (!aiConfigured) {
    throw new HttpError(
      503,
      "AI image tools need GEMINI_API_KEY on the server. Image models are separate from text chat quota.",
      "AI_NOT_CONFIGURED",
    );
  }
  gemini ??= new GoogleGenAI({ apiKey: config.geminiApiKey, httpOptions: { timeout: 90_000 } });
  return gemini;
}

function statusOf(error: unknown): number | undefined {
  if (typeof error === "object" && error && "status" in error && typeof error.status === "number") return error.status;
  const message = error instanceof Error ? error.message : String(error);
  const match = /"code":\s*(\d{3})/.exec(message);
  return match ? Number(match[1]) : undefined;
}

function safeImageError(error: unknown): HttpError {
  const status = statusOf(error);
  const raw = error instanceof Error ? error.message : String(error);
  const cleaned = config.geminiApiKey ? raw.replaceAll(config.geminiApiKey, "[redacted]") : raw;
  if (status === 429 || /quota|rate.?limit|resource_exhausted/i.test(cleaned)) {
    return new HttpError(
      429,
      "Gemini image generation is out of quota on this API key. Enable billing or raise image limits in Google AI Studio, then retry. Text chat can still work separately.",
      "IMAGE_QUOTA",
    );
  }
  if (status === 404 || /not found|not supported/i.test(cleaned)) {
    return new HttpError(
      503,
      "No Gemini image model is available for this key. Set GEMINI_IMAGE_MODEL to a supported image model such as gemini-2.5-flash-image.",
      "IMAGE_MODEL_UNAVAILABLE",
    );
  }
  if (status === 401 || status === 403 || /api key|permission|unauth/i.test(cleaned)) {
    return new HttpError(502, "Gemini rejected the image request. Check GEMINI_API_KEY permissions for image models.", "IMAGE_AUTH");
  }
  console.error("Gemini image request failed", cleaned.slice(0, 400));
  return new HttpError(502, "Image generation failed. Try a simpler prompt or try again.", "IMAGE_FAILED");
}

function normalizeMime(mime?: string): GeneratedImage["mimeType"] {
  const value = (mime || "image/png").toLowerCase();
  if (value.includes("jpeg") || value.includes("jpg")) return "image/jpeg";
  if (value.includes("webp")) return "image/webp";
  return "image/png";
}

function extractImage(response: {
  candidates?: Array<{ content?: { parts?: Array<{ text?: string; inlineData?: { mimeType?: string; data?: string } }> } }>;
}): { mimeType: GeneratedImage["mimeType"]; data: string; caption: string } {
  const parts = response.candidates?.[0]?.content?.parts ?? [];
  const caption = parts.map((part) => part.text || "").join("\n").trim().slice(0, 800);
  const imagePart = parts.find((part) => part.inlineData?.data);
  if (!imagePart?.inlineData?.data) {
    throw new HttpError(502, "Gemini returned no image for that prompt.", "IMAGE_EMPTY");
  }
  const data = imagePart.inlineData.data.replace(/\s/g, "");
  const bytes = Buffer.from(data, "base64");
  if (bytes.length < 64) throw new HttpError(502, "Gemini returned an empty image.", "IMAGE_EMPTY");
  if (bytes.length > 3 * 1024 * 1024) {
    throw new HttpError(502, "The generated image was too large to store.", "IMAGE_TOO_LARGE");
  }
  return { mimeType: normalizeMime(imagePart.inlineData.mimeType), data, caption };
}

function filename(prefix: string, mime: GeneratedImage["mimeType"]): string {
  const ext = mime === "image/jpeg" ? "jpg" : mime === "image/webp" ? "webp" : "png";
  return `${prefix}-${Date.now().toString(36)}.${ext}`.slice(0, 80);
}

async function generateContentImage(input: {
  prompt: string;
  reference?: { mimeType: string; data: string };
}): Promise<GeneratedImage> {
  let lastError: unknown;
  for (const model of IMAGE_MODELS) {
    try {
      const parts: Array<{ text: string } | { inlineData: { mimeType: string; data: string } }> = [];
      if (input.reference) {
        parts.push({ inlineData: { mimeType: input.reference.mimeType, data: input.reference.data } });
      }
      parts.push({ text: input.prompt });
      const response = await client().models.generateContent({
        model,
        contents: [{ role: "user", parts }],
        config: {
          responseModalities: [Modality.TEXT, Modality.IMAGE],
          abortSignal: AbortSignal.timeout(75_000),
        },
      });
      const extracted = extractImage(response);
      return {
        ...extracted,
        name: filename(input.reference ? "sahara-edit" : "sahara-image", extracted.mimeType),
        model,
      };
    } catch (error) {
      if (error instanceof HttpError && error.code === "IMAGE_EMPTY") {
        lastError = error;
        continue;
      }
      lastError = error;
      const status = statusOf(error);
      if (status === 401 || status === 403) break;
      if (status === 404) continue;
      if (status === 429) throw safeImageError(error);
    }
  }
  throw lastError instanceof HttpError ? lastError : safeImageError(lastError);
}

export async function generateAiImage(input: {
  prompt: string;
  style?: string;
  purpose?: "general" | "study" | "presentation" | "poster";
}): Promise<GeneratedImage> {
  const style = input.style?.trim() ? `Visual style: ${input.style.trim()}.` : "";
  const purpose =
    input.purpose === "study"
      ? "Educational illustration: clear composition, readable labels if any text appears, accurate and simple."
      : input.purpose === "presentation"
        ? "Clean presentation illustration suitable for a university slide, uncluttered, high contrast."
        : input.purpose === "poster"
          ? "Professional poster-quality visual with strong focal point."
          : "High-quality image.";
  const prompt = [
    "Create one original image from this request.",
    purpose,
    style,
    "Avoid watermarks and logos you do not own.",
    "If labels are needed, keep them short and readable.",
    `User request: ${input.prompt.trim()}`,
  ]
    .filter(Boolean)
    .join("\n");
  return generateContentImage({ prompt });
}

export async function editAiImage(input: {
  prompt: string;
  image: { name: string; mimeType: string; data: string };
}): Promise<GeneratedImage> {
  const parsed = parseAttachment(input.image);
  if (!parsed.mimeType.startsWith("image/")) {
    throw new HttpError(400, "Upload a JPEG, PNG, WebP, or GIF to edit.", "FILE_TYPE");
  }
  const prompt = [
    "Edit the attached image according to the user's instructions.",
    "Preserve the main subject unless they ask to replace it.",
    "Return one edited image.",
    `Edit request: ${input.prompt.trim()}`,
  ].join("\n");
  return generateContentImage({
    prompt,
    reference: { mimeType: parsed.mimeType, data: parsed.data },
  });
}
