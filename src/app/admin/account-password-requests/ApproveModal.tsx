"use client";

import { useActionState, useEffect, useId, useState } from "react";
import { useFormStatus } from "react-dom";
import { Dialog as BaseDialog } from "@base-ui/react/dialog";
import { CheckCircle, Loader2, RefreshCw, XCircle } from "lucide-react";
import { approvePasswordResetRequest, type ReviewActionResult } from "./actions";

const NOTE_MAX = 240;

function SubmitButton() {
  const { pending } = useFormStatus();
  return (
    <button
      type="submit"
      aria-busy={pending || undefined}
      disabled={pending}
      className="inline-flex min-h-10 items-center justify-center gap-2 rounded-[var(--admin-radius-control)] bg-[var(--admin-primary)] px-4 text-sm font-semibold text-[var(--admin-on-primary)] outline-none transition-colors hover:bg-[var(--admin-primary-hover)] focus-visible:ring-[3px] focus-visible:ring-[var(--admin-focus)] focus-visible:ring-offset-2 focus-visible:ring-offset-[var(--admin-panel)] disabled:opacity-60 disabled:pointer-events-none"
    >
      {pending ? (
        <Loader2 className="size-4 shrink-0 animate-spin" aria-hidden="true" />
      ) : (
        <CheckCircle className="size-4 shrink-0" aria-hidden="true" />
      )}
      Send approval email
    </button>
  );
}

export function ApproveModal({
  requestId,
  email,
}: {
  requestId: string;
  email: string;
}) {
  const [open, setOpen] = useState(false);
  const [note, setNote] = useState("");
  const noteId = useId();
  const errorId = useId();

  const [result, formAction] = useActionState<ReviewActionResult | null, FormData>(
    async (_prev, formData) => approvePasswordResetRequest(formData),
    null
  );

  useEffect(() => {
    if (result?.ok) {
      // eslint-disable-next-line react-hooks/set-state-in-effect
      setOpen(false);
      setNote("");
    }
  }, [result]);

  const remaining = NOTE_MAX - note.length;
  const errorMessage =
    result && !result.ok && result.code === "validation"
      ? result.message
      : result && !result.ok && result.code === "self_approval"
      ? "You can't approve your own request. Ask another owner or admin to review."
      : result && !result.ok && result.code === "race"
      ? `This request was just reviewed by ${result.otherReviewer}. Refresh to see the latest.`
      : result && !result.ok && result.code === "server"
      ? result.message
      : null;
  const isRaceError = Boolean(result && !result.ok && result.code === "race");

  return (
    <BaseDialog.Root open={open} onOpenChange={setOpen}>
      <BaseDialog.Trigger
        render={
          <button
            type="button"
            data-redesign-backend="FAKE"
            data-redesign-fake-source="approve handler — BUILD-approve-reject-password-reset.md"
            className="inline-flex min-h-10 items-center justify-center gap-1.5 rounded-[var(--admin-radius-control)] bg-[var(--admin-primary)] px-4 text-sm font-semibold text-[var(--admin-on-primary)] outline-none transition-colors hover:bg-[var(--admin-primary-hover)] focus-visible:ring-[3px] focus-visible:ring-[var(--admin-focus)] focus-visible:ring-offset-2 focus-visible:ring-offset-[var(--admin-panel)]"
          >
            <CheckCircle className="size-4" aria-hidden="true" />
            Approve
          </button>
        }
      />
      <BaseDialog.Portal>
        <BaseDialog.Backdrop className="fixed inset-0 z-50 bg-[var(--admin-scrim)]/35 backdrop-blur-sm motion-safe:animate-in motion-safe:fade-in motion-safe:duration-200" />
        <BaseDialog.Popup
          className="fixed inset-x-0 bottom-0 z-50 w-full rounded-t-[var(--admin-radius-card)] border-t border-[var(--admin-border)] bg-[var(--admin-panel)] p-5 shadow-[var(--admin-shadow-overlay)] outline-none motion-safe:animate-in motion-safe:slide-in-from-bottom motion-safe:duration-200 sm:inset-x-auto sm:bottom-auto sm:left-1/2 sm:top-[18vh] sm:w-[min(calc(100vw-2rem),28rem)] sm:-translate-x-1/2 sm:rounded-[var(--admin-radius-card)] sm:border sm:p-6 sm:motion-safe:slide-in-from-top-2"
          data-redesign-backend="FAKE"
        >
          <form action={formAction} className="grid gap-4">
            <input type="hidden" name="requestId" value={requestId} />

            <div className="flex items-start gap-3">
              <span
                className="mt-0.5 inline-flex size-9 shrink-0 items-center justify-center rounded-full bg-[var(--admin-status-confirmed-bg)]"
                aria-hidden="true"
              >
                <CheckCircle className="size-5 text-[var(--admin-status-confirmed-text)]" />
              </span>
              <div className="min-w-0 flex-1">
                <BaseDialog.Title className="font-display text-lg font-semibold text-[var(--admin-heading)]">
                  Approve this request?
                </BaseDialog.Title>
                <BaseDialog.Description className="mt-1.5 text-sm leading-6 text-[var(--admin-text-muted)]">
                  An approval email with a one-time reset link will be sent to{" "}
                  <span className="font-medium text-[var(--admin-body)]">{email}</span>. The link
                  expires in 24 hours.
                </BaseDialog.Description>
              </div>
            </div>

            <div className="grid gap-1.5">
              <label
                htmlFor={noteId}
                className="text-sm font-medium text-[var(--admin-heading)]"
              >
                Note (optional)
              </label>
              <textarea
                id={noteId}
                name="reviewer_note"
                value={note}
                onChange={(e) => setNote(e.target.value.slice(0, NOTE_MAX))}
                maxLength={NOTE_MAX}
                rows={3}
                placeholder="Anything you want the requester to see in the email."
                aria-describedby={errorMessage ? errorId : undefined}
                className="w-full rounded-[var(--admin-radius-control)] border border-[var(--admin-border-form)] bg-[var(--admin-surface-input)] px-3 py-2 text-sm leading-6 text-[var(--admin-body)] outline-none transition-colors placeholder:text-[var(--admin-text-muted)] focus-visible:border-[var(--admin-focus)] focus-visible:ring-2 focus-visible:ring-[var(--admin-focus)]/30"
              />
              <p className="text-right text-xs text-[var(--admin-text-muted)]">
                {note.length} / {NOTE_MAX}
                {remaining < 20 ? (
                  <span className="ml-1 text-[var(--admin-status-attention-text)]">· {remaining} left</span>
                ) : null}
              </p>
            </div>

            {errorMessage ? (
              <div
                id={errorId}
                role="alert"
                aria-live="polite"
                aria-atomic="true"
                className="flex items-start gap-2 rounded-[var(--admin-radius-control)] bg-[var(--admin-status-cancelled-bg)] px-3 py-2 text-sm leading-6 text-[var(--admin-status-cancelled-text)]"
              >
                <XCircle className="mt-0.5 size-4 shrink-0" aria-hidden="true" />
                <span className="min-w-0 flex-1">{errorMessage}</span>
                {isRaceError ? (
                  <button
                    type="button"
                    onClick={() => {
                      if (typeof window !== "undefined") window.location.reload();
                    }}
                    className="inline-flex shrink-0 items-center gap-1 rounded-[var(--admin-radius-control)] px-2 py-1 text-xs font-semibold text-[var(--admin-status-cancelled-text)] underline-offset-2 outline-none transition-colors hover:bg-[var(--admin-status-cancelled-bg)]/60 hover:underline focus-visible:ring-[3px] focus-visible:ring-[var(--admin-focus)] focus-visible:ring-offset-2 focus-visible:ring-offset-[var(--admin-panel)]"
                  >
                    <RefreshCw className="size-3.5" aria-hidden="true" />
                    Refresh now
                  </button>
                ) : null}
              </div>
            ) : null}

            <div className="mt-1 flex flex-col-reverse gap-2 sm:flex-row sm:justify-end">
              <BaseDialog.Close
                render={
                  <button
                    type="button"
                    className="inline-flex min-h-10 items-center justify-center rounded-[var(--admin-radius-control)] border border-[var(--admin-border-form)] bg-transparent px-4 text-sm font-semibold text-[var(--admin-body)] outline-none transition-colors hover:bg-[var(--admin-panel-muted)] focus-visible:ring-[3px] focus-visible:ring-[var(--admin-focus)] focus-visible:ring-offset-2 focus-visible:ring-offset-[var(--admin-panel)]"
                  >
                    Cancel
                  </button>
                }
              />
              <SubmitButton />
            </div>
          </form>
        </BaseDialog.Popup>
      </BaseDialog.Portal>
    </BaseDialog.Root>
  );
}
