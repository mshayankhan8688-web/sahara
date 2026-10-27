import assert from "node:assert/strict";
import test from "node:test";
import { choosePlace, areaMatchesCity } from "../services/osm.js";

test("keeps a neighbourhood inside the city the user typed", () => {
  assert.equal(areaMatchesCity("DHA, Lahore", "DHA Phase 5, Lahore, Pakistan"), true);
  assert.equal(areaMatchesCity("DHA, Lahore", "DHA, Karachi, Pakistan"), false);
  assert.equal(areaMatchesCity("Lahore", "Lahore, Pakistan"), true);
});

test("a selected city is the one that matched the query", () => {
  const chosen = choosePlace("DHA, Lahore", [
    { label: "DHA, Karachi, Pakistan", latitude: 24.8, longitude: 67.0, kind: "suburb" },
    { label: "DHA Phase 5, Lahore, Pakistan", latitude: 31.47, longitude: 74.38, kind: "suburb" },
  ]);
  assert.equal(chosen?.label, "DHA Phase 5, Lahore, Pakistan");
  assert.equal(choosePlace("Nowhereville", []), undefined);
});
