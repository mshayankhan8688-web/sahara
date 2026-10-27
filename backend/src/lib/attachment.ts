import { HttpError } from "../http.js";

export type ChatAttachment = {
  name: string;
  mimeType: "image/jpeg" | "image/png" | "image/webp" | "image/gif" | "application/pdf" | "text/plain";
  data: string;
};

const MAX_BYTES = 3 * 1024 * 1024;

const allowed = new Set<ChatAttachment["mimeType"]>([
  "image/jpeg",
  "image/png",
  "image/webp",
  "image/gif",
  "application/pdf",
  "text/plain",
]);

function startsWith(bytes: Buffer, signature: number[]): boolean {
  return signature.every((value, index) => bytes[index] === value);
}

function matchesType(mimeType: ChatAttachment["mimeType"], bytes: Buffer): boolean {
  if (mimeType === "image/jpeg") return startsWith(bytes, [0xff, 0xd8, 0xff]);
  if (mimeType === "image/png") return startsWith(bytes, [0x89, 0x50, 0x4e, 0x47]);
  if (mimeType === "image/gif") return startsWith(bytes, [0x47, 0x49, 0x46]);
  if (mimeType === "image/webp") return startsWith(bytes, [0x52, 0x49, 0x46, 0x46]) && bytes.subarray(8, 12).toString("ascii") === "WEBP";
  if (mimeType === "application/pdf") return startsWith(bytes, [0x25, 0x50, 0x44, 0x46]);
  return !bytes.includes(0);
}

export function parseAttachment(input: { name: string; mimeType: string; data: string }): ChatAttachment {
  const mimeType = input.mimeType.trim().toLowerCase();
  if (!allowed.has(mimeType as ChatAttachment["mimeType"])) {
    throw new HttpError(400, "Attach a JPEG, PNG, WebP, GIF, PDF, or text file.", "FILE_TYPE");
  }
  const baseName = input.name.split(/[/\\]/).pop() ?? "file";
  const name = baseName.replace(/[^\w.\- ()]/g, "").replace(/^\.+/, "").trim().slice(0, 80) || "file";
  const data = input.data.replace(/\s/g, "");
  if (!/^[A-Za-z0-9+/]+={0,2}$/.test(data)) {
    throw new HttpError(400, "That file could not be read.", "FILE_DATA");
  }
  const bytes = Buffer.from(data, "base64");
  if (bytes.length === 0 || bytes.length > MAX_BYTES) {
    throw new HttpError(400, "Each file must be between 1 byte and 3 MB.", "FILE_SIZE");
  }
  const typed = mimeType as ChatAttachment["mimeType"];
  if (!matchesType(typed, bytes)) {
    throw new HttpError(400, "That file does not match its type.", "FILE_TYPE");
  }
  return { name, mimeType: typed, data };
}
