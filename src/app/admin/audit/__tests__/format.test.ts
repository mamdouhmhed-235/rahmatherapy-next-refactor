import { describe, expect, it } from "vitest";
import { ACTION_TYPES_BY_FAMILY, describeAction } from "../format";

describe("audit action taxonomy", () => {
  // An action missing from the ACTIONS map falls through to describeAction's
  // defensive fallback, which files it under `operations_and_email` and leaves
  // it out of every other family's list. Because a family filter is expanded
  // into `action_type IN (…)` (queries.ts), an unmapped `client_deleted` would
  // vanish from "Clients & enquiries" — the one view an auditor narrows to when
  // checking a GDPR erasure.
  it("files client_deleted under clients & enquiries", () => {
    expect(describeAction("client_deleted").family).toBe("clients_and_enquiries");
  });

  it("expands the clients family filter to include client_deleted", () => {
    expect(ACTION_TYPES_BY_FAMILY.clients_and_enquiries).toContain("client_deleted");
  });

  // Item 1. NOTE the family assertion is deliberately NOT the guard here:
  // describeAction's fallback already returns `operations_and_email`, so
  // `expect(describeAction("review_email_sent").family).toBe("operations_and_email")`
  // passes whether or not the registration exists. The three assertions below
  // are the ones that fail when the ACTIONS entry is removed.
  it("labels review_email_sent rather than falling back to the generic phrase", () => {
    const described = describeAction("review_email_sent");

    expect(described.phrase).toBe("sent a review request");
    expect(described.phrase).not.toBe("review email sent"); // the fallback
    expect(described.chip).toBe("pending"); // the fallback is "none"
  });

  it("expands the operations family filter to include review_email_sent", () => {
    // Without this, narrowing the audit timeline to "Operations & email"
    // silently hides every review request — the filter expands to
    // `action_type IN (…)` built from the ACTIONS map alone.
    expect(ACTION_TYPES_BY_FAMILY.operations_and_email).toContain(
      "review_email_sent"
    );
  });
});
