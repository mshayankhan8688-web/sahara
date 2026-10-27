export type SpeechScript = "urdu" | "arabic" | "hindi" | "gurmukhi" | "latin";

export type VoiceChoice = { lang: string };

const urduLetters = /[ٹڈڑںھےپچگک]/;

export function textDirection(text: string): "rtl" | "ltr" {
  const script = speechScript(text);
  return script === "urdu" || script === "arabic" ? "rtl" : "ltr";
}

export function speechScript(text: string): SpeechScript {
  if (/[\u0A00-\u0A7F]/.test(text)) return "gurmukhi";
  if (/[\u0900-\u097F]/.test(text)) return "hindi";
  if (/[\u0600-\u06FF\u0750-\u077F\u08A0-\u08FF]/.test(text)) {
    return urduLetters.test(text) ? "urdu" : "arabic";
  }
  return "latin";
}

export function preferredLangs(script: SpeechScript, selectedLang: string): string[] {
  if (script === "urdu") return ["ur-PK", "ur-IN", "ur"];
  if (script === "arabic") return ["ar-SA", "ar", "ar-EG"];
  if (script === "hindi") return ["hi-IN", "hi"];
  if (script === "gurmukhi") return ["pa-IN", "pa"];
  const selected = /^(en|fr|es|de|it|pt|nl|tr)/i.test(selectedLang) ? selectedLang : "en-US";
  return selected === "en-US" ? ["en-US", "en"] : [selected, "en-US", "en"];
}

export function pickVoice<T extends VoiceChoice>(voices: T[], langs: string[]): T | null {
  for (const lang of langs) {
    const exact = voices.find((voice) => voice.lang.toLowerCase() === lang.toLowerCase());
    if (exact) return exact;
    const prefix = lang.split("-")[0].toLowerCase();
    const loose = voices.find((voice) => voice.lang.toLowerCase().startsWith(`${prefix}-`) || voice.lang.toLowerCase() === prefix);
    if (loose) return loose;
  }
  return null;
}
