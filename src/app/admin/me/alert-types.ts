// C-08 Phase D Step 17 (brief §2.8, plan §1 Step 17) — the five alert-type
// keys are locked and must match `resolveBusinessNotificationRecipients`
// (src/lib/email/notifications.ts) exactly.
export const NOTIFICATION_ALERT_TYPES = [
  "new_booking_request",
  "booking_cancelled",
  "reschedule_request",
  "enquiry_logged",
  "slot_claimed",
] as const;
