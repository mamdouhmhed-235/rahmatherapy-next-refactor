"use client";

import { useActionState, useEffect, useId, useState } from "react";
import { useRouter } from "next/navigation";
import { useFormStatus } from "react-dom";
import { Dialog as BaseDialog } from "@base-ui/react/dialog";
import { CheckCircle, Copy, Loader2, RefreshCw, XCircle } from "lucide-react";
import {
  approvePasswordResetRequest,
  finishApprovalRefresh,
  type ReviewActionResult,
} from "./actions";

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
  const router = useRouter();
  const [open, setOpen] = useState(false);
  const [note, setNote] = useState("");
  const noteId = useId();
  const errorId = useId();

  const [result, formAction] = useActionState<ReviewActionResult | null, FormData>(
    async (_prev, formData) => approvePasswordResetRequest(formData),
    null
  );

  // ⛔ On success the dialog now STAYS OPEN. It used to close immediately, which was
  // safe only while the one-time link went out by email and nowhere else. The link is
  // returned here now, and it is unrecoverable — the database keeps a one-way hash —
  // so closing the dialog would throw away the only copy that will ever exist.
  useEffect(() => {
    if (result?.ok) {
      // eslint-disable-next-line react-hooks/set-state-in-effect
      setNote("");
    }
  }, [result]);

  const approved = result?.ok ? result : null;

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
          {approved ? (
            <ApprovedPanel
              approved={approved}
              email={email}
              onDone={() => {
                setOpen(false);
                // ⛔ The approve action deliberately busts NO caches — doing so
                // remounted this modal and destroyed the one-time link before it
                // could be read. Both the tag and the path are flushed here instead,
                // now that the reviewer has finished with the link.
                void finishApprovalRefresh().finally(() => router.refresh());
              }}
            />
          ) : (
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
                  A one-time reset link will be emailed to{" "}
                  <span className="font-medium text-[var(--admin-body)]">{email}</span>, and shown
                  to you here so you can pass it on yourself. It expires in 24 hours.
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
          )}
        </BaseDialog.Popup>
      </BaseDialog.Portal>
    </BaseDialog.Root>
  );
}

/**
 * Shown after a successful approval, in place of the form.
 *
 * ⛔ THIS IS THE ONLY TIME THE LINK CAN BE SEEN. It is stored as a one-way hash, so
 * nothing — not this screen, not the database, not support — can produce it again.
 * Losing it means the requester must start over with a new request.
 *
 * ⚠️ Anyone holding this link can set that account's password without signing in.
 * That is inherent to the design (it is how the emailed link works too), which is why
 * the wording tells the reviewer to treat it exactly like a password.
 */
function ApprovedPanel({
  approved,
  email,
  onDone,
}: {
  approved: { resetLinkUrl?: string; emailSent?: boolean; expiresInHours?: number };
  email: string;
  onDone: () => void;
}) {
  const [copied, setCopied] = useState(false);
  const [copyFailed, setCopyFailed] = useState(false);
  const link = approved.resetLinkUrl ?? "";
  const hours = approved.expiresInHours ?? 24;

  async function copy() {
    try {
      await navigator.clipboard.writeText(link);
      setCopyFailed(false);
      setCopied(true);
      window.setTimeout(() => setCopied(false), 2000);
    } catch {
      // ⛔ SAY SO. This used to fail silently, on the one screen where silence is
      // expensive: the reviewer clicks Copy, nothing visibly changes, they assume it
      // worked, click Done — and the link is gone for good, because it exists nowhere
      // else. A browser can refuse clipboard access for ordinary reasons (denied
      // permission, an insecure context, an older browser), so this is not exotic.
      //
      // The link is still on screen and still selectable, so the fix is simply to
      // tell them to copy it by hand.
      setCopied(false);
      setCopyFailed(true);
    }
  }

  return (
    <div className="grid gap-4">
      <div className="flex items-start gap-3">
        <span
          className="mt-0.5 inline-flex size-9 shrink-0 items-center justify-center rounded-full bg-[var(--admin-status-confirmed-bg)]"
          aria-hidden="true"
        >
          <CheckCircle className="size-5 text-[var(--admin-status-confirmed-text)]" />
        </span>
        <div className="min-w-0 flex-1">
          <BaseDialog.Title className="font-display text-lg font-semibold text-[var(--admin-heading)]">
            Approved
          </BaseDialog.Title>
          <BaseDialog.Description className="mt-1.5 text-sm leading-6 text-[var(--admin-text-muted)]">
            {approved.emailSent ? (
              <>
                The reset link was emailed to{" "}
                <span className="font-medium text-[var(--admin-body)]">{email}</span>.
                It expires in {hours} hours.
              </>
            ) : (
              <>
                The approval is saved, but the email could not be sent. Copy the link
                below and give it to them yourself — it expires in {hours} hours.
              </>
            )}
          </BaseDialog.Description>
        </div>
      </div>

      <div
        className={`grid gap-2 rounded-[var(--admin-radius-control)] px-3 py-3 ${
          approved.emailSent
            ? "bg-[var(--admin-panel-muted)]"
            : "bg-[var(--admin-status-attention-bg)]"
        }`}
      >
        <p className="text-xs font-semibold text-[var(--admin-heading)]">
          One-time reset link
        </p>
        <p className="text-xs leading-5 text-[var(--admin-text-muted)]">
          {/* Deliberately blunt: this is the sentence that stops it being pasted into
              a group chat. */}
          Anyone with this link can set their password. Treat it like a password, and
          send it privately. <strong>You will not be able to see it again.</strong>
        </p>
        <code className="block w-full overflow-x-auto rounded-[var(--admin-radius-control)] border border-[var(--admin-border-form)] bg-[var(--admin-surface-input)] px-2.5 py-2 font-mono text-xs text-[var(--admin-body)]">
          {link}
        </code>
        <div>
          <button
            type="button"
            onClick={copy}
            className="inline-flex min-h-9 items-center gap-1.5 rounded-[var(--admin-radius-control)] border border-[var(--admin-border-form)] bg-transparent px-3 text-xs font-semibold text-[var(--admin-body)] outline-none transition-colors hover:bg-[var(--admin-panel-muted)] focus-visible:ring-[3px] focus-visible:ring-[var(--admin-focus)] focus-visible:ring-offset-2 focus-visible:ring-offset-[var(--admin-panel)]"
          >
            {copied ? (
              <CheckCircle className="size-3.5" aria-hidden="true" />
            ) : (
              <Copy className="size-3.5" aria-hidden="true" />
            )}
            {copied ? "Copied" : "Copy link"}
          </button>
          {/* Announced separately so the state change reaches a screen reader, which
              would otherwise miss the label swap inside the button. */}
          <span aria-live="polite" className="sr-only">
            {copied ? "Link copied to clipboard." : ""}
          </span>
        </div>
        {copyFailed ? (
          <p
            role="alert"
            className="text-xs font-medium leading-5 text-[var(--admin-status-cancelled-text)]"
          >
            Your browser blocked the copy. Select the link above and copy it
            yourself — ⛔ don&apos;t close this until you have it.
          </p>
        ) : null}
      </div>

      <div className="mt-1 flex justify-end">
        <button
          type="button"
          onClick={onDone}
          className="inline-flex min-h-10 items-center justify-center rounded-[var(--admin-radius-control)] bg-[var(--admin-primary)] px-4 text-sm font-semibold text-[var(--admin-on-primary)] outline-none transition-colors hover:bg-[var(--admin-primary-hover)] focus-visible:ring-[3px] focus-visible:ring-[var(--admin-focus)] focus-visible:ring-offset-2 focus-visible:ring-offset-[var(--admin-panel)]"
        >
          Done
        </button>
      </div>
    </div>
  );
}
