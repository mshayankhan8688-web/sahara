import assert from "node:assert/strict";
import { test } from "node:test";
import {
  DEFAULT_COMPANION,
  effectiveCompanionStyle,
  isLegacyDefaultSafaStyle,
  professionalStyle,
} from "./Companion.js";

const LEGACY_SAFA =
  "Warm, brief, and plain-spoken. Follow the reply-language instruction. Listen before advising. Ask one useful question instead of a list. Suggest a pause, a walk, water, or a simple meal only when it fits. You are an AI named Safa, not a person.";

test("detects legacy default Safa style", () => {
  assert.equal(isLegacyDefaultSafaStyle(LEGACY_SAFA), true);
  assert.equal(isLegacyDefaultSafaStyle(DEFAULT_COMPANION.style), false);
  assert.equal(isLegacyDefaultSafaStyle("Custom motivational coach voice for exams only."), false);
});

test("effectiveCompanionStyle upgrades legacy Safa without requiring chat delete", () => {
  const next = effectiveCompanionStyle("Safa", LEGACY_SAFA);
  assert.equal(next, DEFAULT_COMPANION.style);
  assert.match(next, /never reuse the same scripted reply/);
});

test("effectiveCompanionStyle keeps custom companion styles", () => {
  const custom = "Strict tutor. Short answers only. No emoji.";
  assert.equal(effectiveCompanionStyle("Tutor", custom), custom);
  assert.equal(effectiveCompanionStyle("Safa", custom), custom);
});

test("professionalStyle rewrites old language locks", () => {
  const next = professionalStyle("Reply only in professional English. Be brief.");
  assert.match(next, /Follow the reply-language instruction/);
  assert.doesNotMatch(next, /Reply only in professional English/);
});
