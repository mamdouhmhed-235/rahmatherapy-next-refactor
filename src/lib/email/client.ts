// SERVER ONLY - do not import from client components.
import { Resend } from "resend";

interface SendEmailInput {
  to: string | string[];
  subject: string;
  html: string;
  text: string;
}

export class EmailConfigurationError extends Error {
  constructor(message: string) {
    super(message);
    this.name = "EmailConfigurationError";
  }
}

export class EmailDeliveryError extends Error {
  constructor(message: string) {
    super(message);
    this.name = "EmailDeliveryError";
  }
}

function getResendClient() {
  const apiKey = process.env.RESEND_API_KEY;
  if (!apiKey) {
    throw new EmailConfigurationError("Missing RESEND_API_KEY.");
  }

  return new Resend(apiKey);
}

export function getFromEmail() {
  const fromEmail = process.env.RESEND_FROM_EMAIL;
  if (!fromEmail) {
    throw new EmailConfigurationError("Missing RESEND_FROM_EMAIL.");
  }

  return fromEmail;
}

export function getSiteUrl() {
  const siteUrl = process.env.NEXT_PUBLIC_SITE_URL;
  if (!siteUrl) {
    throw new EmailConfigurationError("Missing NEXT_PUBLIC_SITE_URL.");
  }

  return siteUrl.replace(/\/+$/, "");
}

export function extractEmailAddress(value: string) {
  const match = value.match(/<([^>]+)>/);
  return (match?.[1] ?? value).trim();
}

export async function sendEmail(input: SendEmailInput) {
  const resend = getResendClient();
  const { data, error } = await resend.emails.send({
    from: getFromEmail(),
    to: input.to,
    subject: input.subject,
    html: input.html,
    text: input.text,
  });

  if (error) {
    throw new EmailDeliveryError(error.message);
  }

  return data;
}
