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

/**
 * D-047 — how long to wait for the provider before giving up on one send.
 *
 * ⛔ There was no timeout at all, which is worse than it sounds: a request that
 * hangs holds the whole booking action open behind it, so a slow provider stops
 * looking like a slow email and starts looking like a broken website. Failing at
 * fifteen seconds turns that into a recorded failure the retry can pick up.
 */
const SEND_TIMEOUT_MS = 15_000;

export async function sendEmail(input: SendEmailInput) {
  const resend = getResendClient();

  // ⚠️ `Promise.race` rather than an abort signal, because the provider SDK does
  // not accept one. ⛔ That means a timed-out request may still arrive at the
  // provider — the send is abandoned here, not cancelled there. It is recorded
  // as a failure either way, and `queueEmailRetry`'s small cap is what bounds
  // the duplicate that follows from exactly this case.
  let timer: ReturnType<typeof setTimeout> | undefined;
  const timeout = new Promise<never>((_resolve, reject) => {
    timer = setTimeout(
      () =>
        reject(
          new EmailDeliveryError(
            `The email provider did not respond within ${SEND_TIMEOUT_MS / 1000} seconds.`
          )
        ),
      SEND_TIMEOUT_MS
    );
  });

  try {
    const { data, error } = await Promise.race([
      resend.emails.send({
        from: getFromEmail(),
        to: input.to,
        subject: input.subject,
        html: input.html,
        text: input.text,
      }),
      timeout,
    ]);

    if (error) {
      throw new EmailDeliveryError(error.message);
    }

    return data;
  } finally {
    if (timer) clearTimeout(timer);
  }
}
