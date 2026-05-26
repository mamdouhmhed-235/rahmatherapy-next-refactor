"use client";

import { useId, useMemo, useState } from "react";
import { ChevronRight, Search } from "lucide-react";
import { AdminStatusBadge } from "../../components/admin-ui";

interface RolePermissionsListProps {
  permissions: string[];
}

function readableName(name: string): string {
  return name.replace(/_/g, " ");
}

/**
 * Client-side filterable chip list for R4 "Show all permissions" disclosure.
 * Renders as a `<details>` so collapsed state is preserved as before.
 */
export function RolePermissionsList({ permissions }: RolePermissionsListProps) {
  const [query, setQuery] = useState("");
  const inputId = useId();

  const filtered = useMemo(() => {
    const q = query.trim().toLowerCase();
    if (!q) return permissions;
    return permissions.filter(
      (p) => p.toLowerCase().includes(q) || readableName(p).toLowerCase().includes(q)
    );
  }, [query, permissions]);

  return (
    <details className="group">
      <summary className="inline-flex cursor-pointer list-none items-center gap-1.5 rounded-sm text-sm font-medium text-[var(--admin-body)] outline-none transition-colors hover:text-[var(--admin-heading)] focus-visible:ring-2 focus-visible:ring-[var(--admin-focus)]/55 focus-visible:ring-offset-2">
        <ChevronRight
          className="size-3.5 transition-transform group-open:rotate-90 motion-reduce:transition-none"
          aria-hidden="true"
        />
        Show all permissions
      </summary>
      <div className="mt-3 grid gap-2">
        <label htmlFor={inputId} className="sr-only">
          Filter permissions
        </label>
        <div className="relative">
          <Search
            aria-hidden="true"
            className="pointer-events-none absolute left-2.5 top-1/2 size-3.5 -translate-y-1/2 text-[var(--admin-text-muted)]"
          />
          <input
            id={inputId}
            type="search"
            value={query}
            onChange={(event) => setQuery(event.target.value)}
            placeholder={`Filter ${permissions.length} permissions`}
            className="flex h-9 w-full rounded-[var(--admin-radius-control)] border border-[var(--admin-border-form)] bg-[var(--admin-surface-input)] pl-8 pr-3 text-xs text-[var(--admin-body)] outline-none transition-colors placeholder:text-[var(--admin-text-muted)] focus-visible:border-[var(--admin-focus)] focus-visible:ring-2 focus-visible:ring-[var(--admin-focus)]/30"
          />
        </div>
        {filtered.length === 0 ? (
          <p className="text-xs text-[var(--admin-text-muted)]">
            No permissions match &ldquo;{query}&rdquo;.
          </p>
        ) : (
          <div className="flex flex-wrap gap-1.5">
            {filtered.map((permission) => (
              <AdminStatusBadge
                key={permission}
                value={readableName(permission)}
                tone="restricted"
                compact
              />
            ))}
          </div>
        )}
        {query.trim() ? (
          <p className="text-xs text-[var(--admin-text-muted)]">
            {filtered.length} of {permissions.length} permissions
          </p>
        ) : null}
      </div>
    </details>
  );
}
