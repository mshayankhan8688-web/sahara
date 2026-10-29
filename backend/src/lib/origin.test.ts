import assert from "node:assert/strict";
import test from "node:test";
import { isAllowedOrigin } from "./origin.js";

test("allows the configured site and other local dev ports", () => {
  assert.equal(isAllowedOrigin(undefined, "http://localhost:5173"), true);
  assert.equal(isAllowedOrigin("http://localhost:5173", "http://localhost:5173"), true);
  assert.equal(isAllowedOrigin("http://localhost:5175", "http://localhost:5173"), true);
  assert.equal(isAllowedOrigin("http://127.0.0.1:5173", "http://localhost:5173"), true);
  assert.equal(isAllowedOrigin("https://example.com", "http://localhost:5173"), false);
});

test("keeps a public site limited to its own address", () => {
  const site = "https://sahara-eight-omega.vercel.app";
  assert.equal(isAllowedOrigin(site, site), true);
  assert.equal(isAllowedOrigin("http://localhost:5175", site), false);
  assert.equal(isAllowedOrigin("https://example.com", site), false);
});
