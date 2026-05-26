import { clearPasswordResetCookie } from "../actions";
import { maskedEmailA11yLabel } from "../PasswordResetCard";

/**
 * State 2 — Request submitted (confirmation).
 *
 * Per brief §11 state 2:
 *   - body: "Thanks. An Owner will review this and email you when it's
 *     approved. You can close this page; the link will come to your inbox."
 *   - Sub-line: "Sent for: f••@rahmatherapy.co.uk" (masked email)
 *   - Ghost "Submit a different email" → clears cookie + re-renders state 1
 *   - No submit affordance; form is gone.
 *
 * The "different email" affordance posts to a `clearPasswordResetCookie`
 * server action (no client fetch); form action contract preserved.
 */

export function SubmittedConfirmation({
  maskedEmail,
}: {
  maskedEmail: string;
}) {
  return (
    <>
      <p className="text-center text-base leading-[1.55] text-[var(--admin-body)] [text-wrap:pretty]">
        Thanks. An Owner will review this and email you when it&apos;s
        approved. You can close this page; the link will come to your inbox.
      </p>

      <p
        className="text-center text-xs text-[var(--admin-text-muted)]"
        aria-label={maskedEmailA11yLabel(maskedEmail)}
      >
        Sent for: <span className="font-medium">{maskedEmail}</span>
      </p>

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
