import { GoogleGenAI, Type, type Content } from "@google/genai";
import { aiConfigured, config } from "../config.js";
import { HttpError } from "../http.js";
import type { ReplyLanguage } from "../lib/replyLanguage.js";
import { CLASSIFIER_PROMPT, systemPrompt, type PreferenceView, type SearchStatus } from "./prompt.js";
import type { Restaurant } from "./placeMapper.js";

export type Intent = {
  intent: "restaurant" | "food" | "emotional" | "wellness" | "preference" | "chat";
  foodQuery: string;
  areaText: string;
  wantsNearby: boolean;
  minRating?: number;
  price?: "inexpensive" | "moderate" | "expensive" | "very_expensive";
  openNow: boolean;
};

const intentSchema = {
  type: Type.OBJECT,
  properties: {
    intent: { type: Type.STRING, enum: ["restaurant", "food", "emotional", "wellness", "preference", "chat"] },
    foodQuery: { type: Type.STRING },
    areaText: { type: Type.STRING },
    wantsNearby: { type: Type.BOOLEAN },
    minRating: { type: Type.NUMBER },
    price: { type: Type.STRING, enum: ["", "inexpensive", "moderate", "expensive", "very_expensive"] },
    openNow: { type: Type.BOOLEAN },
  },
  required: ["intent", "foodQuery", "areaText", "wantsNearby", "openNow"],
};

let gemini: GoogleGenAI | null = null;

function client(): GoogleGenAI {
  if (!aiConfigured) {
    throw new HttpError(
      503,
      "AI replies are not connected. Set GEMINI_API_KEY and GEMINI_MODEL on the server. The key never goes in frontend code.",
      "AI_NOT_CONFIGURED",
    );
  }
  gemini ??= new GoogleGenAI({ apiKey: config.geminiApiKey, httpOptions: { timeout: 12_000 } });
  return gemini;
}

function statusOf(error: unknown): number | undefined {
  if (typeof error === "object" && error && "status" in error && typeof error.status === "number") return error.status;
  return undefined;
}

function errorText(error: unknown): string {
  const cause = error instanceof Error && "cause" in error && error.cause instanceof Error ? error.cause.message : "";
  return `${error instanceof Error ? error.message : ""} ${cause}`;
}

function isBusy(error: unknown): boolean {
  const status = statusOf(error);
  if (status === 429 || status === 503 || status === 504) return true;
  return /high demand|unavailable|deadline|resource_exhausted/i.test(errorText(error));
}

function isNetwork(error: unknown): boolean {
  return /fetch failed|connect timeout|UND_ERR|ECONNRESET|ETIMEDOUT|ENOTFOUND|socket/i.test(errorText(error));
}

function safeMessage(error: unknown): string {
  if (isNetwork(error)) return "SAHARA could not reach Gemini. Try again.";
  if (isBusy(error)) return "Gemini is busy right now. Try again.";
  if (error instanceof Error && (error.name === "TimeoutError" || error.name === "AbortError")) {
    return "Gemini is taking too long. Try again.";
  }
  const raw = error instanceof Error ? error.message : "The AI request failed.";
  const secret = config.geminiApiKey;
  const cleaned = secret ? raw.replaceAll(secret, "[redacted]") : raw;
  if (/timeout|timed out|aborted/i.test(cleaned)) return "Gemini is taking too long. Try again.";
  if (/api key|permission|unauth/i.test(cleaned)) {
    return "Gemini rejected the request. Check GEMINI_API_KEY and GEMINI_MODEL.";
  }
  return "The AI request failed. You can try again.";
}

const fallbackModels = ["gemini-flash-lite-latest", "gemini-3-flash-preview"];

function modelsToTry(): string[] {
  return [config.geminiModel, ...fallbackModels.filter((model) => model !== config.geminiModel)];
}

function supportsThinkingConfig(model: string): boolean {
  return !model.includes("flash-lite-latest");
}

async function generate(contents: Content[] | string, configOverride: Record<string, unknown>): Promise<string> {
  let lastError: unknown;
  for (const model of modelsToTry()) {
    try {
      const response = await client().models.generateContent({
        model,
        contents,
        config: {
          maxOutputTokens: 280,
          abortSignal: AbortSignal.timeout(12_000),
          ...configOverride,
          ...(supportsThinkingConfig(model) ? { thinkingConfig: { thinkingBudget: 0 } } : {}),
        },
      });
      const text = response.text?.trim();
      if (!text) throw new HttpError(502, "The AI returned an empty reply.", "AI_EMPTY");
      return text;
    } catch (error) {
      if (error instanceof HttpError && error.code !== "AI_EMPTY") throw error;
      lastError = error;
      const status = statusOf(error);
      if (status === 401 || status === 403) break;
      if (!isBusy(error) && !isNetwork(error) && status !== 400 && !(error instanceof HttpError)) break;
      await new Promise((resolve) => setTimeout(resolve, 600));
    }
  }
  console.error("Gemini request failed", lastError);
  throw new HttpError(502, safeMessage(lastError), isBusy(lastError) ? "AI_BUSY" : "AI_FAILED");
}

export async function classifyIntent(transcript: string): Promise<Intent> {
  const text = await generate(transcript, {
    temperature: 0.1,
    systemInstruction: CLASSIFIER_PROMPT,
    responseMimeType: "application/json",
    responseSchema: intentSchema,
  });
  let parsed: Partial<Intent> & { price?: string };
  try {
    parsed = JSON.parse(text) as Intent;
  } catch (error) {
    console.error("Gemini classifier returned invalid JSON", error);
    return { intent: "chat", foodQuery: "", areaText: "", wantsNearby: false, openNow: false };
  }
  const intent = parsed.intent ?? "chat";
  const price = parsed.price;
  return {
    intent,
    foodQuery: typeof parsed.foodQuery === "string" ? parsed.foodQuery.slice(0, 80) : "",
    areaText: typeof parsed.areaText === "string" ? parsed.areaText.slice(0, 80) : "",
    wantsNearby: Boolean(parsed.wantsNearby),
    minRating: typeof parsed.minRating === "number" ? parsed.minRating : undefined,
    price: price === "inexpensive" || price === "moderate" || price === "expensive" || price === "very_expensive" ? price : undefined,
    openNow: Boolean(parsed.openNow),
  };
}

export async function composeReply(input: {
  companionName: string;
  companionStyle: string;
  preferences: PreferenceView | null;
  history: { sender: "user" | "assistant"; content: string }[];
  latest: string;
  attachment?: { mimeType: string; data: string };
  search: { status: SearchStatus; note?: string; results: Restaurant[] };
  replyLanguage?: ReplyLanguage;
}): Promise<string> {
  const contents: Content[] = [
    ...input.history.map((message) => ({
      role: message.sender === "user" ? ("user" as const) : ("model" as const),
      parts: [{ text: message.content }],
    })),
    {
      role: "user",
      parts: [
        { text: input.latest },
        ...(input.attachment ? [{ inlineData: { mimeType: input.attachment.mimeType, data: input.attachment.data } }] : []),
      ],
    },
  ];
  return generate(contents, {
    temperature: 0.7,
    maxOutputTokens: input.attachment ? 700 : 280,
    systemInstruction: systemPrompt({ ...input, fileAttached: Boolean(input.attachment) }),
  });
}
