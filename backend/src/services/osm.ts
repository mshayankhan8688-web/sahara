import { HttpError } from "../http.js";
import { PLACE_USER_AGENT, searchPlaces, type PlaceMatch } from "./geocode.js";
import type { Restaurant } from "./placeMapper.js";

export type PlaceCategory = "food" | "cafe" | "pharmacy" | "grocery" | "shop";

type SearchInput = {
  query: string;
  latitude?: number;
  longitude?: number;
  area?: string;
  minRating?: number;
  price?: string;
  openNow?: boolean;
  category?: PlaceCategory;
};

export function areaMatchesCity(query: string, displayName: string): boolean {
  if (!query.includes(",")) return true;
  const city = query.split(",").map((part) => part.trim()).filter(Boolean).at(-1) ?? "";
  return city.length > 0 && displayName.toLowerCase().includes(city.toLowerCase());
}

const PREFERRED_PLACES = new Set(["suburb", "neighbourhood", "quarter", "city", "town", "administrative", "village", "municipality"]);

export function choosePlace(query: string, matches: PlaceMatch[]): PlaceMatch | undefined {
  const local = matches.filter((item) => areaMatchesCity(query, item.label));
  return local.find((item) => item.kind && PREFERRED_PLACES.has(item.kind)) ?? local[0];
}

function distanceKm(from: { latitude: number; longitude: number }, to: { latitude: number; longitude: number }): number {
  const toRad = (value: number) => (value * Math.PI) / 180;
  const dLat = toRad(to.latitude - from.latitude);
  const dLng = toRad(to.longitude - from.longitude);
  const a =
    Math.sin(dLat / 2) ** 2 +
    Math.cos(toRad(from.latitude)) * Math.cos(toRad(to.latitude)) * Math.sin(dLng / 2) ** 2;
  return Math.round(6371 * 2 * Math.asin(Math.sqrt(a)) * 10) / 10;
}

async function geocode(area: string): Promise<{ latitude: number; longitude: number }> {
  const row = choosePlace(area, await searchPlaces(area));
  if (!row) {
    throw new HttpError(404, "That city or area was not found. Try a clearer name.", "LOCATION_NOT_FOUND");
  }
  return { latitude: row.latitude, longitude: row.longitude };
}

const FOOD = new Set(["restaurant", "fast_food", "cafe"]);
const OSM_TYPE: Record<string, "node" | "way" | "relation"> = { N: "node", W: "way", R: "relation", node: "node", way: "way", relation: "relation" };

type PhotonFeature = {
  geometry?: { coordinates?: [number, number] };
  properties?: {
    name?: string;
    housenumber?: string;
    street?: string;
    city?: string;
    osm_key?: string;
    osm_value?: string;
    osm_type?: string;
    osm_id?: number;
  };
};

function matchesCategory(props: NonNullable<PhotonFeature["properties"]>, category: PlaceCategory): boolean {
  const value = props.osm_value ?? "";
  if (category === "pharmacy") return props.osm_key === "amenity" && value === "pharmacy";
  if (category === "grocery") return props.osm_key === "shop" && ["supermarket", "convenience", "grocery"].includes(value);
  if (category === "shop") return props.osm_key === "shop";
  if (category === "cafe") return props.osm_key === "amenity" && value === "cafe";
  return props.osm_key === "amenity" && FOOD.has(value);
}

function fromPhoton(feature: PhotonFeature, origin: { latitude: number; longitude: number }, category: PlaceCategory): Restaurant | null {
  const props = feature.properties;
  const coords = feature.geometry?.coordinates;
  if (!props?.name || typeof props.osm_id !== "number" || !props.osm_value || !matchesCategory(props, category)) {
    return null;
  }
  const kind = OSM_TYPE[props.osm_type ?? ""];
  if (!kind || !coords || coords.length < 2) return null;
  const [longitude, latitude] = coords;
  if (typeof latitude !== "number" || typeof longitude !== "number") return null;
  const distance = distanceKm(origin, { latitude, longitude });
  if (distance > 20) return null;
  const restaurant: Restaurant = {
    id: `osm-${kind}-${props.osm_id}`,
    name: props.name,
    latitude,
    longitude,
    distanceKm: distance,
    primaryType: props.osm_value,
    mapsUrl: `https://www.google.com/maps/dir/?api=1&destination=${latitude},${longitude}`,
  };
  const address = [props.housenumber, props.street, props.city].filter((part) => part && part.trim()).join(" ");
  if (address) restaurant.address = address;
  return restaurant;
}

function searchBox(origin: { latitude: number; longitude: number }, kilometres: number): string {
  const latitudeSpan = kilometres / 111;
  const longitudeSpan = kilometres / (111 * Math.cos((origin.latitude * Math.PI) / 180));
  return [
    origin.longitude - longitudeSpan,
    origin.latitude - latitudeSpan,
    origin.longitude + longitudeSpan,
    origin.latitude + latitudeSpan,
  ].join(",");
}

async function photon(query: string, origin: { latitude: number; longitude: number }, category: PlaceCategory, kilometres: number): Promise<Restaurant[]> {
  const url = new URL("https://photon.komoot.io/api/");
  url.searchParams.set("q", query.trim() || "restaurant");
  url.searchParams.set("lat", String(origin.latitude));
  url.searchParams.set("lon", String(origin.longitude));
  url.searchParams.set("bbox", searchBox(origin, kilometres));
  url.searchParams.set("limit", "20");
  let response: Response;
  try {
    response = await fetch(url, {
      headers: { "User-Agent": PLACE_USER_AGENT, Accept: "application/json", "Accept-Language": "en" },
      signal: AbortSignal.timeout(15000),
    });
  } catch (error) {
    console.error("OpenStreetMap search failed", error);
    throw new HttpError(502, "Restaurant search could not be reached. Try again.", "PLACES_FAILED");
  }
  if (!response.ok) {
    console.error("OpenStreetMap search rejected", response.status);
    throw new HttpError(502, "Restaurant search failed. Try again.", "PLACES_FAILED");
  }
  const body = (await response.json()) as { features?: PhotonFeature[] };
  const features = Array.isArray(body.features) ? body.features : [];
  return features
    .flatMap((feature) => {
      const restaurant = fromPhoton(feature, origin, category);
      return restaurant ? [restaurant] : [];
    })
    .sort((left, right) => (left.distanceKm ?? 99) - (right.distanceKm ?? 99))
    .slice(0, 10);
}

export async function searchOpenStreetMap(input: SearchInput): Promise<{ results: Restaurant[]; distanceNote: string; source: "OpenStreetMap" }> {
  const origin =
    typeof input.latitude === "number" && typeof input.longitude === "number"
      ? { latitude: input.latitude, longitude: input.longitude }
      : await geocode(input.area ?? "");
  const nearby = await photon(input.query, origin, input.category ?? "food", 8);
  const results = nearby.length > 0 ? nearby : await photon(input.query, origin, input.category ?? "food", 20);
  const skipped = input.minRating || input.price || input.openNow
    ? " Rating, price, and open-now filters were not applied, because this source did not provide them."
    : "";
  return {
    results,
    source: "OpenStreetMap",
    distanceNote: `Places are from OpenStreetMap around this search. Ratings, prices, photos, and opening hours are omitted when the map does not include them.${skipped}`,
  };
}

export async function getOpenStreetMapPlace(placeId: string): Promise<Restaurant> {
  const match = /^osm-(node|way|relation)-(\d+)$/.exec(placeId);
  if (!match) throw new HttpError(404, "That restaurant was not found.", "NOT_FOUND");
  const prefix = match[1] === "node" ? "N" : match[1] === "way" ? "W" : "R";
  const url = new URL("https://nominatim.openstreetmap.org/lookup");
  url.searchParams.set("format", "jsonv2");
  url.searchParams.set("osm_ids", `${prefix}${match[2]}`);
  url.searchParams.set("addressdetails", "1");
  let response: Response;
  try {
    response = await fetch(url, {
      headers: { "User-Agent": PLACE_USER_AGENT, Accept: "application/json", "Accept-Language": "en" },
      signal: AbortSignal.timeout(15000),
    });
  } catch (error) {
    console.error("OpenStreetMap lookup failed", error);
    throw new HttpError(502, "Restaurant details could not be loaded.", "PLACES_FAILED");
  }
  if (!response.ok) throw new HttpError(404, "That restaurant was not found.", "NOT_FOUND");
  const rows = (await response.json()) as Array<{ display_name?: string; name?: string; lat?: string; lon?: string; type?: string }>;
  const row = rows[0];
  if (!row?.name) throw new HttpError(404, "That restaurant was not found.", "NOT_FOUND");
  const restaurant: Restaurant = {
    id: placeId,
    name: row.name,
    mapsUrl: `https://www.openstreetmap.org/${match[1]}/${match[2]}`,
  };
  if (row.display_name) restaurant.address = row.display_name;
  const latitude = Number(row.lat);
  const longitude = Number(row.lon);
  if (Number.isFinite(latitude) && Number.isFinite(longitude)) {
    restaurant.latitude = latitude;
    restaurant.longitude = longitude;
  }
  if (row.type) restaurant.primaryType = row.type;
  return restaurant;
}
