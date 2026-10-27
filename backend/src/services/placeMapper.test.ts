import assert from "node:assert/strict";
import test from "node:test";
import { mapPlace } from "./placeMapper.js";

test("omits rating, hours, and distance when the provider did not send them", () => {
  const restaurant = mapPlace({
    id: "abc",
    displayName: { text: "Example Kitchen" },
    formattedAddress: "12 Market Road",
  });
  assert.ok(restaurant);
  assert.equal(restaurant.name, "Example Kitchen");
  assert.equal(restaurant.address, "12 Market Road");
  assert.equal("rating" in restaurant, false);
  assert.equal("openNow" in restaurant, false);
  assert.equal("weekdayHours" in restaurant, false);
  assert.equal("distanceKm" in restaurant, false);
  assert.equal("priceLabel" in restaurant, false);
});

test("calculates distance only when both coordinates exist", () => {
  const restaurant = mapPlace(
    {
      id: "abc",
      displayName: { text: "Near Kitchen" },
      location: { latitude: 31.52, longitude: 74.35 },
      rating: 4.4,
      userRatingCount: 80,
      priceLevel: "PRICE_LEVEL_MODERATE",
      currentOpeningHours: { openNow: true },
    },
    { latitude: 31.5, longitude: 74.34 },
  );
  assert.ok(restaurant);
  assert.equal(restaurant.rating, 4.4);
  assert.equal(restaurant.priceLabel, "Moderate");
  assert.equal(restaurant.openNow, true);
  assert.equal(typeof restaurant.distanceKm, "number");
});

test("drops a place with no name", () => {
  assert.equal(mapPlace({ id: "abc" }), null);
});
