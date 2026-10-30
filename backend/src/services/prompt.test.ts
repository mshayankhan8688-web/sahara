import assert from "node:assert/strict";
import { test } from "node:test";
import { systemPrompt } from "./prompt.js";

const base = {
  companionName: "Safa",
  companionStyle: "Warm old style without emoji guidance.",
  preferences: null,
  search: { status: "not_requested" as const, results: [] },
};

test("emotion mode selects emotional-support instructions over companion style", () => {
  const prompt = systemPrompt({ ...base, mode: "emotion" });
  assert.match(prompt, /Active mode: Emotional Companion/i);
  assert.match(prompt, /Listen carefully/);
  assert.match(prompt, /do not copy a fixed script/i);
  assert.match(prompt, /not a therapist/i);
  assert.match(prompt, /Companion voice[\s\S]*Warm old style/);
  // Safety precedes companion voice.
  assert.ok(prompt.indexOf("not a therapist") < prompt.indexOf("Companion voice"));
});

test("general mode still includes listen-first and emoji guidance for feelings", () => {
  const prompt = systemPrompt({ ...base, mode: "general" });
  assert.match(prompt, /listen first like a supportive companion/i);
  assert.match(prompt, /emoji/i);
  assert.match(prompt, /❤️|🌸|🫂|emoji/i);
});

test("multilingual reply language is embedded for Roman Urdu and Urdu", () => {
  const roman = systemPrompt({ ...base, mode: "emotion", replyLanguage: "roman-urdu" });
  assert.match(roman, /Roman Urdu/i);
  assert.match(roman, /Latin letters/i);

  const urdu = systemPrompt({ ...base, mode: "emotion", replyLanguage: "urdu" });
  assert.match(urdu, /Urdu script/i);
  assert.doesNotMatch(urdu, /Answer in simple Roman Urdu/);
});

test("emoji guide warns against overuse and broken escapes", () => {
  const prompt = systemPrompt({ ...base, mode: "emotion" });
  assert.match(prompt, /Do not put an emoji in every sentence/i);
  assert.match(prompt, /broken Unicode/i);
});

test("study mode does not use emotion listen-first script", () => {
  const prompt = systemPrompt({ ...base, mode: "study" });
  assert.match(prompt, /Active mode: Study/i);
  assert.doesNotMatch(prompt, /do not copy a fixed script/i);
  assert.match(prompt, /academic/i);
  assert.match(prompt, /MCQs|practice questions/i);
});

test("general mode asks for practical non-repetitive replies", () => {
  const prompt = systemPrompt({ ...base, mode: "general" });
  assert.match(prompt, /Roman Urdu/i);
  assert.match(prompt, /scripted reply/i);
  assert.match(prompt, /Never pretend to be a human/i);
});
