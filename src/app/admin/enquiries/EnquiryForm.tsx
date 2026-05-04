"use client";

import { useActionState, useEffect } from "react";
import { useRouter } from "next/navigation";
import { Loader2, Plus } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Textarea } from "@/components/ui/textarea";
import { createEnquiry, type EnquiryActionState } from "./actions";

interface StaffOption {
  id: string;
  name: string;
}

const initialState: EnquiryActionState = {};
const inputClass =
  "h-10 rounded-md border border-[var(--rahma-border)] bg-white px-3 text-sm text-[var(--rahma-charcoal)] outline-none focus:ring-2 focus:ring-[var(--rahma-green)]/20";

export function EnquiryForm({ staff }: { staff: StaffOption[] }) {
  const router = useRouter();
  const [state, action, pending] = useActionState(createEnquiry, initialState);

  useEffect(() => {
    if (state.success) router.refresh();
  }, [router, state.success]);

  return (
    <form action={action} className="grid gap-4 rounded-lg border border-[var(--rahma-border)] bg-white p-5">
      <h2 className="font-display text-lg font-semibold text-[var(--rahma-charcoal)]">
        Record enquiry
      </h2>
      {state.error ? (
        <p className="rounded-lg border border-red-200 bg-red-50 px-3 py-2 text-sm text-red-600">
          {state.error}
        </p>
      ) : null}
      <div className="grid gap-4 md:grid-cols-2">
        <Field label="Name" error={state.fieldErrors?.full_name}>
          <input name="full_name" className={inputClass} required />
        </Field>
        <Field label="Source" error={state.fieldErrors?.source}>
          <select name="source" defaultValue="whatsapp" className={inputClass}>
            <option value="website">Website</option>
            <option value="phone">Phone</option>
            <option value="whatsapp">WhatsApp</option>
            <option value="instagram">Instagram</option>
            <option value="referral">Referral</option>
            <option value="other">Other</option>
          </select>
        </Field>
        <Field label="Phone">
          <input name="phone" className={inputClass} />
        </Field>
        <Field label="Email" error={state.fieldErrors?.email}>
          <input name="email" type="email" className={inputClass} />
        </Field>
        <Field label="Service interest">
          <input name="service_interest" className={inputClass} />
        </Field>
        <Field label="Owner">
          <select name="assigned_staff_id" defaultValue="" className={inputClass}>
            <option value="">Unassigned</option>
            {staff.map((member) => (
              <option key={member.id} value={member.id}>
                {member.name}
              </option>
            ))}
          </select>
        </Field>
      </div>
      <Field label="Enquiry notes">
        <Textarea name="notes" rows={4} />
      </Field>
      <Button type="submit" size="sm" disabled={pending}>
        {pending ? <Loader2 className="size-4 animate-spin" /> : <Plus className="size-4" />}
        Save enquiry
      </Button>
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
