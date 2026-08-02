// C-13 Phase G — group-context block coverage.
//
// No group booking exists anywhere in the database (0 of 15 live bookings
// have >1 participant), so every case here uses synthetic multi-participant
// `BookingEmailTemplateInput` data built on top of the same BASE_INPUT
// fixture the render-parity spec freezes — never a new/edited fixture file.
//
// Three renderer families under test, one per audience:
//  - renderGroupProgressSentenceHtml/Text — staff_assignment's ADDED piece
//    only (staff_assignment already renders the full per-participant list
//    via renderParticipants(); this is just the "X of Y assigned" sentence).
//  - renderGroupContextBlockHtml/Text — claim (admin-internal): full detail
//    (gender + per-participant assignment state) for the admin reader.
//  - renderGroupParticipantsListHtml/Text — booking_confirmed_client
//    (customer-facing): names only, no gender/assignment-state leak.
//
// All six must return "" for participantCount <= 1 — verified directly
// against BASE_INPUT (participantCount: 1), which is also what every
// render-parity fixture uses, so this is the same guard that keeps that
// gate green.

import { describe, expect, it } from "vitest";
import { BASE_INPUT } from "./__fixtures__/parity-sample-inputs";
import {
  renderBookingConfirmedClientEmail,
  renderBookingConfirmedClientPlainText,
  renderClaimNotificationEmail,
  renderClaimNotificationPlainText,
  renderGroupContextBlockHtml,
  renderGroupContextBlockText,
  renderGroupParticipantsListHtml,
  renderGroupParticipantsListText,
  renderGroupProgressSentenceHtml,
  renderGroupProgressSentenceText,
  renderStaffAssignmentEmail,
  renderBookingPlainText,
  type BookingEmailTemplateInput,
} from "../templates";

const TWO_PARTICIPANT_ONE_ASSIGNED: BookingEmailTemplateInput = {
  ...BASE_INPUT,
  participantCount: 2,
  participants: [
    {
      label: "Aisha Khan",
      participantGender: "female",
      requiredTherapistGender: "female",
      services: ["hijama_back"],
      assignedStaffName: "Layla Hassan",
    },
    {
      label: "Yusuf Khan",
      participantGender: "male",
      requiredTherapistGender: "male",
      services: ["swedish_massage"],
      assignedStaffName: null,
    },
  ],
};

const THREE_PARTICIPANT_UNASSIGNED: BookingEmailTemplateInput = {
  ...BASE_INPUT,
  participantCount: 3,
  participants: [
    {
      label: "Aisha Khan",
      participantGender: "female",
      requiredTherapistGender: "female",
      services: ["hijama_back"],
      assignedStaffName: null,
    },
    {
      label: "Yusuf Khan",
      participantGender: "male",
      requiredTherapistGender: "male",
      services: ["swedish_massage"],
      assignedStaffName: null,
    },
    {
      label: "Maryam Khan",
      participantGender: "female",
      requiredTherapistGender: "female",
      services: ["hijama_back"],
      assignedStaffName: null,
    },
  ],
};

describe("group-context block — single-participant guard (parity fixture shape)", () => {
  it("BASE_INPUT (participantCount: 1) — every group renderer returns empty string", () => {
    expect(renderGroupProgressSentenceHtml(BASE_INPUT)).toBe("");
    expect(renderGroupProgressSentenceText(BASE_INPUT)).toBe("");
    expect(renderGroupContextBlockHtml(BASE_INPUT)).toBe("");
    expect(renderGroupContextBlockText(BASE_INPUT)).toBe("");
    expect(renderGroupParticipantsListHtml(BASE_INPUT)).toBe("");
    expect(renderGroupParticipantsListText(BASE_INPUT)).toBe("");
  });
});

describe("renderGroupProgressSentence — staff_assignment's added summary sentence", () => {
  it("2 participants, 1 assigned — states the fraction, both legs", () => {
    const html = renderGroupProgressSentenceHtml(TWO_PARTICIPANT_ONE_ASSIGNED);
    const text = renderGroupProgressSentenceText(TWO_PARTICIPANT_ONE_ASSIGNED);
    expect(html).toContain("2-person group");
    expect(html).toContain("1 of 2 therapists assigned so far");
    expect(text).toContain("2-person group");
    expect(text).toContain("1 of 2 therapists assigned so far");
  });

  it("3 participants, 0 assigned — states 0 of 3", () => {
    expect(renderGroupProgressSentenceText(THREE_PARTICIPANT_UNASSIGNED)).toContain(
      "0 of 3 therapists assigned so far"
    );
  });

  it("does not render a second participant list — renderStaffAssignmentEmail adds only the sentence", () => {
    const html = renderStaffAssignmentEmail(TWO_PARTICIPANT_ONE_ASSIGNED);
    // The sentence is present...
    expect(html).toContain("1 of 2 therapists assigned so far");
    // ...but the per-participant rows still come from the existing
    // renderParticipants() block (proved by its distinct "Required
    // therapist:" line), not a duplicate — the admin-facing "— open" /
    // "— assigned to" row style used by renderGroupContextBlockHtml is
    // claim-only and must not appear here.
    expect(html).toContain("Required therapist:");
    expect(html).not.toContain("— open</li>");
    expect(html).not.toContain("— assigned to");
  });

  it("single-participant booking (BASE_INPUT) — staff_assignment output carries no group text", () => {
    const html = renderStaffAssignmentEmail(BASE_INPUT);
    expect(html).not.toContain("person group booking");
    expect(html).not.toContain("therapists assigned so far");
  });
});

describe("renderGroupContextBlock — claim (admin-internal), full detail", () => {
  it("2 participants, 1 assigned — names, genders, per-participant state, and the fraction", () => {
    const html = renderGroupContextBlockHtml(TWO_PARTICIPANT_ONE_ASSIGNED);
    const text = renderGroupContextBlockText(TWO_PARTICIPANT_ONE_ASSIGNED);

    for (const leg of [html, text]) {
      expect(leg).toContain("2-person group");
      expect(leg).toContain("Aisha Khan");
      expect(leg).toContain("female");
      expect(leg).toContain("assigned to Layla Hassan");
      expect(leg).toContain("Yusuf Khan");
      expect(leg).toContain("male");
      expect(leg).toContain("open");
      expect(leg).toContain("1 of 2 therapists assigned so far");
    }
  });

  it("3 participants, 0 assigned — every row reads open", () => {
    const text = renderGroupContextBlockText(THREE_PARTICIPANT_UNASSIGNED);
    expect(text).toContain("Aisha Khan");
    expect(text).toContain("Yusuf Khan");
    expect(text).toContain("Maryam Khan");
    // Three "- open" occurrences, one per participant row (excludes the
    // "0 of 3" summary line, which does not contain the word "open").
    expect(text.match(/- open/g)?.length).toBe(3);
    expect(text).toContain("0 of 3 therapists assigned so far");
  });

  it("renderClaimNotificationEmail — admin recipient sees the full block for a group claim", async () => {
    const html = await renderClaimNotificationEmail({
      ...TWO_PARTICIPANT_ONE_ASSIGNED,
      therapistName: "Layla Hassan",
    });
    expect(html).toContain("2-person group");
    expect(html).toContain("Aisha Khan");
    expect(html).toContain("Yusuf Khan");
    expect(html).toContain("assigned to Layla Hassan");
    expect(html).toContain("1 of 2 therapists assigned so far");
  });

  it("renderClaimNotificationPlainText — same content on the plain-text leg", async () => {
    const text = renderClaimNotificationPlainText({
      ...TWO_PARTICIPANT_ONE_ASSIGNED,
      therapistName: "Layla Hassan",
    });
    expect(text).toContain("Aisha Khan");
    expect(text).toContain("Yusuf Khan");
    expect(text).toContain("1 of 2 therapists assigned so far");
  });

  it("single-participant claim (BASE_INPUT via THERAPIST-shaped input) — no group block", async () => {
    const html = await renderClaimNotificationEmail({ ...BASE_INPUT, therapistName: "Fatimah Hussain" });
    const text = renderClaimNotificationPlainText({ ...BASE_INPUT, therapistName: "Fatimah Hussain" });
    expect(html).not.toContain("person group");
    expect(text).not.toContain("person group");
  });
});

describe("renderGroupParticipantsList — booking_confirmed_client (customer-facing), names only", () => {
  it("lists every participant's name and the fixed follow-up line, no gender or assignment state", () => {
    const html = renderGroupParticipantsListHtml(TWO_PARTICIPANT_ONE_ASSIGNED);
    const text = renderGroupParticipantsListText(TWO_PARTICIPANT_ONE_ASSIGNED);

    for (const leg of [html, text]) {
      expect(leg).toContain("2 people");
      expect(leg).toContain("Aisha Khan");
      expect(leg).toContain("Yusuf Khan");
      expect(leg).toContain("We'll send a confirmation when each person's therapist is assigned.");
      // No clinical/assignment-state detail belongs on the client's own
      // booking-confirmed email (brief Q9.6 — no cross-participant leak).
      expect(leg).not.toContain("assigned to Layla Hassan");
      expect(leg).not.toContain("female");
      expect(leg).not.toContain("male");
    }
  });

  it("renderBookingConfirmedClientEmail — group booking includes the names-only block", async () => {
    const html = await renderBookingConfirmedClientEmail(THREE_PARTICIPANT_UNASSIGNED);
    expect(html).toContain("3 people");
    expect(html).toContain("Aisha Khan");
    expect(html).toContain("Yusuf Khan");
    expect(html).toContain("Maryam Khan");
  });

  it("renderBookingConfirmedClientPlainText — same names on the plain-text leg", () => {
    const text = renderBookingConfirmedClientPlainText(THREE_PARTICIPANT_UNASSIGNED);
    expect(text).toContain("3 people");
    expect(text).toContain("Aisha Khan");
    expect(text).toContain("Yusuf Khan");
    expect(text).toContain("Maryam Khan");
  });

  it("single-participant booking (BASE_INPUT) — confirmed-client output carries no group text", async () => {
    const html = await renderBookingConfirmedClientEmail(BASE_INPUT);
    const text = renderBookingConfirmedClientPlainText(BASE_INPUT);
    expect(html).not.toContain("This booking includes");
    expect(text).not.toContain("This booking includes");
  });
});

describe("renderBookingPlainText — shared plain-text renderer's optional 4th param", () => {
  it("omitting groupSection (every non-staff_assignment caller) renders byte-identical to before", () => {
    const withoutParam = renderBookingPlainText("Booking confirmation", BASE_INPUT);
    const withEmptyParam = renderBookingPlainText("Booking confirmation", BASE_INPUT, {}, "");
    expect(withoutParam).toBe(withEmptyParam);
  });

  it("a non-empty groupSection is inserted between participants and the manage-booking line", () => {
    const text = renderBookingPlainText(
      "Booking assignment",
      TWO_PARTICIPANT_ONE_ASSIGNED,
      {},
      renderGroupProgressSentenceText(TWO_PARTICIPANT_ONE_ASSIGNED)
    );
    expect(text).toContain("1 of 2 therapists assigned so far");
  });
});
