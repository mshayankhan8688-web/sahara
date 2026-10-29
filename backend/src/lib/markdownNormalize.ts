/**
 * Clean model output for display and document export.
 * Unescapes over-escaped markdown without stripping real formatting markers.
 */
export function normalizeStudioMarkdown(input: string): string {
  let text = input.replace(/\r\n/g, "\n").trim();
  if (!text) return "";

  // Common over-escaping from models: \*\*, \#, \---, etc.
  text = text.replace(/\\([\\`*_{}\[\]()#+\-.!>])/g, "$1");
  text = text.replace(/\\\*\*/g, "**");
  text = text.replace(/\\_{1,2}/g, "_");
  text = text.replace(/\\---+/g, "---");

  // Fancy bullets → markdown list markers
  text = text.replace(/^[ \t]*[●•▪◦◆◇►▸]\s+/gm, "- ");

  text = text
    .split("\n")
    .filter((line) => {
      const trimmed = line.trim();
      if (!trimmed) return true;
      if (/^(here is|here's|below is|i('ve| have) (prepared|created|written)|note:|disclaimer:)\b/i.test(trimmed)) {
        return false;
      }
      if (/^(outline and draft|draft outline)\b/i.test(trimmed)) return false;
      if (/font colou?r|change the (font|colour|color)|you can (edit|adjust|modify) (the )?(font|colour|color|formatting)\b/i.test(trimmed)) {
        return false;
      }
      return true;
    })
    .join("\n");

  text = text.replace(/\n{3,}/g, "\n\n").trim();
  return text;
}

/** Remove markdown emphasis markers for plain-text contexts while keeping words. */
export function stripMarkdownMarkers(input: string): string {
  return input
    .replace(/\*\*([^*]+)\*\*/g, "$1")
    .replace(/\*([^*]+)\*/g, "$1")
    .replace(/__([^_]+)__/g, "$1")
    .replace(/_([^_]+)_/g, "$1")
    .replace(/`([^`]+)`/g, "$1")
    .trim();
}
