"use client";

import { useActionState, useEffect, useId, useRef, useState } from "react";
import { Dialog as BaseDialog } from "@base-ui/react/dialog";
import { Loader2, Send, X, XCircle } from "lucide-react";
import { toast } from "sonner";
import { cn } from "@/lib/utils";
import {
  sendTemplateManually,
  type SendTemplateManuallyResult,
} from "../../email-templates/actions";
import type { TemplateMeta } from "./templates-data";

interface ManualSendSheetProps {
  template: TemplateMeta | null;
  open: boolean;
  onOpenChange: (open: boolean) => void;
  /** When set, the Send-to input is prefilled with this address on open.
   *  Used by the "Send a test to me" CTA. */
  prefillRecipient?: string;
}

const EMAIL_PATTERN = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;

// Templates whose preview iframes pull booking data also need booking context
// when sending manually. Mirrors brief §Copy "Booking context".
const TEMPLATES_NEEDING_BOOKING_CONTEXT = new Set([
  "booking_confirmation",
  "booking_cancellation_client",
  "booking_reminder",
  "booking_plain_text",
  "staff_assignment",
  "staff_booking_change",
  "admin_booking_notification",
  "admin_booking_cancellation",
  "admin_reschedule_request",
]);

interface RuntimeFieldSpec {
  name: string;
  label: string;
  placeholder: string;
  required: boolean;
}

const CLIENT_NAME: RuntimeFieldSpec = {
  name: "client_name",
  label: "Customer name",
  placeholder: "Aisha Khan",
  required: true,
};
const BOOKING_DATE: RuntimeFieldSpec = {
  name: "booking_date",
  label: "Booking date",
  placeholder: "2026-06-12",
  required: true,
};
const BOOKING_TIME: RuntimeFieldSpec = {
  name: "booking_time",
  label: "Start time",
  placeholder: "14:30",
  required: true,
};
const THERAPIST_NAME: RuntimeFieldSpec = {
  name: "therapist_name",
  label: "Therapist name",
  placeholder: "Fatimah Hussain",
  required: true,
};
const BOOKING_ID: RuntimeFieldSpec = {
  name: "booking_id",
  label: "Booking reference",
  placeholder: "BK-2026-0042",
  required: true,
};
const CHANGE_SUMMARY: RuntimeFieldSpec = {
  name: "change_summary",
  label: "Change summary",
  placeholder: "Time changed from 14:00 to 14:30.",
  required: true,
};
const REQUESTED_DATE: RuntimeFieldSpec = {
  name: "requested_date",
  label: "Requested new date",
  placeholder: "2026-06-19",
  required: true,
};
const REQUESTED_TIME: RuntimeFieldSpec = {
  name: "requested_time",
  label: "Requested new time",
  placeholder: "14:30",
  required: true,
};

function runtimeFieldsFor(template: TemplateMeta): RuntimeFieldSpec[] {
  // Per-template required context fields per brief §Copy "Per-template context fields".
  // Each set carries exactly the variables that template.ts renders for that template.
  switch (template.id) {
    case "booking_confirmation":
    case "booking_cancellation_client":
    case "booking_reminder":
    case "booking_plain_text":
      return [CLIENT_NAME, BOOKING_DATE, BOOKING_TIME];
    case "staff_assignment":
      return [THERAPIST_NAME, CLIENT_NAME, BOOKING_DATE, BOOKING_TIME];
    case "staff_booking_change":
      return [THERAPIST_NAME, CLIENT_NAME, BOOKING_DATE, CHANGE_SUMMARY];
    case "admin_booking_notification":
      return [CLIENT_NAME, BOOKING_ID, BOOKING_DATE];
    case "admin_booking_cancellation":
      return [CLIENT_NAME, BOOKING_ID];
    case "admin_reschedule_request":
      return [CLIENT_NAME, BOOKING_ID, REQUESTED_DATE, REQUESTED_TIME];
    default:
      return [CLIENT_NAME];
  }
}

export function ManualSendSheet({
  template,
  open,
  onOpenChange,
  prefillRecipient = "",
}: ManualSendSheetProps) {
  const [recipient, setRecipient] = useState("");
  const [bookingContext, setBookingContext] = useState("");
  const [showConfirm, setShowConfirm] = useState(false);
  const [state, formAction, isPending] = useActionState<
    SendTemplateManuallyResult | null,
    FormData
  >(sendTemplateManually, null);

  const recipientRef = useRef<HTMLInputElement | null>(null);
  const formRef = useRef<HTMLFormElement | null>(null);
  const titleId = useId();
  const descId = useId();
  const errorId = useId();
  const recipientHelperId = useId();

  // Reset on open/close + on template change. Honour prefillRecipient when
  // opening (e.g. "Send a test to me" passes the operator's own email).
  useEffect(() => {
    if (open) {
      // eslint-disable-next-line react-hooks/set-state-in-effect
      setRecipient(prefillRecipient);
    } else {
      setRecipient("");
      setBookingContext("");
      setShowConfirm(false);
    }
  }, [open, template?.id, prefillRecipient]);

  // Auto-focus the Send-to input when the sheet opens (brief §11b "focus moves
  // to the `Send to` input").
  useEffect(() => {
    if (!open) return;
    const id = window.setTimeout(() => recipientRef.current?.focus(), 50);
    return () => window.clearTimeout(id);
  }, [open, template?.id]);

  useEffect(() => {
    if (state?.ok && template) {
      toast.success(`Sent "${template.cardName}" to ${recipient}.`);
      onOpenChange(false);
    } else if (state?.error) {
      toast.error(state.error, { duration: Infinity });
    }
  }, [state]); // eslint-disable-line react-hooks/exhaustive-deps

  if (!template) return null;

  const liveEmailValid = recipient === "" || EMAIL_PATTERN.test(recipient);
  const needsBookingContext = TEMPLATES_NEEDING_BOOKING_CONTEXT.has(template.id);
  const runtimeFields = runtimeFieldsFor(template);
  const isAdminInternal = template.audience === "admin_internal";

  function handleSubmitClick(e: React.MouseEvent<HTMLButtonElement>) {
    if (isAdminInternal && !showConfirm) {
      e.preventDefault();
      setShowConfirm(true);
    }
  }

  return (
    <>
      <BaseDialog.Root open={open} onOpenChange={onOpenChange}>
        <BaseDialog.Portal>
          <BaseDialog.Backdrop className="fixed inset-0 z-50 bg-[oklch(12%_0.01_165)]/35 backdrop-blur-sm data-[state=open]:animate-in data-[state=open]:fade-in data-[state=open]:duration-200 data-[state=closed]:animate-out data-[state=closed]:fade-out data-[state=closed]:duration-150 motion-reduce:!duration-0" />
          <BaseDialog.Popup
            aria-labelledby={titleId}
            aria-describedby={descId}
            className={cn(
              "fixed bottom-2 right-2 top-2 z-50 grid min-w-0 max-h-[calc(100vh-1rem)] w-[min(calc(100vw-1rem),28rem)] gap-5 overflow-x-hidden overflow-y-auto rounded-[var(--admin-radius-card)] border border-[var(--admin-border)] bg-[var(--admin-panel)] p-5 shadow-[var(--admin-shadow-overlay)] outline-none",
              "data-[state=open]:animate-in data-[state=open]:slide-in-from-right data-[state=open]:duration-[240ms] data-[state=open]:ease-out",
              "data-[state=closed]:animate-out data-[state=closed]:slide-out-to-right data-[state=closed]:duration-[180ms]",
              "motion-reduce:!duration-0"
            )}
          >
            <header className="flex items-start justify-between gap-3">
              <div className="min-w-0 flex flex-col gap-1">
                <p className="text-xs font-medium uppercase tracking-[0.05em] text-[var(--admin-text-muted)]">
                  Send template
                </p>
                <BaseDialog.Title
                  id={titleId}
                  className="m-0 font-display text-base font-semibold tracking-[-0.005em] text-[var(--admin-heading)]"
                >
                  {template.cardName}
                </BaseDialog.Title>
                <BaseDialog.Description
                  id={descId}
                  className="text-sm leading-relaxed text-[var(--admin-text-muted)]"
                >
                  {template.trigger}
                </BaseDialog.Description>
              </div>
              <BaseDialog.Close className="inline-flex size-9 shrink-0 items-center justify-center rounded-[var(--admin-radius-control)] text-[var(--admin-text-muted)] outline-none transition-colors hover:bg-[var(--admin-panel-muted)] hover:text-[var(--admin-heading)] focus-visible:ring-2 focus-visible:ring-[var(--admin-focus)]/55">
                <X className="size-4" aria-hidden="true" />
                <span className="sr-only">Close</span>
              </BaseDialog.Close>
            </header>

            {/* Preview thumbnail — brief §7 Interaction Model. Mini iframe at
                fixed compact height; sandboxed identically to the full preview. */}
            <figure
              aria-label={`${template.cardName} preview thumbnail`}
              className="m-0 overflow-hidden rounded-[var(--admin-radius-control)] border border-[var(--admin-border)] bg-white"
            >
              <iframe
                title={`${template.cardName} thumbnail`}
                src={`/admin/email-templates/preview/${template.id}`}
                sandbox="allow-same-origin"
                loading="lazy"
                style={{ pointerEvents: "none" }}
                className="block h-[160px] w-full bg-white"
                data-redesign-backend="FAKE"
              />
            </figure>

            <form
              ref={formRef}
              action={formAction}
              className="flex flex-col gap-4"
              noValidate
            >
              <input type="hidden" name="template_id" value={template.id} />

              {/* Send-to */}
              <div className="flex flex-col gap-1.5">
                <label
                  htmlFor={`${titleId}-email`}
                  className="text-xs font-medium tracking-[0.01em] text-[var(--admin-heading)]"
                >
                  Send to
                  <span aria-hidden="true" className="ml-0.5 text-[oklch(26%_0.14_25)]">
                    *
                  </span>
                </label>
                <input
                  ref={recipientRef}
                  id={`${titleId}-email`}
                  name="recipient_email"
                  type="email"
                  required
                  value={recipient}
                  onChange={(e) => setRecipient(e.target.value)}
                  placeholder="recipient@example.com"
                  aria-describedby={`${recipientHelperId}${state?.error ? ` ${errorId}` : ""}`}
                  aria-invalid={!liveEmailValid || Boolean(state?.error)}
                  className={cn(
                    "h-10 rounded-[var(--admin-radius-control)] border bg-[var(--admin-input)] px-3 text-sm text-[var(--admin-body)] outline-none transition-colors placeholder:text-[var(--admin-text-muted)] focus:border-[var(--admin-focus)] focus:ring-2 focus:ring-[var(--admin-focus)]/55",
                    liveEmailValid ? "border-[var(--admin-border-form)]" : "border-[oklch(40%_0.14_25)]"
                  )}
                />
                <p
                  id={recipientHelperId}
                  className={cn(
                    "text-xs",
                    liveEmailValid
                      ? "text-[var(--admin-text-muted)]"
                      : "text-[oklch(26%_0.14_25)]"
                  )}
                  aria-live="polite"
                >
                  {liveEmailValid
                    ? "One address per send."
                    : "That email doesn't look right. Use the format name@example.com."}
                </p>
              </div>

              {/* Booking context picker (FAKE — depends on BUILD-email-templates-actions). */}
              {needsBookingContext ? (
                <div className="flex flex-col gap-1.5">
                  <label
                    htmlFor={`${titleId}-booking`}
                    className="text-xs font-medium tracking-[0.01em] text-[var(--admin-heading)]"
                  >
                    Booking context
                  </label>
                  <select
                    id={`${titleId}-booking`}
                    name="booking_id"
                    value={bookingContext}
                    onChange={(e) => setBookingContext(e.target.value)}
                    data-redesign-backend="FAKE"
                    className="h-10 rounded-[var(--admin-radius-control)] border border-[var(--admin-border-form)] bg-[var(--admin-input)] px-3 text-sm text-[var(--admin-body)] outline-none transition-colors focus:border-[var(--admin-focus)] focus:ring-2 focus:ring-[var(--admin-focus)]/55"
                  >
                    <option value="">Pick a booking</option>
                    <option value="__dummy__">— Use dummy data (until backend ships) —</option>
                  </select>
                  <p className="text-xs text-[var(--admin-text-muted)]">
                    Real booking picker is a future feature. For now, fill the
                    template variables below to populate test data.
                  </p>
                </div>
              ) : null}

              {/* Per-template runtime fields */}
              <fieldset className="flex flex-col gap-3 rounded-[var(--admin-radius-card)] border border-dashed border-[var(--admin-border)] p-3">
                <legend className="px-1 text-xs font-medium uppercase tracking-[0.05em] text-[var(--admin-text-muted)]">
                  Template variables
                </legend>
                {runtimeFields.map((f) => (
                  <div key={f.name} className="flex flex-col gap-1">
                    <label
                      htmlFor={`${titleId}-${f.name}`}
                      className="text-xs font-medium tracking-[0.01em] text-[var(--admin-heading)]"
                    >
                      {f.label}
                      {f.required ? (
                        <span aria-hidden="true" className="ml-0.5 text-[oklch(26%_0.14_25)]">
                          *
                        </span>
                      ) : null}
                    </label>
                    <input
                      id={`${titleId}-${f.name}`}
                      name={`var:${f.name}`}
                      type="text"
                      required={f.required}
                      placeholder={f.placeholder}
                      className="h-10 rounded-[var(--admin-radius-control)] border border-[var(--admin-border-form)] bg-[var(--admin-input)] px-3 text-sm text-[var(--admin-body)] outline-none transition-colors placeholder:text-[var(--admin-text-muted)] focus:border-[var(--admin-focus)] focus:ring-2 focus:ring-[var(--admin-focus)]/55"
                    />
                  </div>
                ))}
                <p className="text-xs text-[var(--admin-text-muted)]">
                  Preview filled from the booking you picked.
                </p>
              </fieldset>

              {state?.error ? (
                <div
                  id={errorId}
                  role="alert"
                  aria-live="polite"
                  aria-atomic="true"
                  className="flex items-start gap-2 rounded-[var(--admin-radius-control)] bg-[oklch(95.5%_0.028_20)] px-3 py-2.5 text-sm text-[oklch(26%_0.14_25)]"
                >
                  <XCircle className="mt-0.5 size-4 shrink-0" aria-hidden="true" />
                  <span>{state.error}</span>
                </div>
              ) : null}

              <div className="flex items-center justify-end gap-2 border-t border-[var(--admin-border)] pt-4">
                <BaseDialog.Close
                  render={
                    <button
                      type="button"
                      className="inline-flex h-10 items-center justify-center rounded-[var(--admin-radius-control)] border border-[var(--admin-border-form)] bg-transparent px-4 text-sm font-medium text-[var(--admin-body)] outline-none transition-colors hover:bg-[var(--admin-panel-muted)] focus-visible:ring-2 focus-visible:ring-[var(--admin-focus)]/55"
                    >
                      Cancel
                    </button>
                  }
                />
                <button
                  type={isAdminInternal && !showConfirm ? "button" : "submit"}
                  onClick={isAdminInternal && !showConfirm ? handleSubmitClick : undefined}
                  disabled={isPending || !liveEmailValid || recipient === ""}
                  aria-busy={isPending || undefined}
                  className="inline-flex h-10 min-w-[120px] items-center justify-center gap-1.5 rounded-[var(--admin-radius-control)] bg-[var(--admin-primary)] px-4 text-sm font-semibold text-[var(--admin-on-primary)] outline-none transition-colors hover:bg-[var(--admin-primary-hover)] focus-visible:ring-2 focus-visible:ring-[var(--admin-focus)]/55 disabled:cursor-not-allowed disabled:opacity-60"
                >
                  {isPending ? (
                    <Loader2 className="size-4 animate-spin" aria-hidden="true" />
                  ) : (
                    <Send className="size-4" aria-hidden="true" />
                  )}
                  <span>{isPending ? "Sending…" : "Send now"}</span>
                </button>
              </div>
            </form>
          </BaseDialog.Popup>
        </BaseDialog.Portal>
      </BaseDialog.Root>

      {/* Pre-send confirm for admin-internal templates */}
      <BaseDialog.Root open={showConfirm} onOpenChange={setShowConfirm}>
        <BaseDialog.Portal>
          <BaseDialog.Backdrop className="fixed inset-0 z-[60] bg-[oklch(12%_0.01_165)]/35 backdrop-blur-sm data-[state=open]:animate-in data-[state=open]:fade-in data-[state=open]:duration-200 motion-reduce:!duration-0" />
          <BaseDialog.Popup className="fixed left-1/2 top-[30vh] z-[60] w-[min(calc(100vw-2rem),26rem)] -translate-x-1/2 rounded-[var(--admin-radius-card)] border border-[var(--admin-border)] bg-[var(--admin-panel)] p-5 shadow-[var(--admin-shadow-overlay)] outline-none data-[state=open]:animate-in data-[state=open]:fade-in data-[state=open]:zoom-in-95 data-[state=open]:duration-200 motion-reduce:!duration-0">
            <BaseDialog.Title className="text-base font-semibold text-[var(--admin-heading)]">
              Send &ldquo;{template.cardName}&rdquo; to {recipient || "this recipient"}?
            </BaseDialog.Title>
            <BaseDialog.Description className="mt-1.5 text-sm leading-6 text-[var(--admin-text-muted)]">
              This sends the email immediately. It can&apos;t be unsent.
            </BaseDialog.Description>
            <div className="mt-5 flex flex-wrap-reverse justify-end gap-2">
              <BaseDialog.Close
                render={
                  <button
                    type="button"
                    className="inline-flex min-h-10 items-center rounded-[var(--admin-radius-control)] border border-[var(--admin-border-form)] bg-transparent px-4 text-sm font-semibold text-[var(--admin-body)] outline-none transition-colors hover:bg-[var(--admin-panel-muted)] focus-visible:ring-2 focus-visible:ring-[var(--admin-focus)]/55"
                  >
                    Cancel
                  </button>
                }
              />
              <button
                type="submit"
                form=""
                onClick={(e) => {
                  e.preventDefault();
                  setShowConfirm(false);
                  // Submit the parent send form programmatically via ref —
                  // a querySelector would also match the TemplateEditForm.
                  formRef.current?.requestSubmit();
                }}
                className="inline-flex min-h-10 items-center gap-2 rounded-[var(--admin-radius-control)] bg-[var(--admin-primary)] px-4 text-sm font-semibold text-[var(--admin-on-primary)] outline-none transition-colors hover:bg-[var(--admin-primary-hover)] focus-visible:ring-2 focus-visible:ring-[var(--admin-focus)]/55"
              >
                <Send className="size-4" aria-hidden="true" />
                Send now
              </button>
            </div>
          </BaseDialog.Popup>
        </BaseDialog.Portal>
      </BaseDialog.Root>
    </>
  );
}
