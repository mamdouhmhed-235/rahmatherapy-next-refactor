import { Button } from "@/components/ui/button";
import { PlainTextWell } from "../PasswordResetCard";
import { clearPasswordResetCookie } from "../actions";

/**
 * State 5 — Rejected.
 *
 * Per brief §11 state 5:
 *   - body: "An Owner reviewed your request and decided not to approve it
 *     this time."
 *   - Reviewer-note well when `reviewer_note` is present, plain-text only.
 *     Hidden entirely when empty (no "no note provided" placeholder).
 *   - Primary "Submit a new request" → /admin/password-reset (clean).
 *
 * The note is rendered through React's default escaping. We never call
 * dangerouslySetInnerHTML on this surface. The PlainTextWell wrapper makes
 * that contract self-documenting (Phase 6 token-drift lint asserts zero
 * occurrences of dangerouslySetInnerHTML across this directory).
 */

export function Rejected({ reviewerNote }: { reviewerNote: string | null }) {
  return (
    <>
      <p className="text-center text-base leading-[1.55] text-[var(--admin-body)] [text-wrap:pretty]">
        An Owner reviewed your request and decided not to approve it this time.
      </p>

      {reviewerNote && reviewerNote.trim() ? (
        <PlainTextWell label="Note from the reviewer:" text={reviewerNote} />
      ) : null}

      <form action={clearPasswordResetCookie}>
        <Button type="submit" variant="admin-primary" size="lg" fullWidth>
          Submit a new request
        </Button>
      </form>
    </>
  );
}
