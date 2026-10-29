/** Client-side cleanup for over-escaped model output before preview. */
export function normalizeStudioMarkdown(input: string): string {
  let text = input.replace(/\r\n/g, "\n").trim();
  if (!text) return "";
  text = text.replace(/\\([\\`*_{}\[\]()#+\-.!>])/g, "$1");
  text = text.replace(/\\\*\*/g, "**");
  text = text.replace(/\\_{1,2}/g, "_");
  text = text.replace(/\\---+/g, "---");
  text = text.replace(/^[ \t]*[●•▪◦◆◇►▸]\s+/gm, "- ");
  text = text
    .split("\n")
    .filter((line) => {
      const trimmed = line.trim();
      if (!trimmed) return true;
      if (/^(here is|here's|below is|i('ve| have) (prepared|created|written)|note:|disclaimer:)\b/i.test(trimmed)) {
        return false;
      }
      if (/font colou?r|change the (font|colour|color)\b/i.test(trimmed)) return false;
      return true;
    })
    .join("\n");
  return text.replace(/\n{3,}/g, "\n\n").trim();
}
