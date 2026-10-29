import assert from "node:assert/strict";
import { test } from "node:test";
import { inferChatMode } from "./modes.js";

test("infers study, assignment, ppt, and emotion modes", () => {
  assert.equal(inferChatMode("Mujhe programming seekhni hai"), "study");
  assert.equal(inferChatMode("Mera assignment bana do for university"), "assignment");
  assert.equal(inferChatMode("University ki PPT bana do on OS"), "ppt");
  assert.equal(inferChatMode("Yaar main bohat sad hoon"), "emotion");
  assert.equal(inferChatMode("Mujhe exam ke liye prepare karao"), "exam");
  assert.equal(inferChatMode("Generate a beautiful sunset landscape"), "image");
  assert.equal(inferChatMode("Create a UML diagram for login"), "image");
});
