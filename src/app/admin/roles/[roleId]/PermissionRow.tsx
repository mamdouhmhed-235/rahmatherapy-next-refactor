"use client";

import { useState, useTransition } from "react";
import { toast } from "sonner";
import { Dialog as BaseDialog } from "@base-ui/react/dialog";
import { Loader2, XCircle } from "lucide-react";
import { Switch } from "@/components/ui/switch";
import { AdminStatusBadge, type AdminTone } from "../../components/admin-ui";
import { toggleRolePermission } from "../actions";

type RiskLevel = "low" | "medium" | "high" | "critical" | null;

interface PermissionRowProps {
  roleId: string;
  roleName: string;
  roleDisplayLabel: string;
  permissionId: string;
  permissionName: string;
  permissionDescription: string | null;
  permissionCategory: string | null;
  permissionScope: string | null;
  permissionRiskLevel: string | null;
  isGranted: boolean;
  isOwnerRole: boolean;
}

const RISK_TONE: Record<Exclude<RiskLevel, null>, AdminTone> = {
  low: "restricted",
  medium: "info",
  high: "warning",
  critical: "danger",
};

const RISK_LABEL: Record<Exclude<RiskLevel, null>, string> = {
  low: "Low risk",
  medium: "Medium risk",
  high: "High risk",
  critical: "Critical risk",
};

const RISK_TOOLTIP: Record<Exclude<RiskLevel, null>, string> = {
  low: "Low risk. Cosmetic or read-only. Safe to grant.",
  medium: "Medium risk. Affects records but reversible.",
  high: "High risk. Affects records and harder to reverse. Grant deliberately.",
  critical:
    "Critical risk. Could disrupt access, billing, or compliance. Grant only when you're sure.",
};

function humanizeName(name: string): string {
  const stripped = name.replace(/_/g, " ").trim();
  return stripped.charAt(0).toUpperCase() + stripped.slice(1);
}

function asRiskLevel(value: string | null): RiskLevel {
  if (value === "low" || value === "medium" || value === "high" || value === "critical") {
    return value;
  }
  return null;
}

export function PermissionRow(props: PermissionRowProps) {
  const {
    roleId,
    roleDisplayLabel,
    permissionId,
    permissionName,
    permissionDescription,
    permissionScope,
    permissionRiskLevel,
    isGranted,
    isOwnerRole,
  } = props;
  const [pending, startTransition] = useTransition();
  const [optimistic, setOptimistic] = useState(isGranted);
  const [confirmOpen, setConfirmOpen] = useState(false);
  const riskLevel = asRiskLevel(permissionRiskLevel);
  const displayName = humanizeName(permissionName);

  function needsConfirm(direction: "grant" | "revoke"): boolean {
    if (isOwnerRole) return true;
    if (riskLevel === "critical") return true;
    if (riskLevel === "high" && direction === "grant") return true;
    return false;
  }

  function handleSwitchChange(next: boolean) {
    const direction: "grant" | "revoke" = next ? "grant" : "revoke";
    if (needsConfirm(direction)) {
      setConfirmOpen(true);
      return;
    }
    performToggle(direction);
  }

  function performToggle(direction: "grant" | "revoke") {
    const previous = optimistic;
    const next = direction === "grant";
    setOptimistic(next);

    startTransition(async () => {
      const result = await toggleRolePermission(
        roleId,
        permissionId,
        permissionName,
        previous
      );
      if (result.error) {
        setOptimistic(previous);
        toast.error(`Couldn't change ${displayName}. ${result.error}`, {
          duration: Infinity,
          action: {
            label: "Retry",
            onClick: () => performToggle(direction),
          },
        });
        return;
      }
      toast.success(
        direction === "grant"
          ? `Granted ${displayName}.`
          : `Revoked ${displayName}.`
      );
      setConfirmOpen(false);
    });
  }

  const direction: "grant" | "revoke" = optimistic ? "revoke" : "grant";
  const confirmCopy = buildConfirmCopy({
    isOwnerRole,
    riskLevel,
    direction,
    displayName,
    roleDisplayLabel,
  });

  return (
    <li
      className="group grid grid-cols-[minmax(0,1fr)_auto] items-start gap-3 rounded-[var(--admin-radius-control)] px-3 py-3 transition-colors duration-150 hover:bg-[var(--admin-hover-mist)] sm:gap-4 sm:px-4 sm:py-3.5"
      data-permission-name={permissionName}
      data-permission-risk={riskLevel ?? "unspecified"}
    >
      {/* Permission info column */}
      <div className="min-w-0">
        <div className="flex min-w-0 flex-wrap items-center gap-x-2 gap-y-1">
          <span className="min-w-0 break-words text-sm font-semibold leading-snug text-[var(--admin-heading)]">
            {displayName}
          </span>
          {permissionScope ? (
            <span
              className="inline-flex"
              title={`scope: ${permissionScope}. Applies to the rows this scope describes.`}
            >
              <AdminStatusBadge
                value={`scope: ${permissionScope}`}
                tone="restricted"
                compact
              />
            </span>
          ) : null}
          {riskLevel ? (
            <span className="inline-flex" title={RISK_TOOLTIP[riskLevel]}>
              <AdminStatusBadge
                value={RISK_LABEL[riskLevel]}
                tone={RISK_TONE[riskLevel]}
                compact
              />
            </span>
          ) : null}
        </div>
        {permissionDescription ? (
          <p className="mt-1 text-sm leading-6 text-[var(--admin-text-muted)]">
            {permissionDescription}
          </p>
        ) : null}
        <p
          className="mt-1 hidden font-mono text-xs leading-5 text-[var(--admin-text-muted)] sm:block"
          title="Appears in audit logs as this identifier"
        >
          {permissionName}
        </p>
      </div>

      {/* Switch column — wrapper provides 44px tap target on mobile while
          the Switch primitive's visual track stays at 24px (shared component).
          aria-busy on wrapper announces in-flight state to SR (the shared Switch
          primitive doesn't accept aria-busy directly). */}
      <div
        className="flex min-h-[44px] flex-col items-end justify-center gap-1.5 pt-0.5"
        data-role-detail-switch-target
        aria-busy={pending || undefined}
      >
        <Switch
          checked={optimistic}
          disabled={pending}
          onCheckedChange={handleSwitchChange}
          aria-label={`${displayName}: ${optimistic ? "granted" : "revoked"}${pending ? " (saving)" : ""}`}
        />
        <span
          className="text-[0.6875rem] font-medium uppercase tracking-[0.06em] text-[var(--admin-text-muted)]"
          aria-hidden="true"
        >
          {pending ? (
            <span className="inline-flex items-center gap-1">
              <Loader2 className="size-3 animate-spin" aria-hidden="true" />
              saving
            </span>
          ) : optimistic ? (
            "Granted"
          ) : (
            "Off"
          )}
        </span>
      </div>

      {/* Confirm dialog (high/critical/owner gated paths) */}
      <BaseDialog.Root open={confirmOpen} onOpenChange={setConfirmOpen}>
        <BaseDialog.Portal>
          <BaseDialog.Backdrop className="fixed inset-0 z-50 bg-[var(--admin-scrim)]/35 backdrop-blur-sm" />
          <BaseDialog.Popup className="fixed left-1/2 top-[24vh] z-50 w-[min(calc(100vw-2rem),28rem)] -translate-x-1/2 rounded-[var(--admin-radius-card)] border border-[var(--admin-border)] bg-[var(--admin-panel)] p-5 shadow-[var(--admin-shadow-overlay)] outline-none">
            <div className="flex items-start gap-3">
              <span className="mt-0.5 inline-flex size-9 shrink-0 items-center justify-center rounded-full bg-[var(--admin-status-cancelled-bg)]">
                <XCircle
                  className="size-5 text-[var(--admin-status-cancelled-text)]"
                  aria-hidden="true"
                />
              </span>
              <div className="min-w-0 flex-1">
                <BaseDialog.Title className="text-base font-semibold text-[var(--admin-heading)]">
                  {confirmCopy.title}
                </BaseDialog.Title>
                <BaseDialog.Description className="mt-1.5 text-sm leading-6 text-[var(--admin-text-muted)]">
                  {confirmCopy.body}
                </BaseDialog.Description>
              </div>
            </div>
            <div className="mt-5 flex flex-wrap-reverse justify-end gap-2">
              <BaseDialog.Close
                disabled={pending}
                render={
                  <button
                    type="button"
                    disabled={pending}
                    className="inline-flex min-h-10 items-center rounded-[var(--admin-radius-control)] border border-[var(--admin-border-form)] bg-transparent px-4 text-sm font-semibold text-[var(--admin-body)] outline-none transition-colors hover:bg-[var(--admin-panel-muted)] focus-visible:ring-2 focus-visible:ring-[var(--admin-focus)]/55 disabled:opacity-50 disabled:pointer-events-none"
                  >
                    Cancel
                  </button>
                }
              />
              <button
                type="button"
                aria-busy={pending || undefined}
                disabled={pending}
                onClick={() => performToggle(direction)}
                className="inline-flex min-h-10 items-center gap-2 rounded-[var(--admin-radius-control)] bg-[var(--admin-danger-solid)] px-4 text-sm font-semibold text-[var(--admin-on-primary)] outline-none transition-colors hover:bg-[var(--admin-danger-solid-hover)] focus-visible:ring-2 focus-visible:ring-[var(--admin-focus)]/55 disabled:opacity-60 disabled:pointer-events-none"
              >
                {pending ? (
                  <Loader2 className="size-4 shrink-0 animate-spin" aria-hidden="true" />
                ) : null}
                {confirmCopy.confirmLabel}
              </button>
            </div>
          </BaseDialog.Popup>
        </BaseDialog.Portal>
      </BaseDialog.Root>
    </li>
  );
}

function buildConfirmCopy({
  isOwnerRole,
  riskLevel,
  direction,
  displayName,
  roleDisplayLabel,
}: {
  isOwnerRole: boolean;
  riskLevel: RiskLevel;
  direction: "grant" | "revoke";
  displayName: string;
  roleDisplayLabel: string;
}): { title: string; body: string; confirmLabel: string } {
  if (isOwnerRole) {
    return {
      title: "Change Owner permissions?",
      body: "The Owner role gates everything. Revoking a permission could lock you out of recovery actions. Confirm with your team first.",
      confirmLabel: "Change Owner permission",
    };
  }

  if (riskLevel === "critical") {
    if (direction === "grant") {
      return {
        title: `Grant ${displayName}?`,
        body: "This is a critical-risk permission. Granting it expands this role's authority across the admin.",
        confirmLabel: "Grant",
      };
    }
    return {
      title: `Revoke ${displayName}?`,
      body: `This is a critical-risk permission. Revoking it may prevent ${roleDisplayLabel} staff from completing existing workflows.`,
      confirmLabel: "Revoke",
    };
  }

  // High-risk grant
  return {
    title: `Grant ${displayName}?`,
    body: "This is a high-risk permission. Confirm before granting.",
    confirmLabel: "Grant",
  };
}
