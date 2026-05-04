"use client";

import { useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import { Loader2, Save, Settings } from "lucide-react";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
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
  allowed_cities: string[];
  booking_status_enabled: boolean;
}

interface SettingsFormProps {
  settings: BusinessSettings;
}

export function SettingsForm({ settings }: SettingsFormProps) {
  const router = useRouter();
  const [isPending, startTransition] = useTransition();
  const [state, setState] = useState<SettingsActionState>({});

  function handleSubmit(event: React.FormEvent<HTMLFormElement>) {
    event.preventDefault();
    const formData = new FormData(event.currentTarget);

    startTransition(async () => {
      const result = await updateBusinessSettings({}, formData);

      if (result.error || result.fieldErrors) {
        setState(result);
        if (result.error) toast.error(result.error);
        return;
      }

      setState({});
      toast.success("Settings updated");
      router.refresh();
    });
  }

  return (
    <form onSubmit={handleSubmit}>
      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2 text-lg font-semibold">
            <Settings className="size-5 text-[var(--rahma-green)]" />
            Business Rules
          </CardTitle>
        </CardHeader>
        <CardContent className="space-y-6">
          {state.error ? (
            <p className="rounded-lg border border-red-200 bg-red-50 px-3 py-2 text-sm text-red-600">
              {state.error}
            </p>
          ) : null}

          <SettingsGroup title="Contact details">
            <div className="grid gap-4 md:grid-cols-2">
            <Field label="Company name" error={state.fieldErrors?.company_name}>
              <Input
                name="company_name"
                defaultValue={settings.company_name}
                disabled={isPending}
                required
              />
            </Field>

            <Field label="Contact phone">
              <Input
                name="contact_phone"
                defaultValue={settings.contact_phone ?? ""}
                disabled={isPending}
              />
            </Field>

            <Field label="Contact email">
              <Input
                name="contact_email"
                type="email"
                defaultValue={settings.contact_email ?? ""}
                disabled={isPending}
              />
            </Field>
            </div>
          </SettingsGroup>

          <SettingsGroup title="Booking availability">
            <div className="grid gap-4 md:grid-cols-2">
              <Field
                label="Booking window days"
                error={state.fieldErrors?.booking_window_days}
              >
                <Input
                  name="booking_window_days"
                  type="number"
                  min="1"
                  step="1"
                  defaultValue={settings.booking_window_days}
                  disabled={isPending}
                  required
                />
              </Field>

              <Field
                label="Minimum notice hours"
                error={state.fieldErrors?.minimum_notice_hours}
              >
                <Input
                  name="minimum_notice_hours"
                  type="number"
                  min="0"
                  step="1"
                  defaultValue={settings.minimum_notice_hours}
                  disabled={isPending}
                  required
                />
              </Field>

              <Field
                label="Travel buffer minutes"
                error={state.fieldErrors?.buffer_time_mins}
              >
                <Input
                  name="buffer_time_mins"
                  type="number"
                  min="0"
                  step="1"
                  defaultValue={settings.buffer_time_mins}
                  disabled={isPending}
                  required
                />
              </Field>
            </div>
          </SettingsGroup>

          <SettingsGroup title="Cancellation cutoff">
            <Field
              label="Customer cancellation cutoff hours"
              error={state.fieldErrors?.customer_cancellation_cutoff_hours}
            >
              <Input
                name="customer_cancellation_cutoff_hours"
                type="number"
                min="0"
                step="1"
                defaultValue={settings.customer_cancellation_cutoff_hours}
                disabled={isPending}
                required
              />
            </Field>
          </SettingsGroup>

          <SettingsGroup title="Service areas">
            <Field
              label="Allowed service areas"
              error={state.fieldErrors?.allowed_cities}
            >
              <Textarea
                name="allowed_cities"
                rows={5}
                defaultValue={settings.allowed_cities.join("\n")}
                disabled={isPending}
              />
            </Field>
          </SettingsGroup>

          <SettingsGroup title="Payment expectations and email readiness">
            <label className="flex items-center gap-2 text-sm text-[var(--rahma-charcoal)]">
              <input
                name="booking_status_enabled"
                type="checkbox"
                defaultChecked={settings.booking_status_enabled}
                disabled={isPending}
                className="size-4 accent-[var(--rahma-green)]"
              />
              Accept new booking requests and confirmation emails when configured
            </label>
          </SettingsGroup>

          <div className="flex justify-end">
            <Button type="submit" disabled={isPending}>
              {isPending ? (
                <Loader2 className="size-4 animate-spin" />
              ) : (
                <Save className="size-4" />
              )}
              Save settings
            </Button>
          </div>
        </CardContent>
      </Card>
    </form>
  );
}

function SettingsGroup({
  title,
  children,
}: {
  title: string;
  children: React.ReactNode;
}) {
  return (
    <section className="rounded-lg border border-[var(--rahma-border)] bg-white/70 p-4">
      <h3 className="mb-3 text-sm font-semibold text-[var(--rahma-charcoal)]">
        {title}
      </h3>
      {children}
    </section>
  );
}

function Field({
  label,
  error,
  children,
}: {
  label: string;
  error?: string;
  children: React.ReactNode;
}) {
  return (
    <label className="grid gap-1.5">
      <span className="text-sm font-medium text-[var(--rahma-charcoal)]">
        {label}
      </span>
      {children}
      {error ? <span className="text-xs text-red-600">{error}</span> : null}
    </label>
  );
}
