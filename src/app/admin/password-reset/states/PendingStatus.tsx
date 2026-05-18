import { clearPasswordResetCookie } from "../actions";
import { maskedEmailA11yLabel } from "../PasswordResetCard";

/**
 * State 3 — Pending review status check.
 *
 * Per brief §11 state 3:
 *   - body: "Your request is still in the queue. We'll email you when it's
 *     approved. Submitted {time-ago}."
 *   - <dl> two rows: Submitted (relative timestamp) / Sent for (masked email)
 *   - Ghost "Submit a different email"
 */

function relativeTime(isoString: string): string {
  const submitted = new Date(isoString).getTime();
  if (Number.isNaN(submitted)) return "recently";
  const diffMs = Date.now() - submitted;
  const minutes = Math.round(diffMs / (1000 * 60));
  if (minutes < 1) return "just now";
  if (minutes < 60) return `about ${minutes} minute${minutes === 1 ? "" : "s"} ago`;
  const hours = Math.round(minutes / 60);
  if (hours < 24) return `about ${hours} hour${hours === 1 ? "" : "s"} ago`;
  const days = Math.round(hours / 24);
  return `about ${days} day${days === 1 ? "" : "s"} ago`;
}

export function PendingStatus({
  maskedEmail,
  submittedAt,
}: {
  maskedEmail: string;
  submittedAt: string;
}) {
  const relative = relativeTime(submittedAt);
  return (
    <>
      <p className="text-center text-base leading-[1.55] text-[var(--admin-body)] [text-wrap:pretty]">
        Your request is still in the queue. We&apos;ll email you when it&apos;s
        approved. Submitted {relative}.
      </p>

      {/* Status dl — brief §design tokens: surface-page well, 8px radius
          (--admin-radius-md), <dt> Work Sans 500 label step (0.75rem) Soft
          Slate, <dd> Work Sans 400 body step (1rem) Practice Charcoal.
          items-baseline aligns the dt baseline with the dd baseline given
          the size step-down. */}
      <dl
        className="grid grid-cols-[max-content_1fr] items-baseline gap-x-4 gap-y-2 rounded-[var(--admin-radius-md)] border bg-[var(--admin-canvas)] p-4"
        style={{ borderColor: "var(--admin-border)" }}
      >
        <dt className="text-xs font-medium tracking-[0.01em] text-[var(--admin-text-muted)]">
          Submitted
        </dt>
        <dd className="text-base text-[var(--admin-body)]">{relative}</dd>
        <dt className="text-xs font-medium tracking-[0.01em] text-[var(--admin-text-muted)]">
          Sent for
        </dt>
        <dd
          className="text-base text-[var(--admin-body)]"
          aria-label={maskedEmailA11yLabel(maskedEmail)}
        >
          {maskedEmail}
        </dd>
      </dl>

      <form action={clearPasswordResetCookie} className="flex justify-center">
        <button
          type="submit"
          aria-label="Submit a different email — send the request to a different address"
          className="rounded-sm border-0 bg-transparent px-2 py-2 text-sm font-medium text-[var(--admin-body)] underline-offset-2 transition-colors hover:text-[var(--admin-heading)] hover:underline focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[var(--admin-focus)]/55"
        >
          Submit a different email
        </button>
      </form>
    </>
  );
}
