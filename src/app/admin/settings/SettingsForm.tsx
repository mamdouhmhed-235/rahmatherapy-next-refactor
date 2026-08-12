"use client";

import { useEffect, useId, useMemo, useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import { Dialog as BaseDialog } from "@base-ui/react/dialog";
import { CheckCircle, Loader2, Lock, Plus, Save, X, XCircle } from "lucide-react";
import { toast } from "sonner";
import {
  AdminPanel,
  AdminPanelHeader,
} from "@/app/admin/components/admin-ui";
import { Switch } from "@/components/ui/switch";
import { cn } from "@/lib/utils";
import {
  updateBusinessSettings,
  type SettingsActionState,
} from "./actions";

interface BusinessSettings {
  company_name: string;
  contact_email: string | null;
  contact_phone: string | null;
  booking_window_days: number;
  buffer_time_mins: number;
  minimum_notice_hours: number;
  customer_cancellation_cutoff_hours: number;
  free_travel_cities: string[];
  mileage_origin: string | null;
  booking_status_enabled: boolean;
}

interface LastChange {
  actor: string;
  display: string;
  isoTimestamp: string;
}

interface SettingsFormProps {
  settings: BusinessSettings;
  lastChange?: LastChange | null;
  /** Owner-only. The server action enforces this independently — hiding the
   *  field here is presentation, not the gate. */
  canManageTravelOrigin?: boolean;
}

const requiredMark = (
  <span
    aria-hidden="true"
    className="ml-0.5 align-middle text-base font-bold leading-none text-[var(--admin-status-cancelled-text)]"
  >
    *
  </span>
);

export function SettingsForm({
  settings,
  lastChange,
  canManageTravelOrigin = false,
}: SettingsFormProps) {
  const router = useRouter();
  const [isPending, startTransition] = useTransition();
  const [state, setState] = useState<SettingsActionState>({});

  const [intakeOn, setIntakeOn] = useState(settings.booking_status_enabled);
  const [pauseModalOpen, setPauseModalOpen] = useState(false);

  const [cities, setCities] = useState<string[]>(settings.free_travel_cities);
  const [cityDraft, setCityDraft] = useState("");
  const [mileageOrigin, setMileageOrigin] = useState(
    settings.mileage_origin ?? ""
  );

  const [windowDays, setWindowDays] = useState(String(settings.booking_window_days));
  const [noticeHours, setNoticeHours] = useState(String(settings.minimum_notice_hours));
  const [bufferMins, setBufferMins] = useState(String(settings.buffer_time_mins));
  const [cancelHours, setCancelHours] = useState(
    String(settings.customer_cancellation_cutoff_hours)
  );

  const [companyName, setCompanyName] = useState(settings.company_name);
  const [contactPhone, setContactPhone] = useState(settings.contact_phone ?? "");
  const [contactEmail, setContactEmail] = useState(settings.contact_email ?? "");

  const initial = useMemo(
    () => ({
      intakeOn: settings.booking_status_enabled,
      cities: settings.free_travel_cities,
      mileageOrigin: settings.mileage_origin ?? "",
      windowDays: String(settings.booking_window_days),
      noticeHours: String(settings.minimum_notice_hours),
      bufferMins: String(settings.buffer_time_mins),
      cancelHours: String(settings.customer_cancellation_cutoff_hours),
      companyName: settings.company_name,
      contactPhone: settings.contact_phone ?? "",
      contactEmail: settings.contact_email ?? "",
    }),
    [settings]
  );

  const isDirty =
    intakeOn !== initial.intakeOn ||
    cities.join("\n") !== initial.cities.join("\n") ||
    mileageOrigin !== initial.mileageOrigin ||
    windowDays !== initial.windowDays ||
    noticeHours !== initial.noticeHours ||
    bufferMins !== initial.bufferMins ||
    cancelHours !== initial.cancelHours ||
    companyName !== initial.companyName ||
    contactPhone !== initial.contactPhone ||
    contactEmail !== initial.contactEmail;

  useEffect(() => {
    if (!isDirty) return;
    function handler(event: BeforeUnloadEvent) {
      event.preventDefault();
      event.returnValue = "";
    }
    window.addEventListener("beforeunload", handler);
    return () => window.removeEventListener("beforeunload", handler);
  }, [isDirty]);

  function handleSwitchChange(next: boolean) {
    if (intakeOn && !next) {
      setPauseModalOpen(true);
      return;
    }
    setIntakeOn(true);
    toast.success("Intake reopened. The public booking page is accepting requests.");
  }

  function confirmPause() {
    setIntakeOn(false);
    setPauseModalOpen(false);
    toast.success("Intake paused. Customer-facing booking page is now closed.");
  }

  function discardChanges() {
    setIntakeOn(initial.intakeOn);
    setCities(initial.cities);
    setCityDraft("");
    setMileageOrigin(initial.mileageOrigin);
    setWindowDays(initial.windowDays);
    setNoticeHours(initial.noticeHours);
    setBufferMins(initial.bufferMins);
    setCancelHours(initial.cancelHours);
    setCompanyName(initial.companyName);
    setContactPhone(initial.contactPhone);
    setContactEmail(initial.contactEmail);
    setState({});
  }

  function addCity(raw: string) {
    const trimmed = raw.trim();
    if (!trimmed) return;
    const lower = trimmed.toLowerCase();
    setCities((prev) =>
      prev.map((c) => c.toLowerCase()).includes(lower) ? prev : [...prev, trimmed]
    );
    setCityDraft("");
  }

  function handleCityKeyDown(event: React.KeyboardEvent<HTMLInputElement>) {
    if (event.key === "Enter" || event.key === ",") {
      event.preventDefault();
      addCity(cityDraft);
    } else if (event.key === "Backspace" && cityDraft === "" && cities.length > 0) {
      setCities((prev) => prev.slice(0, -1));
    }
  }

  function removeCity(index: number) {
    setCities((prev) => prev.filter((_, i) => i !== index));
  }

  function handleSubmit(event: React.FormEvent<HTMLFormElement>) {
    event.preventDefault();
    const formData = new FormData(event.currentTarget);

    startTransition(async () => {
      const result = await updateBusinessSettings({}, formData);

      if (result.error || result.fieldErrors) {
        setState(result);
        if (result.error) toast.error("Couldn't save settings. Try again.");
        return;
      }

      setState({});
      toast.success("Settings saved.");
      router.refresh();
    });
  }

  return (
    <form onSubmit={handleSubmit} className="pb-44 md:pb-24" noValidate>
      <p className="mb-4 text-xs text-[var(--admin-text-muted)]">
        <span
          aria-hidden="true"
          className="mr-0.5 align-middle text-base font-bold leading-none text-[var(--admin-status-cancelled-text)]"
        >
          *
        </span>
        means required.
      </p>

      {state.error ? (
        <div
          role="alert"
          aria-live="polite"
          aria-atomic="true"
          className="mb-5 flex items-start gap-2.5 rounded-[var(--admin-radius-card)] border border-[var(--admin-status-cancelled-border)] bg-[var(--admin-status-cancelled-bg)] px-4 py-3 text-sm text-[var(--admin-status-cancelled-text)]"
        >
          <XCircle className="mt-0.5 size-4 shrink-0" aria-hidden="true" />
          <span>{state.error}</span>
        </div>
      ) : null}

      <div className="grid gap-5">
        {/* ─── Panel 1: Customer booking intake ─────────────────── */}
        <AdminPanel>
          <div className="grid gap-4">
            <AdminPanelHeader
              title="Customer booking intake"
              description="When this is off, the public booking page shows a closed-for-intake notice and doesn't accept new requests. Existing bookings, reminders, and admin-side flows keep working."
            />

            <IntakeStateBanner intakeOn={intakeOn} />

            <div
              className={cn(
                "flex flex-wrap items-center justify-between gap-3 rounded-[var(--admin-radius-control)] border px-4 py-3 transition-colors duration-[var(--motion-duration-fast)] ease-gentle",
                intakeOn
                  ? "border-[var(--admin-status-confirmed-border)] bg-[var(--admin-status-confirmed-bg)]/50"
                  : "border-[var(--admin-border)] bg-[var(--admin-panel-muted)]"
              )}
            >
              <label
                htmlFor="settings-intake-switch"
                className="text-sm font-medium text-[var(--admin-heading)]"
              >
                Accept new bookings
              </label>
              <span
                title={
                  intakeOn
                    ? "Flipping this off pauses public bookings."
                    : "Flipping this on reopens the public booking page."
                }
              >
                <Switch
                  id="settings-intake-switch"
                  name="booking_status_enabled"
                  checked={intakeOn}
                  onCheckedChange={handleSwitchChange}
                  disabled={isPending}
                  aria-label="Accept new bookings"
                />
              </span>
            </div>

            {lastChange ? (
              <p
                className="text-xs text-[var(--admin-text-muted)]"
                title={lastChange.isoTimestamp}
              >
                Last changed by {lastChange.actor} on {lastChange.display}.
              </p>
            ) : null}
          </div>
        </AdminPanel>

        {/* ─── Panel 2: Clinic identity ─────────────────────────── */}
        <AdminPanel>
          <div className="grid gap-4">
            <AdminPanelHeader
              title="Clinic identity"
              description="Shown to customers in emails and on the booking page footer."
            />

            <fieldset className="m-0 min-w-0 border-0 p-0">
              <legend className="sr-only">Clinic identity</legend>
              <div className="grid gap-4 md:grid-cols-2">
                <FieldRow
                  name="company_name"
                  label="Clinic name"
                  required
                  helper="Appears in confirmation emails as the sender name."
                  error={state.fieldErrors?.company_name}
                  value={companyName}
                  onChange={setCompanyName}
                  placeholder="Rahma Therapy"
                  disabled={isPending}
                />

                <FieldRow
                  name="contact_phone"
                  label="Contact phone"
                  helper="Shown to customers in confirmation emails."
                  error={state.fieldErrors?.contact_phone}
                  value={contactPhone}
                  onChange={setContactPhone}
                  placeholder="01582 …"
                  disabled={isPending}
                />

                <div className="md:col-span-2">
                  <FieldRow
                    name="contact_email"
                    label="Contact email"
                    type="email"
                    helper="Shown to customers as the reply-to address."
                    error={state.fieldErrors?.contact_email}
                    value={contactEmail}
                    onChange={setContactEmail}
                    placeholder="hello@example.com"
                    disabled={isPending}
                  />
                </div>
              </div>
            </fieldset>
          </div>
        </AdminPanel>

        {/* ─── Panel 3: Booking rules ───────────────────────────── */}
        <AdminPanel>
          <div className="grid gap-4">
            <AdminPanelHeader
              title="Booking rules"
              description="How far ahead customers can book, how soon, and the gap each therapist needs between visits."
            />

            <fieldset className="m-0 min-w-0 border-0 p-0">
              <legend className="sr-only">Booking rules</legend>
              <div className="grid gap-4 md:grid-cols-2">
                <NumericField
                  name="booking_window_days"
                  label="Booking window"
                  suffix="days"
                  min={1}
                  value={windowDays}
                  onChange={setWindowDays}
                  helper={`Customers can book up to ${windowDays || "—"} days into the future.`}
                  error={state.fieldErrors?.booking_window_days}
                  disabled={isPending}
                />

                <NumericField
                  name="minimum_notice_hours"
                  label="Minimum notice"
                  suffix="hours"
                  min={0}
                  value={noticeHours}
                  onChange={setNoticeHours}
                  helper={`Customers can't book a slot starting in less than ${noticeHours || "—"} hours.`}
                  error={state.fieldErrors?.minimum_notice_hours}
                  disabled={isPending}
                />

                <NumericField
                  name="buffer_time_mins"
                  label="Travel buffer"
                  suffix="minutes"
                  min={0}
                  value={bufferMins}
                  onChange={setBufferMins}
                  helper={`Each visit leaves ${bufferMins || "—"} minutes of travel time after it for the therapist's next stop.`}
                  error={state.fieldErrors?.buffer_time_mins}
                  disabled={isPending}
                />

                <NumericField
                  name="customer_cancellation_cutoff_hours"
                  label="Customer cancellation cutoff"
                  suffix="hours"
                  min={0}
                  value={cancelHours}
                  onChange={setCancelHours}
                  helper={`Customers can self-cancel up to ${cancelHours || "—"} hours before the visit starts. Closer cancellations need staff.`}
                  error={state.fieldErrors?.customer_cancellation_cutoff_hours}
                  disabled={isPending}
                />
              </div>
            </fieldset>
          </div>
        </AdminPanel>

        {/* ─── Panel 4: Service areas ───────────────────────────── */}
        <AdminPanel>
          <div className="grid gap-4">
            <AdminPanelHeader
              title="Free-travel areas"
              description="Cities and towns the team travels to at no extra charge. Addresses outside them can still be booked — an admin sets the travel charge by hand."
            />

            <ServiceAreaField
              cities={cities}
              draft={cityDraft}
              onDraftChange={setCityDraft}
              onKeyDown={handleCityKeyDown}
              onAdd={() => addCity(cityDraft)}
              onRemove={removeCity}
              error={state.fieldErrors?.free_travel_cities}
              disabled={isPending}
            />

            {/* Hidden input preserves the original server contract: newline-delimited. */}
            <input
              type="hidden"
              name="free_travel_cities"
              value={cities.join("\n")}
            />

            <FieldRow
              name="mileage_origin"
              label="Mileage origin"
              helper={
                canManageTravelOrigin
                  ? "Where travel is measured from when a booking falls outside the free-travel areas. Descriptive only — nothing is calculated from it."
                  : "Where travel is measured from outside the free-travel areas. Only the practice owner can change this."
              }
              error={state.fieldErrors?.mileage_origin}
              value={mileageOrigin}
              onChange={setMileageOrigin}
              placeholder="e.g. Luton town centre"
              disabled={isPending || !canManageTravelOrigin}
            />
          </div>
        </AdminPanel>
      </div>

      {/* ─── Sticky save bar (flat surface-card, no blur) ──────── */}
      <div className="fixed inset-x-0 bottom-14 z-40 border-t border-[var(--admin-border)] bg-[var(--admin-panel)] pb-3 pt-3 shadow-[0_-1px_8px_var(--admin-shadow-ink-04)] md:bottom-0 md:pb-[max(env(safe-area-inset-bottom,0),0.75rem)]">
        <div className="mx-auto flex max-w-5xl flex-col gap-2 px-4 sm:flex-row sm:items-center sm:justify-between sm:px-6">
          <div className="flex w-full justify-end sm:w-auto sm:justify-start">
            {isDirty ? (
              <button
                type="button"
                onClick={discardChanges}
                disabled={isPending}
                className="inline-flex min-h-9 items-center justify-center rounded-[var(--admin-radius-control)] px-2 text-xs font-medium text-[var(--admin-text-muted)] outline-none transition-colors hover:text-[var(--admin-body)] focus-visible:ring-2 focus-visible:ring-[var(--admin-focus)]/55 disabled:opacity-60 sm:min-h-10 sm:border sm:border-[var(--admin-border-form)] sm:bg-transparent sm:px-4 sm:text-sm sm:font-semibold sm:text-[var(--admin-body)] sm:hover:bg-[var(--admin-panel-muted)]"
                title="Revert all fields to their last-saved values"
              >
                Discard changes
              </button>
            ) : null}
          </div>
          <div className="flex w-full sm:w-auto">
            <button
              type="submit"
              disabled={isPending}
              aria-busy={isPending || undefined}
              className="inline-flex min-h-10 w-full items-center justify-center gap-2 rounded-[var(--admin-radius-control)] bg-[var(--admin-primary)] px-4 text-sm font-semibold text-[var(--admin-on-primary)] outline-none transition-colors hover:bg-[var(--admin-primary-hover)] focus-visible:ring-2 focus-visible:ring-[var(--admin-focus)]/55 disabled:opacity-60 sm:w-auto"
              title="Save changes to settings"
            >
              {isPending ? (
                <Loader2 className="size-4 shrink-0 animate-spin" aria-hidden="true" />
              ) : (
                <Save className="size-4 shrink-0" aria-hidden="true" />
              )}
              Save settings
            </button>
          </div>
        </div>
      </div>

      {/* ─── Pause-intake confirm modal (controlled) ───────────── */}
      <BaseDialog.Root open={pauseModalOpen} onOpenChange={setPauseModalOpen}>
        <BaseDialog.Portal>
          <BaseDialog.Backdrop className="fixed inset-0 z-50 bg-[var(--admin-scrim)]/35" />
          <BaseDialog.Popup className="fixed left-1/2 top-[30vh] z-50 w-[min(calc(100vw-2rem),30rem)] -translate-x-1/2 rounded-[var(--admin-radius-card)] border border-[var(--admin-border)] bg-[var(--admin-panel)] p-5 shadow-[var(--admin-shadow-overlay)] outline-none">
            <div className="flex items-start gap-3">
              <span className="mt-0.5 inline-flex size-9 shrink-0 items-center justify-center rounded-full bg-[var(--admin-status-cancelled-bg)]">
                <XCircle className="size-5 text-[var(--admin-status-cancelled-text)]" aria-hidden="true" />
              </span>
              <div className="min-w-0 flex-1">
                <BaseDialog.Title className="text-base font-semibold text-[var(--admin-heading)]">
                  Pause new bookings?
                </BaseDialog.Title>
                <BaseDialog.Description className="mt-1.5 text-sm leading-6 text-[var(--admin-text-muted)]">
                  The public booking page will show a closed-for-intake notice
                  until you turn this back on. Existing bookings, reminders, and
                  admin work continue.
                </BaseDialog.Description>
              </div>
            </div>
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
                type="button"
                onClick={confirmPause}
                className="inline-flex min-h-10 items-center gap-2 rounded-[var(--admin-radius-control)] bg-[var(--admin-danger-solid)] px-4 text-sm font-semibold text-[var(--admin-on-primary)] outline-none transition-colors hover:bg-[var(--admin-danger-solid-hover)] focus-visible:ring-2 focus-visible:ring-[var(--admin-focus)]/55"
              >
                Pause intake
              </button>
            </div>
          </BaseDialog.Popup>
        </BaseDialog.Portal>
      </BaseDialog.Root>
    </form>
  );
}

function IntakeStateBanner({ intakeOn }: { intakeOn: boolean }) {
  if (intakeOn) {
    return (
      <div
        key="on"
        title="Customers can submit new bookings via the public site."
        className="flex items-start gap-2.5 rounded-[var(--admin-radius-control)] border border-[var(--admin-status-confirmed-border)] bg-[var(--admin-status-confirmed-bg)] px-4 py-3 text-sm text-[var(--admin-status-confirmed-text)] motion-safe:[animation:rahma-fade-up_200ms_ease-out]"
      >
        <CheckCircle className="mt-0.5 size-4 shrink-0" aria-hidden="true" />
        <div className="min-w-0">
          <p className="font-semibold">Accepting new bookings</p>
          <p className="mt-0.5 text-[var(--admin-status-confirmed-text)]/85">
            Customers can submit new bookings.
          </p>
        </div>
      </div>
    );
  }
  return (
    <div
      key="off"
      title="Public site shows a closed-for-intake message until intake is resumed."
      className="flex items-start gap-2.5 rounded-[var(--admin-radius-control)] border border-[var(--admin-status-restricted-border)] bg-[var(--admin-status-restricted-bg)] px-4 py-3 text-sm text-[var(--admin-status-restricted-text)] motion-safe:[animation:rahma-fade-up_200ms_ease-out]"
    >
      <Lock className="mt-0.5 size-4 shrink-0" aria-hidden="true" />
      <div className="min-w-0">
        <p className="font-semibold">Intake paused</p>
        <p className="mt-0.5 text-[var(--admin-status-restricted-text)]/85">
          The public booking page is closed. Existing bookings, reminders, and
          admin work continue.
        </p>
      </div>
    </div>
  );
}

function FieldRow({
  name,
  label,
  helper,
  error,
  value,
  onChange,
  type = "text",
  placeholder,
  required = false,
  disabled,
}: {
  name: string;
  label: string;
  helper: string;
  error?: string;
  value: string;
  onChange: (next: string) => void;
  type?: string;
  placeholder?: string;
  required?: boolean;
  disabled?: boolean;
}) {
  const autoId = useId();
  const errorId = `${autoId}-error`;
  const helperId = `${autoId}-helper`;

  return (
    <div className="grid gap-1.5">
      <label
        htmlFor={autoId}
        className="text-sm font-medium text-[var(--admin-heading)]"
      >
        {label}
        {required ? requiredMark : null}
      </label>
      <input
        id={autoId}
        name={name}
        type={type}
        value={value}
        onChange={(event) => onChange(event.target.value)}
        placeholder={placeholder}
        disabled={disabled}
        required={required}
        aria-describedby={cn(error ? errorId : undefined, helper ? helperId : undefined) || undefined}
        aria-invalid={error ? "true" : undefined}
        className={cn(
          "flex h-10 w-full scroll-mb-24 rounded-[var(--admin-radius-control)] border bg-[var(--admin-surface-input)] px-3 py-2 text-sm text-[var(--admin-body)] outline-none transition-colors placeholder:text-[var(--admin-text-muted)] focus-visible:border-[var(--admin-focus)] focus-visible:ring-2 focus-visible:ring-[var(--admin-focus)]/30 disabled:cursor-not-allowed disabled:opacity-50",
          error
            ? "border-[var(--admin-status-cancelled-text)]"
            : "border-[var(--admin-border-form)]"
        )}
      />
      {error ? (
        <p
          id={errorId}
          role="alert"
          aria-live="polite"
          aria-atomic="true"
          className="text-xs text-[var(--admin-status-cancelled-text)]"
        >
          {error}
        </p>
      ) : (
        <p id={helperId} className="text-xs text-[var(--admin-text-muted)]">
          {helper}
        </p>
      )}
    </div>
  );
}

function NumericField({
  name,
  label,
  suffix,
  min,
  value,
  onChange,
  helper,
  error,
  disabled,
}: {
  name: string;
  label: string;
  suffix: string;
  min: number;
  value: string;
  onChange: (next: string) => void;
  helper: string;
  error?: string;
  disabled?: boolean;
}) {
  const autoId = useId();
  const errorId = `${autoId}-error`;
  const helperId = `${autoId}-helper`;

  return (
    <div className="grid gap-1.5">
      <label
        htmlFor={autoId}
        className="text-sm font-medium text-[var(--admin-heading)]"
      >
        {label}
        {requiredMark}
      </label>
      <div className="flex items-stretch gap-2">
        <input
          id={autoId}
          name={name}
          type="number"
          inputMode="numeric"
          min={min}
          step={1}
          value={value}
          onChange={(event) => onChange(event.target.value)}
          disabled={disabled}
          required
          aria-describedby={cn(error ? errorId : undefined, helperId)}
          aria-invalid={error ? "true" : undefined}
          className={cn(
            "h-10 w-24 flex-shrink-0 scroll-mb-24 rounded-[var(--admin-radius-control)] border bg-[var(--admin-surface-input)] px-3 py-2 text-sm text-[var(--admin-body)] outline-none transition-colors focus-visible:border-[var(--admin-focus)] focus-visible:ring-2 focus-visible:ring-[var(--admin-focus)]/30 disabled:cursor-not-allowed disabled:opacity-50",
            "[appearance:textfield] [&::-webkit-inner-spin-button]:m-0 [&::-webkit-inner-spin-button]:appearance-none [&::-webkit-outer-spin-button]:m-0 [&::-webkit-outer-spin-button]:appearance-none",
            error
              ? "border-[var(--admin-status-cancelled-text)]"
              : "border-[var(--admin-border-form)]"
          )}
        />
        <span
          title={helper}
          className="inline-flex items-center text-sm text-[var(--admin-text-muted)]"
        >
          {suffix}
        </span>
      </div>
      {error ? (
        <p
          id={errorId}
          role="alert"
          aria-live="polite"
          aria-atomic="true"
          className="text-xs text-[var(--admin-status-cancelled-text)]"
        >
          {error}
        </p>
      ) : (
        <p id={helperId} className="text-xs text-[var(--admin-text-muted)]">
          {helper}
        </p>
      )}
    </div>
  );
}

function ServiceAreaField({
  cities,
  draft,
  onDraftChange,
  onKeyDown,
  onAdd,
  onRemove,
  error,
  disabled,
}: {
  cities: string[];
  draft: string;
  onDraftChange: (next: string) => void;
  onKeyDown: (event: React.KeyboardEvent<HTMLInputElement>) => void;
  onAdd: () => void;
  onRemove: (index: number) => void;
  error?: string;
  disabled?: boolean;
}) {
  const autoId = useId();
  const errorId = `${autoId}-error`;
  const helperId = `${autoId}-helper`;

  return (
    <div className="grid gap-3">
      <label htmlFor={autoId} className="sr-only">
        Free-travel areas
      </label>

      {cities.length === 0 ? (
        <div
          role="status"
          className="flex items-start gap-2.5 rounded-[var(--admin-radius-control)] border border-[var(--admin-status-attention-border)] bg-[var(--admin-status-attention-bg)] px-3 py-2 text-xs text-[var(--admin-status-attention-text)]"
        >
          <span>
            No free-travel areas yet. Every booking will count as chargeable
            travel. Add at least one city below.
          </span>
        </div>
      ) : (
        <ul className="flex list-none flex-wrap gap-1.5 p-0">
          {cities.map((city, index) => (
            <li key={`${city}-${index}`}>
              <span
                title="Free-travel area. Visits here carry no travel charge."
                className="inline-flex items-center gap-1 rounded-full border border-[var(--admin-status-restricted-border)] bg-[var(--admin-status-restricted-bg)] py-1 pl-3 pr-1 text-xs text-[var(--admin-status-restricted-text)] transition-colors hover:bg-[var(--admin-status-restricted-bg-hover)]"
              >
                <span>{city}</span>
                <button
                  type="button"
                  onClick={() => onRemove(index)}
                  disabled={disabled}
                  aria-label={`Remove ${city}`}
                  title={`Remove ${city}`}
                  className="relative inline-flex size-5 items-center justify-center rounded-full text-[var(--admin-status-restricted-text)] outline-none transition-colors hover:bg-[var(--admin-status-restricted-bg-hover-strong)] hover:text-[var(--admin-status-restricted-text-hover)] focus-visible:ring-2 focus-visible:ring-[var(--admin-focus)]/55 disabled:opacity-50 before:absolute before:inset-[-8px] before:content-['']"
                >
                  <X
                    className="size-3.5 shrink-0"
                    style={{ minWidth: 14 }}
                    strokeWidth={2.5}
                    aria-hidden="true"
                  />
                </button>
              </span>
            </li>
          ))}
        </ul>
      )}

      <div className="flex flex-col gap-2 sm:flex-row">
        <input
          id={autoId}
          type="text"
          value={draft}
          onChange={(event) => onDraftChange(event.target.value)}
          onKeyDown={onKeyDown}
          placeholder="Add a city or town and press Enter"
          disabled={disabled}
          aria-describedby={cn(error ? errorId : undefined, helperId)}
          aria-invalid={error ? "true" : undefined}
          className={cn(
            "h-10 w-full flex-1 scroll-mb-24 rounded-[var(--admin-radius-control)] border bg-[var(--admin-surface-input)] px-3 py-2 text-sm text-[var(--admin-body)] outline-none transition-colors placeholder:text-[var(--admin-text-muted)] focus-visible:border-[var(--admin-focus)] focus-visible:ring-2 focus-visible:ring-[var(--admin-focus)]/30 disabled:cursor-not-allowed disabled:opacity-50",
            error
              ? "border-[var(--admin-status-cancelled-text)]"
              : "border-[var(--admin-border-form)]"
          )}
        />
        <button
          type="button"
          onClick={onAdd}
          disabled={disabled || !draft.trim()}
          className="inline-flex h-10 items-center justify-center gap-1.5 rounded-[var(--admin-radius-control)] px-4 text-sm font-semibold text-[var(--admin-body)] outline-none transition-colors hover:bg-[var(--admin-panel-muted)] focus-visible:ring-2 focus-visible:ring-[var(--admin-focus)]/55 disabled:opacity-50"
        >
          <Plus className="size-4" aria-hidden="true" />
          Add
        </button>
      </div>

      {error ? (
        <p
          id={errorId}
          role="alert"
          aria-live="polite"
          aria-atomic="true"
          className="text-xs text-[var(--admin-status-cancelled-text)]"
        >
          {error}
        </p>
      ) : (
        <p id={helperId} className="text-xs text-[var(--admin-text-muted)]">
          {cities.length} {cities.length === 1 ? "area" : "areas"} configured.
        </p>
      )}
    </div>
  );
}
