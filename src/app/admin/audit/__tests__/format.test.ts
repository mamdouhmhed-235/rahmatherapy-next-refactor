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
});
