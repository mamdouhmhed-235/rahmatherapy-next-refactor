"use client";

import { forwardRef, useActionState, useEffect, useRef, useState } from "react";
import { useRouter } from "next/navigation";
import { Download, Loader2 } from "lucide-react";
import { toast } from "sonner";
import { cn } from "@/lib/utils";
import { ConfirmActionModal } from "../components/admin-ui-interactions";
import {
  updatePrivacyRequestStatus,
  type PrivacyActionState,
} from "./actions";
import { generateClientDataExport } from "./data-export";

const initialState: PrivacyActionState = {};

const STATUS_OPTIONS: { value: string; label: string }[] = [
  { value: "open", label: "Received" },
  { value: "reviewing", label: "Reviewing" },
  { value: "completed", label: "Completed" },
  { value: "declined", label: "Declined" },
];

const STATUS_LABEL: Record<string, string> = {
  open: "Received",
  reviewing: "Reviewing",
  completed: "Completed",
  declined: "Declined",
};

function isDestructive(value: string) {
  return value === "completed" || value === "declined";
}

/**
 * What "Completed" actually does, per request type (brief §4.4).
 *
 * The single line this replaces promised a deletion and a customer email for
 * every request type, and did neither — the modal was the "UI lie" C-06 exists
 * to kill. `deletion_review` is now the only type that performs work beyond the
 * status flip, and the `data_export` copy says plainly that the download lands
 * on the privacy manager's device, not in the client's inbox (brief Q9.7 —
 * emailing the client needs a template and delivery flow, which is C-08).
 */
const COMPLETION_DESCRIPTION: Record<string, string> = {
  deletion_review:
    "Marking complete will hide this client's profile from the admin, cancel their open bookings, and permanently delete any sensitive health notes. Past completed bookings stay for tax and ICO records. Only the notes are unrecoverable — the profile is hidden, not erased.",
  data_export:
    "Use Download export now to save the client's data as a JSON file, excluding sensitive health notes. The file downloads to this device for you to check and send on — the client is not emailed. Marking complete then records the request as fulfilled.",
  correction:
    "Corrections are made by hand on the client record. Marking complete records that you have made them — nothing else changes.",
  sensitive_note_review:
    "Sensitive-note reviews are carried out by hand in the notes queue. Marking complete records that you have finished the review — nothing else changes.",
};

const COMPLETION_FALLBACK_DESCRIPTION =
  "Marking complete records that you have finished this request by hand — nothing else changes.";

export function PrivacyStatusForm({
  requestId,
  requestType,
  status,
}: {
  requestId: string;
  requestType: string;
  status: string;
}) {
  const router = useRouter();
  const [state, formAction, pending] = useActionState(
    updatePrivacyRequestStatus,
    initialState
  );
  const [selectedStatus, setSelectedStatus] = useState(status);
  const formRef = useRef<HTMLFormElement>(null);
  const lastSubmittedRef = useRef<string | null>(null);

  // Reset local state when server confirms the new value (so the select tracks the row's true status).
  useEffect(() => {
    // eslint-disable-next-line react-hooks/set-state-in-effect
    setSelectedStatus(status);
  }, [status]);

  // Surface success / failure as Sonner toasts, then refresh to migrate the row.
  useEffect(() => {
    if (state.success && lastSubmittedRef.current) {
      const label = STATUS_LABEL[lastSubmittedRef.current] ?? lastSubmittedRef.current;
      toast.success(`Request marked ${label.toLowerCase()}.`);
      lastSubmittedRef.current = null;
      router.refresh();
    } else if (state.error) {
      // The server's own message, not a generic one: a `deletion_review`
      // completion can now half-succeed (status saved, erasure failed), and
      // "Couldn't update the request" would be untrue in exactly that case.
      toast.error(state.error, {
        duration: Infinity,
        action: {
          label: "Retry",
          onClick: () => formRef.current?.requestSubmit(),
        },
      });
      lastSubmittedRef.current = null;
    }
  }, [state, router]);

  const unchanged = selectedStatus === status;
  const destructive = isDestructive(selectedStatus);
  const selectClass = cn(
    "h-10 w-full rounded-[var(--admin-radius-control)] border bg-[var(--admin-surface-input)] px-3 text-sm font-medium text-[var(--admin-body)] outline-none transition-colors focus-visible:border-[var(--admin-focus)] focus-visible:ring-2 focus-visible:ring-[var(--admin-focus)]/30",
    state.error
      ? "border-[oklch(26%_0.14_25)]"
      : "border-[var(--admin-border-form)]"
  );

  // Used to remember which status we just dispatched so the success toast can name it.
  function rememberSubmission() {
    lastSubmittedRef.current = selectedStatus;
  }

  // Live region announcement target (for pending state when SR users want feedback).
  const liveMessage = pending
    ? `Saving request status to ${STATUS_LABEL[selectedStatus] ?? selectedStatus}.`
    : "";

  return (
    <form
      ref={formRef}
      action={formAction}
      aria-busy={pending || undefined}
      onSubmit={rememberSubmission}
      className="grid gap-3 rounded-[var(--admin-radius-card)] bg-[var(--admin-panel-muted)]/55 p-3 sm:p-4"
    >
      <input type="hidden" name="request_id" value={requestId} />

      <div className="grid gap-1.5">
        <label
          htmlFor={`privacy-status-${requestId}`}
          className="text-xs font-medium uppercase tracking-[0.04em] text-[var(--admin-text-muted)]"
        >
          Status
          <span aria-hidden="true" className="ml-0.5 text-[var(--admin-status-cancelled-text)]">
            *
          </span>
        </label>
        <select
          id={`privacy-status-${requestId}`}
          name="status"
          value={selectedStatus}
          onChange={(e) => setSelectedStatus(e.target.value)}
          className={selectClass}
        >
          {STATUS_OPTIONS.map((option) => (
            <option key={option.value} value={option.value}>
              {option.label}
            </option>
          ))}
        </select>
      </div>

      <div className="flex flex-wrap items-center justify-end gap-2">
        {/*
          The export has to be reachable for a request that is already
          completed — the state the live request is in. Inside the modal alone
          it was not: the only way there is the "Mark request as completed?"
          confirmation, which is the wrong question to answer when all you want
          is the file, and nonsense for a request that is already fulfilled.
          RBAC is untouched — the page renders this form only for
          `manage_privacy_operations`, and the action re-checks the permission
          server-side before it reads a row.
        */}
        {requestType === "data_export" ? (
          <ExportDownloadButton requestId={requestId} />
        ) : null}
        {destructive ? (
          <ConfirmActionModal
            title={
              selectedStatus === "completed"
                ? "Mark request as completed?"
                : "Decline this request?"
            }
            description={
              selectedStatus === "completed"
                ? COMPLETION_DESCRIPTION[requestType] ??
                  COMPLETION_FALLBACK_DESCRIPTION
                : "The customer keeps the right to escalate to the ICO. Make sure the reason is recorded in the request note or client notes."
            }
            confirmLabel={
              selectedStatus === "completed" ? "Mark completed" : "Decline"
            }
            cancelLabel="Cancel"
            // A deletion_review completion cancels open bookings and hard-deletes
            // sensitive notes, so it gets the destructive treatment rather than
            // the success tick.
            destructive={
              selectedStatus === "declined" ||
              (selectedStatus === "completed" &&
                requestType === "deletion_review")
            }
            onConfirm={() => {
              rememberSubmission();
              formRef.current?.requestSubmit();
            }}
            trigger={<SaveStatusButton pending={pending} unchanged={unchanged} />}
          >
            {selectedStatus === "completed" && requestType === "data_export" ? (
              <ExportDownloadButton requestId={requestId} className="w-full" />
            ) : null}
          </ConfirmActionModal>
        ) : (
          <SaveStatusButton type="submit" pending={pending} unchanged={unchanged} />
        )}
      </div>

      <span role="status" aria-live="polite" className="sr-only">
        {liveMessage}
      </span>
    </form>
  );
}

/**
 * Builds the Article 15 export and hands it to the browser.
 *
 * The Blob is assembled here rather than served with a `Content-Disposition`
 * header because a server action's return value travels inside the RSC flight
 * payload — it cannot carry HTTP headers, and React's flight serialiser rejects
 * a `Response` instance outright. See the note on `generateClientDataExport`.
 */
function ExportDownloadButton({
  requestId,
  className,
}: {
  requestId: string;
  className?: string;
}) {
  const [downloading, setDownloading] = useState(false);

  async function handleDownload() {
    setDownloading(true);
    try {
      const result = await generateClientDataExport(requestId);
      if (!result.json || !result.filename) {
        toast.error(result.error ?? "Couldn't build that export. Try again.");
        return;
      }

      const url = URL.createObjectURL(
        new Blob([result.json], { type: "application/json" })
      );
      const anchor = document.createElement("a");
      anchor.href = url;
      anchor.download = result.filename;
      document.body.appendChild(anchor);
      anchor.click();
      anchor.remove();
      URL.revokeObjectURL(url);
      toast.success("Export downloaded.");
    } catch {
      toast.error("Couldn't build that export. Try again.");
    } finally {
      setDownloading(false);
    }
  }

  return (
    <button
      type="button"
      onClick={handleDownload}
      disabled={downloading}
      aria-busy={downloading || undefined}
      className={cn(
        "inline-flex min-h-10 items-center justify-center gap-1.5 rounded-[var(--admin-radius-control)] border border-[var(--admin-border-form)] bg-transparent px-4 text-sm font-semibold text-[var(--admin-body)] outline-none transition-colors hover:bg-[var(--admin-panel-muted)] focus-visible:ring-2 focus-visible:ring-[var(--admin-focus)]/55 disabled:opacity-60 disabled:pointer-events-none",
        className
      )}
    >
      {downloading ? (
        <Loader2 className="size-4 shrink-0 animate-spin" aria-hidden="true" />
      ) : (
        <Download className="size-4 shrink-0" aria-hidden="true" />
      )}
      Download export now
    </button>
  );
}

const SaveStatusButton = forwardRef<
  HTMLButtonElement,
  React.ButtonHTMLAttributes<HTMLButtonElement> & {
    pending: boolean;
    unchanged: boolean;
  }
>(function SaveStatusButton({ pending, unchanged, type = "button", ...rest }, ref) {
  return (
    <button
      ref={ref}
      type={type}
      disabled={pending || unchanged}
      {...rest}
      className={cn(
        "inline-flex min-h-10 items-center justify-center gap-1.5 rounded-[var(--admin-radius-control)] px-4 text-sm font-semibold text-[var(--admin-on-primary)] outline-none transition-colors focus-visible:ring-2 focus-visible:ring-[var(--admin-focus)]/55 disabled:opacity-60 disabled:pointer-events-none",
        "bg-[var(--admin-primary)] hover:bg-[var(--admin-primary-hover)]"
      )}
    >
      {pending ? (
        <Loader2 className="size-4 shrink-0 animate-spin" aria-hidden="true" />
      ) : null}
      Save status
    </button>
  );
});
