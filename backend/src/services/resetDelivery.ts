import { createTransport } from "nodemailer";
import { config, mailConfigured, smsConfigured } from "../config.js";
import type { ResetChannel } from "../lib/contact.js";
import { HttpError } from "../http.js";

export type ResetDelivery = "email" | "sms" | "local";

/** Local/dev only: show the code in the UI when SMTP/Twilio are not configured. Never used in production. */
export function allowLocalResetCode(): boolean {
  return config.nodeEnv === "development";
}

export async function sendResetCode(
  channel: ResetChannel,
  destination: string,
  code: string,
): Promise<ResetDelivery> {
  if (channel === "email") {
    if (!mailConfigured) {
      if (allowLocalResetCode()) {
        console.info(`[SAHARA local reset] email=${destination} code=${code}`);
        return "local";
      }
      throw new HttpError(
        503,
        "Password codes cannot be emailed yet. Add SMTP_HOST, SMTP_USER, SMTP_PASS, and SMTP_FROM on the server.",
        "EMAIL_NOT_CONFIGURED",
      );
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
      throw new HttpError(502, "The email could not be sent. Try again.", "EMAIL_FAILED");
    }
    return "email";
  }

  if (!smsConfigured) {
    if (allowLocalResetCode()) {
      console.info(`[SAHARA local reset] phone=${destination} code=${code}`);
      return "local";
    }
    throw new HttpError(
      503,
      "Password codes cannot be texted yet. Add TWILIO_ACCOUNT_SID, TWILIO_AUTH_TOKEN, and TWILIO_FROM on the server.",
      "SMS_NOT_CONFIGURED",
    );
  }
  const auth = Buffer.from(`${config.twilioAccountSid}:${config.twilioAuthToken}`).toString("base64");
  const body = new URLSearchParams({
    To: destination,
    From: config.twilioFrom,
    Body: `SAHARA password code: ${code}. It expires in 10 minutes.`,
  });
  const response = await fetch(
    `https://api.twilio.com/2010-04-01/Accounts/${config.twilioAccountSid}/Messages.json`,
    {
      method: "POST",
      headers: { Authorization: `Basic ${auth}`, "Content-Type": "application/x-www-form-urlencoded" },
      body,
    },
  );
  if (!response.ok) {
    console.error("Password code text failed", response.status);
    throw new HttpError(502, "The text message could not be sent. Try again.", "SMS_FAILED");
  }
  return "sms";
}
