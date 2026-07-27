import { beforeEach, describe, expect, it, vi } from "vitest";
import { generateClientDataExport } from "../data-export";

vi.mock("@/lib/supabase/admin", () => ({
  createSupabaseAdminClient: vi.fn(),
}));

vi.mock("@/lib/supabase/server", () => ({
  createSupabaseServerClient: vi.fn().mockResolvedValue({}),
}));

vi.mock("@/lib/auth/rbac", async (importOriginal) => ({
  ...(await importOriginal<typeof import("@/lib/auth/rbac")>()),
  requirePermission: vi.fn(),
}));

const { createSupabaseAdminClient } = await import("@/lib/supabase/admin");
const { requirePermission } = await import("@/lib/auth/rbac");

const REQUEST_ID = "11111111-2222-4333-8444-555555555555";
const CLIENT_ID = "99999999-8888-4777-8666-555555555555";

const CLIENT_ROW = {
  id: CLIENT_ID,
  full_name: "Sara Mohamed",
  email: "sara@example.test",
  phone: "07100 000 000",
  notes: "Prefers mornings.",
  created_at: "2026-01-02T09:00:00.000Z",
  updated_at: "2026-05-02T09:00:00.000Z",
};

const BOOKING_ROWS = [
  { id: "booking-1", booking_date: "2026-06-01", booking_items: [], booking_assignments: [] },
];
const NOTE_ROWS = [{ id: "note-1", note: "Called back.", is_sensitive: false }];
const AUDIT_ROWS = [{ id: "audit-1", action_type: "client_updated" }];

/** Records every filter/order/limit the action applies, so the shape is provable. */
function stubAdminClient() {
  const calls = {
    noteFilters: [] as [string, unknown][],
    auditLimit: null as number | null,
    bookingSelect: "",
  };

  const from = vi.fn((table: string) => {
    if (table === "client_privacy_requests") {
      return {
        select: () => ({
          eq: () => ({
            single: async () => ({
              data: {
                id: REQUEST_ID,
                client_id: CLIENT_ID,
                request_type: "data_export",
                created_at: "2026-05-01T09:00:00.000Z",
              },
              error: null,
            }),
          }),
        }),
      };
    }
    if (table === "clients") {
      return {
        select: () => ({
          eq: () => ({ single: async () => ({ data: CLIENT_ROW, error: null }) }),
        }),
      };
    }
    if (table === "bookings") {
      return {
        select: (columns: string) => {
          calls.bookingSelect = columns;
          return {
            eq: () => ({ order: async () => ({ data: BOOKING_ROWS, error: null }) }),
          };
        },
      };
    }
    if (table === "client_notes") {
      return {
        select: () => ({
          eq: (column: string, value: unknown) => {
            calls.noteFilters.push([column, value]);
            return {
              eq: (innerColumn: string, innerValue: unknown) => {
                calls.noteFilters.push([innerColumn, innerValue]);
                return {
                  order: async () => ({ data: NOTE_ROWS, error: null }),
                };
              },
            };
          },
        }),
      };
    }
    return {
      select: () => ({
        eq: () => ({
          order: () => ({
            limit: async (count: number) => {
              calls.auditLimit = count;
              return { data: AUDIT_ROWS, error: null };
            },
          }),
        }),
      }),
    };
  });

  return { client: { from }, calls };
}

beforeEach(() => {
  vi.clearAllMocks();
  vi.mocked(requirePermission).mockResolvedValue({
    id: "staff-owner",
    name: "Owner",
  } as never);
});

describe("generateClientDataExport", () => {
  it("returns a serialisable document, not a Response", async () => {
    const stub = stubAdminClient();
    vi.mocked(createSupabaseAdminClient).mockReturnValue(stub.client as never);

    const result = await generateClientDataExport(REQUEST_ID);

    // A server action's return value crosses the RSC flight boundary, which
    // rejects class instances — a `Response` here would fail at runtime only.
    expect(result.constructor).toBe(Object);
    expect(typeof result.json).toBe("string");
    expect(result.filename).toBe(
      `client-${CLIENT_ID}-export-${new Date().toISOString().slice(0, 10)}.json`
    );
  });

  it("builds the exact export shape from brief §2.4", async () => {
    const stub = stubAdminClient();
    vi.mocked(createSupabaseAdminClient).mockReturnValue(stub.client as never);

    const result = await generateClientDataExport(REQUEST_ID);
    const document = JSON.parse(result.json as string);

    expect(Object.keys(document)).toEqual([
      "exported_at",
      "exported_by",
      "request",
      "client",
      "bookings",
      "notes",
      "audit_log_summary",
    ]);
    expect(document.exported_by).toEqual({
      staff_id: "staff-owner",
      name: "Owner",
    });
    expect(document.request).toEqual({
      id: REQUEST_ID,
      type: "data_export",
      created_at: "2026-05-01T09:00:00.000Z",
    });
    expect(document.bookings).toEqual(BOOKING_ROWS);
    expect(document.notes).toEqual(NOTE_ROWS);
    expect(document.audit_log_summary).toEqual(AUDIT_ROWS);
    expect(typeof document.exported_at).toBe("string");
  });

  it("strips the client row's id and timestamps but keeps the personal data", async () => {
    const stub = stubAdminClient();
    vi.mocked(createSupabaseAdminClient).mockReturnValue(stub.client as never);

    const result = await generateClientDataExport(REQUEST_ID);
    const { client } = JSON.parse(result.json as string);

    expect(client).toEqual({
      full_name: "Sara Mohamed",
      email: "sara@example.test",
      phone: "07100 000 000",
      notes: "Prefers mornings.",
    });
  });

  it("excludes sensitive notes, caps the audit trail at 50, and pulls booking children", async () => {
    const stub = stubAdminClient();
    vi.mocked(createSupabaseAdminClient).mockReturnValue(stub.client as never);

    await generateClientDataExport(REQUEST_ID);

    expect(stub.calls.noteFilters).toContainEqual(["is_sensitive", false]);
    expect(stub.calls.auditLimit).toBe(50);
    expect(stub.calls.bookingSelect).toContain("booking_items(*)");
    expect(stub.calls.bookingSelect).toContain("booking_assignments(*)");
  });

  it("refuses without the privacy-operations permission and reads nothing", async () => {
    const stub = stubAdminClient();
    vi.mocked(createSupabaseAdminClient).mockReturnValue(stub.client as never);
    vi.mocked(requirePermission).mockRejectedValue(new Error("nope"));

    await expect(generateClientDataExport(REQUEST_ID)).resolves.toEqual({
      error: "Insufficient permissions.",
    });
    expect(stub.client.from).not.toHaveBeenCalled();
  });
});
