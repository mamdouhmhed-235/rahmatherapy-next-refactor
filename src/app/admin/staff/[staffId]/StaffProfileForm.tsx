"use client";

import { useEffect, useMemo, useRef, useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import { updateStaffProfile } from "../actions";
import { Megaphone, ShieldCheck, User as UserIcon, XCircle } from "lucide-react";
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

const BIO_MAX = 600;

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
  const initialDraft = useMemo(
    () => ({
      name: currentStaff.name ?? "",
      phone: currentStaff.phone ?? "",
      show_phone_on_profile: Boolean(currentStaff.show_phone_on_profile),
      short_bio: currentStaff.short_bio ?? "",
      specialties: (currentStaff.specialties ?? []).join(", "),
      languages: (currentStaff.languages ?? []).join(", "),
      service_areas: (currentStaff.service_areas ?? []).join(", "),
    }),
    [currentStaff]
  );
  const [profileDraft, setProfileDraft] = useState(initialDraft);
  const isDirty = useMemo(
    () =>
      (Object.keys(initialDraft) as (keyof typeof initialDraft)[]).some(
        (key) => initialDraft[key] !== profileDraft[key]
      ),
    [initialDraft, profileDraft]
  );

  function handleDiscard() {
    setProfileDraft(initialDraft);
    setError(null);
  }

  // Honour deep-links from R2 "Add →" checklist Ghosts (anchor `#field-<name>`).
  const formRef = useRef<HTMLDivElement | null>(null);
  useEffect(() => {
    function handleHashLink(event: Event) {
      const target = event.target as HTMLElement | null;
      const fieldName = target?.closest<HTMLElement>("[data-staff-focus-field]")?.dataset
        .staffFocusField;
      if (!fieldName || !formRef.current) return;
      const input = formRef.current.querySelector<HTMLInputElement | HTMLTextAreaElement>(
        `[name="${fieldName}"]`
      );
      if (!input) return;
      event.preventDefault();
      input.scrollIntoView({ behavior: "smooth", block: "center" });
      input.focus({ preventScroll: true });
    }
    document.addEventListener("click", handleHashLink);
    return () => document.removeEventListener("click", handleHashLink);
  }, []);

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
        toast.success("Profile saved.");
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
        toast.success(nextActive ? "Account activated." : "Account deactivated.");
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
          nextCanTakeBookings ? "Now accepting bookings." : "Bookings paused."
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
        toast.success("Role updated.");
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
        toast.success("Gender updated.");
        router.refresh();
      }
    });
  }

  const disabled = isPending || !canEditSafeProfile;
  const bioRemaining = BIO_MAX - profileDraft.short_bio.length;

  return (
    <div ref={formRef} className="grid gap-6">
      {error ? (
        <div
          role="alert"
          aria-live="polite"
          aria-atomic="true"
          className="flex items-start gap-2.5 rounded-[var(--admin-radius-control)] bg-[var(--admin-status-cancelled-bg)] px-3 py-3 text-sm text-[var(--admin-status-cancelled-text)]"
        >
          <XCircle className="mt-0.5 size-4 shrink-0" aria-hidden="true" />
          <p>{error}</p>
        </div>
      ) : null}

      {/* Identity & contact */}
      <section aria-labelledby="profile-identity-heading" className="grid gap-4">
        <h3
          id="profile-identity-heading"
          className="inline-flex items-center gap-2 text-sm font-semibold text-[var(--admin-heading)]"
        >
          <UserIcon className="size-3.5 text-[var(--admin-text-muted)]" aria-hidden="true" />
          Identity &amp; contact
        </h3>

        <div className="grid gap-4 md:grid-cols-2">
          <Field
            id="field-name"
            label="Full name"
            required
            hint="As they'd like it on their record."
          >
            <Input
              name="name"
              value={profileDraft.name}
              onChange={(value) =>
                setProfileDraft((current) => ({ ...current, name: value }))
              }
              disabled={disabled}
              placeholder="As they'd like it on their record"
            />
          </Field>

          <Field
            id="field-phone"
            label="Phone"
            hint="Always visible to admins; the toggle below controls staff-profile visibility."
          >
            <Input
              name="phone"
              type="tel"
              value={profileDraft.phone}
              onChange={(value) =>
                setProfileDraft((current) => ({ ...current, phone: value }))
              }
              disabled={disabled}
              placeholder="07…"
            />
          </Field>
        </div>

        <ToggleRow
          name="show_phone_on_profile"
          label="Show phone to other staff"
          hint="Off keeps the phone admin-only; on marks it for staff-profile visibility."
          checked={profileDraft.show_phone_on_profile}
          onChange={(value) =>
            setProfileDraft((current) => ({ ...current, show_phone_on_profile: value }))
          }
          disabled={disabled}
        />
      </section>

      {/* Profile details (descriptive fields shared on staff-profile surfaces) */}
      <section aria-labelledby="profile-details-heading" className="grid gap-4">
        <h3
          id="profile-details-heading"
          className="inline-flex items-center gap-2 text-sm font-semibold text-[var(--admin-heading)]"
        >
          <Megaphone className="size-3.5 text-[var(--admin-text-muted)]" aria-hidden="true" />
          Profile details
        </h3>

        <Field
          id="field-short_bio"
          label="Short bio"
          hint={`A short paragraph about them and their work. ${bioRemaining} characters remaining.`}
        >
          <textarea
            id="field-short_bio"
            name="short_bio"
            value={profileDraft.short_bio}
            onChange={(event) =>
              setProfileDraft((current) => ({
                ...current,
                short_bio: event.target.value,
              }))
            }
            rows={4}
            maxLength={BIO_MAX}
            disabled={disabled}
            placeholder="A short paragraph about this team member and their work."
            className="min-h-[6rem] w-full rounded-[var(--admin-radius-control)] border border-[var(--admin-border-form)] bg-[var(--admin-surface-input)] px-3 py-2 text-sm leading-6 text-[var(--admin-body)] outline-none transition-colors placeholder:text-[var(--admin-text-muted)] focus-visible:border-[var(--admin-focus)] focus-visible:ring-2 focus-visible:ring-[var(--admin-focus)]/30 disabled:cursor-not-allowed disabled:opacity-60"
          />
        </Field>

        <div className="grid gap-4 md:grid-cols-3">
          <Field
            id="field-specialties"
            label="Specialties"
            hint="e.g. Cupping, Postnatal, Sports massage"
          >
            <Input
              name="specialties"
              value={profileDraft.specialties}
              onChange={(value) =>
                setProfileDraft((current) => ({ ...current, specialties: value }))
              }
              disabled={disabled}
              placeholder="Add separated by commas"
            />
          </Field>
          <Field
            id="field-languages"
            label="Languages"
            hint="e.g. English, Arabic, Urdu"
          >
            <Input
              name="languages"
              value={profileDraft.languages}
              onChange={(value) =>
                setProfileDraft((current) => ({ ...current, languages: value }))
              }
              disabled={disabled}
              placeholder="Add separated by commas"
            />
          </Field>
          <Field
            id="field-service_areas"
            label="Service areas"
            hint="e.g. Luton, Dunstable, Houghton Regis"
          >
            <Input
              name="service_areas"
              value={profileDraft.service_areas}
              onChange={(value) =>
                setProfileDraft((current) => ({ ...current, service_areas: value }))
              }
              disabled={disabled}
              placeholder="Add separated by commas"
            />
          </Field>
        </div>
      </section>

      {canEditSafeProfile ? (
        <>
          {/* Inline action row — right-aligned on sm+; on mobile, hidden when dirty (sticky bar takes over) */}
          <div
            className={cn(
              "sm:flex sm:items-center sm:justify-end sm:gap-2",
              isDirty ? "hidden" : "flex flex-col-reverse gap-2"
            )}
          >
            {isDirty ? (
              <button
                type="button"
                disabled={isPending}
                onClick={handleDiscard}
                className="inline-flex min-h-10 w-full items-center justify-center rounded-[var(--admin-radius-control)] px-4 text-sm font-semibold text-[var(--admin-body)] outline-none transition-colors hover:bg-[var(--admin-panel-muted)] hover:text-[var(--admin-heading)] focus-visible:ring-2 focus-visible:ring-[var(--admin-focus)]/55 focus-visible:ring-offset-2 disabled:cursor-not-allowed disabled:opacity-60 sm:w-auto"
              >
                Discard changes
              </button>
            ) : null}
            <button
              type="button"
              disabled={isPending || !isDirty}
              onClick={handleSafeProfileSave}
              aria-busy={isPending || undefined}
              className="inline-flex min-h-10 w-full items-center justify-center rounded-[var(--admin-radius-control)] bg-[var(--admin-primary)] px-4 text-sm font-semibold text-[var(--admin-on-primary)] outline-none transition-colors hover:bg-[var(--admin-primary-hover)] focus-visible:ring-2 focus-visible:ring-[var(--admin-focus)]/55 focus-visible:ring-offset-2 disabled:cursor-not-allowed disabled:opacity-60 sm:w-auto"
            >
              {isPending ? "Saving…" : "Save profile"}
            </button>
          </div>

          {/* Sticky mobile save bar — only when dirty (Brief §6 save-success path preserves toast). */}
          {isDirty ? (
            <div
              className="sticky bottom-20 z-30 -mx-4 mt-2 flex gap-2 border-t border-[var(--admin-border)] bg-[var(--admin-panel)]/95 px-4 py-3 shadow-[0_-8px_24px_var(--admin-shadow-ink-06)] backdrop-blur sm:hidden"
              role="region"
              aria-label="Unsaved profile changes"
            >
              <button
                type="button"
                disabled={isPending}
                onClick={handleDiscard}
                className="inline-flex min-h-11 flex-1 items-center justify-center rounded-[var(--admin-radius-control)] border border-[var(--admin-border-form)] bg-transparent px-4 text-sm font-semibold text-[var(--admin-body)] outline-none transition-colors hover:bg-[var(--admin-panel-muted)] focus-visible:ring-2 focus-visible:ring-[var(--admin-focus)]/55 disabled:cursor-not-allowed disabled:opacity-60"
              >
                Discard
              </button>
              <button
                type="button"
                disabled={isPending}
                onClick={handleSafeProfileSave}
                aria-busy={isPending || undefined}
                className="inline-flex min-h-11 flex-[2] items-center justify-center rounded-[var(--admin-radius-control)] bg-[var(--admin-primary)] px-4 text-sm font-semibold text-[var(--admin-on-primary)] outline-none transition-colors hover:bg-[var(--admin-primary-hover)] focus-visible:ring-2 focus-visible:ring-[var(--admin-focus)]/55 disabled:cursor-not-allowed disabled:opacity-60"
              >
                {isPending ? "Saving…" : "Save profile"}
              </button>
            </div>
          ) : null}
        </>
      ) : null}

      {/* Admin-only sections */}
      {canManageUsers || canAssignRoles ? (
        <section
          aria-labelledby="profile-admin-heading"
          className="grid gap-4 border-t border-[var(--admin-border)] pt-6"
        >
          <h3
            id="profile-admin-heading"
            className="inline-flex items-center gap-2 text-sm font-semibold text-[var(--admin-heading)]"
          >
            <ShieldCheck className="size-3.5 text-[var(--admin-text-muted)]" aria-hidden="true" />
            Account &amp; role
          </h3>

          {canManageUsers ? (
            <div className="grid gap-3 sm:grid-cols-2">
              <ToggleRow
                name="active"
                label="Active account"
                hint="Inactive staff can't sign in."
                checked={currentStaff.active}
                onChange={handleToggleActive}
                disabled={isPending || !canManageUsers}
                inline
              />
              <ToggleRow
                name="can_take_bookings"
                label="Can take bookings"
                hint="Off pauses new assignments without deactivating the account."
                checked={currentStaff.can_take_bookings}
                onChange={handleToggleBookings}
                disabled={isPending || !canManageUsers}
                inline
              />
            </div>
          ) : null}

          {canAssignRoles ? (
            <Field id="field-role_id" label="Role" hint="Determines default permissions.">
              <div
                role="radiogroup"
                aria-label="Role"
                aria-orientation="horizontal"
                className="grid grid-cols-2 gap-1.5 sm:grid-cols-3"
              >
                {roles.map((role) => (
                  <button
                    key={role.id}
                    type="button"
                    role="radio"
                    aria-checked={currentStaff.role_id === role.id}
                    name="role_id"
                    data-role-value={role.id}
                    disabled={isPending || !canAssignRoles}
                    onClick={() => handleRoleChange(role.id)}
                    className={cn(
                      "inline-flex min-h-10 items-center justify-center rounded-[var(--admin-radius-control)] border px-3 text-center text-xs font-semibold leading-tight outline-none transition-colors focus-visible:ring-2 focus-visible:ring-[var(--admin-focus)]/55 focus-visible:ring-offset-2 disabled:cursor-not-allowed disabled:opacity-60",
                      currentStaff.role_id === role.id
                        ? "border-[var(--admin-primary)] bg-[var(--admin-primary)] text-[var(--admin-on-primary)]"
                        : "border-[var(--admin-border-form)] bg-transparent text-[var(--admin-body)] hover:border-[var(--admin-primary)]/35 hover:bg-[var(--admin-panel-muted)]"
                    )}
                  >
                    {role.display_label ?? role.name}
                  </button>
                ))}
              </div>
            </Field>
          ) : null}

          {canManageUsers ? (
            <Field
              id="field-gender"
              label="Gender"
              required
              hint="Used for same-gender booking matching."
            >
              <div
                role="radiogroup"
                aria-label="Gender"
                aria-orientation="horizontal"
                className="flex gap-2"
              >
                {(["female", "male"] as const).map((g) => (
                  <button
                    key={g}
                    type="button"
                    role="radio"
                    aria-checked={currentStaff.gender === g}
                    name="gender"
                    data-gender-value={g}
                    disabled={isPending || !canManageUsers}
                    onClick={() => handleGenderChange(g)}
                    className={cn(
                      "inline-flex min-h-10 flex-1 items-center justify-center rounded-[var(--admin-radius-control)] border px-3 text-sm font-medium capitalize outline-none transition-colors focus-visible:ring-2 focus-visible:ring-[var(--admin-focus)]/55 focus-visible:ring-offset-2 disabled:cursor-not-allowed disabled:opacity-60",
                      currentStaff.gender === g
                        ? "border-[var(--admin-primary)] bg-[var(--admin-primary)] text-[var(--admin-on-primary)]"
                        : "border-[var(--admin-border-form)] bg-transparent text-[var(--admin-body)] hover:border-[var(--admin-primary)]/35 hover:bg-[var(--admin-panel-muted)]"
                    )}
                  >
                    {g}
                  </button>
                ))}
              </div>
            </Field>
          ) : null}
        </section>
      ) : null}
    </div>
  );
}

// ─── Field shell with label + hint slot ──────────────────────────────────────

function Field({
  id,
  label,
  required = false,
  hint,
  children,
}: {
  id: string;
  label: string;
  required?: boolean;
  hint?: string;
  children: React.ReactNode;
}) {
  const hintId = `${id}-hint`;
  return (
    <div className="grid gap-1.5">
      <label
        htmlFor={id}
        className="text-sm font-medium text-[var(--admin-heading)]"
      >
        {label}
        {required ? (
          <span aria-hidden="true" className="ml-0.5 text-[var(--admin-status-cancelled-text)]">
            *
          </span>
        ) : null}
        {required ? <span className="sr-only"> (required)</span> : null}
      </label>
      {children}
      {hint ? (
        <p id={hintId} className="text-xs text-[var(--admin-text-muted)]">
          {hint}
        </p>
      ) : null}
    </div>
  );
}

function Input({
  name,
  value,
  onChange,
  disabled,
  placeholder,
  type = "text",
}: {
  name: string;
  value: string;
  onChange: (value: string) => void;
  disabled?: boolean;
  placeholder?: string;
  type?: string;
}) {
  return (
    <input
      id={`field-${name}`}
      name={name}
      type={type}
      value={value}
      onChange={(event) => onChange(event.target.value)}
      disabled={disabled}
      placeholder={placeholder}
      className="flex h-10 w-full rounded-[var(--admin-radius-control)] border border-[var(--admin-border-form)] bg-[var(--admin-surface-input)] px-3 py-2 text-sm text-[var(--admin-body)] outline-none transition-colors placeholder:text-[var(--admin-text-muted)] focus-visible:border-[var(--admin-focus)] focus-visible:ring-2 focus-visible:ring-[var(--admin-focus)]/30 disabled:cursor-not-allowed disabled:opacity-60"
    />
  );
}

function ToggleRow({
  name,
  label,
  hint,
  checked,
  onChange,
  disabled,
  inline = false,
}: {
  name: string;
  label: string;
  hint?: string;
  checked: boolean;
  onChange: ((value: boolean) => void) | (() => void);
  disabled?: boolean;
  inline?: boolean;
}) {
  function handleToggle() {
    if (disabled) return;
    if (onChange.length === 0) {
      (onChange as () => void)();
    } else {
      (onChange as (value: boolean) => void)(!checked);
    }
  }
  return (
    <div
      className={cn(
        "rounded-[var(--admin-radius-control)] border border-[var(--admin-border)] bg-[var(--admin-panel-muted)]/50 px-3 py-2.5",
        inline ? "" : ""
      )}
    >
      <div className="flex items-start justify-between gap-3">
        <div className="min-w-0">
          <p className="text-sm font-medium text-[var(--admin-heading)]">{label}</p>
          {hint ? (
            <p className="mt-0.5 text-xs text-[var(--admin-text-muted)]">{hint}</p>
          ) : null}
        </div>
        <button
          type="button"
          role="switch"
          name={name}
          aria-checked={checked}
          disabled={disabled}
          onClick={handleToggle}
          className={cn(
            "relative inline-flex h-6 w-11 shrink-0 items-center rounded-full border-2 border-transparent transition-colors outline-none focus-visible:ring-2 focus-visible:ring-[var(--admin-focus)]/55 disabled:cursor-not-allowed disabled:opacity-60",
            checked ? "bg-[var(--admin-primary)]" : "bg-[var(--admin-border)]"
          )}
        >
          <span
            aria-hidden="true"
            className={cn(
              "block size-4 rounded-full bg-white shadow-sm transition-transform",
              checked ? "translate-x-5" : "translate-x-0.5"
            )}
          />
        </button>
      </div>
    </div>
  );
}

function splitList(value: string) {
  return value
    .split(",")
    .map((item) => item.replace(/\s+/g, " ").trim())
    .filter(Boolean);
}
