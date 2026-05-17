"use client";

import { useId, useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import { Dialog as BaseDialog } from "@base-ui/react/dialog";
import { AlertCircle, Pencil, Plus, X } from "lucide-react";
import { toast } from "sonner";
import { cn } from "@/lib/utils";
import { AdminButton, AdminInput } from "../components/admin-ui";
import {
  createService,
  updateService,
  type ServiceFormState,
} from "./actions";

export interface ServiceRecord {
  id: string;
  slug: string;
  name: string;
  group_category: string | null;
  short_description: string | null;
  full_description: string | null;
  suitable_for_notes: string | null;
  gender_restrictions: "any" | "male_only" | "female_only";
  price: number | string;
  duration_mins: number;
  is_active: boolean;
  is_visible_on_frontend: boolean;
  display_order: number;
}

interface ServiceFormDialogProps {
  service?: ServiceRecord;
  /**
   * Live booking_items count for this service. Used to surface the
   * brief §Copy slug-change warning when editing an in-use service.
   * Defaults to 0 (Add flow, or rows whose count wasn't passed through).
   */
  usageCount?: number;
}

function priceString(value: number | string | undefined) {
  if (value === undefined || value === null || value === "") return "";
  return String(value);
}

export function ServiceFormDialog({
  service,
  usageCount = 0,
}: ServiceFormDialogProps) {
  const router = useRouter();
  const [open, setOpen] = useState(false);
  const isEdit = Boolean(service);
  const title = isEdit ? `Edit ${service?.name ?? "service"}` : "Add service";
  const description = isEdit
    ? "Update treatment details. Existing bookings keep the service snapshot from when they were created."
    : "Add a treatment to the catalog. Pricing, duration, and gender restrictions feed the booking form straight away.";

  return (
    <BaseDialog.Root open={open} onOpenChange={setOpen}>
      <BaseDialog.Trigger
        render={
          isEdit ? (
            <button
              type="button"
              aria-label={`Edit ${service?.name}`}
              className="inline-flex min-h-11 items-center gap-1.5 rounded-[var(--admin-radius-control)] px-3 text-sm font-semibold text-[var(--admin-body)] outline-none transition-colors hover:bg-[var(--admin-panel-muted)] hover:text-[var(--admin-heading)] focus-visible:ring-2 focus-visible:ring-[var(--admin-focus)]/55 sm:min-h-9"
            >
              <Pencil className="size-4" aria-hidden="true" />
              Edit
            </button>
          ) : (
            <button
              type="button"
              className="inline-flex min-h-10 items-center gap-1.5 rounded-[var(--admin-radius-control)] bg-[var(--admin-primary)] px-4 text-sm font-semibold text-white outline-none transition-colors hover:bg-[var(--admin-primary-hover)] focus-visible:ring-2 focus-visible:ring-[var(--admin-focus)]/55"
            >
              <Plus className="size-4" aria-hidden="true" />
              Add service
            </button>
          )
        }
      />
      <BaseDialog.Portal>
        <BaseDialog.Backdrop className="fixed inset-0 z-50 bg-[oklch(12%_0.01_165)]/35 backdrop-blur-sm" />
        <BaseDialog.Popup
          className={cn(
            "fixed z-50 flex min-w-0 flex-col gap-5 overflow-hidden border border-[var(--admin-border)] bg-[var(--admin-panel)] p-0 shadow-[var(--admin-shadow-overlay)] outline-none",
            // Mobile: bottom sheet
            "inset-x-2 bottom-2 max-h-[92vh] w-[calc(100vw-1rem)] rounded-[var(--admin-radius-card)]",
            // Tablet+: right-side drawer
            "sm:bottom-2 sm:left-auto sm:right-2 sm:top-2 sm:max-h-[calc(100vh-1rem)] sm:w-[min(calc(100vw-1rem),32rem)]"
          )}
        >
          <header className="flex items-start justify-between gap-3 border-b border-[var(--admin-border)] px-5 py-4">
            <div className="min-w-0">
              <BaseDialog.Title className="font-display text-[1.333rem] font-semibold leading-tight tracking-[-0.01em] text-[var(--admin-heading)]">
                {title}
              </BaseDialog.Title>
              <BaseDialog.Description className="mt-1 text-sm leading-6 text-[var(--admin-text-muted)]">
                {description}
              </BaseDialog.Description>
            </div>
            <BaseDialog.Close
              className="inline-flex size-9 shrink-0 items-center justify-center rounded-[var(--admin-radius-control)] text-[var(--admin-text-muted)] outline-none transition-colors hover:bg-[var(--admin-panel-muted)] hover:text-[var(--admin-heading)] focus-visible:ring-2 focus-visible:ring-[var(--admin-focus)]/55"
              aria-label="Close"
            >
              <X className="size-4" aria-hidden="true" />
            </BaseDialog.Close>
          </header>
          <ServiceFormBody
            key={open ? `open-${service?.id ?? "new"}` : "closed"}
            service={service}
            isEdit={isEdit}
            usageCount={usageCount}
            onSuccess={() => {
              setOpen(false);
              router.refresh();
            }}
          />
        </BaseDialog.Popup>
      </BaseDialog.Portal>
    </BaseDialog.Root>
  );
}

function ServiceFormBody({
  service,
  isEdit,
  usageCount,
  onSuccess,
}: {
  service?: ServiceRecord;
  isEdit: boolean;
  usageCount: number;
  onSuccess: () => void;
}) {
  const [isPending, startTransition] = useTransition();
  const [state, setState] = useState<ServiceFormState>({});
  const initialSlug = service?.slug ?? "";
  const [slugValue, setSlugValue] = useState(initialSlug);
  const slugWillChange =
    isEdit && usageCount > 0 && slugValue.trim() !== initialSlug.trim();
  const nameId = useId();
  const slugId = useId();
  const categoryId = useId();
  const genderId = useId();
  const priceId = useId();
  const durationId = useId();
  const orderId = useId();
  const activeId = useId();
  const visibleId = useId();
  const shortId = useId();
  const fullId = useId();
  const suitableId = useId();
  const formErrorId = useId();
  const genderErrorId = useId();

  function handleSubmit(event: React.FormEvent<HTMLFormElement>) {
    event.preventDefault();
    const formData = new FormData(event.currentTarget);

    startTransition(async () => {
      const result =
        isEdit && service
          ? await updateService(service.id, {}, formData)
          : await createService({}, formData);

      if (result.error || result.fieldErrors) {
        setState(result);
        if (result.error) {
          toast.error(result.error, { duration: Infinity });
        }
        return;
      }

      setState({});
      toast.success(isEdit ? "Service updated." : "Service added.");
      onSuccess();
    });
  }

  const fieldErrors = state.fieldErrors ?? {};

  return (
    <form
      onSubmit={handleSubmit}
      className="flex min-h-0 flex-1 flex-col"
      noValidate
    >
      <div className="grid min-h-0 flex-1 gap-6 overflow-y-auto px-5 py-4">
        {state.error ? (
          <div
            id={formErrorId}
            role="alert"
            aria-live="polite"
            aria-atomic="true"
            className="rounded-[var(--admin-radius-control)] border border-[oklch(88%_0.045_20)] bg-[oklch(95.5%_0.028_20)] px-3 py-2.5 text-sm text-[oklch(26%_0.14_25)]"
          >
            {state.error}
          </div>
        ) : null}

        <Fieldset legend="Basic">
          <AdminInput
            id={nameId}
            name="name"
            label="Service name"
            required
            defaultValue={service?.name ?? ""}
            placeholder="e.g. Hijama (wet cupping)"
            disabled={isPending}
            maxLength={80}
            error={fieldErrors.name}
          />
          <AdminInput
            id={slugId}
            name="slug"
            label="URL slug"
            value={slugValue}
            onChange={(event) => setSlugValue(event.target.value)}
            placeholder="hijama-wet-cupping"
            disabled={isPending}
            hint="Auto-generated from name. Change with care; booking forms reference this."
            error={fieldErrors.slug}
          />
          <AdminInput
            id={categoryId}
            name="group_category"
            label="Category"
            required
            defaultValue={service?.group_category ?? ""}
            placeholder="e.g. Hijama, Massage, Soft tissue therapy"
            disabled={isPending}
            hint="Services are grouped by category in the catalog and on the public site."
            error={fieldErrors.group_category}
          />
        </Fieldset>

        <Fieldset legend="Details">
          <div className="grid gap-1.5">
            <label
              htmlFor={genderId}
              className="text-sm font-medium text-[var(--admin-heading)]"
            >
              Gender restriction
              <span
                aria-hidden="true"
                className="ml-0.5 text-[oklch(26%_0.14_25)]"
              >
                *
              </span>
            </label>
            <select
              id={genderId}
              name="gender_restrictions"
              required
              defaultValue={service?.gender_restrictions ?? "any"}
              disabled={isPending}
              aria-describedby={
                fieldErrors.gender_restrictions
                  ? genderErrorId
                  : `${genderId}-hint`
              }
              aria-invalid={
                fieldErrors.gender_restrictions ? "true" : undefined
              }
              className="flex h-10 w-full rounded-[var(--admin-radius-control)] border border-[var(--admin-border-form)] bg-[var(--admin-surface-input)] px-3 py-2 text-sm text-[var(--admin-body)] outline-none transition-colors focus-visible:border-[var(--admin-focus)] focus-visible:ring-2 focus-visible:ring-[var(--admin-focus)]/30 disabled:cursor-not-allowed disabled:opacity-50 aria-[invalid=true]:border-[oklch(26%_0.14_25)]"
            >
              <option value="any">Any gender</option>
              <option value="female_only">Female clients only</option>
              <option value="male_only">Male clients only</option>
            </select>
            {!fieldErrors.gender_restrictions ? (
              <p
                id={`${genderId}-hint`}
                className="text-xs text-[var(--admin-text-muted)]"
              >
                Affects which therapists can be assigned to this service.
              </p>
            ) : (
              <div
                id={genderErrorId}
                role="alert"
                aria-live="polite"
                aria-atomic="true"
                className="text-xs text-[oklch(26%_0.14_25)]"
              >
                {fieldErrors.gender_restrictions}
              </div>
            )}
          </div>

          <div className="grid gap-4 sm:grid-cols-2">
            <AdminInput
              id={priceId}
              name="price"
              label="Price"
              required
              type="number"
              min="0"
              step="0.01"
              inputMode="decimal"
              defaultValue={priceString(service?.price)}
              placeholder="60.00"
              disabled={isPending}
              error={fieldErrors.price}
              hint="In £ (GBP)."
            />
            <AdminInput
              id={durationId}
              name="duration_mins"
              label="Duration"
              required
              type="number"
              min="1"
              step="1"
              inputMode="numeric"
              defaultValue={service?.duration_mins ?? 60}
              placeholder="60"
              disabled={isPending}
              error={fieldErrors.duration_mins}
              hint="In minutes."
            />
          </div>

          <AdminInput
            id={orderId}
            name="display_order"
            label="Display order"
            type="number"
            step="1"
            inputMode="numeric"
            defaultValue={service?.display_order ?? 0}
            disabled={isPending}
            error={fieldErrors.display_order}
            hint="Lower numbers appear first within the category."
          />
        </Fieldset>

        <Fieldset legend="Visibility">
          <CheckboxField
            id={activeId}
            name="is_active"
            label="Active"
            hint="Inactive services don't show up on the public site or in booking forms."
            defaultChecked={service?.is_active ?? true}
            disabled={isPending}
          />
          <CheckboxField
            id={visibleId}
            name="is_visible_on_frontend"
            label="Show on website"
            hint="Toggle off to hide from the customer-facing site without deactivating."
            defaultChecked={service?.is_visible_on_frontend ?? true}
            disabled={isPending}
          />
        </Fieldset>

        <Fieldset legend="Copy">
          <TextareaField
            id={shortId}
            name="short_description"
            label="Short description"
            defaultValue={service?.short_description ?? ""}
            placeholder="One sentence. Appears next to the service name in lists."
            rows={2}
            disabled={isPending}
          />
          <TextareaField
            id={fullId}
            name="full_description"
            label="Full description"
            defaultValue={service?.full_description ?? ""}
            placeholder="What it involves, what it's good for, what to expect."
            rows={5}
            disabled={isPending}
          />
          <TextareaField
            id={suitableId}
            name="suitable_for_notes"
            label="Suitable for"
            defaultValue={service?.suitable_for_notes ?? ""}
            placeholder="Conditions or audiences this treatment is suitable for. Written for the client."
            rows={3}
            disabled={isPending}
          />
        </Fieldset>
      </div>

      <footer className="border-t border-[var(--admin-border)] bg-[var(--admin-panel)] px-5 py-4">
        {slugWillChange ? (
          <div
            role="status"
            aria-live="polite"
            className="mb-3 flex items-start gap-2.5 rounded-[var(--admin-radius-control)] border border-[oklch(88%_0.055_75)] bg-[oklch(96%_0.038_75)] px-3 py-2.5 text-sm text-[oklch(28%_0.12_55)]"
          >
            <AlertCircle
              className="mt-0.5 size-4 shrink-0"
              aria-hidden="true"
            />
            <span>
              Changing the slug may break existing booking links.{" "}
              {usageCount} {usageCount === 1 ? "booking" : "bookings"} on file
              reference the current slug. Continue?
            </span>
          </div>
        ) : null}
        <div className="flex flex-col-reverse gap-2 sm:flex-row sm:items-center sm:justify-end">
        <BaseDialog.Close
          disabled={isPending}
          render={
            <button
              type="button"
              disabled={isPending}
              className="inline-flex min-h-10 items-center justify-center rounded-[var(--admin-radius-control)] px-4 text-sm font-semibold text-[var(--admin-body)] outline-none transition-colors hover:bg-[var(--admin-panel-muted)] hover:text-[var(--admin-heading)] focus-visible:ring-2 focus-visible:ring-[var(--admin-focus)]/55 disabled:opacity-50"
            >
              Cancel
            </button>
          }
        />
        <AdminButton
          type="submit"
          variant="primary"
          loading={isPending}
          className="w-full justify-center sm:w-auto"
        >
          {isEdit ? "Save changes" : "Save service"}
        </AdminButton>
        </div>
      </footer>
    </form>
  );
}

function Fieldset({
  legend,
  children,
}: {
  legend: string;
  children: React.ReactNode;
}) {
  return (
    <section className="grid gap-4">
      <h3 className="text-xs font-semibold uppercase tracking-[0.08em] text-[var(--admin-text-muted)]">
        {legend}
      </h3>
      <div className="grid gap-4">{children}</div>
    </section>
  );
}

function CheckboxField({
  id,
  name,
  label,
  hint,
  defaultChecked,
  disabled,
}: {
  id: string;
  name: string;
  label: string;
  hint?: string;
  defaultChecked?: boolean;
  disabled?: boolean;
}) {
  return (
    <div className="grid gap-1.5">
      <label
        htmlFor={id}
        className="inline-flex items-center gap-2 text-sm font-medium text-[var(--admin-heading)]"
      >
        <input
          id={id}
          name={name}
          type="checkbox"
          defaultChecked={defaultChecked}
          disabled={disabled}
          className="size-4 rounded-sm border-[var(--admin-border-form)] accent-[var(--admin-primary)] focus-visible:ring-2 focus-visible:ring-[var(--admin-focus)]/55"
        />
        {label}
      </label>
      {hint ? (
        <p className="pl-6 text-xs text-[var(--admin-text-muted)]">{hint}</p>
      ) : null}
    </div>
  );
}

function TextareaField({
  id,
  name,
  label,
  defaultValue,
  placeholder,
  rows,
  disabled,
}: {
  id: string;
  name: string;
  label: string;
  defaultValue?: string;
  placeholder?: string;
  rows?: number;
  disabled?: boolean;
}) {
  return (
    <div className="grid gap-1.5">
      <label
        htmlFor={id}
        className="text-sm font-medium text-[var(--admin-heading)]"
      >
        {label}
      </label>
      <textarea
        id={id}
        name={name}
        rows={rows}
        defaultValue={defaultValue}
        placeholder={placeholder}
        disabled={disabled}
        className="flex w-full rounded-[var(--admin-radius-control)] border border-[var(--admin-border-form)] bg-[var(--admin-surface-input)] px-3 py-2 text-sm leading-6 text-[var(--admin-body)] outline-none transition-colors placeholder:text-[var(--admin-text-muted)] focus-visible:border-[var(--admin-focus)] focus-visible:ring-2 focus-visible:ring-[var(--admin-focus)]/30 disabled:cursor-not-allowed disabled:opacity-50"
      />
    </div>
  );
}
