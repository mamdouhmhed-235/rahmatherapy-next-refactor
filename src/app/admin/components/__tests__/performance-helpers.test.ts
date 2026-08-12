import { describe, it, expect } from "vitest";
import { Calendar, MessageCircle, Lock, Settings, Clock as ClockIcon, AlertCircle } from "lucide-react";
import {
  tilesForRole,
  humanizeAuditAction,
  iconForActionType,
  resolveActivityExpansion,
  type KpiTileSpec,
  type RingTileSpec,
} from "../performance-helpers";
import type { StaffScorecard } from "@/app/admin/reports/reporting";

function scorecard(overrides?: Partial<StaffScorecard>): StaffScorecard {
  const base: StaffScorecard = {
    clinical: {
      assignmentsTotal: 20,
      assignmentsCompleted: 18,
      hoursWorked: 22.5,
      clientsTouched: 12,
      revenueAttributed: 540.4,
      utilisation: { rate: 0.73, bookedHours: 22, availableHours: 30 },
      retention: { rate: 0.333, retainedClients: 4, totalClients: 12 },
      noShowRate: { rate: 0.0833, total: 24, noShows: 1, cancelled: 1, lostRevenue: 100 },
      sameGenderFulfilled: 5,
    },
    admin: {
      enquiriesContactedCount: 14,
      enquiryConversionRate: 0.5,
      avgMinutesToFirstContact: 42.4,
      bookingsAssignedCount: 7,
      opsEventsResolvedCount: 3,
    },
  };
  return { ...base, ...overrides };
}

describe("tilesForRole — therapist", () => {
  it("returns 8 tiles in spec order", () => {
    const tiles = tilesForRole("therapist", scorecard(), { staffId: "s1", range: "this_week" });
    expect(tiles).toHaveLength(8);
    expect(tiles.map((t) => t.id)).toEqual([
      "completed-sessions",
      "hours-worked",
      "revenue-attributed",
      "utilisation",
      "retention",
      "no-show-rate",
      "clients-touched",
      "same-gender-fulfilled",
    ]);
  });

  it("renders utilisation as a ring tile with 80% target", () => {
    const tiles = tilesForRole("therapist", scorecard());
    const ring = tiles.find((t) => t.id === "utilisation") as RingTileSpec;
    expect(ring.kind).toBe("ring");
    expect(ring.target).toBe(80);
    expect(ring.value).toBe(73);
    expect(ring.unit).toBe("%");
    expect(ring.hint).toBe("22h of 30h available");
  });

  it("ring tile hint redirects to availability setup when no rules", () => {
    const tiles = tilesForRole("therapist", scorecard({
      clinical: {
        ...scorecard().clinical,
        utilisation: { rate: 0, bookedHours: 0, availableHours: 0 },
      },
    }));
    const ring = tiles.find((t) => t.id === "utilisation") as RingTileSpec;
    expect(ring.hint).toBe("Set your availability to see this");
  });

  it("formats hours, money and percent via formatKey discriminator", () => {
    const tiles = tilesForRole("therapist", scorecard());
    const hours = tiles.find((t) => t.id === "hours-worked") as KpiTileSpec;
    const revenue = tiles.find((t) => t.id === "revenue-attributed") as KpiTileSpec;
    const retention = tiles.find((t) => t.id === "retention") as KpiTileSpec;
    expect(hours.formatKey).toBe("hours");
    expect(hours.value).toBe(22.5);
    expect(revenue.formatKey).toBe("money");
    expect(revenue.value).toBe(540);
    expect(retention.formatKey).toBe("percent");
    expect(retention.value).toBe(33);
  });

  it("no-show rate uses tone=invert (smaller-is-better)", () => {
    const tiles = tilesForRole("therapist", scorecard());
    const noShow = tiles.find((t) => t.id === "no-show-rate") as KpiTileSpec;
    expect(noShow.tone).toBe("invert");
    expect(noShow.hint).toBe("2 of 24 bookings");
  });

  it("threads sparkline series only into the tiles that take them", () => {
    const tiles = tilesForRole("therapist", scorecard(), {
      series: {
        assignmentsCompleted: [3, 5, 4, 6],
        hoursWorked: [4, 5, 3, 6],
        revenueAttributed: [100, 120, 80, 150],
        clientsTouched: [2, 3, 3, 4],
      },
    });
    const get = (id: string) => tiles.find((t) => t.id === id) as KpiTileSpec;
    expect(get("completed-sessions").series).toEqual([3, 5, 4, 6]);
    expect(get("hours-worked").series).toEqual([4, 5, 3, 6]);
    expect(get("revenue-attributed").series).toEqual([100, 120, 80, 150]);
    expect(get("clients-touched").series).toEqual([2, 3, 3, 4]);
    expect(get("retention").series).toBeUndefined();
    expect(get("same-gender-fulfilled").series).toBeUndefined();
  });

  it("threads staffId + range into completed-sessions and revenue hrefs", () => {
    const tiles = tilesForRole("therapist", scorecard(), { staffId: "s1", range: "this_month" });
    const completed = tiles.find((t) => t.id === "completed-sessions") as KpiTileSpec;
    const revenue = tiles.find((t) => t.id === "revenue-attributed") as KpiTileSpec;
    expect(completed.href).toBe("/admin/bookings?view=completed&staffId=s1&range=this_month");
    expect(revenue.href).toBe("/admin/reports?scope=personal&staffId=s1&range=this_month");
  });

  it("converts 0-1 deltas to percentage-point integers on percent tiles", () => {
    const tiles = tilesForRole("therapist", scorecard({
      clinical: scorecard().clinical,
      admin: scorecard().admin,
      deltas: {
        clinical: {
          assignmentsCompleted: 4,
          hoursWorked: 2.5,
          clientsTouched: 3,
          revenueAttributed: 80,
          utilisationRate: 0.05,
          retentionRate: 0.05,
          noShowRate: -0.02,
        },
        admin: {
          enquiriesContactedCount: 0,
          enquiryConversionRate: 0,
          avgMinutesToFirstContact: 0,
          bookingsAssignedCount: 0,
          opsEventsResolvedCount: 0,
        },
      },
    }));
    const retention = tiles.find((t) => t.id === "retention") as KpiTileSpec;
    const noShow = tiles.find((t) => t.id === "no-show-rate") as KpiTileSpec;
    expect(retention.delta).toBe(5);  // +5pp
    expect(noShow.delta).toBe(-2);     // −2pp
  });
});

describe("tilesForRole — coordinator", () => {
  it("returns 5 admin tiles", () => {
    const tiles = tilesForRole("coordinator", scorecard());
    expect(tiles.map((t) => t.id)).toEqual([
      "enquiries-handled",
      "conversion-rate",
      "avg-time-to-first-contact",
      "bookings-assigned",
      "ops-events-resolved",
    ]);
  });

  it("avg-time-to-first-contact uses minutes format + invert tone", () => {
    const tiles = tilesForRole("coordinator", scorecard());
    const ttfc = tiles.find((t) => t.id === "avg-time-to-first-contact") as KpiTileSpec;
    expect(ttfc.formatKey).toBe("minutes");
    expect(ttfc.tone).toBe("invert");
    expect(ttfc.value).toBe(42);
    expect(ttfc.hint).toBe("across 14 enquiries");
  });

  it("conversion-rate hint shows derived counts when enquiries handled", () => {
    const tiles = tilesForRole("coordinator", scorecard());
    const conversion = tiles.find((t) => t.id === "conversion-rate") as KpiTileSpec;
    expect(conversion.value).toBe(50);
    expect(conversion.hint).toBe("7 of 14 enquiries became bookings");
  });

  it("threads staffId into enquiries-handled href", () => {
    const tiles = tilesForRole("coordinator", scorecard(), { staffId: "c1" });
    const enquiries = tiles.find((t) => t.id === "enquiries-handled") as KpiTileSpec;
    expect(enquiries.href).toBe("/admin/enquiries?actor=c1");
  });
});

describe("tilesForRole — owner_admin", () => {
  it("Owner-who-treats default visible 6 tiles (4 clinical + 2 admin)", () => {
    const tiles = tilesForRole("owner_admin", scorecard());
    expect(tiles.map((t) => t.id)).toEqual([
      "completed-sessions",
      "hours-worked",
      "revenue-attributed",
      "utilisation",
      "enquiries-handled",
      "conversion-rate",
    ]);
  });

  it("Owner-who-treats with showAll returns full 13", () => {
    const tiles = tilesForRole("owner_admin", scorecard(), { showAll: true });
    expect(tiles).toHaveLength(13);
  });

  it("Owner-who-doesn't-treat returns 5 admin tiles + business net revenue", () => {
    const noClinical = scorecard({
      clinical: { ...scorecard().clinical, assignmentsTotal: 0 },
    });
    const tiles = tilesForRole("owner_admin", noClinical, { businessNetRevenue: 8240 });
    expect(tiles).toHaveLength(6);
    expect(tiles[tiles.length - 1].id).toBe("business-net-revenue");
    expect((tiles[tiles.length - 1] as KpiTileSpec).formatKey).toBe("money");
    expect((tiles[tiles.length - 1] as KpiTileSpec).value).toBe(8240);
  });

  it("Owner-who-doesn't-treat omits business tile when input absent", () => {
    const noClinical = scorecard({
      clinical: { ...scorecard().clinical, assignmentsTotal: 0 },
    });
    const tiles = tilesForRole("owner_admin", noClinical);
    expect(tiles).toHaveLength(5);
    expect(tiles.some((t) => t.id === "business-net-revenue")).toBe(false);
  });
});

describe("humanizeAuditAction", () => {
  it("prefixes self-view with 'You'", () => {
    expect(humanizeAuditAction("booking_quick_confirm", "self")).toBe("You confirmed booking");
    expect(humanizeAuditAction("enquiry_status_updated", "self")).toBe("You updated enquiry status");
  });

  it("manager-view returns the bare phrase (actor name rendered separately)", () => {
    expect(humanizeAuditAction("booking_quick_confirm", "manager")).toBe("confirmed booking");
    expect(humanizeAuditAction("availability_rule_created", "manager")).toBe("created availability rule");
  });

  it("falls through gracefully for unknown action types via describeAction's defensive fallback", () => {
    expect(humanizeAuditAction("custom_unknown_action", "self")).toBe("You custom unknown action");
  });
});

describe("iconForActionType", () => {
  it("maps each audit family to its Lucide icon", () => {
    expect(iconForActionType("booking_quick_confirm")).toBe(Calendar);
    expect(iconForActionType("enquiry_status_updated")).toBe(MessageCircle);
    expect(iconForActionType("availability_rule_created")).toBe(ClockIcon);
    expect(iconForActionType("operational_event_status_updated")).toBe(AlertCircle);
    expect(iconForActionType("password_reset_approved")).toBe(Lock);
    expect(iconForActionType("service_created")).toBe(Settings);
  });

  it("uses the operations_and_email family icon for unknown actions (describeAction default)", () => {
    expect(iconForActionType("custom_unknown_action")).toBe(AlertCircle);
  });
});

// ── ITEM J — Recent activity progressive disclosure ──────────────────────────

describe("resolveActivityExpansion", () => {
  const BASE = "/admin/me";

  it("is collapsed by default and offers a link that expands", () => {
    const result = resolveActivityExpansion({}, BASE);
    expect(result.expanded).toBe(false);
    expect(result.expandHref).toBe("/admin/me?activity=all");
  });

  it("is expanded when the param says all, and offers a link that collapses", () => {
    const result = resolveActivityExpansion({ activity: "all" }, BASE);
    expect(result.expanded).toBe(true);
    // Collapsing DROPS the param rather than setting a falsy value, so the
    // default state stays the clean, shareable URL.
    expect(result.expandHref).toBe("/admin/me");
  });

  it("carries every other param across when expanding", () => {
    // The period filters live in these params. An expand link that dropped
    // them would silently reset the range the reader had chosen.
    const result = resolveActivityExpansion(
      { range: "custom", from: "2026-01-01", to: "2026-03-31" },
      BASE
    );
    expect(result.expandHref).toContain("range=custom");
    expect(result.expandHref).toContain("from=2026-01-01");
    expect(result.expandHref).toContain("to=2026-03-31");
    expect(result.expandHref).toContain("activity=all");
  });

  it("carries every other param across when collapsing too", () => {
    const result = resolveActivityExpansion(
      { activity: "all", range: "custom", show: "all" },
      BASE
    );
    expect(result.expanded).toBe(true);
    expect(result.expandHref).toContain("range=custom");
    expect(result.expandHref).toContain("show=all");
    expect(result.expandHref).not.toContain("activity");
  });

  it("treats a repeated param as its first value", () => {
    expect(resolveActivityExpansion({ activity: ["all", "no"] }, BASE).expanded).toBe(true);
    expect(resolveActivityExpansion({ range: ["week", "month"] }, BASE).expandHref).toContain(
      "range=week"
    );
  });

  it("ignores any value other than all, so a bookmarked typo collapses safely", () => {
    expect(resolveActivityExpansion({ activity: "yes" }, BASE).expanded).toBe(false);
    expect(resolveActivityExpansion({ activity: "" }, BASE).expanded).toBe(false);
  });

  it("builds against the manager route's base path, not just /admin/me", () => {
    const base = "/admin/staff/abc-123/performance";
    expect(resolveActivityExpansion({}, base).expandHref).toBe(
      `${base}?activity=all`
    );
  });

  it("drops empty params rather than emitting bare keys", () => {
    expect(resolveActivityExpansion({ range: "", to: undefined }, BASE).expandHref).toBe(
      "/admin/me?activity=all"
    );
  });
});
