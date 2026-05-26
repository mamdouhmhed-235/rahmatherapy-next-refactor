import { describe, expect, it } from "vitest";
import {
  getActiveItems,
  getHighestUnreadSeverity,
  groupByDuplicate,
  isItemArchived,
  isItemRead,
  isItemSnoozed,
} from "./notification-helpers";
import type { NotificationItem } from "../reports/reporting";

function makeItem(overrides: Partial<NotificationItem> = {}): NotificationItem {
  return {
    id: overrides.id ?? "id-1",
    type: overrides.type ?? "assignment",
    title: overrides.title ?? "T",
    detail: overrides.detail ?? "D",
    severity: overrides.severity ?? "info",
    timestamp: overrides.timestamp ?? "2026-05-21",
    href: overrides.href ?? null,
    notificationId: overrides.notificationId,
    reason: overrides.reason,
    state: overrides.state,
    actionLabel: overrides.actionLabel,
    secondaryHref: overrides.secondaryHref,
    secondaryLabel: overrides.secondaryLabel,
  };
}

const NOW = new Date("2026-05-21T12:00:00Z");

describe("isItemSnoozed", () => {
  it("returns false when no state is attached", () => {
    expect(isItemSnoozed(makeItem(), NOW)).toBe(false);
  });

  it("returns false when snoozedUntil is null", () => {
    expect(
      isItemSnoozed(
        makeItem({ state: { readAt: null, snoozedUntil: null, archivedAt: null } }),
        NOW,
      ),
    ).toBe(false);
  });

  it("returns false when snooze has expired (in the past)", () => {
    expect(
      isItemSnoozed(
        makeItem({
          state: { readAt: null, snoozedUntil: "2026-05-20T12:00:00Z", archivedAt: null },
        }),
        NOW,
      ),
    ).toBe(false);
  });

  it("returns true when snoozedUntil is in the future", () => {
    expect(
      isItemSnoozed(
        makeItem({
          state: { readAt: null, snoozedUntil: "2026-05-22T12:00:00Z", archivedAt: null },
        }),
        NOW,
      ),
    ).toBe(true);
  });

  it("returns false for malformed timestamps", () => {
    expect(
      isItemSnoozed(
        makeItem({
          state: { readAt: null, snoozedUntil: "not-a-date", archivedAt: null },
        }),
        NOW,
      ),
    ).toBe(false);
  });
});

describe("isItemArchived", () => {
  it("returns false when state is missing", () => {
    expect(isItemArchived(makeItem())).toBe(false);
  });

  it("returns false when archivedAt is null", () => {
    expect(
      isItemArchived(makeItem({ state: { readAt: null, snoozedUntil: null, archivedAt: null } })),
    ).toBe(false);
  });

  it("returns true when archivedAt is set", () => {
    expect(
      isItemArchived(
        makeItem({ state: { readAt: null, snoozedUntil: null, archivedAt: "2026-05-21T11:00:00Z" } }),
      ),
    ).toBe(true);
  });
});

describe("isItemRead", () => {
  it("returns false when state is missing", () => {
    expect(isItemRead(makeItem())).toBe(false);
  });

  it("returns true when readAt is set", () => {
    expect(
      isItemRead(
        makeItem({ state: { readAt: "2026-05-21T11:00:00Z", snoozedUntil: null, archivedAt: null } }),
      ),
    ).toBe(true);
  });
});

describe("getActiveItems", () => {
  it("filters out archived items", () => {
    const archived = makeItem({
      id: "a",
      state: { readAt: null, snoozedUntil: null, archivedAt: "2026-05-21T11:00:00Z" },
    });
    const active = makeItem({ id: "b" });
    expect(getActiveItems([archived, active], NOW)).toEqual([active]);
  });

  it("filters out snoozed items still within snooze window", () => {
    const snoozed = makeItem({
      id: "a",
      state: { readAt: null, snoozedUntil: "2026-05-22T12:00:00Z", archivedAt: null },
    });
    const active = makeItem({ id: "b" });
    expect(getActiveItems([snoozed, active], NOW)).toEqual([active]);
  });

  it("keeps items whose snooze has already passed", () => {
    const expired = makeItem({
      id: "a",
      state: { readAt: null, snoozedUntil: "2026-05-20T12:00:00Z", archivedAt: null },
    });
    expect(getActiveItems([expired], NOW)).toEqual([expired]);
  });
});

describe("getHighestUnreadSeverity", () => {
  it("returns null when all items are read", () => {
    const items = [
      makeItem({
        severity: "critical",
        state: { readAt: "2026-05-21T11:00:00Z", snoozedUntil: null, archivedAt: null },
      }),
    ];
    expect(getHighestUnreadSeverity(items)).toBeNull();
  });

  it("returns null when input is empty", () => {
    expect(getHighestUnreadSeverity([])).toBeNull();
  });

  it("returns critical when any unread item is critical", () => {
    const items = [
      makeItem({ id: "a", severity: "info" }),
      makeItem({ id: "b", severity: "critical" }),
      makeItem({ id: "c", severity: "warning" }),
    ];
    expect(getHighestUnreadSeverity(items)).toBe("critical");
  });

  it("returns warning when only warning + info are unread", () => {
    const items = [
      makeItem({ id: "a", severity: "info" }),
      makeItem({ id: "b", severity: "warning" }),
    ];
    expect(getHighestUnreadSeverity(items)).toBe("warning");
  });

  it("returns info when only info items are unread", () => {
    expect(getHighestUnreadSeverity([makeItem({ severity: "info" })])).toBe("info");
  });

  it("ignores read items when picking severity", () => {
    const items = [
      makeItem({
        id: "a",
        severity: "critical",
        state: { readAt: "2026-05-21T11:00:00Z", snoozedUntil: null, archivedAt: null },
      }),
      makeItem({ id: "b", severity: "info" }),
    ];
    expect(getHighestUnreadSeverity(items)).toBe("info");
  });
});

describe("groupByDuplicate", () => {
  it("returns each item as a single node when reasons differ", () => {
    const items = [
      makeItem({ id: "a", reason: "unassigned" }),
      makeItem({ id: "b", reason: "unpaid" }),
    ];
    const nodes = groupByDuplicate(items);
    expect(nodes).toHaveLength(2);
    expect(nodes.every((n) => n.kind === "single")).toBe(true);
  });

  it("collapses items sharing (type, severity, reason)", () => {
    const items = [
      makeItem({ id: "a", type: "assignment", severity: "warning", reason: "unassigned" }),
      makeItem({ id: "b", type: "assignment", severity: "warning", reason: "unassigned" }),
      makeItem({ id: "c", type: "assignment", severity: "warning", reason: "unassigned" }),
    ];
    const nodes = groupByDuplicate(items);
    expect(nodes).toHaveLength(1);
    expect(nodes[0].kind).toBe("group");
    expect(nodes[0].items).toHaveLength(3);
  });

  it("does NOT collapse when severity differs", () => {
    const items = [
      makeItem({ id: "a", type: "assignment", severity: "warning", reason: "unassigned" }),
      makeItem({ id: "b", type: "assignment", severity: "critical", reason: "unassigned" }),
    ];
    const nodes = groupByDuplicate(items);
    expect(nodes).toHaveLength(2);
    expect(nodes.every((n) => n.kind === "single")).toBe(true);
  });

  it("does NOT collapse when reason differs", () => {
    const items = [
      makeItem({ id: "a", type: "assignment", severity: "warning", reason: "unassigned" }),
      makeItem({ id: "b", type: "assignment", severity: "warning", reason: "reschedule" }),
    ];
    const nodes = groupByDuplicate(items);
    expect(nodes).toHaveLength(2);
  });

  it("treats items without a reason as ungroupable", () => {
    const items = [
      makeItem({ id: "a", type: "assignment", severity: "warning" }), // no reason
      makeItem({ id: "b", type: "assignment", severity: "warning" }), // no reason
    ];
    const nodes = groupByDuplicate(items);
    expect(nodes).toHaveLength(2);
    expect(nodes.every((n) => n.kind === "single")).toBe(true);
  });

  it("preserves input ordering in node output", () => {
    const items = [
      makeItem({ id: "z", reason: "z" }),
      makeItem({ id: "a", reason: "a" }),
      makeItem({ id: "m", reason: "m" }),
    ];
    const nodes = groupByDuplicate(items);
    expect(nodes.map((n) => n.items[0].id)).toEqual(["z", "a", "m"]);
  });

  it("places the first occurrence as the group representative", () => {
    const items = [
      makeItem({ id: "first", type: "assignment", severity: "warning", reason: "unassigned" }),
      makeItem({ id: "second", type: "assignment", severity: "warning", reason: "unassigned" }),
    ];
    const nodes = groupByDuplicate(items);
    expect(nodes[0].items[0].id).toBe("first");
  });
});
