"use client";

import { useActionState, useEffect, useId, useState } from "react";
import { toast } from "sonner";
import { Loader2, XCircle } from "lucide-react";
import { AdminPanel } from "@/app/admin/components/admin-ui";
import {
  saveNotificationSettings,
  type SaveNotificationSettingsState,
} from "./actions";
import { NOTIFICATION_ALERT_TYPES } from "./alert-types";

// C-08 Phase D Step 17 (brief §2.8) — labels for the locked alert-type keys.
const ALERT_TYPE_LABELS: Record<(typeof NOTIFICATION_ALERT_TYPES)[number], string> = {
  new_booking_request: "New booking request",
  booking_cancelled: "Booking cancelled",
  reschedule_request: "Reschedule request",
  enquiry_logged: "Enquiry logged",
  slot_claimed: "Slot claimed",
};

interface NotificationPrefs {
  enabled?: boolean;
  types?: Record<string, boolean>;
}

interface NotificationSettingsCardProps {
  loginEmail: string;
  notificationEmail: string | null;
  prefs: NotificationPrefs | null | undefined;
}

const initialState: SaveNotificationSettingsState = {};

export function NotificationSettingsCard({
  loginEmail,
  notificationEmail,
  prefs,
}: NotificationSettingsCardProps) {
  const [state, formAction, pending] = useActionState(
    saveNotificationSettings,
    initialState
  );
  const fieldId = useId();

  // Master toggle — unset/NULL prefs means never opted in.
  const [enabled, setEnabled] = useState(prefs?.enabled === true);

  useEffect(() => {
    if (state.success) toast.success("Notification settings saved.");
    else if (state.error) toast.error(state.error);
  }, [state.success, state.error]);

  return (
    <AdminPanel
      title="Notifications"
      titleAs="h2"
      description="Choose which business alerts reach you, and where."
    >
      <form action={formAction} className="grid gap-4">
        <div className="grid gap-1.5">
          <label
            htmlFor={`${fieldId}-email`}
            className="text-sm font-medium text-[var(--admin-heading)]"
          >
            Notification email
          </label>
          <input
            id={`${fieldId}-email`}
            name="notification_email"
            type="email"
            defaultValue={notificationEmail ?? ""}
            placeholder={loginEmail}
            className="flex h-11 w-full rounded-[var(--admin-radius-control)] border border-[var(--admin-border-form)] bg-[var(--admin-surface-input)] px-3 py-2 text-sm text-[var(--admin-body)] outline-none transition-colors placeholder:text-[var(--admin-text-muted)] focus-visible:border-[var(--admin-focus)] focus-visible:ring-2 focus-visible:ring-[var(--admin-focus)]/30"
          />
          <p className="text-xs leading-5 text-[var(--admin-text-muted)]">
            Business alerts (new bookings, enquiries, cancellations) are sent
            to this address. Leave empty to use your login email (
            {loginEmail}).
          </p>
        </div>

        <label
          htmlFor={`${fieldId}-enabled`}
          className="flex min-h-11 items-center gap-2.5 rounded-[var(--admin-radius-control)] border border-[var(--admin-border-form)] bg-[var(--admin-surface-input)] px-3 py-2 text-sm text-[var(--admin-body)]"
        >
          <input
            id={`${fieldId}-enabled`}
            name="enabled"
            type="checkbox"
            checked={enabled}
            onChange={(event) => setEnabled(event.target.checked)}
            className="size-4 shrink-0 rounded border-[var(--admin-border-form)] text-[var(--admin-primary)] focus-visible:ring-2 focus-visible:ring-[var(--admin-focus)]/55"
          />
          <span className="font-medium">Receive business alerts</span>
        </label>

        <fieldset className="grid gap-2" disabled={!enabled}>
          <legend className="mb-0.5 text-sm font-medium text-[var(--admin-heading)]">
            Alert types
          </legend>
          {NOTIFICATION_ALERT_TYPES.map((type) => (
            <label
              key={type}
              htmlFor={`${fieldId}-${type}`}
              className={`flex min-h-11 items-center gap-2.5 rounded-[var(--admin-radius-control)] border border-[var(--admin-border-form)] bg-[var(--admin-surface-input)] px-3 py-2 text-sm text-[var(--admin-body)] transition-opacity ${
                enabled ? "" : "opacity-50"
              }`}
            >
              <input
                id={`${fieldId}-${type}`}
                name={`type_${type}`}
                type="checkbox"
                // A `types` key absent for this alert type (or `types` /
                // `prefs` absent entirely) defaults ON — this must match
                // resolveBusinessNotificationRecipients's own filter
                // (`prefs.types?.[type] !== false`) exactly. Rendering an
                // unchecked box here while the resolver still sends the
                // alert would be a silent, confusing divergence.
                defaultChecked={prefs?.types?.[type] !== false}
                disabled={!enabled}
                className="size-4 shrink-0 rounded border-[var(--admin-border-form)] text-[var(--admin-primary)] focus-visible:ring-2 focus-visible:ring-[var(--admin-focus)]/55 disabled:cursor-not-allowed"
              />
              {ALERT_TYPE_LABELS[type]}
            </label>
          ))}
        </fieldset>

        {state.error ? (
          <div
            role="alert"
            aria-live="polite"
            aria-atomic="true"
            className="flex items-start gap-2.5 rounded-[var(--admin-radius-control)] bg-[var(--admin-danger-bg)] px-3 py-2.5 text-sm text-[var(--admin-danger)]"
          >
            <XCircle className="mt-0.5 size-4 shrink-0" aria-hidden="true" />
            <span>{state.error}</span>
          </div>
        ) : null}

        <div className="flex justify-end">
          <button
            type="submit"
            aria-busy={pending || undefined}
            disabled={pending}
            className="inline-flex h-11 items-center justify-center gap-1.5 rounded-[var(--admin-radius-control)] bg-[var(--admin-primary)] px-4 text-sm font-semibold text-[var(--admin-on-primary)] outline-none transition-colors duration-150 hover:bg-[var(--admin-primary-hover)] focus-visible:ring-2 focus-visible:ring-[var(--admin-focus)]/55 disabled:cursor-not-allowed disabled:opacity-60"
          >
            {pending ? (
              <Loader2
                className="size-4 shrink-0 animate-spin motion-reduce:animate-none"
                aria-hidden="true"
              />
            ) : null}
            {pending ? "Saving…" : "Save notification settings"}
          </button>
        </div>
      </form>
    </AdminPanel>
  );
}
