"use client";

import { useActionState, useId, useState } from "react";
import Link from "next/link";
import { ChevronDown, Loader2, Save, XCircle } from "lucide-react";
import { cn } from "@/lib/utils";
import { AdminPanel } from "../../../components/admin-ui";
import { updateClient, type ClientActionState } from "../../actions";

const initialState: ClientActionState = {};

const CANCELLED_TEXT = "text-[oklch(26%_0.14_25)]";
const CANCELLED_BORDER = "border-[oklch(26%_0.14_25)]";
const CANCELLED_BG_SOFT = "bg-[oklch(95.5%_0.028_20)]";

const NOTES_MAX = 2000;

const inputBase =
  "flex h-11 w-full rounded-[var(--admin-radius-control)] border bg-[var(--admin-surface-input)] px-3 py-2 text-sm text-[var(--admin-body)] outline-none transition-colors duration-[var(--motion-duration-fast)] ease-gentle placeholder:text-[var(--admin-text-muted)] focus-visible:border-[var(--admin-focus)] focus-visible:ring-2 focus-visible:ring-[var(--admin-focus)]/30 disabled:cursor-not-allowed disabled:opacity-50";

const SOURCE_OPTIONS: Array<{ value: string; label: string }> = [
  { value: "website", label: "Website" },
  { value: "phone", label: "Phone" },
  { value: "whatsapp", label: "WhatsApp" },
  { value: "instagram", label: "Instagram" },
  { value: "referral", label: "Referral" },
  { value: "manual", label: "Manual" },
  { value: "other", label: "Other" },
];

const GENDER_PREFERENCE_OPTIONS: Array<{ value: string; label: string }> = [
  { value: "no_preference", label: "No preference" },
  { value: "female", label: "Female only" },
  { value: "male", label: "Male only" },
];

const IDENTITY_LOCKED_HELPER =
  "Only Owner and Admin can change identity fields. Contact one of them if this needs updating.";

export interface ClientEditRecord {
  id: string;
  full_name: string;
  phone: string | null;
  email: string | null;
  gender_preference: string;
  address: string | null;
  postcode: string | null;
  city: string | null;
  area: string | null;
  client_source: string;
  source_detail: string | null;
  notes: string | null;
  updated_at: string;
}

export function ClientEditForm({
  client,
  canEditIdentityFields,
}: {
  client: ClientEditRecord;
  canEditIdentityFields: boolean;
}) {
  const [state, action, pending] = useActionState(updateClient, initialState);
  const [source, setSource] = useState<string>(client.client_source);
  const [noteCount, setNoteCount] = useState<number>(client.notes?.length ?? 0);

  const locked = !canEditIdentityFields;

  const sourceHelper =
    source === "referral"
      ? "Who referred them?"
      : source === "other"
        ? "Where did they find out about us?"
        : undefined;

  const fieldErrors = state.fieldErrors ?? {};

  return (
    <form action={action} aria-busy={pending || undefined} className="grid gap-5 pb-32 md:pb-0">
      <input type="hidden" name="client_id" value={client.id} />
      {/* Optimistic-concurrency token — the server rejects the save when the
          row moved on since this form was rendered (brief §5.6). */}
      <input type="hidden" name="client_updated_at" value={client.updated_at} />

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

      {state.error ? <FormErrorBanner message={state.error} /> : null}

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
            defaultValue={client.full_name}
            locked={locked}
            helper={locked ? IDENTITY_LOCKED_HELPER : undefined}
            error={fieldErrors.full_name}
            autoComplete="name"
          />
          <FormField
            name="client_source"
            label="Source"
            required
            defaultValue={client.client_source}
            helper="Where did this client come from?"
            error={fieldErrors.client_source}
          >
            {(controlProps) => (
              <div className="relative">
                <select
                  {...controlProps}
                  onChange={(event) => setSource(event.currentTarget.value)}
                  className={cn(controlProps.className, "appearance-none pr-9")}
                >
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
          <FormField
            name="gender_preference"
            label="Therapist gender preference"
            defaultValue={client.gender_preference}
            locked={locked}
            helper={
              locked
                ? IDENTITY_LOCKED_HELPER
                : "Applied when matching a therapist to their bookings."
            }
            error={fieldErrors.gender_preference}
          >
            {(controlProps) => (
              <div className="relative">
                <select
                  {...controlProps}
                  className={cn(controlProps.className, "appearance-none pr-9")}
                >
                  {GENDER_PREFERENCE_OPTIONS.map((opt) => (
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
          <FormField
            name="source_detail"
            label="Source detail"
            optional
            defaultValue={client.source_detail ?? ""}
            placeholder="Referral name, campaign, or admin context"
            helper={sourceHelper}
            error={fieldErrors.source_detail}
          />
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
            defaultValue={client.email ?? ""}
            locked={locked}
            placeholder="sara@example.com"
            helper={
              locked ? IDENTITY_LOCKED_HELPER : "Used for confirmations and reminders."
            }
            error={fieldErrors.email}
            autoComplete="email"
          />
          <FormField
            name="phone"
            type="tel"
            label="Phone"
            optional
            defaultValue={client.phone ?? ""}
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
                defaultValue={client.address ?? ""}
                placeholder="Street name and number, building or flat"
                error={fieldErrors.address}
                autoComplete="street-address"
              />
            </div>
            <FormField
              name="postcode"
              label="Postcode"
              optional
              defaultValue={client.postcode ?? ""}
              placeholder="LU1 1AA"
              error={fieldErrors.postcode}
              autoComplete="postal-code"
              controlClassName="max-w-[220px]"
            />
            <FormField
              name="city"
              label="City"
              optional
              defaultValue={client.city ?? ""}
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
                defaultValue={client.area ?? ""}
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
          defaultValue={client.notes ?? ""}
          aria-label="Internal client notes"
          placeholder="Anything admin staff should know. Avoid clinical health context here."
          onChange={(event) => setNoteCount(event.currentTarget.value.length)}
          className="block w-full resize-y rounded-[var(--admin-radius-control)] border border-[var(--admin-border-form)] bg-[var(--admin-surface-input)] px-3 py-2 font-sans text-sm leading-6 text-[var(--admin-body)] outline-none transition-colors duration-[var(--motion-duration-fast)] ease-gentle placeholder:text-[var(--admin-text-muted)] focus-visible:border-[var(--admin-focus)] focus-visible:ring-2 focus-visible:ring-[var(--admin-focus)]/30"
        />
        <p className="mt-1.5 text-right text-xs tabular-nums text-[var(--admin-text-muted)]">
          {noteCount} / {NOTES_MAX}
        </p>
      </AdminPanel>

      <StickySaveBar clientId={client.id} pending={pending} />
    </form>
  );
}

function StickySaveBar({
  clientId,
  pending,
}: {
  clientId: string;
  pending: boolean;
}) {
  return (
    <div className="sticky bottom-14 z-30 -mx-4 mt-2 border-t border-[var(--admin-border)] bg-[var(--admin-panel)] px-4 pb-[max(env(safe-area-inset-bottom),0.75rem)] pt-3 md:static md:bottom-auto md:mx-0 md:border-0 md:bg-transparent md:px-0 md:pb-0">
      <div className="flex flex-col gap-2 md:ml-auto md:w-fit md:flex-row md:items-center md:gap-3">
        <Link
          href={`/admin/clients/${clientId}`}
          className="inline-flex h-12 w-full items-center justify-center rounded-[var(--admin-radius-control)] border border-[var(--admin-border-form)] bg-transparent px-5 text-sm font-semibold text-[var(--admin-body)] outline-none transition-colors duration-[var(--motion-duration-fast)] ease-gentle hover:bg-[var(--admin-panel-muted)] focus-visible:ring-2 focus-visible:ring-[var(--admin-focus)]/55 md:h-10 md:w-auto"
        >
          Cancel
        </Link>
        <button
          type="submit"
          disabled={pending}
          aria-busy={pending || undefined}
          className="inline-flex h-12 w-full items-center justify-center gap-2 rounded-[var(--admin-radius-control)] bg-[var(--admin-primary)] px-5 text-sm font-semibold text-[oklch(99.5%_0.003_88)] outline-none transition-[background-color,transform] duration-[var(--motion-duration-fast)] ease-gentle hover:bg-[var(--admin-primary-hover)] focus-visible:ring-2 focus-visible:ring-[var(--admin-focus)]/55 active:scale-[0.98] disabled:cursor-not-allowed disabled:opacity-40 disabled:hover:bg-[var(--admin-primary)] disabled:active:scale-100 md:h-10 md:w-auto"
        >
          {pending ? (
            <Loader2 className="size-4 shrink-0 animate-spin" aria-hidden="true" />
          ) : (
            <Save className="size-4 shrink-0" aria-hidden="true" />
          )}
          Save changes
        </button>
      </div>
      <p className="mt-2 hidden text-right text-xs text-[var(--admin-text-muted)] md:block">
        We&apos;ll take you back to the client&apos;s profile after save.
      </p>
    </div>
  );
}

function FormErrorBanner({ message }: { message: string }) {
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
        <p className="min-w-0 flex-1 leading-6">
          Couldn&apos;t save changes. {message}
        </p>
      </div>
    </div>
  );
}

interface FormFieldProps {
  name: string;
  label: string;
  required?: boolean;
  optional?: boolean;
  type?: string;
  defaultValue?: string;
  placeholder?: string;
  helper?: string;
  error?: string;
  autoComplete?: string;
  controlClassName?: string;
  /**
   * Identity fields the actor may not change. The visible control is disabled
   * and carries no name; a hidden twin submits the unchanged value so the
   * payload still validates. The server drops identity keys for these actors
   * anyway — this only keeps the round-trip honest.
   */
  locked?: boolean;
  children?: (props: {
    id: string;
    name: string | undefined;
    required?: boolean;
    disabled?: boolean;
    defaultValue: string | undefined;
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
  defaultValue,
  placeholder,
  helper,
  error,
  autoComplete,
  controlClassName,
  locked,
  children,
}: FormFieldProps) {
  const fieldId = useId();
  const helperId = `${fieldId}-helper`;
  const errorId = `${fieldId}-error`;
  const describedBy =
    [error ? errorId : null, helper ? helperId : null].filter(Boolean).join(" ") ||
    undefined;

  const controlProps = {
    id: fieldId,
    name: locked ? undefined : name,
    required: locked ? undefined : required,
    disabled: locked || undefined,
    defaultValue,
    "aria-required": required && !locked ? ("true" as const) : undefined,
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

      {locked ? (
        <input type="hidden" name={name} value={defaultValue ?? ""} />
      ) : null}

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
