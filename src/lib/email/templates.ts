// SERVER ONLY - do not import from client components.

export interface EmailParticipant {
  label: string;
  participantGender: "male" | "female";
  requiredTherapistGender: "male" | "female";
  services: string[];
  assignedStaffName?: string | null;
}

export interface BookingEmailTemplateInput {
  companyName: string;
  clientName: string;
  bookingDate: string;
  startTime: string;
  endTime: string;
  addressLines: string[];
  totalPrice: number;
  participantCount: number;
  participants: EmailParticipant[];
  manageUrl?: string;
  customerNotes?: string | null;
  contactEmail?: string | null;
  contactPhone?: string | null;
}

export interface RescheduleRequestEmailInput extends BookingEmailTemplateInput {
  requestedDate: string;
  requestedTime: string;
  requestNote: string | null;
}

function escapeHtml(value: string) {
  return value
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;")
    .replace(/'/g, "&#039;");
}

function formatLabel(value: string) {
  return value.replace(/_/g, " ");
}

function formatDate(value: string) {
  return new Intl.DateTimeFormat("en-GB", {
    dateStyle: "full",
  }).format(new Date(`${value}T00:00:00`));
}

function formatTime(value: string) {
  return value.slice(0, 5);
}

function formatMoney(value: number) {
  return new Intl.NumberFormat("en-GB", {
    style: "currency",
    currency: "GBP",
  }).format(value);
}

function renderLayout(title: string, body: string) {
  return `<!doctype html>
<html lang="en">
  <head>
    <meta charset="utf-8">
    <meta name="viewport" content="width=device-width, initial-scale=1">
    <title>${escapeHtml(title)}</title>
  </head>
  <body style="margin:0;background:#f7f3ec;color:#1f2f2b;font-family:Arial,Helvetica,sans-serif;">
    <div style="max-width:680px;margin:0 auto;padding:32px 18px;">
      <div style="background:#ffffff;border:1px solid #e8dfd2;border-radius:18px;padding:28px;">
        ${body}
      </div>
    </div>
  </body>
</html>`;
}

function renderSummary(input: BookingEmailTemplateInput) {
  const address = input.addressLines.map(escapeHtml).join("<br>");

  return `
    <div style="margin:22px 0;padding:18px;border-radius:14px;background:#f7f3ec;">
      <p style="margin:0 0 10px;font-size:13px;color:#53615d;">Appointment</p>
      <p style="margin:0;font-size:16px;font-weight:700;color:#1f2f2b;">${escapeHtml(
        formatDate(input.bookingDate)
      )} at ${escapeHtml(formatTime(input.startTime))}-${escapeHtml(
        formatTime(input.endTime)
      )}</p>
      <p style="margin:10px 0 0;font-size:14px;line-height:1.5;color:#53615d;">${address}</p>
      <p style="margin:10px 0 0;font-size:14px;color:#53615d;">Total: <strong style="color:#1f2f2b;">${escapeHtml(
        formatMoney(input.totalPrice)
      )}</strong></p>
    </div>`;
}

function renderParticipants(input: BookingEmailTemplateInput) {
  const rows = input.participants
    .map((participant) => {
      const serviceList = participant.services.length
        ? participant.services.map(escapeHtml).join(", ")
        : "No service snapshots";
      const staff = participant.assignedStaffName
        ? `<br>Assigned staff: ${escapeHtml(participant.assignedStaffName)}`
        : "";

      return `<li style="margin:0 0 12px;">
        <strong>${escapeHtml(participant.label)}</strong><br>
        Client: ${escapeHtml(formatLabel(participant.participantGender))}<br>
        Required therapist: ${escapeHtml(
          formatLabel(participant.requiredTherapistGender)
        )}<br>
        Services: ${serviceList}${staff}
      </li>`;
    })
    .join("");

  return `
    <div style="margin:22px 0;">
      <p style="margin:0 0 10px;font-size:13px;color:#53615d;">Participant details</p>
      <ul style="margin:0;padding-left:18px;font-size:14px;line-height:1.55;color:#1f2f2b;">
        ${rows}
      </ul>
    </div>`;
}

function renderFooter(input: BookingEmailTemplateInput) {
  const contactParts = [input.contactEmail, input.contactPhone].filter(
    (value): value is string => Boolean(value)
  );

  return `<p style="margin:22px 0 0;font-size:13px;line-height:1.5;color:#53615d;">
    ${contactParts.length > 0 ? `Questions? Contact ${escapeHtml(contactParts.join(" or "))}.` : ""}
  </p>`;
}

export function renderBookingConfirmationEmail(input: BookingEmailTemplateInput) {
  const groupCopy =
    input.participantCount > 1
      ? `This is a group booking for ${input.participantCount} participants.`
      : "This booking is for one participant.";
  const manageLink = input.manageUrl
    ? `<p style="margin:18px 0 0;"><a href="${escapeHtml(
        input.manageUrl
      )}" style="display:inline-block;border-radius:999px;background:#30463f;color:#ffffff;text-decoration:none;padding:12px 18px;font-size:14px;font-weight:700;">Manage this booking</a></p>`
    : "";

  return renderLayout(
    "Booking request received",
    `<h1 style="margin:0;font-size:24px;line-height:1.2;color:#1f2f2b;">Booking request received</h1>
    <p style="margin:14px 0 0;font-size:15px;line-height:1.6;color:#53615d;">Hi ${escapeHtml(
      input.clientName
    )}, we have received your ${escapeHtml(input.companyName)} booking request. ${escapeHtml(
      groupCopy
    )}</p>
    ${renderSummary(input)}
    ${renderParticipants(input)}
    ${
      input.customerNotes
        ? `<p style="margin:18px 0 0;font-size:14px;line-height:1.5;color:#53615d;"><strong style="color:#1f2f2b;">Your notes:</strong> ${escapeHtml(input.customerNotes)}</p>`
        : ""
    }
    ${manageLink}
    ${renderFooter(input)}`
  );
}

export function renderAdminBookingNotificationEmail(
  input: BookingEmailTemplateInput & {
    bookingId: string;
    clientEmail: string | null;
    clientPhone: string | null;
  }
) {
  return renderLayout(
    "New booking request",
    `<h1 style="margin:0;font-size:24px;line-height:1.2;color:#1f2f2b;">New booking request</h1>
    <p style="margin:14px 0 0;font-size:15px;line-height:1.6;color:#53615d;">${escapeHtml(
      input.clientName
    )} submitted a booking request. Booking reference: ${escapeHtml(input.bookingId)}.</p>
    ${renderSummary(input)}
    <div style="margin:22px 0;padding:16px;border-radius:14px;background:#f7f3ec;font-size:14px;line-height:1.5;color:#53615d;">
      Email: ${escapeHtml(input.clientEmail ?? "Not provided")}<br>
      Phone: ${escapeHtml(input.clientPhone ?? "Not provided")}
    </div>
    ${renderParticipants(input)}
    ${renderFooter(input)}`
  );
}

export function renderBookingCancellationEmail(input: BookingEmailTemplateInput) {
  return renderLayout(
    "Booking cancelled",
    `<h1 style="margin:0;font-size:24px;line-height:1.2;color:#1f2f2b;">Booking cancelled</h1>
    <p style="margin:14px 0 0;font-size:15px;line-height:1.6;color:#53615d;">Hi ${escapeHtml(
      input.clientName
    )}, your ${escapeHtml(input.companyName)} booking has been cancelled.</p>
    ${renderSummary(input)}
    ${renderParticipants(input)}
    ${renderFooter(input)}`
  );
}

export function renderAdminBookingCancellationEmail(
  input: BookingEmailTemplateInput & {
    bookingId: string;
    initiatedBy: "customer" | "admin";
    cancellationNote?: string | null;
  }
) {
  return renderLayout(
    "Booking cancellation",
    `<h1 style="margin:0;font-size:24px;line-height:1.2;color:#1f2f2b;">Booking cancellation</h1>
    <p style="margin:14px 0 0;font-size:15px;line-height:1.6;color:#53615d;">${escapeHtml(
      input.clientName
    )}'s booking was cancelled by ${escapeHtml(input.initiatedBy)}. Booking reference: ${escapeHtml(
      input.bookingId
    )}.</p>
    ${renderSummary(input)}
    ${
      input.cancellationNote
        ? `<p style="margin:18px 0 0;font-size:14px;line-height:1.5;color:#53615d;"><strong style="color:#1f2f2b;">Cancellation note:</strong> ${escapeHtml(input.cancellationNote)}</p>`
        : ""
    }
    ${renderParticipants(input)}
    ${renderFooter(input)}`
  );
}

export function renderAdminRescheduleRequestEmail(
  input: RescheduleRequestEmailInput & { bookingId: string }
) {
  return renderLayout(
    "Reschedule request",
    `<h1 style="margin:0;font-size:24px;line-height:1.2;color:#1f2f2b;">Reschedule request</h1>
    <p style="margin:14px 0 0;font-size:15px;line-height:1.6;color:#53615d;">${escapeHtml(
      input.clientName
    )} requested a new appointment time. Booking reference: ${escapeHtml(input.bookingId)}.</p>
    ${renderSummary(input)}
    <div style="margin:22px 0;padding:18px;border-radius:14px;background:#f7f3ec;">
      <p style="margin:0 0 10px;font-size:13px;color:#53615d;">Requested new time</p>
      <p style="margin:0;font-size:16px;font-weight:700;color:#1f2f2b;">${escapeHtml(
        formatDate(input.requestedDate)
      )} at ${escapeHtml(formatTime(input.requestedTime))}</p>
      ${
        input.requestNote
          ? `<p style="margin:10px 0 0;font-size:14px;line-height:1.5;color:#53615d;">${escapeHtml(input.requestNote)}</p>`
          : ""
      }
    </div>
    ${renderParticipants(input)}
    ${renderFooter(input)}`
  );
}

export function renderStaffAssignmentEmail(input: BookingEmailTemplateInput) {
  return renderLayout(
    "Booking assignment",
    `<h1 style="margin:0;font-size:24px;line-height:1.2;color:#1f2f2b;">Booking assignment</h1>
    <p style="margin:14px 0 0;font-size:15px;line-height:1.6;color:#53615d;">You have been assigned to a ${escapeHtml(
      input.companyName
    )} booking.</p>
    ${renderSummary(input)}
    ${renderParticipants(input)}
    ${renderFooter(input)}`
  );
}

export function renderStaffBookingChangeEmail(
  input: BookingEmailTemplateInput & { changeSummary: string }
) {
  return renderLayout(
    "Assigned booking changed",
    `<h1 style="margin:0;font-size:24px;line-height:1.2;color:#1f2f2b;">Assigned booking changed</h1>
    <p style="margin:14px 0 0;font-size:15px;line-height:1.6;color:#53615d;">${escapeHtml(
      input.changeSummary
    )}</p>
    ${renderSummary(input)}
    ${renderParticipants(input)}
    ${renderFooter(input)}`
  );
}

export function renderBookingReminderEmail(input: BookingEmailTemplateInput) {
  return renderLayout(
    "Booking reminder",
    `<h1 style="margin:0;font-size:24px;line-height:1.2;color:#1f2f2b;">Booking reminder</h1>
    <p style="margin:14px 0 0;font-size:15px;line-height:1.6;color:#53615d;">Hi ${escapeHtml(
      input.clientName
    )}, this is a reminder for your upcoming ${escapeHtml(
      input.companyName
    )} appointment.</p>
    ${renderSummary(input)}
    ${renderParticipants(input)}
    ${renderFooter(input)}`
  );
}

export function renderBookingPlainText(
  heading: string,
  input: BookingEmailTemplateInput
) {
  const address = input.addressLines.join(", ");
  const participants = input.participants
    .map(
      (participant) =>
        `${participant.label}: ${formatLabel(
          participant.participantGender
        )} client, ${formatLabel(
          participant.requiredTherapistGender
        )} therapist required, services: ${participant.services.join(", ")}`
    )
    .join("\n");

  return `${heading}

${input.companyName}
Client: ${input.clientName}
Date: ${formatDate(input.bookingDate)}
Time: ${formatTime(input.startTime)}-${formatTime(input.endTime)}
Address: ${address}
Total: ${formatMoney(input.totalPrice)}
Participants: ${input.participantCount}

${participants}

${input.manageUrl ? `Manage booking: ${input.manageUrl}\n\n` : ""}${
    input.contactEmail ? `Contact: ${input.contactEmail}` : ""
  }${input.contactPhone ? ` ${input.contactPhone}` : ""}`;
}
