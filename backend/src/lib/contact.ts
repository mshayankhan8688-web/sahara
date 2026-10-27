export type ResetChannel = "email" | "phone";

export function normalizeEmail(value: string): string | null {
  const email = value.trim().toLowerCase();
  if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email) || email.length > 120) return null;
  return email;
}

export function normalizePhone(value: string): string | null {
  let digits = value.trim().replace(/[^\d]/g, "");
  if (digits.startsWith("00")) digits = digits.slice(2);
  if (digits.startsWith("0") && digits.length === 11) digits = `92${digits.slice(1)}`;
  if (digits.length < 10 || digits.length > 15) return null;
  return `+${digits}`;
}

export function readIdentifier(value: string): { channel: ResetChannel; destination: string } | null {
  if (value.includes("@")) {
    const email = normalizeEmail(value);
    return email ? { channel: "email", destination: email } : null;
  }
  const phone = normalizePhone(value);
  return phone ? { channel: "phone", destination: phone } : null;
}
