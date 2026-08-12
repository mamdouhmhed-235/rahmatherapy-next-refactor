import type { Metadata } from "next";
import { createElement } from "react";
import Link from "next/link";
import { redirect } from "next/navigation";
import {
  CalendarClock,
  ChevronRight,
  Inbox,
  MailCheck,
  MailWarning,
  Star,
  TriangleAlert,
} from "lucide-react";
import { createSupabaseServerClient } from "@/lib/supabase/server";
import { getBusinessDate } from "@/lib/time/london";
import {
  canManageAllBookings,
  canManageEmailTemplates,
  canResendBookingEmails,
  canViewAllBookings,
  canViewEmailLogs,
  getStaffProfile,
} from "@/lib/auth/rbac";
import {
  getEmailsPageData,
  getEmailDeliveryPage,
  getReviewRequestCandidates,
  type EmailEvent,
  type ReminderBooking,
  type ReviewRequestCandidate,
} from "./emails-data";
import { LOG_PAGE_SIZE } from "@/lib/pagination";
import { TemplateGallery, type TemplateGalleryBadge } from "./components/TemplateGallery";
import { findTemplate } from "./components/templates-data";
import { cn } from "@/lib/utils";
import {
  AdminAccessDenied,
  AdminPageHeader,
  AdminPanel,
  AdminStatusBadge,
} from "../components/admin-ui";
import { EmptyState } from "../components/EmptyState";
import { PaginationBar } from "../components/PaginationBar";
import { DeliveryFilterStrip } from "./DeliveryFilterStrip";
import { CopyEventId } from "./CopyEventId";
import { ReminderResendForm } from "./ReminderResendForm";
import { ResendButton } from "./components/ResendButton";
import { ReviewRequestButton } from "./components/ReviewRequestButton";
import {
  DELIVERY_STATUSES,
  EMAIL_EVENT_TYPES,
  FAILED_BADGE_WINDOW_HOURS,
  RECIPIENT_ROLES,
  SEARCH_MIN_CHARS,
  absoluteTimestamp,
  dayKey,
  dayLabel,
  formatReminderDateTime,
  hasAnyDeliveryFilter,
  iconForEventType,
  initialsFromName,
  labelForDeliveryStatus,
  labelForEventType,
  labelForRecipientRole,
  lastReminderLine,
  relativeTime,
  resolveRange,
  toneForDeliveryStatus,
  type DeliveryFilters,
  type DeliveryStatus,
  type EmailEventType,
  type RecipientRole,
} from "./format";

export const metadata: Metadata = {
  title: "Email · Rahma admin",
  description: "Delivery status, manual reminders, and template library.",
};

const PAGE_SIZE = 100;

type TabKey = "delivery" | "reminders" | "reviews" | "templates";

function resolveTab(
  raw: string | undefined,
  canSeeDelivery: boolean
): TabKey {
  if (raw === "delivery" && canSeeDelivery) return "delivery";
  if (raw === "reminders") return "reminders";
  if (raw === "reviews") return "reviews";
  if (raw === "templates") return "templates";
  return canSeeDelivery ? "delivery" : "reminders";
}

// EmailEvent + ReminderBooking moved to emails-data.ts with the fetch
// (C-09 Phase C Step 5); EmailEvent is re-imported above for the local helpers.

interface PageProps {
  searchParams: Promise<{
    tab?: string;
    q?: string;
    event_type?: string;
    delivery_status?: string;
    recipient_role?: string;
    range?: string;
    from?: string;
    to?: string;
    /** C-16 Phase D Step 9 — 1-based delivery-feed page, clamped server-side. */
    page?: string;
    /** C-15 Phase E, Step 18 — old in-tab editor deep link (pre-gallery
     *  TemplatesTab wrote `?tab=templates&templateId=<id>` to the URL and
     *  sessionStorage). Redirected to the editor route below rather than
     *  silently ignored, so an existing bookmark or back-button entry still
     *  lands somewhere useful. */
    templateId?: string;
  }>;
}

export default async function EmailsPage({ searchParams }: PageProps) {
  const supabase = await createSupabaseServerClient();
  const profile = await getStaffProfile(supabase);
  if (!profile || !profile.active) redirect("/admin/login");

  const canSeeDelivery = canViewEmailLogs(profile);
  const canResend = canResendBookingEmails(profile);
  if (!canSeeDelivery && !canResend) {
    return (
      <AdminAccessDenied
        title="Email access limited"
        message="You need email or booking-management access to see delivery status. Ask the practice owner."
      />
    );
  }

  const params = await searchParams;
  const activeTab = resolveTab(params.tab, canSeeDelivery);
  const allowAdminRecipient = canSeeDelivery; // brief §11: coordinator-resend-only hides Admin recipient

  // C-15 Phase E, Step 18 — old in-tab deep link redirect. Verified by grep
  // (progress file / dispatch report): no other page or component in the
  // codebase links to `?tab=templates&templateId=...` — the only source was
  // the retired TemplatesTab's own URL-mirroring effect. This still handles
  // any existing bookmark or browser-history entry by sending it straight to
  // the (already-shipped, Phase C) editor route rather than silently
  // dropping the templateId.
  if (activeTab === "templates" && params.templateId) {
    const deepLinkedTemplate = findTemplate(params.templateId);
    if (deepLinkedTemplate) {
      redirect(`/admin/emails/templates/${deepLinkedTemplate.id}`);
    }
  }

  // ── Data reads ────────────────────────────────────────────────────────────
  // 5-step filter audit (brief §2.4): (1) URL parsed below (deliveryFilters);
  // (2) passed into getEmailDeliveryPage (which threads it into both
  // getFilteredDeliveryEvents and countEmailDeliveryEvents); (3) applied server-side in
  // emails-data.ts (.eq/.gte/.lte/.or-ilike); (4) filter UI defaults from
  // these same URL-derived values (DeliveryFilterStrip's initialValues); (5)
  // empty-state copy already distinguished filtered-empty from no-data
  // (DeliveryEmpty) — now backed by a real query instead of an in-memory
  // slice over the top-100.
  const canSeeAllBookings = canViewAllBookings(profile) || canManageAllBookings(profile);

  const {
    events: allEvents,
    deliveryError,
    reminderBookings: upcomingBookings,
    templateOverrideSummaries,
    templateStaff,
  } = await getEmailsPageData({
    canSeeDelivery,
    canResend,
    canSeeAllBookings,
    staffId: profile.id,
    businessDate: getBusinessDate(),
    includeTemplates: activeTab === "templates",
    limit: PAGE_SIZE,
  });

  // Item 1 Batch B. Its own cached fetcher rather than a field on
  // getEmailsPageData: a separate cache key cannot be served a stale entry
  // shaped without this list. Self-gates on canResend, so it is safe to call
  // unconditionally — and it is called unconditionally so the tab's badge is
  // accurate from any tab, exactly as the reminders badge is.
  const reviewCandidates: ReviewRequestCandidate[] =
    await getReviewRequestCandidates({
      canResend,
      canSeeAllBookings,
      staffId: profile.id,
    });

  // Map rebuilt on THIS side of the cache boundary — emails-data.ts returns a
  // plain array because a Map would come back as {} (SHARED-NOTES §15).
  const templateStaffNameById = new Map<string, string>(
    templateStaff.map((row) => [row.id, row.name])
  );
  const templateBadges: Record<string, TemplateGalleryBadge> = {};
  for (const [templateId, summary] of Object.entries(templateOverrideSummaries)) {
    templateBadges[templateId] = {
      updatedAt: summary.updatedAt,
      updatedByName: summary.updatedBy
        ? templateStaffNameById.get(summary.updatedBy) ?? "Unknown staff"
        : "Unknown staff",
    };
  }

  // Build map: booking_id → most-recent reminder event (only successful sends).
  const lastReminderByBooking = new Map<string, string>();
  for (const event of allEvents) {
    if (
      event.event_type === "booking_reminder" &&
      event.booking_id &&
      (event.delivery_status === "accepted" ||
        event.delivery_status === "delivered" ||
        event.delivery_status === "opened" ||
        event.delivery_status === "clicked")
    ) {
      if (!lastReminderByBooking.has(event.booking_id)) {
        lastReminderByBooking.set(event.booking_id, event.created_at);
      }
    }
  }

  // ── Delivery filters ──────────────────────────────────────────────────────
  const q = (params.q ?? "").trim();
  const searchActive = q.length >= SEARCH_MIN_CHARS;
  const deliveryFilters: DeliveryFilters = {
    q: searchActive ? q : "",
    event_type: isEventType(params.event_type) ? params.event_type : "",
    delivery_status: isDeliveryStatus(params.delivery_status) ? params.delivery_status : "",
    recipient_role:
      isRecipientRole(params.recipient_role) &&
      (params.recipient_role !== "admin" || allowAdminRecipient)
        ? params.recipient_role
        : "",
    range: resolveRange(params.range),
    from: params.from ?? "",
    to: params.to ?? "",
  };
  const initialFilters: DeliveryFilters = {
    ...deliveryFilters,
    q: q, // pass the raw value through to the client so it can render the too-short hint
  };

  // Server-side delivery query (C-09 Phase D Step 11 / C-16 Phase D Step 9) —
  // a second, focused fetcher (see emails-data.ts's FILTERS/PAGER notes)
  // rather than an in-memory slice over the top-100 `allEvents` read above.
  // `getEmailDeliveryPage` resolves the count and the rows from the SAME
  // `deliveryFilters`, so the pager's total can never disagree with the rows.
  const deliveryPage = canSeeDelivery
    ? await getEmailDeliveryPage({
        canSeeDelivery,
        filters: deliveryFilters,
        page: params.page,
      })
    : { rows: [] as EmailEvent[], total: 0, page: 1, pageCount: 1, deliveryError: null };
  const filteredEvents = deliveryPage.rows;
  const combinedDeliveryError = deliveryError ?? deliveryPage.deliveryError;

  // C-16 Phase D Step 9 — page navigation keeps every other query param;
  // `page` is the only one it rewrites. The filter strip's own URL builder
  // (DeliveryFilterStrip's `toUrl`) never sets `page`, so every filter change
  // drops it at its own source and the window resets when the result set
  // changes (same discipline as bookings' Step 7).
  const deliveryRetryParams = new URLSearchParams();
  for (const [key, value] of Object.entries(params)) {
    if (key === "page") continue;
    if (typeof value === "string" && value.length > 0) deliveryRetryParams.set(key, value);
  }
  const makeDeliveryPageHref = (nextPage: number) => {
    const p = new URLSearchParams(deliveryRetryParams);
    p.set("page", String(nextPage));
    return `/admin/emails?${p.toString()}`;
  };

  // Failed-in-last-24h count for the Delivery tab badge.
  const failedRecent = countFailedRecent(allEvents);

  // ── Tab-strip metadata ────────────────────────────────────────────────────
  const tabs: { key: TabKey; label: string; badge?: BadgeDescriptor; visible: boolean }[] = [
    {
      key: "delivery",
      label: "Delivery",
      visible: canSeeDelivery,
      badge:
        failedRecent > 0
          ? { value: failedRecent, tone: "danger", title: `${failedRecent} failed in the last 24 hours` }
          : undefined,
    },
    {
      key: "reminders",
      label: "Reminders",
      visible: canResend,
      badge:
        canResend && upcomingBookings.length > 0
          ? {
              value: upcomingBookings.length,
              tone: "muted",
              title: `${upcomingBookings.length} upcoming bookings without a reminder yet`,
            }
          : undefined,
    },
    {
      key: "reviews",
      label: "Review requests",
      visible: canResend,
      badge:
        canResend && reviewCandidates.length > 0
          ? {
              value: reviewCandidates.length,
              tone: "muted",
              title: `${reviewCandidates.length} completed bookings not yet asked for a review`,
            }
          : undefined,
    },
    {
      key: "templates",
      label: "Templates",
      visible: true,
    },
  ];

  return (
    <div className="grid gap-6 pb-24 sm:pb-0">
      <AdminPageHeader
        title="Email"
        description="Delivery status, manual reminders, review requests, and template library."
      />

      <TabStrip tabs={tabs.filter((t) => t.visible)} activeTab={activeTab} />

      {activeTab === "delivery" && canSeeDelivery ? (
        <DeliveryTab
          filters={initialFilters}
          deliveryFilters={deliveryFilters}
          events={filteredEvents}
          total={deliveryPage.total}
          totalLoaded={allEvents.length}
          deliveryError={combinedDeliveryError}
          allowAdminRecipient={allowAdminRecipient}
          searchAttemptedTooShort={q.length > 0 && q.length < SEARCH_MIN_CHARS}
          canResend={canResend}
          page={deliveryPage.page}
          pageCount={deliveryPage.pageCount}
          makeHref={makeDeliveryPageHref}
        />
      ) : null}

      {activeTab === "reminders" && canResend ? (
        <RemindersTab
          bookings={upcomingBookings}
          lastReminderByBooking={lastReminderByBooking}
        />
      ) : null}

      {activeTab === "reviews" && canResend ? (
        <ReviewsTab candidates={reviewCandidates} />
      ) : null}

      {activeTab === "templates" ? (
        <TemplateGallery
          canEdit={canManageEmailTemplates(profile)}
          badges={templateBadges}
        />
      ) : null}
    </div>
  );
}

// ─── Tab strip ────────────────────────────────────────────────────────────────

interface BadgeDescriptor {
  value: number;
  tone: "danger" | "muted";
  title: string;
}

function TabStrip({
  tabs,
  activeTab,
}: {
  tabs: { key: TabKey; label: string; badge?: BadgeDescriptor; visible: boolean }[];
  activeTab: TabKey;
}) {
  return (
    <nav
      aria-label="Email sections"
      className="-mx-4 sm:mx-0"
    >
      {/* Mobile: momentum-scroll pill row. Desktop: row of pills with a fine underline. */}
      <ul className="relative flex min-w-full gap-1.5 overflow-x-auto px-4 pb-px sm:px-0 [scrollbar-width:none] [&::-webkit-scrollbar]:hidden">
        {tabs.map((tab) => {
          const isActive = tab.key === activeTab;
          return (
            <li key={tab.key} className="shrink-0">
              <Link
                href={`/admin/emails?tab=${tab.key}`}
                aria-current={isActive ? "page" : undefined}
                className={cn(
                  "group inline-flex min-h-10 items-center gap-2 rounded-full border px-4 text-sm font-medium outline-none transition-colors duration-150 focus-visible:ring-2 focus-visible:ring-[var(--admin-focus)]/55",
                  isActive
                    ? "border-[var(--admin-primary)] bg-[var(--admin-primary)] text-[var(--admin-on-primary)] hover:shadow-[0_1px_3px_var(--admin-shadow-ink-18)]"
                    : "border-[var(--admin-border-form)] bg-[var(--admin-panel)] text-[var(--admin-body)] hover:border-[var(--admin-primary)]/40 hover:bg-[var(--admin-panel-muted)]"
                )}
              >
                <span>{tab.label}</span>
                {tab.badge ? (
                  <span
                    title={tab.badge.title}
                    aria-label={tab.badge.title}
                    className={cn(
                      "inline-flex min-w-5 items-center justify-center rounded-full px-1.5 text-[0.6875rem] font-semibold [font-variant-numeric:tabular-nums]",
                      tab.badge.tone === "danger"
                        ? isActive
                          ? "bg-white/15 text-[var(--admin-on-primary)]"
                          : "bg-[var(--admin-status-cancelled-bg)] text-[var(--admin-status-cancelled-text)]"
                        : isActive
                          ? "bg-white/15 text-[var(--admin-on-primary)]"
                          : "bg-[var(--admin-panel-muted)] text-[var(--admin-text-muted)]"
                    )}
                  >
                    {tab.badge.value}
                  </span>
                ) : null}
              </Link>
            </li>
          );
        })}
      </ul>
    </nav>
  );
}

// ─── Delivery tab ─────────────────────────────────────────────────────────────

function DeliveryTab({
  filters,
  deliveryFilters,
  events,
  total,
  totalLoaded,
  deliveryError,
  allowAdminRecipient,
  searchAttemptedTooShort,
  canResend,
  page,
  pageCount,
  makeHref,
}: {
  filters: DeliveryFilters;
  deliveryFilters: DeliveryFilters;
  events: EmailEvent[];
  /** Real count matching `deliveryFilters` (C-16 Step 9) — the pager's total. */
  total: number;
  totalLoaded: number;
  deliveryError: { message: string } | null;
  allowAdminRecipient: boolean;
  searchAttemptedTooShort: boolean;
  canResend: boolean;
  page: number;
  pageCount: number;
  makeHref: (page: number) => string;
}) {
  const anyFilter = hasAnyDeliveryFilter(deliveryFilters);

  if (deliveryError) {
    return (
      <div className="grid gap-4">
        <DeliveryFilterStrip
          initialValues={filters}
          allowAdminRecipient={allowAdminRecipient}
        />
        <div
          role="alert"
          aria-live="polite"
          className="grid gap-2 rounded-[var(--admin-radius-card)] border border-[var(--admin-status-cancelled-border-soft)] bg-[var(--admin-status-cancelled-bg)] p-4 text-sm text-[var(--admin-status-cancelled-text)]"
        >
          <div className="flex items-center gap-2">
            <MailWarning className="size-4 shrink-0" aria-hidden="true" />
            <p className="font-semibold">Couldn&apos;t load email events</p>
          </div>
          <p>Try refreshing the page.</p>
          <div>
            <Link
              href="/admin/emails?tab=delivery"
              className="inline-flex h-9 items-center rounded-[var(--admin-radius-control)] border border-[var(--admin-danger-border)] bg-transparent px-3 text-xs font-semibold text-[var(--admin-status-cancelled-text)] outline-none transition-colors hover:bg-[var(--admin-status-cancelled-bg-hover)] focus-visible:ring-2 focus-visible:ring-[var(--admin-focus)]/55"
            >
              Try again
            </Link>
          </div>
        </div>
      </div>
    );
  }

  return (
    <div className="grid gap-4">
      <DeliveryFilterStrip
        initialValues={filters}
        allowAdminRecipient={allowAdminRecipient}
      />

      {events.length === 0 ? (
        <DeliveryEmpty
          hasAnyFilter={anyFilter}
          totalLoaded={totalLoaded}
          deliveryStatus={deliveryFilters.delivery_status}
          searchAttemptedTooShort={searchAttemptedTooShort}
        />
      ) : (
        <>
          <DayGroupedFeed events={events} total={total} anyFilter={anyFilter} canResend={canResend} />
          {/* C-16 Phase D Step 9 — replaces the FAKE "most recent 100" notice
              with the real pager; renders nothing at one page. */}
          <PaginationBar
            page={page}
            pageCount={pageCount}
            total={total}
            pageSize={LOG_PAGE_SIZE}
            makeHref={makeHref}
          />
        </>
      )}
    </div>
  );
}

function DeliveryEmpty({
  hasAnyFilter,
  totalLoaded,
  deliveryStatus,
  searchAttemptedTooShort,
}: {
  hasAnyFilter: boolean;
  totalLoaded: number;
  deliveryStatus: string;
  searchAttemptedTooShort: boolean;
}) {
  if (searchAttemptedTooShort) {
    return (
      <EmptyState
        icon={MailWarning}
        title="Type a longer search"
        message="Type at least 4 characters of an email or event ID."
        action={{ label: "Clear filters", href: "/admin/emails?tab=delivery" }}
      />
    );
  }
  if (hasAnyFilter && deliveryStatus === "failed") {
    return (
      <EmptyState
        icon={MailCheck}
        title="No failed events in this range"
        message="Your emails are all getting through."
        action={{ label: "Clear filters", href: "/admin/emails?tab=delivery" }}
      />
    );
  }
  if (hasAnyFilter) {
    return (
      <EmptyState
        icon={MailWarning}
        title="No email events match your filters"
        message="Try a wider date range, or clear the filters."
        action={{ label: "Clear filters", href: "/admin/emails?tab=delivery" }}
      />
    );
  }
  if (totalLoaded === 0) {
    return (
      <EmptyState
        icon={Inbox}
        illustrationSrc="/images/admin/empty-states/emails-empty.svg"
        title="No email events logged yet"
        message="Events appear here as confirmation, reminder, and cancellation emails go out."
      />
    );
  }
  // Defensive: filters cleared but local filter still removed everything.
  return (
    <EmptyState
      icon={Inbox}
      title="No email events match your filters"
      message="Try a wider date range, or clear the filters."
      action={{ label: "Clear filters", href: "/admin/emails?tab=delivery" }}
    />
  );
}

function DayGroupedFeed({
  events,
  total,
  anyFilter,
  canResend,
}: {
  events: EmailEvent[];
  /** Real count matching the active filters (C-16 Step 9), not just what's on this page. */
  total: number;
  anyFilter: boolean;
  canResend: boolean;
}) {
  // C-16 Phase D Step 9 — `events` is now one PAGE of a possibly-larger
  // filtered set, not the whole loaded pool: a calendar day that straddles a
  // page boundary is split across two renders of this component, each
  // showing only its own page's share of that day under a full-looking day
  // header (see the plan's accepted risk — same category as the audit log).
  const groups: { key: string; label: string; events: EmailEvent[] }[] = [];
  for (const event of events) {
    const key = dayKey(event.created_at);
    const last = groups[groups.length - 1];
    if (last && last.key === key) {
      last.events.push(event);
    } else {
      groups.push({ key, label: dayLabel(event.created_at), events: [event] });
    }
  }

  return (
    <div className="grid gap-7">
      <p
        className="-mb-3 text-sm leading-6 text-[var(--admin-text-muted)] [font-variant-numeric:tabular-nums]"
        aria-live="polite"
      >
        Showing{" "}
        <span className="font-semibold text-[var(--admin-heading)]">{events.length}</span> of{" "}
        <span className="font-semibold text-[var(--admin-heading)]">{total}</span>{" "}
        {anyFilter ? "matching events" : "events"}
      </p>

      {groups.map((group) => {
        const failedInGroup = group.events.filter(
          (e) => e.delivery_status === "failed" || e.delivery_status === "bounced"
        ).length;
        return (
          <AdminPanel
            key={group.key}
            title={group.label}
            badge={
              <span className="inline-flex items-center gap-2">
                {failedInGroup > 0 ? (
                  <span className="inline-flex items-center gap-1 rounded-full bg-[var(--admin-status-cancelled-bg)] px-2 py-0.5 text-[var(--admin-status-cancelled-text)]">
                    <span
                      className="font-[var(--font-admin-serif),Cormorant_Garamond,Georgia,serif] text-base font-bold leading-none [font-variant-numeric:tabular-nums]"
                      style={{
                        fontFamily:
                          "var(--font-admin-serif), 'Cormorant Garamond', Georgia, serif",
                      }}
                    >
                      {failedInGroup}
                    </span>
                    <span className="text-[0.6875rem] font-semibold uppercase tracking-[0.04em]">
                      failed
                    </span>
                  </span>
                ) : null}
                <AdminStatusBadge
                  tone="muted"
                  compact
                  value={`${group.events.length} ${group.events.length === 1 ? "event" : "events"}`}
                />
              </span>
            }
            density="compact"
          >
            <ul className="grid list-none gap-2 [&>li]:list-none">
              {group.events.map((event) => (
                <li key={event.id}>
                  <DeliveryEventRow event={event} canResend={canResend} />
                </li>
              ))}
            </ul>
          </AdminPanel>
        );
      })}
    </div>
  );
}

// ─── Delivery event row ───────────────────────────────────────────────────────

function DeliveryEventRow({
  event,
  canResend,
}: {
  event: EmailEvent;
  canResend: boolean;
}) {
  const eventIcon = iconForEventType(event.event_type);
  const statusTone = toneForDeliveryStatus(event.delivery_status);
  const isFailed =
    event.delivery_status === "failed" || event.delivery_status === "bounced";
  const isMissingRecipient = !event.recipient_email;
  // Skipped events have no rendered payload to resend (brief §4.2); a
  // missing recipient means the row has nothing to resend TO either.
  const showResend =
    canResend && event.delivery_status !== "skipped" && event.recipient_email;

  return (
    <article
      className={cn(
        "rounded-[var(--admin-radius-card)] border px-4 py-3 transition-colors duration-150",
        isFailed
          ? "border-[var(--admin-status-cancelled-border-strong)] bg-[var(--admin-status-cancelled-bg)]/45 hover:border-[var(--admin-danger-border)]"
          : "border-[var(--admin-border)] bg-[var(--admin-panel)] hover:border-[var(--admin-primary)]/30",
        "hover:shadow-[0_1px_4px_var(--admin-shadow-ink-08)]"
      )}
    >
      <div className="flex flex-wrap items-start gap-3">
        <span
          className={cn(
            "mt-0.5 inline-flex size-9 shrink-0 items-center justify-center rounded-full",
            isFailed
              ? "bg-[var(--admin-status-cancelled-bg)] text-[var(--admin-status-cancelled-text)]"
              : isMissingRecipient
                ? "bg-[var(--admin-status-attention-bg)] text-[var(--admin-status-attention-text)]"
                : "bg-[oklch(96%_0.012_88)] text-[var(--admin-primary)]"
          )}
          aria-hidden="true"
        >
          {createElement(eventIcon, { className: "size-4" })}
        </span>

        <div className="min-w-0 flex-1">
          <div className="flex flex-wrap items-center gap-1.5">
            {isMissingRecipient ? (
              <span title="This booking has no email address — fix on the booking detail page.">
                <AdminStatusBadge
                  tone="warning"
                  compact
                  value="No recipient on file"
                />
              </span>
            ) : null}
            <AdminStatusBadge
              tone="muted"
              compact
              value={labelForEventType(event.event_type)}
            />
            <AdminStatusBadge
              tone={statusTone}
              compact
              value={labelForDeliveryStatus(event.delivery_status)}
            />
            {showResend ? (
              <span className="ml-auto shrink-0">
                <ResendButton
                  deliveryEventId={event.id}
                  eventTypeLabel={labelForEventType(event.event_type)}
                  recipientEmail={event.recipient_email as string}
                />
              </span>
            ) : null}
          </div>

          <p className="mt-1.5 truncate text-sm font-medium text-[var(--admin-heading)]">
            {event.recipient_email ?? (
              <RecipientFallback bookingId={event.booking_id} />
            )}
          </p>

          <p
            className="mt-1 flex flex-wrap items-center gap-x-2 gap-y-1 text-xs text-[var(--admin-text-muted)] [font-variant-numeric:tabular-nums]"
          >
            <span className="capitalize">{labelForRecipientRole(event.recipient_role)}</span>
            <span aria-hidden="true">·</span>
            <time
              dateTime={event.created_at}
              title={absoluteTimestamp(event.created_at)}
            >
              {relativeTime(event.created_at)}
            </time>
            {event.provider_message_id ? (
              <>
                <span aria-hidden="true">·</span>
                <CopyEventId id={event.provider_message_id} />
              </>
            ) : null}
          </p>

          {event.error_message ? (
            <details className="group mt-2.5 rounded-[var(--admin-radius-control)] border border-[var(--admin-status-cancelled-border)] bg-[var(--admin-status-cancelled-bg)]/40 text-sm">
              <summary
                className="flex cursor-pointer list-none items-center gap-1.5 px-3 py-2 text-xs font-semibold text-[var(--admin-status-cancelled-text)] outline-none transition-colors hover:bg-[var(--admin-status-cancelled-bg)]/70 focus-visible:ring-2 focus-visible:ring-[var(--admin-focus)]/55 [&::-webkit-details-marker]:hidden"
                title="Show the full provider error"
              >
                <TriangleAlert className="size-3.5 shrink-0" aria-hidden="true" />
                <span>Provider error</span>
                <ChevronRight
                  className="ml-auto size-3.5 shrink-0 transition-transform duration-150 group-open:rotate-90"
                  aria-hidden="true"
                />
              </summary>
              <div className="border-t border-[var(--admin-status-cancelled-border)] px-3 py-2">
                <p
                  className="text-xs leading-5 text-[var(--admin-status-cancelled-text)] [word-break:break-word]"
                  style={{
                    fontFamily:
                      "var(--font-admin-mono), 'IBM Plex Mono', Menlo, monospace",
                  }}
                >
                  {event.error_message}
                </p>
                <p className="mt-1.5 text-[0.6875rem] leading-4 text-[var(--admin-status-cancelled-text)]/75">
                  This is the message Resend (our email provider) returned. Copy the ID into a support ticket if you contact them.
                </p>
              </div>
            </details>
          ) : null}

          {event.booking_id ? (
            <div className="mt-2">
              <Link
                href={`/admin/bookings/${event.booking_id}`}
                className="inline-flex min-h-7 items-center gap-1 rounded-[var(--admin-radius-control)] px-1.5 -ml-1.5 text-xs font-semibold text-[var(--admin-primary)] underline-offset-4 outline-none transition-colors hover:underline focus-visible:ring-2 focus-visible:ring-[var(--admin-focus)]/55"
              >
                Open booking
                <ChevronRight className="size-3 shrink-0" aria-hidden="true" />
              </Link>
            </div>
          ) : null}
        </div>
      </div>
    </article>
  );
}

function RecipientFallback({ bookingId }: { bookingId: string | null }) {
  if (!bookingId) {
    return <span className="text-[var(--admin-text-muted)]">No recipient</span>;
  }
  const short = bookingId.slice(0, 8);
  return (
    <span className="text-[var(--admin-text-muted)]">
      No recipient ·{" "}
      <Link
        href={`/admin/bookings/${bookingId}`}
        className="text-[var(--admin-primary)] underline-offset-4 hover:underline focus-visible:underline"
        style={{
          fontFamily:
            "var(--font-admin-mono), 'IBM Plex Mono', Menlo, monospace",
        }}
      >
        booking #{short}
      </Link>
    </span>
  );
}

// ─── Reminders tab ────────────────────────────────────────────────────────────

function RemindersTab({
  bookings,
  lastReminderByBooking,
}: {
  bookings: ReminderBooking[];
  lastReminderByBooking: Map<string, string>;
}) {
  if (bookings.length === 0) {
    return (
      <section className="mx-auto w-full max-w-[720px]">
        <EmptyState
          icon={CalendarClock}
          illustrationSrc="/images/admin/empty-states/reminders-empty.svg"
          title="No upcoming bookings need a reminder"
          message="Everyone's confirmed."
        />
      </section>
    );
  }

  return (
    <section className="mx-auto grid w-full max-w-[720px] gap-4 text-left">
      <p className="text-sm leading-6 text-[var(--admin-text-muted)]">
        Sends the existing reminder template. No private email bodies are stored.
      </p>
      <ul className="grid list-none gap-3 [&>li]:list-none">
        {bookings.map((booking) => (
          <li key={booking.id}>
            <ReminderRow
              booking={booking}
              lastReminderAt={lastReminderByBooking.get(booking.id) ?? null}
            />
          </li>
        ))}
      </ul>
    </section>
  );
}

function ReminderRow({
  booking,
  lastReminderAt,
}: {
  booking: ReminderBooking;
  lastReminderAt: string | null;
}) {
  const hasRecipient = Boolean(booking.contact_email);
  const lastReminder = lastReminderLine(lastReminderAt);

  return (
    <article
      className={cn(
        "grid grid-cols-[auto_1fr] gap-3 rounded-[var(--admin-radius-card)] border border-[var(--admin-border)] bg-[var(--admin-panel)] p-4 transition-colors duration-150 hover:border-[var(--admin-primary)]/30 hover:shadow-[0_1px_4px_var(--admin-shadow-ink-08)]",
        "sm:grid-cols-[auto_1fr_auto] sm:items-center"
      )}
    >
      <span
        aria-hidden="true"
        className="inline-flex size-10 shrink-0 items-center justify-center rounded-full bg-[oklch(96%_0.012_88)] font-semibold text-[var(--admin-primary)]"
      >
        {initialsFromName(booking.contact_full_name)}
      </span>

      <div className="min-w-0">
        <div className="flex flex-wrap items-center gap-2">
          <Link
            href={`/admin/bookings/${booking.id}`}
            className="min-w-0 break-words text-sm font-semibold text-[var(--admin-heading)] underline-offset-4 outline-none transition-colors hover:text-[var(--admin-primary)] hover:underline focus-visible:underline focus-visible:ring-2 focus-visible:ring-[var(--admin-focus)]/55 rounded-sm"
          >
            {booking.contact_full_name ?? "Unknown contact"}
          </Link>
          {!hasRecipient ? (
            <span title="This booking has no email address — fix on the booking detail page.">
              <AdminStatusBadge
                tone="warning"
                compact
                value="No recipient on file"
              />
            </span>
          ) : null}
        </div>
        <p className="mt-0.5 text-sm text-[var(--admin-body)] [font-variant-numeric:tabular-nums]">
          {formatReminderDateTime(booking.booking_date, booking.start_time)}
        </p>
        <p className="mt-0.5 flex flex-wrap items-center gap-x-2 gap-y-0.5 text-xs text-[var(--admin-text-muted)]">
          {hasRecipient ? (
            <span className="min-w-0 truncate">{booking.contact_email}</span>
          ) : (
            <Link
              href={`/admin/bookings/${booking.id}`}
              className="text-[var(--admin-primary)] underline-offset-4 hover:underline focus-visible:underline"
              title="This booking has no email address — fix on the booking detail page."
            >
              Add an email on the booking
            </Link>
          )}
          {lastReminder ? (
            <>
              <span aria-hidden="true">·</span>
              <span title={lastReminder.absolute}>
                Last reminder: {lastReminder.display}
              </span>
            </>
          ) : null}
        </p>
      </div>

      <div className="col-span-2 justify-self-stretch sm:col-span-1 sm:justify-self-end">
        <ReminderResendForm
          bookingId={booking.id}
          contactFullName={booking.contact_full_name}
          hasRecipient={hasRecipient}
        />
      </div>
    </article>
  );
}

// ─── Review requests tab ──────────────────────────────────────────────────────

function ReviewsTab({ candidates }: { candidates: ReviewRequestCandidate[] }) {
  if (candidates.length === 0) {
    return (
      <section className="mx-auto w-full max-w-[720px]">
        <EmptyState
          icon={Star}
          title="No completed bookings are waiting on a review request"
          message="Everyone who's finished a visit has already been asked."
        />
      </section>
    );
  }

  return (
    <section className="mx-auto grid w-full max-w-[720px] gap-4 text-left">
      <p className="text-sm leading-6 text-[var(--admin-text-muted)]">
        Sends the existing review-request template. One request per booking,
        ever — a booking disappears from this list once it has been asked.
      </p>
      <ul className="grid list-none gap-3 [&>li]:list-none">
        {candidates.map((candidate) => (
          <li key={candidate.id}>
            <ReviewRow candidate={candidate} />
          </li>
        ))}
      </ul>
    </section>
  );
}

function ReviewRow({ candidate }: { candidate: ReviewRequestCandidate }) {
  return (
    <article
      className={cn(
        "grid grid-cols-[auto_1fr] gap-3 rounded-[var(--admin-radius-card)] border border-[var(--admin-border)] bg-[var(--admin-panel)] p-4 transition-colors duration-150 hover:border-[var(--admin-primary)]/30",
        "sm:grid-cols-[auto_1fr_auto] sm:items-center"
      )}
    >
      <span
        aria-hidden="true"
        className="inline-flex size-10 shrink-0 items-center justify-center rounded-full bg-[var(--admin-panel-muted)] font-semibold text-[var(--admin-primary)]"
      >
        {initialsFromName(candidate.contact_full_name)}
      </span>

      <div className="min-w-0">
        <Link
          href={`/admin/bookings/${candidate.id}`}
          className="min-w-0 break-words text-sm font-semibold text-[var(--admin-heading)] underline-offset-4 outline-none transition-colors hover:text-[var(--admin-primary)] hover:underline focus-visible:underline focus-visible:ring-2 focus-visible:ring-[var(--admin-focus)]/55 rounded-sm"
        >
          {candidate.contact_full_name ?? "Unknown contact"}
        </Link>
        <p className="mt-0.5 text-sm text-[var(--admin-body)] [font-variant-numeric:tabular-nums]">
          {formatReminderDateTime(candidate.booking_date, candidate.start_time)}
        </p>
        <p className="mt-0.5 text-xs text-[var(--admin-text-muted)]">
          <span className="min-w-0 truncate">{candidate.recipient_email}</span>
        </p>
      </div>

      <div className="col-span-2 justify-self-stretch sm:col-span-1 sm:justify-self-end">
        <ReviewRequestButton
          bookingId={candidate.id}
          contactFullName={candidate.contact_full_name}
          recipientEmail={candidate.recipient_email}
        />
      </div>
    </article>
  );
}

// ─── Local helpers ────────────────────────────────────────────────────────────

function isEventType(value: string | undefined): value is EmailEventType {
  return Boolean(value && (EMAIL_EVENT_TYPES as readonly string[]).includes(value));
}

function isDeliveryStatus(value: string | undefined): value is DeliveryStatus {
  return Boolean(value && (DELIVERY_STATUSES as readonly string[]).includes(value));
}

function isRecipientRole(value: string | undefined): value is RecipientRole {
  return Boolean(value && (RECIPIENT_ROLES as readonly string[]).includes(value));
}


function countFailedRecent(events: EmailEvent[]): number {
  const cutoff = Date.now() - FAILED_BADGE_WINDOW_HOURS * 60 * 60 * 1000;
  return events.reduce((acc, event) => {
    if (
      (event.delivery_status === "failed" || event.delivery_status === "bounced") &&
      new Date(event.created_at).getTime() >= cutoff
    ) {
      return acc + 1;
    }
    return acc;
  }, 0);
}

