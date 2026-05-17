"use client";

import { useId } from "react";
import { Plus } from "lucide-react";
import { AdminSheet } from "../components/admin-ui-interactions";

interface CreateRoleSheetProps {
  defaultSortOrder: number;
}

export function CreateRoleSheet({ defaultSortOrder }: CreateRoleSheetProps) {
  const formId = useId();
  const displayLabelId = `${formId}-display-label`;
  const nameId = `${formId}-name`;
  const descriptionId = `${formId}-description`;
  const sortOrderId = `${formId}-sort-order`;
  const activeId = `${formId}-active`;
  const formErrorId = `${formId}-error`;

  return (
    <AdminSheet
      title="Create role"
      description="Add a new role with custom permissions. You'll assign permissions on the next screen."
      trigger={
        <button
          type="button"
          className="inline-flex h-11 w-full items-center justify-center gap-1.5 rounded-[var(--admin-radius-control)] bg-[var(--admin-primary)] px-4 text-sm font-semibold text-white outline-none transition-colors duration-150 hover:bg-[var(--admin-primary-hover)] focus-visible:ring-2 focus-visible:ring-[var(--admin-focus)]/55 sm:h-10 sm:w-auto sm:justify-start"
          aria-keyshortcuts="n"
          title="Add a new role with custom permissions"
        >
          <Plus className="size-4" aria-hidden="true" />
          Create role
        </button>
      }
    >
      {/*
        Server action binding intentionally aspirational: `createRole` does not yet exist
        in src/app/admin/roles/actions.ts. The submit button below carries
        data-redesign-fake="create-role" and is disabled until BUILD-create-role.md lands.
        Form field names match the brief's contract so wiring is a one-line change later.
      */}
      <form className="grid gap-4" noValidate>
        <div
          id={formErrorId}
          role="alert"
          aria-live="polite"
          aria-atomic="true"
          className="sr-only"
        />

        <div className="grid gap-1.5">
          <label
            htmlFor={displayLabelId}
            className="text-sm font-medium text-[var(--admin-heading)]"
          >
            Display label
            <span aria-hidden="true" className="ml-0.5 text-[oklch(26%_0.14_25)]">
              *
            </span>
          </label>
          <input
            id={displayLabelId}
            name="display_label"
            type="text"
            required
            maxLength={60}
            placeholder="e.g. Senior Therapist"
            className="flex h-10 w-full rounded-[var(--admin-radius-control)] border border-[var(--admin-border-form)] bg-[var(--admin-surface-input)] px-3 py-2 text-sm text-[var(--admin-body)] outline-none transition-colors placeholder:text-[var(--admin-text-muted)] focus-visible:border-[var(--admin-focus)] focus-visible:ring-2 focus-visible:ring-[var(--admin-focus)]/30"
          />
          <p className="text-xs text-[var(--admin-text-muted)]">
            Shown to staff and on access-denied screens.
          </p>
        </div>

        <div className="grid gap-1.5">
          <label
            htmlFor={nameId}
            className="text-sm font-medium text-[var(--admin-heading)]"
          >
            DB role name
            <span aria-hidden="true" className="ml-0.5 text-[oklch(26%_0.14_25)]">
              *
            </span>
          </label>
          <input
            id={nameId}
            name="name"
            type="text"
            required
            pattern="[a-z_]+"
            placeholder="senior_therapist"
            className="flex h-10 w-full rounded-[var(--admin-radius-control)] border border-[var(--admin-border-form)] bg-[var(--admin-surface-input)] px-3 py-2 font-mono text-sm text-[var(--admin-body)] outline-none transition-colors placeholder:text-[var(--admin-text-muted)] focus-visible:border-[var(--admin-focus)] focus-visible:ring-2 focus-visible:ring-[var(--admin-focus)]/30"
          />
          <p className="text-xs text-[var(--admin-text-muted)]">
            Used in code and audit logs. Lowercase letters and underscores only.
          </p>
        </div>

        <div className="grid gap-1.5">
          <label
            htmlFor={descriptionId}
            className="text-sm font-medium text-[var(--admin-heading)]"
          >
            Description
          </label>
          <textarea
            id={descriptionId}
            name="description"
            rows={3}
            placeholder="What does this role do day-to-day?"
            className="w-full rounded-[var(--admin-radius-control)] border border-[var(--admin-border-form)] bg-[var(--admin-surface-input)] px-3 py-2 text-sm leading-6 text-[var(--admin-body)] outline-none transition-colors placeholder:text-[var(--admin-text-muted)] focus-visible:border-[var(--admin-focus)] focus-visible:ring-2 focus-visible:ring-[var(--admin-focus)]/30"
          />
        </div>

        <div className="grid gap-4 sm:grid-cols-[1fr_auto] sm:items-start">
          <div className="grid gap-1.5">
            <label
              htmlFor={sortOrderId}
              className="text-sm font-medium text-[var(--admin-heading)]"
            >
              Sort order
            </label>
            <input
              id={sortOrderId}
              name="sort_order"
              type="number"
              min={0}
              max={999}
              step={10}
              defaultValue={defaultSortOrder}
              className="flex h-10 w-full rounded-[var(--admin-radius-control)] border border-[var(--admin-border-form)] bg-[var(--admin-surface-input)] px-3 py-2 text-sm text-[var(--admin-body)] outline-none transition-colors focus-visible:border-[var(--admin-focus)] focus-visible:ring-2 focus-visible:ring-[var(--admin-focus)]/30 sm:w-32"
            />
            <p className="text-xs text-[var(--admin-text-muted)]">
              Lower numbers appear first in the list.
            </p>
          </div>

          <label
            htmlFor={activeId}
            className="flex h-10 items-center gap-2 self-end rounded-[var(--admin-radius-control)] border border-[var(--admin-border-form)] bg-[var(--admin-surface-input)] px-3 text-sm text-[var(--admin-body)]"
          >
            <input
              id={activeId}
              name="active"
              type="checkbox"
              defaultChecked
              className="size-4 rounded border-[var(--admin-border-form)] text-[var(--admin-primary)] focus-visible:ring-2 focus-visible:ring-[var(--admin-focus)]/55"
            />
            <span>
              Active
              <span className="ml-2 text-xs text-[var(--admin-text-muted)]">
                Assignable to new staff
              </span>
            </span>
          </label>
        </div>

        <div className="mt-1 flex flex-col items-stretch gap-2 border-t border-[var(--admin-border)] pt-4 sm:flex-row sm:items-center sm:justify-end">
          <button
            type="button"
            className="inline-flex h-10 items-center justify-center rounded-[var(--admin-radius-control)] border border-[var(--admin-border-form)] bg-transparent px-4 text-sm font-semibold text-[var(--admin-body)] outline-none transition-colors hover:bg-[var(--admin-panel-muted)] focus-visible:ring-2 focus-visible:ring-[var(--admin-focus)]/55"
          >
            Cancel
          </button>
          <button
            type="submit"
            data-redesign-fake="create-role"
            disabled
            aria-disabled="true"
            aria-describedby={`${formId}-pending-note`}
            className="inline-flex h-10 items-center justify-center rounded-[var(--admin-radius-control)] bg-[var(--admin-primary)] px-4 text-sm font-semibold text-white outline-none transition-colors duration-150 hover:bg-[var(--admin-primary-hover)] focus-visible:ring-2 focus-visible:ring-[var(--admin-focus)]/55 disabled:cursor-not-allowed disabled:opacity-60"
          >
            Create role
          </button>
        </div>
        <p
          id={`${formId}-pending-note`}
          className="-mt-1 text-xs leading-5 text-[var(--admin-text-muted)] sm:text-right"
        >
          Create-role backend coming soon —{" "}
          <code className="rounded bg-[var(--admin-panel-muted)] px-1 py-0.5 font-mono text-[0.6875rem] text-[var(--admin-body)]">
            BUILD-create-role.md
          </code>{" "}
          pending.
        </p>
      </form>
    </AdminSheet>
  );
}
