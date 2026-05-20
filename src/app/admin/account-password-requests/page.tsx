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

export const metadata: Metadata = {
  title: "Password-reset requests · Rahma",
};

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

export interface PasswordResetRequest {
  id: string;
  email: string;
  status: "pending" | "approved" | "rejected" | "expired";
  created_at: string;
  expires_at: string;
  reviewed_at: string | null;
  reviewed_by_name: string | null;
  reviewer_note: string | null;
}

// data-redesign-backend="FAKE" — seed rows used while BUILD-approve-reject-password-reset.md
// and BUILD-rbac-permission-account-password-requests.md are still [ ]. The
// schema mirrors the existing `account_password_requests` production table;
// once the backend BUILD plans land, the real query below replaces this seed.
function getFakeSeedRows(): PasswordResetRequest[] {
  const now = Date.now();
  const minutes = 60 * 1000;
  const hours = 60 * minutes;
  const days = 24 * hours;
  return [
    {
      id: "fake-pending-001",
      email: "amina.osman@rahmatherapy.example.test",
      status: "pending",
      created_at: new Date(now - 2 * hours).toISOString(),
      expires_at: new Date(now + 22 * hours).toISOString(),
      reviewed_at: null,
      reviewed_by_name: null,
      reviewer_note: null,
    },
    {
      id: "fake-pending-002",
      email: "yusuf.ahmed@rahmatherapy.example.test",
      status: "pending",
      created_at: new Date(now - 9 * hours).toISOString(),
      expires_at: new Date(now + 15 * hours).toISOString(),
      reviewed_at: null,
      reviewed_by_name: null,
      reviewer_note: null,
    },
    {
      id: "fake-pending-003",
      email: "leila.hassan@rahmatherapy.example.test",
      status: "pending",
      created_at: new Date(now - 23 * hours).toISOString(),
      expires_at: new Date(now + 40 * minutes).toISOString(),
      reviewed_at: null,
      reviewed_by_name: null,
      reviewer_note: null,
    },
    {
      id: "fake-approved-001",
      email: "ibrahim.salah@rahmatherapy.example.test",
      status: "approved",
      created_at: new Date(now - 2 * days).toISOString(),
      expires_at: new Date(now - 1 * days).toISOString(),
      reviewed_at: new Date(now - 1.5 * days).toISOString(),
      reviewed_by_name: "Fatimah",
      reviewer_note: null,
    },
    {
      id: "fake-rejected-001",
      email: "former.therapist@rahmatherapy.example.test",
      status: "rejected",
      created_at: new Date(now - 5 * days).toISOString(),
      expires_at: new Date(now - 4 * days).toISOString(),
      reviewed_at: new Date(now - 4.5 * days).toISOString(),
      reviewed_by_name: "Fatimah",
      reviewer_note:
        "This account belongs to a staff member whose contract ended on 2026-04-30. If you still need to access something Rahma-related, get in touch with the practice owner directly.",
    },
    {
      id: "fake-expired-001",
      email: "unknown.requester@rahmatherapy.example.test",
      status: "expired",
      created_at: new Date(now - 7 * days).toISOString(),
      expires_at: new Date(now - 6 * days).toISOString(),
      reviewed_at: null,
      reviewed_by_name: null,
      reviewer_note: null,
    },
  ];
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
  searchParams: Promise<{ status?: string }>;
}

export default async function AccountPasswordRequestsPage({ searchParams }: PageProps) {
  const supabase = await createSupabaseServerClient();
  const profile = await getStaffProfile(supabase);
  if (!profile || !profile.active) redirect("/admin/login");

  // data-redesign-backend="FAKE" — the canonical gate is MANAGE_ACCOUNT_PASSWORD_REQUESTS,
  // but BUILD-rbac-permission-account-password-requests.md hasn't seeded that permission
  // onto Owner / Admin role templates yet. Until that plan lands we bridge via
  // MANAGE_AUDIT_LOGS (Owner-only) so the page is reachable for the Owner test account.
  // When the BUILD plan lands, delete the OR branch so only the canonical permission gates.
  const hasReviewAccess =
    profile.permissions.has(PERMISSIONS.MANAGE_ACCOUNT_PASSWORD_REQUESTS) ||
    profile.permissions.has(PERMISSIONS.MANAGE_AUDIT_LOGS);

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

  const seed = getFakeSeedRows();
  const pendingCount = seed.filter((r) => r.status === "pending").length;

  const canOpenAudit = profile.permissions.has(PERMISSIONS.MANAGE_AUDIT_LOGS);
  const reviewerName = profile.name ?? "you";

  return (
    <div
      className="mx-auto w-full max-w-[68rem] space-y-5 sm:space-y-6"
      data-redesign-backend="FAKE"
      data-redesign-fake-source="account-password-requests page seed data — blocks on BUILD-approve-reject-password-reset.md + BUILD-rbac-permission-account-password-requests.md + BUILD-password-reset-email-templates.md"
    >
      <AdminPageHeader
        title="Password-reset requests"
        description="Approve or reject staff requests to reset their password. Approval sends a one-time link to the requester's email."
      />

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
          seed={seed}
          reviewerName={reviewerName}
          canOpenAudit={canOpenAudit}
        />
      </Suspense>

      {/* data-redesign-backend="FAKE" — compact dev-mode chip; functional surfaces carry the
          marker independently (RequestRow ApproveModal RejectModal). The chip is purposely
          quiet: it ships out cleanly when the three BUILD plans land. */}
      <FakeBackendChip />
    </div>
  );
}

async function RequestListAsync({
  status,
  seed,
  reviewerName,
  canOpenAudit,
}: {
  status: StatusKey;
  seed: PasswordResetRequest[];
  reviewerName: string;
  canOpenAudit: boolean;
}) {
  const visibleRows = filterByStatus(seed, status);
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

function FakeBackendChip() {
  return (
    <p
      data-redesign-backend="FAKE"
      className="inline-flex max-w-full items-center gap-1.5 self-start rounded-full border border-dashed border-[var(--admin-border)] bg-[var(--admin-panel-muted)] px-3 py-1 text-[0.7rem] font-medium text-[var(--admin-text-muted)]"
      title="Backend in progress. Approve and reject confirm visually but do not yet send email or update the database. Real wiring lands with BUILD-rbac-permission-account-password-requests.md, BUILD-password-reset-email-templates.md, and BUILD-approve-reject-password-reset.md."
    >
      <span
        aria-hidden="true"
        className="inline-block size-1.5 rounded-full bg-[oklch(69%_0.142_72)]"
      />
      Dev mode · approve and reject are visual only
    </p>
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
