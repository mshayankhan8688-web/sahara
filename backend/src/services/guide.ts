import type { ReplyLanguage } from "../lib/replyLanguage.js";
import { Companion, DEFAULT_COMPANION, professionalStyle } from "../models/Companion.js";
import { composeReply } from "./gemini.js";
import { loadPreferences } from "./chat.js";

const notes = {
  study:
    "This is student help. Explain in simple steps. Say the answer should be checked and is not a guaranteed grade or a substitute for the course.",
  career:
    "This is career guidance. Do not invent employers, job openings, salaries, or application links. If they ask for live jobs, say live listings are not connected.",
  day: "Help them plan a realistic day from what they wrote. Keep it short and practical.",
} as const;

export async function writeGuide(userId: string, kind: keyof typeof notes, prompt: string, replyLanguage?: ReplyLanguage): Promise<string> {
  const companion = await Companion.findOne({ userId, isDefault: true });
  if (companion?.style.includes("Reply only in professional English.") || companion?.style.includes("Match the language the person wrote: clear English")) {
    companion.style = professionalStyle(companion.style);
    await companion.save();
  }
  const preferences = await loadPreferences(userId);
  return composeReply({
    companionName: companion?.name ?? "SAHARA",
    companionStyle: companion?.style ?? DEFAULT_COMPANION.style,
    preferences,
    history: [],
    latest: `${notes[kind]}\n\n${prompt}`,
    search: { status: "not_requested", results: [] },
    replyLanguage,
  });
}
