import mammoth from "mammoth";
import { HttpError } from "../http.js";

const DOCX =
  "application/vnd.openxmlformats-officedocument.wordprocessingml.document";
const MAX_CHARS = 40_000;

function looksLikeZip(buffer: Buffer): boolean {
  return buffer.length >= 4 && buffer[0] === 0x50 && buffer[1] === 0x4b;
}

/** Extract plain text from DOCX so Gemini can use it without Office MIME support. */
export async function extractOfficeText(input: {
  name: string;
  mimeType: string;
  data: string;
}): Promise<{ name: string; text: string } | null> {
  const mime = (input.mimeType.toLowerCase().split(";")[0] ?? "").trim();
  const isDocx =
    mime === DOCX ||
    mime === "application/msword" ||
    /\.docx$/i.test(input.name) ||
    /\.doc$/i.test(input.name);
  if (!isDocx) return null;

  let buffer: Buffer;
  try {
    buffer = Buffer.from(input.data, "base64");
  } catch {
    throw new HttpError(400, "That document could not be decoded.", "BAD_ATTACHMENT");
  }
  if (buffer.length === 0) throw new HttpError(400, "That document is empty.", "EMPTY_ATTACHMENT");
  if (buffer.length > 3 * 1024 * 1024) {
    throw new HttpError(400, "Keep uploaded documents under 3 MB.", "ATTACHMENT_TOO_LARGE");
  }
  if (mime === DOCX || /\.docx$/i.test(input.name)) {
    if (!looksLikeZip(buffer)) {
      throw new HttpError(400, "That does not look like a valid Word document.", "BAD_ATTACHMENT");
    }
  }

  try {
    const result = await mammoth.extractRawText({ buffer });
    const text = result.value.replace(/\s+/g, " ").trim().slice(0, MAX_CHARS);
    if (!text) throw new HttpError(400, "No readable text was found in that document.", "EMPTY_ATTACHMENT");
    return { name: input.name.slice(0, 80), text };
  } catch (error) {
    if (error instanceof HttpError) throw error;
    console.error("DOCX extraction failed", error);
    throw new HttpError(400, "SAHARA could not read that Word document.", "ATTACHMENT_UNREADABLE");
  }
}
