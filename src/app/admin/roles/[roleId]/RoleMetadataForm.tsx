"use client";

import { useActionState, useEffect, useId, useState } from "react";
import { toast } from "sonner";
import { Loader2, RotateCcw, Sparkles, XCircle } from "lucide-react";
import { updateRoleMetadata } from "../actions";

interface RoleMetadataFormProps {
  role: {
    id: string;
    name: string;
    display_label: string | null;
    description: string | null;
    sort_order: number;
    active: boolean;
    is_system: boolean;
  };
  /** Stable form id so other components (e.g. DangerZonePanel) can submit it. */
  formId?: string;
}

export function RoleMetadataForm({
  role,
  formId = "role-metadata-form",
}: RoleMetadataFormProps) {
  const [state, formAction, pending] = useActionState(updateRoleMetadata, {});
  const fieldId = useId();
  const [dirty, setDirty] = useState(false);

  // After a successful save, reset dirty + announce. Brief copy verbatim.
  useEffect(() => {
    if (state.success) {
      // eslint-disable-next-line react-hooks/set-state-in-effect
      setDirty(false);
      toast.success("Role saved.");
    }
  }, [state.success]);

  // Reset dirty if user reverts a field — cheap heuristic via form snapshot.
  function checkDirty(form: HTMLFormElement) {
    const fd = new FormData(form);
    const nextDirty =
      String(fd.get("display_label") ?? "") !== (role.display_label ?? role.name) ||
      String(fd.get("description") ?? "") !== (role.description ?? "") ||
      Number(fd.get("sort_order") ?? "0") !== role.sort_order ||
      (fd.get("active") === "on") !== role.active;
    setDirty(nextDirty);
  }

  function handleReset(form: HTMLFormElement) {
    form.reset();
    setDirty(false);
  }

  return (
    <form
      id={formId}
      action={formAction}
      className="grid gap-4"
      aria-describedby={state.error ? `${fieldId}-error` : undefined}
      onInput={(e) => checkDirty(e.currentTarget)}
      onChange={(e) => checkDirty(e.currentTarget)}
      noValidate
    >
      <input type="hidden" name="role_id" value={role.id} />
      {role.is_system && <input type="hidden" name="active" value="on" />}

      {state.error ? (
        <div
          id={`${fieldId}-error`}
          role="alert"
          aria-live="polite"
          aria-atomic="true"
          className="flex items-start gap-2.5 rounded-[var(--admin-radius-control)] bg-[var(--admin-status-cancelled-bg)] px-3 py-2.5 text-sm text-[var(--admin-status-cancelled-text)]"
        >
          <XCircle className="mt-0.5 size-4 shrink-0" aria-hidden="true" />
          <span>{state.error}</span>
        </div>
      ) : null}

      {dirty && !state.error ? (
        <div
          className="flex items-center gap-2 rounded-[var(--admin-radius-control)] bg-[var(--admin-status-pending-bg)] px-3 py-2 text-xs leading-5 text-[var(--admin-status-pending-text)]"
          aria-live="polite"
        >
          <Sparkles className="size-3.5 shrink-0" aria-hidden="true" />
          Unsaved changes
        </div>
      ) : null}

      <div className="grid gap-1.5">
        <label
          htmlFor={`${fieldId}-display-label`}
          className="text-sm font-medium text-[var(--admin-heading)]"
        >
          Display label
          <span aria-hidden="true" className="ml-0.5 text-[var(--admin-status-cancelled-text)]">
            *
          </span>
        </label>
        <input
          id={`${fieldId}-display-label`}
          name="display_label"
          type="text"
          required
          maxLength={60}
          defaultValue={role.display_label ?? role.name}
          placeholder="e.g. Booking Coordinator"
          className="flex h-10 w-full rounded-[var(--admin-radius-control)] border border-[var(--admin-border-form)] bg-[var(--admin-surface-input)] px-3 py-2 text-sm text-[var(--admin-body)] outline-none transition-colors placeholder:text-[var(--admin-text-muted)] focus-visible:border-[var(--admin-focus)] focus-visible:ring-2 focus-visible:ring-[var(--admin-focus)]/30"
        />
        <p className="text-xs leading-5 text-[var(--admin-text-muted)]">
          Shown to staff and on access-denied screens.
        </p>
      </div>

      <div className="grid gap-1.5">
        <label
          htmlFor={`${fieldId}-description`}
          className="text-sm font-medium text-[var(--admin-heading)]"
        >
          Description
        </label>
        <textarea
          id={`${fieldId}-description`}
          name="description"
          rows={3}
          defaultValue={role.description ?? ""}
          placeholder="One or two sentences about what this role does day-to-day."
          className="w-full rounded-[var(--admin-radius-control)] border border-[var(--admin-border-form)] bg-[var(--admin-surface-input)] px-3 py-2 text-sm leading-6 text-[var(--admin-body)] outline-none transition-colors placeholder:text-[var(--admin-text-muted)] focus-visible:border-[var(--admin-focus)] focus-visible:ring-2 focus-visible:ring-[var(--admin-focus)]/30"
        />
      </div>

      <div className="grid gap-4 sm:grid-cols-[1fr_auto] sm:items-start">
        <div className="grid gap-1.5">
          <label
            htmlFor={`${fieldId}-sort-order`}
            className="text-sm font-medium text-[var(--admin-heading)]"
          >
            Sort order
            <span aria-hidden="true" className="ml-0.5 text-[var(--admin-status-cancelled-text)]">
              *
            </span>
          </label>
          <input
            id={`${fieldId}-sort-order`}
            name="sort_order"
            type="number"
            min={0}
            max={999}
            step={10}
            required
            defaultValue={role.sort_order}
            className="flex h-10 w-full rounded-[var(--admin-radius-control)] border border-[var(--admin-border-form)] bg-[var(--admin-surface-input)] px-3 py-2 text-sm text-[var(--admin-body)] outline-none transition-colors focus-visible:border-[var(--admin-focus)] focus-visible:ring-2 focus-visible:ring-[var(--admin-focus)]/30 sm:w-32"
          />
          <p className="text-xs leading-5 text-[var(--admin-text-muted)]">
            Lower numbers appear first in the roles list.
          </p>
        </div>

        <label
          htmlFor={`${fieldId}-active`}
          className="flex h-10 items-center gap-2 self-end rounded-[var(--admin-radius-control)] border border-[var(--admin-border-form)] bg-[var(--admin-surface-input)] px-3 text-sm text-[var(--admin-body)]"
          title={
            role.is_system
              ? "System roles stay active. Manage assignments instead."
              : "Inactive roles can't be assigned to new staff."
          }
        >
          <input
            id={`${fieldId}-active`}
            name="active"
            type="checkbox"
            defaultChecked={role.active}
            disabled={role.is_system}
            className="size-4 rounded border-[var(--admin-border-form)] text-[var(--admin-primary)] focus-visible:ring-2 focus-visible:ring-[var(--admin-focus)]/55 disabled:cursor-not-allowed"
          />
          <span>
            Active
            <span className="ml-2 hidden text-xs text-[var(--admin-text-muted)] sm:inline">
              {role.is_system ? "System role" : "Assignable"}
            </span>
          </span>
        </label>
      </div>

      {/* Inline action row (desktop). On mobile we also render a sticky bar. */}
      <div className="mt-1 hidden flex-wrap items-center justify-end gap-2 sm:flex">
        {dirty ? (
          <button
            type="button"
            onClick={(e) =>
              handleReset(e.currentTarget.closest("form") as HTMLFormElement)
            }
            className="inline-flex h-10 items-center gap-1.5 rounded-[var(--admin-radius-control)] px-3 text-sm font-medium text-[var(--admin-body)] outline-none transition-colors hover:bg-[var(--admin-panel-muted)] focus-visible:ring-2 focus-visible:ring-[var(--admin-focus)]/55"
          >
            <RotateCcw className="size-3.5" aria-hidden="true" />
            Discard
          </button>
        ) : null}
        <button
          type="submit"
          aria-busy={pending || undefined}
          disabled={pending}
          className="inline-flex h-10 items-center justify-center gap-1.5 rounded-[var(--admin-radius-control)] bg-[var(--admin-primary)] px-4 text-sm font-semibold text-[var(--admin-on-primary)] outline-none transition-colors duration-150 hover:bg-[var(--admin-primary-hover)] focus-visible:ring-2 focus-visible:ring-[var(--admin-focus)]/55 disabled:cursor-not-allowed disabled:opacity-60"
        >
          {pending ? (
            <Loader2 className="size-4 shrink-0 animate-spin" aria-hidden="true" />
          ) : null}
          {pending ? "Saving…" : "Save role details"}
        </button>
      </div>

      {/* Mobile sticky action bar — appears only on <sm when the form is dirty
          or the save is in flight. Sits flush above the page mobile bottom-nav. */}
      <div
        className={`sticky bottom-2 z-30 -mx-4 -mb-2 flex items-center gap-2 border-t border-[var(--admin-border)] bg-[var(--admin-panel)]/95 px-4 py-3 shadow-[0_-1px_8px_var(--admin-shadow-ink-06)] backdrop-blur sm:hidden ${
          dirty || pending ? "" : "hidden"
        }`}
      >
        <span className="flex-1 text-xs font-medium text-[var(--admin-text-muted)]">
          {pending ? "Saving…" : "Unsaved changes"}
        </span>
        <button
          type="button"
          onClick={(e) =>
            handleReset(e.currentTarget.closest("form") as HTMLFormElement)
          }
          disabled={pending}
          className="inline-flex h-10 items-center rounded-[var(--admin-radius-control)] px-3 text-sm font-medium text-[var(--admin-body)] outline-none transition-colors hover:bg-[var(--admin-panel-muted)] disabled:opacity-50"
        >
          Discard
        </button>
        <button
          type="submit"
          aria-busy={pending || undefined}
          disabled={pending}
          className="inline-flex h-10 items-center gap-1.5 rounded-[var(--admin-radius-control)] bg-[var(--admin-primary)] px-4 text-sm font-semibold text-[var(--admin-on-primary)] outline-none transition-colors disabled:opacity-60"
        >
          {pending ? (
            <Loader2 className="size-4 shrink-0 animate-spin" aria-hidden="true" />
          ) : null}
          Save
        </button>
      </div>
    </form>
  );
}
