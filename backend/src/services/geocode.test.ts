import assert from "node:assert/strict";
import test from "node:test";
import {
  nominatimSearchUrl,
  parseNominatimReverse,
  parseNominatimSearch,
  parsePhotonPlaces,
  photonSearchUrl,
} from "./geocode.js";

test("city search asks the provider for the typed place", () => {
  const lahore = nominatimSearchUrl("Lahore");
  const swabi = nominatimSearchUrl("Swabi");
  assert.equal(lahore.includes("q=Lahore"), true);
  assert.equal(swabi.includes("q=Swabi"), true);
  assert.equal(lahore === swabi, false);
  assert.equal(photonSearchUrl("Islamabad").includes("q=Islamabad"), true);
});

test("geocoding keeps only places the provider returned", () => {
  const matches = parseNominatimSearch([
    { lat: "31.5656822", lon: "74.3141829", display_name: "Lahore, Pakistan", addresstype: "city" },
    { lat: "bad", lon: "74.3", display_name: "Broken" },
    { display_name: "Missing coordinates" },
  ]);
  assert.deepEqual(matches, [{ label: "Lahore, Pakistan", latitude: 31.5656822, longitude: 74.3141829, kind: "city" }]);

  const swabi = parsePhotonPlaces({
    features: [
      {
        geometry: { coordinates: [72.4743164, 34.1262144] },
        properties: { name: "Swabi", state: "Khyber Pakhtunkhwa", country: "Pakistan", type: "city" },
      },
    ],
  });
  assert.equal(swabi[0]?.label, "Swabi, Khyber Pakhtunkhwa, Pakistan");
  assert.equal(swabi[0]?.label.includes("Lahore"), false);
});

test("reverse geocoding uses the address the provider sent", () => {
  assert.equal(parseNominatimReverse({ display_name: "Gulberg, Lahore, Pakistan" }), "Gulberg, Lahore, Pakistan");
  assert.equal(parseNominatimReverse({ error: "Unable to geocode" }), null);
  assert.equal(parseNominatimReverse(null), null);
});
