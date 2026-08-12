"use client";

import { useActionState, useEffect, useId, useRef, useState } from "react";
import { useRouter } from "next/navigation";
import { Dialog as BaseDialog } from "@base-ui/react/dialog";
import { Loader2, Plus, X, XCircle } from "lucide-react";
import { toast } from "sonner";
import { BookingActionButton } from "./BookingActionButton";
import {
  addClientNote,
  type ClientActionState,
} from "../clients/actions";

const initialState: ClientActionState = {};

interface SessionNotePromptSheetProps {
  assignmentId: string;
  clientId: string;
  clientName: string;
  /**
   * Whether the "Mark complete" trigger should be rendered. The dialog itself
   * stays mounted whenever the sheet renders, so the prompt survives the
   * server refresh that follows a successful mark-complete (when the
   * assignment status flips and `isActionable` drops to false).
   */
  showButton: boolean;
}

export function SessionNotePromptSheet({
  assignmentId,
  clientId,
  clientName,
  showButton,
}: SessionNotePromptSheetProps) {
  const router = useRouter();
  const [open, setOpen] = useState(false);
  const [state, action, pending] = useActionState(addClientNote, initialState);
  const textareaRef = useRef<HTMLTextAreaElement | null>(null);
  const noteId = useId();
  const errorId = `${noteId}-error`;
  const fieldErrorId = `${noteId}-field-error`;

  useEffect(() => {
    if (state.success) {
      // eslint-disable-next-line react-hooks/set-state-in-effect
      setOpen(false);
      toast.success("Session note saved.");
      router.refresh();
    }
  }, [router, state.success]);

  useEffect(() => {
    if (open) {
      requestAnimationFrame(() => textareaRef.current?.focus());
    }
  }, [open]);

  return (
    <>
      {showButton ? (
        <BookingActionButton
          assignmentId={assignmentId}
          action="assignment_completed"
          variant="ghost"
          onSuccess={() => setOpen(true)}
        >
          Mark complete
        </BookingActionButton>
      ) : null}

      <BaseDialog.Root open={open} onOpenChange={setOpen}>
        <BaseDialog.Portal>
          <BaseDialog.Backdrop className="fixed inset-0 z-50 bg-[oklch(12%_0.01_165)]/35 backdrop-blur-sm" />
          <BaseDialog.Popup className="fixed left-1/2 top-[18vh] z-50 w-[min(calc(100vw-2rem),32rem)] -translate-x-1/2 rounded-[var(--admin-radius-card)] border border-[var(--admin-border)] bg-[var(--admin-panel)] p-5 shadow-[var(--admin-shadow-overlay)] outline-none">
            <div className="flex items-start justify-between gap-3">
              <div className="min-w-0">
                <BaseDialog.Title className="text-base font-semibold text-[var(--admin-heading)]">
                  Add a session note for {clientName}?
                </BaseDialog.Title>
                <BaseDialog.Description className="mt-1.5 text-sm leading-6 text-[var(--admin-text-muted)]">
                  Optional. Saved on the client&rsquo;s record for the team.
                </BaseDialog.Description>
              </div>
              <BaseDialog.Close className="inline-flex size-9 shrink-0 items-center justify-center rounded-[var(--admin-radius-control)] text-[var(--admin-text-muted)] outline-none transition-colors hover:bg-[var(--admin-panel-muted)] hover:text-[var(--admin-heading)] focus-visible:ring-2 focus-visible:ring-[var(--admin-focus)]/55">
                <X className="size-4" aria-hidden="true" />
                <span className="sr-only">Close</span>
              </BaseDialog.Close>
            </div>

            <form action={action} className="mt-4 grid gap-3">
              <input type="hidden" name="client_id" value={clientId} />
              {state.error ? (
                <div
                  id={errorId}
                  role="alert"
                  aria-live="polite"
                  aria-atomic="true"
                  className="flex items-start gap-2 rounded-[var(--admin-radius-control)] bg-[var(--admin-status-cancelled-bg)] px-3 py-2 text-sm text-[var(--admin-status-cancelled-text)]"
                >
                  <XCircle className="mt-0.5 size-4 shrink-0" aria-hidden="true" />
                  <span>{state.error}</span>
                </div>
              ) : null}
              <label
                htmlFor={noteId}
                className="text-sm font-medium text-[var(--admin-heading)]"
              >
                Note
                <span aria-hidden="true" className="ml-0.5 text-[var(--admin-status-cancelled-text)]">
                  *
                </span>
              </label>
              <textarea
                ref={textareaRef}
                id={noteId}
                name="note"
                rows={4}
                required
                placeholder="What happened in this session?"
                aria-describedby={
                  state.fieldErrors?.note
                    ? fieldErrorId
                    : state.error
                      ? errorId
                      : undefined
                }
                aria-invalid={state.fieldErrors?.note ? "true" : undefined}
                className={
                  state.fieldErrors?.note
                    ? "min-h-[6rem] w-full rounded-[var(--admin-radius-control)] border border-[oklch(26%_0.14_25)] bg-[var(--admin-surface-input)] px-3 py-2 text-sm leading-6 text-[var(--admin-body)] outline-none placeholder:text-[var(--admin-text-muted)] focus-visible:border-[var(--admin-focus)] focus-visible:ring-2 focus-visible:ring-[var(--admin-focus)]/30"
                    : "min-h-[6rem] w-full rounded-[var(--admin-radius-control)] border border-[var(--admin-border-form)] bg-[var(--admin-surface-input)] px-3 py-2 text-sm leading-6 text-[var(--admin-body)] outline-none placeholder:text-[var(--admin-text-muted)] focus-visible:border-[var(--admin-focus)] focus-visible:ring-2 focus-visible:ring-[var(--admin-focus)]/30"
                }
              />
              {state.fieldErrors?.note ? (
                <div
                  id={fieldErrorId}
                  role="alert"
                  aria-live="polite"
                  aria-atomic="true"
                  className="text-sm text-[var(--admin-status-cancelled-text)]"
                >
                  {state.fieldErrors.note}
                </div>
              ) : null}
              <div className="mt-1 flex flex-wrap-reverse justify-end gap-2">
                <BaseDialog.Close
                  disabled={pending}
                  render={
                    <button
                      type="button"
                      disabled={pending}
                      className="inline-flex min-h-10 items-center rounded-[var(--admin-radius-control)] border border-[var(--admin-border-form)] bg-transparent px-4 text-sm font-semibold text-[var(--admin-body)] outline-none transition-colors hover:bg-[var(--admin-panel-muted)] focus-visible:ring-2 focus-visible:ring-[var(--admin-focus)]/55 disabled:opacity-50 disabled:pointer-events-none"
                    >
                      Skip
                    </button>
                  }
                />
                <button
                  type="submit"
                  aria-busy={pending || undefined}
                  disabled={pending}
                  className="inline-flex min-h-10 items-center gap-2 rounded-[var(--admin-radius-control)] bg-[var(--admin-primary)] px-4 text-sm font-semibold text-[var(--admin-on-primary)] outline-none transition-colors hover:bg-[var(--admin-primary-hover)] focus-visible:ring-2 focus-visible:ring-[var(--admin-focus)]/55 disabled:opacity-60 disabled:pointer-events-none"
                >
                  {pending ? (
                    <Loader2 className="size-4 shrink-0 animate-spin" aria-hidden="true" />
                  ) : (
                    <Plus className="size-4 shrink-0" aria-hidden="true" />
                  )}
                  Save note
                </button>
              </div>
            </form>
          </BaseDialog.Popup>
        </BaseDialog.Portal>
      </BaseDialog.Root>
    </>
  );
}
