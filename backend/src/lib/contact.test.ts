import assert from "node:assert/strict";
import test from "node:test";
import { readIdentifier } from "./contact.js";

test("routes a reset code to email or phone", () => {
  assert.deepEqual(readIdentifier("Ada@HeartSpace.test"), { channel: "email", destination: "ada@heartspace.test" });
  assert.deepEqual(readIdentifier("03001234567"), { channel: "phone", destination: "+923001234567" });
  assert.equal(readIdentifier("not-a-contact"), null);
});
