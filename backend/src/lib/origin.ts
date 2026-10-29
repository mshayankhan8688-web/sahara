export function isAllowedOrigin(origin: string | undefined, frontendUrl: string): boolean {
  if (!origin) return true;
  if (origin === frontendUrl) return true;
  let configured: URL;
  let incoming: URL;
  try {
    configured = new URL(frontendUrl);
    incoming = new URL(origin);
  } catch {
    return false;
  }
  const configuredLocal = configured.hostname === "localhost" || configured.hostname === "127.0.0.1";
  const incomingLocal = incoming.hostname === "localhost" || incoming.hostname === "127.0.0.1";
  return configuredLocal && incomingLocal && incoming.protocol === configured.protocol;
}
