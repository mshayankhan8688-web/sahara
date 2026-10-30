import mongoose, { Schema } from "mongoose";

export const COMPANION_APPEARANCES = ["female", "male", "neutral"] as const;
export type CompanionAppearance = (typeof COMPANION_APPEARANCES)[number];

const companionSchema = new Schema(
  {
    userId: { type: Schema.Types.ObjectId, ref: "User", required: true, index: true },
    name: { type: String, required: true, trim: true, maxlength: 40 },
    description: { type: String, default: "", maxlength: 400 },
    style: { type: String, required: true, maxlength: 800 },
    appearance: { type: String, enum: COMPANION_APPEARANCES, default: "female" },
    isDefault: { type: Boolean, default: false },
  },
  { timestamps: true },
);

const SHARED_VOICE =
  "You are an AI companion — not a human, therapist, or doctor. Do not assume the user's gender or identity from your avatar. Follow the reply-language instruction. Listen first; acknowledge feelings before advice. Be conversational and specific — never reuse the same scripted reply. Use a light emoji only when it fits; skip emojis for formal study or serious/safety topics. Ask one gentle follow-up when it helps. Keep replies warm and reasonably brief. Do not encourage emotional dependency.";

export const DEFAULT_COMPANION = {
  name: "Safa",
  description: "Female AI companion — friendly, caring, and supportive.",
  appearance: "female" as CompanionAppearance,
  style: `You are Safa, a warm AI companion. ${SHARED_VOICE}`,
};

/** Appearance presets users can pick. Voice stays supportive for every option — not stereotyped. */
export const COMPANION_APPEARANCE_PRESETS = [
  {
    appearance: "female" as CompanionAppearance,
    name: "Safa",
    description: "Female AI companion — friendly, caring, and supportive.",
    style: DEFAULT_COMPANION.style,
  },
  {
    appearance: "male" as CompanionAppearance,
    name: "Rayyan",
    description: "Male AI companion — friendly, calm, and supportive.",
    style: `You are Rayyan, a warm AI companion. ${SHARED_VOICE}`,
  },
  {
    appearance: "neutral" as CompanionAppearance,
    name: "SAHARA",
    description: "AI companion with a neutral appearance — friendly and supportive.",
    style: `You are SAHARA, a warm AI companion. ${SHARED_VOICE}`,
  },
] as const;

/** Optional response-style presets for the Companion page (change style text, not a second companion). */
export const COMPANION_STYLE_PRESETS = [
  {
    id: "friendly",
    label: "Friendly",
    style:
      "Friendly and chatty AI companion. Match the user's language. Keep replies warm, natural, and short. Light emoji only when it fits. Ask one follow-up. You are AI, not a person.",
  },
  {
    id: "calm",
    label: "Calm",
    style:
      "Calm, steady AI companion. Soft tone, no rush. Acknowledge feelings, keep sentences simple, avoid hype. Rare emoji. You are AI, not a therapist.",
  },
  {
    id: "motivational",
    label: "Motivational",
    style:
      "Encouraging AI companion. Notice effort, suggest one small next step, stay realistic. Match language. Light ✨ only when it fits. Not a coach who shouts slogans.",
  },
  {
    id: "emotional",
    label: "Emotional Support",
    style:
      "Supportive AI companion for loneliness, overthinking, and hard days. Validate first, listen more than advise, one gentle question. Soft emoji only when appropriate; never joke about serious distress. You are AI, not a clinician.",
  },
  {
    id: "study",
    label: "Study Companion",
    style:
      "Patient study buddy AI. Clear explanations, short steps, check understanding with one question. Prefer plain language over emoji. Encourage honest learning; no fake citations.",
  },
] as const;

const languageRule = "Follow the reply-language instruction. Match mixed language when the person writes that way.";

/** Known pre-upgrade default Safa style strings stored on Companion documents. */
const LEGACY_SAFA_STYLE_MARKERS = [
  "Warm, brief, and plain-spoken.",
  "You are an AI named Safa, not a person.",
  "Suggest a pause, a walk, water, or a simple meal only when it fits.",
] as const;

export function professionalStyle(style: string): string {
  return style
    .replace("Reply only in professional English.", languageRule)
    .replace("Match the user's language, including Roman Urdu.", languageRule)
    .replace("Match the language the person wrote: clear English, Urdu, or simple Roman Urdu.", languageRule);
}

/** True when this looks like the old default Safa voice (not a user-customized style). */
export function isLegacyDefaultSafaStyle(style: string): boolean {
  const text = style.trim();
  if (!text) return true;
  if (text === DEFAULT_COMPANION.style) return false;
  // Already upgraded emotional style.
  if (text.includes("never reuse the same scripted reply")) return false;
  const hits = LEGACY_SAFA_STYLE_MARKERS.filter((marker) => text.includes(marker)).length;
  return hits >= 2;
}

/**
 * Style used for Gemini system prompts. Upgrades legacy default Safa text in-memory
 * so existing accounts get emotional-support guidance without wiping chat history.
 * Custom companion styles are left alone (after language-rule normalization).
 */
export function effectiveCompanionStyle(name: string, style: string): string {
  const normalized = professionalStyle(style);
  if (name.trim().toLowerCase() === "safa" && isLegacyDefaultSafaStyle(normalized)) {
    return DEFAULT_COMPANION.style;
  }
  return normalized;
}

/** Persist upgraded default Safa style when we detect a legacy string. Never deletes conversations. */
export async function migrateCompanionStyleIfNeeded(companion: {
  name: string;
  style: string;
  save: () => Promise<unknown>;
}): Promise<string> {
  const next = effectiveCompanionStyle(companion.name, companion.style);
  if (next !== companion.style) {
    companion.style = next;
    await companion.save();
  }
  return next;
}

export const Companion = mongoose.model("Companion", companionSchema);
