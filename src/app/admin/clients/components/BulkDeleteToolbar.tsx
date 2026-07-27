"use client";

import * as React from "react";
import { useRouter } from "next/navigation";
import { Trash2 } from "lucide-react";
import { toast } from "sonner";
import { ConfirmActionModal } from "../../components/admin-ui-interactions";
import { bulkDeleteClients } from "../actions";

export interface SelectableClient {
  id: string;
  full_name: string;
}

interface SelectionContextValue {
  enabled: boolean;
  isSelected: (clientId: string) => boolean;
  toggle: (clientId: string) => void;
}

const SelectionContext = React.createContext<SelectionContextValue | null>(null);

const NAME_SAMPLE_SIZE = 3;

function describeSelection(clients: SelectableClient[]): string {
  const names = clients.slice(0, NAME_SAMPLE_SIZE).map((client) => client.full_name);
  const remainder = clients.length - names.length;
  return remainder > 0
    ? `${names.join(", ")} and ${remainder} more`
    : names.join(", ");
}

/**
 * Holds the list's selection state and renders the sticky bulk-delete bar above
 * the rows. The rows themselves stay server-rendered — they are passed straight
 * through as `children`, so only the bar and the checkboxes are client code.
 *
 * `enabled` is false for anyone without `manage_client_destructive_ops`: no
 * checkboxes render and the bar can never appear (brief §4.3).
 */
export function ClientSelectionProvider({
  enabled,
  clients,
  children,
}: {
  enabled: boolean;
  clients: SelectableClient[];
  children: React.ReactNode;
}) {
  const router = useRouter();
  const [selectedIds, setSelectedIds] = React.useState<Set<string>>(new Set());
  const [pending, setPending] = React.useState(false);

  const toggle = React.useCallback((clientId: string) => {
    setSelectedIds((previous) => {
      const next = new Set(previous);
      if (next.has(clientId)) next.delete(clientId);
      else next.add(clientId);
      return next;
    });
  }, []);

  const isSelected = React.useCallback(
    (clientId: string) => selectedIds.has(clientId),
    [selectedIds]
  );

  const contextValue = React.useMemo(
    () => ({ enabled, isSelected, toggle }),
    [enabled, isSelected, toggle]
  );

  // Selection is scoped to what is on screen — an id left over from another
  // page or filter simply drops out rather than being deleted unseen.
  const selectedClients = clients.filter((client) => selectedIds.has(client.id));
  const count = selectedClients.length;

  async function handleBulkDelete() {
    if (pending || count === 0) return;
    setPending(true);
    try {
      const formData = new FormData();
      for (const client of selectedClients) {
        formData.append("client_ids", client.id);
      }
      const result = await bulkDeleteClients(formData);
      if (result.error) {
        toast.error(result.error);
        return;
      }
      const deleted = result.deletedCount ?? 0;
      const failed = result.errors?.length ?? 0;
      if (failed > 0) {
        toast.error(
          `Deleted ${deleted} of ${deleted + failed}. ${failed} couldn't be deleted.`,
          { description: result.errors?.[0] }
        );
      } else {
        toast.success(`${deleted} client${deleted === 1 ? "" : "s"} deleted.`);
      }
      setSelectedIds(new Set());
      router.refresh();
    } catch (error) {
      console.error("[clients] bulk delete failed", { count, error });
      toast.error("Couldn't delete those clients. Try again.");
    } finally {
      setPending(false);
    }
  }

  return (
    <SelectionContext.Provider value={contextValue}>
      {enabled && count > 0 ? (
        <div className="sticky top-12 z-30 mb-3 flex flex-wrap items-center justify-between gap-2 rounded-[var(--admin-radius-card)] border border-[var(--admin-border)] bg-[var(--admin-panel)] px-3 py-2 shadow-[var(--admin-shadow-overlay)]">
          <p
            aria-live="polite"
            className="text-sm font-semibold text-[var(--admin-heading)]"
          >
            {count} client{count === 1 ? "" : "s"} selected
          </p>
          <div className="flex flex-wrap items-center gap-2">
            <ConfirmActionModal
              title={`Delete ${count} client${count === 1 ? "" : "s"} and cancel their open bookings?`}
              description={describeSelection(selectedClients)}
              confirmLabel={`Delete ${count} client${count === 1 ? "" : "s"}`}
              cancelLabel="Keep them"
              destructive
              onConfirm={handleBulkDelete}
              trigger={
                <button
                  type="button"
                  disabled={pending}
                  aria-busy={pending || undefined}
                  className="inline-flex h-10 appearance-none items-center gap-1.5 rounded-[var(--admin-radius-control)] border border-[oklch(80%_0.08_25)] bg-transparent px-3 text-sm font-semibold text-[oklch(26%_0.14_25)] outline-none transition-colors hover:bg-[oklch(95.5%_0.028_20)] focus-visible:ring-2 focus-visible:ring-[var(--admin-focus)]/55 disabled:opacity-60"
                >
                  <Trash2 className="size-4 shrink-0" aria-hidden="true" />
                  Delete selected
                </button>
              }
            >
              <ul className="grid list-none gap-1.5 p-0 text-sm text-[var(--admin-text-muted)]">
                <li>
                  {count} client profile{count === 1 ? "" : "s"} will be deleted.
                </li>
                <li>Open bookings for each will be cancelled.</li>
                <li>Past completed bookings stay on the record.</li>
                <li>This cannot be undone.</li>
              </ul>
            </ConfirmActionModal>
            <button
              type="button"
              onClick={() => setSelectedIds(new Set())}
              className="inline-flex h-10 appearance-none items-center rounded-[var(--admin-radius-control)] border-0 bg-transparent px-3 text-sm font-medium text-[var(--admin-body)] outline-none transition-colors hover:bg-[var(--admin-panel-muted)] focus-visible:ring-2 focus-visible:ring-[var(--admin-focus)]/55"
            >
              Clear
            </button>
          </div>
        </div>
      ) : null}
      {children}
    </SelectionContext.Provider>
  );
}

/**
 * Row checkbox. Renders nothing outside a provider, or for an actor without
 * `manage_client_destructive_ops`. The 44px tap target at mobile widths matches
 * the row menu trigger next to it.
 */
export function ClientSelectCheckbox({
  clientId,
  clientName,
}: {
  clientId: string;
  clientName: string;
}) {
  const selection = React.useContext(SelectionContext);
  if (!selection?.enabled) return null;

  return (
    <label className="relative z-10 inline-flex size-11 shrink-0 cursor-pointer items-center justify-center sm:size-9">
      <input
        type="checkbox"
        checked={selection.isSelected(clientId)}
        onChange={() => selection.toggle(clientId)}
        aria-label={`Select ${clientName}`}
        className="size-4 cursor-pointer accent-[var(--admin-primary)] outline-none focus-visible:ring-2 focus-visible:ring-[var(--admin-focus)]/55"
      />
    </label>
  );
}
