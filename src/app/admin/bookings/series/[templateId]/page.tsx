import type { Metadata } from "next";
import Link from "next/link";
import { redirect } from "next/navigation";
import { ArrowLeft, CalendarX, MapPin, Repeat, ShieldAlert, Users } from "lucide-react";
import {
  AdminAccessDenied,
  AdminPageHeader,
  AdminPageScaffold,
  AdminPanel,
  AdminStatusBadge,
  type AdminTone,
} from "../../../components/admin-ui";
import { EmptyState } from "../../../components/EmptyState";
import { createSupabaseAdminClient } from "@/lib/supabase/admin";
import { createSupabaseServerClient } from "@/lib/supabase/server";
import {
  canManageAllBookings,
  canViewAllBookings,
  getStaffProfile,
} from "@/lib/auth/rbac";
import { getClientDataAccess } from "@/app/admin/clients/access";
import { getTodayIsoDate } from "../../_helpers";
import { formatDate, formatLabel, formatTime } from "../../format";
import type { BookingStatus } from "../../types";
import { SeriesActions } from "./SeriesActions";
import { SeriesTravelChargeForm } from "./SeriesTravelChargeForm";

/**
 * C-02 Phase F, Step 16 — the series view (brief §4.2). Server component;
 * mirrors `[bookingId]/page.tsx`'s auth-gate ordering exactly (protocol rule
 * 11 / F4): `createSupabaseServerClient()` -> `getStaffProfile()` -> the
 * permission check -> only then `createSupabaseAdminClient()`.
 *
 * Series-level RBAC is narrower than the individual booking detail page's:
 * per plan §9 open-question 6 / this phase's brief, only actors with
 * `canManageAllBookings` or `canViewAllBookings` may open a series. A
 * Therapist who is the series' own bound therapist still sees only their
 * individual assigned bookings, never the series-level rollup.
 */

const DEFAULT_SERIES_METADATA: Metadata = {
  title: "Recurring series - Rahma Therapy Admin",
};

interface SeriesPageProps {
  params: Promise<{ templateId: string }>;
}

const TEMPLATE_SELECT = `
  id,
  travel_fee,
  client_id,
  service_id,
  bound_therapist_id,
  open_to_any_therapist,
  anchor_start_time,
  total_duration_mins,
  participant_gender,
  required_therapist_gender,
  cadence,
  end_type,
  end_count,
  end_date,
  service_address_line1,
  service_postcode,
  service_city,
  service_area,
  cancelled_at,
  cancelled_reason,
  horizon_through_date,
  notes,
  services(name)
`;

interface RecurringTemplateRow {
  id: string;
  /** Item 8 Phase 4 — the standing travel charge applied to every occurrence. */
  travel_fee: number | string | null;
  client_id: string;
  service_id: string;
  bound_therapist_id: string | null;
  open_to_any_therapist: boolean;
  anchor_start_time: string;
  total_duration_mins: number;
  participant_gender: "male" | "female";
  required_therapist_gender: "male" | "female";
  cadence: "weekly" | "fortnightly" | "monthly";
  end_type: "until_cancelled" | "after_count" | "until_date";
  end_count: number | null;
  end_date: string | null;
  service_address_line1: string | null;
  service_postcode: string | null;
  service_city: string | null;
  service_area: string | null;
  cancelled_at: string | null;
  cancelled_reason: string | null;
  horizon_through_date: string;
  notes: string | null;
  services: { name: string } | null;
}

interface SeriesVisitRow {
  id: string;
  booking_date: string;
  start_time: string;
  status: BookingStatus;
  booking_assignments: Array<{
    assigned_staff_id: string | null;
    status: string;
    staff_profiles: { name: string } | null;
  }>;
}

const VISIT_SELECT = `
  id,
  booking_date,
  start_time,
  status,
  booking_assignments(assigned_staff_id, status, staff_profiles(name))
`;

const CADENCE_LABELS: Record<RecurringTemplateRow["cadence"], string> = {
  weekly: "Weekly",
  fortnightly: "Fortnightly",
  monthly: "Monthly",
};

const STATUS_TONES: Record<BookingStatus, AdminTone> = {
  pending: "info",
  confirmed: "success",
  completed: "default",
  cancelled: "danger",
  no_show: "warning",
};

const STATUS_LABELS: Record<BookingStatus, string> = {
  pending: "Pending",
  confirmed: "Confirmed",
  completed: "Completed",
  cancelled: "Cancelled",
  no_show: "No-show",
};

async function canOpenSeriesView(
  supabase: Awaited<ReturnType<typeof createSupabaseServerClient>>
) {
  const profile = await getStaffProfile(supabase);
  if (!profile || !profile.active) return { profile: null, canOpen: false };
  return {
    profile,
    canOpen: canManageAllBookings(profile) || canViewAllBookings(profile),
  };
}

export async function generateMetadata({
  params,
}: SeriesPageProps): Promise<Metadata> {
  const { templateId } = await params;
  const supabase = await createSupabaseServerClient();
  const { canOpen } = await canOpenSeriesView(supabase);
  if (!canOpen) return DEFAULT_SERIES_METADATA;

  const adminClient = createSupabaseAdminClient();
  const { data: template } = await adminClient
    .from("recurring_booking_templates")
    .select("services(name)")
    .eq("id", templateId)
    .maybeSingle<{ services: { name: string } | null }>();

  if (!template) return DEFAULT_SERIES_METADATA;

  const serviceName = template.services?.name ?? "Recurring series";
  return { title: `${serviceName} - Recurring series - Rahma Therapy Admin` };
}

function formatEndCondition(template: RecurringTemplateRow): string {
  if (template.end_type === "until_cancelled") return "Until cancelled";
  if (template.end_type === "after_count") {
    const count = template.end_count ?? 0;
    return `After ${count} visit${count === 1 ? "" : "s"}`;
  }
  if (template.end_type === "until_date" && template.end_date) {
    return `Until ${formatDate(template.end_date)}`;
  }
  return "—";
}

function formatAddress(template: RecurringTemplateRow): string | null {
  const lines = [
    template.service_address_line1,
    template.service_city,
    template.service_postcode,
    template.service_area,
  ].filter((line): line is string => Boolean(line));
  return lines.length > 0 ? lines.join(", ") : null;
}

export default async function SeriesViewPage({ params }: SeriesPageProps) {
  const { templateId } = await params;
  const supabase = await createSupabaseServerClient();
  const { profile, canOpen } = await canOpenSeriesView(supabase);

  if (!profile) {
    redirect("/admin/login");
  }

  if (!canOpen) {
    return <SeriesAccessDenied />;
  }

  const adminClient = createSupabaseAdminClient();

  const { data: template } = await adminClient
    .from("recurring_booking_templates")
    .select(TEMPLATE_SELECT)
    .eq("id", templateId)
    .maybeSingle<RecurringTemplateRow>();

  if (!template) {
    return <SeriesNotFound />;
  }

  const today = getTodayIsoDate();

  // Bounded queries only (C-16 coordination, brief §4.2) — an `until_cancelled`
  // weekly series accrues ~52 visits/year and ~260 over five years, so this
  // page never fetches the full history. Next 10 upcoming, last 5 past, plus
  // three cheap `count: "exact", head: true` queries for the section headers
  // and the "View all" link total. C-16's shared `PaginationBar` does not
  // exist yet (confirmed before writing this), so these hard caps are the
  // floor, not a placeholder for it.
  const [
    { data: upcomingRaw },
    { data: pastRaw },
    { count: upcomingCount },
    { count: pastCount },
    { data: firstVisit },
    boundTherapistResult,
    clientRow,
  ] = await Promise.all([
    adminClient
      .from("bookings")
      .select(VISIT_SELECT)
      .eq("recurring_template_id", templateId)
      .gte("booking_date", today)
      .order("booking_date", { ascending: true })
      .limit(10)
      .returns<SeriesVisitRow[]>(),
    adminClient
      .from("bookings")
      .select(VISIT_SELECT)
      .eq("recurring_template_id", templateId)
      .lt("booking_date", today)
      .order("booking_date", { ascending: false })
      .limit(5)
      .returns<SeriesVisitRow[]>(),
    adminClient
      .from("bookings")
      .select("id", { count: "exact", head: true })
      .eq("recurring_template_id", templateId)
      .gte("booking_date", today),
    adminClient
      .from("bookings")
      .select("id", { count: "exact", head: true })
      .eq("recurring_template_id", templateId)
      .lt("booking_date", today),
    adminClient
      .from("bookings")
      .select("booking_date")
      .eq("recurring_template_id", templateId)
      .order("booking_date", { ascending: true })
      .limit(1)
      .maybeSingle<{ booking_date: string }>(),
    template.bound_therapist_id
      ? adminClient
          .from("staff_profiles")
          .select("id, name, active")
          .eq("id", template.bound_therapist_id)
          .maybeSingle<{ id: string; name: string; active: boolean }>()
      : Promise.resolve({ data: null }),
    (() => {
      const clientAccess = getClientDataAccess(profile, {
        hasAssignedBooking: false,
      });
      return clientAccess.canViewClient
        ? adminClient
            .from("clients")
            .select("id, full_name")
            .eq("id", template.client_id)
            .maybeSingle<{ id: string; full_name: string }>()
            .then((result) => ({ canViewClient: true, client: result.data }))
        : Promise.resolve({ canViewClient: false, client: null });
    })(),
  ]);

  const upcoming = upcomingRaw ?? [];
  const past = pastRaw ?? [];
  const totalCount = (upcomingCount ?? 0) + (pastCount ?? 0);
  const boundTherapist = boundTherapistResult.data;
  const isCancelled = Boolean(template.cancelled_at);

  const cadenceLabel = CADENCE_LABELS[template.cadence] ?? formatLabel(template.cadence);
  const therapistLabel = boundTherapist
    ? `Locked to ${boundTherapist.name}${boundTherapist.active ? "" : " (inactive)"}`
    : "Open to any available therapist";
  const endLabel = formatEndCondition(template);
  const summaryLine = `${cadenceLabel} · ${therapistLabel} · ${endLabel}`;
  const addressLine = formatAddress(template);
  const serviceName = template.services?.name ?? "Service";

  // C-02 Phase F — Phase H (plan Step 23) has not shipped the "Series" filter
  // chip on `/admin/bookings` yet, and that chip is a global recurring-only
  // toggle (brief §4.5), not scoped to one template. This link anticipates
  // the query shape Phase H should read (`view=series` for the chip state,
  // `templateId` to scope to just this series) — building the actual filter
  // is Phase H's step, not this one.
  const viewAllHref = `/admin/bookings?view=series&templateId=${templateId}`;

  return (
    <AdminPageScaffold width="narrow" className="pb-24 md:pb-0">
      <Link
        href="/admin/bookings"
        className="mb-2 inline-flex h-11 w-fit items-center gap-1.5 rounded-[var(--admin-radius-control)] -ml-2 px-2 text-sm font-semibold text-[var(--admin-body)] outline-none transition-colors hover:bg-[var(--admin-panel-muted)] hover:text-[var(--admin-heading)] focus-visible:ring-2 focus-visible:ring-[var(--admin-focus)]/55"
      >
        <ArrowLeft className="size-4" aria-hidden="true" />
        Back to bookings
      </Link>

      <AdminPageHeader
        title={`Recurring booking · ${serviceName}`}
        description={summaryLine}
        badge={
          <AdminStatusBadge
            tone={isCancelled ? "danger" : "success"}
            value={isCancelled ? "Cancelled" : "Active"}
          />
        }
      />

      {isCancelled ? (
        <div
          role="status"
          className="mb-2 flex items-start gap-2.5 rounded-[var(--admin-radius-card)] border border-[var(--admin-border)] bg-[var(--admin-panel-muted)] px-4 py-3 text-sm"
        >
          <ShieldAlert className="mt-0.5 size-4 shrink-0 text-[var(--admin-text-muted)]" aria-hidden="true" />
          <p className="text-[var(--admin-body)]">
            Cancelled{template.cancelled_at ? ` on ${formatDate(template.cancelled_at.slice(0, 10))}` : ""}
            {template.cancelled_reason ? ` — ${template.cancelled_reason}` : ""}. Future
            visits were cancelled; past visits are preserved.
          </p>
        </div>
      ) : null}

      <div className="grid gap-6">
        <AdminPanel title="Schedule">
          <dl className="grid gap-3 sm:grid-cols-2">
            <Field label="Cadence" value={cadenceLabel} />
            <Field label="Ends" value={endLabel} />
            <Field
              label="First visit"
              value={firstVisit ? formatDate(firstVisit.booking_date) : "—"}
            />
            <Field
              label="Schedule extended through"
              value={formatDate(template.horizon_through_date)}
            />
            <Field label="Therapist" value={therapistLabel} />
            <Field
              label="Participant"
              value={formatLabel(template.participant_gender)}
            />
          </dl>
          {addressLine ? (
            <div className="mt-4 border-t border-[var(--admin-border)] pt-3">
              <Field label="Visit address" value={addressLine} icon={<MapPin className="size-3.5" aria-hidden="true" />} />
            </div>
          ) : null}
          {template.notes ? (
            <div className="mt-4 border-t border-[var(--admin-border)] pt-3">
              <Field label="Notes" value={template.notes} />
            </div>
          ) : null}
        </AdminPanel>

        <AdminPanel title="Client">
          {clientRow.canViewClient && clientRow.client ? (
            <div className="flex items-center justify-between gap-3">
              <p className="font-display text-[1.0625rem] font-semibold tracking-[-0.01em] text-[var(--admin-heading)] break-words">
                {clientRow.client.full_name}
              </p>
              <Link
                href={`/admin/clients/${clientRow.client.id}`}
                className="inline-flex h-11 sm:h-9 shrink-0 items-center gap-1.5 rounded-[var(--admin-radius-control)] px-2.5 text-sm font-semibold text-[var(--admin-body)] outline-none transition-colors hover:bg-[var(--admin-panel-muted)] hover:text-[var(--admin-heading)] focus-visible:ring-2 focus-visible:ring-[var(--admin-focus)]/55"
              >
                <Users className="size-4" aria-hidden="true" />
                View profile
              </Link>
            </div>
          ) : (
            <p className="text-sm text-[var(--admin-text-muted)]">
              You don&rsquo;t have access to this client&rsquo;s record.
            </p>
          )}
        </AdminPanel>

        <AdminPanel title={`Upcoming visits (${upcomingCount ?? 0})`}>
          {upcoming.length === 0 ? (
            <EmptyState
              icon={CalendarX}
              title="No upcoming visits"
              message={
                isCancelled
                  ? "This series was cancelled before its next visit."
                  : "The schedule may need extending, or the series has reached its end condition."
              }
              compact
            />
          ) : (
            <ul className="grid gap-2">
              {upcoming.map((visit) => (
                <VisitRow key={visit.id} visit={visit} />
              ))}
            </ul>
          )}
        </AdminPanel>

        {past.length > 0 ? (
          <details className="group rounded-[var(--admin-radius-card)] border border-[var(--admin-border)] bg-[var(--admin-panel)] p-4 open:pb-4">
            <summary className="cursor-pointer list-none text-sm font-semibold text-[var(--admin-heading)] outline-none [&::-webkit-details-marker]:hidden">
              <span className="inline-block transition-transform group-open:rotate-90">
                &#9656;
              </span>{" "}
              Past visits ({pastCount ?? 0})
            </summary>
            <ul className="mt-3 grid gap-2">
              {past.map((visit) => (
                <VisitRow key={visit.id} visit={visit} />
              ))}
            </ul>
          </details>
        ) : null}

        <Link
          href={viewAllHref}
          className="inline-flex h-10 w-fit items-center gap-1.5 rounded-[var(--admin-radius-control)] px-2 text-sm font-semibold text-[var(--admin-body)] outline-none transition-colors hover:bg-[var(--admin-panel-muted)] hover:text-[var(--admin-heading)] focus-visible:ring-2 focus-visible:ring-[var(--admin-focus)]/55"
        >
          <Repeat className="size-4" aria-hidden="true" />
          View all {totalCount} visit{totalCount === 1 ? "" : "s"}
        </Link>

        <AdminPanel title="Travel charge">
          <SeriesTravelChargeForm
            templateId={template.id}
            currentFee={Number(template.travel_fee ?? 0)}
            disabled={isCancelled}
          />
        </AdminPanel>

        <div className="sticky bottom-3 z-20 md:static">
          <AdminPanel title="Actions">
            <SeriesActions
              templateId={template.id}
              futureOccurrenceCount={upcomingCount ?? 0}
              alreadyCancelled={isCancelled}
            />
          </AdminPanel>
        </div>
      </div>
    </AdminPageScaffold>
  );
}

function Field({
  label,
  value,
  icon,
}: {
  label: string;
  value: React.ReactNode;
  icon?: React.ReactNode;
}) {
  return (
    <div className="grid gap-1">
      <dt className="flex items-center gap-1.5 text-xs font-medium uppercase tracking-wide text-[var(--admin-text-muted)]">
        {icon}
        {label}
      </dt>
      <dd className="text-sm text-[var(--admin-body)]">{value}</dd>
    </div>
  );
}

function VisitRow({ visit }: { visit: SeriesVisitRow }) {
  const assignment = visit.booking_assignments[0];
  const therapistLabel = assignment?.staff_profiles?.name ?? "Unassigned";

  return (
    <li>
      <Link
        href={`/admin/bookings/${visit.id}`}
        className="block rounded-[var(--admin-radius-card)] border border-[var(--admin-border)] bg-[var(--admin-panel)] p-3 transition-colors hover:border-[var(--admin-primary)]/40 hover:shadow-[var(--admin-shadow-hover)] focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[var(--admin-focus)]/55"
      >
        <div className="flex flex-wrap items-center justify-between gap-2">
          <p className="text-sm font-semibold text-[var(--admin-heading)]">
            {formatDate(visit.booking_date)}{" "}
            <span className="font-normal text-[var(--admin-text-muted)]">
              · {formatTime(visit.start_time)}
            </span>
          </p>
          <AdminStatusBadge
            tone={STATUS_TONES[visit.status]}
            value={STATUS_LABELS[visit.status]}
            compact
          />
        </div>
        <p className="mt-1 text-xs text-[var(--admin-text-muted)]">{therapistLabel}</p>
      </Link>
    </li>
  );
}

function SeriesAccessDenied() {
  return (
    <AdminPageScaffold width="narrow">
      <AdminAccessDenied
        title="You don't have access to this series"
        message="Ask the coordinator or owner if you think this is a mistake."
        actions={
          <Link
            href="/admin/bookings"
            className="inline-flex h-10 items-center rounded-[var(--admin-radius-control)] border border-[var(--admin-border-form)] bg-transparent px-4 text-sm font-semibold text-[var(--admin-body)] outline-none transition-colors hover:bg-[var(--admin-panel-muted)] focus-visible:ring-2 focus-visible:ring-[var(--admin-focus)]/55"
          >
            Back to bookings
          </Link>
        }
      />
    </AdminPageScaffold>
  );
}

function SeriesNotFound() {
  return (
    <AdminPageScaffold width="narrow">
      <AdminPanel>
        <EmptyState
          icon={CalendarX}
          title="Series not found"
          message="This recurring series may not exist, or you don't have access."
          action={{ label: "Back to bookings", href: "/admin/bookings" }}
          titleAs="h1"
        />
      </AdminPanel>
    </AdminPageScaffold>
  );
}
