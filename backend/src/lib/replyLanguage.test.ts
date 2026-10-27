import assert from "node:assert/strict";
import test from "node:test";
import { languageInstruction } from "./replyLanguage.js";

test("auto detect follows the latest message and mixed writing", () => {
  const text = languageInstruction("auto");
  assert.match(text, /latest message/);
  assert.match(text, /Roman Urdu, written with Latin letters/);
  assert.match(text, /not Urdu script/);
  assert.match(text, /Earlier messages do not/);
  assert.doesNotMatch(text, /Do not mix languages/);
});

test("a selected language is explicit and can still be overridden", () => {
  const text = languageInstruction("urdu");
  assert.match(text, /Urdu script/);
  assert.match(text, /explicitly requests another language/);
});
