import { describe, expect, it } from "vitest";
import {
  applyTravelFeeDelta,
  fromPence,
  parseTravelFee,
  toPence,
} from "../travel-fee";

describe("travel fee — the worked example from the plan", () => {
  // A 45.00 service booked for 2 participants stores total_price = 90.00,
  // multiplied once at creation. Adding a 14.00 travel fee must reach 104.00,
  // NOT (45 + 14) x 2 = 118.00 — the fee is a delta on the stored total, never
  // part of the per-participant multiply.
  it("folds the fee into the already-multiplied total, not into the multiply", () => {
    const result = applyTravelFeeDelta({
      totalPrice: 90,
      amountDue: 90,
      previousTravelFee: 0,
      nextTravelFee: 14,
    });

    expect(result.totalPrice).toBe(104);
    expect(result.amountDue).toBe(104);
    expect(result.totalPrice).not.toBe(118);
  });
});

describe("travel fee — pence arithmetic", () => {
  // The exact case that motivates integer pence: this subtraction in plain
  // floats yields 51.099999999999994.
  it("keeps a fee change exact where float arithmetic drifts", () => {
    expect(45.3 - 14.3 + 20.1).not.toBe(51.1); // the hazard, demonstrated

    const result = applyTravelFeeDelta({
      totalPrice: 45.3,
      amountDue: 45.3,
      previousTravelFee: 14.3,
      nextTravelFee: 20.1,
    });

    expect(result.totalPrice).toBe(51.1);
    expect(result.amountDue).toBe(51.1);
  });

  it("moves total_price and amount_due by the same delta through set, change and clear", () => {
    const set = applyTravelFeeDelta({
      totalPrice: 90,
      amountDue: 90,
      previousTravelFee: 0,
      nextTravelFee: 14.3,
    });
    expect(set).toEqual({ totalPrice: 104.3, amountDue: 104.3 });

    const changed = applyTravelFeeDelta({
      totalPrice: set.totalPrice,
      amountDue: set.amountDue,
      previousTravelFee: 14.3,
      nextTravelFee: 20.1,
    });
    expect(changed).toEqual({ totalPrice: 110.1, amountDue: 110.1 });

    const cleared = applyTravelFeeDelta({
      totalPrice: changed.totalPrice,
      amountDue: changed.amountDue,
      previousTravelFee: 20.1,
      nextTravelFee: 0,
    });
    // Back exactly where it started — no accumulated drift across three edits.
    expect(cleared).toEqual({ totalPrice: 90, amountDue: 90 });
  });

  it("keeps a part-paid booking's outstanding balance correct", () => {
    // total 90, due 90, already paid 30. Adding a 14 fee must raise the
    // outstanding balance to 74, and must not touch what was paid.
    const result = applyTravelFeeDelta({
      totalPrice: 90,
      amountDue: 90,
      previousTravelFee: 0,
      nextTravelFee: 14,
    });

    const amountPaid = 30;
    expect(result.amountDue - amountPaid).toBe(74);
  });

  it("treats a null total_price or amount_due as zero rather than producing NaN", () => {
    const result = applyTravelFeeDelta({
      totalPrice: null,
      amountDue: null,
      previousTravelFee: null,
      nextTravelFee: 14,
    });

    expect(result.totalPrice).toBe(14);
    expect(result.amountDue).toBe(14);
    expect(Number.isNaN(result.totalPrice)).toBe(false);
  });

  it("accepts numeric strings, which is how PostgREST returns numeric columns", () => {
    const result = applyTravelFeeDelta({
      totalPrice: "90.00",
      amountDue: "90.00",
      previousTravelFee: "0.00",
      nextTravelFee: "14.30",
    });

    expect(result).toEqual({ totalPrice: 104.3, amountDue: 104.3 });
  });

  it("round-trips through pence", () => {
    expect(toPence("14.30")).toBe(1430);
    expect(toPence(null)).toBe(0);
    expect(toPence("not a number")).toBe(0);
    expect(fromPence(1430)).toBe(14.3);
  });
});

describe("parseTravelFee", () => {
  it("treats an empty field as no charge", () => {
    expect(parseTravelFee("")).toBe(0);
    expect(parseTravelFee("   ")).toBe(0);
    expect(parseTravelFee(null)).toBe(0);
  });

  it("accepts whole pounds and two decimal places", () => {
    expect(parseTravelFee("14")).toBe(14);
    expect(parseTravelFee("14.3")).toBe(14.3);
    // The value that breaks a naive `Math.round(v * 100) !== v * 100` check.
    expect(parseTravelFee("14.30")).toBe(14.3);
    expect(parseTravelFee("0")).toBe(0);
  });

  it("rejects anything that is not a plain, non-negative money amount", () => {
    expect(parseTravelFee("-5")).toBeNull();
    expect(parseTravelFee("14.305")).toBeNull();
    expect(parseTravelFee("abc")).toBeNull();
    expect(parseTravelFee("1e3")).toBeNull();
    expect(parseTravelFee("14.")).toBeNull();
    expect(parseTravelFee(".5")).toBeNull();
    expect(parseTravelFee("£14")).toBeNull();
  });
});
