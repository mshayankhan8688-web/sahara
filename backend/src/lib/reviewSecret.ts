import { createHash, timingSafeEqual } from "node:crypto";
import { config } from "../config.js";

export function reviewAuthorized(presented: string | undefined): boolean {
  const expected = config.feedbackReviewSecret;
  if (!expected || !presented) return false;
  const left = createHash("sha256").update(expected).digest();
  const right = createHash("sha256").update(presented).digest();
  return timingSafeEqual(left, right);
}
