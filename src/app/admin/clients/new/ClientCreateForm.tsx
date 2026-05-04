"use client";

import { useActionState } from "react";
import { AlertTriangle, Loader2, Save } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Textarea } from "@/components/ui/textarea";
import { createClient, type ClientActionState } from "../actions";

const initialState: ClientActionState = {};
const inputClass =
  "h-10 rounded-md border border-[var(--rahma-border)] bg-white px-3 text-sm text-[var(--rahma-charcoal)] outline-none focus:ring-2 focus:ring-[var(--rahma-green)]/20";

export function ClientCreateForm() {
  const [state, action, pending] = useActionState(createClient, initialState);

  return (
    <form action={action} className="grid gap-5">
      {state.error ? (
        <p className="rounded-lg border border-red-200 bg-red-50 px-3 py-2 text-sm text-red-600">
          {state.error}
        </p>
      ) : null}

      {state.duplicateWarning ? (
        <div className="rounded-lg border border-orange-200 bg-orange-50 px-4 py-3 text-sm text-orange-800">
          <div className="flex gap-2">
            <AlertTriangle className="mt-0.5 size-4 shrink-0" />
            <div>
              <p className="font-semibold">Possible duplicate client</p>
              <p className="mt-1">{state.duplicateWarning}</p>
              <label className="mt-3 flex items-center gap-2">
                <input name="confirm_duplicate" type="checkbox" required />
                Create a separate client profile anyway.
              </label>
            </div>
          </div>
        </div>
      ) : null}

      <section className="rounded-lg border border-[var(--rahma-border)] bg-white p-5">
        <h2 className="font-display text-lg font-semibold text-[var(--rahma-charcoal)]">
          Client details
        </h2>
        <div className="mt-4 grid gap-4 md:grid-cols-2">
          <Field label="Full name" error={state.fieldErrors?.full_name}>
            <input name="full_name" className={inputClass} required />
          </Field>
          <Field label="Source" error={state.fieldErrors?.client_source}>
            <select name="client_source" defaultValue="manual" className={inputClass}>
              <option value="website">Website</option>
              <option value="phone">Phone</option>
              <option value="whatsapp">WhatsApp</option>
              <option value="instagram">Instagram</option>
              <option value="referral">Referral</option>
              <option value="manual">Manual</option>
              <option value="other">Other</option>
            </select>
          </Field>
          <Field label="Email" error={state.fieldErrors?.email}>
            <input name="email" type="email" className={inputClass} />
          </Field>
          <Field label="Phone">
            <input name="phone" className={inputClass} />
          </Field>
          <Field label="Address">
            <input name="address" className={inputClass} />
          </Field>
          <Field label="Postcode">
            <input name="postcode" className={inputClass} />
          </Field>
          <Field label="Source detail">
            <input
              name="source_detail"
              className={inputClass}
              placeholder="Referral name, campaign, or admin context"
            />
          </Field>
        </div>
      </section>

      <section className="rounded-lg border border-[var(--rahma-border)] bg-white p-5">
        <Field label="Internal client notes">
          <Textarea name="notes" rows={5} />
        </Field>
      </section>

      <div className="sticky bottom-0 -mx-4 border-t border-[var(--rahma-border)] bg-[var(--rahma-ivory)]/95 px-4 py-3 backdrop-blur sm:static sm:mx-0 sm:border-0 sm:bg-transparent sm:px-0">
        <Button type="submit" disabled={pending}>
          {pending ? <Loader2 className="size-4 animate-spin" /> : <Save className="size-4" />}
          Create client
        </Button>
      </div>
    </form>
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
