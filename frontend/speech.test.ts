import assert from "node:assert/strict";
import test from "node:test";
import { pickVoice, preferredLangs, speechScript } from "./src/lib/speech.ts";

test("keeps Urdu script, Arabic, Hindi, and Roman Urdu apart", () => {
  assert.equal(speechScript("مجھے پڑھائی کا شیڈول بنا دو۔"), "urdu");
  assert.equal(speechScript("اشرح لي هذا الموضوع."), "arabic");
  assert.equal(speechScript("मुझे एक योजना चाहिए।"), "hindi");
  assert.equal(speechScript("Mujhe study plan bana do."), "latin");
});

test("does not use an Urdu voice for Roman Urdu", () => {
  assert.deepEqual(preferredLangs("latin", "ur-PK"), ["en-US", "en"]);
  assert.deepEqual(preferredLangs("urdu", "en-US"), ["ur-PK", "ur-IN", "ur"]);
});

test("picks a matching voice and refuses a different language", () => {
  const voices = [{ lang: "en-US" }, { lang: "ur-PK" }];
  assert.equal(pickVoice(voices, ["ur-PK", "ur"])?.lang, "ur-PK");
  assert.equal(pickVoice([{ lang: "en-US" }], ["ur-PK", "ur"]), null);
});
