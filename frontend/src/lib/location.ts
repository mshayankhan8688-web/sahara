export function geolocationError(code: number, fallback: string): string {
  if (code === 1) return `Location permission was denied. ${fallback}`;
  if (code === 2) return `Location is unavailable on this device. ${fallback}`;
  if (code === 3) return `Location timed out. ${fallback}`;
  return `Location could not be read. ${fallback}`;
}

export const unsupportedLocation = "This browser has no location service. Type a city or area instead.";
