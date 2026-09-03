import Link from "next/link";
import { FileQuestion } from "lucide-react";
import { AdminPanel } from "./components/admin-ui";

/**
 * ⛔ THE ADMIN'S 404. Before this file existed there was NO `not-found.tsx`
 * anywhere in the application, so every `notFound()` in the admin fell through
 * to Next.js's built-in page: a white screen, default system font, no admin
 * shell, no navigation, no sign-out, no link back. A signed-in member of staff
 * who reached one was simply stranded.
 *
 * Six live routes call `notFound()` and ALL of them land here, because Next
 * resolves `not-found.tsx` from the nearest route segment upward:
 *   /admin/clients/[clientId]                  — missing or soft-deleted client
 *   /admin/clients/[clientId]/edit             — missing or soft-deleted client
 *   /admin/emails/templates/[templateId]       — unknown template id
 *   /admin/roles/[roleId]                      — unknown role id
 *   /admin/staff/[staffId]/availability        — unknown staff id
 *   /admin/staff/[staffId]/performance         — unknown staff id
 *
 * ⚠️ Route 1 is not hypothetical: a therapist assigned to a booking whose client
 * was later soft-deleted reaches it by clicking a client link in their own
 * booking.
 *
 * ⛔ PRESENTATIONAL ONLY. This renders inside `admin/layout.tsx`, so the shell,
 * nav and bottom tab bar come for free — but it must never fetch or assume any
 * page-level data. A 404 page that can itself fail is worse than none.
 *
 * ⛔ Do NOT add a root `src/app/not-found.tsx` alongside this. That would also
 * capture unmatched PUBLIC urls and change what customers see on a bad link, and
 * the public site has never been audited (PUBLIC-SITE-KNOWN-UNKNOWN.md).
 */
export default function AdminNotFound() {
  return (
    <div className="mx-auto max-w-2xl" data-admin-not-found="true">
      <AdminPanel tone="restricted">
        <div className="grid justify-items-center gap-4 py-10 text-center">
          {/*
            ⛔ `--admin-panel` on the circle, NOT the panel's own tone colour.
            The existing refusal cards paint this badge with the same token as
            the card behind it, so the circle is invisible — a confirmed finding
            in this audit. Not repeated here.
          */}
          <span className="inline-flex size-12 items-center justify-center rounded-full bg-[var(--admin-panel)] ring-1 ring-[var(--admin-border)]">
            <FileQuestion
              className="size-6 text-[var(--admin-text-muted)]"
              aria-hidden="true"
            />
          </span>

          <h1 className="font-display text-xl font-semibold text-[var(--admin-heading)]">
            We couldn&rsquo;t find that
          </h1>

          {/*
            Says WHY, not just THAT. Staff otherwise assume the system is broken;
            a deleted record and a mistyped address are different situations and
            only one of them is worth reporting.
          */}
          <p className="max-w-[45ch] text-sm leading-6 text-[var(--admin-text-muted)]">
            The record may have been deleted, or the link you followed may be out
            of date. Nothing has gone wrong with your account.
          </p>

          {/*
            ⛔ `/admin`, not `/admin/dashboard`, and deliberately neutral wording.
            `/admin` redirects each role to its own home, so this one link is
            correct for everybody. The existing refusal screens say "Back to
            dashboard" to therapists, whose navigation has no "dashboard" in it
            at all — it says "My day".
          */}
          <Link
            href="/admin"
            className="inline-flex h-11 items-center rounded-[var(--admin-radius-control)] border border-[var(--admin-border-form)] bg-transparent px-4 text-sm font-semibold text-[var(--admin-body)] outline-none transition-colors hover:bg-[var(--admin-panel-muted)] focus-visible:ring-2 focus-visible:ring-[var(--admin-focus)]/55 sm:h-10"
          >
            Back to your home screen
          </Link>
        </div>
      </AdminPanel>
    </div>
  );
}
