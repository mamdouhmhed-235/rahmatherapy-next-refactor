import { XCircle } from "lucide-react";
import { Input } from "@/components/ui/input";
import { submitPasswordResetRequest } from "../actions";
import { PasswordResetSubmitButton } from "../PasswordResetSubmitButton";

/**
 * State 1 — Initial forgot-password form (and inline form on state 6).
 *
 * Per brief §11 state 1:
 *   - <input type="email" name="email" required autocomplete="username">
 *   - Primary "Submit request" full-width
 *   - body: "An Owner reviews each request. We'll let you know by email when
 *     it's approved."
 *   - No autofocus on mount (brief §7).
 *
 * Server-action signature preserved: <form action={submitPasswordResetRequest}>.
 * The form does NOT use client-side fetch (brief §4 + §10.1 — security-by-
 * uniform-response means the same FAKE server action handles every email).
 */

const REQUIRED_STAR = (
  <span aria-hidden="true" className="ml-0.5 text-[var(--admin-danger)]">
    *
  </span>
);

const ERROR_COPY: Record<string, string> = {
  empty: "Add your email address.",
  format: "Email needs an @ symbol. For example, sara@example.com.",
  server: "Something went wrong. Try again in a minute.",
};

export function ForgotForm({
  errorCode,
  email,
  variant = "primary",
}: {
  errorCode?: string;
  email?: string;
  /** "primary" on state 1; "expired-inline" beneath the state-6 body. */
  variant?: "primary" | "expired-inline";
}) {
  // Brief §6 cross-state matrix splits validation errors (below the field)
  // from server errors (above submit, with Ghost "Try again"). The field-level
  // error renders for "empty" / "format"; the form-level alert renders for
  // "server" (network failure, Supabase outage).
  const fieldError =
    errorCode === "empty" || errorCode === "format"
      ? ERROR_COPY[errorCode]
      : undefined;
  const serverError = errorCode === "server" ? ERROR_COPY.server : undefined;
  const fieldId =
    variant === "expired-inline"
      ? "password-reset-email-expired"
      : "password-reset-email";
  const errorId = `${fieldId}-error`;
  const hintId = `${fieldId}-hint`;

  return (
    <>
      {variant === "primary" ? (
        <p
          id={hintId}
          className="text-center text-base leading-[1.55] text-[var(--admin-body)] [text-wrap:pretty]"
        >
          An Owner reviews each request. We&apos;ll let you know by email when
          it&apos;s approved.
        </p>
      ) : (
        // expired-inline variant — shown beneath the state-6 ("This link has
        // expired") and hostile-token ("This link is no longer valid") bodies.
        // The caveat is a compact single line so the user understands the
        // re-submission triggers the same human-review flow, not an instant
        // reset email.
        <p
          id={hintId}
          className="text-center text-sm leading-[1.55] text-[var(--admin-text-muted)]"
        >
          An Owner reviews each new request.
        </p>
      )}

      <form
        action={submitPasswordResetRequest}
        noValidate
        className="flex flex-col gap-4"
        data-redesign-backend="FAKE"
        // FAKE: submitPasswordResetRequest no-ops the DB write + email send
        // until BUILD-password-reset-request-actions.md lands.
      >
        <div className="flex flex-col gap-1.5">
          <label
            htmlFor={fieldId}
            className="text-sm font-medium text-[var(--admin-heading)]"
          >
            Email address{REQUIRED_STAR}
          </label>
          <Input
            id={fieldId}
            name="email"
            type="email"
            autoComplete="username"
            required
            aria-required="true"
            aria-invalid={fieldError ? "true" : undefined}
            aria-describedby={
              fieldError ? errorId : hintId
            }
            data-error={fieldError ? "true" : undefined}
            defaultValue={email ?? ""}
            placeholder="you@example.com"
          />
          {fieldError ? (
            <div
              id={errorId}
              role="alert"
              aria-live="polite"
              aria-atomic="true"
              className="flex items-start gap-1.5 text-xs text-[var(--admin-danger)]"
            >
              <XCircle
                aria-hidden="true"
                className="mt-px size-3.5 shrink-0"
              />
              <span>{fieldError}</span>
            </div>
          ) : null}
        </div>

        {serverError ? (
          <div
            role="alert"
            aria-live="polite"
            aria-atomic="true"
            className="flex items-start gap-2.5 rounded-[var(--admin-radius-sm)] border bg-[var(--admin-danger-bg)] px-3.5 py-3 text-sm text-[var(--admin-danger)]"
            style={{
              borderColor:
                "color-mix(in oklab, var(--admin-danger) 28%, transparent)",
            }}
          >
            <XCircle aria-hidden="true" className="mt-0.5 size-4 shrink-0" />
            <span>{serverError}</span>
          </div>
        ) : null}

        <PasswordResetSubmitButton>Submit request</PasswordResetSubmitButton>
      </form>
    </>
  );
}
