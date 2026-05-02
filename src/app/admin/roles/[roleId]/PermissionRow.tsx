"use client";

import { useState, useTransition } from "react";
import { toggleRolePermission } from "../actions";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogDescription,
  DialogFooter,
} from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { AlertTriangle } from "lucide-react";

interface PermissionRowProps {
  roleId: string;
  roleName: string;
  permissionId: string;
  permissionName: string;
  permissionDescription: string | null;
  isGranted: boolean;
  isOwnerRole: boolean;
}

export function PermissionRow({
  roleId,
  roleName,
  permissionId,
  permissionName,
  permissionDescription,
  isGranted,
  isOwnerRole,
}: PermissionRowProps) {
  const [pending, startTransition] = useTransition();
  const [confirmOpen, setConfirmOpen] = useState(false);
  const [error, setError] = useState<string | null>(null);

  function handleToggleClick() {
    // Safety Confirmation required when touching the Owner role
    if (isOwnerRole) {
      setConfirmOpen(true);
      return;
    }
    performToggle();
  }

  function performToggle() {
    setError(null);
    startTransition(async () => {
      const result = await toggleRolePermission(
        roleId,
        permissionId,
        permissionName,
        isGranted
      );
      if (result.error) {
        setError(result.error);
      }
      setConfirmOpen(false);
    });
  }

  return (
    <>
      <div
        className="flex items-center gap-4 rounded-xl border bg-white px-5 py-4 transition-colors duration-150"
        style={{ borderColor: "var(--rahma-border)" }}
      >
        {/* Toggle */}
        <button
          type="button"
          role="switch"
          aria-checked={isGranted}
          aria-label={`${isGranted ? "Revoke" : "Grant"} ${permissionName}`}
          onClick={handleToggleClick}
          disabled={pending}
          className="relative shrink-0 h-6 w-11 rounded-full border-2 border-transparent outline-none transition-colors duration-200 focus-visible:ring-2 focus-visible:ring-ring/40 disabled:opacity-50"
          style={{
            background: isGranted ? "var(--rahma-green)" : "var(--rahma-border)",
          }}
        >
          <span
            className="block size-4 rounded-full bg-white shadow-sm transition-transform duration-200"
            style={{ transform: isGranted ? "translateX(20px)" : "translateX(2px)" }}
          />
        </button>

        {/* Permission info */}
        <div className="flex-1 min-w-0">
          <p className="text-sm font-medium text-[var(--rahma-charcoal)]">
            <code className="rounded bg-muted px-1.5 py-0.5 text-xs">
              {permissionName}
            </code>
          </p>
          {permissionDescription && (
            <p className="mt-0.5 text-sm text-[var(--rahma-muted)]">
              {permissionDescription}
            </p>
          )}
        </div>

        {/* Status badge */}
        <span
          className="shrink-0 rounded-full px-2.5 py-0.5 text-xs font-medium"
          style={
            isGranted
              ? { background: "#d1fae5", color: "#065f46" }
              : { background: "var(--muted)", color: "var(--rahma-muted)" }
          }
        >
          {isGranted ? "Granted" : "Not granted"}
        </span>
      </div>

      {error && (
        <p className="text-sm text-destructive px-1">{error}</p>
      )}

      {/* Safety Confirmation Dialog — shown only when toggling Owner role */}
      <Dialog open={confirmOpen} onOpenChange={setConfirmOpen}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>
              <span className="flex items-center gap-2">
                <AlertTriangle className="size-5 text-[var(--rahma-gold)]" />
                Modify Owner Role Permission
              </span>
            </DialogTitle>
            <DialogDescription>
              You are about to{" "}
              <strong>{isGranted ? "revoke" : "grant"}</strong> the{" "}
              <code className="rounded bg-muted px-1 py-0.5 text-xs">
                {permissionName}
              </code>{" "}
              permission on the <strong>{roleName}</strong> role. This affects
              the highest-privilege role in the system. Are you sure?
            </DialogDescription>
          </DialogHeader>
          <DialogFooter>
            <Button
              variant="outline"
              size="sm"
              onClick={() => setConfirmOpen(false)}
              disabled={pending}
            >
              Cancel
            </Button>
            <Button
              size="sm"
              onClick={performToggle}
              disabled={pending}
              className="bg-[var(--rahma-gold)] text-[var(--rahma-charcoal)] hover:bg-[var(--rahma-gold)]/90"
            >
              {pending ? "Applying…" : "Yes, apply change"}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </>
  );
}
