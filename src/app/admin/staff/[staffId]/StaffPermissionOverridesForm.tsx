"use client";

import { useState, useTransition } from "react";
import { updateStaffPermissionOverride } from "../actions";

type OverrideMode = "inherit" | "grant" | "revoke";

interface StaffPermissionOverridesFormProps {
  staffId: string;
  permissions: {
    id: string;
    name: string;
    description: string | null;
    category: string | null;
    scope: string | null;
    risk_level: string | null;
  }[];
  inheritedPermissionIds: string[];
  overrides: Record<string, boolean>;
}

export function StaffPermissionOverridesForm({
  staffId,
  permissions,
  inheritedPermissionIds,
  overrides,
}: StaffPermissionOverridesFormProps) {
  const inherited = new Set(inheritedPermissionIds);
  const [pendingKey, setPendingKey] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [isPending, startTransition] = useTransition();

  function saveOverride(permissionId: string, mode: OverrideMode) {
    setError(null);
    setPendingKey(permissionId);
    startTransition(async () => {
      const result = await updateStaffPermissionOverride(staffId, permissionId, mode);
      if (result.error) setError(result.error);
      setPendingKey(null);
    });
  }

  return (
    <div className="grid gap-3">
      {error && <p className="text-sm text-red-700">{error}</p>}
      {permissions.map((permission) => {
        const override = overrides[permission.id];
        const mode: OverrideMode =
          override === true ? "grant" : override === false ? "revoke" : "inherit";
        const effective = mode === "grant" || (mode === "inherit" && inherited.has(permission.id));
        const isRowPending = isPending && pendingKey === permission.id;

        return (
          <div
            key={permission.id}
            className="rounded-lg border border-[var(--rahma-border)] bg-white p-3"
          >
            <div className="flex flex-wrap items-start justify-between gap-3">
              <div className="min-w-0">
                <code className="rounded bg-muted px-1.5 py-0.5 text-xs">
                  {permission.name}
                </code>
                {permission.description && (
                  <p className="mt-1 text-sm text-[var(--rahma-muted)]">
                    {permission.description}
                  </p>
                )}
                <p className="mt-1 text-xs text-[var(--rahma-muted)]">
                  {[permission.category, permission.scope, permission.risk_level]
                    .filter(Boolean)
                    .join(" / ")}
                </p>
              </div>
              <span
                className="rounded-full px-2.5 py-0.5 text-xs font-medium"
                style={
                  effective
                    ? { background: "#d1fae5", color: "#065f46" }
                    : { background: "var(--muted)", color: "var(--rahma-muted)" }
                }
              >
                {effective ? "Effective" : "Not effective"}
              </span>
            </div>

            <div className="mt-3 flex flex-wrap gap-2">
              {(["inherit", "grant", "revoke"] as OverrideMode[]).map((option) => (
                <button
                  key={option}
                  type="button"
                  disabled={isRowPending}
                  onClick={() => saveOverride(permission.id, option)}
                  className={`rounded-full border px-3 py-1 text-xs font-medium capitalize disabled:opacity-60 ${
                    mode === option
                      ? "border-[var(--rahma-green)] bg-[var(--rahma-green)] text-white"
                      : "border-[var(--rahma-border)] bg-white text-[var(--rahma-charcoal)]"
                  }`}
                >
                  {isRowPending && mode !== option ? "Saving" : option}
                </button>
              ))}
            </div>
          </div>
        );
      })}
    </div>
  );
}
