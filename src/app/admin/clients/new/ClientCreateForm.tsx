"use client";

import {
  forwardRef,
  useActionState,
  useEffect,
  useId,
  useRef,
  useState,
} from "react";
import Link from "next/link";
import {
  ChevronDown,
  Loader2,
  RotateCcw,
  Save,
  XCircle,
} from "lucide-react";
import { cn } from "@/lib/utils";
import { AdminPanel } from "../../components/admin-ui";
import { DuplicateWarningBanner } from "../components/DuplicateWarningBanner";
import { createClient, type ClientActionState } from "../actions";

const initialState: ClientActionState = {};

const CANCELLED_TEXT = "text-[var(--admin-status-cancelled-text)]";
const CANCELLED_BORDER = "border-[var(--admin-status-cancelled-text)]";
const CANCELLED_BG_SOFT = "bg-[var(--admin-status-cancelled-bg)]";

const NOTES_MAX = 2000;

const inputBase =
  "flex h-11 w-full rounded-[var(--admin-radius-control)] border bg-[var(--admin-surface-input)] px-3 py-2 text-sm text-[var(--admin-body)] outline-none transition-colors duration-[var(--motion-duration-fast)] ease-gentle placeholder:text-[var(--admin-text-muted)] focus-visible:border-[var(--admin-focus)] focus-visible:ring-2 focus-visible:ring-[var(--admin-focus)]/30 disabled:opacity-50";

const SOURCE_OPTIONS: Array<{ value: string; label: string }> = [
  { value: "website", label: "Website" },
  { value: "phone", label: "Phone" },
  { value: "whatsapp", label: "WhatsApp" },
  { value: "instagram", label: "Instagram" },
  { value: "referral", label: "Referral" },
  { value: "manual", label: "Manual" },
  { value: "other", label: "Other" },
];

const EMAIL_RE = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
const POSTCODE_RE = /^[A-Z]{1,2}\d[A-Z\d]?\s*\d[A-Z]{2}$/i;

function preValidate(form: HTMLFormElement): Record<string, string> | null {
  const get = (name: string) =>
    (
      form.querySelector<HTMLInputElement>(`[name="${name}"]`)?.value ?? ""
    ).trim();
  const errors: Record<string, string> = {};
  const email = get("email");
  const phone = get("phone");
  const postcode = get("postcode");
  if (email && !EMAIL_RE.test(email)) {
    errors.email = "Email needs an @ symbol (for example, sara@example.com).";
  }
  if (phone) {
    const digits = phone.replace(/\D/g, "");
    if (digits.length < 7) {
      errors.phone = "Phone number is too short. Include the area code.";
    }
  }
  if (postcode && !POSTCODE_RE.test(postcode)) {
    errors.postcode =
      "Postcode doesn't look right. Try the format LU1 1AA.";
  }
  return Object.keys(errors).length ? errors : null;
}

export function ClientCreateForm() {
  const [state, action, pending] = useActionState(createClient, initialState);
  const [source, setSource] = useState<string>("");
  const [confirmDuplicate, setConfirmDuplicate] = useState<boolean>(false);
  const [clientErrors, setClientErrors] = useState<Record<string, string>>({});
  const [noteCount, setNoteCount] = useState<number>(0);
  const formRef = useRef<HTMLFormElement | null>(null);
  const dialogRef = useRef<HTMLDialogElement | null>(null);
  const bypassNoContactRef = useRef<boolean>(false);
  const liveRegionRef = useRef<HTMLDivElement | null>(null);

  // reset checkbox when duplicate state changes
  useEffect(() => {
    // eslint-disable-next-line react-hooks/set-state-in-effect
    setConfirmDuplicate(false);
  }, [state.duplicateWarning]);

  // clear client-side pre-validation errors whenever the server state changes
  useEffect(() => {
    // eslint-disable-next-line react-hooks/set-state-in-effect
    setClientErrors({});
  }, [state]);

  // focus + scroll first invalid field on any new error set
  const errorKeys = state.fieldErrors
    ? Object.keys(state.fieldErrors).join(",")
    : Object.keys(clientErrors).join(",");
  useEffect(() => {
    const errors = state.fieldErrors ?? clientErrors;
    if (!errors || Object.keys(errors).length === 0 || !formRef.current) return;
    const firstKey = Object.keys(errors)[0];
    const target = formRef.current.querySelector<HTMLElement>(
      `[name="${firstKey}"]`
    );
    if (!target) return;
    target.focus();
    target.scrollIntoView({ block: "center", behavior: "smooth" });
  }, [errorKeys, state.fieldErrors, clientErrors]);

  // announce submission status to assistive tech
  useEffect(() => {
    if (!liveRegionRef.current) return;
    if (pending) {
      liveRegionRef.current.textContent = "Saving client…";
    } else if (state.error) {
      liveRegionRef.current.textContent = "Couldn't save client.";
    } else {
      liveRegionRef.current.textContent = "";
    }
  }, [pending, state.error]);

  // desktop-only autofocus on first field
  useEffect(() => {
    if (typeof window === "undefined") return;
    if (!window.matchMedia("(pointer: fine)").matches) return;
    formRef.current
      ?.querySelector<HTMLInputElement>('[name="full_name"]')
      ?.focus();
  }, []);

  const duplicateBlocked = Boolean(state.duplicateWarning) && !confirmDuplicate;
  const submitDisabled = pending || duplicateBlocked;

  const sourceHelper =
    source === "referral"
      ? "Who referred them?"
      : source === "other"
        ? "Where did they find out about us?"
        : null;

  const fieldErrors: Record<string, string> = {
    ...clientErrors,
    ...(state.fieldErrors ?? {}),
  };

  function handleSubmit(event: React.FormEvent<HTMLFormElement>) {
    const form = event.currentTarget;

    if (bypassNoContactRef.current) {
      bypassNoContactRef.current = false;
      const preErrors = preValidate(form);
      if (preErrors) {
        event.preventDefault();
        setClientErrors(preErrors);
      }
      return;
    }

    // client-side format pre-validation (courtesy; server remains truth)
    const preErrors = preValidate(form);
    if (preErrors) {
      event.preventDefault();
      setClientErrors(preErrors);
      return;
    }

    // soft no-contact-channel warning (brief §10 Q2)
    const emailVal = (
      form.querySelector<HTMLInputElement>('[name="email"]')?.value ?? ""
    ).trim();
    const phoneVal = (
      form.querySelector<HTMLInputElement>('[name="phone"]')?.value ?? ""
    ).trim();
    if (!emailVal && !phoneVal && !state.duplicateWarning) {
      event.preventDefault();
      dialogRef.current?.showModal();
    }
  }

  function confirmNoContactSave() {
    dialogRef.current?.close();
    bypassNoContactRef.current = true;
    // requestSubmit on next tick so the close() animation/focus settles
    setTimeout(() => formRef.current?.requestSubmit(), 0);
  }

  function dismissNoContactDialog() {
    dialogRef.current?.close();
    setTimeout(
      () =>
        formRef.current
          ?.querySelector<HTMLInputElement>('[name="email"]')
          ?.focus(),
      0
    );
  }

  function retrySubmit() {
    setClientErrors({});
    formRef.current?.requestSubmit();
  }

  return (
    <>
      <div
        ref={liveRegionRef}
        role="status"
        aria-live="polite"
        aria-atomic="true"
        className="sr-only"
      />

      <NoContactDialog
        ref={dialogRef}
        onConfirm={confirmNoContactSave}
        onDismiss={dismissNoContactDialog}
      />

      <form
        ref={formRef}
        action={action}
        onSubmit={handleSubmit}
        aria-busy={pending || undefined}
        className="grid gap-5 pb-32 md:pb-0"
      >
        <p>
          <span
            className={cn(
              "inline-flex items-center gap-1 rounded-full px-2.5 py-0.5 text-xs font-medium",
              CANCELLED_BG_SOFT,
              CANCELLED_TEXT
            )}
          >
            <span aria-hidden="true" className="font-semibold">
              *
            </span>
            means required
          </span>
        </p>

        {state.duplicateWarning ? (
          <DuplicateWarningBanner
            message={state.duplicateWarning}
            checked={confirmDuplicate}
            onCheckedChange={setConfirmDuplicate}
          />
        ) : null}

        {state.error ? (
          <FormErrorBanner message={state.error} onRetry={retrySubmit} />
        ) : null}

        <AdminPanel
          title="Who they are"
          description="Their name and how this profile reached you."
          className="rahma-fade-up"
        >
          <div className="grid gap-4 md:grid-cols-2">
            <FormField
              name="full_name"
              label="Full name"
              required
              placeholder="As they'd like it on their record"
              error={fieldErrors.full_name}
              autoComplete="name"
            />
            <FormField
              name="client_source"
              label="Source"
              required
              helper="Where did this client come from?"
              error={fieldErrors.client_source}
            >
              {(controlProps) => (
                <div className="relative">
                  <select
                    {...controlProps}
                    defaultValue=""
                    onChange={(event) =>
                      setSource(event.currentTarget.value)
                    }
                    className={cn(
                      controlProps.className,
                      "appearance-none pr-9"
                    )}
                  >
                    <option value="" disabled>
                      Pick a source
                    </option>
                    {SOURCE_OPTIONS.map((opt) => (
                      <option key={opt.value} value={opt.value}>
                        {opt.label}
                      </option>
                    ))}
                  </select>
                  <ChevronDown
                    aria-hidden="true"
                    className="pointer-events-none absolute right-3 top-1/2 size-4 -translate-y-1/2 text-[var(--admin-text-muted)]"
                  />
                </div>
              )}
            </FormField>
            <div className="md:col-span-2">
              <FormField
                name="source_detail"
                label="Source detail"
                optional
                placeholder="Referral name, campaign, or admin context"
                helper={sourceHelper ?? undefined}
                error={fieldErrors.source_detail}
              />
            </div>
          </div>
        </AdminPanel>

        <AdminPanel
          title="How to reach them"
          description="At least one of email or phone helps confirmations land."
          className="rahma-fade-up"
        >
          <div className="grid gap-4 md:grid-cols-2">
            <FormField
              name="email"
              type="email"
              label="Email"
              optional
              placeholder="sara@example.com"
              helper="Used for confirmations and reminders."
              error={fieldErrors.email}
              autoComplete="email"
            />
            <FormField
              name="phone"
              type="tel"
              label="Phone"
              optional
              placeholder="07…"
              helper="Used for WhatsApp and SMS."
              error={fieldErrors.phone}
              autoComplete="tel"
            />
          </div>

          <div className="mt-5 grid gap-4 border-t border-[var(--admin-border)] pt-5">
            <p className="text-xs font-semibold uppercase tracking-[0.06em] text-[var(--admin-text-muted)]">
              Address
            </p>
            <div className="grid gap-4 md:grid-cols-2">
              <div className="md:col-span-2">
                <FormField
                  name="address"
                  label="Address"
                  optional
                  placeholder="Street name and number, building or flat"
                  error={fieldErrors.address}
                  autoComplete="street-address"
                />
              </div>
              <FormField
                name="postcode"
                label="Postcode"
                optional
                placeholder="LU1 1AA"
                error={fieldErrors.postcode}
                autoComplete="postal-code"
                controlClassName="max-w-[220px]"
              />
              <FormField
                name="city"
                label="City"
                optional
                placeholder="Luton"
                helper="Used to check service coverage for future bookings."
                error={fieldErrors.city}
                autoComplete="address-level2"
              />
              <div className="md:col-span-2">
                <FormField
                  name="area"
                  label="Area"
                  optional
                  placeholder="e.g. Bury Park"
                  helper="Helps the therapist navigate."
                  error={fieldErrors.area}
                />
              </div>
            </div>
          </div>
        </AdminPanel>

        <AdminPanel
          title="Internal notes"
          description="Visible to admin staff only. Don't include sensitive health information here; the client detail page has a dedicated health-notes surface."
          className="rahma-fade-up"
        >
          <textarea
            id="client-notes"
            name="notes"
            rows={5}
            maxLength={NOTES_MAX}
            aria-label="Internal client notes"
            placeholder="Anything admin staff should know. Avoid clinical health context here."
            onChange={(event) => setNoteCount(event.currentTarget.value.length)}
            className="block w-full resize-y rounded-[var(--admin-radius-control)] border border-[var(--admin-border-form)] bg-[var(--admin-surface-input)] px-3 py-2 font-sans text-sm leading-6 text-[var(--admin-body)] outline-none transition-colors duration-[var(--motion-duration-fast)] ease-gentle placeholder:text-[var(--admin-text-muted)] focus-visible:border-[var(--admin-focus)] focus-visible:ring-2 focus-visible:ring-[var(--admin-focus)]/30"
          />
          <p className="mt-1.5 text-right text-xs tabular-nums text-[var(--admin-text-muted)]">
            {noteCount} / {NOTES_MAX}
          </p>
        </AdminPanel>

        <StickySaveBar pending={pending} submitDisabled={submitDisabled} />
      </form>
    </>
  );
}

function StickySaveBar({
  pending,
  submitDisabled,
}: {
  pending: boolean;
  submitDisabled: boolean;
}) {
  return (
    <div
      className="sticky bottom-14 z-30 -mx-4 mt-2 border-t border-[var(--admin-border)] bg-[var(--admin-panel)] px-4 pb-[max(env(safe-area-inset-bottom),0.75rem)] pt-3 md:static md:bottom-auto md:mx-0 md:border-0 md:bg-transparent md:px-0 md:pb-0"
    >
      <div className="flex flex-col gap-2 md:ml-auto md:flex-row md:items-center md:gap-3 md:w-fit">
        <Link
          href="/admin/clients"
          className="inline-flex h-12 w-full items-center justify-center rounded-[var(--admin-radius-control)] border border-[var(--admin-border-form)] bg-transparent px-5 text-sm font-semibold text-[var(--admin-body)] outline-none transition-colors duration-[var(--motion-duration-fast)] ease-gentle hover:bg-[var(--admin-panel-muted)] focus-visible:ring-2 focus-visible:ring-[var(--admin-focus)]/55 md:h-10 md:w-auto"
        >
          Cancel
        </Link>
        <button
          type="submit"
          disabled={submitDisabled}
          aria-busy={pending || undefined}
          className="inline-flex h-12 w-full items-center justify-center gap-2 rounded-[var(--admin-radius-control)] bg-[var(--admin-primary)] px-5 text-sm font-semibold text-[var(--admin-on-primary)] outline-none transition-[background-color,transform] duration-[var(--motion-duration-fast)] ease-gentle hover:bg-[var(--admin-primary-hover)] focus-visible:ring-2 focus-visible:ring-[var(--admin-focus)]/55 active:scale-[0.98] disabled:cursor-not-allowed disabled:opacity-40 disabled:hover:bg-[var(--admin-primary)] disabled:active:scale-100 md:h-10 md:w-auto"
        >
          {pending ? (
            <Loader2 className="size-4 shrink-0 animate-spin" aria-hidden="true" />
          ) : (
            <Save className="size-4 shrink-0" aria-hidden="true" />
          )}
          Create client
        </button>
      </div>
      <p className="mt-2 hidden text-right text-xs text-[var(--admin-text-muted)] md:block">
        We&apos;ll redirect you to the new client&apos;s profile after save.
      </p>
    </div>
  );
}

function FormErrorBanner({
  message,
  onRetry,
}: {
  message: string;
  onRetry: () => void;
}) {
  return (
    <div
      role="alert"
      aria-live="polite"
      aria-atomic="true"
      className={cn(
        "rahma-pop-in rounded-[var(--admin-radius-card)] border px-4 py-3 text-sm",
        CANCELLED_BORDER,
        CANCELLED_BG_SOFT,
        CANCELLED_TEXT
      )}
    >
      <div className="flex items-start gap-2.5">
        <XCircle className="mt-0.5 size-4 shrink-0" aria-hidden="true" />
        <div className="min-w-0 flex-1">
          <p className="leading-6">Couldn&apos;t create client. {message}</p>
          <button
            type="button"
            onClick={onRetry}
            className={cn(
              "mt-2 inline-flex h-9 items-center gap-1.5 rounded-[var(--admin-radius-control)] border bg-transparent px-3 text-sm font-medium outline-none transition-colors duration-[var(--motion-duration-fast)] ease-gentle hover:bg-[var(--admin-status-cancelled-bg)] focus-visible:ring-2 focus-visible:ring-[var(--admin-focus)]/55",
              CANCELLED_BORDER,
              CANCELLED_TEXT
            )}
          >
            <RotateCcw className="size-3.5" aria-hidden="true" />
            Try again
          </button>
        </div>
      </div>
    </div>
  );
}

const NoContactDialog = forwardRef<
  HTMLDialogElement,
  { onConfirm: () => void; onDismiss: () => void }
>(function NoContactDialog({ onConfirm, onDismiss }, ref) {
  return (
    <dialog
      ref={ref}
      aria-labelledby="no-contact-heading"
      className="m-auto rounded-[var(--admin-radius-card)] border border-[var(--admin-border)] bg-[var(--admin-panel)] p-0 text-[var(--admin-body)] shadow-[var(--admin-shadow-overlay)] backdrop:bg-[oklch(11%_0.014_155_/_0.45)]"
    >
      <div className="w-[min(28rem,calc(100vw-2rem))] p-6">
        <h2
          id="no-contact-heading"
          className="font-display text-lg font-semibold text-[var(--admin-heading)]"
        >
          No contact details yet
        </h2>
        <p className="mt-2 text-sm leading-6 text-[var(--admin-text-muted)]">
          They won&apos;t receive confirmation or reminder emails. You can still
          add details later.
        </p>
        <div className="mt-5 flex flex-col gap-2 md:flex-row md:justify-end md:gap-3">
          <button
            type="button"
            onClick={onDismiss}
            className="inline-flex h-10 w-full items-center justify-center rounded-[var(--admin-radius-control)] border border-[var(--admin-border-form)] bg-transparent px-4 text-sm font-semibold text-[var(--admin-body)] outline-none transition-colors duration-[var(--motion-duration-fast)] ease-gentle hover:bg-[var(--admin-panel-muted)] focus-visible:ring-2 focus-visible:ring-[var(--admin-focus)]/55 md:order-1 md:w-auto"
          >
            Add contact details
          </button>
          <button
            type="button"
            onClick={onConfirm}
            className="inline-flex h-10 w-full items-center justify-center rounded-[var(--admin-radius-control)] bg-[var(--admin-primary)] px-4 text-sm font-semibold text-[var(--admin-on-primary)] outline-none transition-[background-color,transform] duration-[var(--motion-duration-fast)] ease-gentle hover:bg-[var(--admin-primary-hover)] focus-visible:ring-2 focus-visible:ring-[var(--admin-focus)]/55 active:scale-[0.98] md:order-2 md:w-auto"
          >
            Save anyway
          </button>
        </div>
      </div>
    </dialog>
  );
});

interface FormFieldProps {
  name: string;
  label: string;
  required?: boolean;
  optional?: boolean;
  type?: string;
  placeholder?: string;
  helper?: string;
  error?: string;
  autoComplete?: string;
  controlClassName?: string;
  children?: (props: {
    id: string;
    name: string;
    required?: boolean;
    "aria-required": "true" | undefined;
    "aria-invalid": "true" | undefined;
    "aria-describedby": string | undefined;
    className: string;
  }) => React.ReactNode;
}

function FormField({
  name,
  label,
  required,
  optional,
  type = "text",
  placeholder,
  helper,
  error,
  autoComplete,
  controlClassName,
  children,
}: FormFieldProps) {
  const fieldId = useId();
  const helperId = `${fieldId}-helper`;
  const errorId = `${fieldId}-error`;
  const describedBy =
    [error ? errorId : null, helper ? helperId : null]
      .filter(Boolean)
      .join(" ") || undefined;

  const controlProps = {
    id: fieldId,
    name,
    required,
    "aria-required": required ? ("true" as const) : undefined,
    "aria-invalid": error ? ("true" as const) : undefined,
    "aria-describedby": describedBy,
    className: cn(
      inputBase,
      error ? CANCELLED_BORDER : "border-[var(--admin-border-form)]",
      controlClassName
    ),
  };

  return (
    <div className="grid gap-1.5">
      <label
        htmlFor={fieldId}
        className="flex items-baseline gap-1 text-sm font-medium text-[var(--admin-heading)]"
      >
        <span>{label}</span>
        {required ? (
          <span aria-hidden="true" className={cn("font-semibold", CANCELLED_TEXT)}>
            *
          </span>
        ) : null}
        {optional ? (
          <span className="text-xs font-normal text-[var(--admin-text-muted)]">
            (optional)
          </span>
        ) : null}
      </label>

      {children ? (
        children(controlProps)
      ) : (
        <input
          {...controlProps}
          type={type}
          placeholder={placeholder}
          autoComplete={autoComplete}
        />
      )}

      {helper ? (
        <p id={helperId} className="text-xs text-[var(--admin-text-muted)]">
          {helper}
        </p>
      ) : null}

      {error ? (
        <p
          id={errorId}
          role="alert"
          aria-live="polite"
          aria-atomic="true"
          className={cn("text-xs", CANCELLED_TEXT)}
        >
          {error}
        </p>
      ) : null}
    </div>
  );
}
