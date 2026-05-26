"use client";

import { useId, useState } from "react";
import { XCircle } from "lucide-react";
import { Input } from "@/components/ui/input";
import { setPasswordWithToken } from "../actions";
import { PasswordResetSubmitButton } from "../PasswordResetSubmitButton";

/**
 * State 4 — Set new password (approved-with-token).
 *
 * Per brief §11 state 4 + §Copy:
 *   - Two fields: new_password (minLength 12) + confirm_new_password
 *   - Helper "At least 12 characters." beneath the first field
 *   - autocomplete="new-password" on both
 *   - Primary "Save and sign in" full-width
 *   - No "Back to sign in" link on this state (handled by PasswordResetCard
 *     prop showBackLink={false} at the route level)
 *   - Form name attributes preserved verbatim per recipe Hard rule #5.
 *   - Server action contract: setPasswordWithToken(formData) via
 *     <form action={...}>; no client fetch (brief §4).
 *
 * Client-side validation surfaces errors via role="alert" before the round
 * trip, but the same validation runs server-side in actions.ts — never trust
 * client gates alone.
 */

const REQUIRED_STAR = (
  <span aria-hidden="true" className="ml-0.5 text-[var(--admin-danger)]">
    *
  </span>
);

const ERROR_COPY: Record<string, string> = {
  short: "Password needs at least 12 characters.",
  mismatch: "Passwords don't match.",
  email: "Pick something that doesn't include your email address.",
  server: "Something went wrong. Try again in a minute.",
};

type ClientError = "short" | "mismatch" | null;

export function SetNewPassword({
  token,
  serverErrorCode,
}: {
  token: string;
  serverErrorCode?: string;
}) {
  const id = useId();
  const newId = `${id}-new`;
  const newErrorId = `${newId}-error`;
  const newHintId = `${newId}-hint`;
  const confirmId = `${id}-confirm`;
  const confirmErrorId = `${confirmId}-error`;

  const [clientError, setClientError] = useState<ClientError>(null);

  function handleSubmit(event: React.FormEvent<HTMLFormElement>) {
    const form = event.currentTarget;
    const newPassword =
      (form.elements.namedItem("new_password") as HTMLInputElement | null)
        ?.value ?? "";
    const confirmNew =
      (form.elements.namedItem("confirm_new_password") as HTMLInputElement | null)
        ?.value ?? "";

    if (newPassword.length < 12) {
      event.preventDefault();
      setClientError("short");
      return;
    }
    if (newPassword !== confirmNew) {
      event.preventDefault();
      setClientError("mismatch");
      return;
    }
    // Otherwise, let the form submit to the server action.
    setClientError(null);
  }

  const errorCode = clientError ?? serverErrorCode;
  const errorText = errorCode ? ERROR_COPY[errorCode] : undefined;
  const newFieldError =
    errorCode === "short" || errorCode === "email" ? errorText : undefined;
  const confirmFieldError = errorCode === "mismatch" ? errorText : undefined;
  const formLevelError = errorCode === "server" ? errorText : undefined;

  return (
    <>
      <p className="text-center text-base leading-[1.55] text-[var(--admin-body)] [text-wrap:pretty]">
        Almost done. Pick a password you&apos;ll remember.
      </p>

      <form
        action={setPasswordWithToken}
        onSubmit={handleSubmit}
        noValidate
        className="flex flex-col gap-4"
        data-redesign-backend="FAKE"
        // FAKE: setPasswordWithToken does NOT call Supabase Auth admin-API
        // until BUILD-password-reset-request-actions.md lands.
      >
        <input type="hidden" name="token" value={token} />

        <div className="flex flex-col gap-1.5">
          <label
            htmlFor={newId}
            className="text-sm font-medium text-[var(--admin-heading)]"
          >
            New password{REQUIRED_STAR}
          </label>
          <Input
            id={newId}
            name="new_password"
            type="password"
            autoComplete="new-password"
            minLength={12}
            required
            aria-required="true"
            aria-invalid={newFieldError ? "true" : undefined}
            aria-describedby={
              newFieldError ? `${newErrorId} ${newHintId}` : newHintId
            }
            data-error={newFieldError ? "true" : undefined}
            title="Mix in numbers, symbols, or a memorable phrase; anything that hits 12."
          />
          <p
            id={newHintId}
            className="text-xs text-[var(--admin-text-muted)]"
          >
            At least 12 characters.
          </p>
          {newFieldError ? (
            <div
              id={newErrorId}
              role="alert"
              aria-live="polite"
              aria-atomic="true"
              className="flex items-start gap-1.5 text-xs text-[var(--admin-danger)]"
            >
              <XCircle
                aria-hidden="true"
                className="mt-px size-3.5 shrink-0"
              />
              <span>{newFieldError}</span>
            </div>
          ) : null}
        </div>

        <div className="flex flex-col gap-1.5">
          <label
            htmlFor={confirmId}
            className="text-sm font-medium text-[var(--admin-heading)]"
          >
            Confirm new password{REQUIRED_STAR}
          </label>
          <Input
            id={confirmId}
            name="confirm_new_password"
            type="password"
            autoComplete="new-password"
            required
            aria-required="true"
            aria-invalid={confirmFieldError ? "true" : undefined}
            aria-describedby={
              confirmFieldError ? confirmErrorId : undefined
            }
            data-error={confirmFieldError ? "true" : undefined}
          />
          {confirmFieldError ? (
            <div
              id={confirmErrorId}
              role="alert"
              aria-live="polite"
              aria-atomic="true"
              className="flex items-start gap-1.5 text-xs text-[var(--admin-danger)]"
            >
              <XCircle
                aria-hidden="true"
                className="mt-px size-3.5 shrink-0"
              />
              <span>{confirmFieldError}</span>
            </div>
          ) : null}
        </div>

        {formLevelError ? (
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
            <span>{formLevelError}</span>
          </div>
        ) : null}

        <PasswordResetSubmitButton>Save and sign in</PasswordResetSubmitButton>
      </form>
    </>
  );
}
