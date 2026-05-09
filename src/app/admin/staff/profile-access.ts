import {
  canAssignStaffRoles,
  canManageStaffProfiles,
  type StaffProfile,
} from "@/lib/auth/rbac";

type StaffGender = "male" | "female";

export interface StaffProfileUpdate {
  active?: boolean;
  can_take_bookings?: boolean;
  role_id?: string;
  gender?: StaffGender;
  name?: string;
  phone?: string | null;
  show_phone_on_profile?: boolean;
  short_bio?: string | null;
  specialties?: string[] | string;
  languages?: string[] | string;
  service_areas?: string[] | string;
  profile_photo_path?: string | null;
}

export type SanitizedStaffProfileUpdate = Partial<{
  active: boolean;
  can_take_bookings: boolean;
  role_id: string;
  gender: StaffGender;
  name: string;
  phone: string | null;
  show_phone_on_profile: boolean;
  short_bio: string | null;
  specialties: string[];
  languages: string[];
  service_areas: string[];
  profile_photo_path: string | null;
}>;

const SAFE_FIELDS = new Set<keyof StaffProfileUpdate>([
  "name",
  "phone",
  "show_phone_on_profile",
  "short_bio",
  "specialties",
  "languages",
  "service_areas",
  "profile_photo_path",
]);

const OPERATIONAL_FIELDS = new Set<keyof StaffProfileUpdate>([
  "active",
  "can_take_bookings",
  "role_id",
  "gender",
]);

function normalizeNullableText(value: string | null | undefined) {
  const normalized = value?.replace(/\s+/g, " ").trim();
  return normalized || null;
}

function normalizeList(value: string[] | string | undefined) {
  const items = Array.isArray(value) ? value : value?.split(",");
  return Array.from(
    new Set(
      (items ?? [])
        .map((item) => item.replace(/\s+/g, " ").trim())
        .filter(Boolean)
    )
  );
}

export function getStaffProfileCompletion(input: {
  name?: string | null;
  phone?: string | null;
  short_bio?: string | null;
  specialties?: string[] | null;
  languages?: string[] | null;
  service_areas?: string[] | null;
}) {
  const items = [
    Boolean(input.name?.trim()),
    Boolean(input.phone?.trim()),
    Boolean(input.short_bio?.trim()),
    Boolean(input.specialties?.length),
    Boolean(input.languages?.length),
    Boolean(input.service_areas?.length),
  ];
  const completed = items.filter(Boolean).length;

  return {
    completed,
    total: items.length,
    isComplete: completed === items.length,
  };
}

export function sanitizeStaffProfileUpdate({
  actor,
  staffId,
  updates,
}: {
  actor: StaffProfile | null;
  staffId: string;
  updates: StaffProfileUpdate;
}): { updates: SanitizedStaffProfileUpdate } | { error: string } {
  if (!actor?.active) return { error: "Insufficient permissions." };

  const isOwnProfile = actor.id === staffId;
  const canManageStaff = canManageStaffProfiles(actor);
  const sanitized: SanitizedStaffProfileUpdate = {};

  for (const key of Object.keys(updates) as (keyof StaffProfileUpdate)[]) {
    if (SAFE_FIELDS.has(key)) {
      if (!isOwnProfile && !canManageStaff) {
        return { error: "Insufficient permissions." };
      }
      continue;
    }

    if (OPERATIONAL_FIELDS.has(key)) {
      if (!canManageStaff) return { error: "Insufficient permissions." };
      if (key === "role_id" && !canAssignStaffRoles(actor)) {
        return { error: "Insufficient permissions." };
      }
      continue;
    }

    return { error: "Invalid staff profile update." };
  }

  if (updates.name !== undefined) {
    const name = normalizeNullableText(updates.name);
    if (!name) return { error: "Name is required." };
    sanitized.name = name;
  }
  if (updates.phone !== undefined) {
    sanitized.phone = normalizeNullableText(updates.phone);
  }
  if (updates.show_phone_on_profile !== undefined) {
    sanitized.show_phone_on_profile = updates.show_phone_on_profile;
  }
  if (updates.short_bio !== undefined) {
    sanitized.short_bio = normalizeNullableText(updates.short_bio);
  }
  if (updates.specialties !== undefined) {
    sanitized.specialties = normalizeList(updates.specialties);
  }
  if (updates.languages !== undefined) {
    sanitized.languages = normalizeList(updates.languages);
  }
  if (updates.service_areas !== undefined) {
    sanitized.service_areas = normalizeList(updates.service_areas);
  }
  if (updates.profile_photo_path !== undefined) {
    sanitized.profile_photo_path = normalizeNullableText(updates.profile_photo_path);
  }
  if (updates.active !== undefined) sanitized.active = updates.active;
  if (updates.can_take_bookings !== undefined) {
    sanitized.can_take_bookings = updates.can_take_bookings;
  }
  if (updates.role_id !== undefined) sanitized.role_id = updates.role_id;
  if (updates.gender !== undefined) sanitized.gender = updates.gender;

  return { updates: sanitized };
}
