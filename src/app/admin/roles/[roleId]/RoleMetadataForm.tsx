"use client";

import { useActionState } from "react";
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
}

export function RoleMetadataForm({ role }: RoleMetadataFormProps) {
  const [state, formAction, pending] = useActionState(updateRoleMetadata, {});

  return (
    <form
      action={formAction}
      className="rounded-2xl border bg-white p-4"
      style={{ borderColor: "var(--rahma-border)" }}
    >
      <input type="hidden" name="role_id" value={role.id} />
      {role.is_system && <input type="hidden" name="active" value="on" />}

      <h2 className="mb-4 text-base font-semibold text-[var(--rahma-charcoal)]">
        Role details
      </h2>

      <label className="mb-3 block">
        <span className="mb-1 block text-xs font-medium text-[var(--rahma-muted)]">
          Display label
        </span>
        <input
          name="display_label"
          defaultValue={role.display_label ?? role.name}
          className="w-full rounded-xl border px-3 py-2 text-sm text-[var(--rahma-charcoal)]"
          style={{ borderColor: "var(--rahma-border)" }}
          required
        />
      </label>

      <label className="mb-3 block">
        <span className="mb-1 block text-xs font-medium text-[var(--rahma-muted)]">
          Description
        </span>
        <textarea
          name="description"
          defaultValue={role.description ?? ""}
          rows={3}
          className="w-full rounded-xl border px-3 py-2 text-sm text-[var(--rahma-charcoal)]"
          style={{ borderColor: "var(--rahma-border)" }}
        />
      </label>

      <label className="mb-3 block">
        <span className="mb-1 block text-xs font-medium text-[var(--rahma-muted)]">
          Sort order
        </span>
        <input
          name="sort_order"
          type="number"
          min={0}
          max={999}
          defaultValue={role.sort_order}
          className="w-full rounded-xl border px-3 py-2 text-sm text-[var(--rahma-charcoal)]"
          style={{ borderColor: "var(--rahma-border)" }}
          required
        />
      </label>

      <label className="mb-4 flex items-center gap-2 text-sm text-[var(--rahma-charcoal)]">
        <input
          name="active"
          type="checkbox"
          defaultChecked={role.active}
          disabled={role.is_system}
          className="size-4"
        />
        Active
      </label>

      {state.error && (
        <p className="mb-3 text-sm text-red-700">{state.error}</p>
      )}
      {state.success && (
        <p className="mb-3 text-sm text-green-700">Role updated.</p>
      )}

      <button
        type="submit"
        disabled={pending}
        className="rounded-xl bg-[var(--rahma-green)] px-4 py-2 text-sm font-medium text-white disabled:opacity-60"
      >
        {pending ? "Saving..." : "Save role"}
      </button>
    </form>
  );
}
