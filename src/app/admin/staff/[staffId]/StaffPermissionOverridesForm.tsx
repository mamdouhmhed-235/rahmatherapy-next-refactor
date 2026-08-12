"use client";

import { useId, useMemo, useState, useTransition } from "react";
import { cn } from "@/lib/utils";
import { toast } from "sonner";
import { Search, XCircle } from "lucide-react";
import { updateStaffPermissionOverride } from "../actions";
import { AdminStatusBadge, type AdminTone } from "../../components/admin-ui";
import { ConfirmActionModal } from "../../components";

type OverrideMode = "inherit" | "grant" | "revoke";
type RiskLevel = "low" | "medium" | "high" | "critical";

interface Permission {
  id: string;
  name: string;
  description: string | null;
  category: string | null;
  scope: string | null;
  risk_level: string | null;
}

interface StaffPermissionOverridesFormProps {
  staffId: string;
  staffName?: string;
  permissions: Permission[];
  inheritedPermissionIds: string[];
  overrides: Record<string, boolean>;
}

const RISK_TONE: Record<RiskLevel, AdminTone> = {
  low: "restricted",
  medium: "warning",
  high: "warning",
  critical: "danger",
};

const RISK_LABEL: Record<RiskLevel, string> = {
  low: "Low risk",
  medium: "Medium risk",
  high: "High risk",
  critical: "Critical risk",
};

function normaliseRisk(level: string | null): RiskLevel {
  if (level === "low" || level === "medium" || level === "high" || level === "critical") {
    return level;
  }
  return "medium";
}

function modeFromOverride(override: boolean | undefined): OverrideMode {
  if (override === true) return "grant";
  if (override === false) return "revoke";
  return "inherit";
}

function readableName(permissionName: string): string {
  return permissionName.replace(/_/g, " ");
}

export function StaffPermissionOverridesForm({
  staffId,
  staffName,
  permissions,
  inheritedPermissionIds,
  overrides,
}: StaffPermissionOverridesFormProps) {
  const inherited = useMemo(() => new Set(inheritedPermissionIds), [inheritedPermissionIds]);
  const [pendingKey, setPendingKey] = useState<string | null>(null);
  const [formError, setFormError] = useState<string | null>(null);
  const [, startTransition] = useTransition();
  const [query, setQuery] = useState("");
  const filterId = useId();

  const visiblePermissions = useMemo(() => {
    const q = query.trim().toLowerCase();
    if (!q) return permissions;
    return permissions.filter((p) => {
      const haystack = [
        p.name,
        readableName(p.name),
        p.description ?? "",
        p.category ?? "",
        p.scope ?? "",
      ]
        .join(" ")
        .toLowerCase();
      return haystack.includes(q);
    });
  }, [permissions, query]);

  // Group by category for clearer scanning at scale.
  const grouped = useMemo(() => {
    const map = new Map<string, Permission[]>();
    for (const permission of visiblePermissions) {
      const key = permission.category ?? "Other";
      const bucket = map.get(key) ?? [];
      bucket.push(permission);
      map.set(key, bucket);
    }
    return Array.from(map.entries());
  }, [visiblePermissions]);

  function commitOverride(permission: Permission, nextMode: OverrideMode) {
    setFormError(null);
    setPendingKey(permission.id);
    startTransition(async () => {
      const result = await updateStaffPermissionOverride(staffId, permission.id, nextMode);
      if (result.error) {
        setFormError(result.error);
        toast.error(`Couldn't change ${readableName(permission.name)}. ${result.error}`);
      } else {
        const subject = staffName ?? "this staff member";
        toast.success(
          nextMode === "grant"
            ? `Granted ${readableName(permission.name)} to ${subject}.`
            : nextMode === "revoke"
              ? `Revoked ${readableName(permission.name)} from ${subject}.`
              : `Reset ${readableName(permission.name)} to role default.`
        );
      }
      setPendingKey(null);
    });
  }

  if (permissions.length === 0) {
    return (
      <p className="text-sm text-[var(--admin-text-muted)]">
        No overridable permissions are defined.
      </p>
    );
  }

  return (
    <div className="grid gap-3">
      {formError ? (
        <div
          role="alert"
          aria-live="polite"
          aria-atomic="true"
          className="flex items-start gap-2.5 rounded-[var(--admin-radius-control)] bg-[var(--admin-status-cancelled-bg)] px-3 py-2.5 text-sm text-[var(--admin-status-cancelled-text)]"
        >
          <XCircle className="mt-0.5 size-4 shrink-0" aria-hidden="true" />
          <p>{formError}</p>
        </div>
      ) : null}

      <div>
        <label htmlFor={filterId} className="sr-only">
          Filter permissions
        </label>
        <div className="relative">
          <Search
            aria-hidden="true"
            className="pointer-events-none absolute left-2.5 top-1/2 size-3.5 -translate-y-1/2 text-[var(--admin-text-muted)]"
          />
          <input
            id={filterId}
            type="search"
            value={query}
            onChange={(event) => setQuery(event.target.value)}
            placeholder={`Filter ${permissions.length} permissions`}
            className="flex h-9 w-full rounded-[var(--admin-radius-control)] border border-[var(--admin-border-form)] bg-[var(--admin-surface-input)] pl-8 pr-3 text-xs text-[var(--admin-body)] outline-none transition-colors placeholder:text-[var(--admin-text-muted)] focus-visible:border-[var(--admin-focus)] focus-visible:ring-2 focus-visible:ring-[var(--admin-focus)]/30"
          />
        </div>
        {query.trim() ? (
          <p className="mt-1 text-xs text-[var(--admin-text-muted)]">
            {visiblePermissions.length} of {permissions.length} permissions
          </p>
        ) : null}
      </div>

      {visiblePermissions.length === 0 ? (
        <p className="text-sm text-[var(--admin-text-muted)]">
          No permissions match &ldquo;{query}&rdquo;.
        </p>
      ) : null}

      {grouped.map(([category, items]) => (
        <section key={category} aria-labelledby={`${filterId}-cat-${category}`} className="grid gap-2">
          <h4
            id={`${filterId}-cat-${category}`}
            className="text-[0.6875rem] font-semibold uppercase tracking-[0.08em] text-[var(--admin-text-muted)]"
          >
            {category.replace(/_/g, " ")}
          </h4>
          <ul className="grid gap-2">
            {items.map((permission) => {
              const currentMode = modeFromOverride(overrides[permission.id]);
              const risk = normaliseRisk(permission.risk_level);
              const isRowPending = pendingKey === permission.id;
              const inheritedHere = inherited.has(permission.id);
              const effective =
                currentMode === "grant" || (currentMode === "inherit" && inheritedHere);

              return (
                <li
                  key={permission.id}
                  className="rounded-[var(--admin-radius-control)] border border-[var(--admin-border)] bg-[var(--admin-panel)] p-3"
                >
              <div className="flex flex-wrap items-start justify-between gap-2">
                <div className="min-w-0">
                  <p className="text-sm font-semibold text-[var(--admin-heading)]">
                    {readableName(permission.name)}
                  </p>
                  <p className="mt-0.5 font-mono text-[0.6875rem] text-[var(--admin-text-muted)]">
                    {permission.name}
                  </p>
                  {permission.description ? (
                    <p className="mt-1 text-xs leading-5 text-[var(--admin-text-muted)]">
                      {permission.description}
                    </p>
                  ) : null}
                  <div className="mt-2 flex flex-wrap items-center gap-1.5">
                    {permission.scope ? (
                      <AdminStatusBadge
                        value={`scope: ${permission.scope}`}
                        tone="muted"
                        compact
                      />
                    ) : null}
                    <AdminStatusBadge value={RISK_LABEL[risk]} tone={RISK_TONE[risk]} compact />
                    <AdminStatusBadge
                      value={effective ? "Effective" : "Not effective"}
                      tone={effective ? "success" : "muted"}
                      compact
                    />
                  </div>
                </div>
              </div>

                  <div
                    role="radiogroup"
                    aria-label={`${readableName(permission.name)} override`}
                    aria-orientation="horizontal"
                    className="mt-3 inline-flex rounded-[var(--admin-radius-control)] border border-[var(--admin-border)] bg-[var(--admin-panel-muted)] p-0.5"
                  >
                    {(["inherit", "grant", "revoke"] as OverrideMode[]).map((option) => (
                      <ModeButton
                        key={option}
                        option={option}
                        currentMode={currentMode}
                        permission={permission}
                        risk={risk}
                        disabled={isRowPending}
                        onCommit={(nextMode) => commitOverride(permission, nextMode)}
                        staffName={staffName}
                      />
                    ))}
                  </div>
                </li>
              );
            })}
          </ul>
        </section>
      ))}
    </div>
  );
}

// ─── ModeButton — wraps confirm modal per risk-tier matrix ────────────────────

function ModeButton({
  option,
  currentMode,
  permission,
  risk,
  disabled,
  onCommit,
  staffName,
}: {
  option: OverrideMode;
  currentMode: OverrideMode;
  permission: Permission;
  risk: RiskLevel;
  disabled: boolean;
  onCommit: (mode: OverrideMode) => void;
  staffName?: string;
}) {
  const selected = currentMode === option;
  const baseClass = cn(
    "inline-flex min-h-8 items-center justify-center rounded-[6px] px-3 text-xs font-semibold capitalize outline-none transition-colors focus-visible:ring-2 focus-visible:ring-[var(--admin-focus)]/55 focus-visible:ring-offset-2 disabled:cursor-not-allowed disabled:opacity-60",
    selected
      ? "bg-[var(--admin-primary)] text-[var(--admin-on-primary)]"
      : "text-[var(--admin-body)] hover:bg-[var(--admin-panel)] hover:text-[var(--admin-heading)]"
  );

  // Risk-tier matrix (Brief §6 + Brief 22 §6):
  //   - critical: always confirm
  //   - high:    confirm on grant only; revoke + inherit are one-click
  //   - medium / low: always one-click
  const isCriticalAny = risk === "critical" && option !== currentMode;
  const isHighGrant = risk === "high" && option === "grant" && currentMode !== "grant";
  const needsConfirm = isCriticalAny || isHighGrant;

  const trigger = (
    <button
      type="button"
      role="radio"
      aria-checked={selected}
      disabled={disabled || selected}
      className={baseClass}
    >
      {option}
    </button>
  );

  if (!needsConfirm) {
    return (
      <button
        type="button"
        role="radio"
        aria-checked={selected}
        disabled={disabled || selected}
        onClick={() => onCommit(option)}
        className={baseClass}
      >
        {option}
      </button>
    );
  }

  const subject = staffName ?? "this staff member";
  const action = option === "grant" ? "Grant" : option === "revoke" ? "Revoke" : "Reset";
  const heading = `${action} ${readableName(permission.name)} for ${subject}?`;
  const body =
    risk === "critical"
      ? option === "grant"
        ? "This is a critical-risk permission. Granting it expands their authority across the admin."
        : "This is a critical-risk permission. Revoking it may prevent them from completing existing workflows."
      : "This is a high-risk permission. Confirm before granting.";

  return (
    <ConfirmActionModal
      title={heading}
      description={body}
      destructive
      confirmLabel={option === "grant" ? "Grant" : option === "revoke" ? "Revoke" : "Reset"}
      cancelLabel="Cancel"
      trigger={trigger}
      onConfirm={() => onCommit(option)}
    />
  );
}
