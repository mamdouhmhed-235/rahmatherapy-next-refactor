"use client";

import Link from "next/link";
import { useState } from "react";
import { toast } from "sonner";
import { Dialog as BaseDialog } from "@base-ui/react/dialog";
import {
  History,
  Loader2,
  Lock,
  Power,
  RotateCcw,
  Trash2,
} from "lucide-react";

interface DangerZonePanelProps {
  roleId: string;
  displayLabel: string;
  active: boolean;
  isSystem: boolean;
  isInactiveSystem: boolean;
  staffCount: number;
  /** id of the live `RoleMetadataForm` so Deactivate/Reactivate can submit
      it with the active checkbox flipped — preserving any unsaved edits. */
  metadataFormId: string;
}

type Flow = "deactivate" | "delete" | null;

export function DangerZonePanel({
  roleId,
  displayLabel,
  active,
  isSystem,
  isInactiveSystem,
  staffCount,
  metadataFormId,
}: DangerZonePanelProps) {
  const [flow, setFlow] = useState<Flow>(null);
  const [submitting, setSubmitting] = useState(false);

  // System roles never deactivate/reactivate. The seed's "Inactive" system role
  // is treated as inactive in the chip but has no lifecycle controls.
  const showDeactivate = active && !isSystem && !isInactiveSystem;
  const showReactivate = !active && !isSystem;
  const canDelete = !isSystem && staffCount === 0;

  function flipActiveAndSubmit(target: "on" | "off") {
    const form = document.getElementById(metadataFormId) as HTMLFormElement | null;
    if (!form) {
      toast.error("Couldn't reach the role details form. Refresh and try again.");
      return;
    }
    const activeInput = form.querySelector(
      'input[name="active"][type="checkbox"]'
    ) as HTMLInputElement | null;
    if (activeInput) activeInput.checked = target === "on";
    setSubmitting(true);
    form.requestSubmit();
    // Reset submitting after a short delay; the form's own state takes over UI.
    setTimeout(() => setSubmitting(false), 1000);
  }

  return (
    <div className="grid gap-3">
      {isSystem ? (
        <p
          className="flex items-start gap-2 rounded-[var(--admin-radius-control)] bg-[oklch(94%_0.008_280)] px-3 py-2 text-xs leading-5 text-[oklch(30%_0.02_280)]"
          role="note"
        >
          <Lock className="mt-0.5 size-3.5 shrink-0" aria-hidden="true" />
          <span>System roles can&apos;t be deleted.</span>
        </p>
      ) : null}

      {showDeactivate ? (
        <button
          type="button"
          onClick={() => setFlow("deactivate")}
          disabled={submitting}
          aria-busy={submitting || undefined}
          className="inline-flex min-h-10 w-full items-center justify-center gap-1.5 rounded-[var(--admin-radius-control)] border border-[var(--admin-border-form)] bg-transparent px-4 text-sm font-semibold text-[var(--admin-body)] outline-none transition-colors hover:bg-[var(--admin-panel-muted)] focus-visible:ring-2 focus-visible:ring-[var(--admin-focus)]/55 disabled:cursor-not-allowed disabled:opacity-60"
        >
          {submitting ? (
            <Loader2 className="size-4 shrink-0 animate-spin" aria-hidden="true" />
          ) : (
            <Power className="size-4" aria-hidden="true" />
          )}
          Deactivate role
        </button>
      ) : null}

      {showReactivate ? (
        <button
          type="button"
          onClick={() => flipActiveAndSubmit("on")}
          disabled={submitting}
          aria-busy={submitting || undefined}
          className="inline-flex min-h-10 w-full items-center justify-center gap-1.5 rounded-[var(--admin-radius-control)] border border-[var(--admin-border-form)] bg-transparent px-4 text-sm font-semibold text-[var(--admin-body)] outline-none transition-colors hover:bg-[var(--admin-panel-muted)] focus-visible:ring-2 focus-visible:ring-[var(--admin-focus)]/55 disabled:cursor-not-allowed disabled:opacity-60"
        >
          {submitting ? (
            <Loader2 className="size-4 shrink-0 animate-spin" aria-hidden="true" />
          ) : (
            <RotateCcw className="size-4" aria-hidden="true" />
          )}
          Reactivate role
        </button>
      ) : null}

      {!isSystem ? (
        <button
          type="button"
          onClick={() => setFlow("delete")}
          disabled={!canDelete}
          data-redesign-fake="delete-role"
          aria-disabled={!canDelete || undefined}
          title={
            !canDelete
              ? staffCount > 0
                ? `Reassign ${staffCount} staff first`
                : "Delete is unavailable for this role"
              : "Delete this role permanently"
          }
          className="inline-flex min-h-10 w-full items-center justify-center gap-1.5 rounded-[var(--admin-radius-control)] bg-[oklch(40%_0.14_25)] px-4 text-sm font-semibold text-white outline-none transition-colors hover:bg-[oklch(33%_0.14_25)] focus-visible:ring-2 focus-visible:ring-[var(--admin-focus)]/55 disabled:cursor-not-allowed disabled:bg-[var(--admin-panel-muted)] disabled:text-[var(--admin-text-muted)]"
        >
          <Trash2 className="size-4" aria-hidden="true" />
          Delete role
        </button>
      ) : null}

      {!canDelete && !isSystem ? (
        <p className="text-xs leading-5 text-[var(--admin-text-muted)]">
          {staffCount > 0 ? (
            <>
              Delete is available when no staff hold this role. Reassign{" "}
              <strong>{staffCount}</strong> staff first.
            </>
          ) : (
            "Delete becomes available once this role has no staff."
          )}
        </p>
      ) : null}

      {/* Audit trail link — surfaces who changed permissions and when. */}
      <Link
        href={`/admin/audit?target_type=roles&target_id=${roleId}`}
        className="inline-flex min-h-9 w-full items-center justify-center gap-1.5 rounded-[var(--admin-radius-control)] px-3 text-xs font-medium text-[var(--admin-body)] outline-none transition-colors hover:bg-[var(--admin-panel-muted)] hover:text-[var(--admin-heading)] focus-visible:ring-2 focus-visible:ring-[var(--admin-focus)]/55"
        title="See who changed this role's permissions and when"
      >
        <History className="size-3.5" aria-hidden="true" />
        Open audit trail
      </Link>

      <BaseDialog.Root
        open={flow !== null}
        onOpenChange={(open) => {
          if (!open) setFlow(null);
        }}
      >
        <BaseDialog.Portal>
          <BaseDialog.Backdrop className="fixed inset-0 z-50 bg-[oklch(12%_0.01_165)]/35 backdrop-blur-sm" />
          <BaseDialog.Popup className="fixed left-1/2 top-[28vh] z-50 w-[min(calc(100vw-2rem),28rem)] -translate-x-1/2 rounded-[var(--admin-radius-card)] border border-[var(--admin-border)] bg-[var(--admin-panel)] p-5 shadow-[var(--admin-shadow-overlay)] outline-none">
            <div className="flex items-start gap-3">
              <span className="mt-0.5 inline-flex size-9 shrink-0 items-center justify-center rounded-full bg-[oklch(95.5%_0.028_20)]">
                {flow === "delete" ? (
                  <Trash2
                    className="size-5 text-[oklch(26%_0.14_25)]"
                    aria-hidden="true"
                  />
                ) : (
                  <Power
                    className="size-5 text-[oklch(26%_0.14_25)]"
                    aria-hidden="true"
                  />
                )}
              </span>
              <div className="min-w-0 flex-1">
                <BaseDialog.Title className="text-base font-semibold text-[var(--admin-heading)]">
                  {flow === "delete"
                    ? `Delete ${displayLabel}?`
                    : `Deactivate ${displayLabel}?`}
                </BaseDialog.Title>
                <BaseDialog.Description className="mt-1.5 text-sm leading-6 text-[var(--admin-text-muted)]">
                  {flow === "delete"
                    ? "This can't be undone. The role has no staff assigned, but the audit log keeps a record of every permission it held."
                    : "Staff with this role keep their assignment but won't see admin surfaces until they're moved to an active role."}
                </BaseDialog.Description>
              </div>
            </div>

            {flow === "delete" ? (
              <div
                className="mt-4 rounded-[var(--admin-radius-control)] bg-[oklch(96%_0.038_75)] px-3 py-2 text-xs leading-5 text-[oklch(28%_0.12_55)]"
                role="note"
              >
                Deletion isn&apos;t available yet. We&apos;re putting the final
                checks in place. Try again shortly.
              </div>
            ) : null}

            <div className="mt-5 flex flex-wrap-reverse justify-end gap-2">
              <BaseDialog.Close
                disabled={submitting}
                render={
                  <button
                    type="button"
                    disabled={submitting}
                    className="inline-flex min-h-10 items-center rounded-[var(--admin-radius-control)] border border-[var(--admin-border-form)] bg-transparent px-4 text-sm font-semibold text-[var(--admin-body)] outline-none transition-colors hover:bg-[var(--admin-panel-muted)] focus-visible:ring-2 focus-visible:ring-[var(--admin-focus)]/55 disabled:opacity-50"
                  >
                    Cancel
                  </button>
                }
              />
              <button
                type="button"
                aria-busy={submitting || undefined}
                disabled={submitting || flow === "delete"}
                onClick={() => {
                  if (flow === "deactivate") {
                    flipActiveAndSubmit("off");
                    setFlow(null);
                  } else if (flow === "delete") {
                    toast.error(
                      "Couldn't delete this role right now. Try again shortly."
                    );
                    setFlow(null);
                  }
                }}
                className="inline-flex min-h-10 items-center gap-2 rounded-[var(--admin-radius-control)] bg-[oklch(40%_0.14_25)] px-4 text-sm font-semibold text-white outline-none transition-colors hover:bg-[oklch(33%_0.14_25)] focus-visible:ring-2 focus-visible:ring-[var(--admin-focus)]/55 disabled:cursor-not-allowed disabled:opacity-60"
              >
                {submitting ? (
                  <Loader2 className="size-4 shrink-0 animate-spin" aria-hidden="true" />
                ) : null}
                {flow === "delete" ? "Delete role" : "Deactivate"}
              </button>
            </div>
          </BaseDialog.Popup>
        </BaseDialog.Portal>
      </BaseDialog.Root>
    </div>
  );
}
