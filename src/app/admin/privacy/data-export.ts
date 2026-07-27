"use server";

import { PERMISSIONS, requirePermission } from "@/lib/auth/rbac";
import { createSupabaseAdminClient } from "@/lib/supabase/admin";
import { createSupabaseServerClient } from "@/lib/supabase/server";

export interface ClientDataExportResult {
  error?: string;
  /** `client-{id}-export-{yyyy-mm-dd}.json` */
  filename?: string;
  /** The finished export document, already stringified. */
  json?: string;
}

/**
 * Dropped from the exported client row. These are record-keeping columns, not
 * personal data the subject asked for (brief §2.4: "all fields except id
 * timestamps"). Everything else on the row is included.
 */
const CLIENT_RECORD_KEEPING_FIELDS = [
  "id",
  "created_at",
  "updated_at",
  "deleted_at",
] as const;

/** Right-of-access exports cap the audit trail at the 50 most recent rows (brief Q9.4). */
const AUDIT_LOG_LIMIT = 50;

/**
 * Builds the UK GDPR Article 15 export for a `data_export` privacy request.
 *
 * **Why this returns a string rather than a `Response`.** The plan (§9 Open Q3)
 * left the delivery mechanism to be settled here, with `Response` +
 * `Content-Disposition` as the first candidate. It does not work in Next 16:
 *
 * 1. A server action's return value is serialised into the RSC flight stream,
 *    which accepts plain objects and a short list of built-ins only — React
 *    rejects class instances outright ("Only plain objects, and a few built-ins,
 *    can be passed to Client Components from Server Components. Classes or null
 *    prototypes are not supported.", verified in the react-server-dom build that
 *    ships with next 16.2.4). `Response` is a class instance.
 * 2. Even if it serialised, the value rides *inside the body* of the POST
 *    response Next itself writes. An action cannot set headers on that response,
 *    so a `Content-Disposition` on a returned `Response` could never reach the
 *    browser.
 *
 * A Route Handler could set the header, but that is a new file outside this
 * plan's files-touched list. So the action returns the document and the caller
 * (`PrivacyStatusForm`) turns it into a Blob download — the attachment is
 * produced in the browser instead of by a header. RBAC still runs here, on the
 * server, before a single row is read.
 */
export async function generateClientDataExport(
  requestId: string
): Promise<ClientDataExportResult> {
  let actor;
  try {
    actor = await requirePermission(
      PERMISSIONS.MANAGE_PRIVACY_OPERATIONS,
      await createSupabaseServerClient()
    );
  } catch {
    return { error: "Insufficient permissions." };
  }

  const adminClient = createSupabaseAdminClient();

  const { data: request, error: requestError } = await adminClient
    .from("client_privacy_requests")
    .select("id, client_id, request_type, created_at")
    .eq("id", requestId)
    .single();

  if (requestError || !request) {
    return { error: "That privacy request could not be found." };
  }

  const clientId = request.client_id as string;

  const [clientResult, bookingsResult, notesResult, auditResult] =
    await Promise.all([
      adminClient.from("clients").select("*").eq("id", clientId).single(),
      adminClient
        .from("bookings")
        .select("*, booking_items(*), booking_assignments(*)")
        .eq("client_id", clientId)
        .order("booking_date", { ascending: false }),
      // Sensitive notes are excluded: UK GDPR Article 9 special-category data
      // is released through the `sensitive_note_review` queue, not this export.
      adminClient
        .from("client_notes")
        .select("*")
        .eq("client_id", clientId)
        .eq("is_sensitive", false)
        .order("created_at", { ascending: false }),
      adminClient
        .from("audit_logs")
        .select("*")
        .eq("target_id", clientId)
        .order("created_at", { ascending: false })
        .limit(AUDIT_LOG_LIMIT),
    ]);

  if (clientResult.error || !clientResult.data) {
    return { error: "That client record could not be loaded." };
  }

  // Every section has to load. Falling through to `?? []` on a failed query
  // would ship a file stating the data subject has no bookings — and the
  // privacy manager would forward it as a complete Article 15 response. A
  // partial export is the dishonesty this plan exists to remove, so refuse to
  // build one.
  if (
    bookingsResult.error ||
    !bookingsResult.data ||
    notesResult.error ||
    !notesResult.data ||
    auditResult.error ||
    !auditResult.data
  ) {
    const unloadable = [
      bookingsResult.error || !bookingsResult.data ? "bookings" : null,
      notesResult.error || !notesResult.data ? "notes" : null,
      auditResult.error || !auditResult.data ? "audit log" : null,
    ].filter((section): section is string => section !== null);

    return {
      error: `Couldn't load part of this client's record (${unloadable.join(", ")}), so no export was created. A partial file would wrongly show none on record. Try again.`,
    };
  }

  const client: Record<string, unknown> = { ...clientResult.data };
  for (const field of CLIENT_RECORD_KEEPING_FIELDS) {
    delete client[field];
  }

  const exportedAt = new Date().toISOString();

  return {
    filename: `client-${clientId}-export-${exportedAt.slice(0, 10)}.json`,
    json: JSON.stringify(
      {
        exported_at: exportedAt,
        exported_by: { staff_id: actor.id, name: actor.name },
        request: {
          id: request.id,
          type: request.request_type,
          created_at: request.created_at,
        },
        client,
        bookings: bookingsResult.data,
        notes: notesResult.data,
        audit_log_summary: auditResult.data,
      },
      null,
      2
    ),
  };
}
