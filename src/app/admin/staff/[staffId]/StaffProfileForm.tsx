"use client";

import { useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import { updateStaffProfile } from "../actions";
import { Card, CardHeader, CardTitle, CardContent } from "@/components/ui/card";
import { User, ShieldCheck, Info } from "lucide-react";
import { cn } from "@/lib/utils";
import { toast } from "sonner";

interface StaffProfile {
  id: string;
  name: string;
  active: boolean;
  can_take_bookings: boolean;
  role_id: string;
  gender: "male" | "female";
  profile_photo_path?: string | null;
  phone?: string | null;
  show_phone_on_profile?: boolean | null;
  short_bio?: string | null;
  specialties?: string[] | null;
  languages?: string[] | null;
  service_areas?: string[] | null;
}

interface Role {
  id: string;
  name: string;
  display_label: string | null;
}

interface StaffProfileFormProps {
  staff: StaffProfile;
  roles: Role[];
  canManageUsers: boolean;
  canEditSafeProfile: boolean;
  canAssignRoles: boolean;
}

export function StaffProfileForm({
  staff,
  roles,
  canManageUsers,
  canEditSafeProfile,
  canAssignRoles,
}: StaffProfileFormProps) {
  const router = useRouter();
  const [isPending, startTransition] = useTransition();
  const [error, setError] = useState<string | null>(null);
  const [currentStaff, setCurrentStaff] = useState(staff);
  const [profileDraft, setProfileDraft] = useState({
    name: staff.name ?? "",
    phone: staff.phone ?? "",
    show_phone_on_profile: Boolean(staff.show_phone_on_profile),
    short_bio: staff.short_bio ?? "",
    specialties: (staff.specialties ?? []).join(", "),
    languages: (staff.languages ?? []).join(", "),
    service_areas: (staff.service_areas ?? []).join(", "),
  });

  async function handleSafeProfileSave() {
    startTransition(async () => {
      const result = await updateStaffProfile(currentStaff.id, profileDraft);
      if (result.error) {
        setError(result.error);
        toast.error(result.error);
      } else {
        setError(null);
        setCurrentStaff((current) => ({
          ...current,
          name: profileDraft.name,
          phone: profileDraft.phone || null,
          show_phone_on_profile: profileDraft.show_phone_on_profile,
          short_bio: profileDraft.short_bio || null,
          specialties: splitList(profileDraft.specialties),
          languages: splitList(profileDraft.languages),
          service_areas: splitList(profileDraft.service_areas),
        }));
        toast.success("Profile updated");
        router.refresh();
      }
    });
  }

  async function handleToggleActive() {
    startTransition(async () => {
      const nextActive = !currentStaff.active;
      const result = await updateStaffProfile(currentStaff.id, { active: nextActive });
      if (result.error) {
        setError(result.error);
        toast.error(result.error);
      } else {
        setError(null);
        setCurrentStaff((current) => ({
          ...current,
          active: nextActive,
          can_take_bookings: nextActive ? current.can_take_bookings : false,
        }));
        toast.success(`Account ${nextActive ? "activated" : "deactivated"}`);
        router.refresh();
      }
    });
  }

  async function handleToggleBookings() {
    startTransition(async () => {
      const nextCanTakeBookings = !currentStaff.can_take_bookings;
      const result = await updateStaffProfile(currentStaff.id, {
        can_take_bookings: nextCanTakeBookings,
      });
      if (result.error) {
        setError(result.error);
        toast.error(result.error);
      } else {
        setError(null);
        setCurrentStaff((current) => ({
          ...current,
          can_take_bookings: nextCanTakeBookings,
        }));
        toast.success(
          nextCanTakeBookings
            ? "Now visible for bookings"
            : "Now hidden from bookings"
        );
        router.refresh();
      }
    });
  }

  async function handleRoleChange(roleId: string) {
    if (currentStaff.role_id === roleId) return;
    startTransition(async () => {
      const result = await updateStaffProfile(currentStaff.id, { role_id: roleId });
      if (result.error) {
        setError(result.error);
        toast.error(result.error);
      } else {
        setError(null);
        setCurrentStaff((current) => ({ ...current, role_id: roleId }));
        toast.success("Role updated");
        router.refresh();
      }
    });
  }

  async function handleGenderChange(gender: "male" | "female") {
    if (currentStaff.gender === gender) return;
    startTransition(async () => {
      const result = await updateStaffProfile(currentStaff.id, { gender });
      if (result.error) {
        setError(result.error);
        toast.error(result.error);
      } else {
        setError(null);
        setCurrentStaff((current) => ({ ...current, gender }));
        toast.success("Gender updated");
        router.refresh();
      }
    });
  }

  return (
    <div className="space-y-6">
      {error && (
        <div className="rounded-xl border border-red-200 bg-red-50 p-4 text-sm text-red-600 flex items-center gap-3">
          <Info className="size-4 shrink-0" />
          {error}
        </div>
      )}

      <Card>
        <CardHeader>
          <CardTitle className="text-lg font-semibold flex items-center gap-2">
            <User className="size-5 text-[var(--rahma-green)]" />
            Profile Details
          </CardTitle>
        </CardHeader>
        <CardContent className="grid gap-4">
          <div className="grid gap-4 md:grid-cols-2">
            <label className="grid gap-1.5 text-sm">
              <span className="font-medium text-[var(--rahma-charcoal)]">Display name</span>
              <input
                value={profileDraft.name}
                onChange={(event) =>
                  setProfileDraft((current) => ({
                    ...current,
                    name: event.target.value,
                  }))
                }
                disabled={isPending || !canEditSafeProfile}
                className="h-10 rounded-md border border-[var(--rahma-border)] bg-white px-3 text-sm text-[var(--rahma-charcoal)] outline-none focus:ring-2 focus:ring-[var(--rahma-green)]/20 disabled:bg-gray-50"
              />
            </label>
            <label className="grid gap-1.5 text-sm">
              <span className="font-medium text-[var(--rahma-charcoal)]">Phone</span>
              <input
                value={profileDraft.phone}
                onChange={(event) =>
                  setProfileDraft((current) => ({
                    ...current,
                    phone: event.target.value,
                  }))
                }
                disabled={isPending || !canEditSafeProfile}
                className="h-10 rounded-md border border-[var(--rahma-border)] bg-white px-3 text-sm text-[var(--rahma-charcoal)] outline-none focus:ring-2 focus:ring-[var(--rahma-green)]/20 disabled:bg-gray-50"
              />
            </label>
          </div>

          <label className="flex items-center gap-3 text-sm text-[var(--rahma-charcoal)]">
            <input
              type="checkbox"
              checked={profileDraft.show_phone_on_profile}
              onChange={(event) =>
                setProfileDraft((current) => ({
                  ...current,
                  show_phone_on_profile: event.target.checked,
                }))
              }
              disabled={isPending || !canEditSafeProfile}
              className="size-4 rounded border-[var(--rahma-border)]"
            />
            Show phone on profile surfaces when contact visibility allows it
          </label>

          <label className="grid gap-1.5 text-sm">
            <span className="font-medium text-[var(--rahma-charcoal)]">Short bio</span>
            <textarea
              value={profileDraft.short_bio}
              onChange={(event) =>
                setProfileDraft((current) => ({
                  ...current,
                  short_bio: event.target.value,
                }))
              }
              rows={4}
              maxLength={600}
              disabled={isPending || !canEditSafeProfile}
              className="rounded-md border border-[var(--rahma-border)] bg-white px-3 py-2 text-sm text-[var(--rahma-charcoal)] outline-none focus:ring-2 focus:ring-[var(--rahma-green)]/20 disabled:bg-gray-50"
            />
          </label>

          <div className="grid gap-4 md:grid-cols-3">
            <ListInput
              label="Specialties/services"
              value={profileDraft.specialties}
              disabled={isPending || !canEditSafeProfile}
              onChange={(value) =>
                setProfileDraft((current) => ({ ...current, specialties: value }))
              }
            />
            <ListInput
              label="Languages"
              value={profileDraft.languages}
              disabled={isPending || !canEditSafeProfile}
              onChange={(value) =>
                setProfileDraft((current) => ({ ...current, languages: value }))
              }
            />
            <ListInput
              label="Service areas"
              value={profileDraft.service_areas}
              disabled={isPending || !canEditSafeProfile}
              onChange={(value) =>
                setProfileDraft((current) => ({ ...current, service_areas: value }))
              }
            />
          </div>

          <div className="rounded-lg bg-[var(--rahma-ivory)]/70 p-3 text-xs text-[var(--rahma-muted)]">
            Profile photo path: {currentStaff.profile_photo_path ?? "reserved for Phase 8 upload"}
          </div>

          {canEditSafeProfile ? (
            <div>
              <button
                type="button"
                disabled={isPending}
                onClick={handleSafeProfileSave}
                className="rounded-md bg-[var(--rahma-green)] px-4 py-2 text-sm font-semibold text-white disabled:opacity-50"
              >
                Save profile details
              </button>
            </div>
          ) : null}
        </CardContent>
      </Card>

      {canManageUsers || canAssignRoles ? (
      <div className="grid grid-cols-1 gap-6 lg:grid-cols-2">
        {/* Status & Access */}
        {canManageUsers ? (
        <Card>
          <CardHeader>
            <CardTitle className="text-lg font-semibold flex items-center gap-2">
              <ShieldCheck className="size-5 text-[var(--rahma-green)]" />
              Account Status & Access
            </CardTitle>
          </CardHeader>
          <CardContent className="space-y-6">
            {/* Active Toggle */}
            <div className="flex items-center justify-between py-2">
              <div>
                <p className="font-medium text-[var(--rahma-charcoal)]">Active Account</p>
                <p className="text-xs text-[var(--rahma-muted)]">Allow this user to log into the admin panel.</p>
              </div>
              <button
                type="button"
                role="switch"
                aria-checked={currentStaff.active}
                disabled={isPending || !canManageUsers}
                onClick={handleToggleActive}
                className={cn(
                  "relative h-6 w-11 rounded-full border-2 border-transparent transition-colors duration-200 focus-visible:ring-2 focus-visible:ring-ring/40 disabled:opacity-50",
                  currentStaff.active ? "bg-[var(--rahma-green)]" : "bg-[var(--rahma-border)]"
                )}
              >
                <span
                  className={cn(
                    "block size-4 rounded-full bg-white shadow-sm transition-transform duration-200",
                    currentStaff.active ? "translate-x-5" : "translate-x-0"
                  )}
                />
              </button>
            </div>

            {/* Bookings Toggle */}
            <div className="flex items-center justify-between py-2 border-t border-[var(--rahma-border)] pt-6">
              <div>
                <p className="font-medium text-[var(--rahma-charcoal)]">Accepting Bookings</p>
                <p className="text-xs text-[var(--rahma-muted)]">Allow clients to book appointments with this therapist.</p>
              </div>
              <button
                type="button"
                role="switch"
                aria-checked={currentStaff.can_take_bookings}
                disabled={isPending || !canManageUsers}
                onClick={handleToggleBookings}
                className={cn(
                  "relative h-6 w-11 rounded-full border-2 border-transparent transition-colors duration-200 focus-visible:ring-2 focus-visible:ring-ring/40 disabled:opacity-50",
                  currentStaff.can_take_bookings ? "bg-[var(--rahma-green)]" : "bg-[var(--rahma-border)]"
                )}
              >
                <span
                  className={cn(
                    "block size-4 rounded-full bg-white shadow-sm transition-transform duration-200",
                    currentStaff.can_take_bookings ? "translate-x-5" : "translate-x-0"
                  )}
                />
              </button>
            </div>
          </CardContent>
        </Card>
        ) : null}

        {/* Role & Personal */}
        {canManageUsers || canAssignRoles ? (
        <Card>
          <CardHeader>
            <CardTitle className="text-lg font-semibold flex items-center gap-2">
              <User className="size-5 text-[var(--rahma-green)]" />
              Role & Identification
            </CardTitle>
          </CardHeader>
          <CardContent className="space-y-6">
            {/* Role Selection */}
            {canAssignRoles ? (
            <div className="space-y-3">
              <p className="text-sm font-medium text-[var(--rahma-charcoal)]">Assigned Role</p>
              <div className="flex flex-wrap gap-2">
                {roles.map((role) => (
                  <button
                    key={role.id}
                    type="button"
                    disabled={isPending || !canAssignRoles}
                    onClick={() => handleRoleChange(role.id)}
                    className={cn(
                      "rounded-full px-4 py-1.5 text-xs font-semibold tracking-wider uppercase border transition-all",
                      currentStaff.role_id === role.id
                        ? "bg-[var(--rahma-green)] text-white border-[var(--rahma-green)]"
                        : "bg-white text-[var(--rahma-muted)] border-[var(--rahma-border)] hover:border-[var(--rahma-green)] hover:text-[var(--rahma-green)]"
                    )}
                  >
                    {role.display_label ?? role.name}
                  </button>
                ))}
              </div>
            </div>
            ) : null}

            {/* Gender Selection */}
            {canManageUsers ? (
            <div className="space-y-3 border-t border-[var(--rahma-border)] pt-6">
              <p className="text-sm font-medium text-[var(--rahma-charcoal)]">Therapist Gender</p>
              <div className="flex gap-2">
                {["male", "female"].map((g) => (
                  <button
                    key={g}
                    type="button"
                    disabled={isPending || !canManageUsers}
                    onClick={() => handleGenderChange(g as "male" | "female")}
                    className={cn(
                      "flex-1 rounded-xl py-2 text-sm font-medium border transition-all capitalize",
                      currentStaff.gender === g
                        ? "bg-[var(--rahma-ivory)] text-[var(--rahma-green)] border-[var(--rahma-green)]"
                        : "bg-white text-[var(--rahma-muted)] border-[var(--rahma-border)] hover:border-[var(--rahma-muted)]"
                    )}
                  >
                    {g}
                  </button>
                ))}
              </div>
              <p className="text-[10px] text-[var(--rahma-muted)] flex items-center gap-1.5">
                <Info className="size-3" />
                Required for gender-matched treatment rules.
              </p>
            </div>
            ) : null}
          </CardContent>
        </Card>
        ) : null}
      </div>
      ) : null}
    </div>
  );
}

function splitList(value: string) {
  return value
    .split(",")
    .map((item) => item.replace(/\s+/g, " ").trim())
    .filter(Boolean);
}

function ListInput({
  label,
  value,
  disabled,
  onChange,
}: {
  label: string;
  value: string;
  disabled: boolean;
  onChange: (value: string) => void;
}) {
  return (
    <label className="grid gap-1.5 text-sm">
      <span className="font-medium text-[var(--rahma-charcoal)]">{label}</span>
      <input
        value={value}
        onChange={(event) => onChange(event.target.value)}
        disabled={disabled}
        placeholder="Comma separated"
        className="h-10 rounded-md border border-[var(--rahma-border)] bg-white px-3 text-sm text-[var(--rahma-charcoal)] outline-none focus:ring-2 focus:ring-[var(--rahma-green)]/20 disabled:bg-gray-50"
      />
    </label>
  );
}
