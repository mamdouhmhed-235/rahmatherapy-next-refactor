"use client";

import { useActionState, useEffect } from "react";
import { useRouter } from "next/navigation";
import { Loader2, Save } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Textarea } from "@/components/ui/textarea";
import {
  addClientNote,
  createClientPrivacyRequest,
  type ClientActionState,
} from "../actions";

const initialState: ClientActionState = {};
const selectClass =
  "h-10 rounded-md border border-[var(--rahma-border)] bg-white px-3 text-sm text-[var(--rahma-charcoal)] outline-none focus:ring-2 focus:ring-[var(--rahma-green)]/20";

export function ClientNoteForm({ clientId }: { clientId: string }) {
  const router = useRouter();
  const [state, action, pending] = useActionState(addClientNote, initialState);

  useEffect(() => {
    if (state.success) router.refresh();
  }, [router, state.success]);

  return (
    <form action={action} className="grid gap-3">
      <input type="hidden" name="client_id" value={clientId} />
      {state.error ? <ErrorMessage message={state.error} /> : null}
      <label className="grid gap-1.5">
        <span className="text-sm font-medium text-[var(--rahma-charcoal)]">
          Add sensitive client note
        </span>
        <Textarea name="note" rows={4} />
        {state.fieldErrors?.note ? (
          <span className="text-xs text-red-600">{state.fieldErrors.note}</span>
        ) : null}
      </label>
      <Button type="submit" size="sm" disabled={pending}>
        {pending ? <Loader2 className="size-4 animate-spin" /> : <Save className="size-4" />}
        Add note
      </Button>
    </form>
  );
}

export function ClientPrivacyRequestForm({ clientId }: { clientId: string }) {
  const router = useRouter();
  const [state, action, pending] = useActionState(
    createClientPrivacyRequest,
    initialState
  );

  useEffect(() => {
    if (state.success) router.refresh();
  }, [router, state.success]);

  return (
    <form action={action} className="grid gap-3">
      <input type="hidden" name="client_id" value={clientId} />
      {state.error ? <ErrorMessage message={state.error} /> : null}
      <label className="grid gap-1.5">
        <span className="text-sm font-medium text-[var(--rahma-charcoal)]">
          Privacy workflow
        </span>
        <select name="request_type" defaultValue="data_export" className={selectClass}>
          <option value="data_export">Data export request</option>
          <option value="correction">Correction request</option>
          <option value="deletion_review">Deletion request review</option>
          <option value="sensitive_note_review">Sensitive note review</option>
        </select>
      </label>
      <label className="grid gap-1.5">
        <span className="text-sm font-medium text-[var(--rahma-charcoal)]">
          Request note
        </span>
        <Textarea name="request_note" rows={3} />
      </label>
      <Button type="submit" size="sm" variant="outline" disabled={pending}>
        {pending ? <Loader2 className="size-4 animate-spin" /> : <Save className="size-4" />}
        Record request
      </Button>
    </form>
  );
}

function ErrorMessage({ message }: { message: string }) {
  return (
    <p className="rounded-lg border border-red-200 bg-red-50 px-3 py-2 text-sm text-red-600">
      {message}
    </p>
  );
}
