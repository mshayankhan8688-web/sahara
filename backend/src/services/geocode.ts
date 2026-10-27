import { HttpError } from "../http.js";

export const PLACE_USER_AGENT = "SAHARA/0.1 (https://sahara-eight-omega.vercel.app)";

export type PlaceMatch = {
  label: string;
  latitude: number;
  longitude: number;
  kind?: string;
};

const headers = {
  "User-Agent": PLACE_USER_AGENT,
  Accept: "application/json",
  "Accept-Language": "en",
};

export function nominatimSearchUrl(query: string): string {
  const url = new URL("https://nominatim.openstreetmap.org/search");
  url.searchParams.set("format", "jsonv2");
  url.searchParams.set("addressdetails", "1");
  url.searchParams.set("limit", "5");
  url.searchParams.set("q", query);
  return url.toString();
}

export function photonSearchUrl(query: string): string {
  const url = new URL("https://photon.komoot.io/api/");
  url.searchParams.set("q", query);
  url.searchParams.set("limit", "5");
  return url.toString();
}

export function nominatimReverseUrl(latitude: number, longitude: number): string {
  const url = new URL("https://nominatim.openstreetmap.org/reverse");
  url.searchParams.set("format", "jsonv2");
  url.searchParams.set("lat", String(latitude));
  url.searchParams.set("lon", String(longitude));
  return url.toString();
}

export function photonReverseUrl(latitude: number, longitude: number): string {
  const url = new URL("https://photon.komoot.io/reverse");
  url.searchParams.set("lat", String(latitude));
  url.searchParams.set("lon", String(longitude));
  return url.toString();
}

function finite(value: unknown): number | undefined {
  const number = typeof value === "number" ? value : typeof value === "string" ? Number(value) : Number.NaN;
  return Number.isFinite(number) ? number : undefined;
}

function text(value: unknown): string {
  return typeof value === "string" ? value.trim() : "";
}

export function parseNominatimSearch(value: unknown): PlaceMatch[] {
  if (!Array.isArray(value)) return [];
  const matches: PlaceMatch[] = [];
  for (const item of value) {
    if (!item || typeof item !== "object") continue;
    const row = item as Record<string, unknown>;
    const latitude = finite(row.lat);
    const longitude = finite(row.lon);
    const label = text(row.display_name);
    if (latitude === undefined || longitude === undefined || !label) continue;
    const kind = text(row.addresstype) || text(row.type);
    matches.push({ label, latitude, longitude, ...(kind ? { kind } : {}) });
    if (matches.length === 5) break;
  }
  return matches;
}

export function parsePhotonPlaces(value: unknown): PlaceMatch[] {
  const record = value && typeof value === "object" ? (value as { features?: unknown }) : null;
  const features = Array.isArray(record?.features) ? record.features : [];
  const matches: PlaceMatch[] = [];
  for (const feature of features) {
    if (!feature || typeof feature !== "object") continue;
    const row = feature as { geometry?: { coordinates?: unknown }; properties?: Record<string, unknown> };
    const coordinates = row.geometry?.coordinates;
    if (!Array.isArray(coordinates) || coordinates.length < 2) continue;
    const longitude = finite(coordinates[0]);
    const latitude = finite(coordinates[1]);
    const props = row.properties ?? {};
    const parts = [text(props.name), text(props.city), text(props.state), text(props.country)].filter(
      (part, index, all) => part.length > 0 && all.indexOf(part) === index,
    );
    if (latitude === undefined || longitude === undefined || parts.length === 0) continue;
    const kind = text(props.type) || text(props.osm_value);
    matches.push({ label: parts.join(", "), latitude, longitude, ...(kind ? { kind } : {}) });
    if (matches.length === 5) break;
  }
  return matches;
}

export function parseNominatimReverse(value: unknown): string | null {
  if (!value || typeof value !== "object" || Array.isArray(value)) return null;
  const row = value as Record<string, unknown>;
  if (typeof row.error === "string") return null;
  const label = text(row.display_name);
  return label || null;
}

type ProviderResult = { ok: true; body: unknown } | { ok: false; status: number };

async function readJson(url: string): Promise<ProviderResult> {
  try {
    const response = await fetch(url, { headers, signal: AbortSignal.timeout(12000) });
    if (!response.ok) return { ok: false, status: response.status };
    return { ok: true, body: (await response.json()) as unknown };
  } catch (error) {
    console.error("Place provider request failed", error);
    return { ok: false, status: 0 };
  }
}

function providerError(status: number, message: string): HttpError {
  if (status === 429) {
    return new HttpError(429, "The place directory is busy. Try again in a moment.", "PLACES_BUSY");
  }
  return new HttpError(502, message, "PLACES_FAILED");
}

export async function searchPlaces(query: string): Promise<PlaceMatch[]> {
  const trimmed = query.trim();
  if (!trimmed) return [];
  const nominatim = await readJson(nominatimSearchUrl(trimmed));
  if (nominatim.ok) return parseNominatimSearch(nominatim.body);
  const photon = await readJson(photonSearchUrl(trimmed));
  if (photon.ok) return parsePhotonPlaces(photon.body);
  throw providerError(nominatim.status || photon.status, "The city search could not be reached. Try again.");
}

export async function reversePlace(latitude: number, longitude: number): Promise<string | null> {
  const nominatim = await readJson(nominatimReverseUrl(latitude, longitude));
  if (nominatim.ok) return parseNominatimReverse(nominatim.body);
  const photon = await readJson(photonReverseUrl(latitude, longitude));
  if (photon.ok) {
    const body = photon.body;
    const wrapped = body && typeof body === "object" && "features" in body ? body : { features: [body] };
    return parsePhotonPlaces(wrapped)[0]?.label ?? null;
  }
  throw providerError(nominatim.status || photon.status, "A street address could not be looked up. Try again.");
}
