import { readFileSync } from "node:fs";
import { join } from "node:path";
import { render, screen } from "@testing-library/react";
import { describe, expect, it, vi } from "vitest";
import { NOTIFICATION_ALERT_TYPES } from "../alert-types";
import { NotificationSettingsCard } from "../NotificationSettingsCard";

// Regression guard: `NOTIFICATION_ALERT_TYPES` used to live in `actions.ts`,
// a "use server" module. A "use server" module may only export async
// functions — the const array crossed the server/client boundary as a
// server-reference stub instead of a real array, so
// `NOTIFICATION_ALERT_TYPES.map` in NotificationSettingsCard threw
// "NOTIFICATION_ALERT_TYPES.map is not a function" and /admin/me's whole
// render failed (introduced C-08 Phase D Step 17, escalated at C-10 finding
// F3). Fixed by moving the const into this plain, non-"use server" module.

vi.mock("../actions", () => ({
  saveNotificationSettings: vi.fn(),
}));

vi.mock("sonner", () => ({
  toast: { success: vi.fn(), error: vi.fn() },
}));

describe("alert-types module contract", () => {
  it('is not a "use server" module (only async functions may cross that boundary)', () => {
    const source = readFileSync(
      join(process.cwd(), "src/app/admin/me/alert-types.ts"),
      "utf8"
    );
    expect(source).not.toMatch(/["']use server["']/);
  });

  it("exposes the 5 locked alert-type keys resolveBusinessNotificationRecipients matches on", () => {
    expect(NOTIFICATION_ALERT_TYPES).toEqual([
      "new_booking_request",
      "booking_cancelled",
      "reschedule_request",
      "enquiry_logged",
      "slot_claimed",
    ]);
  });
});

describe("NotificationSettingsCard", () => {
  it("renders a checkbox for every NOTIFICATION_ALERT_TYPES entry without throwing", () => {
    render(
      <NotificationSettingsCard
        loginEmail="owner@rahmatherapy.example.test"
        notificationEmail={null}
        prefs={null}
      />
    );

    expect(screen.getByLabelText("New booking request")).not.toBeNull();
    expect(screen.getByLabelText("Booking cancelled")).not.toBeNull();
    expect(screen.getByLabelText("Reschedule request")).not.toBeNull();
    expect(screen.getByLabelText("Enquiry logged")).not.toBeNull();
    expect(screen.getByLabelText("Slot claimed")).not.toBeNull();
  });
});
