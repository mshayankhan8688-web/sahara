/** Words that rarely make a useful chat title on their own. */
const FILLER = new Set([
  "a",
  "an",
  "the",
  "and",
  "or",
  "but",
  "to",
  "of",
  "in",
  "on",
  "at",
  "for",
  "with",
  "from",
  "i",
  "i'm",
  "im",
  "am",
  "is",
  "are",
  "was",
  "were",
  "be",
  "been",
  "being",
  "have",
  "has",
  "had",
  "do",
  "does",
  "did",
  "will",
  "would",
  "could",
  "should",
  "can",
  "just",
  "really",
  "very",
  "so",
  "too",
  "also",
  "like",
  "want",
  "need",
  "please",
  "that",
  "this",
  "these",
  "those",
  "it",
  "its",
  "it's",
  "yaar",
  "yar",
  "hai",
  "ho",
  "hain",
  "tha",
  "thi",
  "ki",
  "ke",
  "ko",
  "se",
  "mein",
  "main",
  "mujhe",
  "mera",
  "meri",
  "mere",
  "apka",
  "apki",
  "aur",
  "bhi",
  "nahi",
  "nahin",
  "kya",
  "kyun",
  "kyo",
]);

function tokenize(content: string): string[] {
  return content
    .replace(/\s+/g, " ")
    .trim()
    .split(" ")
    .map((word) => word.replace(/^[^0-9A-Za-z\u0600-\u06FF\u0900-\u097F]+|[^0-9A-Za-z\u0600-\u06FF\u0900-\u097F']+$/g, ""))
    .filter(Boolean);
}

/** Collapse consecutive duplicate words (case-insensitive): "hello hello hello" → "hello". */
function collapseRepeats(words: string[]): string[] {
  const out: string[] = [];
  for (const word of words) {
    if (out.length && out[out.length - 1]!.toLowerCase() === word.toLowerCase()) continue;
    out.push(word);
  }
  return out;
}

function capitalizeTitle(title: string): string {
  if (!title) return title;
  return title.charAt(0).toUpperCase() + title.slice(1);
}

function clampTitle(title: string): string {
  if (title.length > 40) return `${title.slice(0, 40).trimEnd()}…`;
  return title;
}

/**
 * Short sidebar-friendly title from the first user message.
 * Prefer ~2–5 words; never dump the whole message.
 */
export function titleFrom(content: string): string {
  const clean = content.replace(/\s+/g, " ").trim();
  if (!clean) return "New chat";

  const collapsed = collapseRepeats(tokenize(clean));
  if (!collapsed.length) return "New chat";

  // Short phrases: keep as-is after repeat collapse (e.g. "Plan my day").
  if (collapsed.length <= 4 && collapsed.join(" ").length <= 28) {
    return clampTitle(capitalizeTitle(collapsed.join(" ")));
  }

  const meaningful = collapsed.filter((word) => !FILLER.has(word.toLowerCase()));
  const pool = meaningful.length >= 2 ? meaningful : collapsed;
  const count = Math.min(pool.length, meaningful.length >= 2 ? 3 : Math.min(5, pool.length));
  const title = clampTitle(capitalizeTitle(pool.slice(0, Math.max(1, count)).join(" ")));
  return title.length < 2 ? "New chat" : title;
}
