// @vitest-environment jsdom
import { beforeEach, describe, expect, it } from "vitest";
import {
  loadSavedViews,
  persistSavedViews,
  storageKeyFor,
} from "../BookingsChrome";

/**
 * C-07 Phase B4 (gap 1 + gap 2, per §1.8a of the progress file) — saved
 * views used to live under one global localStorage key, so on a shared
 * front-desk browser one staff member's saved searches (which can carry a
 * client name via `search=`) persisted into the next person's session.
 * `loadSavedViews`/`persistSavedViews` are now namespaced per staff id
 * (v1 → v2); these specs pin the round-trip, the isolation between staff
 * ids, corrupt-data resilience, and the legacy-key purge (no migration).
 */
const LEGACY_GLOBAL_KEY = "rahma.admin.bookings.saved-views.v1";

describe("saved views — per-staff-id namespacing (BookingsChrome)", () => {
  beforeEach(() => {
    window.localStorage.clear();
  });

  it("storageKeyFor derives a distinct v2 key per staff id", () => {
    expect(storageKeyFor("staff-a")).toBe(
      "rahma.admin.bookings.saved-views.v2.staff-a"
    );
    expect(storageKeyFor("staff-b")).toBe(
      "rahma.admin.bookings.saved-views.v2.staff-b"
    );
    expect(storageKeyFor("staff-a")).not.toBe(storageKeyFor("staff-b"));
  });

  it("round-trips: persistSavedViews then loadSavedViews for the same staff id", () => {
    const views = [
      { id: "v1", label: "Unpaid, this week", query: "view=all&payment_status=unpaid" },
      { id: "v2", label: "Needs a therapist", query: "view=unassigned" },
    ];

    persistSavedViews("staff-a", views);

    expect(loadSavedViews("staff-a")).toEqual(views);
  });

  it("isolates saved views per staff id — staff B never sees staff A's saved views", () => {
    persistSavedViews("staff-a", [
      { id: "v1", label: "Jane's follow-up", query: "search=Jane+Doe" },
    ]);

    expect(loadSavedViews("staff-b")).toEqual([]);
    // and staff A's own data is untouched by the check above
    expect(loadSavedViews("staff-a")).toHaveLength(1);
  });

  it("returns [] when nothing has ever been saved for this staff id", () => {
    expect(loadSavedViews("staff-with-nothing-saved")).toEqual([]);
  });

  it("returns [] for a non-JSON string stored under the key", () => {
    window.localStorage.setItem(storageKeyFor("staff-a"), "not valid json{{{");

    expect(loadSavedViews("staff-a")).toEqual([]);
  });

  it("returns [] when the stored value is valid JSON but not an array", () => {
    window.localStorage.setItem(
      storageKeyFor("staff-a"),
      JSON.stringify({ id: "v1", label: "Not an array", query: "view=today" })
    );

    expect(loadSavedViews("staff-a")).toEqual([]);
  });

  it("filters out entries with wrong-typed or missing id/label/query, keeping valid ones", () => {
    const raw = [
      { id: "v1", label: "Valid entry", query: "view=today" },
      { id: 123, label: "Numeric id", query: "view=today" },
      { id: "v2", label: null, query: "view=today" },
      { id: "v3", label: "Missing query" },
      { id: "v4" },
      "not an object",
      null,
      undefined,
    ];
    window.localStorage.setItem(storageKeyFor("staff-a"), JSON.stringify(raw));

    expect(loadSavedViews("staff-a")).toEqual([
      { id: "v1", label: "Valid entry", query: "view=today" },
    ]);
  });

  it("purges the legacy global v1 key on load and never returns its contents to any staff id", () => {
    window.localStorage.setItem(
      LEGACY_GLOBAL_KEY,
      JSON.stringify([
        { id: "old", label: "Old shared view (pre-namespacing)", query: "search=Some Client" },
      ])
    );

    const resultForA = loadSavedViews("staff-a");

    expect(resultForA).toEqual([]);
    expect(window.localStorage.getItem(LEGACY_GLOBAL_KEY)).toBeNull();

    // Re-seed the legacy key to prove a second staff id also never receives it.
    window.localStorage.setItem(
      LEGACY_GLOBAL_KEY,
      JSON.stringify([{ id: "old", label: "Old shared view", query: "search=Some Client" }])
    );

    expect(loadSavedViews("staff-b")).toEqual([]);
    expect(window.localStorage.getItem(LEGACY_GLOBAL_KEY)).toBeNull();
  });

  it("is idempotent when the legacy global key is already absent", () => {
    expect(() => loadSavedViews("staff-a")).not.toThrow();
    expect(loadSavedViews("staff-a")).toEqual([]);
  });
});
