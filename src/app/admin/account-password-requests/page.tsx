import type { Metadata } from "next";
import { Suspense } from "react";
import Link from "next/link";
import { redirect } from "next/navigation";
import { CheckCheck, Inbox } from "lucide-react";
import { createSupabaseServerClient } from "@/lib/supabase/server";
import { getStaffProfile, PERMISSIONS } from "@/lib/auth/rbac";
import {
  AdminAccessDenied,
  AdminPageHeader,
  AdminPanel,
  AdminSkeleton,
} from "../components/admin-ui";
import { EmptyState } from "../components/EmptyState";
import { RequestRow } from "./RequestRow";
import {
  countPasswordResetRequests,
  getPasswordResetRequests,
  PASSWORD_REQUESTS_LIMIT,
  type PasswordResetRequest,
} from "./password-requests-data";

export const metadata: Metadata = {
  title: "Password-reset requests · Rahma",
};

// Re-exported so `RequestRow.tsx`'s `import type { PasswordResetRequest }
// from "./page"` keeps resolving — the type now lives in
// password-requests-data.ts (C-16 Phase D Step 12), page.tsx just re-exports it.
export type { PasswordResetRequest };

type StatusKey = "pending" | "approved" | "rejected" | "expired" | "all";

const STATUS_TABS: Array<{ key: StatusKey; label: string }> = [
  { key: "pending", label: "Pending" },
  { key: "approved", label: "Approved" },
  { key: "rejected", label: "Rejected" },
  { key: "expired", label: "Expired" },
  { key: "all", label: "All" },
];

function isStatusKey(v: string | undefined): v is StatusKey {
  return v === "pending" || v === "approved" || v === "rejected" || v === "expired" || v === "all";
}

function filterByStatus(rows: PasswordResetRequest[], status: StatusKey): PasswordResetRequest[] {
  if (status === "all") return [...rows].sort((a, b) => b.created_at.localeCompare(a.created_at));
  if (status === "pending") {
    return rows
      .filter((r) => r.status === "pending")
      .sort((a, b) => a.expires_at.localeCompare(b.expires_at));
  }
  if (status === "approved" || status === "rejected") {
    return rows
      .filter((r) => r.status === status)
      .sort((a, b) => (b.reviewed_at ?? "").localeCompare(a.reviewed_at ?? ""));
  }
  return rows
    .filter((r) => r.status === "expired")
    .sort((a, b) => b.created_at.localeCompare(a.created_at));
}

function emptyStateCopy(status: StatusKey) {
  switch (status) {
    case "pending":
      return {
        icon: CheckCheck,
        title: "All caught up",
        message: "No password-reset requests are waiting for review.",
        action: undefined,
      };
    case "approved":
      return {
        icon: Inbox,
        title: "No approved requests yet",
        message: "Once you approve a request, it'll appear here.",
        action: { label: "Show pending", href: "/admin/account-password-requests?status=pending" },
      };
    case "rejected":
      return {
        icon: Inbox,
        title: "No rejections",
        message: "Once you reject a request, it'll appear here.",
        action: { label: "Show pending", href: "/admin/account-password-requests?status=pending" },
      };
    case "expired":
      return {
        icon: Inbox,
        title: "No expired requests",
        message: "Requests left unreviewed past their deadline appear here.",
        action: { label: "Show pending", href: "/admin/account-password-requests?status=pending" },
      };
    case "all":
    default:
      return {
        icon: Inbox,
        title: "No requests yet",
        message: "Password-reset requests appear here as staff submit them.",
        action: undefined,
      };
  }
}

interface PageProps {
  searchParams: Promise<{ status?: string; all?: string }>;
}

export default async function AccountPasswordRequestsPage({ searchParams }: PageProps) {
  const supabase = await createSupabaseServerClient();
  const profile = await getStaffProfile(supabase);
  if (!profile || !profile.active) redirect("/admin/login");

  const hasReviewAccess = profile.permissions.has(
    PERMISSIONS.MANAGE_ACCOUNT_PASSWORD_REQUESTS
  );

  if (!hasReviewAccess) {
    return (
      <AdminAccessDenied
        title="You don't have access to this section"
        message="Password-reset reviews are restricted to the practice owner and admin. Contact one of them if you think this is a mistake."
      />
    );
  }

  const params = await searchParams;
  const rawStatus = params.status;
  const status: StatusKey = isStatusKey(rawStatus) ? rawStatus : "pending";
  // C-16 Phase D Step 12 — cap+view-all toggle. `?all=1` raises the fetch
  // from PASSWORD_REQUESTS_LIMIT to PASSWORD_REQUESTS_VIEW_ALL_CAP.
  const viewAll = params.all === "1";

  const rows = await getPasswordResetRequests({ viewAll });
  // Real head-counts (C-16 Step 12), not derived from the possibly-capped
  // `rows` fetch above: `totalCount` is the true table size (used below to
  // tell whether the cap is hiding anything), and `pendingCount` — the tab
  // badge staff actually act on — is exact regardless of the cap (though in
  // practice "pending" never approaches the cap: a request expires 24h after
  // creation, so it's always inside the most-recent window anyway).
  const totalCount = await countPasswordResetRequests();
  const pendingCount = await countPasswordResetRequests("pending");
  const hasHiddenRequests = totalCount > rows.length;

  const canOpenAudit = profile.permissions.has(PERMISSIONS.MANAGE_AUDIT_LOGS);
  const reviewerName = profile.name ?? "you";

  // Preserve the active tab across the view-all toggle.
  const tabQueryParam = status === "pending" ? null : `status=${status}`;
  const viewAllHref = `/admin/account-password-requests?${[tabQueryParam, "all=1"].filter(Boolean).join("&")}`;
  const recentHref = tabQueryParam
    ? `/admin/account-password-requests?${tabQueryParam}`
    : "/admin/account-password-requests";

  return (
    <div className="mx-auto w-full max-w-[68rem] space-y-5 sm:space-y-6">
      <AdminPageHeader
        title="Password-reset requests"
        description="Approve or reject staff requests to reset their password. Approval sends a one-time link to the requester's email."
      />

      {hasHiddenRequests ? (
        <p className="rounded-[var(--admin-radius-card)] border border-[var(--admin-border)] bg-[var(--admin-panel-muted)] px-3 py-2 text-xs text-[var(--admin-text-muted)]">
          Showing the {PASSWORD_REQUESTS_LIMIT} most recent requests of {totalCount} total. Older
          requests won&apos;t appear in any tab until you{" "}
          <Link
            href={viewAllHref}
            className="font-semibold text-[var(--admin-primary)] underline-offset-4 outline-none hover:underline focus-visible:ring-2 focus-visible:ring-[var(--admin-focus)]/55"
          >
            view all {totalCount}
          </Link>
          .
        </p>
      ) : viewAll && totalCount > PASSWORD_REQUESTS_LIMIT ? (
        <p className="rounded-[var(--admin-radius-card)] border border-[var(--admin-border)] bg-[var(--admin-panel-muted)] px-3 py-2 text-xs text-[var(--admin-text-muted)]">
          Showing all {totalCount} requests.{" "}
          <Link
            href={recentHref}
            className="font-semibold text-[var(--admin-primary)] underline-offset-4 outline-none hover:underline focus-visible:ring-2 focus-visible:ring-[var(--admin-focus)]/55"
          >
            Show recent {PASSWORD_REQUESTS_LIMIT} only
          </Link>
        </p>
      ) : null}

      <nav aria-label="Filter by request status">
        <ul className="-mx-1 flex list-none flex-nowrap items-center gap-0.5 overflow-x-auto px-1 pb-1 sm:gap-1 sm:flex-wrap sm:overflow-visible">
          {STATUS_TABS.map((tab) => {
            const isActive = tab.key === status;
            const tabLabel =
              tab.key === "pending" && pendingCount > 0
                ? `Pending (${pendingCount})`
                : tab.label;
            const href =
              tab.key === "pending"
                ? "/admin/account-password-requests"
                : `/admin/account-password-requests?status=${tab.key}`;
            return (
              <li key={tab.key}>
                <Link
                  href={href}
                  aria-current={isActive ? "page" : undefined}
                  className={
                    isActive
                      ? "inline-flex min-h-10 items-center whitespace-nowrap rounded-full bg-[var(--admin-primary)] px-2.5 text-xs font-semibold text-[var(--admin-on-primary)] outline-none transition-colors hover:bg-[var(--admin-primary-hover)] focus-visible:ring-[3px] focus-visible:ring-[var(--admin-focus)] focus-visible:ring-offset-2 focus-visible:ring-offset-[var(--admin-canvas)] sm:px-4 sm:text-sm"
                      : "inline-flex min-h-10 items-center whitespace-nowrap rounded-full border border-transparent px-2.5 text-xs font-medium text-[var(--admin-body)] outline-none transition-colors hover:border-[var(--admin-border)] hover:bg-[var(--admin-hover-mist)] focus-visible:ring-[3px] focus-visible:ring-[var(--admin-focus)] focus-visible:ring-offset-2 focus-visible:ring-offset-[var(--admin-canvas)] sm:px-4 sm:text-sm"
                  }
                >
                  {tabLabel}
                </Link>
              </li>
            );
          })}
        </ul>
      </nav>

      <Suspense
        key={status}
        fallback={<RequestListSkeleton status={status} />}
      >
        <RequestListAsync
          status={status}
          rows={rows}
          reviewerName={reviewerName}
          canOpenAudit={canOpenAudit}
        />
      </Suspense>
    </div>
  );
}

async function RequestListAsync({
  status,
  rows,
  reviewerName,
  canOpenAudit,
}: {
  status: StatusKey;
  rows: PasswordResetRequest[];
  reviewerName: string;
  canOpenAudit: boolean;
}) {
  const visibleRows = filterByStatus(rows, status);
  const resultCountCopy =
    status === "all"
      ? `Showing ${visibleRows.length} ${visibleRows.length === 1 ? "request" : "requests"} across all statuses.`
      : `Showing ${visibleRows.length} ${status} ${visibleRows.length === 1 ? "request" : "requests"}.`;

  return (
    <>
      <p className="text-xs font-medium text-[var(--admin-text-muted)]">{resultCountCopy}</p>

      {visibleRows.length === 0 ? (
        <AdminPanel>
          <EmptyState {...emptyStateCopy(status)} />
        </AdminPanel>
      ) : (
        <ul
          className="flex list-none flex-col gap-3 sm:gap-4"
          aria-label={`${status} password-reset requests`}
        >
          {visibleRows.map((row) => (
            <li key={row.id}>
              <RequestRow
                row={row}
                currentReviewerName={reviewerName}
                canOpenAudit={canOpenAudit}
                currentTabStatus={status}
              />
            </li>
          ))}
        </ul>
      )}
    </>
  );
}

function RequestListSkeleton({ status }: { status: StatusKey }) {
  return (
    <div
      aria-busy="true"
      aria-live="polite"
      aria-label={`Loading ${status} requests`}
      className="flex flex-col gap-3 sm:gap-4"
    >
      <AdminSkeleton className="h-4 w-48" />
      {[0, 1, 2].map((i) => (
        <AdminPanel key={i} className="!p-0">
          <div className="flex flex-col gap-3 p-4 sm:p-5">
            <div className="flex items-center gap-3">
              <AdminSkeleton className="size-9 rounded-full" />
              <AdminSkeleton className="h-5 flex-1 max-w-[24rem]" />
            </div>
            <AdminSkeleton className="h-4 w-3/5" />
            <AdminSkeleton className="h-9 w-40 self-end" />
          </div>
        </AdminPanel>
      ))}
    </div>
  );
}
