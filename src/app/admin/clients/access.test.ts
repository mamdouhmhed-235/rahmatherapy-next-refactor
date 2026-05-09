import { describe, expect, it } from "vitest";
import { PERMISSIONS, type StaffProfile } from "@/lib/auth/rbac";
import {
  canOpenClientRecord,
  getClientDataAccess,
} from "./access";

function profile(
  permissions: string[],
  overrides: Partial<StaffProfile> = {}
): StaffProfile {
  return {
    id: "staff-a",
    auth_user_id: "auth-a",
    name: "Staff A",
    email: "staff-a@example.test",
    role_id: "role-a",
    role_name: "Therapist",
    gender: "female",
    active: true,
    can_take_bookings: true,
    availability_mode: "use_global",
    permissions: new Set(permissions),
    ...overrides,
  };
}

describe("admin client access helpers", () => {
  it("denies missing, inactive, and unrelated assigned-scope client access", () => {
    const therapist = profile([PERMISSIONS.VIEW_CLIENTS_ASSIGNED]);

    expect(canOpenClientRecord(null, { hasAssignedBooking: true })).toBe(false);
    expect(
      canOpenClientRecord(
        profile([PERMISSIONS.VIEW_CLIENTS_ALL], { active: false }),
        { hasAssignedBooking: true }
      )
    ).toBe(false);
    expect(canOpenClientRecord(therapist, { hasAssignedBooking: false })).toBe(false);
  });

  it("allows all-client permission holders to open clients without assignment", () => {
    const coordinator = profile([
      PERMISSIONS.VIEW_CLIENTS_ALL,
      PERMISSIONS.MANAGE_CLIENTS_ALL,
      PERMISSIONS.VIEW_CLIENT_CONTACT_DETAILS,
    ]);

    expect(canOpenClientRecord(coordinator, { hasAssignedBooking: false })).toBe(true);
    expect(getClientDataAccess(coordinator, { hasAssignedBooking: false })).toMatchObject({
      canViewClient: true,
      canManageClient: true,
      canViewContactDetails: true,
      canViewHealthNotes: false,
      canCreateSessionNote: false,
      canCreateSensitiveNote: false,
      canManagePrivacyOperations: false,
    });
  });

  it("allows therapists to view only assigned clients and create assigned session notes", () => {
    const therapist = profile([
      PERMISSIONS.VIEW_CLIENTS_ASSIGNED,
      PERMISSIONS.VIEW_CLIENT_CONTACT_DETAILS,
      PERMISSIONS.VIEW_CLIENT_HEALTH_NOTES_ASSIGNED,
      PERMISSIONS.CREATE_CLIENT_SESSION_NOTES,
    ]);

    expect(getClientDataAccess(therapist, { hasAssignedBooking: false })).toMatchObject({
      canViewClient: false,
      canViewHealthNotes: false,
      canCreateSessionNote: false,
      canCreateClientNote: false,
    });
    expect(getClientDataAccess(therapist, { hasAssignedBooking: true })).toMatchObject({
      canViewClient: true,
      canViewContactDetails: true,
      canViewHealthNotes: true,
      canCreateSessionNote: true,
      canCreateClientNote: true,
      canCreateSensitiveNote: false,
      canViewSensitiveNoteQueue: false,
    });
  });

  it("separates contact, health, session note, and sensitive controls", () => {
    const assignedNoContact = profile([
      PERMISSIONS.VIEW_CLIENTS_ASSIGNED,
      PERMISSIONS.VIEW_CLIENT_HEALTH_NOTES_ASSIGNED,
    ]);
    const sensitiveManager = profile([
      PERMISSIONS.VIEW_CLIENTS_ALL,
      PERMISSIONS.MANAGE_SENSITIVE_CLIENT_NOTES,
    ]);
    const privacyManager = profile([
      PERMISSIONS.VIEW_CLIENTS_ALL,
      PERMISSIONS.MANAGE_PRIVACY_OPERATIONS,
    ]);

    expect(getClientDataAccess(assignedNoContact, { hasAssignedBooking: true })).toMatchObject({
      canViewContactDetails: false,
      canViewHealthNotes: true,
      canCreateSessionNote: false,
      canViewSensitiveNoteQueue: false,
    });
    expect(getClientDataAccess(sensitiveManager, { hasAssignedBooking: false })).toMatchObject({
      canViewHealthNotes: true,
      canCreateSensitiveNote: true,
      canViewSensitiveNoteQueue: true,
      canManagePrivacyOperations: false,
    });
    expect(getClientDataAccess(privacyManager, { hasAssignedBooking: false })).toMatchObject({
      canCreateSensitiveNote: true,
      canViewSensitiveNoteQueue: true,
      canManagePrivacyOperations: true,
    });
  });
});
