import { NextResponse } from "next/server";
import { z } from "zod/v4";
import { createSupabaseAdminClient } from "@/lib/supabase/admin";
import { KNOWN_BANNER_VERSIONS } from "@/lib/consent/cookie-registry";

// C-18 Phase E Step 10 — the consent-proof logging endpoint (brief §2.4).
//
// LOCKED POSTURE: always 204, externally, whatever happened underneath. A
// malformed payload, an unknown banner_version, an oversized body, and a DB
// error all look identical to the caller — there is no oracle for probing
// this route from outside (plan §1 Step 10). Every rejection is still logged
// server-side via console.error before the 204 goes out, so a real failure
// stays visible to us without being visible to a client.
//
// FIRE-AND-FORGET, BY DESIGN (brief §4.7). This endpoint being slow or down
// must never affect consent UX — the client dispatches it with
// navigator.sendBeacon / fetch(keepalive) and never awaits the result. See
// src/components/consent/consent-store.ts.
//
// NO .select() ON THE INSERT. service_role has INSERT only on this table,
// deliberately not SELECT (least privilege — the route writes and never
// reads). Chaining .select() would ask supabase-js for a returned
// representation, which needs SELECT, and the insert would fail 42501 — see
// supabase/migrations/20260804182200_c18_consent_events.sql for the full
// reasoning and the live-verified grant.

// A consent event is a handful of booleans, a short version string and a
// uuid — a few hundred bytes at most. This cap is generous headroom over any
// real payload and small enough to reject an oversized body cheaply, before
// it is ever handed to JSON.parse or zod.
const MAX_BODY_BYTES = 4096;

const consentEventSchema = z.object({
  consent_id: z.string().uuid(),
  banner_version: z.string().min(1),
  purposes_offered: z.array(z.string().min(1)).min(1),
  choices: z.object({
    analytics: z.boolean(),
    functional: z.boolean(),
  }),
  action: z.enum(["granted", "rejected", "updated", "withdrawn"]),
});

function noContent(): NextResponse {
  return new NextResponse(null, { status: 204 });
}

export async function POST(request: Request): Promise<NextResponse> {
  const contentLength = request.headers.get("content-length");
  if (contentLength && Number(contentLength) > MAX_BODY_BYTES) {
    return noContent();
  }

  let rawBody: string;
  try {
    rawBody = await request.text();
  } catch {
    return noContent();
  }

  // A second check because Content-Length is caller-supplied and cannot be
  // trusted on its own — this is what actually enforces the cap when the
  // header is missing or understates the real size.
  if (new TextEncoder().encode(rawBody).length > MAX_BODY_BYTES) {
    return noContent();
  }

  let payload: unknown;
  try {
    payload = JSON.parse(rawBody);
  } catch {
    return noContent();
  }

  const parsed = consentEventSchema.safeParse(payload);
  if (!parsed.success) {
    console.error(
      "[consent-events] dropped: malformed payload",
      z.flattenError(parsed.error)
    );
    return noContent();
  }

  if (!KNOWN_BANNER_VERSIONS.includes(parsed.data.banner_version)) {
    console.error(
      "[consent-events] dropped: unknown banner_version",
      parsed.data.banner_version
    );
    return noContent();
  }

  try {
    const supabase = createSupabaseAdminClient();
    const { error } = await supabase.from("consent_events").insert({
      consent_id: parsed.data.consent_id,
      banner_version: parsed.data.banner_version,
      purposes_offered: parsed.data.purposes_offered,
      choices: parsed.data.choices,
      action: parsed.data.action,
    });

    // Never dropped silently — an unlogged Supabase error here is exactly the
    // C-04a failure mode the migration's own comment warns about: the route
    // always answers 204, so without this the proof log could stay silently
    // empty forever.
    if (error) {
      console.error("[consent-events] insert failed", error);
    }
  } catch (error) {
    console.error("[consent-events] insert threw", error);
  }

  return noContent();
}
