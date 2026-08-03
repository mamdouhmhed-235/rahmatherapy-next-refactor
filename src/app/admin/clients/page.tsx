import Link from "next/link";
import { redirect } from "next/navigation";
import { Plus, SlidersHorizontal, UserPlus, Users } from "lucide-react";
import { createSupabaseServerClient } from "@/lib/supabase/server";
import { getAdminPageAccess } from "@/lib/auth/admin-access";
import { canManageClientDestructiveOps, getStaffProfile } from "@/lib/auth/rbac";
import {
  AdminAccessDenied,
  AdminPageHeader,
  AdminStatusBadge,
  type AdminTone,
} from "../components/admin-ui";
import { AdminSheet } from "../components/admin-ui-interactions";
import { EmptyState } from "../components/EmptyState";
import { PaginationBar } from "../components/PaginationBar";
import { LIST_PAGE_SIZE } from "@/lib/pagination";
import { formatDate, formatMoney } from "./format";
import { getClientDataAccess } from "./access";
import {
  CLIENT_CANDIDATE_CAP,
  CLIENT_CANDIDATE_VIEW_ALL_CAP,
  clientListContextFromQuery,
  getClientsListPage,
  resolveClientCandidateBannerState,
  type ClientLifecycleKey,
  type ClientListRow,
  type ClientSortKey,
} from "./clients-list-data";
import type { ClientBookingRecord, ClientRecord } from "./types";
import { ClientRowMenu, type LastBookingSummary } from "./ClientRowMenu";
import {
  ClientSelectCheckbox,
  ClientSelectionProvider,
} from "./components/BulkDeleteToolbar";
import { ClientFlashToast } from "./components/DeleteClientButton";

export const metadata = {
  title: "Clients - Rahma Therapy Admin",
};

interface ClientsPageProps {
  searchParams: Promise<{
    q?: string;
    lifecycle?: string;
    payment?: string;
    location?: string;
    source?: string;
    sort?: string;
    page?: string;
    show_deleted?: string;
    deleted?: string;
    /** C-16 closeout — "1" raises the candidate ceiling to CLIENT_CANDIDATE_VIEW_ALL_CAP. */
    all?: string;
  }>;
}

// The four RBAC select variants moved to clients-list-data.ts with the fetch
// (C-09 Phase C Step 5), including the note on why `deleted_at` is selected in
// both client branches and in neither booking branch.
//
// C-16 Phase C Step 8 — so did every derivation this page used to run over an
// unbounded in-memory client→bookings map: the lifecycle rules, the visit
// counts, the outstanding-balance sum, the search/filter predicates, the sort
// and the paging. `getClientsListPage` resolves one filter context into the
// total, the stats and exactly one page of rows; what is left here is display.

const AZ_THRESHOLD = 40;

type LifecycleKey = ClientLifecycleKey;
type SortKey = ClientSortKey;

const LIFECYCLE_LABEL: Record<LifecycleKey, string> = {
  new: "New",
  returning: "Returning",
  at_risk: "At-risk",
  lapsed: "Lapsed",
};

const LIFECYCLE_TONE: Record<LifecycleKey, AdminTone> = {
  new: "info",
  returning: "success",
  at_risk: "warning",
  lapsed: "restricted",
};

const LIFECYCLE_TITLE: Record<LifecycleKey, string> = {
  new: "New: joined within the last 30 days",
  returning: "Returning: 3 or more visits",
  at_risk: "At-risk: last visit over 3 months ago",
  lapsed: "Lapsed: last visit over 6 months ago",
};

function deterministicHue(id: string): number {
  let hash = 0;
  for (let i = 0; i < id.length; i++) {
    hash = (hash * 31 + id.charCodeAt(i)) >>> 0;
  }
  return hash % 360;
}

function getInitials(name: string): string {
  const parts = name.trim().split(/\s+/).filter(Boolean);
  if (parts.length === 0) return "?";
  if (parts.length === 1) {
    return Array.from(parts[0]).slice(0, 2).join("").toUpperCase();
  }
  const first = Array.from(parts[0])[0] ?? "";
  const last = Array.from(parts[parts.length - 1])[0] ?? "";
  return (first + last).toUpperCase();
}

function letterBucket(name: string): string {
  const letter = (Array.from(name.trim())[0] ?? "#").toUpperCase();
  return /[A-Z]/.test(letter) ? letter : "#";
}

export default async function ClientsPage({ searchParams }: ClientsPageProps) {
  const params = await searchParams;
  const justDeleted = params.deleted === "1";

  const supabase = await createSupabaseServerClient();
  const profile = await getStaffProfile(supabase);

  if (!profile || !profile.active) {
    redirect("/admin/login");
  }

  const pageAccess = getAdminPageAccess(profile, "clients");

  const hasAllClientAccess =
    pageAccess.access &&
    (pageAccess.dataScope === "all" || pageAccess.dataScope === "sensitive_hidden");

  if (!hasAllClientAccess) {
    return (
      <AdminAccessDenied
        title="You don't have access to this section"
        message="Therapists see clients only through their assigned bookings."
        actions={
          <Link
            href="/admin/bookings?view=assigned"
            className="inline-flex h-10 items-center rounded-[var(--admin-radius-control)] bg-[var(--admin-primary)] px-4 text-sm font-semibold text-[var(--admin-on-primary)] outline-none transition-colors hover:bg-[var(--admin-primary-hover)] focus-visible:ring-2 focus-visible:ring-[var(--admin-focus)]/55"
          >
            Back to my bookings
          </Link>
        }
      />
    );
  }

  const clientAccess = getClientDataAccess(profile, {
    hasAssignedBooking: hasAllClientAccess,
  });
  const canManageClients = clientAccess.canManageClient;

  // ONE context — the search, the filters, the deleted scope (now a real SQL
  // predicate, not an in-memory pass), the sort and the day boundary — feeds
  // the total, the stats and the page window alike.
  const context = clientListContextFromQuery(params, {
    canViewContactDetails: clientAccess.canViewContactDetails,
  });
  const listPage = await getClientsListPage({
    context,
    page: params.page,
  });

  const q = context.q ?? "";
  const lifecycle = context.lifecycle ?? "";
  const payment = context.payment ?? "";
  const location = context.location ?? "";
  const source = context.source ?? "";
  const sort = context.sort;
  const showDeleted = context.includeDeleted ? "1" : "";
  const viewAll = context.viewAll ? "1" : "";

  const canDeleteClients = canManageClientDestructiveOps(profile);
  const { rows: pageRows, deletedCount, stats } = listPage;

  type Row = ClientListRow;

  // Only live rows are selectable — a deleted row offers "View" and nothing
  // else (brief §5.3).
  const selectableClients = pageRows
    .filter((row) => !row.client.deleted_at)
    .map((row) => ({ id: row.client.id, full_name: row.client.full_name }));

  const totalClientCount = listPage.totalInScope;
  const isFiltered = Boolean(q || lifecycle || payment || location || source);
  const isAlphaSort = sort === "name";
  const showAzStrip = isAlphaSort && !q && totalClientCount >= AZ_THRESHOLD;

  const groupedRows: { letter: string; rows: Row[] }[] = [];
  if (isAlphaSort) {
    const buckets = new Map<string, Row[]>();
    for (const row of pageRows) {
      const letter = letterBucket(row.client.full_name);
      const list = buckets.get(letter) ?? [];
      list.push(row);
      buckets.set(letter, list);
    }
    for (const letter of Array.from(buckets.keys()).sort()) {
      groupedRows.push({ letter, rows: buckets.get(letter)! });
    }
  }

  const lettersInResults = new Set(groupedRows.map((group) => group.letter));
  const lifecycleChipLabel = lifecycle ? LIFECYCLE_LABEL[lifecycle as LifecycleKey] : null;

  const filterValues = {
    q,
    lifecycle,
    payment,
    location,
    source,
    sort,
    show_deleted: showDeleted,
    // Carried by every builder below, so narrowing a filter or switching sort
    // never silently drops the reader back to the smaller candidate ceiling.
    all: viewAll,
  };

  // C-16 closeout — the candidate ceiling's honest signal. `cappedOut` before
  // `hidden`, resolved in clients-list-data.ts; each link below flips the
  // toggle it is NOT currently in, so neither can target the URL already open.
  const candidateBannerState = resolveClientCandidateBannerState({
    candidateTotal: listPage.candidateTotal,
    candidateShown: listPage.candidateShown,
    viewAll: context.viewAll,
  });
  const candidateAllHref = buildViewAllHref(filterValues, true);
  const candidateCappedHref = buildViewAllHref(filterValues, false);
  // The stats line is computed over the deleted-scope roster, which is read
  // under the same ceiling — say so when it bound, rather than presenting a
  // partial count as the whole client base.
  const statsAreCapped = listPage.statsBasis < totalClientCount;

  const activeChips: { label: string; href: string }[] = [];
  if (q) {
    activeChips.push({
      label: `Search: ${q}`,
      href: buildClearLinkHref(filterValues, "q"),
    });
  }
  if (lifecycle) {
    activeChips.push({
      label: `Lifecycle: ${lifecycleChipLabel ?? lifecycle}`,
      href: buildClearLinkHref(filterValues, "lifecycle"),
    });
  }
  if (payment) {
    activeChips.push({
      label: `Payment: ${formatPaymentLabel(payment)}`,
      href: buildClearLinkHref(filterValues, "payment"),
    });
  }
  if (location) {
    activeChips.push({
      label: `Location: ${location}`,
      href: buildClearLinkHref(filterValues, "location"),
    });
  }
  if (source) {
    activeChips.push({
      label: `Source: ${formatSourceLabel(source)}`,
      href: buildClearLinkHref(filterValues, "source"),
    });
  }

  const mobileFilterForm = (
    <form
      method="get"
      action="/admin/clients"
      className="grid gap-3"
    >
      <FilterFields
        q={q}
        lifecycle={lifecycle}
        payment={payment}
        location={location}
        source={source}
        idSuffix="mobile"
      />
      <fieldset className="grid gap-1.5">
        <legend className="text-sm font-medium text-[var(--admin-heading)]">
          Sort clients by
        </legend>
        <div className="grid grid-cols-2 gap-2">
          <label
            className={`inline-flex h-10 items-center justify-center rounded-[var(--admin-radius-control)] border px-3 text-sm font-medium ${
              sort === "name"
                ? "border-[var(--admin-primary)] bg-[var(--admin-selected-sky)] text-[var(--admin-heading)]"
                : "border-[var(--admin-border-form)] bg-transparent text-[var(--admin-body)]"
            }`}
          >
            <input
              type="radio"
              name="sort"
              value="name"
              defaultChecked={sort === "name"}
              className="sr-only"
            />
            Name A–Z
          </label>
          <label
            className={`inline-flex h-10 items-center justify-center rounded-[var(--admin-radius-control)] border px-3 text-sm font-medium ${
              sort === "last_visit"
                ? "border-[var(--admin-primary)] bg-[var(--admin-selected-sky)] text-[var(--admin-heading)]"
                : "border-[var(--admin-border-form)] bg-transparent text-[var(--admin-body)]"
            }`}
          >
            <input
              type="radio"
              name="sort"
              value="last_visit"
              defaultChecked={sort === "last_visit"}
              className="sr-only"
            />
            Last visit
          </label>
        </div>
      </fieldset>
      <button
        type="submit"
        className="inline-flex h-11 items-center justify-center rounded-[var(--admin-radius-control)] bg-[var(--admin-primary)] px-4 text-sm font-semibold text-[var(--admin-on-primary)] outline-none transition-colors hover:bg-[var(--admin-primary-hover)] focus-visible:ring-2 focus-visible:ring-[var(--admin-focus)]/55"
      >
        Apply filters
      </button>
    </form>
  );

  // `grid-cols-[minmax(0,1fr)]` pins the single column to the container. Left
  // implicit, the `auto` track sizes to the widest child's min-content — the
  // client rows, 564px at a 375px viewport — and every page-level sibling gets
  // stretched with it, pushing the sticky bulk-action bar's buttons past the
  // right edge with no horizontal scroll to reach them. The rows themselves
  // keep their existing overflow; only the track is clamped.
  return (
    <div className="grid grid-cols-[minmax(0,1fr)] gap-5 pb-24 lg:pb-16">
      {justDeleted ? (
        <ClientFlashToast message="Client deleted." param="deleted" />
      ) : null}
      <AdminPageHeader
        title="Clients"
        actions={
          canManageClients ? (
            <Link
              href="/admin/clients/new"
              className="inline-flex h-10 items-center gap-1.5 rounded-[var(--admin-radius-control)] border border-[var(--admin-border-form)] bg-transparent px-4 text-sm font-semibold text-[var(--admin-body)] outline-none transition-colors hover:bg-[var(--admin-panel-muted)] focus-visible:ring-2 focus-visible:ring-[var(--admin-focus)]/55"
            >
              <Plus className="size-4" aria-hidden="true" />
              New client
            </Link>
          ) : null
        }
      />

      {/* C2 stats line — replaces filler description */}
      <p
        className="-mt-2 flex flex-wrap items-center gap-x-1 gap-y-1 text-sm text-[var(--admin-text-muted)]"
        aria-label="Client base summary"
      >
        <StatLink
          label={`${stats.active} active`}
          href="/admin/clients"
          active={!lifecycle}
        />
        <Dot />
        <StatLink
          label={`${stats.newThisMonth} new this month`}
          href={buildFilterHref(filterValues, "lifecycle", "new")}
          active={lifecycle === "new"}
        />
        <Dot />
        <StatLink
          label={`${stats.returning} returning`}
          href={buildFilterHref(filterValues, "lifecycle", "returning")}
          active={lifecycle === "returning"}
        />
        <Dot />
        <StatLink
          label={`${stats.atRiskLapsed} at risk or lapsed`}
          href={buildFilterHref(filterValues, "lifecycle", "at_risk")}
          active={lifecycle === "at_risk" || lifecycle === "lapsed"}
        />
        {statsAreCapped ? (
          <span className="basis-full text-xs text-[var(--admin-text-muted)]">
            Counted over the first {listPage.statsBasis} of {totalClientCount}{" "}
            clients — see the note below.
          </span>
        ) : null}
      </p>

      {/* Desktop filter bar (≥lg) — GET form */}
      <form
        method="get"
        action="/admin/clients"
        className="hidden gap-3 rounded-[var(--admin-radius-card)] border border-[var(--admin-border)] bg-[var(--admin-panel)] p-3 lg:grid lg:grid-cols-[minmax(0,2fr)_repeat(4,minmax(0,1fr))_auto] lg:items-end"
      >
        <FilterField label="Search" htmlFor="clients-q">
          <input
            id="clients-q"
            name="q"
            type="search"
            defaultValue={q}
            placeholder="Search by name, email, or phone"
            autoComplete="off"
            className="h-10 w-full rounded-[var(--admin-radius-control)] border border-[var(--admin-border-form)] bg-[var(--admin-surface-input)] px-3 text-sm text-[var(--admin-body)] outline-none transition-colors placeholder:text-[var(--admin-text-muted)] focus-visible:border-[var(--admin-focus)] focus-visible:ring-2 focus-visible:ring-[var(--admin-focus)]/30"
          />
        </FilterField>
        <FilterField label="Lifecycle" htmlFor="clients-lifecycle">
          <FilterSelect id="clients-lifecycle" name="lifecycle" defaultValue={lifecycle}>
            <option value="">Any lifecycle</option>
            <option value="new">New</option>
            <option value="returning">Returning</option>
            <option value="at_risk">At-risk</option>
            <option value="lapsed">Lapsed</option>
          </FilterSelect>
        </FilterField>
        <FilterField label="Payment" htmlFor="clients-payment">
          <FilterSelect id="clients-payment" name="payment" defaultValue={payment}>
            <option value="">Any payment</option>
            <option value="in_good_standing">In good standing</option>
            <option value="outstanding">Has outstanding</option>
          </FilterSelect>
        </FilterField>
        <FilterField label="Location" htmlFor="location">
          <input
            id="location"
            name="location"
            type="text"
            defaultValue={location}
            placeholder="City or area"
            autoComplete="off"
            className="h-10 w-full rounded-[var(--admin-radius-control)] border border-[var(--admin-border-form)] bg-[var(--admin-surface-input)] px-3 text-sm text-[var(--admin-body)] outline-none transition-colors placeholder:text-[var(--admin-text-muted)] focus-visible:border-[var(--admin-focus)] focus-visible:ring-2 focus-visible:ring-[var(--admin-focus)]/30"
          />
        </FilterField>
        <FilterField label="Source" htmlFor="clients-source">
          <FilterSelect id="clients-source" name="source" defaultValue={source}>
            <option value="">Any source</option>
            <option value="website">Website</option>
            <option value="phone">Phone</option>
            <option value="whatsapp">WhatsApp</option>
            <option value="instagram">Instagram</option>
            <option value="referral">Referral</option>
            <option value="manual">Manual</option>
            <option value="other">Other</option>
          </FilterSelect>
        </FilterField>
        <input type="hidden" name="sort" value={sort} />
        <button
          type="submit"
          className="inline-flex h-10 items-center justify-center rounded-[var(--admin-radius-control)] border border-[var(--admin-border-form)] bg-transparent px-4 text-sm font-semibold text-[var(--admin-body)] outline-none transition-colors hover:bg-[var(--admin-panel-muted)] focus-visible:ring-2 focus-visible:ring-[var(--admin-focus)]/55"
        >
          Apply filters
        </button>
      </form>

      {/* Mobile + tablet filter trigger (<lg) — AdminSheet bottom drawer */}
      <div className="lg:hidden">
        <AdminSheet
          title="Refine"
          description="Filter and sort the directory."
          side="bottom"
          trigger={
            <button
              type="button"
              className="inline-flex h-11 w-full items-center justify-between gap-2 rounded-[var(--admin-radius-card)] border border-[var(--admin-border)] bg-[var(--admin-panel)] px-4 text-sm font-semibold text-[var(--admin-body)] outline-none transition-colors hover:bg-[var(--admin-panel-muted)] focus-visible:ring-2 focus-visible:ring-[var(--admin-focus)]/55"
            >
              <span className="inline-flex items-center gap-1.5">
                <SlidersHorizontal className="size-4" aria-hidden="true" />
                Refine
                {activeChips.length > 0 ? (
                  <span className="inline-flex min-w-[1.25rem] items-center justify-center rounded-full bg-[var(--admin-primary)] px-1.5 text-[0.6875rem] font-semibold text-[var(--admin-on-primary)]">
                    {activeChips.length}
                  </span>
                ) : null}
              </span>
            </button>
          }
        >
          {mobileFilterForm}
        </AdminSheet>
      </div>

      {/* Sort toggle + count summary — frameless (A11) */}
      <div className="hidden flex-wrap items-center justify-between gap-3 lg:flex">
        {/* The window ("Showing 26–50 of 3,412") is the pager's job now — this
            line stays the result-set-vs-directory summary it always was. */}
        <p className="text-sm text-[var(--admin-text-muted)]">
          {listPage.total === 0 ? (
            <>0 of {totalClientCount} clients</>
          ) : (
            <>
              {listPage.total} of {totalClientCount} client
              {totalClientCount === 1 ? "" : "s"}
            </>
          )}
        </p>
        <div
          role="group"
          aria-label="Sort clients by"
          className="inline-flex items-center gap-1 rounded-[var(--admin-radius-control)] bg-[var(--admin-surface-input)] p-1"
        >
          <SortLink
            label="Name A–Z"
            href={buildSortHref(filterValues, "name")}
            active={sort === "name"}
            srHint="Sort alphabetically by name"
          />
          <SortLink
            label="Last visit"
            href={buildSortHref(filterValues, "last_visit")}
            active={sort === "last_visit"}
            srHint="Sort by most recent visit first"
          />
        </div>
      </div>

      {/* C-16 closeout — the candidate ceiling, stated. Mirrors the notes and
          availability rails' banners (cappedOut checked before hidden, in
          clients-list-data.ts) and sits ABOVE the rows because it qualifies
          the count line, the stats line and the pager alike, not just a rail. */}
      {candidateBannerState.kind === "cappedOut" ? (
        <p
          role="status"
          className="-mt-1 rounded-[var(--admin-radius-card)] border border-[var(--admin-border)] bg-[var(--admin-panel-muted)] px-3 py-2 text-xs leading-5 text-[var(--admin-text-muted)]"
        >
          Read the first {listPage.candidateShown} of {candidateBannerState.total}{" "}
          matching clients. The count, the stats and every page here cover only
          those, and no view reaches further — narrow the search or the filters
          to get to the rest.{" "}
          <Link
            href={candidateCappedHref}
            className="font-semibold text-[var(--admin-primary)] underline-offset-4 outline-none hover:underline focus-visible:ring-2 focus-visible:ring-[var(--admin-focus)]/55"
          >
            Back to the first {CLIENT_CANDIDATE_CAP}
          </Link>
        </p>
      ) : candidateBannerState.kind === "hidden" ? (
        <p
          role="status"
          className="-mt-1 rounded-[var(--admin-radius-card)] border border-[var(--admin-border)] bg-[var(--admin-panel-muted)] px-3 py-2 text-xs leading-5 text-[var(--admin-text-muted)]"
        >
          Read the first {listPage.candidateShown} of {candidateBannerState.total}{" "}
          matching clients. The count, the stats and every page here cover only
          those.{" "}
          <Link
            href={candidateAllHref}
            className="font-semibold text-[var(--admin-primary)] underline-offset-4 outline-none hover:underline focus-visible:ring-2 focus-visible:ring-[var(--admin-focus)]/55"
          >
            Read the first {CLIENT_CANDIDATE_VIEW_ALL_CAP} instead
          </Link>
        </p>
      ) : candidateBannerState.kind === "viewingAll" ? (
        <p className="-mt-1 text-xs text-[var(--admin-text-muted)]">
          Reading all {candidateBannerState.total} matching clients.{" "}
          <Link
            href={candidateCappedHref}
            className="font-semibold text-[var(--admin-primary)] underline-offset-4 outline-none hover:underline focus-visible:ring-2 focus-visible:ring-[var(--admin-focus)]/55"
          >
            Back to the first {CLIENT_CANDIDATE_CAP}
          </Link>
        </p>
      ) : null}

      {/* Active filter chips */}
      {activeChips.length > 0 ? (
        <ul className="-mt-1 flex flex-wrap gap-2" aria-label="Active filters">
          {activeChips.map((chip) => (
            <li key={chip.label}>
              <Link
                href={chip.href}
                className="inline-flex h-8 items-center gap-1.5 rounded-full border border-[var(--admin-border-form)] bg-[var(--admin-panel)] px-3 text-xs font-medium text-[var(--admin-body)] outline-none transition-colors hover:bg-[var(--admin-panel-muted)] focus-visible:ring-2 focus-visible:ring-[var(--admin-focus)]/55"
              >
                {chip.label}
                <span aria-hidden="true">×</span>
                <span className="sr-only">remove</span>
              </Link>
            </li>
          ))}
          <li>
            <Link
              href="/admin/clients"
              className="inline-flex h-8 items-center rounded-full px-3 text-xs font-semibold text-[var(--admin-primary)] underline-offset-4 hover:underline"
            >
              Clear filters
            </Link>
          </li>
        </ul>
      ) : null}

      {/* Soft-deleted visibility (brief §5.3) — hidden by default, and the
          toggle only appears when there is something behind it. */}
      {deletedCount > 0 || showDeleted ? (
        <div className="-mt-1">
          <Link
            href={buildShowDeletedHref(filterValues, !showDeleted)}
            className="inline-flex h-8 items-center rounded-full border border-[var(--admin-border-form)] bg-[var(--admin-panel)] px-3 text-xs font-medium text-[var(--admin-body)] outline-none transition-colors hover:bg-[var(--admin-panel-muted)] focus-visible:ring-2 focus-visible:ring-[var(--admin-focus)]/55"
          >
            {showDeleted ? "Hide deleted" : `Show deleted (${deletedCount})`}
          </Link>
        </div>
      ) : null}

      {/* Body */}
      {pageRows.length === 0 ? (
        isFiltered ? (
          <EmptyState
            icon={Users}
            title={q ? `No clients match "${q}"` : "No clients match"}
            message={
              q
                ? "Check the spelling, or try a phone number."
                : "Try adjusting or clearing your filters."
            }
            action={{ label: "Clear filters", href: "/admin/clients" }}
          />
        ) : (
          <EmptyState
            icon={UserPlus}
            illustrationSrc="/images/admin/empty-states/no-clients.svg"
            title="No clients yet"
            message="Add a client to start a history, or take a booking and we'll create one."
            action={
              canManageClients
                ? { label: "New client", href: "/admin/clients/new" }
                : undefined
            }
          />
        )
      ) : (
        <ClientSelectionProvider
          enabled={canDeleteClients}
          clients={selectableClients}
        >
          <div
            className={`relative ${showAzStrip ? "lg:pr-12" : ""}`}
            aria-busy={false}
          >
            {isAlphaSort ? (
              <div className="grid gap-6">
                {groupedRows.map((group) => (
                  <section key={group.letter} aria-labelledby={`section-${group.letter}`}>
                    <div className="sticky top-[var(--admin-topnav-offset,0px)] z-10 mb-2 flex items-baseline gap-3 bg-[var(--admin-surface)] pt-1 pb-1">
                      <h2
                        id={`section-${group.letter}`}
                        className="font-display text-[1.333rem] font-semibold leading-none tracking-[-0.01em] text-[var(--admin-heading)]"
                      >
                        {group.letter}
                      </h2>
                      <span
                        aria-hidden="true"
                        className="h-px flex-1 bg-[var(--admin-border)]"
                      />
                    </div>
                    <ul className="grid list-none gap-1.5 p-0">
                      {group.rows.map((row) => (
                        <ClientRow
                          key={row.client.id}
                          row={row}
                          showContact={clientAccess.canViewContactDetails}
                          canDelete={canDeleteClients}
                        />
                      ))}
                    </ul>
                  </section>
                ))}
              </div>
            ) : (
              <ul className="grid list-none gap-1.5 p-0">
                {pageRows.map((row) => (
                  <ClientRow
                    key={row.client.id}
                    row={row}
                    showContact={clientAccess.canViewContactDetails}
                    canDelete={canDeleteClients}
                  />
                ))}
              </ul>
            )}

            {showAzStrip ? <AzStrip letters={lettersInResults} /> : null}
          </div>
        </ClientSelectionProvider>
      )}

      <PaginationBar
        page={listPage.page}
        pageCount={listPage.pageCount}
        total={listPage.total}
        pageSize={LIST_PAGE_SIZE}
        makeHref={(nextPage) => buildPageHref(filterValues, nextPage)}
      />
    </div>
  );
}

/**
 * The href builders (C-16 Phase C Step 8). Every one of them rebuilds the
 * query string from `filterValues`, which carries no `page` — so clearing a
 * chip, switching sort, toggling deleted or following a stat link always
 * returns to page 1 of the new result set. `buildPageHref` is the only one
 * that writes a page, and the two GET filter forms have no `page` field.
 * Exported for `__tests__/clients-page-param.test.tsx`, which pins that.
 */
export function buildClearLinkHref(
  values: {
    q: string;
    lifecycle: string;
    payment: string;
    location: string;
    source: string;
    sort: SortKey;
    show_deleted: string;
    all: string;
  },
  drop: keyof typeof values
): string {
  const params = new URLSearchParams();
  for (const [key, value] of Object.entries(values)) {
    if (key === drop) continue;
    if (key === "sort" && value === "name") continue;
    if (typeof value === "string" && value.length > 0) params.set(key, value);
  }
  const qs = params.toString();
  return qs ? `/admin/clients?${qs}` : "/admin/clients";
}

export function buildSortHref(
  values: {
    q: string;
    lifecycle: string;
    payment: string;
    location: string;
    source: string;
    show_deleted: string;
    all: string;
  },
  next: SortKey
): string {
  const params = new URLSearchParams();
  for (const [key, value] of Object.entries(values)) {
    if (typeof value === "string" && value.length > 0) params.set(key, value);
  }
  if (next !== "name") params.set("sort", next);
  const qs = params.toString();
  return qs ? `/admin/clients?${qs}` : "/admin/clients";
}

export function buildFilterHref(
  values: {
    q: string;
    lifecycle: string;
    payment: string;
    location: string;
    source: string;
    sort: SortKey;
    show_deleted: string;
    all: string;
  },
  key: "lifecycle",
  value: string
): string {
  const params = new URLSearchParams();
  for (const [k, v] of Object.entries(values)) {
    if (k === key) continue;
    if (k === "sort" && v === "name") continue;
    if (typeof v === "string" && v.length > 0) params.set(k, v);
  }
  if (value) params.set(key, value);
  const qs = params.toString();
  return qs ? `/admin/clients?${qs}` : "/admin/clients";
}

export function buildPageHref(
  values: {
    q: string;
    lifecycle: string;
    payment: string;
    location: string;
    source: string;
    sort: SortKey;
    show_deleted: string;
    all: string;
  },
  next: number
): string {
  const params = new URLSearchParams();
  for (const [k, v] of Object.entries(values)) {
    if (k === "sort" && v === "name") continue;
    if (typeof v === "string" && v.length > 0) params.set(k, v);
  }
  if (next > 1) params.set("page", String(next));
  const qs = params.toString();
  return qs ? `/admin/clients?${qs}` : "/admin/clients";
}

export function buildShowDeletedHref(
  values: {
    q: string;
    lifecycle: string;
    payment: string;
    location: string;
    source: string;
    sort: SortKey;
    show_deleted: string;
    all: string;
  },
  next: boolean
): string {
  const params = new URLSearchParams();
  for (const [key, value] of Object.entries(values)) {
    if (key === "show_deleted") continue;
    if (key === "sort" && value === "name") continue;
    if (typeof value === "string" && value.length > 0) params.set(key, value);
  }
  if (next) params.set("show_deleted", "1");
  const qs = params.toString();
  return qs ? `/admin/clients?${qs}` : "/admin/clients";
}

/**
 * C-16 closeout — the candidate ceiling's toggle, same shape as
 * `buildShowDeletedHref`. `all` is dropped from the rebuild and re-set from
 * `next`, so the "read more"/"back to the first N" pair always differ from the
 * URL currently open (the state resolver guarantees only one of them renders).
 * Carries no `page`: raising or lowering the ceiling re-sorts and re-slices the
 * whole selection, so the page number in hand no longer means anything.
 */
export function buildViewAllHref(
  values: {
    q: string;
    lifecycle: string;
    payment: string;
    location: string;
    source: string;
    sort: SortKey;
    show_deleted: string;
    all: string;
  },
  next: boolean
): string {
  const params = new URLSearchParams();
  for (const [key, value] of Object.entries(values)) {
    if (key === "all") continue;
    if (key === "sort" && value === "name") continue;
    if (typeof value === "string" && value.length > 0) params.set(key, value);
  }
  if (next) params.set("all", "1");
  const qs = params.toString();
  return qs ? `/admin/clients?${qs}` : "/admin/clients";
}

function formatPaymentLabel(value: string): string {
  if (value === "in_good_standing") return "In good standing";
  if (value === "outstanding") return "Has outstanding";
  return value;
}

function formatSourceLabel(value: string): string {
  const map: Record<string, string> = {
    website: "Website",
    phone: "Phone",
    whatsapp: "WhatsApp",
    instagram: "Instagram",
    referral: "Referral",
    manual: "Manual",
    other: "Other",
  };
  return map[value] ?? value;
}

function Dot() {
  return (
    <span aria-hidden="true" className="text-[var(--admin-text-muted)]/50">
      ·
    </span>
  );
}

function StatLink({
  label,
  href,
  active,
}: {
  label: string;
  href: string;
  active: boolean;
}) {
  return (
    <Link
      href={href}
      className={`rounded-[var(--admin-radius-control)] px-1.5 py-0.5 outline-none transition-colors focus-visible:ring-2 focus-visible:ring-[var(--admin-focus)]/55 ${
        active
          ? "bg-[var(--admin-selected-sky)] font-semibold text-[var(--admin-heading)]"
          : "hover:text-[var(--admin-body)] hover:underline underline-offset-4"
      }`}
    >
      {label}
    </Link>
  );
}

function SortLink({
  label,
  href,
  active,
  srHint,
}: {
  label: string;
  href: string;
  active: boolean;
  srHint: string;
}) {
  return (
    <Link
      href={href}
      aria-pressed={active}
      role="button"
      className={`inline-flex h-8 items-center rounded-[var(--admin-radius-control)] px-3 text-xs font-semibold outline-none transition-colors focus-visible:ring-2 focus-visible:ring-[var(--admin-focus)]/55 ${
        active
          ? "bg-[var(--admin-panel)] text-[var(--admin-heading)] shadow-[0_1px_0_oklch(89%_0.014_78)]"
          : "text-[var(--admin-text-muted)] hover:bg-[var(--admin-panel)]/60 hover:text-[var(--admin-body)]"
      }`}
    >
      {label}
      <span className="sr-only">. {srHint}.</span>
    </Link>
  );
}

function FilterField({
  label,
  htmlFor,
  children,
}: {
  label: string;
  htmlFor: string;
  children: React.ReactNode;
}) {
  return (
    <div className="grid gap-1.5">
      <label
        htmlFor={htmlFor}
        className="text-sm font-medium text-[var(--admin-heading)]"
      >
        {label}
      </label>
      {children}
    </div>
  );
}

function FilterSelect({
  id,
  name,
  defaultValue,
  children,
}: {
  id: string;
  name: string;
  defaultValue: string;
  children: React.ReactNode;
}) {
  return (
    <select
      id={id}
      name={name}
      defaultValue={defaultValue}
      className="h-10 w-full rounded-[var(--admin-radius-control)] border border-[var(--admin-border-form)] bg-[var(--admin-surface-input)] px-3 text-sm text-[var(--admin-body)] outline-none transition-colors focus-visible:border-[var(--admin-focus)] focus-visible:ring-2 focus-visible:ring-[var(--admin-focus)]/30"
    >
      {children}
    </select>
  );
}

function FilterFields({
  q,
  lifecycle,
  payment,
  location,
  source,
  idSuffix,
}: {
  q: string;
  lifecycle: string;
  payment: string;
  location: string;
  source: string;
  idSuffix: string;
}) {
  return (
    <>
      <FilterField label="Search" htmlFor={`clients-q-${idSuffix}`}>
        <input
          id={`clients-q-${idSuffix}`}
          name="q"
          type="search"
          defaultValue={q}
          placeholder="Search by name, email, or phone"
          autoComplete="off"
          className="h-10 w-full rounded-[var(--admin-radius-control)] border border-[var(--admin-border-form)] bg-[var(--admin-surface-input)] px-3 text-sm text-[var(--admin-body)] outline-none transition-colors placeholder:text-[var(--admin-text-muted)] focus-visible:border-[var(--admin-focus)] focus-visible:ring-2 focus-visible:ring-[var(--admin-focus)]/30"
        />
      </FilterField>
      <FilterField label="Lifecycle" htmlFor={`clients-lifecycle-${idSuffix}`}>
        <FilterSelect id={`clients-lifecycle-${idSuffix}`} name="lifecycle" defaultValue={lifecycle}>
          <option value="">Any lifecycle</option>
          <option value="new">New</option>
          <option value="returning">Returning</option>
          <option value="at_risk">At-risk</option>
          <option value="lapsed">Lapsed</option>
        </FilterSelect>
      </FilterField>
      <FilterField label="Payment" htmlFor={`clients-payment-${idSuffix}`}>
        <FilterSelect id={`clients-payment-${idSuffix}`} name="payment" defaultValue={payment}>
          <option value="">Any payment</option>
          <option value="in_good_standing">In good standing</option>
          <option value="outstanding">Has outstanding</option>
        </FilterSelect>
      </FilterField>
      <FilterField label="Location" htmlFor={`location-${idSuffix}`}>
        <input
          id={`location-${idSuffix}`}
          name="location"
          type="text"
          defaultValue={location}
          placeholder="City or area"
          autoComplete="off"
          className="h-10 w-full rounded-[var(--admin-radius-control)] border border-[var(--admin-border-form)] bg-[var(--admin-surface-input)] px-3 text-sm text-[var(--admin-body)] outline-none transition-colors placeholder:text-[var(--admin-text-muted)] focus-visible:border-[var(--admin-focus)] focus-visible:ring-2 focus-visible:ring-[var(--admin-focus)]/30"
        />
      </FilterField>
      <FilterField label="Source" htmlFor={`clients-source-${idSuffix}`}>
        <FilterSelect id={`clients-source-${idSuffix}`} name="source" defaultValue={source}>
          <option value="">Any source</option>
          <option value="website">Website</option>
          <option value="phone">Phone</option>
          <option value="whatsapp">WhatsApp</option>
          <option value="instagram">Instagram</option>
          <option value="referral">Referral</option>
          <option value="manual">Manual</option>
          <option value="other">Other</option>
        </FilterSelect>
      </FilterField>
    </>
  );
}

function ClientRow({
  row,
  showContact,
  canDelete,
}: {
  row: {
    client: ClientRecord;
    bookings: ClientBookingRecord[];
    lifecycle: LifecycleKey;
    lastCompleted: ClientBookingRecord | null;
    nextUpcoming: ClientBookingRecord | null;
    completedCount: number;
    upcomingCount: number;
  };
  showContact: boolean;
  canDelete: boolean;
}) {
  const { client, lifecycle, lastCompleted, nextUpcoming, completedCount, upcomingCount } = row;
  const hue = deterministicHue(client.id);
  const tone = LIFECYCLE_TONE[lifecycle];
  const lifecycleLabel = LIFECYCLE_LABEL[lifecycle];
  const initials = getInitials(client.full_name);
  const isLapsed = lifecycle === "lapsed";
  const isDeleted = Boolean(client.deleted_at);

  // D4 lapsed clients render at reduced saturation; a soft-deleted row is
  // dimmer still and struck through (brief §5.3).
  const rowOpacity = isDeleted ? "opacity-60" : isLapsed ? "opacity-75" : "";

  // Primary timeline line — prefers last visit (completed), falls back to next upcoming.
  let timelineLabel: string;
  let timelinePrefix: string;
  if (lastCompleted) {
    timelinePrefix = "Last visit";
    timelineLabel = formatDate(lastCompleted.booking_date);
  } else if (nextUpcoming) {
    timelinePrefix = "Next visit";
    timelineLabel = formatDate(nextUpcoming.booking_date);
  } else {
    timelinePrefix = "";
    timelineLabel = "No visits yet";
  }

  // Secondary count line — completed total, plus upcoming chip if relevant.
  const countLabel =
    completedCount === 0
      ? upcomingCount > 0
        ? `${upcomingCount} upcoming`
        : "No visits yet"
      : `${completedCount} visit${completedCount === 1 ? "" : "s"}${
          upcomingCount > 0 ? ` · ${upcomingCount} upcoming` : ""
        }`;

  // C6 popover summary — split into last visit + next booking when both exist
  const lastBookingSummary: LastBookingSummary = {
    lastVisit: lastCompleted
      ? {
          serviceLabel: lastCompleted.booking_items?.[0]?.service_name_snapshot ?? null,
          bookingDate: formatDate(lastCompleted.booking_date),
          paidLabel: `${formatMoney(lastCompleted.amount_paid ?? 0)} paid`,
        }
      : null,
    nextBooking: nextUpcoming
      ? {
          serviceLabel: nextUpcoming.booking_items?.[0]?.service_name_snapshot ?? null,
          bookingDate: formatDate(nextUpcoming.booking_date),
          timeLabel: nextUpcoming.start_time ? nextUpcoming.start_time.slice(0, 5) : null,
        }
      : null,
  };

  return (
    <li
      className={`group relative flex min-h-[56px] items-center gap-3 rounded-[var(--admin-radius-control)] border-b border-b-transparent px-3 py-2 transition-colors duration-150 ease-out hover:bg-[var(--admin-hover-mist)] hover:border-b-[oklch(60% 0.08 247)] focus-within:bg-[var(--admin-hover-mist)] md:gap-4 md:px-4 ${rowOpacity}`}
    >
      {isDeleted ? null : (
        <ClientSelectCheckbox clientId={client.id} clientName={client.full_name} />
      )}
      <span
        aria-hidden="true"
        className="inline-flex size-8 shrink-0 items-center justify-center rounded-full text-[0.75rem] font-semibold text-[var(--admin-heading)] ring-1 ring-transparent transition-shadow duration-200 ease-out group-hover:ring-[var(--admin-primary)]/30"
        style={{ backgroundColor: `oklch(82% 0.05 ${hue})` }}
      >
        {initials}
      </span>
      <div className="min-w-0 flex-1 max-w-[18rem] md:max-w-[22rem]">
        {isDeleted ? (
          // The detail route 404s on a soft-deleted client, so the row title —
          // whose ::after overlay makes the whole row clickable — is plain text
          // here instead of a dead link. Audit history stays available from the
          // row menu (brief §5.3).
          <p className="block truncate text-sm font-semibold text-[var(--admin-heading)] line-through">
            {client.full_name}
            <span className="sr-only"> (deleted)</span>
          </p>
        ) : (
          <Link
            href={`/admin/clients/${client.id}`}
            className="relative block truncate text-sm font-semibold text-[var(--admin-heading)] outline-none after:absolute after:inset-0 after:rounded-[var(--admin-radius-control)] after:content-[''] focus-visible:after:ring-2 focus-visible:after:ring-[var(--admin-focus)]/55"
          >
            {client.full_name}
          </Link>
        )}
        {showContact && client.phone ? (
          <p className="truncate text-xs text-[var(--admin-text-muted)]">
            {client.phone}
          </p>
        ) : showContact && client.email ? (
          <p className="truncate text-xs text-[var(--admin-text-muted)]">
            {client.email}
          </p>
        ) : null}
      </div>
      <div className="hidden flex-1 flex-col items-end gap-0.5 md:flex">
        <p className="font-mono text-xs text-[var(--admin-text-muted)]">
          {timelinePrefix ? (
            <>
              <span className="text-[var(--admin-text-muted)]/80">{timelinePrefix} </span>
              <span className="font-semibold text-[var(--admin-body)]">{timelineLabel}</span>
            </>
          ) : (
            timelineLabel
          )}
        </p>
        <p className="text-xs text-[var(--admin-text-muted)]">{countLabel}</p>
      </div>
      <span title={LIFECYCLE_TITLE[lifecycle]} className="relative z-10">
        <AdminStatusBadge value={lifecycleLabel} tone={tone} compact />
      </span>
      {isDeleted ? null : (
        <Link
          href={`/admin/bookings/new?clientId=${client.id}`}
          aria-label={`New booking for ${client.full_name}`}
          className="relative z-10 hidden h-9 items-center gap-1.5 rounded-[var(--admin-radius-control)] px-2.5 text-xs font-semibold text-[var(--admin-body)] outline-none transition-colors hover:bg-[var(--admin-selected-sky)] focus-visible:ring-2 focus-visible:ring-[var(--admin-focus)]/55 md:inline-flex"
        >
          <Plus className="size-4" aria-hidden="true" />
          New booking
        </Link>
      )}
      <ClientRowMenu
        clientId={client.id}
        clientName={client.full_name}
        lastBooking={lastBookingSummary}
        canDelete={canDelete && !isDeleted}
        deleted={isDeleted}
      />
    </li>
  );
}

function AzStrip({ letters }: { letters: Set<string> }) {
  const alphabet = "ABCDEFGHIJKLMNOPQRSTUVWXYZ".split("");
  return (
    <nav
      aria-label="Jump to letter"
      className="absolute right-0 top-0 hidden h-full flex-col items-center justify-start gap-0.5 pt-1 lg:flex"
    >
      {alphabet.map((letter) => {
        const enabled = letters.has(letter);
        return enabled ? (
          <a
            key={letter}
            href={`#section-${letter}`}
            title={`Jump to ${letter}`}
            className="flex size-5 items-center justify-center rounded-full text-[0.6875rem] font-semibold text-[var(--admin-text-muted)] outline-none transition-colors hover:bg-[var(--admin-selected-sky)] hover:text-[var(--admin-heading)] focus-visible:ring-2 focus-visible:ring-[var(--admin-focus)]/55"
          >
            {letter}
          </a>
        ) : (
          <span
            key={letter}
            aria-hidden="true"
            className="flex size-5 items-center justify-center text-[0.6875rem] font-medium text-[var(--admin-text-muted)]/40"
          >
            {letter}
          </span>
        );
      })}
    </nav>
  );
}
