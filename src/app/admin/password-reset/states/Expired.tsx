import { ForgotForm } from "./ForgotForm";

/**
 * State 6 — Expired (link no longer valid).
 *
 * Per brief §11 state 6:
 *   - body: "This password-reset link is no longer valid. Submit a new
 *     request below."
 *   - Inline state-1 form beneath the body (email field + Primary
 *     "Submit request").
 *   - No separate "Submit a new request" button; the inline form IS the
 *     action.
 */

export function Expired() {
  return (
    <>
      <p className="text-center text-base leading-[1.55] text-[var(--admin-body)] [text-wrap:pretty]">
        This password-reset link is no longer valid. Submit a new request
        below.
      </p>

      <ForgotForm variant="expired-inline" />
    </>
  );
}
