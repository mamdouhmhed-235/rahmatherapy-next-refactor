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
]);
const coordinator = staff("Coordinator", [PERMISSIONS.MANAGE_CLIENTS_ALL]);

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
  });

  it("writes one rolled-up audit row carrying the whole cascade summary", async () => {
    const stub = stubAdminClient();

    await deleteClient("client-1", "gdpr_erasure", stub.client, owner.id);

    const audits = stub.find("audit_logs", "insert");
    expect(audits).toHaveLength(1);
    expect(audits[0].payload).toMatchObject({
      actor_staff_id: owner.id,
      action_type: "client_deleted",
      target_type: "clients",
      target_id: "client-1",
      before_state: CLIENT_ROW,
    });
    expect(audits[0].payload!.after_state).toEqual({
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
    expect(stub.sequence()).toEqual([
      "clients:select",
      "recurring_booking_templates:update",
      "clients:update",
      "clients:select",
      "recurring_booking_templates:update",
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
