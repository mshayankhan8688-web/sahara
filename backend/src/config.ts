import "dotenv/config";
import { z } from "zod";

const envSchema = z.object({
  PORT: z.coerce.number().int().positive().default(4000),
  NODE_ENV: z.enum(["development", "production", "test"]).default("development"),
  MONGODB_URI: z.string().min(1, "MONGODB_URI is required"),
  JWT_SECRET: z.string().min(16, "JWT_SECRET must be at least 16 characters"),
  FRONTEND_URL: z.string().url().default("http://localhost:5173"),
  GEMINI_API_KEY: z.string().default(""),
  GEMINI_MODEL: z.string().min(1).default("gemini-flash-lite-latest"),
  GOOGLE_PLACES_API_KEY: z.string().default(""),
  SMTP_HOST: z.string().default(""),
  SMTP_PORT: z.coerce.number().int().positive().default(587),
  SMTP_USER: z.string().default(""),
  SMTP_PASS: z.string().default(""),
  SMTP_FROM: z.string().default(""),
  TWILIO_ACCOUNT_SID: z.string().default(""),
  TWILIO_AUTH_TOKEN: z.string().default(""),
  TWILIO_FROM: z.string().default(""),
  COOKIE_SAMESITE: z.enum(["lax", "none", "strict"]).default("lax"),
  COOKIE_SECURE: z.enum(["true", "false"]).optional(),
  FEEDBACK_REVIEW_SECRET: z.string().default(""),
});

const parsed = envSchema.safeParse(process.env);

if (!parsed.success) {
  console.error("HeartSpace API configuration is incomplete", parsed.error.flatten().fieldErrors);
  throw new Error("Invalid server environment");
}

const secure =
  parsed.data.COOKIE_SECURE === "true" ||
  (parsed.data.COOKIE_SECURE !== "false" && parsed.data.NODE_ENV === "production");

if (parsed.data.COOKIE_SAMESITE === "none" && !secure) {
  throw new Error("COOKIE_SAMESITE=none requires COOKIE_SECURE=true");
}

const feedbackReviewSecret = parsed.data.FEEDBACK_REVIEW_SECRET.trim();
if (feedbackReviewSecret && feedbackReviewSecret.length < 16) {
  throw new Error("FEEDBACK_REVIEW_SECRET must be at least 16 characters");
}

export const config = {
  port: parsed.data.PORT,
  nodeEnv: parsed.data.NODE_ENV,
  mongodbUri: parsed.data.MONGODB_URI,
  jwtSecret: parsed.data.JWT_SECRET,
  frontendUrl: parsed.data.FRONTEND_URL,
  geminiApiKey: parsed.data.GEMINI_API_KEY.trim(),
  geminiModel: parsed.data.GEMINI_MODEL.trim(),
  placesApiKey: parsed.data.GOOGLE_PLACES_API_KEY.trim(),
  smtpHost: parsed.data.SMTP_HOST.trim(),
  smtpPort: parsed.data.SMTP_PORT,
  smtpUser: parsed.data.SMTP_USER.trim(),
  smtpPass: parsed.data.SMTP_PASS,
  smtpFrom: parsed.data.SMTP_FROM.trim(),
  twilioAccountSid: parsed.data.TWILIO_ACCOUNT_SID.trim(),
  twilioAuthToken: parsed.data.TWILIO_AUTH_TOKEN.trim(),
  twilioFrom: parsed.data.TWILIO_FROM.trim(),
  cookieSameSite: parsed.data.COOKIE_SAMESITE,
  cookieSecure: secure,
  feedbackReviewSecret,
};

export const aiConfigured = config.geminiApiKey.length > 0;
export const placesConfigured = config.placesApiKey.length > 0;
export const mailConfigured = Boolean(config.smtpHost && config.smtpUser && config.smtpPass && config.smtpFrom);
export const smsConfigured = Boolean(config.twilioAccountSid && config.twilioAuthToken && config.twilioFrom);
