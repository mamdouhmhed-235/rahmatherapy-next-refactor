import { describe, expect, it } from "vitest";
import { composeGenderRequirementChip } from "../_helpers";

/**
 * C-13 Phase A (brief §2.1, plan Step 1b) — locks the phrasing the new chip
 * derives from `booking_participants.required_therapist_gender` counts:
 * single / group same-gender / group mixed / fully-assigned-hides.
 */
describe("composeGenderRequirementChip", () => {
  it("hides when there are no participants", () => {
    expect(composeGenderRequirementChip([], "unassigned")).toEqual({
      label: "",
      visible: false,
    });
  });

  it("hides when no participant has a required gender", () => {
    const participants = [{ required_therapist_gender: null }];
    expect(composeGenderRequirementChip(participants, "unassigned")).toEqual({
      label: "",
      visible: false,
    });
  });

  it("single female-required participant", () => {
    const participants = [{ required_therapist_gender: "female" }];
    expect(composeGenderRequirementChip(participants, "unassigned")).toEqual({
      label: "Needs female therapist",
      visible: true,
    });
  });

  it("single male-required participant", () => {
    const participants = [{ required_therapist_gender: "male" }];
    expect(composeGenderRequirementChip(participants, "unassigned")).toEqual({
      label: "Needs male therapist",
      visible: true,
    });
  });

  it("group of 2 female-required", () => {
    const participants = [
      { required_therapist_gender: "female" },
      { required_therapist_gender: "female" },
    ];
    expect(composeGenderRequirementChip(participants, "unassigned")).toEqual({
      label: "Needs 2 female therapists",
      visible: true,
    });
  });

  it("group of 3 female-required", () => {
    const participants = [
      { required_therapist_gender: "female" },
      { required_therapist_gender: "female" },
      { required_therapist_gender: "female" },
    ];
    expect(
      composeGenderRequirementChip(participants, "partially_assigned")
    ).toEqual({
      label: "Needs 3 female therapists",
      visible: true,
    });
  });

  it("group of 2 male-required", () => {
    const participants = [
      { required_therapist_gender: "male" },
      { required_therapist_gender: "male" },
    ];
    expect(composeGenderRequirementChip(participants, "unassigned")).toEqual({
      label: "Needs 2 male therapists",
      visible: true,
    });
  });

  it("mixed group — 1 female + 1 male", () => {
    const participants = [
      { required_therapist_gender: "female" },
      { required_therapist_gender: "male" },
    ];
    expect(composeGenderRequirementChip(participants, "unassigned")).toEqual({
      label: "Needs 1 female + 1 male",
      visible: true,
    });
  });

  it("mixed group — 2 female + 1 male", () => {
    const participants = [
      { required_therapist_gender: "female" },
      { required_therapist_gender: "female" },
      { required_therapist_gender: "male" },
    ];
    expect(
      composeGenderRequirementChip(participants, "partially_assigned")
    ).toEqual({
      label: "Needs 2 female + 1 male",
      visible: true,
    });
  });

  it("hides once fully_assigned, regardless of participants", () => {
    const participants = [
      { required_therapist_gender: "female" },
      { required_therapist_gender: "male" },
    ];
    expect(composeGenderRequirementChip(participants, "fully_assigned")).toEqual(
      {
        label: "",
        visible: false,
      }
    );
  });
});
