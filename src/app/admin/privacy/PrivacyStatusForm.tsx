"use client";

import { useActionState, useEffect } from "react";
import { useRouter } from "next/navigation";
import { Loader2 } from "lucide-react";
import { Button } from "@/components/ui/button";
import {
  updatePrivacyRequestStatus,
  type PrivacyActionState,
} from "./actions";

const initialState: PrivacyActionState = {};
const selectClass =
  "h-10 rounded-md border border-[var(--rahma-border)] bg-white px-3 text-sm text-[var(--rahma-charcoal)] outline-none focus:ring-2 focus:ring-[var(--rahma-green)]/20";

export function PrivacyStatusForm({
  requestId,
  status,
}: {
  requestId: string;
  status: string;
}) {
  const router = useRouter();
  const [state, action, pending] = useActionState(
    updatePrivacyRequestStatus,
    initialState
  );

  useEffect(() => {
    if (state.success) router.refresh();
  }, [router, state.success]);

  return (
    <form action={action} className="flex flex-col gap-2 sm:flex-row">
      <input type="hidden" name="request_id" value={requestId} />
      <select name="status" defaultValue={status} className={selectClass}>
        <option value="open">Open</option>
        <option value="reviewing">Reviewing</option>
        <option value="completed">Completed</option>
        <option value="declined">Declined</option>
      </select>
      <Button type="submit" size="sm" disabled={pending}>
        {pending ? <Loader2 className="size-4 animate-spin" /> : null}
        Save
      </Button>
      {state.error ? (
        <p className="text-sm text-red-600 sm:self-center">{state.error}</p>
      ) : null}
    </form>
  );
}
