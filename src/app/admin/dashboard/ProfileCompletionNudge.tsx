// SERVER COMPONENT — first-run onboarding nudge for new staff.
//
// Renders ONLY when the signed-in staff member has never fully completed
// their profile (profile_completed_at is null) and at least one of the
// five visible completion fields is still empty (phone, short bio,
// specialties, languages, service areas).
//
// Once they finish their profile for the first time, profile_completed_at
// is set and this panel never appears again, even if a field is later
// un-filled. That matches the Phase 6 staff-brief intent: nudge new staff
// once during onboarding, then trust them to maintain their own profile.

import Link from "next/link";
import { ArrowRight, UserCog } from "lucide-react";

interface ProfileCompletionNudgeProps {
  staffId: string;
  firstName: string;
  phone: string | null;
  shortBio: string | null;
  specialties: string[] | null;
  languages: string[] | null;
  serviceAreas: string[] | null;
  profileCompletedAt: string | null;
}

export function ProfileCompletionNudge({
  staffId,
  firstName,
  phone,
  shortBio,
  specialties,
  languages,
  serviceAreas,
  profileCompletedAt,
}: ProfileCompletionNudgeProps) {
  // Once they've completed once, stay out of their way.
  if (profileCompletedAt) return null;

  const items = [
    { label: "Phone", done: Boolean(phone?.trim()) },
    { label: "Short bio", done: Boolean(shortBio?.trim()) },
    { label: "Specialties", done: Boolean(specialties?.length) },
    { label: "Languages", done: Boolean(languages?.length) },
    { label: "Service areas", done: Boolean(serviceAreas?.length) },
  ];
  const done = items.filter((item) => item.done).length;
  const total = items.length;
  if (done === total) return null;

  const remaining = items.filter((item) => !item.done).map((item) => item.label);
  const remainingLabel =
    remaining.length === 1
      ? remaining[0]
      : remaining.length === 2
        ? `${remaining[0]} and ${remaining[1]}`
        : `${remaining.slice(0, -1).join(", ")}, and ${remaining[remaining.length - 1]}`;

  return (
    <section
      aria-labelledby="onboarding-nudge-heading"
      className="rounded-[var(--admin-radius-card)] border border-[oklch(82%_0.09_75)] bg-[oklch(96%_0.038_75)] px-5 py-5"
    >
      <div className="flex flex-col gap-3 sm:flex-row sm:items-start sm:gap-4">
        <span
          aria-hidden="true"
          className="inline-flex size-10 shrink-0 items-center justify-center rounded-full bg-[oklch(94%_0.05_75)] text-[oklch(28%_0.12_55)]"
        >
          <UserCog className="size-5" />
        </span>
        <div className="flex-1 min-w-0">
          <h2
            id="onboarding-nudge-heading"
            className="font-display text-base font-semibold text-[var(--admin-heading)]"
          >
            {firstName ? `Welcome, ${firstName}.` : "Welcome."} Finish your profile.
          </h2>
          <p className="mt-1 text-sm leading-6 text-[var(--admin-body)]">
            {done > 0 ? `${done} of ${total} done.` : "Five quick fields."} Add your {remainingLabel.toLowerCase()} so coordinators can match clients to you and the team knows how to reach you.
          </p>
        </div>
        <Link
          href={`/admin/staff/${staffId}`}
          className="inline-flex min-h-11 shrink-0 items-center justify-center gap-1.5 self-start rounded-[var(--admin-radius-control)] bg-[var(--admin-primary)] px-4 text-sm font-semibold text-white outline-none transition-colors hover:bg-[var(--admin-primary-hover)] focus-visible:ring-2 focus-visible:ring-[var(--admin-focus)]/55 sm:min-h-10"
        >
          Open my profile
          <ArrowRight aria-hidden="true" className="size-4" />
        </Link>
      </div>
    </section>
  );
}
