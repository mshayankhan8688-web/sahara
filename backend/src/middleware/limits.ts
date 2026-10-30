import rateLimit from "express-rate-limit";
import { config } from "../config.js";

const test = config.nodeEnv === "test";

function limiter(limit: number) {
  return rateLimit({
    windowMs: 15 * 60 * 1000,
    limit: test ? 1000 : limit,
    standardHeaders: true,
    legacyHeaders: false,
    message: { message: "Too many requests. Try again in a little while.", code: "RATE_LIMITED" },
  });
}

/** Higher ceiling in non-production so local Playwright suites can register users. */
export const authLimiter = limiter(config.nodeEnv === "production" ? 10 : 200);
export const chatLimiter = limiter(30);
export const exportLimiter = limiter(20);
export const imageLimiter = limiter(12);
export const searchLimiter = limiter(30);
export const feedbackLimiter = limiter(8);
export const feedbackReviewLimiter = limiter(20);
export const feedbackSummaryLimiter = limiter(60);
