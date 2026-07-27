// Server route handler — renders an email template with dummy data and
// returns the HTML for the preview iframe in the email-templates tab.
//
// SERVER ONLY by design: this is the boundary that lets the preview iframe
// load templates.ts without any client-side import. The iframe `src` points
// here; this handler imports templates.ts on the server, renders, and ships
// the resulting HTML string with a safe Content-Security-Policy.
//
// FAKE markers — replaced when the matching BUILDs land:
//   - BUILD-email-templates-preview-route.md (real route handler + auth + overrides merge)
//   - BUILD-rbac-permission-email-templates.md (real permission gate)

import { NextResponse } from "next/server";
import { siteUrl } from "@/content/site/site-url";
import { createSupabaseServerClient } from "@/lib/supabase/server";
import {
  canManageEmailSettings,
  canResendBookingEmails,
  canViewEmailLogs,
  getStaffProfile,
} from "@/lib/auth/rbac";
import {
  renderAdminBookingCancellationEmail,
  renderAdminBookingNotificationEmail,
  renderAdminRescheduleRequestEmail,
  renderBookingCancellationEmail,
  renderBookingConfirmationEmail,
  renderBookingPlainText,
  renderBookingReminderEmail,
  renderStaffAssignmentEmail,
  renderStaffBookingChangeEmail,
  type BookingEmailTemplateInput,
} from "@/lib/email/templates";

const DUMMY_INPUT: BookingEmailTemplateInput = {
  companyName: "Rahma Therapy",
  clientName: "Aisha Khan",
  bookingDate: "2026-06-12",
  startTime: "14:30",
  endTime: "15:30",
  addressLines: ["12 Oak Lane", "Luton LU2 3AB"],
  totalPrice: 65,
  participantCount: 1,
  participants: [
    {
      label: "Participant 1",
      participantGender: "female",
      requiredTherapistGender: "female",
      services: ["hijama_back"],
      assignedStaffName: "Fatimah Hussain",
    },
  ],
  manageUrl: siteUrl("/bookings/example"),
  customerNotes: "Please park on the road, the driveway is narrow.",
  contactEmail: "rahmatherapy@outlook.com",
  contactPhone: "07000 000000",
};

const GROUP_INPUT: BookingEmailTemplateInput = {
  ...DUMMY_INPUT,
  participantCount: 3,
  participants: [
    { ...DUMMY_INPUT.participants[0], label: "Participant 1" },
    {
      label: "Participant 2",
      participantGender: "female",
      requiredTherapistGender: "female",
      services: ["massage_relax"],
    },
    {
      label: "Participant 3",
      participantGender: "male",
      requiredTherapistGender: "male",
      services: ["cupping_full_body"],
    },
  ],
};

export async function GET(
  _req: Request,
  ctx: { params: Promise<{ id: string }> }
) {
  const { id } = await ctx.params;

  // FAKE: BUILD-rbac-permission-email-templates — real check uses the new
  // `manage_email_templates` permission. Until then, gate on either edit
  // permission (manage_settings) OR view-only (canViewEmailLogs /
  // canResendBookingEmails) so therapists can preview their two staff
  // templates for manual send.
  const supabase = await createSupabaseServerClient();
  const profile = await getStaffProfile(supabase);
  if (!profile) {
    return new NextResponse("Unauthorized", { status: 401 });
  }
  const canSeeAny =
    canManageEmailSettings(profile) ||
    canViewEmailLogs(profile) ||
    canResendBookingEmails(profile);
  if (!canSeeAny) {
    return new NextResponse("Forbidden", { status: 403 });
  }

  let html: string;
  try {
    html = renderById(id);
  } catch {
    return new NextResponse(renderPlaceholder(id), {
      status: 200,
      headers: previewHeaders(),
    });
  }

  return new NextResponse(html, {
    status: 200,
    headers: previewHeaders(),
  });
}

function renderById(id: string): string {
  switch (id) {
    case "booking_confirmation":
      return renderBookingConfirmationEmail(DUMMY_INPUT);
    case "booking_cancellation_client":
      return renderBookingCancellationEmail(DUMMY_INPUT);
    case "booking_reminder":
      return renderBookingReminderEmail(DUMMY_INPUT);
    case "booking_plain_text":
      return renderPlainTextEnvelope(
        renderBookingPlainText("Booking confirmation", DUMMY_INPUT)
      );
    case "staff_assignment":
      return renderStaffAssignmentEmail(DUMMY_INPUT);
    case "staff_booking_change":
      return renderStaffBookingChangeEmail({
        ...DUMMY_INPUT,
        changeSummary: "Time changed from 14:00 to 14:30.",
      });
    case "admin_booking_notification":
      return renderAdminBookingNotificationEmail({
        ...GROUP_INPUT,
        bookingId: "BK-2026-0042",
        clientEmail: "aisha.khan@example.com",
        clientPhone: "07700 900042",
      });
    case "admin_booking_cancellation":
      return renderAdminBookingCancellationEmail({
        ...DUMMY_INPUT,
        bookingId: "BK-2026-0042",
        initiatedBy: "customer",
        cancellationNote: "Family emergency.",
      });
    case "admin_reschedule_request":
      return renderAdminRescheduleRequestEmail({
        ...DUMMY_INPUT,
        bookingId: "BK-2026-0042",
        requestedDate: "2026-06-19",
        requestedTime: "14:30",
        requestNote: "Could we move to next Friday?",
      });
    default:
      throw new Error(`unknown template id: ${id}`);
  }
}

function renderPlainTextEnvelope(plain: string): string {
  return `<!doctype html><html><head><meta charset="utf-8"></head><body style="margin:0;background:#fbf8f2;padding:24px;font-family:'IBM Plex Mono',Menlo,monospace;font-size:14px;line-height:1.55;color:#1f2f2b;white-space:pre-wrap;">${plain
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")}</body></html>`;
}

function renderPlaceholder(id: string): string {
  // FAKE fallback used when render fails or when the BUILD has not yet wired
  // the override merge layer.
  return `<!doctype html><html><body style="margin:0;padding:32px;font-family:system-ui,sans-serif;background:#fbf8f2;color:#1f2f2b;">
    <div style="max-width:520px;margin:48px auto;padding:24px;border-radius:12px;border:1px solid #e8dfd2;background:#ffffff;">
      <h1 style="margin:0;font-size:18px;">Preview placeholder</h1>
      <p style="margin:12px 0 0;color:#53615d;line-height:1.55;font-size:14px;">Real preview for <code>${id
        .replace(/&/g, "&amp;")
        .replace(/</g, "&lt;")}</code> lands when the preview route BUILD ships.</p>
    </div>
  </body></html>`;
}

function previewHeaders() {
  return {
    "Content-Type": "text/html; charset=utf-8",
    // Belt and braces: even though the iframe carries `sandbox="allow-same-origin"`
    // (no allow-scripts), forbid scripts at the response layer too.
    "Content-Security-Policy":
      "default-src 'self'; script-src 'none'; style-src 'unsafe-inline' 'self'; img-src data: https:; frame-ancestors 'self';",
    "Cache-Control": "no-store",
  };
}
