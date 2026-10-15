import "server-only";
import nodemailer from "nodemailer";
import { ApiError } from "./api";

export function getMailSettings() {
  const { SMTP_HOST, SMTP_PORT, SMTP_USER, SMTP_PASSWORD, SMTP_FROM, APP_URL } = process.env;
  if (!SMTP_HOST || !SMTP_FROM || !APP_URL) {
    throw new ApiError("Password recovery is unavailable. Please contact the app owner.", 503);
  }
  const origin = new URL(APP_URL);
  if (!["http:", "https:"].includes(origin.protocol) ||
      (process.env.NODE_ENV === "production" && origin.protocol !== "https:")) {
    throw new ApiError("Password recovery is unavailable. Please contact the app owner.", 503);
  }
  const port = Number(SMTP_PORT || 587);
  return {
    from: SMTP_FROM,
    origin: origin.origin,
    transport: {
      host: SMTP_HOST,
      port,
      secure: port === 465,
      requireTLS: process.env.NODE_ENV === "production" && port !== 465,
      ...(SMTP_USER ? { auth: { user: SMTP_USER, pass: SMTP_PASSWORD } } : {}),
      connectionTimeout: 10000,
      greetingTimeout: 10000,
      socketTimeout: 15000,
      logger: false,
      debug: false,
    },
  };
}

export async function sendResetEmail(email, token, settings) {
  // A fragment stays out of HTTP access logs and referrer headers.
  const link = `${settings.origin}/auth/reset-password#token=${token}`;
  const mailer = nodemailer.createTransport(settings.transport);
  const result = await mailer.sendMail({
    from: settings.from,
    to: email,
    subject: "Reset your Note App account",
    text: `Use this link to change your username or password:\n\n${link}\n\nThis link expires in 15 minutes and can be used once. If you did not request it, ignore this email.`,
  });
  if (!result.accepted?.length) throw new Error("Email was not accepted.");
}
