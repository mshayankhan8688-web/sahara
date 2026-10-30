/**
 * One-shot non-sensitive Gemini smoke for emotional companion prompts.
 * Does not print API keys. Exit 0 = PASS, 2 = BLOCKED/NO_KEY, 1 = FAIL.
 */
import { readFileSync } from "node:fs";

const envPath = new URL("../.env", import.meta.url);
const env = Object.fromEntries(
  readFileSync(envPath, "utf8")
    .split(/\r?\n/)
    .filter((line) => line && !line.trim().startsWith("#") && line.includes("="))
    .map((line) => {
      const index = line.indexOf("=");
      return [line.slice(0, index).trim(), line.slice(index + 1).trim()];
    }),
);

const key = env.GEMINI_API_KEY ?? "";
if (key.length < 20) {
  console.log("LIVE_AI_BLOCKED reason=NO_GEMINI_KEY");
  process.exit(2);
}

for (const [name, value] of Object.entries(env)) process.env[name] = value;
process.env.NODE_ENV = process.env.NODE_ENV || "development";

const { systemPrompt } = await import("../src/services/prompt.ts");
const { composeReply } = await import("../src/services/gemini.ts");

const instruction = systemPrompt({
  companionName: "Safa",
  companionStyle: "Warm legacy placeholder.",
  preferences: null,
  search: { status: "not_requested", results: [] },
  mode: "emotion",
  replyLanguage: "auto",
});

if (!/Listen carefully/i.test(instruction) || !/emoji/i.test(instruction)) {
  console.log("LIVE_AI_FAIL reason=PROMPT_MISSING_EMOTION_RULES");
  process.exit(1);
}

try {
  const reply = await composeReply({
    companionName: "Safa",
    companionStyle: "Warm legacy placeholder.",
    preferences: null,
    history: [],
    latest: "Hi Safa, I had a long study day and feel a bit tired. Just say a short kind hello.",
    search: { status: "not_requested", results: [] },
    mode: "emotion",
    replyLanguage: "english",
    maxOutputTokens: 120,
    timeoutMs: 25_000,
  });
  const text = (reply || "").trim();
  if (text.length < 8) {
    console.log("LIVE_AI_FAIL reason=EMPTY_REPLY");
    process.exit(1);
  }
  const refused = /quota|rate limit|not configured|API key/i.test(text);
  if (refused) {
    console.log(`LIVE_AI_BLOCKED reason=PROVIDER_MESSAGE length=${text.length}`);
    process.exit(2);
  }
  console.log(`LIVE_AI_PASS length=${text.length}`);
  process.exit(0);
} catch (error) {
  const message = error instanceof Error ? error.message : String(error);
  const safe = message.replaceAll(key, "[redacted]").slice(0, 180);
  if (/quota|429|rate|billing|not configured|API_KEY/i.test(safe)) {
    console.log(`LIVE_AI_BLOCKED reason=${safe}`);
    process.exit(2);
  }
  console.log(`LIVE_AI_FAIL reason=${safe}`);
  process.exit(1);
}
