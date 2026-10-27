import { config, placesConfigured } from "../config.js";
import { HttpError } from "../http.js";
import { mapPlaces, type Restaurant } from "./placeMapper.js";
import { getOpenStreetMapPlace, searchOpenStreetMap } from "./osm.js";

const FIELD_MASK = [
  "places.id",
  "places.displayName",
  "places.formattedAddress",
  "places.location",
  "places.rating",
  "places.userRatingCount",
  "places.priceLevel",
  "places.currentOpeningHours",
  "places.regularOpeningHours",
  "places.websiteUri",
  "places.googleMapsUri",
  "places.photos",
  "places.primaryTypeDisplayName",
  "places.servesVegetarianFood",
  "places.editorialSummary",
  "places.nationalPhoneNumber",
].join(",");

const DETAIL_MASK = FIELD_MASK.replaceAll("places.", "");

const PRICE_LEVELS = {
  inexpensive: "PRICE_LEVEL_INEXPENSIVE",
  moderate: "PRICE_LEVEL_MODERATE",
  expensive: "PRICE_LEVEL_EXPENSIVE",
  very_expensive: "PRICE_LEVEL_VERY_EXPENSIVE",
} as const;

export type PriceFilter = keyof typeof PRICE_LEVELS;

export type SearchInput = {
  query: string;
  latitude?: number;
  longitude?: number;
  area?: string;
  minRating?: number;
  price?: PriceFilter;
  openNow?: boolean;
  category?: "food" | "cafe" | "pharmacy" | "grocery" | "shop";
};

function snapRating(value: number): number {
  const snapped = Math.ceil(value * 2) / 2;
  return Math.min(5, Math.max(0, snapped));
}

function buildQuery(input: SearchInput): string {
  const food = input.query.trim();
  const area = input.area?.trim();
  if (area) return `${food} in ${area}`;
  return food;
}

async function postPlaces(url: string, body: unknown): Promise<unknown> {
  if (!placesConfigured) {
    throw new HttpError(
      503,
      "Restaurant search is not configured. Set GOOGLE_PLACES_API_KEY on the server and enable Places API (New).",
      "PLACES_NOT_CONFIGURED",
    );
  }
  let response: Response;
  try {
    response = await fetch(url, {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        "X-Goog-Api-Key": config.placesApiKey,
        "X-Goog-FieldMask": FIELD_MASK,
      },
      body: JSON.stringify(body),
    });
  } catch (error) {
    console.error("Places API request failed", error);
    throw new HttpError(502, "Restaurant search could not be reached.", "PLACES_FAILED");
  }
  if (!response.ok) {
    const detail = await response.text();
    console.error("Places API rejected the search", response.status, detail.slice(0, 500));
    throw new HttpError(502, "Restaurant search failed. Check that Places API (New) is enabled for this key.", "PLACES_FAILED");
  }
  return response.json() as Promise<unknown>;
}

export async function searchRestaurants(input: SearchInput): Promise<{ results: Restaurant[]; distanceNote?: string; source: "Google Places" | "OpenStreetMap" }> {
  if (!placesConfigured) {
    if (config.nodeEnv === "test") {
      throw new HttpError(
        503,
        "Restaurant search is not configured. Set GOOGLE_PLACES_API_KEY on the server and enable Places API (New).",
        "PLACES_NOT_CONFIGURED",
      );
    }
    return searchOpenStreetMap(input);
  }
  const textQuery = buildQuery(input);
  const body: Record<string, unknown> = {
    textQuery,
    pageSize: 10,
    languageCode: "en",
    includedType: input.category === "cafe" ? "cafe" : input.category === "pharmacy" ? "pharmacy" : input.category === "grocery" ? "supermarket" : input.category === "shop" ? "store" : "restaurant",
  };
  if (input.openNow) body.openNow = true;
  if (typeof input.minRating === "number") body.minRating = snapRating(input.minRating);
  if (input.price) body.priceLevels = [PRICE_LEVELS[input.price]];

  const origin =
    typeof input.latitude === "number" && typeof input.longitude === "number"
      ? { latitude: input.latitude, longitude: input.longitude }
      : undefined;
  if (origin) {
    body.locationBias = {
      circle: {
        center: origin,
        radius: 5000,
      },
    };
  }

  const payload = (await postPlaces("https://places.googleapis.com/v1/places:searchText", body)) as { places?: unknown };
  return {
    results: mapPlaces(payload.places, origin),
    source: "Google Places",
    distanceNote: origin ? "Distance is calculated from the location shared for this search." : undefined,
  };
}

export async function getRestaurant(placeId: string): Promise<Restaurant> {
  if (placeId.startsWith("osm-")) return getOpenStreetMapPlace(placeId);
  if (!/^[A-Za-z0-9_-]+$/.test(placeId)) throw new HttpError(404, "That restaurant was not found.", "NOT_FOUND");
  if (!placesConfigured) {
    throw new HttpError(503, "Restaurant search is not configured.", "PLACES_NOT_CONFIGURED");
  }
  let response: Response;
  try {
    response = await fetch(`https://places.googleapis.com/v1/places/${placeId}`, {
      headers: {
        "X-Goog-Api-Key": config.placesApiKey,
        "X-Goog-FieldMask": DETAIL_MASK,
      },
    });
  } catch (error) {
    console.error("Place details request failed", error);
    throw new HttpError(502, "Restaurant details could not be loaded.", "PLACES_FAILED");
  }
  if (!response.ok) {
    console.error("Place details rejected", response.status);
    throw new HttpError(404, "That restaurant was not found.", "NOT_FOUND");
  }
  const mapped = mapPlaces([await response.json()])[0];
  if (!mapped) throw new HttpError(404, "That restaurant was not found.", "NOT_FOUND");
  return mapped;
}

export async function readPhoto(photoName: string): Promise<{ bytes: ArrayBuffer; contentType: string }> {
  if (!/^places\/[A-Za-z0-9_-]+\/photos\/[A-Za-z0-9_-]+$/.test(photoName)) {
    throw new HttpError(400, "That photo is not available.", "PHOTO_INVALID");
  }
  if (!placesConfigured) throw new HttpError(503, "Restaurant photos are not configured.", "PLACES_NOT_CONFIGURED");
  let meta: Response;
  try {
    meta = await fetch(`https://places.googleapis.com/v1/${photoName}/media?maxHeightPx=480&skipHttpRedirect=true`, {
      headers: { "X-Goog-Api-Key": config.placesApiKey },
    });
  } catch (error) {
    console.error("Place photo lookup failed", error);
    throw new HttpError(502, "The photo could not be loaded.", "PLACES_FAILED");
  }
  if (!meta.ok) throw new HttpError(404, "The photo is not available.", "NOT_FOUND");
  const body = (await meta.json()) as { photoUri?: unknown };
  if (typeof body.photoUri !== "string") throw new HttpError(404, "The photo is not available.", "NOT_FOUND");
  const image = await fetch(body.photoUri);
  if (!image.ok) throw new HttpError(404, "The photo is not available.", "NOT_FOUND");
  return {
    bytes: await image.arrayBuffer(),
    contentType: image.headers.get("content-type") ?? "image/jpeg",
  };
}
