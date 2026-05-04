import type { Event } from "@sentry/nextjs";

const SENSITIVE_KEY_PATTERN =
  /(address|admin.*note|anon.*key|authorization|city|consent|cookie|customer.*note|email|full.*name|health|manage.*token|name|phone|postcode|postal|resend|secret|sentry.*auth|service.*role|supabase.*key|token|treatment)/i;
const EMAIL_PATTERN = /\b[A-Z0-9._%+-]+@[A-Z0-9.-]+\.[A-Z]{2,}\b/gi;
const UK_POSTCODE_PATTERN = /\b[A-Z]{1,2}\d[A-Z\d]?\s*\d[A-Z]{2}\b/gi;
const LONG_TOKEN_PATTERN = /\b(?:eyJ[A-Za-z0-9_-]+|[A-Za-z0-9_-]{24,})\b/g;
const PHONE_PATTERN =
  /(?:\+?\d[\d\s().-]{8,}\d)|(?:\b0\d{3}\s?\d{3}\s?\d{3,4}\b)/g;

const SAFE_USER_KEYS = new Set(["id"]);
const SAFE_CONTEXT_KEYS = new Set([
  "route",
  "router",
  "status",
  "status_code",
  "statusCode",
  "booking_id",
  "bookingId",
  "staff_id",
  "staffId",
]);

function redactText(value: string) {
  return value
    .replace(EMAIL_PATTERN, "[Filtered]")
    .replace(UK_POSTCODE_PATTERN, "[Filtered]")
    .replace(PHONE_PATTERN, "[Filtered]")
    .replace(LONG_TOKEN_PATTERN, "[Filtered]");
}

function scrubValue(value: unknown, key = "", depth = 0): unknown {
  if (depth > 8) return "[Filtered]";

  if (typeof value === "string") {
    return SENSITIVE_KEY_PATTERN.test(key) ? "[Filtered]" : redactText(value);
  }

  if (value === null || typeof value !== "object") {
    return value;
  }

  if (Array.isArray(value)) {
    return value.map((entry) => scrubValue(entry, key, depth + 1));
  }

  const scrubbed: Record<string, unknown> = {};

  for (const [entryKey, entryValue] of Object.entries(value)) {
    if (SAFE_CONTEXT_KEYS.has(entryKey)) {
      scrubbed[entryKey] =
        typeof entryValue === "string" ? redactText(entryValue) : entryValue;
      continue;
    }

    scrubbed[entryKey] = SENSITIVE_KEY_PATTERN.test(entryKey)
      ? "[Filtered]"
      : scrubValue(entryValue, entryKey, depth + 1);
  }

  return scrubbed;
}

export function scrubSentryEvent<T extends Event>(event: T): T {
  const scrubbed = scrubValue(event) as T;

  if (scrubbed.user) {
    scrubbed.user = Object.fromEntries(
      Object.entries(scrubbed.user).filter(([key]) => SAFE_USER_KEYS.has(key))
    );
  }

  return scrubbed;
}
