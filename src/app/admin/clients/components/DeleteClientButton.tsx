"use client";

import * as React from "react";
import { Trash2 } from "lucide-react";
import { toast } from "sonner";
import { cn } from "@/lib/utils";
import { ConfirmActionModal } from "../../components/admin-ui-interactions";
import { adminDeleteClient } from "../actions";

const CANCELLED_TEXT = "text-[var(--admin-status-cancelled-text)]";
const CANCELLED_BORDER = "border-[var(--admin-danger-border-soft)]";
const CANCELLED_HOVER = "hover:bg-[var(--admin-status-cancelled-bg)]";

/**
 * A successful delete answers with a redirect to `/admin/clients?deleted=1`,
 * which Next surfaces to the caller as a thrown redirect rather than a return
 * value. Re-throw it so the navigation happens; only real failures toast.
 */
function isRedirectError(error: unknown): boolean {
  const digest = (error as { digest?: unknown } | null)?.digest;
  return typeof digest === "string" && digest.startsWith("NEXT_REDIRECT");
}

export function DeleteClientButton({
  clientId,
  clientName,
  variant = "button",
}: {
  clientId: string;
  clientName: string;
  /** `menu-item` renders the row-menu shape; `button` the detail-header shape. */
  variant?: "button" | "menu-item";
}) {
  const [pending, setPending] = React.useState(false);

  async function handleDelete() {
    if (pending) return;
    setPending(true);
    try {
      const formData = new FormData();
      formData.set("client_id", clientId);
      const result = await adminDeleteClient(formData);
      if (result?.error) toast.error(result.error);
    } catch (error) {
      if (isRedirectError(error)) throw error;
      console.error("[clients] delete failed", { clientId, error });
      toast.error("Couldn't delete that client. Try again.");
    } finally {
      setPending(false);
    }
  }

  return (
    <ConfirmActionModal
      title={`Delete ${clientName} and cancel all their open bookings?`}
      confirmLabel="Delete client"
      cancelLabel="Keep client"
      destructive
      onConfirm={handleDelete}
      trigger={
        <button
          type="button"
          disabled={pending}
          aria-busy={pending || undefined}
          className={cn(
            "appearance-none items-center gap-1.5 bg-transparent text-sm font-medium outline-none transition-colors focus-visible:ring-2 focus-visible:ring-[var(--admin-focus)]/55 disabled:opacity-60",
            CANCELLED_TEXT,
            CANCELLED_HOVER,
            variant === "menu-item"
              ? "flex min-h-9 w-full rounded-[var(--admin-radius-control)] border-0 px-3 text-left"
              : cn(
                  "inline-flex h-10 shrink-0 rounded-[var(--admin-radius-control)] border px-3",
                  CANCELLED_BORDER
                )
          )}
        >
          <Trash2 className="size-4 shrink-0" aria-hidden="true" />
          {variant === "menu-item" ? "Delete client" : "Delete"}
        </button>
      }
    >
      {/* `adminDeleteClient` stamps `deleted_at` and nothing more: name, email,
          phone and address all survive, and clearing the stamp restores the
          record. Only the sensitive notes are hard-deleted, so only they can
          be claimed as irreversible — the same honesty the privacy modal's
          `deletion_review` copy now carries. */}
      <ul className="grid list-none gap-1.5 p-0 text-sm text-[var(--admin-text-muted)]">
        <li>Past completed bookings stay on the record.</li>
        <li>Sensitive health notes are deleted permanently.</li>
        <li>Only the notes are unrecoverable — the profile is hidden, not erased.</li>
      </ul>
    </ConfirmActionModal>
  );
}

/**
 * Flash toast for the `?deleted=1` / `?updated=1` redirects the client actions
 * end on. The server page decides whether to render it, so there is no
 * `useSearchParams` here — the param is then stripped from the address bar with
 * `history.replaceState` so a refresh doesn't replay the toast.
 *
 * Colocated with the delete button because both surfaces that need it — the
 * list (`?deleted=1`) and the detail page (`?updated=1`) — already reach into
 * this folder for it.
 */
export function ClientFlashToast({
  message,
  param,
}: {
  message: string;
  param: string;
}) {
  const fired = React.useRef(false);

  React.useEffect(() => {
    if (fired.current) return;
    fired.current = true;
    toast.success(message);
    const url = new URL(window.location.href);
    url.searchParams.delete(param);
    window.history.replaceState(null, "", `${url.pathname}${url.search}${url.hash}`);
  }, [message, param]);

  return null;
}
