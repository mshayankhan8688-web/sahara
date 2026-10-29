export function titleFrom(content: string): string {
  const clean = content.replace(/\s+/g, " ").trim();
  if (!clean) return "New chat";
  const words = clean.split(" ").slice(0, 6).join(" ");
  if (words.length <= 48) return words;
  return `${words.slice(0, 48).trimEnd()}…`;
}
