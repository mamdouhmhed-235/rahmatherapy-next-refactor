"use server";

import { revalidatePath, updateTag } from "next/cache";
import { redirect } from "next/navigation";
import { z } from "zod/v4";
import { createSupabaseAdminClient } from "@/lib/supabase/admin";
import { createSupabaseServerClient } from "@/lib/supabase/server";
import type { Database } from "@/lib/supabase/database.types";
import {
  canManageAllClients,
  canManageClientDestructiveOps,
  canManageClientIdentityFields,
  getStaffProfile,
  PERMISSIONS,
  requirePermission,
} from "@/lib/auth/rbac";
import { getClientDataAccess } from "./access";
import { TAGS } from "@/lib/cache/tag-taxonomy";

const CLIENT_SOURCES = [
  "website",
  "phone",
  "whatsapp",
  "instagram",
  "referral",
  "manual",
  "other",
] as const;

const GENDER_PREFERENCES = ["no_preference", "female", "male"] as const;

/**
 * Identity fields (brief §3 RBAC matrix): editable only by an actor holding
 * `manage_client_identity_fields`. Everything else on the record is
 * operational and editable by any client manager.
 */
const CLIENT_IDENTITY_FIELDS = [
  "full_name",
  "email",
  "gender_preference",
] as const;

const CLIENT_EDIT_COLUMNS =
  "id, full_name, phone, email, gender_preference, address, postcode, city, area, client_source, source_detail, notes, updated_at, deleted_at";

/**
 * Row shapes straight off the generated schema. ⛔ `clients` names the person
 * column `full_name`; `staff_profiles` names its own `name`. Mixing the two up
 * is what produced one of the four silent HTTP 400s, so these aliases exist to
 * make the compiler hold that line for us.
 */
type ClientRow = Database["public"]["Tables"]["clients"]["Row"];
type ClientUpdate = Database["public"]["Tables"]["clients"]["Update"];
type BookingUpdate = Database["public"]["Tables"]["bookings"]["Update"];

/**
 * The subset `CLIENT_EDIT_COLUMNS` selects. Declared as a `type` (not an
 * `interface`) on purpose: audit rows write it into the `jsonb` `before_state`
 * column, and only a type alias structurally satisfies the generated `Json`
 * union.
 */
type ClientEditableRow = {
  id: string;
  full_name: string;
  phone: string | null;
  email: string | null;
  gender_preference: Database["public"]["Enums"]["gender_preference_type"];
  address: string | null;
  postcode: string | null;
  city: string | null;
  area: string | null;
  client_source: string;
  source_detail: string | null;
  notes: string | null;
  updated_at: string;
  deleted_at: string | null;
};

/**
 * The columns `updateClient` may write, in the order the edit form sends them —
 * which is also the key order the `client_updated` audit row records.
 */
const CLIENT_EDITABLE_FIELDS = [
  "full_name",
  "email",
  "gender_preference",
  "phone",
  "address",
  "postcode",
  "city",
  "area",
  "client_source",
  "source_detail",
  "notes",
] as const;

type ClientEditableField = (typeof CLIENT_EDITABLE_FIELDS)[number];

/**
 * Copy one field from the submitted patch onto `changed`, but only when it is
 * still present (the identity gate may have dropped it) AND actually differs
 * from what is stored. Generic over the field so the compiler checks each value
 * against its real column type instead of widening the whole patch to `string`.
 */
function collectChangedClientField<K extends ClientEditableField>(
  field: K,
  patch: ClientUpdate,
  current: ClientEditableRow,
  changed: ClientUpdate
) {
  const next = patch[field];
  if (next === undefined) return;
  const previous: ClientEditableRow[K] = current[field];
  if (next === previous) return;
  changed[field] = next;
}

const PRIVACY_REQUEST_TYPES = [
  "data_export",
  "correction",
  "deletion_review",
  "sensitive_note_review",
] as const;

export interface ClientActionState {
  error?: string;
  fieldErrors?: Record<string, string>;
  duplicateWarning?: string;
  success?: boolean;
  /**
   * ⛔ FIND-08-B. What the operator typed, echoed back so the form can
   * re-render it.
   *
   * React resets an uncontrolled `<form action={fn}>` once the action returns.
   * Without this the create form came back COMPLETELY BLANK on every
   * non-success path — and the duplicate-client warning is a non-success path.
   * So hitting the duplicate check cost the operator the whole record, and the
   * "create a separate client profile anyway" checkbox was unreachable: ticking
   * it re-enabled the button, but `full_name` and `client_source` were now
   * empty and `required`, so the browser silently blocked the submit and no
   * server action ever fired.
   */
  values?: Record<string, string>;
}

const clientSchema = z.object({
  full_name: z.string().trim().min(1, "Full name is required."),
  phone: z.string().trim().optional(),
  email: z.union([z.email("Enter a valid email."), z.literal("")]).optional(),
  address: z.string().trim().optional(),
  postcode: z.string().trim().optional(),
  city: z.string().trim().optional(),
  area: z.string().trim().optional(),
  client_source: z.enum(CLIENT_SOURCES),
  source_detail: z.string().trim().optional(),
  notes: z.string().trim().optional(),
});

const clientUpdateSchema = clientSchema.extend({
  gender_preference: z.enum(GENDER_PREFERENCES),
});

async function requireClientManager() {
  const supabase = await createSupabaseServerClient();
  const profile = await getStaffProfile(supabase);
  if (!profile || !profile.active || !canManageAllClients(profile)) {
    throw new Error("Insufficient permissions.");
  }
  return profile;
}

/**
 * Destructive client operations (delete + bulk delete) sit behind a second
 * permission on top of client management — Owner and Admin only, never the
 * Booking Coordinator (brief §3).
 */
async function requireClientDestructiveOpsManager() {
  const profile = await requireClientManager();
  if (!canManageClientDestructiveOps(profile)) {
    throw new Error("Insufficient permissions.");
  }
  return profile;
}

async function requireClientNoteActor() {
  const supabase = await createSupabaseServerClient();
  const profile = await getStaffProfile(supabase);
  if (!profile?.active) {
    throw new Error("Insufficient permissions.");
  }
  return profile;
}

async function requirePrivacyManager() {
  const supabase = await createSupabaseServerClient();
  return requirePermission(PERMISSIONS.MANAGE_PRIVACY_OPERATIONS, supabase);
}

function normalizeEmail(value: string | undefined) {
  const email = value?.trim().toLowerCase();
  return email || null;
}

function normalizePhone(value: string | undefined) {
  return value?.replace(/\s+/g, " ").trim() || null;
}

async function hasAssignedClientBooking(
  clientId: string,
  staffId: string,
  adminClient: ReturnType<typeof createSupabaseAdminClient>
) {
  const { data: bookings, error: bookingsError } = await adminClient
    .from("bookings")
    .select("id")
    .eq("client_id", clientId);
  if (bookingsError || !bookings || bookings.length === 0) return false;

  const { count, error } = await adminClient
    .from("booking_assignments")
    .select("id", { count: "exact", head: true })
    .in(
      "booking_id",
      bookings.map((booking) => booking.id)
    )
    .eq("assigned_staff_id", staffId);

  return !error && (count ?? 0) > 0;
}

function toFieldErrors(error: z.ZodError) {
  return Object.fromEntries(
    Object.entries(z.flattenError(error).fieldErrors).map(([key, value]) => [
      key,
      (value as string[] | undefined)?.[0] ?? "Invalid value.",
    ])
  );
}

export async function createClient(
  _previousState: ClientActionState,
  formData: FormData
): Promise<ClientActionState> {
  let actor;
  try {
    actor = await requireClientManager();
  } catch {
    return { error: "Insufficient permissions." };
  }

  const parsed = clientSchema.safeParse({
    full_name: formData.get("full_name"),
    phone: formData.get("phone"),
    email: formData.get("email"),
    address: formData.get("address"),
    postcode: formData.get("postcode"),
    city: formData.get("city"),
    area: formData.get("area"),
    client_source: formData.get("client_source"),
    source_detail: formData.get("source_detail"),
    notes: formData.get("notes"),
  });

  // ⛔ FIND-08-B. Captured BEFORE any early return, so every non-success path
  // below can hand the operator's typing back to the form instead of blanking
  // it. Read straight off the FormData rather than off `parsed`, so it survives
  // a validation failure too.
  const submitted = Object.fromEntries(
    [
      "full_name",
      "phone",
      "email",
      "address",
      "postcode",
      "city",
      "area",
      "client_source",
      "source_detail",
      "notes",
    ].map((field) => [field, String(formData.get(field) ?? "")]),
  );

  if (!parsed.success) {
    return {
      error: "Check the client details.",
      fieldErrors: toFieldErrors(parsed.error),
      values: submitted,
    };
  }

  const adminClient = createSupabaseAdminClient();
  const email = normalizeEmail(parsed.data.email);
  const phone = normalizePhone(parsed.data.phone);
  const confirmDuplicate = formData.get("confirm_duplicate") === "on";

  if (email || phone) {
    const [emailMatches, phoneMatches] = await Promise.all([
      email
        ? adminClient
            .from("clients")
            .select("id, full_name, email, phone")
            .eq("email", email)
            .limit(5)
        : Promise.resolve({ data: [], error: null }),
      phone
        ? adminClient
            .from("clients")
            .select("id, full_name, email, phone")
            .eq("phone", phone)
            .limit(5)
        : Promise.resolve({ data: [], error: null }),
    ]);
    if (emailMatches.error) return { error: emailMatches.error.message, values: submitted };
    if (phoneMatches.error) return { error: phoneMatches.error.message, values: submitted };

    const matchesById = new Map(
      [...(emailMatches.data ?? []), ...(phoneMatches.data ?? [])].map(
        (client) => [client.id, client]
      )
    );
    const matches = [...matchesById.values()];

    if (matches.length > 0 && !confirmDuplicate) {
      return {
        duplicateWarning: matches
          .map((client) => `${client.full_name} (${client.email ?? client.phone ?? "no contact"})`)
          .join(", "),
        // ⛔ FIND-08-B: without this the operator loses the whole record here,
        // and the acknowledgement checkbox underneath it can never be acted on.
        values: submitted,
      };
    }
  }

  const payload = {
    full_name: parsed.data.full_name,
    phone,
    email,
    address: parsed.data.address || null,
    postcode: parsed.data.postcode || null,
    city: parsed.data.city || null,
    area: parsed.data.area || null,
    client_source: parsed.data.client_source,
    source_detail: parsed.data.source_detail || null,
    notes: parsed.data.notes || null,
  };

  const { data, error } = await adminClient
    .from("clients")
    .insert(payload)
    .select("id")
    .single();

  if (error) return { error: error.message, values: submitted };

  await adminClient.from("audit_logs").insert({
    actor_staff_id: actor.id,
    action_type: "client_created",
    target_type: "clients",
    target_id: data.id,
    after_state: payload,
  });

  updateTag("report-data");
  updateTag("dashboard-data");
  updateTag(TAGS.CLIENTS);
  updateTag(TAGS.AUDIT);
  revalidatePath("/admin/clients");
  revalidatePath("/admin/dashboard");
  redirect(`/admin/clients/${data.id}`);
}

export async function updateClient(
  _previousState: ClientActionState,
  formData: FormData
): Promise<ClientActionState> {
  let actor;
  try {
    actor = await requireClientManager();
  } catch {
    return { error: "Insufficient permissions." };
  }

  const clientId = String(formData.get("client_id") ?? "").trim();
  const updatedAtToken = String(formData.get("client_updated_at") ?? "").trim();
  if (!clientId) return { error: "Client is required." };

  const parsed = clientUpdateSchema.safeParse({
    full_name: formData.get("full_name"),
    phone: formData.get("phone"),
    email: formData.get("email"),
    gender_preference: formData.get("gender_preference"),
    address: formData.get("address"),
    postcode: formData.get("postcode"),
    city: formData.get("city"),
    area: formData.get("area"),
    client_source: formData.get("client_source"),
    source_detail: formData.get("source_detail"),
    notes: formData.get("notes"),
  });

  if (!parsed.success) {
    return {
      error: "Check the client details.",
      fieldErrors: toFieldErrors(parsed.error),
    };
  }

  const adminClient = createSupabaseAdminClient();
  const { data: current, error: currentError } = await adminClient
    .from("clients")
    .select(CLIENT_EDIT_COLUMNS)
    .eq("id", clientId)
    .single<ClientEditableRow>();

  if (currentError || !current) {
    return { error: "This client record could not be loaded. Reload and try again." };
  }

  // A soft-deleted record is not editable. The edit route already 404s on
  // `deleted_at`, but this module is `"use server"`, so `updateClient` is
  // directly dispatchable: without this guard an authenticated client manager
  // could POST straight at the action, rewrite an erased client's PII, bump
  // `updated_at`, and file a fresh `client_updated` audit row carrying exactly
  // the identifiers the `gdpr_erasure` redaction (see `auditBeforeState`) exists
  // to keep out of `audit_logs`. Same threat model `deleteClient` re-asserts its
  // own permissions for.
  if (current.deleted_at) {
    return { error: "This client has been deleted and can no longer be edited." };
  }

  // Optimistic concurrency (brief §5.6). `clients.updated_at` is stamped by the
  // clients_updated_at trigger on every write, so a stale token means someone
  // else saved between this form loading and submitting.
  if (updatedAtToken !== current.updated_at) {
    return {
      error: "This client was updated by someone else. Reload to see the latest.",
    };
  }

  // Typed as the generated `clients` Update row, so every key below is checked
  // against the live schema before it ever reaches PostgREST.
  const patch: ClientUpdate = {
    full_name: parsed.data.full_name,
    email: normalizeEmail(parsed.data.email),
    gender_preference: parsed.data.gender_preference,
    phone: normalizePhone(parsed.data.phone),
    address: parsed.data.address || null,
    postcode: parsed.data.postcode || null,
    city: parsed.data.city || null,
    area: parsed.data.area || null,
    client_source: parsed.data.client_source,
    source_detail: parsed.data.source_detail || null,
    notes: parsed.data.notes || null,
  };

  // Field-level gate. The form already renders these read-only for actors
  // without the permission; dropping them here is the belt to that braces —
  // a hand-crafted POST gets the same treatment as the UI.
  if (!canManageClientIdentityFields(actor)) {
    for (const field of CLIENT_IDENTITY_FIELDS) {
      delete patch[field];
    }
  }

  if (patch.email && patch.email !== current.email) {
    const { data: clash, error: clashError } = await adminClient
      .from("clients")
      .select("id, full_name")
      .eq("email", patch.email)
      .neq("id", clientId)
      .limit(1)
      .maybeSingle<{ id: string; full_name: string }>();
    if (clashError) return { error: clashError.message };
    if (clash) {
      return {
        error: `Email already in use by ${clash.full_name}. Resolve manually.`,
      };
    }
  }

  const changed: ClientUpdate = {};
  for (const field of CLIENT_EDITABLE_FIELDS) {
    collectChangedClientField(field, patch, current, changed);
  }

  if (Object.keys(changed).length > 0) {
    const { error: updateError } = await adminClient
      .from("clients")
      .update(changed)
      .eq("id", clientId);
    if (updateError) return { error: updateError.message };

    await adminClient.from("audit_logs").insert({
      actor_staff_id: actor.id,
      action_type: "client_updated",
      target_type: "clients",
      target_id: clientId,
      before_state: current,
      after_state: changed,
    });
  }

  updateTag("report-data");
  updateTag("dashboard-data");
  updateTag(TAGS.CLIENTS);
  updateTag(TAGS.AUDIT);
  revalidatePath("/admin/clients");
  revalidatePath(`/admin/clients/${clientId}`);
  redirect(`/admin/clients/${clientId}?updated=1`);
}

export type DeleteClientReason = "admin_delete" | "gdpr_erasure";

export interface DeleteClientResult {
  success: boolean;
  alreadyDeleted?: boolean;
  cascadedBookingCount?: number;
  error?: string;
}

export interface BulkDeleteClientsState {
  deletedCount?: number;
  errors?: string[];
  error?: string;
}

/**
 * Full pre-delete snapshot — `before_state` on the audit row. This is what
 * `select("*")` actually returns, so it is the generated row type rather than a
 * hand-written `Record<string, unknown>`: the loose version hid both the real
 * column set and the fact that `unknown` values cannot be written to a `jsonb`
 * column.
 */
type ClientFullRow = ClientRow;

/**
 * ⚠️ `recurring_booking_templates` HAS ARRIVED — `20260802122636_c02_recurring
 * _bookings.sql:251`. This said "arrives with C-02, which lands after C-06.
 * Until then the table is simply absent"; C-02 landed (ITEM I.2).
 *
 * The tolerance below is KEPT: it lets this cascade run against a database that
 * has not been migrated yet, which matters because app code and DDL deploy
 * separately here. PostgREST answers a missing table from its schema cache with
 * PGRST205, older builds surfaced Postgres' own 42P01 (undefined_table). Either
 * is a clean no-op, not a failure.
 */
const MISSING_TABLE_CODES = new Set(["PGRST205", "42P01"]);

/**
 * ⚠️ `bookings.cancelled_at` HAS ARRIVED — `20260728073903_c04a_scheduled
 * _emails.sql`, and is exercised by `__tests__/deleteClient.test.ts`. This said
 * it "arrives with C-04a … the plan immediately after this one" (ITEM I.2).
 *
 * The tolerance is KEPT for the same reason as the table check above: a deploy
 * can precede its migration. PostgREST rejects an unknown column with PGRST204,
 * raw Postgres with 42703 (undefined_column).
 */
const MISSING_COLUMN_CODES = new Set(["PGRST204", "42703"]);

function hasErrorCode(error: unknown, codes: Set<string>) {
  const code = (error as { code?: unknown } | null)?.code;
  return typeof code === "string" && codes.has(code);
}

/**
 * `before_state` for the `client_deleted` audit row. The two reasons get
 * deliberately different shapes — do NOT collapse this back into one branch:
 *
 * - `admin_delete` keeps the FULL pre-delete row. The record has been hidden,
 *   not erased, and this snapshot is the only way to reconstruct an accidental
 *   deletion.
 * - `gdpr_erasure` keeps identifiers and timestamps ONLY. An Article 17 erasure
 *   that left the erased person's name, email, phone, address and notes sitting
 *   in `audit_logs` indefinitely would not be an erasure at all. For an erasure
 *   the audit row's job is to prove WHEN and BY WHOM — never to preserve WHAT.
 *
 * Whitelist, not blacklist: any column added to `clients` later stays out of
 * the erasure snapshot by default.
 */
function auditBeforeState(reason: DeleteClientReason, current: ClientFullRow) {
  if (reason !== "gdpr_erasure") return current;
  return {
    id: current.id,
    created_at: current.created_at ?? null,
    updated_at: current.updated_at ?? null,
    deleted_at: current.deleted_at ?? null,
    pii_redacted: true,
  };
}

/**
 * The delete primitive. Every caller gates first (`adminDeleteClient` /
 * `bulkDeleteClients` require `manage_client_destructive_ops`; the privacy
 * "Completed" handler requires `manage_privacy_operations`), and this function
 * re-asserts the same permission itself — belt-and-braces, not a replacement.
 *
 * The re-assertion exists because this module is `"use server"`, so the export
 * is technically dispatchable. It is not exploitable today — the `adminClient`
 * parameter is a live Supabase client that React's action decoder cannot
 * materialise from a crafted POST — but argument serialisation is a fragile
 * thing to rest a destructive, GDPR-relevant operation on. The export itself is
 * forced: the privacy handler has to import it.
 *
 * Cascade order matters and is fixed by the plan (§1 Step 9) as amended below:
 * the client soft-delete runs LAST, immediately before the audit row.
 */
export async function deleteClient(
  clientId: string,
  reason: DeleteClientReason,
  adminClient: ReturnType<typeof createSupabaseAdminClient>,
  actorStaffId: string
): Promise<DeleteClientResult> {
  // Same predicates the callers gate on, re-evaluated here: an admin delete
  // needs `manage_client_destructive_ops` on top of client management, an
  // erasure needs `manage_privacy_operations`. Non-throwing composition rather
  // than `requireClientDestructiveOpsManager()` / `requirePrivacyManager()`
  // because this function reports failure through its result object.
  const profile = await getStaffProfile(await createSupabaseServerClient());
  const permitted =
    reason === "gdpr_erasure"
      ? getClientDataAccess(profile, { hasAssignedBooking: false })
          .canManagePrivacyOperations
      : canManageAllClients(profile) && canManageClientDestructiveOps(profile);
  if (!permitted) {
    return { success: false, error: "Insufficient permissions." };
  }

  const { data: current, error: currentError } = await adminClient
    .from("clients")
    .select("*")
    .eq("id", clientId)
    .single<ClientFullRow>();

  if (currentError || !current) {
    return {
      success: false,
      error: "This client record could not be loaded. Reload and try again.",
    };
  }

  const deletedAt = new Date().toISOString();

  // Idempotent (brief §5.5): deleting an already-deleted client — the Delete
  // button followed by a privacy "Completed", say — records the attempt and
  // skips the cascade rather than cancelling a second round of bookings.
  if (current.deleted_at) {
    await adminClient.from("audit_logs").insert({
      actor_staff_id: actorStaffId,
      action_type: "client_deleted",
      target_type: "clients",
      target_id: clientId,
      before_state: { ...auditBeforeState(reason, current), already_deleted: true },
      after_state: {
        deleted_at: current.deleted_at,
        reason,
        already_deleted: true,
      },
    });
    // C-09 Phase B fix round (plan Q9.2: "every action that writes
    // audit_logs tags audit") — this early return wrote an audit row above
    // but reached no updateTag call at all.
    updateTag(TAGS.AUDIT);
    return { success: true, alreadyDeleted: true };
  }

  // Cancel active recurring templates BEFORE the client soft-delete (D1,
  // C-02 cross-plan). C-02's `recurring_booking_templates.client_id` FK is
  // ON DELETE RESTRICT, so live templates left behind would block the delete
  // once C-02 ships.
  let recurringTemplatesTableExists = true;
  let cancelledTemplateIds: string[] = [];
  const templates = await adminClient
    .from("recurring_booking_templates")
    .update({ cancelled_at: deletedAt })
    .eq("client_id", clientId)
    .is("cancelled_at", null)
    .select("id");
  if (templates.error) {
    if (!hasErrorCode(templates.error, MISSING_TABLE_CODES)) {
      return { success: false, error: templates.error.message };
    }
    recurringTemplatesTableExists = false;
  } else {
    cancelledTemplateIds = ((templates.data ?? []) as { id: string }[]).map(
      (row) => row.id
    );
  }

  // Cascade-cancel open bookings only. Completed bookings are NEVER touched —
  // they are a tax + ICO record (brief §5.4) — and cancelled ones are already
  // inert.
  //
  // `cancelled_at` is C-04a's S7 restore-window key, added by the plan that
  // lands directly after this one. Attempt the stamped payload first so the
  // cascade joins that convention the moment C-04a's migration is live, and
  // fall back while the column is still absent. `deleted_at` stays in BOTH
  // payloads, so its absence (pre-C-06 migration) still fails loudly instead of
  // silently "succeeding" without soft-deleting anything.
  //
  // The plan's `cancellation_reason = 'client_deleted'` is deliberately not
  // sent: no migration anywhere in the programme creates that column, and the
  // reason already rides on this call's audit row (`after_state.reason`).
  const cascadeOpenBookings = (payload: BookingUpdate) =>
    adminClient
      .from("bookings")
      .update(payload)
      .eq("client_id", clientId)
      .not("status", "in", "(cancelled,completed)")
      .select("id");

  let cascade = await cascadeOpenBookings({
    deleted_at: deletedAt,
    status: "cancelled",
    cancelled_at: deletedAt,
  });
  if (cascade.error && hasErrorCode(cascade.error, MISSING_COLUMN_CODES)) {
    cascade = await cascadeOpenBookings({
      deleted_at: deletedAt,
      status: "cancelled",
    });
  }
  if (cascade.error) {
    return { success: false, error: cascade.error.message };
  }
  const cascadedBookingIds = ((cascade.data ?? []) as { id: string }[]).map(
    (row) => row.id
  );

  // Hard delete, not soft: UK GDPR Article 17 means special-category health
  // data has to actually disappear.
  const notes = await adminClient
    .from("client_notes")
    .delete()
    .eq("client_id", clientId)
    .eq("is_sensitive", true)
    .select("id");
  if (notes.error) {
    return { success: false, error: notes.error.message };
  }
  const sensitiveNotesDeletedCount = ((notes.data ?? []) as { id: string }[])
    .length;

  // Soft-delete the client LAST, once every step that can fail has succeeded.
  // PostgREST gives us no transaction, so ordering is the only atomicity we
  // have. Stamping `deleted_at` first would mean any later failure left the
  // client flagged deleted with its bookings still open, its sensitive notes
  // still present and no audit row — and the retry would hit the idempotency
  // guard above, report `{ success: true, alreadyDeleted: true }` and skip the
  // cascade and the Article 17 note deletion permanently. Running it here means
  // a mid-run failure leaves a fully live, un-deleted, retryable record.
  const { error: softDeleteError } = await adminClient
    .from("clients")
    .update({ deleted_at: deletedAt })
    .eq("id", clientId);
  if (softDeleteError) {
    return { success: false, error: softDeleteError.message };
  }

  // Plan step 9.6 — audit-log `target_label` anonymisation — is SKIPPED:
  // `audit_logs` has no `target_label` column (verified against the live
  // schema), and the plan permits skipping the step when it is absent.

  const { count: completedBookingsPreserved } = await adminClient
    .from("bookings")
    .select("id", { count: "exact", head: true })
    .eq("client_id", clientId)
    .eq("status", "completed");

  // One rolled-up row per call: a bulk delete of N clients writes N audit rows,
  // never N × cascaded bookings (brief §2.3).
  await adminClient.from("audit_logs").insert({
    actor_staff_id: actorStaffId,
    action_type: "client_deleted",
    target_type: "clients",
    target_id: clientId,
    before_state: auditBeforeState(reason, current),
    after_state: {
      deleted_at: deletedAt,
      reason,
      cascaded_booking_count: cascadedBookingIds.length,
      cascaded_booking_ids: cascadedBookingIds,
      completed_bookings_preserved_count: completedBookingsPreserved ?? 0,
      sensitive_notes_deleted_count: sensitiveNotesDeletedCount,
      ...(recurringTemplatesTableExists
        ? {
            cancelled_recurring_template_count: cancelledTemplateIds.length,
            cancelled_recurring_template_ids: cancelledTemplateIds,
          }
        : {}),
    },
  });

  updateTag("report-data");
  updateTag("dashboard-data");
  updateTag(TAGS.CLIENTS);
  updateTag(TAGS.BOOKINGS);
  updateTag(TAGS.AUDIT);
  // C-09 Phase B fix round: TAGS.EMAILS was dropped here — deleteClient
  // sends no email and writes no email_delivery_events row (the booking
  // cascade above is a direct status update, not a call through
  // sendBookingCancellationEmails or any other notification path), so the
  // emails tag guarded nothing this action actually touches.
  revalidatePath("/admin/clients");
  revalidatePath(`/admin/clients/${clientId}`);
  revalidatePath("/admin/bookings");
  revalidatePath("/admin/audit");
  revalidatePath("/admin/privacy");
  revalidatePath("/admin/dashboard");

  return { success: true, cascadedBookingCount: cascadedBookingIds.length };
}

export async function adminDeleteClient(
  formData: FormData
): Promise<ClientActionState> {
  let actor;
  try {
    actor = await requireClientDestructiveOpsManager();
  } catch {
    return { error: "Insufficient permissions." };
  }

  const clientId = String(formData.get("client_id") ?? "").trim();
  if (!clientId) return { error: "Client is required." };

  const result = await deleteClient(
    clientId,
    "admin_delete",
    createSupabaseAdminClient(),
    actor.id
  );
  if (!result.success) {
    return { error: result.error ?? "Couldn't delete that client. Try again." };
  }

  redirect("/admin/clients?deleted=1");
}

export async function bulkDeleteClients(
  formData: FormData
): Promise<BulkDeleteClientsState> {
  let actor;
  try {
    actor = await requireClientDestructiveOpsManager();
  } catch {
    return { error: "Insufficient permissions." };
  }

  const clientIds = formData
    .getAll("client_ids")
    .map((value) => String(value).trim())
    .filter(Boolean);
  if (clientIds.length === 0) {
    return { error: "Select at least one client first." };
  }

  const adminClient = createSupabaseAdminClient();
  const errors: string[] = [];
  let deletedCount = 0;

  // Serial, never parallel: one client at a time keeps the per-row transaction
  // footprint predictable, and a partial run is simply re-runnable on whatever
  // is still selected (plan §4).
  for (const clientId of clientIds) {
    const result = await deleteClient(
      clientId,
      "admin_delete",
      adminClient,
      actor.id
    );
    if (result.success) {
      deletedCount += 1;
    } else {
      errors.push(result.error ?? `Couldn't delete client ${clientId}.`);
    }
  }

  revalidatePath("/admin/clients");
  return { deletedCount, errors };
}

export async function addClientNote(
  _previousState: ClientActionState,
  formData: FormData
): Promise<ClientActionState> {
  let actor;
  try {
    actor = await requireClientNoteActor();
  } catch {
    return { error: "Insufficient permissions." };
  }

  const clientId = String(formData.get("client_id") ?? "").trim();
  const note = String(formData.get("note") ?? "").trim();
  if (!clientId) return { error: "Client is required." };
  if (!note) return { fieldErrors: { note: "Note is required." } };

  const adminClient = createSupabaseAdminClient();
  const hasAssignedBooking = await hasAssignedClientBooking(
    clientId,
    actor.id,
    adminClient
  );
  const access = getClientDataAccess(actor, { hasAssignedBooking });
  if (!access.canViewClient || !access.canCreateClientNote) {
    return { error: "Insufficient permissions." };
  }

  const { data, error } = await adminClient
    .from("client_notes")
    .insert({
      client_id: clientId,
      author_staff_id: actor.id,
      note,
      is_sensitive: access.canCreateSensitiveNote,
    })
    .select()
    .single();

  if (error) return { error: error.message };

  await adminClient.from("audit_logs").insert({
    actor_staff_id: actor.id,
    action_type: "client_note_added",
    target_type: "client_notes",
    target_id: data.id,
    // ⛔ FIND-08-A. This was the literal `true`, while the row two statements
    // above is written with `access.canCreateSensitiveNote`. The two disagree
    // for every Therapist: they hold `create_client_session_notes` but neither
    // `manage_sensitive_client_notes` nor `manage_privacy_operations`, so their
    // note is correctly stored as NOT sensitive and the audit trail recorded it
    // as sensitive anyway.
    //
    // ⚠️ Not cosmetic. `is_sensitive` decides who can READ the note: the client
    // detail page issues two separate permission-gated queries, one over
    // `is_sensitive = false` and one over `is_sensitive = true`. So the audit
    // log was describing a note as belonging to a category more restricted than
    // the one it is actually visible in — on the clinic's most sensitive data.
    after_state: { client_id: clientId, is_sensitive: access.canCreateSensitiveNote },
  });

  updateTag(TAGS.CLIENTS);
  updateTag(TAGS.AUDIT);
  revalidatePath(`/admin/clients/${clientId}`);
  return { success: true };
}

export async function createClientPrivacyRequest(
  _previousState: ClientActionState,
  formData: FormData
): Promise<ClientActionState> {
  let actor;
  try {
    actor = await requirePrivacyManager();
  } catch {
    return { error: "Insufficient permissions." };
  }

  const clientId = String(formData.get("client_id") ?? "").trim();
  const requestType = String(formData.get("request_type") ?? "");
  const requestNote = String(formData.get("request_note") ?? "").trim();
  if (!clientId) return { error: "Client is required." };
  if (!PRIVACY_REQUEST_TYPES.includes(requestType as (typeof PRIVACY_REQUEST_TYPES)[number])) {
    return { fieldErrors: { request_type: "Choose a valid privacy request." } };
  }

  const adminClient = createSupabaseAdminClient();
  const access = getClientDataAccess(actor, { hasAssignedBooking: false });
  if (!access.canViewClient || !access.canManagePrivacyOperations) {
    return { error: "Insufficient permissions." };
  }

  const { data, error } = await adminClient
    .from("client_privacy_requests")
    .insert({
      client_id: clientId,
      request_type: requestType,
      request_note: requestNote || null,
      created_by_staff_id: actor.id,
    })
    .select()
    .single();

  if (error) return { error: error.message };

  await adminClient.from("audit_logs").insert({
    actor_staff_id: actor.id,
    action_type: "client_privacy_request_created",
    target_type: "client_privacy_requests",
    target_id: data.id,
    after_state: data,
  });

  updateTag(TAGS.CLIENTS);
  updateTag(TAGS.AUDIT);
  revalidatePath(`/admin/clients/${clientId}`);
  return { success: true };
}
