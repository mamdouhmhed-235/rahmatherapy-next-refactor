"use client";

import { useActionState, useEffect, useId, useRef, useState } from "react";
import { useRouter } from "next/navigation";
import { Loader2, Plus, Printer, Save, Send, X, XCircle } from "lucide-react";
import {
  addClientNote,
  createClientPrivacyRequest,
  type ClientActionState,
} from "../actions";

const initialState: ClientActionState = {};

export function ClientDetailShortcuts({
  newBookingHref,
}: {
  newBookingHref?: string;
}) {
  const router = useRouter();
  useEffect(() => {
    const onKey = (event: KeyboardEvent) => {
      const target = event.target as HTMLElement | null;
      if (target && (target.tagName === "INPUT" || target.tagName === "TEXTAREA" || target.tagName === "SELECT" || target.isContentEditable)) {
        return;
      }
      if (event.metaKey || event.ctrlKey || event.altKey) return;
      if (event.key === "n") {
        const btn = document.querySelector<HTMLButtonElement>('button[aria-label^="Add note"]');
        if (btn) {
          event.preventDefault();
          btn.click();
        }
      } else if (event.key === "b" && newBookingHref) {
        event.preventDefault();
        router.push(newBookingHref);
      } else if (event.key === "p") {
        event.preventDefault();
        window.print();
      }
    };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [router, newBookingHref]);
  return null;
}

export function PrintRecordButton() {
  return (
    <button
      type="button"
      onClick={() => window.print()}
      title="Print client record (P)"
      aria-label="Print client record"
      className="inline-flex h-10 shrink-0 items-center gap-1.5 rounded-[var(--admin-radius-control)] border border-[var(--admin-border-form)] bg-transparent px-3 text-sm font-medium text-[var(--admin-body)] outline-none transition-colors hover:bg-[var(--admin-panel-muted)] focus-visible:ring-2 focus-visible:ring-[var(--admin-focus)]/55 print:hidden"
    >
      <Printer className="size-4" aria-hidden="true" />
      <span className="hidden sm:inline">Print</span>
    </button>
  );
}

const PRIVACY_REQUEST_OPTIONS = [
  { value: "data_export", label: "Data export", title: "Data export: packages every record we hold on this client." },
  { value: "correction", label: "Correction", title: "Correction: amend an inaccurate detail on the client's record." },
  { value: "deletion_review", label: "Deletion review", title: "Deletion review: assess whether the client's record can be deleted." },
  { value: "sensitive_note_review", label: "Sensitive note review", title: "Sensitive note review: re-examine a flagged client note." },
] as const;

export function ClientNoteForm({
  clientId,
  clientName,
  isSensitiveNote,
}: {
  clientId: string;
  clientName: string;
  isSensitiveNote: boolean;
}) {
  const router = useRouter();
  const [state, action, pending] = useActionState(addClientNote, initialState);
  const [isExpanded, setIsExpanded] = useState(false);
  const textareaRef = useRef<HTMLTextAreaElement | null>(null);
  const noteId = useId();
  const errorId = `${noteId}-error`;
  const fieldErrorId = `${noteId}-field-error`;

  useEffect(() => {
    if (state.success) {
      // eslint-disable-next-line react-hooks/set-state-in-effect
      setIsExpanded(false);
      router.refresh();
    }
  }, [router, state.success]);

  useEffect(() => {
    if (isExpanded && textareaRef.current) {
      textareaRef.current.focus();
    }
  }, [isExpanded]);

  if (!isExpanded) {
    return (
      <button
        type="button"
        onClick={() => setIsExpanded(true)}
        aria-label={`Add note for ${clientName}`}
        title="Add a note for the team"
        className="inline-flex min-h-11 items-center gap-1.5 rounded-[var(--admin-radius-control)] px-3 text-sm font-medium text-[var(--admin-body)] outline-none transition-colors hover:bg-[var(--admin-panel-muted)] hover:text-[var(--admin-heading)] focus-visible:ring-2 focus-visible:ring-[var(--admin-focus)]/55"
      >
        <Plus className="size-4" aria-hidden="true" />
        Add note
      </button>
    );
  }

  return (
    <form
      action={action}
      className="grid gap-3 motion-safe:animate-[fade-in_160ms_ease-out]"
    >
      <input type="hidden" name="client_id" value={clientId} />
      {state.error ? (
        <div
          id={errorId}
          role="alert"
          aria-live="polite"
          aria-atomic="true"
          className="flex items-start gap-2 rounded-[var(--admin-radius-control)] bg-[oklch(95.5%_0.028_20)] px-3 py-2 text-sm text-[oklch(26%_0.14_25)]"
        >
          <XCircle className="mt-0.5 size-4 shrink-0" aria-hidden="true" />
          <span>{state.error}</span>
        </div>
      ) : null}
      <div className="grid gap-1.5">
        <label
          htmlFor={noteId}
          className="text-sm font-medium text-[var(--admin-heading)]"
        >
          {isSensitiveNote ? "Sensitive note" : "Note"}
          <span aria-hidden="true" className="ml-0.5 text-[oklch(26%_0.14_25)]">
            *
          </span>
        </label>
        <textarea
          ref={textareaRef}
          id={noteId}
          name="note"
          rows={4}
          required
          placeholder="Anything the team needs to know (kept on this client's record)."
          aria-describedby={state.fieldErrors?.note ? fieldErrorId : undefined}
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
            className="flex items-center gap-1.5 text-xs text-[oklch(26%_0.14_25)]"
          >
            <XCircle className="size-3.5 shrink-0" aria-hidden="true" />
            {state.fieldErrors.note}
          </div>
        ) : null}
      </div>
      <div className="flex flex-wrap items-center gap-2">
        <button
          type="submit"
          disabled={pending}
          aria-busy={pending || undefined}
          className="inline-flex min-h-11 items-center gap-1.5 rounded-[var(--admin-radius-control)] bg-[var(--admin-primary)] px-4 text-sm font-semibold text-white outline-none transition-colors hover:bg-[var(--admin-primary-hover)] focus-visible:ring-2 focus-visible:ring-[var(--admin-focus)]/55 disabled:cursor-not-allowed disabled:opacity-60"
        >
          {pending ? (
            <Loader2 className="size-4 animate-spin" aria-hidden="true" />
          ) : (
            <Save className="size-4" aria-hidden="true" />
          )}
          Save note
        </button>
        <button
          type="button"
          onClick={() => setIsExpanded(false)}
          disabled={pending}
          className="inline-flex min-h-11 items-center gap-1.5 rounded-[var(--admin-radius-control)] px-3 text-sm font-medium text-[var(--admin-body)] outline-none transition-colors hover:bg-[var(--admin-panel-muted)] hover:text-[var(--admin-heading)] focus-visible:ring-2 focus-visible:ring-[var(--admin-focus)]/55"
        >
          <X className="size-4" aria-hidden="true" />
          Cancel
        </button>
      </div>
    </form>
  );
}

export function ClientPrivacyRequestForm({ clientId }: { clientId: string }) {
  const router = useRouter();
  const [state, action, pending] = useActionState(
    createClientPrivacyRequest,
    initialState
  );
  const formRef = useRef<HTMLFormElement | null>(null);
  const requestTypeId = useId();
  const requestNoteId = useId();
  const errorId = `${requestTypeId}-error`;
  const requestTypeErrorId = `${requestTypeId}-field-error`;

  useEffect(() => {
    if (state.success) {
      formRef.current?.reset();
      router.refresh();
    }
  }, [router, state.success]);

  return (
    <form ref={formRef} action={action} className="grid gap-3">
      <input type="hidden" name="client_id" value={clientId} />
      {state.error ? (
        <div
          id={errorId}
          role="alert"
          aria-live="polite"
          aria-atomic="true"
          className="flex items-start gap-2 rounded-[var(--admin-radius-control)] bg-[oklch(95.5%_0.028_20)] px-3 py-2 text-sm text-[oklch(26%_0.14_25)]"
        >
          <XCircle className="mt-0.5 size-4 shrink-0" aria-hidden="true" />
          <span>{state.error}</span>
        </div>
      ) : null}
      <div className="grid gap-1.5">
        <label
          htmlFor={requestTypeId}
          className="text-sm font-medium text-[var(--admin-heading)]"
        >
          Request type
          <span aria-hidden="true" className="ml-0.5 text-[oklch(26%_0.14_25)]">
            *
          </span>
        </label>
        <select
          id={requestTypeId}
          name="request_type"
          required
          defaultValue="data_export"
          aria-describedby={
            state.fieldErrors?.request_type ? requestTypeErrorId : undefined
          }
          aria-invalid={state.fieldErrors?.request_type ? "true" : undefined}
          className={
            state.fieldErrors?.request_type
              ? "h-10 w-full rounded-[var(--admin-radius-control)] border border-[oklch(26%_0.14_25)] bg-[var(--admin-surface-input)] px-3 text-sm text-[var(--admin-body)] outline-none focus-visible:border-[var(--admin-focus)] focus-visible:ring-2 focus-visible:ring-[var(--admin-focus)]/30"
              : "h-10 w-full rounded-[var(--admin-radius-control)] border border-[var(--admin-border-form)] bg-[var(--admin-surface-input)] px-3 text-sm text-[var(--admin-body)] outline-none focus-visible:border-[var(--admin-focus)] focus-visible:ring-2 focus-visible:ring-[var(--admin-focus)]/30"
          }
        >
          {PRIVACY_REQUEST_OPTIONS.map((option) => (
            <option key={option.value} value={option.value} title={option.title}>
              {option.label}
            </option>
          ))}
        </select>
        {state.fieldErrors?.request_type ? (
          <div
            id={requestTypeErrorId}
            role="alert"
            aria-live="polite"
            aria-atomic="true"
            className="flex items-center gap-1.5 text-xs text-[oklch(26%_0.14_25)]"
          >
            <XCircle className="size-3.5 shrink-0" aria-hidden="true" />
            {state.fieldErrors.request_type}
          </div>
        ) : null}
      </div>
      <div className="grid gap-1.5">
        <label
          htmlFor={requestNoteId}
          className="text-sm font-medium text-[var(--admin-heading)]"
        >
          Note (optional)
        </label>
        <textarea
          id={requestNoteId}
          name="request_note"
          rows={3}
          placeholder="Anything the reviewer should know."
          className="min-h-[4.5rem] w-full rounded-[var(--admin-radius-control)] border border-[var(--admin-border-form)] bg-[var(--admin-surface-input)] px-3 py-2 text-sm leading-6 text-[var(--admin-body)] outline-none placeholder:text-[var(--admin-text-muted)] focus-visible:border-[var(--admin-focus)] focus-visible:ring-2 focus-visible:ring-[var(--admin-focus)]/30"
        />
      </div>
      <div>
        <button
          type="submit"
          disabled={pending}
          aria-busy={pending || undefined}
          className="inline-flex min-h-11 items-center gap-1.5 rounded-[var(--admin-radius-control)] border border-[var(--admin-border-form)] bg-transparent px-4 text-sm font-semibold text-[var(--admin-body)] outline-none transition-colors hover:bg-[var(--admin-panel-muted)] focus-visible:ring-2 focus-visible:ring-[var(--admin-focus)]/55 disabled:cursor-not-allowed disabled:opacity-60"
        >
          {pending ? (
            <Loader2 className="size-4 animate-spin" aria-hidden="true" />
          ) : (
            <Send className="size-4" aria-hidden="true" />
          )}
          Submit request
        </button>
      </div>
    </form>
  );
}
