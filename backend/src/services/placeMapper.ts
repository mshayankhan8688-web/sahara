export type Restaurant = {
  id: string;
  name: string;
  address?: string;
  latitude?: number;
  longitude?: number;
  distanceKm?: number;
  rating?: number;
  ratingCount?: number;
  priceLabel?: string;
  openNow?: boolean;
  weekdayHours?: string[];
  website?: string;
  mapsUrl?: string;
  photoName?: string;
  photoCredit?: string;
  primaryType?: string;
  servesVegetarianFood?: boolean;
  summary?: string;
  phone?: string;
};

const PRICE_LABELS: Record<string, string> = {
  PRICE_LEVEL_INEXPENSIVE: "Inexpensive",
  PRICE_LEVEL_MODERATE: "Moderate",
  PRICE_LEVEL_EXPENSIVE: "Expensive",
  PRICE_LEVEL_VERY_EXPENSIVE: "Very expensive",
  PRICE_LEVEL_FREE: "Free",
};

function distanceKm(from: { latitude: number; longitude: number }, to: { latitude: number; longitude: number }): number {
  const toRad = (value: number) => (value * Math.PI) / 180;
  const dLat = toRad(to.latitude - from.latitude);
  const dLng = toRad(to.longitude - from.longitude);
  const a =
    Math.sin(dLat / 2) ** 2 +
    Math.cos(toRad(from.latitude)) * Math.cos(toRad(to.latitude)) * Math.sin(dLng / 2) ** 2;
  return Math.round(6371 * 2 * Math.asin(Math.sqrt(a)) * 10) / 10;
}

function asRecord(value: unknown): Record<string, unknown> | null {
  return typeof value === "object" && value !== null ? (value as Record<string, unknown>) : null;
}

function textOf(value: unknown): string | undefined {
  const record = asRecord(value);
  return record && typeof record.text === "string" && record.text.trim() ? record.text.trim() : undefined;
}

export function mapPlace(value: unknown, origin?: { latitude: number; longitude: number }): Restaurant | null {
  const place = asRecord(value);
  if (!place || typeof place.id !== "string") return null;
  const name = textOf(place.displayName);
  if (!name) return null;

  const restaurant: Restaurant = { id: place.id, name };
  if (typeof place.formattedAddress === "string" && place.formattedAddress.trim()) {
    restaurant.address = place.formattedAddress.trim();
  }

  const location = asRecord(place.location);
  if (location && typeof location.latitude === "number" && typeof location.longitude === "number") {
    restaurant.latitude = location.latitude;
    restaurant.longitude = location.longitude;
    if (origin) restaurant.distanceKm = distanceKm(origin, { latitude: location.latitude, longitude: location.longitude });
  }

  if (typeof place.rating === "number") restaurant.rating = place.rating;
  if (typeof place.userRatingCount === "number") restaurant.ratingCount = place.userRatingCount;
  if (typeof place.priceLevel === "string" && PRICE_LABELS[place.priceLevel]) {
    restaurant.priceLabel = PRICE_LABELS[place.priceLevel];
  }

  const currentHours = asRecord(place.currentOpeningHours);
  if (currentHours && typeof currentHours.openNow === "boolean") restaurant.openNow = currentHours.openNow;
  const regularHours = asRecord(place.regularOpeningHours);
  if (regularHours && Array.isArray(regularHours.weekdayDescriptions)) {
    const hours = regularHours.weekdayDescriptions.filter((item): item is string => typeof item === "string" && item.length > 0);
    if (hours.length > 0) restaurant.weekdayHours = hours;
  }

  if (typeof place.websiteUri === "string") restaurant.website = place.websiteUri;
  if (typeof place.googleMapsUri === "string") restaurant.mapsUrl = place.googleMapsUri;
  if (typeof place.nationalPhoneNumber === "string") restaurant.phone = place.nationalPhoneNumber;
  if (typeof place.servesVegetarianFood === "boolean") restaurant.servesVegetarianFood = place.servesVegetarianFood;

  const summary = textOf(place.editorialSummary);
  if (summary) restaurant.summary = summary;
  const primary = textOf(place.primaryTypeDisplayName);
  if (primary) restaurant.primaryType = primary;

  if (Array.isArray(place.photos)) {
    const photo = asRecord(place.photos[0]);
    if (photo && typeof photo.name === "string") {
      restaurant.photoName = photo.name;
      if (Array.isArray(photo.authorAttributions)) {
        const author = asRecord(photo.authorAttributions[0]);
        if (author && typeof author.displayName === "string") restaurant.photoCredit = author.displayName;
      }
    }
  }

  return restaurant;
}

export function mapPlaces(values: unknown, origin?: { latitude: number; longitude: number }): Restaurant[] {
  if (!Array.isArray(values)) return [];
  return values.flatMap((value) => {
    const restaurant = mapPlace(value, origin);
    return restaurant ? [restaurant] : [];
  });
}
