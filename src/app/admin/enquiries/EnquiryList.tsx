"use client";

import { useMemo, useState, useTransition, type ChangeEvent } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import {
  AtSign,
  CheckCircle,
  Globe,
  Loader2,
  MessageCircle,
  Minus,
  MoreHorizontal,
  Phone,
  Users,
  X,
  XCircle,
  type LucideIcon,
} from "lucide-react";
import { toast } from "sonner";
import {
  AdminActionGroup,
  AdminEntityRow,
  AdminStatusBadge,
  type AdminTone,
} from "../components/admin-ui";
import { AdminActionMenu } from "../components/admin-ui-interactions";
import { cn } from "@/lib/utils";
import { formatDateTime } from "../clients/format";
import { EnquiryStatusButton } from "./EnquiryStatusButton";
import { updateEnquiryStatus } from "./actions";

export interface EnquiryRowData {
  id: string;
  full_name: string;
  phone: string | null;
  email: string | null;
  source: string;
  status: string;
  service_interest: string | null;
  notes: string | null;
  client_id: string | null;
  converted_booking_id: string | null;
  assigned_staff_id: string | null;
  created_at: string;
  updated_at: string | null;
  assignedName: string | null;
}

export type SortKey = "newest" | "oldest" | "name" | "activity";
const SORT_LABELS: Record<SortKey, string> = {
  newest: "Newest",
  oldest: "Oldest",
  name: "Name Aâ†’Z",
  activity: "Last activity",
};

type SourceKey = "website" | "phone" | "whatsapp" | "instagram" | "referral" | "other";
const SOURCE_ICONS: Record<SourceKey, LucideIcon> = {
  phone: Phone,
  whatsapp: MessageCircle,
  instagram: AtSign,
  referral: Users,
  website: Globe,
  other: MoreHorizontal,
};
const SOURCE_LABELS: Record<SourceKey, string> = {
  website: "Website",
  phone: "Phone",
  whatsapp: "WhatsApp",
  instagram: "Instagram",
  referral: "Referral",
  other: "Other",
};

function statusToneFor(row: EnquiryRowData): AdminTone {
  if (row.converted_booking_id) return "success";
  switch (row.status) {
    case "new":
      return "warning";
    case "contacted":
      return "info";
    case "booked":
      return "success";
    case "closed":
      return "danger";
    default:
      return "muted";
  }
}
function statusLabelFor(row: EnquiryRowData): string {
  if (row.converted_booking_id) return "Converted";
  switch (row.status) {
    case "new":
      return "New";
    case "contacted":
      return "Contacted";
    case "booked":
      return "Converted";
    case "closed":
      return "Closed";
    default:
      return row.status;
  }
}

function relativeTime(iso: string): string {
  const now = Date.now();
  const then = new Date(iso).getTime();
  const diff = Math.max(0, now - then);
  if (diff < 60_000) return "just now";
  if (diff < 3_600_000) return `${Math.floor(diff / 60_000)}m ago`;
  if (diff < 86_400_000) return `${Math.floor(diff / 3_600_000)}h ago`;
  if (diff < 604_800_000) return `${Math.floor(diff / 86_400_000)}d ago`;
  if (diff < 2_592_000_000) return `${Math.floor(diff / 604_800_000)}w ago`;
  return `${Math.floor(diff / 2_592_000_000)}mo ago`;
}

function StaffAvatarToken({ name }: { name: string | null }) {
  if (!name) {
    return (
      <span
        aria-hidden="true"
        className="inline-flex size-6 shrink-0 items-center justify-center rounded-full border border-dashed border-[var(--admin-border-form)] bg-transparent text-[var(--admin-text-muted)]"
      >
        <Minus className="size-3" />
      </span>
    );
  }
  const initials =
    name
      .split(/\s+/)
      .filter(Boolean)
      .slice(0, 2)
      .map((token) => (Array.from(token)[0] ?? "").toUpperCase())
      .join("") || "Â·";
  return (
    <span
      aria-hidden="true"
      className="inline-flex size-6 shrink-0 items-center justify-center rounded-full bg-[var(--admin-hover-mist)] text-[0.625rem] font-semibold text-[var(--admin-heading)]"
    >
      {initials}
    </span>
  );
}

export function EnquirySortSelect({
  currentSort,
  urlParamsString,
}: {
  currentSort: SortKey;
  urlParamsString: string;
}) {
  const router = useRouter();
  const id = "enq-sort-select";

  function handleChange(event: ChangeEvent<HTMLSelectElement>) {
    const next = new URLSearchParams(urlParamsString);
    if (event.target.value === "newest") next.delete("sort");
    else next.set("sort", event.target.value);
    const qs = next.toString();
    router.push(qs ? `/admin/enquiries?${qs}` : "/admin/enquiries");
  }

  return (
    <label htmlFor={id} className="flex items-center gap-2 text-xs text-[var(--admin-text-muted)]">
      <span className="font-medium">Sort</span>
      <select
        id={id}
        value={currentSort}
        onChange={handleChange}
        className="h-9 min-h-9 appearance-none rounded-[var(--admin-radius-control)] border border-[var(--admin-border-form)] bg-[var(--admin-surface-input)] pl-3 pr-8 text-sm font-medium text-[var(--admin-body)] outline-none transition-colors focus-visible:border-[var(--admin-focus)] focus-visible:ring-2 focus-visible:ring-[var(--admin-focus)]/30"
      >
        {(Object.keys(SORT_LABELS) as SortKey[]).map((key) => (
          <option key={key} value={key}>
            {SORT_LABELS[key]}
          </option>
        ))}
      </select>
    </label>
  );
}

export function EnquiryList({ rows }: { rows: EnquiryRowData[] }) {
  const router = useRouter();
  const [selected, setSelected] = useState<Set<string>>(() => new Set());
  const [pending, startTransition] = useTransition();

  const selectableIds = useMemo(
    () =>
      rows
        .filter(
          (row) =>
            !row.converted_booking_id &&
            (row.status === "new" || row.status === "contacted")
        )
        .map((row) => row.id),
    [rows]
  );
  const selectableSet = useMemo(() => new Set(selectableIds), [selectableIds]);
  // Clear stale selections (rows that scrolled out of view post-refresh).
  const effectiveSelected = useMemo(
    () => new Set(Array.from(selected).filter((id) => selectableSet.has(id))),
    [selected, selectableSet]
  );
  const allSelected =
    selectableIds.length > 0 &&
    selectableIds.every((id) => effectiveSelected.has(id));

  function toggleAll() {
    if (allSelected) setSelected(new Set());
    else setSelected(new Set(selectableIds));
  }
  function toggleOne(id: string) {
    setSelected((prev) => {
      const next = new Set(prev);
      if (next.has(id)) next.delete(id);
      else next.add(id);
      return next;
    });
  }
  function clearSelection() {
    setSelected(new Set());
  }

  async function bulkApply(
    status: "contacted" | "closed",
    successMessage: string,
    errorMessage: string
  ) {
    const ids = Array.from(effectiveSelected);
    if (ids.length === 0) return;
    startTransition(async () => {
      const results = await Promise.all(
        ids.map(async (id) => {
          const formData = new FormData();
          formData.set("enquiry_id", id);
          formData.set("status", status);
          const result = await updateEnquiryStatus(formData);
          return { id, ok: !result?.error };
        })
      );
      const fails = results.filter((r) => !r.ok);
      if (fails.length === 0) {
        toast.success(`${successMessage} (${ids.length})`);
      } else if (fails.length === ids.length) {
        toast.error(errorMessage, { duration: Infinity });
      } else {
        toast.error(
          `${fails.length} of ${ids.length} couldn't update. Try again.`,
          { duration: Infinity }
        );
      }
      setSelected(new Set());
      router.refresh();
    });
  }

  return (
    <>
      {selectableIds.length > 0 ? (
        <div className="flex items-center justify-between gap-3 px-1">
          <label className="inline-flex cursor-pointer items-center gap-2 text-xs text-[var(--admin-text-muted)]">
            <input
              type="checkbox"
              checked={allSelected}
              onChange={toggleAll}
              aria-label={
                allSelected
                  ? "Deselect all enquiries"
                  : `Select all ${selectableIds.length} actionable enquiries on this view`
              }
              className="size-4 cursor-pointer rounded border-[var(--admin-border-form)] accent-[var(--admin-primary)] outline-none focus-visible:ring-2 focus-visible:ring-[var(--admin-focus)]/55"
            />
            <span className="font-medium">
              Select all on this view ({selectableIds.length})
            </span>
          </label>
        </div>
      ) : null}

      <ul className="grid list-none gap-3">
        {rows.map((row) => (
          <li key={row.id}>
            <EnquiryRow
              enquiry={row}
              selectable={selectableSet.has(row.id)}
              selected={effectiveSelected.has(row.id)}
              onToggle={() => toggleOne(row.id)}
            />
          </li>
        ))}
      </ul>

      {effectiveSelected.size > 0 ? (
        <BulkActionBar
          count={effectiveSelected.size}
          pending={pending}
          onMarkContacted={() =>
            bulkApply(
              "contacted",
              "Marked as contacted.",
              "Couldn't mark those as contacted. Try again."
            )
          }
          onClose={() =>
            bulkApply(
              "closed",
              "Enquiries closed.",
              "Couldn't close those. Try again."
            )
          }
          onClear={clearSelection}
        />
      ) : null}
    </>
  );
}

function EnquiryRow({
  enquiry,
  selectable,
  selected,
  onToggle,
}: {
  enquiry: EnquiryRowData;
  selectable: boolean;
  selected: boolean;
  onToggle: () => void;
}) {
  const sourceKey = (
    SOURCE_LABELS[enquiry.source as SourceKey] ? enquiry.source : "other"
  ) as SourceKey;
  const SourceIcon = SOURCE_ICONS[sourceKey];
  const sourceLabel = SOURCE_LABELS[sourceKey];
  const tone = statusToneFor(enquiry);
  const statusLabel = statusLabelFor(enquiry);
  const firstName = enquiry.full_name.split(/\s+/)[0] || enquiry.full_name;
  const converted = Boolean(enquiry.converted_booking_id);
  const isClosed = enquiry.status === "closed";

  // F4 â€” last activity. If updated_at differs from created_at by â‰¥60s, show it; else nothing.
  const createdMs = new Date(enquiry.created_at).getTime();
  const updatedMs = enquiry.updated_at ? new Date(enquiry.updated_at).getTime() : createdMs;
  const hasMeaningfulUpdate = updatedMs - createdMs > 60_000;

  return (
    <div
      className={cn(
        "flex min-w-0 items-stretch gap-2 transition-colors",
        selected
          ? "rounded-[var(--admin-radius-card)] bg-[var(--admin-selected-sky)]/40 ring-1 ring-[var(--admin-primary)]/40"
          : ""
      )}
    >
      {selectable ? (
        <label
          className="flex shrink-0 cursor-pointer items-start pt-5 pl-1"
          title={selected ? "Deselect" : "Select for bulk action"}
        >
          <input
            type="checkbox"
            checked={selected}
            onChange={onToggle}
            aria-label={`Select ${enquiry.full_name}`}
            className="size-4 cursor-pointer rounded border-[var(--admin-border-form)] accent-[var(--admin-primary)] outline-none focus-visible:ring-2 focus-visible:ring-[var(--admin-focus)]/55"
          />
        </label>
      ) : (
        <span className="w-5 shrink-0" aria-hidden="true" />
      )}
      <div className="min-w-0 flex-1">
        <AdminEntityRow
          leading={
            <span
              aria-label={`From ${sourceLabel}`}
              title={`From ${sourceLabel}`}
              className="inline-flex size-10 items-center justify-center rounded-full bg-[var(--admin-panel-muted)] text-[var(--admin-body)]"
            >
              <SourceIcon className="size-4" aria-hidden="true" />
            </span>
          }
          title={enquiry.full_name}
          badges={<AdminStatusBadge value={statusLabel} tone={tone} compact />}
          meta={
            <div className="flex flex-wrap items-center gap-x-2 gap-y-1">
              <span>{sourceLabel}</span>
              <span aria-hidden="true">Â·</span>
              <span>
                {enquiry.phone ? (
                  <a
                    href={`tel:${enquiry.phone}`}
                    className="underline-offset-2 hover:text-[var(--admin-heading)] hover:underline"
                  >
                    {enquiry.phone}
                  </a>
                ) : enquiry.email ? (
                  <a
                    href={`mailto:${enquiry.email}`}
                    className="underline-offset-2 hover:text-[var(--admin-heading)] hover:underline"
                  >
                    {enquiry.email}
                  </a>
                ) : (
                  <span className="italic">No contact on file</span>
                )}
              </span>
              <span aria-hidden="true">Â·</span>
              <span title={`Received ${formatDateTime(enquiry.created_at)}`}>
                {formatDateTime(enquiry.created_at)}
              </span>
              {hasMeaningfulUpdate && enquiry.updated_at ? (
                <>
                  <span aria-hidden="true">Â·</span>
                  <span
                    className="font-medium text-[var(--admin-body)]"
                    title={`Last update: ${formatDateTime(enquiry.updated_at)}`}
                  >
                    Updated {relativeTime(enquiry.updated_at)}
                  </span>
                </>
              ) : null}
            </div>
          }
          description={
            <div className="grid gap-2">
              <p className="text-sm leading-6 text-[var(--admin-body)]">
                <span className="font-medium text-[var(--admin-heading)]">Interest:</span>{" "}
                {enquiry.service_interest || (
                  <span className="italic text-[var(--admin-text-muted)]">Not specified</span>
                )}
              </p>
              <div
                title={
                  enquiry.assignedName
                    ? `Assigned to ${enquiry.assignedName}`
                    : "Unassigned"
                }
                className="flex items-center gap-2 text-xs text-[var(--admin-text-muted)]"
              >
                <StaffAvatarToken name={enquiry.assignedName} />
                <span className="font-medium">
                  {enquiry.assignedName ? (
                    enquiry.assignedName
                  ) : (
                    <span className="italic">Unassigned</span>
                  )}
                </span>
              </div>
              {enquiry.notes ? (
                <div className="rounded-[var(--admin-radius-control)] border border-[var(--admin-border)] bg-[var(--admin-panel-muted)] px-3 py-2 text-sm leading-6 text-[var(--admin-body)]">
                  <p className="text-[0.6875rem] font-semibold uppercase tracking-[0.06em] text-[var(--admin-text-muted)]">
                    Notes
                  </p>
                  <p className="mt-1 whitespace-pre-wrap">{enquiry.notes}</p>
                </div>
              ) : null}
            </div>
          }
          actions={
            <RowActions
              enquiry={enquiry}
              firstName={firstName}
              converted={converted}
              isClosed={isClosed}
            />
          }
        />
      </div>
    </div>
  );
}

function RowActions({
  enquiry,
  firstName,
  converted,
  isClosed,
}: {
  enquiry: EnquiryRowData;
  firstName: string;
  converted: boolean;
  isClosed: boolean;
}) {
  if (converted) {
    return (
      <Link
        href={`/admin/bookings/${enquiry.converted_booking_id}`}
        title="Open the booking that came from this enquiry"
        className="inline-flex h-9 min-h-11 sm:min-h-9 items-center gap-1.5 rounded-[var(--admin-radius-control)] px-3 text-sm font-medium text-[var(--admin-body)] outline-none transition-colors hover:bg-[var(--admin-panel-muted)] hover:text-[var(--admin-heading)] focus-visible:ring-2 focus-visible:ring-[var(--admin-focus)]/55"
      >
        View booking <span aria-hidden="true">â†’</span>
      </Link>
    );
  }
  if (isClosed) {
    return (
      <AdminActionMenu label={`More actions for ${enquiry.full_name}`}>
        <EnquiryStatusButton
          enquiryId={enquiry.id}
          status="new"
          successMessage="Enquiry reopened."
          className="w-full justify-start"
        >
          Reopen as new
        </EnquiryStatusButton>
      </AdminActionMenu>
    );
  }
  return (
    <AdminActionGroup>
      {enquiry.status === "new" ? (
        <EnquiryStatusButton
          enquiryId={enquiry.id}
          status="contacted"
          successMessage="Marked as contacted."
        >
          Mark contacted
        </EnquiryStatusButton>
      ) : null}
      <Link
        href={`/admin/bookings/new?enquiryId=${enquiry.id}`}
        title={`Open a new booking pre-filled from ${firstName}`}
        className="inline-flex h-9 min-h-11 sm:min-h-9 items-center rounded-[var(--admin-radius-control)] px-3 text-sm font-medium text-[var(--admin-body)] outline-none transition-colors hover:bg-[var(--admin-panel-muted)] hover:text-[var(--admin-heading)] focus-visible:ring-2 focus-visible:ring-[var(--admin-focus)]/55"
      >
        Convert
      </Link>
      <AdminActionMenu label={`More actions for ${enquiry.full_name}`}>
        <EnquiryStatusButton
          enquiryId={enquiry.id}
          status="closed"
          successMessage="Enquiry closed."
          errorMessage="Couldn't close that one. Try again."
          destructive
          className="w-full justify-start"
        >
          Close enquiry
        </EnquiryStatusButton>
      </AdminActionMenu>
    </AdminActionGroup>
  );
}

function BulkActionBar({
  count,
  pending,
  onMarkContacted,
  onClose,
  onClear,
}: {
  count: number;
  pending: boolean;
  onMarkContacted: () => void;
  onClose: () => void;
  onClear: () => void;
}) {
  return (
    <div
      role="region"
      aria-label="Bulk actions"
      className="sticky bottom-2 z-20 flex flex-wrap items-center justify-between gap-3 rounded-[var(--admin-radius-card)] border border-[var(--admin-primary)]/40 bg-[var(--admin-panel)] px-3 py-2 shadow-[0_4px_16px_oklch(23%_0.073_155_/_0.18)]"
    >
      <div className="flex items-center gap-2 text-sm font-medium text-[var(--admin-heading)]">
        <span className="inline-flex size-7 items-center justify-center rounded-full bg-[var(--admin-primary)] text-[0.6875rem] font-semibold text-white">
          {count}
        </span>
        <span>{count === 1 ? "1 enquiry selected" : `${count} enquiries selected`}</span>
      </div>
      <div className="flex flex-wrap items-center gap-2">
        <button
          type="button"
          disabled={pending}
          onClick={onMarkContacted}
          aria-busy={pending || undefined}
          className="inline-flex h-10 min-h-11 sm:min-h-10 items-center gap-1.5 rounded-[var(--admin-radius-control)] border border-[var(--admin-border-form)] bg-transparent px-3 text-sm font-medium text-[var(--admin-body)] outline-none transition-colors hover:bg-[var(--admin-panel-muted)] hover:text-[var(--admin-heading)] focus-visible:ring-2 focus-visible:ring-[var(--admin-focus)]/55 disabled:opacity-60 disabled:cursor-not-allowed"
        >
          {pending ? (
            <Loader2 className="size-3.5 shrink-0 animate-spin" aria-hidden="true" />
          ) : (
            <CheckCircle className="size-3.5 shrink-0" aria-hidden="true" />
          )}
          Mark contacted
        </button>
        <button
          type="button"
          disabled={pending}
          onClick={onClose}
          aria-busy={pending || undefined}
          className="inline-flex h-10 min-h-11 sm:min-h-10 items-center gap-1.5 rounded-[var(--admin-radius-control)] px-3 text-sm font-medium text-[oklch(26%_0.14_25)] outline-none transition-colors hover:bg-[oklch(95.5%_0.028_20)] focus-visible:ring-2 focus-visible:ring-[var(--admin-focus)]/55 disabled:opacity-60 disabled:cursor-not-allowed"
        >
          {pending ? (
            <Loader2 className="size-3.5 shrink-0 animate-spin" aria-hidden="true" />
          ) : (
            <XCircle className="size-3.5 shrink-0" aria-hidden="true" />
          )}
          Close
        </button>
        <button
          type="button"
          onClick={onClear}
          disabled={pending}
          className="inline-flex h-10 min-h-11 sm:min-h-10 items-center gap-1.5 rounded-[var(--admin-radius-control)] px-3 text-sm font-medium text-[var(--admin-text-muted)] outline-none transition-colors hover:bg-[var(--admin-panel-muted)] hover:text-[var(--admin-heading)] focus-visible:ring-2 focus-visible:ring-[var(--admin-focus)]/55 disabled:opacity-60"
        >
          <X className="size-3.5 shrink-0" aria-hidden="true" />
          Clear selection
        </button>
      </div>
    </div>
  );
}
