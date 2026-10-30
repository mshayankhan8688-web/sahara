import type { Companion, CompanionAppearance } from "@/lib/types";

export const COMPANIONS_CHANGED = "sahara:companions-changed";
export const COMPANION_KEY = "sahara.companionId";

export function notifyCompanionsChanged() {
  window.dispatchEvent(new Event(COMPANIONS_CHANGED));
}

export function readStoredCompanionId(): string {
  try {
    return localStorage.getItem(COMPANION_KEY) ?? "";
  } catch {
    return "";
  }
}

export function writeStoredCompanionId(id: string) {
  try {
    localStorage.setItem(COMPANION_KEY, id);
  } catch (error) {
    console.error("Failed to save companion preference", error);
  }
}

export function companionAppearanceOf(companion: Pick<Companion, "name" | "appearance"> | null | undefined): CompanionAppearance {
  if (companion?.appearance === "female" || companion?.appearance === "male" || companion?.appearance === "neutral") {
    return companion.appearance;
  }
  const key = companion?.name?.trim().toLowerCase() ?? "";
  if (key === "rayyan") return "male";
  if (key === "sahara" || key === "nova") return "neutral";
  return "female";
}

/** Cards shown on the Companion page — applied to the user's account companions. */
export const APPEARANCE_PRESETS = [
  {
    appearance: "female" as CompanionAppearance,
    name: "Safa",
    description: "Female AI companion — friendly, caring, and supportive.",
    style:
      "You are Safa, a warm AI companion. You are an AI companion — not a human, therapist, or doctor. Do not assume the user's gender or identity from your avatar. Follow the reply-language instruction. Listen first; acknowledge feelings before advice. Be conversational and specific — never reuse the same scripted reply. Use a light emoji only when it fits; skip emojis for formal study or serious/safety topics. Ask one gentle follow-up when it helps. Keep replies warm and reasonably brief. Do not encourage emotional dependency.",
  },
  {
    appearance: "male" as CompanionAppearance,
    name: "Rayyan",
    description: "Male AI companion — friendly, calm, and supportive.",
    style:
      "You are Rayyan, a warm AI companion. You are an AI companion — not a human, therapist, or doctor. Do not assume the user's gender or identity from your avatar. Follow the reply-language instruction. Listen first; acknowledge feelings before advice. Be conversational and specific — never reuse the same scripted reply. Use a light emoji only when it fits; skip emojis for formal study or serious/safety topics. Ask one gentle follow-up when it helps. Keep replies warm and reasonably brief. Do not encourage emotional dependency.",
  },
  {
    appearance: "neutral" as CompanionAppearance,
    name: "SAHARA",
    description: "AI companion with a neutral appearance — friendly and supportive.",
    style:
      "You are SAHARA, a warm AI companion. You are an AI companion — not a human, therapist, or doctor. Do not assume the user's gender or identity from your avatar. Follow the reply-language instruction. Listen first; acknowledge feelings before advice. Be conversational and specific — never reuse the same scripted reply. Use a light emoji only when it fits; skip emojis for formal study or serious/safety topics. Ask one gentle follow-up when it helps. Keep replies warm and reasonably brief. Do not encourage emotional dependency.",
  },
] as const;
