import { describe, it, expect } from "vitest";
import {
  appointmentStyle,
  severityMeterValue,
  buildDemandTrendData,
  clampPercent,
  safeDivide,
} from "./dashboard-helpers";
import type { AttentionSummaryRow } from "./dashboard-helpers";

describe("clampPercent", () => {
  it("clamps values between 0 and 100", () => {
    expect(clampPercent(50)).toBe(50);
    expect(clampPercent(0)).toBe(0);
    expect(clampPercent(100)).toBe(100);
    expect(clampPercent(-10)).toBe(0);
    expect(clampPercent(110)).toBe(100);
  });
});

describe("safeDivide", () => {
  it("returns percentage for valid inputs", () => {
    expect(safeDivide(25, 100)).toBe(25);
    expect(safeDivide(1, 4)).toBe(25);
  });

  it("returns 0 when total is 0", () => {
    expect(safeDivide(25, 0)).toBe(0);
  });
});

describe("appointmentStyle", () => {
  it("positions a 9am appointment correctly", () => {
    const style = appointmentStyle("09:00", "10:00");
    expect(style.left).toBe("8.333333333333332%");
    expect(style.width).toBe("9%");
  });

  it("handles appointments before the 8am window start", () => {
    const style = appointmentStyle("07:00", "08:00");
    expect(style.left).toBe("0%");
    expect(style.width).toBe("9%");
  });

  it("handles appointments after the 8pm window end", () => {
    const style = appointmentStyle("21:00", "22:00");
    expect(style.left).toBe("100%");
    expect(style.width).toBe("0%");
  });

  it("defaults to 60-minute duration when end time is missing", () => {
    const style = appointmentStyle("12:00");
    expect(style.left).toBe("33.33333333333333%");
    expect(style.width).toBe("9%");
  });

  it("caps width so it does not overflow the container", () => {
    const style = appointmentStyle("19:00", "22:00");
    expect(parseFloat(style.width)).toBeLessThanOrEqual(
      100 - parseFloat(style.left)
    );
  });
});

describe("severityMeterValue", () => {
  it("returns 0 for clear or zero-count rows", () => {
    const clearRow: AttentionSummaryRow = {
      key: "test",
      label: "Test",
      detail: "Detail",
      count: 5,
      severity: "clear",
    };
    expect(severityMeterValue(clearRow)).toBe(0);

    const zeroRow: AttentionSummaryRow = {
      key: "test",
      label: "Test",
      detail: "Detail",
      count: 0,
      severity: "critical",
    };
    expect(severityMeterValue(zeroRow)).toBe(0);
  });

  it("returns boundary values for critical severity", () => {
    const low: AttentionSummaryRow = {
      key: "test",
      label: "Test",
      detail: "Detail",
      count: 1,
      severity: "critical",
    };
    expect(severityMeterValue(low)).toBe(3);

    const high: AttentionSummaryRow = {
      key: "test",
      label: "Test",
      detail: "Detail",
      count: 10,
      severity: "critical",
    };
    expect(severityMeterValue(high)).toBe(5);
  });

  it("returns boundary values for warning severity", () => {
    const low: AttentionSummaryRow = {
      key: "test",
      label: "Test",
      detail: "Detail",
      count: 1,
      severity: "warning",
    };
    expect(severityMeterValue(low)).toBe(2);

    const high: AttentionSummaryRow = {
      key: "test",
      label: "Test",
      detail: "Detail",
      count: 10,
      severity: "warning",
    };
    expect(severityMeterValue(high)).toBe(4);
  });

  it("returns boundary values for info severity", () => {
    const low: AttentionSummaryRow = {
      key: "test",
      label: "Test",
      detail: "Detail",
      count: 1,
      severity: "info",
    };
    expect(severityMeterValue(low)).toBe(1);

    const high: AttentionSummaryRow = {
      key: "test",
      label: "Test",
      detail: "Detail",
      count: 10,
      severity: "info",
    };
    expect(severityMeterValue(high)).toBe(3);
  });
});

describe("buildDemandTrendData", () => {
  it("fills missing dates with zero bookings", () => {
    const bookings = [{ booking_date: "2026-05-08" }];
    const result = buildDemandTrendData(bookings, "2026-05-08", "2026-05-10");

    expect(result).toHaveLength(3);
    expect(result[0].bookings).toBe(1);
    expect(result[1].bookings).toBe(0);
    expect(result[2].bookings).toBe(0);
  });

  it("aggregates multiple bookings on the same day", () => {
    const bookings = [
      { booking_date: "2026-05-08" },
      { booking_date: "2026-05-08" },
      { booking_date: "2026-05-09" },
    ];
    const result = buildDemandTrendData(bookings, "2026-05-08", "2026-05-09");

    expect(result).toHaveLength(2);
    expect(result[0].bookings).toBe(2);
    expect(result[1].bookings).toBe(1);
  });

  it("returns empty array when from is after to", () => {
    const bookings = [{ booking_date: "2026-05-08" }];
    const result = buildDemandTrendData(bookings, "2026-05-10", "2026-05-08");

    expect(result).toHaveLength(0);
  });

  it("handles empty bookings array", () => {
    const result = buildDemandTrendData([], "2026-05-08", "2026-05-08");

    expect(result).toHaveLength(1);
    expect(result[0].bookings).toBe(0);
  });
});
