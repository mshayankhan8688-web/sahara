import assert from "node:assert/strict";
import test from "node:test";
import { parseAttachment } from "./attachment.js";

const png = "iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAYAAAAfFcSJAAAADUlEQVR42mP8z8BQDwAEhQGAhKmMIQAAAABJRU5ErkJggg==";

test("accepts a real PNG and rejects a mismatched type", () => {
  const file = parseAttachment({ name: "../notes.png", mimeType: "image/png", data: png });
  assert.equal(file.name, "notes.png");
  assert.equal(file.mimeType, "image/png");
  assert.throws(() => parseAttachment({ name: "notes.png", mimeType: "image/jpeg", data: png }), /does not match/);
});

test("accepts plain text and rejects an empty file", () => {
  const data = Buffer.from("Interview notes", "utf8").toString("base64");
  const file = parseAttachment({ name: "notes.txt", mimeType: "text/plain", data });
  assert.equal(file.mimeType, "text/plain");
  assert.throws(() => parseAttachment({ name: "empty.txt", mimeType: "text/plain", data: "" }), /could not be read|1 byte/);
});
