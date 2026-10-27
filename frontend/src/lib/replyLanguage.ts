export const replyLanguages = [
  ["auto", "Auto detect"],
  ["english", "English"],
  ["urdu", "Urdu"],
  ["roman-urdu", "Roman Urdu"],
  ["hindi", "Hindi"],
  ["arabic", "Arabic"],
  ["punjabi", "Punjabi"],
  ["pashto", "Pashto"],
  ["french", "French"],
  ["spanish", "Spanish"],
] as const;

export type ReplyLanguage = (typeof replyLanguages)[number][0];

const key = "sahara.replyLanguage";

export function readReplyLanguage(): ReplyLanguage {
  const stored = localStorage.getItem(key);
  return replyLanguages.some(([value]) => value === stored) ? (stored as ReplyLanguage) : "auto";
}

export function writeReplyLanguage(language: ReplyLanguage) {
  localStorage.setItem(key, language);
}

export function speechCode(language: ReplyLanguage): string | null {
  const codes: Partial<Record<ReplyLanguage, string>> = {
    english: "en-US",
    urdu: "ur-PK",
    "roman-urdu": "en-US",
    hindi: "hi-IN",
    arabic: "ar",
    punjabi: "pa-IN",
    pashto: "ps",
    french: "fr-FR",
    spanish: "es-ES",
  };
  return codes[language] ?? null;
}
