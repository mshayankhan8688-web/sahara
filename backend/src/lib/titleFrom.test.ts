import assert from "node:assert/strict";
import { test } from "node:test";
import { titleFrom } from "./titleFrom.js";

test("builds a short title from the first words", () => {
  assert.equal(titleFrom("I want to learn JavaScript this week"), "I want to learn JavaScript this");
  assert.equal(titleFrom("Plan my day"), "Plan my day");
  assert.equal(titleFrom("   "), "New chat");
});
