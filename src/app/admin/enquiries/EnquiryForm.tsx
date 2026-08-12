"use client";

import { useActionState, useEffect, useId, useRef, useState } from "react";
import { useRouter } from "next/navigation";
import { Loader2, Minus, Plus, XCircle } from "lucide-react";
import { toast } from "sonner";
import { cn } from "@/lib/utils";
import { createEnquiry, type EnquiryActionState } from "./actions";

interface StaffOption {
  id: string;
  name: string;
}

export function EnquiryIntakePanel({ staff }: { staff: StaffOption[] }) {
  const [open, setOpen] = useState(false);

  return (
    <>
      <div className="lg:hidden">
        <button
          type="button"
          aria-expanded={open}
          aria-controls="enquiry-intake-panel"
          onClick={() => setOpen((current) => !current)}
          className="inline-flex w-full min-h-11 items-center justify-between gap-2 rounded-[var(--admin-radius-card)] border border-[var(--admin-border)] bg-[var(--admin-panel)] px-4 text-sm font-semibold text-[var(--admin-heading)] outline-none transition-colors hover:bg-[var(--admin-panel-muted)] focus-visible:ring-2 focus-visible:ring-[var(--admin-focus)]/55"
        >
          <span>Record new enquiry</span>
          <span
            aria-hidden="true"
            className="inline-flex size-7 items-center justify-center rounded-full bg-[var(--admin-status-confirmed-bg)] text-[var(--admin-status-confirmed-text)]"
          >
            {open ? <Minus className="size-4" /> : <Plus className="size-4" />}
          </span>
        </button>
      </div>

      <section
        id="enquiry-intake-panel"
        className={cn(
          "rounded-[var(--admin-radius-card)] border border-[var(--admin-border)] bg-[var(--admin-panel)] p-4 sm:p-5",
          open ? "block" : "hidden lg:block"
        )}
      >
        <div className="mb-4">
          <h2 className="font-display text-base font-semibold tracking-[-0.01em] text-[var(--admin-heading)]">
            Record enquiry
          </h2>
          <p className="mt-0.5 text-sm text-[var(--admin-text-muted)]">
            Capture a lead before it gets lost in your inbox.
          </p>
        </div>
        <EnquiryForm staff={staff} />
      </section>
    </>
  );
}

const initialState: EnquiryActionState = {};

const fieldClass =
  "flex h-10 w-full rounded-[var(--admin-radius-control)] border bg-[var(--admin-surface-input)] px-3 py-2 text-sm text-[var(--admin-body)] outline-none transition-colors placeholder:text-[var(--admin-text-muted)] focus-visible:border-[var(--admin-focus)] focus-visible:ring-2 focus-visible:ring-[var(--admin-focus)]/30 disabled:cursor-not-allowed disabled:opacity-50";

const fieldOk = "border-[var(--admin-border-form)]";
const fieldErr = "border-[var(--admin-status-cancelled-text)]";

export function EnquiryForm({ staff }: { staff: StaffOption[] }) {
  const router = useRouter();
  const [state, action, pending] = useActionState(createEnquiry, initialState);
  const formRef = useRef<HTMLFormElement>(null);

  useEffect(() => {
    if (state.success) {
      formRef.current?.reset();
      toast.success("Enquiry recorded.");
      router.refresh();
    }
  }, [router, state.success]);

  const fullNameId = useId();
  const sourceId = useId();
  const phoneId = useId();
  const emailId = useId();
  const serviceId = useId();
  const staffId = useId();
  const notesId = useId();
  const formErrorId = useId();

  return (
    <form
      ref={formRef}
      action={action}
      noValidate
      aria-describedby={state.error ? formErrorId : undefined}
      className="grid gap-4"
    >
      {state.error ? (
        <div
          id={formErrorId}
          role="alert"
          aria-live="polite"
          aria-atomic="true"
          className="flex items-start gap-2.5 rounded-[var(--admin-radius-control)] border border-[var(--admin-status-cancelled-border)] bg-[var(--admin-status-cancelled-bg)] px-3 py-2.5 text-sm text-[var(--admin-status-cancelled-text)]"
        >
          <XCircle className="mt-0.5 size-4 shrink-0" aria-hidden="true" />
          <span>{state.error}</span>
        </div>
      ) : null}

      <div className="grid gap-4 md:grid-cols-2 xl:grid-cols-1">
        <Field
          id={fullNameId}
          name="full_name"
          label="Full name"
          required
          placeholder="Their name as they gave it"
          error={state.fieldErrors?.full_name}
        />
        <SelectField
          id={sourceId}
          name="source"
          label="Source"
          required
          defaultValue="whatsapp"
          error={state.fieldErrors?.source}
        >
          <option value="website">Website</option>
          <option value="phone">Phone</option>
          <option value="whatsapp">WhatsApp</option>
          <option value="instagram">Instagram</option>
          <option value="referral">Referral</option>
          <option value="other">Other</option>
        </SelectField>
        <Field
          id={phoneId}
          name="phone"
          label="Phone"
          type="tel"
          placeholder="07…"
          hint="Either phone or email helps you reply."
        />
        <Field
          id={emailId}
          name="email"
          label="Email"
          type="email"
          required
          placeholder="name@example.com"
          error={state.fieldErrors?.email}
        />
        <Field
          id={serviceId}
          name="service_interest"
          label="Service interest"
          placeholder="e.g. Hijama, group booking, postnatal massage"
        />
        <SelectField
          id={staffId}
          name="assigned_staff_id"
          label="Assign to"
          defaultValue=""
          aria-label="Assign to staff member"
        >
          <option value="">Unassigned</option>
          {staff.map((member) => (
            <option key={member.id} value={member.id}>
              {member.name}
            </option>
          ))}
        </SelectField>
      </div>

      <div className="grid gap-1.5">
        <label
          htmlFor={notesId}
          className="text-sm font-medium text-[var(--admin-heading)]"
        >
          Notes
        </label>
        <textarea
          id={notesId}
          name="notes"
          rows={4}
          placeholder="What did they say? Anything useful for follow-up."
          className={cn(
            "block w-full resize-y rounded-[var(--admin-radius-control)] border bg-[var(--admin-surface-input)] px-3 py-2 text-sm leading-6 text-[var(--admin-body)] outline-none transition-colors placeholder:text-[var(--admin-text-muted)] focus-visible:border-[var(--admin-focus)] focus-visible:ring-2 focus-visible:ring-[var(--admin-focus)]/30",
            fieldOk
          )}
        />
      </div>

      <button
        type="submit"
        aria-busy={pending || undefined}
        disabled={pending}
        className="inline-flex h-11 w-full items-center justify-center gap-2 rounded-[var(--admin-radius-control)] bg-[var(--admin-primary)] px-5 text-sm font-semibold text-[var(--admin-on-primary)] outline-none transition-colors hover:bg-[var(--admin-primary-hover)] focus-visible:ring-2 focus-visible:ring-[var(--admin-focus)]/55 disabled:opacity-70 disabled:cursor-not-allowed"
      >
        {pending ? (
          <Loader2 className="size-4 shrink-0 animate-spin" aria-hidden="true" />
        ) : null}
        Record enquiry
      </button>
    </form>
  );
}

interface FieldBaseProps {
  id: string;
  name: string;
  label: string;
  required?: boolean;
  error?: string;
  hint?: string;
}

function Field({
  id,
  name,
  label,
  required,
  error,
  hint,
  type = "text",
  placeholder,
}: FieldBaseProps & {
  type?: "text" | "email" | "tel";
  placeholder?: string;
}) {
  const errorId = `${id}-error`;
  const hintId = `${id}-hint`;
  return (
    <div className="grid gap-1.5">
      <FieldLabel htmlFor={id} required={required}>
        {label}
      </FieldLabel>
      <input
        id={id}
        name={name}
        type={type}
        placeholder={placeholder}
        required={required}
        aria-invalid={error ? "true" : undefined}
        aria-describedby={cn(error ? errorId : undefined, hint ? hintId : undefined) || undefined}
        className={cn(fieldClass, error ? fieldErr : fieldOk)}
      />
      {hint && !error ? (
        <p id={hintId} className="text-xs text-[var(--admin-text-muted)]">
          {hint}
        </p>
      ) : null}
      <FieldError id={errorId}>{error}</FieldError>
    </div>
  );
}

function SelectField({
  id,
  name,
  label,
  required,
  error,
  defaultValue,
  children,
  ...rest
}: FieldBaseProps & {
  defaultValue?: string;
  children: React.ReactNode;
} & React.AriaAttributes) {
  const errorId = `${id}-error`;
  return (
    <div className="grid gap-1.5">
      <FieldLabel htmlFor={id} required={required}>
        {label}
      </FieldLabel>
      <select
        id={id}
        name={name}
        required={required}
        defaultValue={defaultValue}
        aria-invalid={error ? "true" : undefined}
        aria-describedby={error ? errorId : undefined}
        className={cn(fieldClass, "appearance-none pr-8", error ? fieldErr : fieldOk)}
        {...rest}
      >
        {children}
      </select>
      <FieldError id={errorId}>{error}</FieldError>
    </div>
  );
}

function FieldLabel({
  htmlFor,
  required,
  children,
}: {
  htmlFor: string;
  required?: boolean;
  children: React.ReactNode;
}) {
  return (
    <label htmlFor={htmlFor} className="text-sm font-medium text-[var(--admin-heading)]">
      {children}
      {required ? (
        <span aria-hidden="true" className="ml-0.5 text-[var(--admin-status-cancelled-text)]">
          *
        </span>
      ) : null}
    </label>
  );
}

function FieldError({ id, children }: { id: string; children?: React.ReactNode }) {
  if (!children) return null;
  return (
    <div
      id={id}
      role="alert"
      aria-live="polite"
      aria-atomic="true"
      className="flex items-center gap-1.5 text-xs text-[var(--admin-status-cancelled-text)]"
    >
      <XCircle className="size-3.5 shrink-0" aria-hidden="true" />
      <span>{children}</span>
    </div>
  );
}
