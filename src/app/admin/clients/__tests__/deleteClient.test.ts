import { redirect } from "next/navigation";
import { beforeEach, describe, expect, it, vi } from "vitest";
import { getStaffProfile, PERMISSIONS, type StaffProfile } from "@/lib/auth/rbac";
import { createSupabaseAdminClient } from "@/lib/supabase/admin";
import { adminDeleteClient, bulkDeleteClients, deleteClient } from "../actions";

vi.mock("next/cache", () => ({
  revalidatePath: vi.fn(),
  updateTag: vi.fn(),
}));

vi.mock("next/navigation", () => ({
  redirect: vi.fn(),
}));

vi.mock("@/lib/supabase/admin", () => ({
  createSupabaseAdminClient: vi.fn(),
}));

vi.mock("@/lib/supabase/server", () => ({
  createSupabaseServerClient: vi.fn().mockResolvedValue({}),
}));

// Only the profile lookup is stubbed — the permission helpers stay real so the
// actions are gated exactly as they are in production.
vi.mock("@/lib/auth/rbac", async (importOriginal) => ({
  ...(await importOriginal<typeof import("@/lib/auth/rbac")>()),
  getStaffProfile: vi.fn(),
}));

const CLIENT_ROW = {
  id: "client-1",
  full_name: "Sara Mohamed",
  phone: "07100 000 000",
  email: "sara@example.test",
  gender_preference: "no_preference",
  address: "1 Test Street",
  postcode: "LU1 1AA",
  city: "Luton",
  area: "Bury Park",
  client_source: "website",
  source_detail: null,
  notes: "Prefers mornings.",
  created_at: "2026-01-01T09:00:00.000Z",
  updated_at: "2026-07-01T09:00:00.000Z",
  deleted_at: null as string | null,
};

function staff(name: string, permissions: string[]): StaffProfile {
  return {
    id: `staff-${name}`,
    auth_user_id: `auth-${name}`,
    name,
    email: `${name}@rahmatherapy.example.test`,
    role_id: `role-${name}`,
    role_name: name,
    gender: "female",
    active: true,
    can_take_bookings: false,
    availability_mode: "use_global",
    permissions: new Set(permissions),
  };
}

const owner = staff("Owner", [
  PERMISSIONS.MANAGE_CLIENTS_ALL,
  PERMISSIONS.MANAGE_CLIENT_DESTRUCTIVE_OPS,
  PERMISSIONS.MANAGE_PRIVACY_OPERATIONS,
]);
const coordinator = staff("Coordinator", [PERMISSIONS.MANAGE_CLIENTS_ALL]);
// The two halves of the Owner's delete authority, split apart so the
// in-function gate can be shown to check a *different* permission per reason
// rather than one blanket check.
const destructiveOnly = staff("Destructive", [
  PERMISSIONS.MANAGE_CLIENTS_ALL,
  PERMISSIONS.MANAGE_CLIENT_DESTRUCTIVE_OPS,
]);
const privacyOnly = staff("Privacy", [PERMISSIONS.MANAGE_PRIVACY_OPERATIONS]);

/** PII columns that must never reach a `gdpr_erasure` audit row. */
const PII_FIELDS = [
  "full_name",
  "email",
  "phone",
  "address",
  "postcode",
  "city",
  "area",
  "notes",
];

/** Identifiers + timestamps only — the `gdpr_erasure` `before_state`. */
const REDACTED_BEFORE_STATE = {
  id: CLIENT_ROW.id,
  created_at: CLIENT_ROW.created_at,
  updated_at: CLIENT_ROW.updated_at,
  deleted_at: null,
  pii_redacted: true,
};

interface RecordedOp {
  table: string;
  op: "select" | "update" | "delete" | "insert";
  payload?: Record<string, unknown>;
  filters: string[];
  selected?: string;
}

interface StubResult {
  data?: unknown;
  error?: { code?: string; message: string } | null;
  count?: number | null;
}

interface Chain {
  eq: (column: string, value: unknown) => Chain;
  is: (column: string, value: unknown) => Chain;
  not: (column: string, operator: string, value: unknown) => Chain;
  select: (columns: string, options?: { count?: string; head?: boolean }) => Chain;
  single: <T>() => Promise<{ data: T | null; error: unknown }>;
  then: (
    onFulfilled: (value: StubResult) => unknown,
    onRejected?: (reason: unknown) => unknown
  ) => Promise<unknown>;
}

const MISSING_TABLE = {
  code: "PGRST205",
  message:
    "Could not find the table 'public.recurring_booking_templates' in the schema cache",
};

const MISSING_CANCELLED_AT = {
  code: "PGRST204",
  message:
    "Could not find the 'cancelled_at' column of 'bookings' in the schema cache",
};

/**
 * Stand-in for the Supabase admin client covering exactly the chains
 * `deleteClient` builds. Every call lands in `ops` in order, which is what lets
 * the specs pin the cascade *sequence* — the recurring-template cancellation
 * has to happen before the client soft-delete, not merely somewhere in the run.
 */
function stubAdminClient({
  current = CLIENT_ROW as Record<string, unknown>,
  recurringTemplatesExist = true,
  activeTemplates = [{ id: "template-1" }],
  bookingsHaveCancelledAt = false,
  openBookings = [{ id: "booking-1" }, { id: "booking-2" }],
  sensitiveNotes = [{ id: "note-1" }],
  completedBookingCount = 5,
  clientUpdateError = null as { code?: string; message: string } | null,
  cascadeError = null as { code?: string; message: string } | null,
} = {}) {
  const ops: RecordedOp[] = [];

  function resolve(entry: RecordedOp): StubResult {
    if (entry.table === "clients") {
      return entry.op === "select"
        ? { data: current, error: null }
        : { data: null, error: clientUpdateError };
    }
    if (entry.table === "recurring_booking_templates") {
      return recurringTemplatesExist
        ? { data: activeTemplates, error: null }
        : { data: null, error: MISSING_TABLE };
    }
    if (entry.table === "bookings") {
      if (entry.op === "select") return { data: null, error: null, count: completedBookingCount };
      if (cascadeError) return { data: null, error: cascadeError };
      const stamped = Object.hasOwn(entry.payload ?? {}, "cancelled_at");
      return stamped && !bookingsHaveCancelledAt
        ? { data: null, error: MISSING_CANCELLED_AT }
        : { data: openBookings, error: null };
    }
    if (entry.table === "client_notes") return { data: sensitiveNotes, error: null };
    return { data: null, error: null };
  }

  function startOp(
    table: string,
    op: RecordedOp["op"],
    payload?: Record<string, unknown>
  ): Chain {
    const entry: RecordedOp = { table, op, payload, filters: [] };
    ops.push(entry);
    const chain: Chain = {
      eq: (column, value) => {
        entry.filters.push(`eq:${column}=${String(value)}`);
        return chain;
      },
      is: (column, value) => {
        entry.filters.push(`is:${column}=${String(value)}`);
        return chain;
      },
      not: (column, operator, value) => {
        entry.filters.push(`not:${column}.${operator}=${String(value)}`);
        return chain;
      },
      select: (columns) => {
        entry.selected = columns;
        return chain;
      },
      single: <T,>() =>
        Promise.resolve(
          resolve(entry) as unknown as { data: T | null; error: unknown }
        ),
      then: (onFulfilled, onRejected) =>
        Promise.resolve(resolve(entry)).then(onFulfilled, onRejected),
    };
    return chain;
  }

  const from = vi.fn((table: string) => {
    if (table === "audit_logs") {
      return {
        insert: async (row: Record<string, unknown>) => {
          ops.push({ table, op: "insert", payload: row, filters: [] });
          return { error: null };
        },
      };
    }
    return {
      select: (columns: string) => startOp(table, "select").select(columns),
      update: (payload: Record<string, unknown>) => startOp(table, "update", payload),
      delete: () => startOp(table, "delete"),
    };
  });

  const client = { from } as unknown as ReturnType<typeof createSupabaseAdminClient>;
  vi.mocked(createSupabaseAdminClient).mockReturnValue(client);

  const sequence = () => ops.map((entry) => `${entry.table}:${entry.op}`);
  const find = (table: string, op: RecordedOp["op"]) =>
    ops.filter((entry) => entry.table === table && entry.op === op);

  return { ops, sequence, find, client };
}

describe("deleteClient", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    // `deleteClient` re-asserts the caller's permission itself, so every direct
    // call needs a session profile that holds it.
    vi.mocked(getStaffProfile).mockResolvedValue(owner);
  });

  it("soft-deletes the client, cancels only open bookings, and hard-deletes sensitive notes", async () => {
    const stub = stubAdminClient();

    const result = await deleteClient(
      "client-1",
      "admin_delete",
      stub.client,
      owner.id
    );

    expect(result).toEqual({ success: true, cascadedBookingCount: 2 });

    const [clientUpdate] = stub.find("clients", "update");
    expect(clientUpdate.payload).toMatchObject({ deleted_at: expect.any(String) });
    expect(clientUpdate.filters).toEqual(["eq:id=client-1"]);

    // Completed bookings are a tax + ICO record and cancelled ones are already
    // inert — the cascade must exclude both, and it must never name a status
    // it intends to overwrite.
    const cascade = stub.find("bookings", "update").at(-1)!;
    expect(cascade.payload).toMatchObject({ status: "cancelled" });
    expect(cascade.filters).toEqual([
      "eq:client_id=client-1",
      "not:status.in=(cancelled,completed)",
    ]);

    const [notesDelete] = stub.find("client_notes", "delete");
    expect(notesDelete.filters).toEqual([
      "eq:client_id=client-1",
      "eq:is_sensitive=true",
    ]);
  });

  it("cancels active recurring templates before the client soft-delete", async () => {
    const stub = stubAdminClient();

    await deleteClient("client-1", "admin_delete", stub.client, owner.id);

    const sequence = stub.sequence();
    expect(sequence.indexOf("recurring_booking_templates:update")).toBeLessThan(
      sequence.indexOf("clients:update")
    );

    const [templates] = stub.find("recurring_booking_templates", "update");
    expect(templates.payload).toMatchObject({ cancelled_at: expect.any(String) });
    expect(templates.filters).toEqual([
      "eq:client_id=client-1",
      "is:cancelled_at=null",
    ]);

    const audit = stub.find("audit_logs", "insert")[0].payload!;
    expect(audit.after_state).toMatchObject({
      cancelled_recurring_template_count: 1,
      cancelled_recurring_template_ids: ["template-1"],
    });
  });

  it("stamps deleted_at only after the whole cascade has succeeded", async () => {
    const stub = stubAdminClient();

    await deleteClient("client-1", "admin_delete", stub.client, owner.id);

    // There is no transaction to roll back, so the soft-delete has to be the
    // LAST mutation: it is the flag the idempotency guard reads on a retry.
    const sequence = stub.sequence();
    const softDelete = sequence.indexOf("clients:update");
    expect(softDelete).toBeGreaterThan(sequence.indexOf("bookings:update"));
    expect(softDelete).toBeGreaterThan(sequence.indexOf("client_notes:delete"));
    expect(softDelete).toBeLessThan(sequence.indexOf("audit_logs:insert"));
  });

  it("never stamps deleted_at when an earlier cascade step fails", async () => {
    const stub = stubAdminClient({
      cascadeError: { message: "permission denied for table bookings" },
    });

    const result = await deleteClient(
      "client-1",
      "gdpr_erasure",
      stub.client,
      owner.id
    );

    expect(result).toEqual({
      success: false,
      error: "permission denied for table bookings",
    });
    // The whole point: the client stays live and retryable. Had `deleted_at`
    // been written first, the retry would short-circuit on the idempotency
    // guard and the cascade + Article 17 note deletion would never run.
    expect(stub.find("clients", "update")).toHaveLength(0);
    expect(stub.sequence()).not.toContain("clients:update");
    expect(stub.find("audit_logs", "insert")).toHaveLength(0);
  });

  it("treats the missing recurring-templates table as a clean pre-C-02 no-op", async () => {
    const stub = stubAdminClient({ recurringTemplatesExist: false });

    const result = await deleteClient(
      "client-1",
      "admin_delete",
      stub.client,
      owner.id
    );

    // The delete still completes, and the roll-up omits the template keys
    // rather than reporting a phantom zero.
    expect(result).toEqual({ success: true, cascadedBookingCount: 2 });
    expect(stub.sequence()).toContain("clients:update");
    const audit = stub.find("audit_logs", "insert")[0].payload!;
    expect(audit.after_state).not.toHaveProperty(
      "cancelled_recurring_template_count"
    );
  });

  it("falls back to an unstamped cascade while bookings.cancelled_at is absent", async () => {
    const stub = stubAdminClient({ bookingsHaveCancelledAt: false });

    const result = await deleteClient(
      "client-1",
      "admin_delete",
      stub.client,
      owner.id
    );

    const cascades = stub.find("bookings", "update");
    expect(cascades).toHaveLength(2);
    expect(cascades[0].payload).toHaveProperty("cancelled_at");
    expect(cascades[1].payload).toEqual({
      deleted_at: expect.any(String),
      status: "cancelled",
    });
    expect(result.success).toBe(true);
  });

  it("stamps cancelled_at in a single statement once the column exists", async () => {
    const stub = stubAdminClient({ bookingsHaveCancelledAt: true });

    await deleteClient("client-1", "admin_delete", stub.client, owner.id);

    const cascades = stub.find("bookings", "update");
    expect(cascades).toHaveLength(1);
    expect(cascades[0].payload).toMatchObject({
      status: "cancelled",
      cancelled_at: expect.any(String),
      deleted_at: expect.any(String),
    });
  });

  it("is idempotent on an already-deleted client", async () => {
    const stub = stubAdminClient({
      current: { ...CLIENT_ROW, deleted_at: "2026-07-20T09:00:00.000Z" },
    });

    const result = await deleteClient(
      "client-1",
      "gdpr_erasure",
      stub.client,
      owner.id
    );

    expect(result).toEqual({ success: true, alreadyDeleted: true });
    // No second cascade: nothing is written beyond the audit trail.
    expect(stub.sequence()).toEqual(["clients:select", "audit_logs:insert"]);
    const audit = stub.find("audit_logs", "insert")[0].payload!;
    expect(audit.after_state).toEqual({
      deleted_at: "2026-07-20T09:00:00.000Z",
      reason: "gdpr_erasure",
      already_deleted: true,
    });
    // The idempotent path is the one brief §5.5 reaches on a privacy
    // "Completed" — it must redact exactly like the full path, or the leak
    // simply moves here.
    expect(audit.before_state).toEqual({
      ...REDACTED_BEFORE_STATE,
      deleted_at: "2026-07-20T09:00:00.000Z",
      already_deleted: true,
    });
  });

  it("writes one rolled-up audit row carrying the whole cascade summary", async () => {
    const stub = stubAdminClient();

    await deleteClient("client-1", "admin_delete", stub.client, owner.id);

    const audits = stub.find("audit_logs", "insert");
    expect(audits).toHaveLength(1);
    expect(audits[0].payload).toMatchObject({
      actor_staff_id: owner.id,
      action_type: "client_deleted",
      target_type: "clients",
      target_id: "client-1",
    });
    expect(audits[0].payload!.after_state).toEqual({
      deleted_at: expect.any(String),
      reason: "admin_delete",
      cascaded_booking_count: 2,
      cascaded_booking_ids: ["booking-1", "booking-2"],
      completed_bookings_preserved_count: 5,
      sensitive_notes_deleted_count: 1,
      cancelled_recurring_template_count: 1,
      cancelled_recurring_template_ids: ["template-1"],
    });
  });

  it("keeps the full client snapshot in before_state for an admin_delete", async () => {
    const stub = stubAdminClient();

    await deleteClient("client-1", "admin_delete", stub.client, owner.id);

    // An admin delete hides the record, it does not erase it — the full
    // snapshot is the only way back from an accidental deletion.
    expect(stub.find("audit_logs", "insert")[0].payload!.before_state).toEqual(
      CLIENT_ROW
    );
  });

  it("redacts PII from before_state for a gdpr_erasure", async () => {
    const stub = stubAdminClient();

    await deleteClient("client-1", "gdpr_erasure", stub.client, owner.id);

    const audit = stub.find("audit_logs", "insert")[0].payload!;
    expect(audit.before_state).toEqual(REDACTED_BEFORE_STATE);
    // Named explicitly: an Article 17 erasure must not leave a queryable copy
    // of the erased person's data in audit_logs.
    for (const field of PII_FIELDS) {
      expect(audit.before_state).not.toHaveProperty(field);
    }
    // after_state — the cascade roll-up — is unchanged by the redaction.
    expect(audit.after_state).toEqual({
      deleted_at: expect.any(String),
      reason: "gdpr_erasure",
      cascaded_booking_count: 2,
      cascaded_booking_ids: ["booking-1", "booking-2"],
      completed_bookings_preserved_count: 5,
      sensitive_notes_deleted_count: 1,
      cancelled_recurring_template_count: 1,
      cancelled_recurring_template_ids: ["template-1"],
    });
  });

  // Defence in depth: the caller-side gates stay, and these prove the primitive
  // refuses on its own if it is ever reached without one.
  it("refuses an admin_delete from an actor without destructive ops", async () => {
    vi.mocked(getStaffProfile).mockResolvedValue(coordinator);
    const stub = stubAdminClient();

    const result = await deleteClient(
      "client-1",
      "admin_delete",
      stub.client,
      coordinator.id
    );

    expect(result).toEqual({ success: false, error: "Insufficient permissions." });
    expect(stub.ops).toHaveLength(0);
  });

  it("refuses a gdpr_erasure from a destructive-ops holder without privacy operations", async () => {
    vi.mocked(getStaffProfile).mockResolvedValue(destructiveOnly);
    const stub = stubAdminClient();

    const result = await deleteClient(
      "client-1",
      "gdpr_erasure",
      stub.client,
      destructiveOnly.id
    );

    expect(result).toEqual({ success: false, error: "Insufficient permissions." });
    expect(stub.ops).toHaveLength(0);
  });

  it("allows a gdpr_erasure for a privacy-operations holder without destructive ops", async () => {
    vi.mocked(getStaffProfile).mockResolvedValue(privacyOnly);
    const stub = stubAdminClient();

    const erasure = await deleteClient(
      "client-1",
      "gdpr_erasure",
      stub.client,
      privacyOnly.id
    );
    expect(erasure).toEqual({ success: true, cascadedBookingCount: 2 });

    // ...and the same actor still cannot run an admin delete.
    const adminDelete = await deleteClient(
      "client-1",
      "admin_delete",
      stub.client,
      privacyOnly.id
    );
    expect(adminDelete).toEqual({
      success: false,
      error: "Insufficient permissions.",
    });
  });
});

describe("adminDeleteClient", () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  function deleteFormData(clientId = "client-1") {
    const formData = new FormData();
    formData.set("client_id", clientId);
    return formData;
  }

  it("refuses a coordinator, who manages clients but not destructive ops", async () => {
    vi.mocked(getStaffProfile).mockResolvedValue(coordinator);
    const stub = stubAdminClient();

    const result = await adminDeleteClient(deleteFormData());

    expect(result).toEqual({ error: "Insufficient permissions." });
    expect(stub.ops).toHaveLength(0);
    expect(redirect).not.toHaveBeenCalled();
  });

  it("deletes and redirects with the flash param for a destructive-ops holder", async () => {
    vi.mocked(getStaffProfile).mockResolvedValue(owner);
    const stub = stubAdminClient();

    await adminDeleteClient(deleteFormData());

    expect(stub.find("clients", "update")).toHaveLength(1);
    expect(redirect).toHaveBeenCalledWith("/admin/clients?deleted=1");
  });
});

describe("bulkDeleteClients", () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it("deletes each selection in series and accumulates failures", async () => {
    vi.mocked(getStaffProfile).mockResolvedValue(owner);
    const stub = stubAdminClient({
      clientUpdateError: { message: "permission denied for table clients" },
    });

    const formData = new FormData();
    formData.append("client_ids", "client-1");
    formData.append("client_ids", "client-2");

    const result = await bulkDeleteClients(formData);

    expect(result).toEqual({
      deletedCount: 0,
      errors: [
        "permission denied for table clients",
        "permission denied for table clients",
      ],
    });
    // Serial: the second client's read only happens after the first one failed.
    // The soft-delete is the last step of each run, so a failing one stops that
    // client's run there and the next client's read follows.
    expect(stub.sequence()).toEqual([
      "clients:select",
      "recurring_booking_templates:update",
      "bookings:update",
      "bookings:update",
      "client_notes:delete",
      "clients:update",
      "clients:select",
      "recurring_booking_templates:update",
      "bookings:update",
      "bookings:update",
      "client_notes:delete",
      "clients:update",
    ]);
  });

  it("refuses a coordinator before touching the database", async () => {
    vi.mocked(getStaffProfile).mockResolvedValue(coordinator);
    const stub = stubAdminClient();

    const formData = new FormData();
    formData.append("client_ids", "client-1");

    expect(await bulkDeleteClients(formData)).toEqual({
      error: "Insufficient permissions.",
    });
    expect(stub.ops).toHaveLength(0);
  });
});
