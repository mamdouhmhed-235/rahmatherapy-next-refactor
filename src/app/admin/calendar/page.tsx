import Link from "next/link";
import { redirect } from "next/navigation";
import {
  AlertCircle,
  CalendarCheck,
  CalendarClock,
  CheckCircle2,
  ChevronLeft,
  ChevronRight,
  UserX,
  X,
} from "lucide-react";
import { createSupabaseAdminClient } from "@/lib/supabase/admin";
import { createSupabaseServerClient } from "@/lib/supabase/server";
import {
  addBusinessDays,
  formatBusinessDate,
  getBusinessDate,
} from "@/lib/time/london";
import { getStaffProfile } from "@/lib/auth/rbac";
import { getAdminPageAccess } from "@/lib/auth/admin-access";
import {
  AdminAccessDenied,
  AdminPageHeader,
  AdminPanel,
  AdminStatusBadge,
} from "../components/admin-ui";
import { EmptyState } from "../components/EmptyState";
import { cn } from "@/lib/utils";
import {
  getReportData,
  parseReportFilters,
  type ReportBooking,
} from "../reports/reporting";
import { formatLabel } from "../bookings/format";
import { PrintButton } from "./PrintButton";
import {
  CalendarDatePopover,
  CalendarStepperNav,
} from "./CalendarDatePopover";

export const metadata = {
  title: "Calendar - Rahma Therapy Admin",
};

interface CalendarPageProps {
  searchParams: Promise<Record<string, string | string[] | undefined>>;
}

type CalendarView = "day" | "week" | "month" | "range";

interface CalendarParams {
  view: CalendarView;
  date: string;
  staffId: string;
  paymentStatus: string;
  to: string;
}

const RANGE_SOFT_CAP_DAYS = 31;

function daysBetween(fromISO: string, toISO: string): number {
  const [fy, fm, fd] = fromISO.split("-").map(Number);
  const [ty, tm, td] = toISO.split("-").map(Number);
  const f = Date.UTC(fy!, (fm ?? 1) - 1, fd ?? 1, 12);
  const t = Date.UTC(ty!, (tm ?? 1) - 1, td ?? 1, 12);
  return Math.round((t - f) / (24 * 60 * 60 * 1000)) + 1;
}

const WEEKDAYS_MON_FIRST = ["Mon", "Tue", "Wed", "Thu", "Fri", "Sat", "Sun"];

function mondayOfWeek(iso: string): string {
  const [y, m, d] = iso.split("-").map(Number);
  const date = new Date(Date.UTC(y!, (m ?? 1) - 1, d ?? 1, 12));
  const day = date.getUTCDay(); // 0=Sun, 1=Mon...6=Sat
  const offset = day === 0 ? -6 : 1 - day;
  date.setUTCDate(date.getUTCDate() + offset);
  return date.toISOString().slice(0, 10);
}

function firstOfMonth(iso: string): string {
  const [y, m] = iso.split("-");
  return `${y}-${m}-01`;
}

function addMonths(iso: string, n: number): string {
  const [y, m] = iso.split("-").map(Number);
  const date = new Date(Date.UTC(y!, (m ?? 1) - 1 + n, 1, 12));
  return date.toISOString().slice(0, 10);
}

function buildMonthGridDates(monthFirstISO: string): string[] {
  const monday = mondayOfWeek(monthFirstISO);
  return Array.from({ length: 42 }, (_, i) => addBusinessDays(monday, i));
}

function formatMonthLabel(monthFirstISO: string): string {
  const [y, m, d] = monthFirstISO.split("-").map(Number);
  return new Intl.DateTimeFormat("en-GB", {
    month: "long",
    year: "numeric",
    timeZone: "Europe/London",
  }).format(new Date(Date.UTC(y!, (m ?? 1) - 1, d ?? 1, 12)));
}

const ISO_DATE_RE = /^\d{4}-\d{2}-\d{2}$/;

function isValidISODate(value: string): boolean {
  if (!ISO_DATE_RE.test(value)) return false;
  const d = new Date(value);
  return !Number.isNaN(d.getTime());
}

function readParam(
  params: Record<string, string | string[] | undefined>,
  key: string
): string {
  const raw = params[key];
  if (Array.isArray(raw)) return raw[0] ?? "";
  return typeof raw === "string" ? raw : "";
}

function buildHref(
  base: CalendarParams,
  overrides: Partial<CalendarParams>
): string {
  const merged = { ...base, ...overrides };
  const sp = new URLSearchParams();
  sp.set("view", merged.view);
  sp.set("date", merged.date);
  if (merged.to) sp.set("to", merged.to);
  if (merged.staffId) sp.set("staffId", merged.staffId);
  if (merged.paymentStatus) sp.set("paymentStatus", merged.paymentStatus);
  return `/admin/calendar?${sp.toString()}`;
}

function stepDate(date: string, view: CalendarView, direction: 1 | -1): string {
  if (view === "month") return addMonths(date, direction);
  if (view === "week") return addBusinessDays(date, direction * 7);
  // day + range fall back to single-day step on the start date (the caller
  // separately handles `to` for range view).
  return addBusinessDays(date, direction);
}

export default async function CalendarPage({ searchParams }: CalendarPageProps) {
  const supabase = await createSupabaseServerClient();
  const profile = await getStaffProfile(supabase);
  if (!profile || !profile.active) redirect("/admin/login");

  const access = getAdminPageAccess(profile, "calendar");
  if (!access.access) return <CalendarAccessDenied />;

  const params = await searchParams;
  const rawDate = readParam(params, "date");
  const rawTo = readParam(params, "to");
  const rawView = readParam(params, "view") as CalendarView | "";
  const rawStaffId = readParam(params, "staffId");
  const today = getBusinessDate();
  let view: CalendarView =
    rawView === "day" ||
    rawView === "week" ||
    rawView === "month" ||
    rawView === "range"
      ? rawView
      : "day";
  const dateValid = rawDate ? isValidISODate(rawDate) : true;
  let selectedDate = dateValid && rawDate ? rawDate : today;

  // Range view: validate `to`. If invalid or missing, demote to day view.
  // If range is inverted (to < from), swap. If range exceeds the soft cap,
  // snap to month view of the start month + drop the range — the popover
  // already enforces the cap, this guards against hand-edited URLs.
  let rangeToISO = "";
  if (view === "range") {
    const toValid = rawTo && isValidISODate(rawTo);
    if (!toValid) {
      view = "day";
    } else {
      const fromIso = selectedDate;
      const toIso = rawTo;
      const ordered: [string, string] =
        fromIso <= toIso ? [fromIso, toIso] : [toIso, fromIso];
      const length = daysBetween(ordered[0], ordered[1]);
      if (length === 1) {
        view = "day";
        selectedDate = ordered[0];
      } else if (length > RANGE_SOFT_CAP_DAYS) {
        view = "month";
        selectedDate = firstOfMonth(ordered[0]);
      } else {
        selectedDate = ordered[0];
        rangeToISO = ordered[1];
      }
    }
  }

  const monthGridDates =
    view === "month" ? buildMonthGridDates(selectedDate) : null;

  // Build the date list the agenda renders against (range view uses an
  // arbitrary length; week view is always 7).
  const rangeDates: string[] | null =
    view === "range"
      ? (() => {
          const length = daysBetween(selectedDate, rangeToISO);
          return Array.from({ length }, (_, i) =>
            addBusinessDays(selectedDate, i)
          );
        })()
      : null;

  const filters = parseReportFilters({
    ...params,
    date: selectedDate,
    view,
    from:
      view === "month"
        ? monthGridDates![0]!
        : selectedDate,
    to:
      view === "month"
        ? monthGridDates![41]!
        : view === "week"
          ? addBusinessDays(selectedDate, 6)
          : view === "range"
            ? rangeToISO
            : selectedDate,
  });

  const adminClient = createSupabaseAdminClient();
  const data = await getReportData(adminClient, profile, filters);

  const therapistOnly = access.dataScope === "assigned";
  const canCreate = Boolean(access.actions.create);
  const canSeePayment = !therapistOnly
    ? data.bookings.some((b) => b.payment_status)
    : true;

  // Surface validation banners
  const banners: { tone: "info" | "warning"; message: string }[] = [];
  if (rawDate && !dateValid) {
    banners.push({
      tone: "warning",
      message: "That date doesn't look right. Showing today instead.",
    });
  }
  const staffIdValid =
    !rawStaffId ||
    data.staff.some((staff) => staff.id === rawStaffId) ||
    rawStaffId === filters.staffId;
  if (rawStaffId && !staffIdValid) {
    banners.push({
      tone: "warning",
      message: "That therapist isn't in your team. Showing everyone.",
    });
  }

  // Group bookings by date for week view; day view collapses to one date
  const grouped = groupByDate(data.bookings);

  const startISO = selectedDate;
  const endISO =
    view === "day" ? selectedDate : addBusinessDays(selectedDate, 6);

  const weekDates =
    view === "week"
      ? buildWeekDates(startISO)
      : [startISO];

  const unassigned = data.bookings
    .filter((booking) =>
      ["unassigned", "partially_assigned"].includes(booking.assignment_status)
    )
    .sort((a, b) => {
      if (a.booking_date !== b.booking_date) {
        return a.booking_date < b.booking_date ? -1 : 1;
      }
      return a.start_time < b.start_time ? -1 : 1;
    });

  const baseParams: CalendarParams = {
    view,
    date: selectedDate,
    staffId: filters.staffId,
    paymentStatus: filters.paymentStatus,
    to: view === "range" ? rangeToISO : "",
  };

  const formattedDateLabel =
    view === "range"
      ? `${formatBusinessDate(selectedDate)} — ${formatBusinessDate(rangeToISO)}`
      : view === "month"
        ? formatMonthLabel(firstOfMonth(selectedDate))
        : formatBusinessDate(selectedDate);
  const formattedRangeLabel =
    view === "day"
      ? formatBusinessDate(selectedDate)
      : view === "range"
        ? `${formatBusinessDate(selectedDate)} — ${formatBusinessDate(rangeToISO)}`
        : `${formatBusinessDate(startISO)} — ${formatBusinessDate(endISO)}`;

  // Chevron stepping. Range view shifts BOTH endpoints by the range length
  // so the operator scrolls through equally-sized windows.
  const prevHref =
    view === "range"
      ? buildHref(baseParams, {
          date: addBusinessDays(selectedDate, -rangeDates!.length),
          to: addBusinessDays(rangeToISO, -rangeDates!.length),
        })
      : buildHref(baseParams, { date: stepDate(selectedDate, view, -1) });
  const nextHref =
    view === "range"
      ? buildHref(baseParams, {
          date: addBusinessDays(selectedDate, rangeDates!.length),
          to: addBusinessDays(rangeToISO, rangeDates!.length),
        })
      : buildHref(baseParams, { date: stepDate(selectedDate, view, 1) });

  // Preset hrefs + active detection — clicking a preset sets view+date to its
  // canonical anchor; the segment lights up only when the URL exactly matches
  // (so any manual date stepping leaves the segmented control unselected).
  const todayMondayISO = mondayOfWeek(today);
  const todayFirstOfMonthISO = firstOfMonth(today);
  const todayPresetHref = buildHref(baseParams, {
    view: "day",
    date: today,
    to: "",
  });
  const thisWeekPresetHref = buildHref(baseParams, {
    view: "week",
    date: todayMondayISO,
    to: "",
  });
  const thisMonthPresetHref = buildHref(baseParams, {
    view: "month",
    date: todayFirstOfMonthISO,
    to: "",
  });
  const isTodayActive = view === "day" && selectedDate === today;
  const isThisWeekActive =
    view === "week" && selectedDate === todayMondayISO;
  const isThisMonthActive =
    view === "month" && selectedDate === todayFirstOfMonthISO;

  const dayWord: "day" | "week" | "month" | "range" =
    view === "day"
      ? "day"
      : view === "week"
        ? "week"
        : view === "month"
          ? "month"
          : "range";

  // Build therapist names per booking from data.assignments (since
  // ReportBooking shape doesn't carry the join; RECON §5 forbids tweaking
  // getReportData's selector, so we join client-side).
  const therapistsByBooking = new Map<string, string[]>();
  for (const a of data.assignments) {
    const name = a.staff_profiles?.name;
    if (!name) continue;
    const list = therapistsByBooking.get(a.booking_id) ?? [];
    if (!list.includes(name)) list.push(name);
    therapistsByBooking.set(a.booking_id, list);
  }

  // Today's roundup stats (across the current filtered range)
  const stats = {
    total: data.bookings.length,
    unassigned: data.bookings.filter((b) =>
      ["unassigned", "partially_assigned"].includes(b.assignment_status)
    ).length,
    reschedule: data.bookings.filter((b) => b.reschedule_status === "requested")
      .length,
    unpaid: data.bookings.filter((b) => b.payment_status === "unpaid").length,
  };

  // Active filter chips (rendered below the rail when filters are non-default)
  const staffFilterName =
    staffIdValid && rawStaffId
      ? data.staff.find((s) => s.id === rawStaffId)?.name ?? null
      : null;
  const paymentFilterLabel =
    filters.paymentStatus === "paid"
      ? "Paid"
      : filters.paymentStatus === "unpaid"
        ? "Unpaid"
        : null;
  const hasActiveFilters = Boolean(staffFilterName || paymentFilterLabel);

  return (
    <div className="grid min-w-0 gap-5 pb-[calc(5rem+env(safe-area-inset-bottom,0px))] print:gap-3 print:pb-0 lg:pb-0">
      <AdminPageHeader
        title="Calendar"
        actions={
          <div className="flex items-center gap-2 print:hidden">
            <PrintButton />
          </div>
        }
      />

      <PrintHeader rangeLabel={formattedRangeLabel} />

      {/* Control rail — sticky on scroll, hidden in print */}
      <form
        action="/admin/calendar"
        method="get"
        className="sticky top-0 z-20 rounded-[var(--admin-radius-card)] border border-[var(--admin-border)] bg-[var(--admin-panel)] px-3 py-3 shadow-[0_1px_4px_oklch(23%_0.073_155_/_0.06)] print:hidden"
        aria-label="Calendar filters"
      >
        <div className="flex flex-wrap items-center gap-3">
          {/* Hidden inputs so non-JS form submit preserves view + date */}
          <input type="hidden" name="view" value={view} />
          <input type="hidden" name="date" value={selectedDate} />

          {/* Range preset segmented control (Today / This week / This month).
              No segment lights up when the operator has picked a custom date
              or stepped away from the preset's anchor. */}
          <fieldset
            className="inline-flex h-10 items-center rounded-[var(--admin-radius-control)] border border-[var(--admin-border)] bg-[var(--admin-panel-muted)] p-0.5"
            aria-label="Date range preset"
          >
            <legend className="sr-only">Date range preset</legend>
            <PresetLink href={todayPresetHref} label="Today" active={isTodayActive} />
            <PresetLink
              href={thisWeekPresetHref}
              label="This week"
              active={isThisWeekActive}
            />
            <PresetLink
              href={thisMonthPresetHref}
              label="This month"
              active={isThisMonthActive}
            />
          </fieldset>

          {/* Date stepper */}
          <CalendarStepperNav
            prevHref={prevHref}
            nextHref={nextHref}
            dayWord={dayWord}
          >
            <div
              className="inline-flex h-12 items-center gap-1 rounded-[var(--admin-radius-control)] border border-[var(--admin-border)] bg-[var(--admin-panel)] px-1"
              role="group"
              aria-label={`Step calendar ${dayWord}`}
            >
              <Link
                href={prevHref}
                title={`Previous ${dayWord}`}
                aria-label={`Previous ${dayWord}`}
                className="inline-flex size-11 items-center justify-center rounded-[var(--admin-radius-control)] text-[var(--admin-body)] outline-none transition-colors hover:bg-[var(--admin-panel-muted)] focus-visible:ring-2 focus-visible:ring-[var(--admin-focus)]/55"
              >
                <ChevronLeft className="size-4" aria-hidden="true" />
              </Link>
              <CalendarDatePopover
                selectedDate={selectedDate}
                selectedTo={rangeToISO}
                formattedLabel={formattedDateLabel}
                baseParams={baseParams}
              />
              <Link
                href={nextHref}
                title={`Next ${dayWord}`}
                aria-label={`Next ${dayWord}`}
                className="inline-flex size-11 items-center justify-center rounded-[var(--admin-radius-control)] text-[var(--admin-body)] outline-none transition-colors hover:bg-[var(--admin-panel-muted)] focus-visible:ring-2 focus-visible:ring-[var(--admin-focus)]/55"
              >
                <ChevronRight className="size-4" aria-hidden="true" />
              </Link>
            </div>
          </CalendarStepperNav>

          {/* Staff combobox (hidden for therapist scope) */}
          {therapistOnly ? (
            <p className="inline-flex h-10 items-center rounded-[var(--admin-radius-control)] bg-[var(--admin-panel-muted)] px-3 text-sm font-medium text-[var(--admin-text-muted)]">
              Your schedule
            </p>
          ) : (
            <label className="inline-flex h-10 items-center gap-2 text-sm">
              <span className="text-[0.8125rem] font-medium text-[var(--admin-text-muted)]">
                Therapist
              </span>
              <select
                name="staffId"
                defaultValue={staffIdValid ? rawStaffId : ""}
                className="h-10 min-w-[10rem] rounded-[var(--admin-radius-control)] border border-[var(--admin-border-form)] bg-[var(--admin-input-bg)] px-3 text-sm text-[var(--admin-body)] outline-none focus-visible:ring-2 focus-visible:ring-[var(--admin-focus)]/55"
                aria-label="Therapist"
              >
                <option value="" title="Everyone you can see on the calendar">
                  All visible staff
                </option>
                {data.staff.map((staff) => (
                  <option key={staff.id} value={staff.id}>
                    {staff.name}
                  </option>
                ))}
              </select>
            </label>
          )}

          {/* Payment select */}
          <label className="inline-flex h-10 items-center gap-2 text-sm">
            <span className="text-[0.8125rem] font-medium text-[var(--admin-text-muted)]">
              Payment
            </span>
            <select
              name="paymentStatus"
              defaultValue={filters.paymentStatus}
              className="h-10 min-w-[9rem] rounded-[var(--admin-radius-control)] border border-[var(--admin-border-form)] bg-[var(--admin-input-bg)] px-3 text-sm text-[var(--admin-body)] outline-none focus-visible:ring-2 focus-visible:ring-[var(--admin-focus)]/55"
              aria-label="Payment status"
            >
              <option value="">Any payment</option>
              <option value="paid">Paid</option>
              <option value="unpaid">Unpaid</option>
            </select>
          </label>

          <button
            type="submit"
            className="inline-flex h-10 items-center rounded-[var(--admin-radius-control)] border border-[var(--admin-border-form)] bg-transparent px-4 text-sm font-semibold text-[var(--admin-body)] outline-none transition-colors hover:bg-[var(--admin-panel-muted)] focus-visible:ring-2 focus-visible:ring-[var(--admin-focus)]/55"
          >
            Apply
          </button>
        </div>
      </form>

      {/* Validation banners */}
      {banners.length > 0 ? (
        <div className="grid gap-2 print:hidden">
          {banners.map((banner, idx) => (
            <div
              key={idx}
              role="status"
              aria-live="polite"
              className="flex items-start gap-2.5 rounded-[var(--admin-radius-control)] border border-[var(--admin-status-pending-border)] bg-[var(--admin-status-pending-bg)] px-3 py-2 text-sm text-[var(--admin-status-pending-text)]"
            >
              <CalendarClock className="mt-0.5 size-4 shrink-0" aria-hidden="true" />
              <span>{banner.message}</span>
            </div>
          ))}
        </div>
      ) : null}

      {/* Active filter chips */}
      {hasActiveFilters ? (
        <div
          className="flex flex-wrap items-center gap-2 print:hidden"
          aria-label="Active filters"
        >
          <span className="text-xs font-medium text-[var(--admin-text-muted)]">
            Filtered by
          </span>
          {staffFilterName ? (
            <Link
              href={buildHref(baseParams, { staffId: "" })}
              className="group inline-flex items-center gap-1 rounded-full border border-[var(--admin-border)] bg-[var(--admin-status-restricted-bg)] py-0.5 pl-2.5 pr-1.5 text-[0.75rem] font-medium text-[var(--admin-status-restricted-text)] outline-none transition-colors hover:bg-[oklch(91%_0.012_280)] focus-visible:ring-2 focus-visible:ring-[var(--admin-focus)]/55"
              aria-label={`Clear therapist filter (${staffFilterName})`}
            >
              <span>Therapist: {staffFilterName}</span>
              <X className="size-3" aria-hidden="true" />
            </Link>
          ) : null}
          {paymentFilterLabel ? (
            <Link
              href={buildHref(baseParams, { paymentStatus: "" })}
              className="group inline-flex items-center gap-1 rounded-full border border-[var(--admin-border)] bg-[var(--admin-status-restricted-bg)] py-0.5 pl-2.5 pr-1.5 text-[0.75rem] font-medium text-[var(--admin-status-restricted-text)] outline-none transition-colors hover:bg-[oklch(91%_0.012_280)] focus-visible:ring-2 focus-visible:ring-[var(--admin-focus)]/55"
              aria-label={`Clear payment filter (${paymentFilterLabel})`}
            >
              <span>Payment: {paymentFilterLabel}</span>
              <X className="size-3" aria-hidden="true" />
            </Link>
          ) : null}
          <Link
            href={buildHref(baseParams, { staffId: "", paymentStatus: "" })}
            className="text-[0.75rem] font-medium text-[var(--admin-primary)] outline-none hover:underline focus-visible:ring-2 focus-visible:ring-[var(--admin-focus)]/55"
          >
            Clear all
          </Link>
        </div>
      ) : null}

      {/* Today's roundup strip — quiet at-a-glance counts (hidden when empty) */}
      {stats.total > 0 ? (
        <p
          className="flex flex-wrap items-center gap-x-3 gap-y-1 text-[0.8125rem] text-[var(--admin-text-muted)] print:text-[var(--admin-heading)]"
          aria-label="Range summary"
        >
          <span className="font-medium text-[var(--admin-heading)]">
            <span className="tabular-nums">{stats.total}</span>{" "}
            booking{stats.total === 1 ? "" : "s"}
          </span>
          {stats.unassigned > 0 ? (
            <span className="text-[var(--admin-status-attention-text)]">
              <span className="tabular-nums">{stats.unassigned}</span> unassigned
            </span>
          ) : null}
          {stats.reschedule > 0 ? (
            <span className="text-[var(--admin-status-pending-text)]">
              <span className="tabular-nums">{stats.reschedule}</span> reschedule{stats.reschedule === 1 ? "" : "s"}
            </span>
          ) : null}
          {stats.unpaid > 0 ? (
            <span className="text-[var(--admin-status-attention-text)]">
              <span className="tabular-nums">{stats.unpaid}</span> unpaid
            </span>
          ) : null}
        </p>
      ) : null}

      {/* Sidebar on <xl: Attention-tinted collapsible disclosure above the
          agenda so triage stays at-a-glance on tablet/mobile (brief §3).
          Only renders when there's actually something to triage — empty
          triage queue would just be noise. */}
      {unassigned.length > 0 ? (
        <SidebarDisclosure
          therapistOnly={therapistOnly}
          unassigned={unassigned}
        />
      ) : null}

      <section
        className={cn(
          "grid min-w-0 gap-5",
          unassigned.length > 0 && "xl:grid-cols-[minmax(0,1fr)_22rem]"
        )}
      >
        <div className="grid min-w-0 gap-4">
          {view === "day" ? (
            <DayAgenda
              date={selectedDate}
              bookings={grouped.get(selectedDate) ?? []}
              canSeePayment={canSeePayment && !therapistOnly}
              therapistOnly={therapistOnly}
              canCreate={canCreate}
              therapistsByBooking={therapistsByBooking}
            />
          ) : view === "month" ? (
            <MonthGrid
              monthFirstISO={firstOfMonth(selectedDate)}
              gridDates={monthGridDates!}
              grouped={grouped}
              today={today}
              baseParams={baseParams}
              therapistOnly={therapistOnly}
              canCreate={canCreate}
            />
          ) : view === "range" ? (
            <WeekAgenda
              dates={rangeDates!}
              grouped={grouped}
              canSeePayment={canSeePayment && !therapistOnly}
              therapistOnly={therapistOnly}
              canCreate={canCreate}
              today={today}
              baseParams={baseParams}
              therapistsByBooking={therapistsByBooking}
              showWeekStrip={false}
            />
          ) : (
            <WeekAgenda
              dates={weekDates}
              grouped={grouped}
              canSeePayment={canSeePayment && !therapistOnly}
              therapistOnly={therapistOnly}
              canCreate={canCreate}
              today={today}
              baseParams={baseParams}
              therapistsByBooking={therapistsByBooking}
              showWeekStrip={true}
            />
          )}
        </div>

        {/* Sticky right-rail on xl+ — only when triage queue has entries */}
        {unassigned.length > 0 ? (
          <aside className="hidden min-w-0 gap-4 print:hidden xl:sticky xl:top-[5.5rem] xl:grid xl:self-start">
            {therapistOnly ? (
              <ClaimableTodayPanel bookings={unassigned.slice(0, 5)} />
            ) : (
              <UnassignedPanel
                bookings={unassigned.slice(0, 8)}
                totalCount={unassigned.length}
              />
            )}
          </aside>
        ) : null}
      </section>
    </div>
  );
}

// ─── Preset segment (Today / This week / This month) ────────────────────────

function PresetLink({
  href,
  label,
  active,
}: {
  href: string;
  label: string;
  active: boolean;
}) {
  return (
    <Link
      href={href}
      aria-current={active ? "page" : undefined}
      className={cn(
        "inline-flex h-11 min-h-[44px] items-center justify-center whitespace-nowrap rounded-[0.375rem] px-3 text-sm font-medium outline-none transition-colors focus-visible:ring-2 focus-visible:ring-[var(--admin-focus)]/55 sm:h-9 sm:min-h-0",
        active
          ? "bg-[var(--admin-primary)] text-[var(--admin-on-primary)] shadow-[0_1px_2px_oklch(23%_0.073_155_/_0.18)]"
          : "text-[var(--admin-body)] hover:bg-[var(--admin-panel)]"
      )}
    >
      {label}
    </Link>
  );
}

// ─── Print sheet header (only visible in print) ──────────────────────────────

function PrintHeader({ rangeLabel }: { rangeLabel: string }) {
  return (
    <div className="hidden print:block">
      <h2 className="font-display text-lg font-semibold text-[var(--admin-heading)]">
        Rahma Therapy — Operations sheet — {rangeLabel}
      </h2>
    </div>
  );
}

// ─── Week agenda (7 stacked per-date panels) ─────────────────────────────────

function WeekAgenda({
  dates,
  grouped,
  canSeePayment,
  therapistOnly,
  canCreate,
  today,
  baseParams,
  therapistsByBooking,
  showWeekStrip,
}: {
  dates: string[];
  grouped: Map<string, ReportBooking[]>;
  canSeePayment: boolean;
  therapistOnly: boolean;
  canCreate: boolean;
  today: string;
  baseParams: CalendarParams;
  therapistsByBooking: Map<string, string[]>;
  showWeekStrip: boolean;
}) {
  const hasAny = dates.some((d) => (grouped.get(d) ?? []).length > 0);

  return (
    <>
      {showWeekStrip ? (
        <WeekStrip
          dates={dates}
          grouped={grouped}
          today={today}
          baseParams={baseParams}
        />
      ) : null}
      {!hasAny ? (
        <CalendarEmptyState
          therapistOnly={therapistOnly}
          canCreate={canCreate}
          scope="week"
        />
      ) : null}
      {hasAny
        ? dates.map((date) => {
        const dayBookings = grouped.get(date) ?? [];
        if (dayBookings.length === 0) {
          return (
            <div
              key={date}
              data-redesign-needs-photo="/images/admin/empty-states/calendar-empty.svg"
              className="print:break-inside-avoid"
            >
              <EmptyState
                icon={CalendarCheck}
                title="All quiet — no bookings in this range."
                message="Quiet days are healthy days."
                compact
              />
            </div>
          );
        }
        return (
          <PerDatePanel
            key={date}
            date={date}
            bookings={dayBookings}
            canSeePayment={canSeePayment}
            therapistOnly={therapistOnly}
            therapistsByBooking={therapistsByBooking}
          />
        );
          })
        : null}
    </>
  );
}

// ─── Month grid (6×7 cells) ──────────────────────────────────────────────────

function MonthGrid({
  monthFirstISO,
  gridDates,
  grouped,
  today,
  baseParams,
  therapistOnly,
  canCreate,
}: {
  monthFirstISO: string;
  gridDates: string[];
  grouped: Map<string, ReportBooking[]>;
  today: string;
  baseParams: CalendarParams;
  therapistOnly: boolean;
  canCreate: boolean;
}) {
  const monthLabel = formatMonthLabel(monthFirstISO);
  const monthNum = Number(monthFirstISO.split("-")[1]);
  const monthTotal = gridDates.reduce((sum, d) => {
    const inMonth = Number(d.split("-")[1]) === monthNum;
    return inMonth ? sum + (grouped.get(d) ?? []).length : sum;
  }, 0);

  if (monthTotal === 0) {
    // Still render the grid so the operator sees the month shape, but lead
    // with the encouraging empty state above it.
    return (
      <div className="grid gap-4">
        <CalendarEmptyState
          therapistOnly={therapistOnly}
          canCreate={canCreate}
          scope="week"
        />
        <MonthGridShell
          monthLabel={monthLabel}
          monthNum={monthNum}
          gridDates={gridDates}
          grouped={grouped}
          today={today}
          baseParams={baseParams}
        />
      </div>
    );
  }

  return (
    <MonthGridShell
      monthLabel={monthLabel}
      monthNum={monthNum}
      gridDates={gridDates}
      grouped={grouped}
      today={today}
      baseParams={baseParams}
    />
  );
}

function MonthGridShell({
  monthLabel,
  monthNum,
  gridDates,
  grouped,
  today,
  baseParams,
}: {
  monthLabel: string;
  monthNum: number;
  gridDates: string[];
  grouped: Map<string, ReportBooking[]>;
  today: string;
  baseParams: CalendarParams;
}) {
  return (
    <AdminPanel
      title={monthLabel}
      className="print:break-inside-avoid"
    >
      {/* Weekday header row */}
      <div className="grid grid-cols-7 gap-1 border-b border-[var(--admin-border)] pb-2">
        {WEEKDAYS_MON_FIRST.map((d) => (
          <div
            key={d}
            className="text-center text-[0.6875rem] font-medium uppercase tracking-[0.04em] text-[var(--admin-text-muted)]"
          >
            {d}
          </div>
        ))}
      </div>

      {/* 6 × 7 grid */}
      <div className="mt-2 grid grid-cols-7 gap-1">
        {gridDates.map((date) => {
          const dayBookings = grouped.get(date) ?? [];
          const [, m, d] = date.split("-").map(Number);
          const inMonth = m === monthNum;
          const isToday = date === today;
          const dayNum = d ?? 0;
          const dayHref = buildHref(baseParams, { view: "day", date });
          const count = dayBookings.length;

          return (
            <Link
              key={date}
              href={dayHref}
              aria-label={`Open ${date} as day view (${count} booking${count === 1 ? "" : "s"})`}
              aria-current={isToday ? "date" : undefined}
              className={cn(
                "group relative flex min-h-[3.5rem] flex-col gap-1 rounded-[var(--admin-radius-control)] border p-1.5 outline-none transition-colors focus-visible:ring-2 focus-visible:ring-[var(--admin-focus)]/55 sm:min-h-[6rem] sm:p-2",
                isToday
                  ? "border-[var(--admin-primary)] bg-[var(--admin-hover-mist)]"
                  : inMonth
                    ? "border-[var(--admin-border)] bg-[var(--admin-panel)] hover:bg-[var(--admin-panel-muted)]"
                    : "border-[var(--admin-border)] bg-transparent text-[var(--admin-text-muted)] opacity-60 hover:opacity-100 hover:bg-[var(--admin-panel-muted)]"
              )}
            >
              <div className="flex items-start justify-between gap-1">
                <span
                  className={cn(
                    "leading-none tracking-[-0.02em]",
                    inMonth
                      ? "text-[var(--admin-heading)]"
                      : "text-[var(--admin-text-muted)]"
                  )}
                  style={{
                    fontFamily: inMonth
                      ? "var(--font-admin-serif), Georgia, serif"
                      : "inherit",
                    fontSize: inMonth ? "1.25rem" : "0.875rem",
                    fontWeight: inMonth ? 700 : 500,
                  }}
                >
                  {dayNum}
                </span>
                {count > 0 ? (
                  <span className="inline-flex h-5 min-w-[1.25rem] items-center justify-center rounded-full bg-[var(--admin-primary)] px-1.5 text-[0.625rem] font-semibold tabular-nums text-[var(--admin-on-primary)]">
                    {count}
                  </span>
                ) : null}
              </div>

              {/* Booking pills inside the cell — hidden on mobile (cells too
                  narrow to read truncated names; the count badge above is the
                  signal, tap drills to day view). Visible from sm: up. */}
              {count > 0 ? (
                <ol className="mt-auto hidden list-none gap-0.5 pl-0 sm:grid">
                  {dayBookings.slice(0, 2).map((b) => (
                    <li
                      key={b.id}
                      className="truncate rounded-[3px] bg-[var(--admin-status-confirmed-bg)] px-1 py-[1px] text-[0.625rem] font-medium text-[var(--admin-status-confirmed-text)]"
                      title={`${b.start_time.slice(0, 5)} ${b.contact_full_name ?? "Unknown"}`}
                    >
                      <span className="tabular-nums">
                        {b.start_time.slice(0, 5)}
                      </span>{" "}
                      {b.contact_full_name ?? "Unknown"}
                    </li>
                  ))}
                  {count > 2 ? (
                    <li className="text-[0.625rem] font-medium text-[var(--admin-text-muted)]">
                      +{count - 2} more
                    </li>
                  ) : null}
                </ol>
              ) : null}
            </Link>
          );
        })}
      </div>
    </AdminPanel>
  );
}

// ─── 7-day strip (week-view header) ──────────────────────────────────────────

function WeekStrip({
  dates,
  grouped,
  today,
  baseParams,
}: {
  dates: string[];
  grouped: Map<string, ReportBooking[]>;
  today: string;
  baseParams: CalendarParams;
}) {
  const weekdayFmt = new Intl.DateTimeFormat("en-GB", {
    weekday: "short",
    timeZone: "Europe/London",
  });
  const dayNumFmt = new Intl.DateTimeFormat("en-GB", {
    day: "numeric",
    timeZone: "Europe/London",
  });

  function parseAsUtcNoon(iso: string): Date {
    const [y, m, d] = iso.split("-").map(Number);
    return new Date(Date.UTC(y!, (m ?? 1) - 1, d ?? 1, 12));
  }

  return (
    <nav
      aria-label="Week at a glance"
      className="-mx-2 overflow-x-auto px-2 print:overflow-visible print:px-0"
    >
      <ol className="grid min-w-[42rem] list-none grid-cols-7 gap-2 pl-0 sm:min-w-0">
        {dates.map((date) => {
          const utcNoon = parseAsUtcNoon(date);
          const weekday = weekdayFmt.format(utcNoon);
          const dayNum = dayNumFmt.format(utcNoon);
          const count = (grouped.get(date) ?? []).length;
          const isToday = date === today;
          const href = buildHref(baseParams, { view: "day", date });
          return (
            <li key={date}>
              <Link
                href={href}
                aria-label={`Open ${weekday}, ${formatBusinessDate(date)} as day view (${count} booking${count === 1 ? "" : "s"})`}
                aria-current={isToday ? "date" : undefined}
                className={cn(
                  "flex flex-col items-center gap-0.5 rounded-[var(--admin-radius-control)] border px-1 py-2 text-center outline-none transition-colors focus-visible:ring-2 focus-visible:ring-[var(--admin-focus)]/55",
                  isToday
                    ? "border-[var(--admin-primary)] bg-[var(--admin-hover-mist)] text-[var(--admin-heading)]"
                    : "border-[var(--admin-border)] bg-[var(--admin-panel)] text-[var(--admin-body)] hover:bg-[var(--admin-panel-muted)]"
                )}
              >
                <span className="text-[0.6875rem] font-medium uppercase tracking-[0.04em] text-[var(--admin-text-muted)]">
                  {weekday}
                </span>
                <span
                  className="leading-none tracking-[-0.02em] text-[var(--admin-heading)]"
                  style={{
                    fontFamily: "var(--font-admin-serif), Georgia, serif",
                    fontSize: "1.5rem",
                    fontWeight: 700,
                  }}
                >
                  {dayNum}
                </span>
                {count > 0 ? (
                  <span className="text-[0.6875rem] tabular-nums text-[var(--admin-primary)]">
                    {count} booking{count === 1 ? "" : "s"}
                  </span>
                ) : (
                  <span className="text-[0.6875rem] text-[var(--admin-text-muted)]">
                    —
                  </span>
                )}
              </Link>
            </li>
          );
        })}
      </ol>
    </nav>
  );
}

// ─── Day agenda (with time-rail gutter) ──────────────────────────────────────

function DayAgenda({
  date,
  bookings,
  canSeePayment,
  therapistOnly,
  canCreate,
  therapistsByBooking,
}: {
  date: string;
  bookings: ReportBooking[];
  canSeePayment: boolean;
  therapistOnly: boolean;
  canCreate: boolean;
  therapistsByBooking: Map<string, string[]>;
}) {
  if (bookings.length === 0) {
    return (
      <CalendarEmptyState
        therapistOnly={therapistOnly}
        canCreate={canCreate}
        scope="day"
      />
    );
  }

  const concurrentGroups = detectConcurrentGroups(bookings);
  const concurrentIds = new Set<string>();
  for (const group of concurrentGroups) {
    for (const b of group.bookings) concurrentIds.add(b.id);
  }

  // Compute hourly tick range from bookings' span (07:00–21:00 default)
  const startHour = Math.min(
    7,
    ...bookings.map((b) => Number(b.start_time.slice(0, 2)) || 0)
  );
  const endHour = Math.max(
    21,
    ...bookings.map((b) => {
      const h = Number(b.end_time.slice(0, 2)) || 0;
      const m = Number(b.end_time.slice(3, 5)) || 0;
      return m > 0 ? h + 1 : h;
    })
  );
  const ticks: number[] = [];
  for (let h = startHour; h <= endHour; h += 1) ticks.push(h);

  const minutesPerHour = 60;
  // 56px per hour: 1 minute = 56/60 px
  const pxPerMinute = 56 / minutesPerHour;
  const totalHeight = (endHour - startHour) * 56;

  // Position cards by start_time; if two cards would overlap, stack the later
  // one below the earlier (no visual overlap per brief §5).
  const sortedBookings = bookings
    .slice()
    .sort((a, b) => (a.start_time < b.start_time ? -1 : 1));
  const CARD_GAP = 8;
  const MIN_CARD_HEIGHT = 140;
  const positioned: { booking: ReportBooking; top: number; height: number }[] =
    [];
  for (const booking of sortedBookings) {
    const startMins = timeToMinutes(booking.start_time) - startHour * 60;
    const endMins = timeToMinutes(booking.end_time) - startHour * 60;
    const naturalTop = Math.max(0, startMins * pxPerMinute);
    const height = Math.max(
      MIN_CARD_HEIGHT,
      (endMins - startMins) * pxPerMinute
    );
    const prev = positioned[positioned.length - 1];
    const top =
      prev && naturalTop < prev.top + prev.height + CARD_GAP
        ? prev.top + prev.height + CARD_GAP
        : naturalTop;
    positioned.push({ booking, top, height });
  }
  const stackHeight =
    positioned.length === 0
      ? totalHeight
      : Math.max(
          totalHeight,
          positioned[positioned.length - 1]!.top +
            positioned[positioned.length - 1]!.height +
            CARD_GAP
        );

  return (
    <AdminPanel
      title={formatBusinessDate(date)}
      badge={
        <span className="inline-flex items-center gap-1 rounded-full bg-[var(--admin-status-confirmed-bg)] px-2.5 py-0.5 text-xs font-medium text-[var(--admin-status-confirmed-text)]">
          {bookings.length} booking{bookings.length === 1 ? "" : "s"}
        </span>
      }
      className="print:break-inside-avoid"
    >
      <div className="grid gap-3">
        {concurrentGroups.length > 0 ? (
          <div
            role="status"
            aria-live="polite"
            className="flex items-start gap-2.5 rounded-[var(--admin-radius-control)] border border-[var(--admin-status-attention-border)] bg-[var(--admin-status-attention-bg)] px-3 py-2 text-sm text-[var(--admin-status-attention-text)]"
          >
            <CalendarClock className="mt-0.5 size-4 shrink-0" aria-hidden="true" />
            <span>
              {concurrentGroups
                .map(
                  (g) =>
                    `${g.bookings.length === 2 ? "Two" : g.bookings.length} bookings overlap at ${g.time}.`
                )
                .join(" ")}
            </span>
          </div>
        ) : null}

        <div className="flex">
          {/* Hourly tick gutter */}
          <div
            aria-hidden="true"
            className="relative w-14 shrink-0 border-r border-[var(--admin-border)] text-[0.6875rem] font-medium text-[var(--admin-text-muted)] print:hidden"
            style={{ height: `${stackHeight}px` }}
          >
            {ticks.map((h, idx) => (
              <span
                key={h}
                className="absolute right-2 -translate-y-1/2 tabular-nums"
                style={{ top: `${(h - startHour) * 56}px` }}
              >
                {idx === ticks.length - 1
                  ? ""
                  : `${String(h).padStart(2, "0")}:00`}
              </span>
            ))}
          </div>

          {/* Card column — positioned by start_time on lg+, stacked on mobile */}
          <div className="min-w-0 flex-1 pl-3">
            {/* Mobile + print: simple stack */}
            <ol className="grid list-none gap-3 pl-0 lg:hidden print:grid">
              {positioned.map(({ booking }) => (
                <li key={booking.id} className="print:break-inside-avoid">
                  <CalendarBookingRow
                    booking={booking}
                    canSeePayment={canSeePayment}
                    concurrent={concurrentIds.has(booking.id)}
                    therapists={therapistsByBooking.get(booking.id) ?? []}
                  />
                </li>
              ))}
            </ol>

            {/* Desktop: absolutely positioned against the gutter */}
            <ol
              className="relative hidden list-none pl-0 lg:block print:hidden"
              style={{ height: `${stackHeight}px` }}
            >
              {/* Hourly tick rules */}
              {ticks.slice(0, -1).map((h) => (
                <span
                  key={h}
                  aria-hidden="true"
                  className="pointer-events-none absolute inset-x-0 border-t border-[var(--admin-border)]"
                  style={{ top: `${(h - startHour) * 56}px` }}
                />
              ))}
              {positioned.map(({ booking, top, height }) => (
                <li
                  key={booking.id}
                  className="absolute inset-x-0"
                  style={{ top: `${top}px`, minHeight: `${height}px` }}
                >
                  <CalendarBookingRow
                    booking={booking}
                    canSeePayment={canSeePayment}
                    concurrent={concurrentIds.has(booking.id)}
                    therapists={therapistsByBooking.get(booking.id) ?? []}
                  />
                </li>
              ))}
            </ol>
          </div>
        </div>
      </div>
    </AdminPanel>
  );
}

function PerDatePanel({
  date,
  bookings,
  canSeePayment,
  therapistsByBooking,
}: {
  date: string;
  bookings: ReportBooking[];
  canSeePayment: boolean;
  therapistOnly: boolean;
  therapistsByBooking: Map<string, string[]>;
}) {
  const concurrentGroups = detectConcurrentGroups(bookings);
  const concurrentIds = new Set<string>();
  for (const group of concurrentGroups) {
    for (const b of group.bookings) concurrentIds.add(b.id);
  }

  return (
    <AdminPanel
      title={formatBusinessDate(date)}
      badge={
        <span className="inline-flex items-center gap-1 rounded-full bg-[var(--admin-status-confirmed-bg)] px-2.5 py-0.5 text-xs font-medium text-[var(--admin-status-confirmed-text)]">
          {bookings.length} booking{bookings.length === 1 ? "" : "s"}
        </span>
      }
      className="print:break-inside-avoid"
    >
      <div className="grid gap-3">
        {concurrentGroups.length > 0 ? (
          <div
            role="status"
            aria-live="polite"
            className="flex items-start gap-2.5 rounded-[var(--admin-radius-control)] border border-[var(--admin-status-attention-border)] bg-[var(--admin-status-attention-bg)] px-3 py-2 text-sm text-[var(--admin-status-attention-text)]"
          >
            <CalendarClock className="mt-0.5 size-4 shrink-0" aria-hidden="true" />
            <span>
              {concurrentGroups
                .map(
                  (g) =>
                    `${g.bookings.length === 2 ? "Two" : g.bookings.length} bookings overlap at ${g.time}.`
                )
                .join(" ")}
            </span>
          </div>
        ) : null}
        <ol className="grid list-none gap-3 pl-0">
          {bookings
            .slice()
            .sort((a, b) => (a.start_time < b.start_time ? -1 : 1))
            .map((booking) => (
              <li key={booking.id} className="print:break-inside-avoid">
                <CalendarBookingRow
                  booking={booking}
                  canSeePayment={canSeePayment}
                  concurrent={concurrentIds.has(booking.id)}
                  therapists={therapistsByBooking.get(booking.id) ?? []}
                />
              </li>
            ))}
        </ol>
      </div>
    </AdminPanel>
  );
}

// ─── Card (visual chrome mirrors bookings/page.tsx BookingListCard) ─────────

function CalendarBookingRow({
  booking,
  canSeePayment,
  concurrent,
  therapists,
}: {
  booking: ReportBooking;
  canSeePayment: boolean;
  concurrent: boolean;
  therapists: string[];
}) {
  const clientName = booking.contact_full_name || "Unknown client";
  const startTime = booking.start_time.slice(0, 5);
  const endTime = booking.end_time.slice(0, 5);
  const time = `${startTime}–${endTime}`;
  const locationParts = [booking.service_city, booking.service_postcode].filter(
    Boolean
  );
  const locationLabel = locationParts.join(" ");
  const addressOneLine = [
    booking.service_address_line1,
    booking.service_city,
    booking.service_postcode,
  ]
    .filter(Boolean)
    .join(", ");
  const therapistLabel =
    therapists.length === 0
      ? "No therapist assigned"
      : therapists.length === 1
        ? therapists[0]!
        : `${therapists[0]} +${therapists.length - 1}`;
  const accessibleName = `${clientName}, ${time}${locationLabel ? `, ${locationLabel}` : ""}, ${formatLabel(booking.status)}, ${therapistLabel}`;

  return (
    <Link
      href={`/admin/bookings/${booking.id}`}
      aria-label={accessibleName}
      className="group block rounded-[var(--admin-radius-card)] outline-none focus-visible:ring-2 focus-visible:ring-[var(--admin-focus)]/55"
    >
      <article className="grid grid-cols-[4.25rem_minmax(0,1fr)] gap-3 rounded-[var(--admin-radius-card)] border border-[var(--admin-border)] bg-[var(--admin-panel)] p-4 transition-shadow duration-200 ease-[cubic-bezier(0.25,1,0.5,1)] group-hover:shadow-[0_2px_8px_oklch(23%_0.073_155_/_0.08)] sm:grid-cols-[4.75rem_minmax(0,1fr)_auto] sm:p-5 print:border print:border-[oklch(42%_0.025_80)] print:shadow-none">
        {/* Time block (left column) */}
        <div className="flex flex-col items-start border-r border-[var(--admin-border)] pr-3">
          <span
            className="leading-none tracking-[-0.02em] text-[var(--admin-heading)]"
            style={{
              fontFamily: "var(--font-admin-serif), Georgia, serif",
              fontSize: "1.625rem",
              fontWeight: 700,
            }}
          >
            {startTime}
          </span>
          <span className="mt-1 text-[0.6875rem] font-medium uppercase tracking-[0.04em] text-[var(--admin-text-muted)]">
            to {endTime}
          </span>
        </div>

        {/* Content (middle column) */}
        <div className="min-w-0">
          <p className="font-display text-base font-semibold tracking-[-0.01em] text-[var(--admin-heading)] break-words sm:text-[1.0625rem]">
            {clientName}
          </p>
          {locationLabel || booking.service_address_line1 ? (
            <p className="mt-0.5 text-sm text-[var(--admin-text-muted)] break-words">
              {booking.service_address_line1 ? (
                <>{booking.service_address_line1}</>
              ) : null}
              {booking.service_address_line1 && locationLabel ? " · " : null}
              {locationLabel}
            </p>
          ) : null}

          {/* Therapist line (mobile + tablet) */}
          <div className="mt-2 flex items-center gap-2 sm:hidden">
            <AvatarStack names={therapists} />
            <span className="min-w-0 truncate text-xs text-[var(--admin-body)]">
              {therapistLabel}
            </span>
          </div>

          {/* Status: ONE named badge + icon-only modifiers (icons announce
              non-default state to screen readers via sr-only). Card stays calm. */}
          <div className="mt-2 flex flex-wrap items-center gap-1.5">
            <AdminStatusBadge
              value={formatLabel(booking.status)}
              tone={statusTone(booking.status)}
            />
            {booking.assignment_status === "unassigned" ||
            booking.assignment_status === "partially_assigned" ? (
              <ModifierIcon
                title={
                  booking.assignment_status === "unassigned"
                    ? "Unassigned"
                    : "Partially assigned"
                }
                icon={AlertCircle}
                tone="warning"
              />
            ) : null}
            {concurrent ? (
              <ModifierIcon
                title={`Overlaps with another booking at ${startTime}`}
                icon={CalendarClock}
                tone="warning"
                label="Concurrent"
              />
            ) : null}
            {booking.reschedule_status === "requested" ? (
              <ModifierIcon
                title="Reschedule requested by the client"
                icon={CalendarClock}
                tone="warning"
                label="Reschedule requested"
              />
            ) : null}
            {booking.customer_cancelled_at ? (
              <ModifierIcon
                title="Client cancelled this booking"
                icon={UserX}
                tone="danger"
                label="Client cancelled"
              />
            ) : null}
            {canSeePayment && booking.payment_status === "unpaid" ? (
              <ModifierIcon
                title="Unpaid"
                icon={AlertCircle}
                tone="warning"
              />
            ) : null}
            {canSeePayment && booking.payment_status === "paid" ? (
              <ModifierIcon
                title="Paid"
                icon={CheckCircle2}
                tone="success"
              />
            ) : null}
          </div>

          {/* Print-only address microformat: one-line, copy-paste into Maps */}
          {addressOneLine ? (
            <address className="mt-2 hidden text-xs not-italic text-[var(--admin-heading)] print:block">
              <span className="font-medium">Map: </span>
              <span className="font-mono">{addressOneLine}</span>
            </address>
          ) : null}
        </div>

        {/* Therapist column (desktop only) */}
        <div className="hidden min-w-[7rem] max-w-[10rem] flex-col items-end gap-1 sm:flex">
          <AvatarStack names={therapists} />
          <span className="truncate text-right text-xs text-[var(--admin-body)]">
            {therapistLabel}
          </span>
        </div>
      </article>
    </Link>
  );
}

function ModifierIcon({
  title,
  icon: Icon,
  tone,
  label,
}: {
  title: string;
  icon: React.ElementType;
  tone: "warning" | "success" | "danger";
  /** When provided, renders a labelled pill (icon + non-breaking space + text)
   *  per DESIGN.md §5 Named Status Rule. When omitted, renders the compact
   *  icon-only disc with sr-only text. */
  label?: string;
}) {
  const bg =
    tone === "success"
      ? "bg-[var(--admin-status-confirmed-bg)] text-[var(--admin-status-confirmed-text)]"
      : tone === "danger"
        ? "bg-[var(--admin-status-cancelled-bg)] text-[var(--admin-status-cancelled-text)]"
        : "bg-[var(--admin-status-attention-bg)] text-[var(--admin-status-attention-text)]";
  if (label) {
    return (
      <span
        title={title}
        className={`inline-flex items-center gap-1 rounded-full px-2 py-0.5 text-[0.75rem] font-medium ${bg} print:border print:border-[oklch(42%_0.025_80)] print:bg-transparent`}
      >
        <Icon className="size-3.5 shrink-0" aria-hidden="true" />
        <span>{" "}{label}</span>
      </span>
    );
  }
  return (
    <span
      title={title}
      className={`inline-flex size-6 items-center justify-center rounded-full ${bg} print:border print:border-[oklch(42%_0.025_80)] print:bg-transparent`}
    >
      <Icon className="size-3.5" aria-hidden="true" />
      <span className="sr-only">{title}</span>
    </span>
  );
}

function AvatarStack({ names }: { names: string[] }) {
  if (names.length === 0) {
    return (
      <span
        aria-hidden="true"
        className="inline-flex size-7 items-center justify-center rounded-full border border-[var(--admin-border)] text-[0.625rem] font-medium text-[var(--admin-text-muted)]"
      >
        ?
      </span>
    );
  }
  const visible = names.slice(0, 3);
  return (
    <span className="inline-flex -space-x-1.5" aria-hidden="true">
      {visible.map((name) => (
        <span
          key={name}
          title={name}
          className="inline-flex size-7 items-center justify-center rounded-full border-2 border-[var(--admin-panel)] bg-[var(--admin-hover-mist)] text-[0.625rem] font-semibold text-[var(--admin-heading)]"
        >
          {initials(name)}
        </span>
      ))}
    </span>
  );
}

// ─── Sidebars ────────────────────────────────────────────────────────────────

/**
 * Collapsible Attention-tinted version of the sidebar, rendered above the
 * agenda on viewports below `xl` (brief §3 — the sticky right-rail only
 * appears at xl+; below that the triage queue stacks above the day list under
 * a disclosure so it stays at-a-glance on tablet and mobile).
 */
function SidebarDisclosure({
  therapistOnly,
  unassigned,
}: {
  therapistOnly: boolean;
  unassigned: ReportBooking[];
}) {
  if (therapistOnly) {
    const bookings = unassigned.slice(0, 5);
    const count = bookings.length;
    return (
      <details className="group rounded-[var(--admin-radius-card)] border border-[var(--admin-status-attention-border)] bg-[var(--admin-status-attention-bg)] text-[var(--admin-status-attention-text)] print:hidden xl:hidden">
        <summary className="flex cursor-pointer list-none items-center justify-between gap-3 px-4 py-3 text-sm font-medium outline-none transition-colors hover:bg-[oklch(92%_0.06_65)] focus-visible:ring-2 focus-visible:ring-[var(--admin-focus)]/55">
          <span className="flex items-center gap-2">
            <CalendarClock className="size-4" aria-hidden="true" />
            <span>Claimable today</span>
            <span className="inline-flex items-center justify-center rounded-full bg-white/70 px-1.5 text-[0.6875rem] font-semibold tabular-nums">
              {count}
            </span>
          </span>
          <span className="text-[0.6875rem] text-[oklch(30%_0.14_55)] group-open:hidden">
            Tap to expand
          </span>
          <span className="hidden text-[0.6875rem] text-[oklch(30%_0.14_55)] group-open:inline">
            Tap to collapse
          </span>
        </summary>
        <div className="border-t border-[var(--admin-status-attention-border)] bg-[var(--admin-panel)] p-3">
          {count === 0 ? (
            <p className="text-sm text-[var(--admin-text-muted)]">
              No claimable visits match your profile right now.
            </p>
          ) : (
            <ol className="grid list-none gap-2 pl-0">
              {bookings.map((booking) => (
                <li key={booking.id}>
                  <SidebarRow booking={booking} cta="Open →" />
                </li>
              ))}
              <li>
                <Link
                  href="/admin/bookings?view=claimable"
                  className="inline-flex h-9 items-center text-sm font-medium text-[var(--admin-primary)] outline-none transition-colors hover:underline focus-visible:ring-2 focus-visible:ring-[var(--admin-focus)]/55"
                >
                  Browse all claimable →
                </Link>
              </li>
            </ol>
          )}
        </div>
      </details>
    );
  }

  const bookings = unassigned.slice(0, 8);
  const total = unassigned.length;
  return (
    <details className="group rounded-[var(--admin-radius-card)] border border-[var(--admin-status-attention-border)] bg-[var(--admin-status-attention-bg)] text-[var(--admin-status-attention-text)] print:hidden xl:hidden">
      <summary className="flex cursor-pointer list-none items-center justify-between gap-3 px-4 py-3 text-sm font-medium outline-none transition-colors hover:bg-[oklch(92%_0.06_65)] focus-visible:ring-2 focus-visible:ring-[var(--admin-focus)]/55">
        <span className="flex items-center gap-2">
          <CalendarClock className="size-4" aria-hidden="true" />
          <span>Unassigned</span>
          <span className="inline-flex items-center justify-center rounded-full bg-white/70 px-1.5 text-[0.6875rem] font-semibold tabular-nums">
            {total}
          </span>
        </span>
        <span className="text-[0.6875rem] text-[oklch(30%_0.14_55)] group-open:hidden">
          Tap to expand
        </span>
        <span className="hidden text-[0.6875rem] text-[oklch(30%_0.14_55)] group-open:inline">
          Tap to collapse
        </span>
      </summary>
      <div className="border-t border-[var(--admin-status-attention-border)] bg-[var(--admin-panel)] p-3">
        {total === 0 ? (
          <p className="text-sm leading-6 text-[var(--admin-text-muted)]">
            Every visit has a therapist.
          </p>
        ) : (
          <ol className="grid list-none gap-2 pl-0">
            {bookings.map((booking) => (
              <li key={booking.id}>
                <SidebarRow
                  booking={booking}
                  cta="Assign →"
                  focusAssignment
                />
              </li>
            ))}
            {total > bookings.length ? (
              <li>
                <Link
                  href="/admin/bookings?view=claimable"
                  className="inline-flex h-9 items-center text-sm font-medium text-[var(--admin-primary)] outline-none transition-colors hover:underline focus-visible:ring-2 focus-visible:ring-[var(--admin-focus)]/55"
                >
                  See all {total} →
                </Link>
              </li>
            ) : null}
          </ol>
        )}
      </div>
    </details>
  );
}

function UnassignedPanel({
  bookings,
  totalCount,
}: {
  bookings: ReportBooking[];
  totalCount: number;
}) {
  return (
    <AdminPanel
      title="Unassigned"
      badge={
        <span className="inline-flex items-center gap-1 rounded-full bg-[var(--admin-status-attention-bg)] px-2.5 py-0.5 text-xs font-medium text-[var(--admin-status-attention-text)]">
          {totalCount}
        </span>
      }
    >
      {bookings.length === 0 ? (
        <p className="text-sm leading-6 text-[var(--admin-text-muted)]">
          Every visit has a therapist.
        </p>
      ) : (
        <ol className="grid list-none gap-2 pl-0">
          {bookings.map((booking) => (
            <li key={booking.id}>
              <SidebarRow booking={booking} cta="Assign →" focusAssignment />
            </li>
          ))}
          {totalCount > bookings.length ? (
            <li>
              <Link
                href="/admin/bookings?view=claimable"
                className="inline-flex h-9 items-center text-sm font-medium text-[var(--admin-primary)] outline-none transition-colors hover:underline focus-visible:ring-2 focus-visible:ring-[var(--admin-focus)]/55"
              >
                See all {totalCount} →
              </Link>
            </li>
          ) : null}
        </ol>
      )}
    </AdminPanel>
  );
}

function ClaimableTodayPanel({ bookings }: { bookings: ReportBooking[] }) {
  return (
    <AdminPanel
      title="Claimable today"
      badge={
        <span className="inline-flex items-center gap-1 rounded-full bg-[var(--admin-status-attention-bg)] px-2.5 py-0.5 text-xs font-medium text-[var(--admin-status-attention-text)]">
          {bookings.length}
        </span>
      }
    >
      {bookings.length === 0 ? (
        <p className="text-sm leading-6 text-[var(--admin-text-muted)]">
          No claimable visits match your profile right now.
        </p>
      ) : (
        <ol className="grid list-none gap-2 pl-0">
          {bookings.map((booking) => (
            <li key={booking.id}>
              <SidebarRow booking={booking} cta="Open →" />
            </li>
          ))}
          <li>
            <Link
              href="/admin/bookings?view=claimable"
              className="inline-flex h-9 items-center text-sm font-medium text-[var(--admin-primary)] outline-none transition-colors hover:underline focus-visible:ring-2 focus-visible:ring-[var(--admin-focus)]/55"
            >
              Browse all claimable →
            </Link>
          </li>
        </ol>
      )}
    </AdminPanel>
  );
}

function SidebarRow({
  booking,
  cta,
  focusAssignment = false,
}: {
  booking: ReportBooking;
  cta: string;
  focusAssignment?: boolean;
}) {
  const clientName = booking.contact_full_name || "Unknown client";
  const time = `${booking.start_time.slice(0, 5)}–${booking.end_time.slice(0, 5)}`;
  const cityLabel = [booking.service_city, booking.service_postcode]
    .filter(Boolean)
    .join(" ");
  const href = focusAssignment
    ? `/admin/bookings/${booking.id}?focus=assignment`
    : `/admin/bookings/${booking.id}`;
  const accessibleName = focusAssignment
    ? `Assign a therapist to ${clientName}, ${formatBusinessDate(booking.booking_date)} at ${time}`
    : `Open ${clientName}, ${formatBusinessDate(booking.booking_date)} at ${time}`;
  const tooltip = focusAssignment
    ? "Assign a therapist to this booking"
    : undefined;

  return (
    <Link
      href={href}
      aria-label={accessibleName}
      title={tooltip}
      className="grid gap-1 rounded-[var(--admin-radius-control)] border border-[var(--admin-border)] bg-[var(--admin-panel)] p-3 outline-none transition-colors hover:bg-[var(--admin-panel-muted)] focus-visible:ring-2 focus-visible:ring-[var(--admin-focus)]/55"
    >
      <div className="flex items-center gap-2">
        <span
          aria-hidden="true"
          title={clientName}
          className="inline-flex size-8 shrink-0 items-center justify-center rounded-full bg-[var(--admin-hover-mist)] text-xs font-semibold text-[var(--admin-heading)]"
        >
          {initials(clientName)}
        </span>
        <p className="min-w-0 flex-1 truncate text-sm font-medium text-[var(--admin-heading)]">
          {clientName}
        </p>
      </div>
      <p className="text-xs text-[var(--admin-text-muted)]">
        {formatBusinessDate(booking.booking_date)} · <span className="tabular-nums">{time}</span>
        {cityLabel ? ` · ${cityLabel}` : ""}
      </p>
      <p className="text-xs font-medium text-[var(--admin-primary)]">{cta}</p>
    </Link>
  );
}

// ─── Empty state + denied ────────────────────────────────────────────────────

function CalendarEmptyState({
  therapistOnly,
  canCreate,
  scope,
}: {
  therapistOnly: boolean;
  canCreate: boolean;
  scope: "day" | "week";
}) {
  if (therapistOnly) {
    return (
      <EmptyState
        icon={CalendarCheck}
        title={scope === "week" ? "Nothing booked this week" : "Nothing booked"}
        message="No visits in this range."
      />
    );
  }
  return (
    <div data-redesign-needs-photo="/images/admin/empty-states/calendar-empty.svg">
      <EmptyState
        icon={CalendarCheck}
        title="All quiet"
        message={
          scope === "week"
            ? "No bookings this week."
            : "No bookings in this range. Quiet days are healthy days."
        }
        action={
          canCreate
            ? { label: "Create a booking", href: "/admin/bookings/new" }
            : undefined
        }
      />
    </div>
  );
}

function CalendarAccessDenied() {
  return (
    <AdminAccessDenied
      title="Calendar access limited"
      message="You need booking visibility to view the operations calendar. Ask the practice owner to enable it."
    />
  );
}

// ─── helpers ─────────────────────────────────────────────────────────────────

function groupByDate(bookings: ReportBooking[]) {
  const groups = new Map<string, ReportBooking[]>();
  for (const booking of bookings) {
    const list = groups.get(booking.booking_date) ?? [];
    list.push(booking);
    groups.set(booking.booking_date, list);
  }
  return groups;
}

function buildWeekDates(startISO: string): string[] {
  return Array.from({ length: 7 }, (_, idx) =>
    idx === 0 ? startISO : addBusinessDays(startISO, idx)
  );
}

function timeToMinutes(time: string): number {
  const [h, m] = time.split(":").map(Number);
  return (h || 0) * 60 + (m || 0);
}

interface ConcurrentGroup {
  time: string;
  bookings: ReportBooking[];
}

function detectConcurrentGroups(bookings: ReportBooking[]): ConcurrentGroup[] {
  const groups: ConcurrentGroup[] = [];
  const sorted = bookings
    .slice()
    .sort((a, b) => (a.start_time < b.start_time ? -1 : 1));
  for (let i = 0; i < sorted.length; i += 1) {
    const a = sorted[i];
    const aStart = timeToMinutes(a.start_time);
    const aEnd = timeToMinutes(a.end_time);
    const overlapping: ReportBooking[] = [a];
    for (let j = i + 1; j < sorted.length; j += 1) {
      const b = sorted[j];
      const bStart = timeToMinutes(b.start_time);
      const bEnd = timeToMinutes(b.end_time);
      if (bStart < aEnd && bEnd > aStart) {
        overlapping.push(b);
      }
    }
    if (overlapping.length > 1) {
      const time = a.start_time.slice(0, 5);
      const already = groups.find((g) => g.time === time);
      if (!already) {
        groups.push({ time, bookings: overlapping });
      }
    }
  }
  return groups;
}

function statusTone(status: string) {
  switch (status) {
    case "pending":
      return "info" as const;
    case "confirmed":
      return "success" as const;
    case "completed":
      return "success" as const;
    case "cancelled":
    case "no_show":
      return "danger" as const;
    default:
      return "muted" as const;
  }
}

function initials(name: string): string {
  const parts = name.trim().split(/\s+/).filter(Boolean);
  if (parts.length === 0) return "?";
  if (parts.length === 1) return parts[0]!.slice(0, 2).toUpperCase();
  return `${parts[0]![0]!}${parts[parts.length - 1]![0]!}`.toUpperCase();
}
