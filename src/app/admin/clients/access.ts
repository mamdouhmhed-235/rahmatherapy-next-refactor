import {
  canManageAllClients,
  canManageSensitiveClientNotes,
  canViewAllClients,
  canViewAssignedClients,
  canViewAssignedHealthNotes,
  canViewClientContactDetails,
  canCreateSessionNotes,
  hasPermission,
  PERMISSIONS,
  type StaffProfile,
} from "@/lib/auth/rbac";

export interface ClientAccessContext {
  hasAssignedBooking: boolean;
}

export interface ClientDataAccess {
  canViewClient: boolean;
  canManageClient: boolean;
  canViewContactDetails: boolean;
  canViewHealthNotes: boolean;
  canCreateSessionNote: boolean;
  canCreateClientNote: boolean;
  canCreateSensitiveNote: boolean;
  canManagePrivacyOperations: boolean;
  canViewSensitiveNoteQueue: boolean;
}

export function getClientDataAccess(
  profile: StaffProfile | null,
  context: ClientAccessContext
): ClientDataAccess {
  const active = Boolean(profile?.active);
  const hasAllClientAccess =
    active && (canManageAllClients(profile) || canViewAllClients(profile));
  const hasAssignedClientAccess =
    active && canViewAssignedClients(profile) && context.hasAssignedBooking;
  const canManageSensitive = active && canManageSensitiveClientNotes(profile);
  const canManagePrivacy =
    active && hasPermission(profile, PERMISSIONS.MANAGE_PRIVACY_OPERATIONS);
  const canCreateSessionNote =
    active && canCreateSessionNotes(profile) && context.hasAssignedBooking;
  const canCreateSensitiveNote = canManageSensitive || canManagePrivacy;

  return {
    canViewClient: hasAllClientAccess || hasAssignedClientAccess,
    canManageClient: active && canManageAllClients(profile),
    canViewContactDetails: active && canViewClientContactDetails(profile),
    canViewHealthNotes:
      canManageSensitive ||
      canManagePrivacy ||
      (hasAssignedClientAccess && canViewAssignedHealthNotes(profile)),
    canCreateSessionNote,
    canCreateClientNote: canCreateSessionNote || canCreateSensitiveNote,
    canCreateSensitiveNote,
    canManagePrivacyOperations: canManagePrivacy,
    canViewSensitiveNoteQueue: canManageSensitive || canManagePrivacy,
  };
}

export function canOpenClientRecord(
  profile: StaffProfile | null,
  context: ClientAccessContext
) {
  return getClientDataAccess(profile, context).canViewClient;
}
