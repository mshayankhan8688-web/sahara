import { createTransport } from "nodemailer";
import { config, mailConfigured, smsConfigured } from "../config.js";
import type { ResetChannel } from "../lib/contact.js";
import { HttpError } from "../http.js";

export type ResetDelivery = "email" | "sms" | "local";

export type PasswordResetStatus = {
  emailDeliveryConfigured: boolean;
  smsDeliveryConfigured: boolean;
  /** Development-only on-screen codes when SMTP/Twilio are missing. Never true in production. */
  localDevFallback: boolean;
  emailReady: boolean;
  smsReady: boolean;
  /** Human-readable setup hints; never includes secret values. */
  requiredEnv: {
    email: string[];
    sms: string[];
  };
};

const EMAIL_ENV = ["SMTP_HOST", "SMTP_USER", "SMTP_PASS", "SMTP_FROM"] as const;
const SMS_ENV = ["TWILIO_ACCOUNT_SID", "TWILIO_AUTH_TOKEN", "TWILIO_FROM"] as const;

/** Local/dev only: show the code in the UI when SMTP/Twilio are not configured. Never used in production. */
export function allowLocalResetCode(): boolean {
  return config.nodeEnv === "development";
}

export function getPasswordResetStatus(): PasswordResetStatus {
  const localDevFallback = allowLocalResetCode();
  return {
    emailDeliveryConfigured: mailConfigured,
    smsDeliveryConfigured: smsConfigured,
    localDevFallback,
    emailReady: mailConfigured || localDevFallback,
    smsReady: smsConfigured || localDevFallback,
    requiredEnv: {
      email: [...EMAIL_ENV],
      sms: [...SMS_ENV],
    },
  };
}

/** Partial SMTP/Twilio env sets are unsafe — treat as not configured and surface a clear error. */
export function assertDeliveryReady(channel: ResetChannel): void {
  if (channel === "email") {
    const partial =
      !mailConfigured &&
      Boolean(config.smtpHost || config.smtpUser || config.smtpPass || config.smtpFrom);
    if (mailConfigured) return;
    if (allowLocalResetCode()) return;
    throw new HttpError(
      503,
      partial
        ? "Password reset by email is not available. SMTP is only partly configured — set SMTP_HOST, SMTP_USER, SMTP_PASS, and SMTP_FROM (see server .env.example)."
        : "Password reset by email is not available. Set SMTP_HOST, SMTP_USER, SMTP_PASS, and SMTP_FROM on the server (see .env.example).",
      "EMAIL_NOT_CONFIGURED",
    );
  }

  const partial =
    !smsConfigured &&
    Boolean(config.twilioAccountSid || config.twilioAuthToken || config.twilioFrom);
  if (smsConfigured) return;
  if (allowLocalResetCode()) return;
  throw new HttpError(
    503,
    partial
      ? "Password reset by text is not available. Twilio is only partly configured — set TWILIO_ACCOUNT_SID, TWILIO_AUTH_TOKEN, and TWILIO_FROM (see server .env.example)."
      : "Password reset by text is not available. Set TWILIO_ACCOUNT_SID, TWILIO_AUTH_TOKEN, and TWILIO_FROM on the server (see .env.example).",
    "SMS_NOT_CONFIGURED",
  );
}

export async function sendResetCode(
  channel: ResetChannel,
  destination: string,
  code: string,
): Promise<ResetDelivery> {
  assertDeliveryReady(channel);

  if (channel === "email") {
    if (!mailConfigured) {
      console.info(`[SAHARA local reset] email=${destination} code=${code}`);
      return "local";
    }
    const transport = createTransport({
      host: config.smtpHost,
      port: config.smtpPort,
      secure: config.smtpPort === 465,
      auth: { user: config.smtpUser, pass: config.smtpPass },
    });
    try {
      await transport.sendMail({
        from: config.smtpFrom,
        to: destination,
        subject: "SAHARA password code",
        text: `Your SAHARA password code is ${code}. It expires in 10 minutes. If you did not ask for this, ignore the email.`,
      });
    } catch (error) {
      console.error("Password code email failed", error);
      throw new HttpError(502, "The email could not be sent. Try again later or contact support.", "EMAIL_FAILED");
    }
    return "email";
  }

  if (!smsConfigured) {
    console.info(`[SAHARA local reset] phone=${destination} code=${code}`);
    return "local";
  }
  const auth = Buffer.from(`${config.twilioAccountSid}:${config.twilioAuthToken}`).toString("base64");
  const body = new URLSearchParams({
    To: destination,
    From: config.twilioFrom,
    Body: `SAHARA password code: ${code}. It expires in 10 minutes.`,
  });
  let response: Response;
  try {
    response = await fetch(
      `https://api.twilio.com/2010-04-01/Accounts/${config.twilioAccountSid}/Messages.json`,
      {
        method: "POST",
        headers: { Authorization: `Basic ${auth}`, "Content-Type": "application/x-www-form-urlencoded" },
        body,
      },
    );
  } catch (error) {
    console.error("Password code text request failed", error);
    throw new HttpError(502, "The text message could not be sent. Try again later.", "SMS_FAILED");
  }
  if (!response.ok) {
    console.error("Password code text failed", response.status);
    throw new HttpError(502, "The text message could not be sent. Try again later.", "SMS_FAILED");
  }
  return "sms";
}

/** Log incomplete delivery config once at boot — never print secret values. */
export function warnIncompleteResetDelivery(): void {
  const smtpBits = [config.smtpHost, config.smtpUser, config.smtpPass, config.smtpFrom].filter(Boolean).length;
  if (smtpBits > 0 && smtpBits < 4) {
    console.warn(
      "[SAHARA] SMTP password reset is incomplete. Need all of SMTP_HOST, SMTP_USER, SMTP_PASS, SMTP_FROM. Email reset stays unavailable until complete.",
    );
  }
  const twilioBits = [config.twilioAccountSid, config.twilioAuthToken, config.twilioFrom].filter(Boolean).length;
  if (twilioBits > 0 && twilioBits < 3) {
    console.warn(
      "[SAHARA] Twilio password reset is incomplete. Need all of TWILIO_ACCOUNT_SID, TWILIO_AUTH_TOKEN, TWILIO_FROM. SMS reset stays unavailable until complete.",
    );
  }
  if (!mailConfigured && !smsConfigured && !allowLocalResetCode()) {
    console.warn(
      "[SAHARA] Password reset delivery is not configured (no SMTP and no Twilio). Forgot-password will return 503 until credentials are set.",
    );
  }
}
