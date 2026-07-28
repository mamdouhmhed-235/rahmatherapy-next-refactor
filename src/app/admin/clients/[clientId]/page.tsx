import Link from "next/link";
import { notFound, redirect } from "next/navigation";
import {
  AlertTriangle,
  CalendarCheck,
  CalendarPlus,
  ChevronRight,
  FileText,
  FilterX,
  HeartPulse,
  History,
  Mail,
  MapPin,
  MessageCircle,
  Pencil,
  Phone,
  Pin,
  ShieldCheck,
  Sparkles,
  StickyNote,
  UserSquare,
} from "lucide-react";
import {
  AdminAccessDenied,
  AdminPanel,
  AdminPanelHeader,
  AdminStatusBadge,
  type AdminTone,
} from "../../components/admin-ui";
import { EmptyState } from "../../components/EmptyState";
import { createSupabaseAdminClient } from "@/lib/supabase/admin";
import { createSupabaseServerClient } from "@/lib/supabase/server";
import { getAdminPageAccess } from "@/lib/auth/admin-access";
import {
  canManageAllBookings,
  canManageAllClients,
  canManageClientDestructiveOps,
  getStaffProfile,
} from "@/lib/auth/rbac";
import {
  formatDate,
  formatDateTime,
  formatLabel,
  formatMoney,
  formatTime,
} from "../format";
import type {
  ClientBookingRecord,
  ClientNoteRecord,
  ClientPrivacyRequestRecord,
  ClientRecord,
} from "../types";
import { getClientDataAccess } from "../access";
import {
  ClientDetailShortcuts,
  ClientNoteForm,
  ClientPrivacyRequestForm,
  PrintRecordButton,
} from "./ClientDetailForms";
import { ClientLtvRibbon } from "./ClientLtvRibbon";
import {
  ClientFlashToast,
  DeleteClientButton,
} from "../components/DeleteClientButton";

export const metadata = {
  title: "Client Detail - Rahma Therapy Admin",
};

type TabKey = "upcoming" | "past" | "all";
type StatusFilter = "all" | "confirmed" | "pending" | "completed" | "cancelled";

interface ClientDetailPageProps {
  params: Promise<{ clientId: string }>;
  searchParams: Promise<{
    tab?: string;
    status?: string;
    service?: string;
    updated?: string;
  }>;
}

const VALID_TABS: readonly TabKey[] = ["upcoming", "past", "all"] as const;
const VALID_STATUSES: readonly StatusFilter[] = [
  "all",
  "confirmed",
  "pending",
  "completed",
  "cancelled",
] as const;
const FILTER_THRESHOLD = 5;
const CRITICAL_NOTE_PATTERN = /\b(allerg(y|ic|ies)|anaphyla|epipen|contraindic|urgent|warning|do not|avoid)\b/i;

function coerceTab(raw: string | undefined): TabKey {
  return (VALID_TABS as readonly string[]).includes(raw ?? "")
    ? (raw as TabKey)
    : "upcoming";
}

function coerceStatus(raw: string | undefined): StatusFilter {
  return (VALID_STATUSES as readonly string[]).includes(raw ?? "")
    ? (raw as StatusFilter)
    : "all";
}

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

function buildClientUrl(
  clientId: string,
  next: { tab?: TabKey; status?: StatusFilter; service?: string }
): string {
  const params = new URLSearchParams();
  if (next.tab && next.tab !== "upcoming") params.set("tab", next.tab);
  if (next.status && next.status !== "all") params.set("status", next.status);
  if (next.service) params.set("service", next.service);
  const qs = params.toString();
  return qs
    ? `/admin/clients/${clientId}?${qs}`
    : `/admin/clients/${clientId}`;
}

const AUDIT_PHRASING: Record<string, string> = {
  client_created: "Client record created",
  client_note_added: "Note added",
  client_note_updated: "Note updated",
  client_note_deleted: "Note deleted",
  client_privacy_request_created: "Privacy request logged",
  client_privacy_request_updated: "Privacy request updated",
  booking_created: "Booking created",
  booking_updated: "Booking updated",
  booking_cancelled: "Booking cancelled",
  booking_completed: "Booking completed",
};

function auditActionPhrase(actionType: string): string {
  return AUDIT_PHRASING[actionType] ?? formatLabel(actionType);
}

function digitsOnly(value: string): string {
  return value.replace(/\D/g, "");
}

function whatsappHref(phone: string): string {
  const digits = digitsOnly(phone);
  if (!digits) return "";
  const normalised = digits.startsWith("0") ? `44${digits.slice(1)}` : digits;
  return `https://wa.me/${normalised}`;
}

// `deleted_at` is selected in BOTH branches on purpose: they are the two RBAC
// variants that feed `getClientSelect`, and omitting the column from either
// would leave a soft-deleted client's profile fully readable by that role alone
// — the exact GDPR "UI lie" this plan removes. Nothing static can catch it:
// these are cast through `.single<ClientRecord>()`, so a missing column reads as
// `undefined` and the `notFound()` short-circuit below never fires.
//
// The four BOOKING_* selects deliberately do NOT carry it: no code path reads
// `booking.deleted_at`, because a soft-deleted booking only ever exists as a
// cascade of its client's deletion, and that client 404s below.
const CLIENT_SELECT = `
  id,
  full_name,
  phone,
  email,
  address,
  postcode,
  client_source,
  source_detail,
  created_at,
  updated_at,
  deleted_at
`;

const CLIENT_SAFE_SELECT = `
  id,
  full_name,
  client_source,
  source_detail,
  created_at,
  updated_at,
  deleted_at
`;

const BOOKING_SELECT = `
  id,
  client_id,
  booking_date,
  start_time,
  end_time,
  status,
  payment_status,
  assignment_status,
  group_booking,
  total_price,
  amount_due,
  amount_paid,
  booking_source,
  contact_full_name,
  contact_email,
  contact_phone,
  service_city,
  service_postcode,
  service_address_line1,
  health_notes,
  customer_notes,
  created_at,
  booking_items(service_name_snapshot, service_price_snapshot, service_duration_snapshot),
  booking_participants(display_name, participant_gender, health_notes, participant_notes, consent_acknowledged)
`;

const BOOKING_SAFE_SELECT = `
  id,
  client_id,
  booking_date,
  start_time,
  end_time,
  status,
  payment_status,
  assignment_status,
  group_booking,
  total_price,
  amount_due,
  amount_paid,
  booking_source,
  created_at,
  booking_items(service_name_snapshot, service_price_snapshot, service_duration_snapshot)
`;

const BOOKING_CONTACT_SELECT = `
  id,
  client_id,
  booking_date,
  start_time,
  end_time,
  status,
  payment_status,
  assignment_status,
  group_booking,
  total_price,
  amount_due,
  amount_paid,
  booking_source,
  contact_full_name,
  contact_email,
  contact_phone,
  service_city,
  service_postcode,
  service_address_line1,
  created_at,
  booking_items(service_name_snapshot, service_price_snapshot, service_duration_snapshot)
`;

const BOOKING_HEALTH_SELECT = `
  id,
  client_id,
  booking_date,
  start_time,
  end_time,
  status,
  payment_status,
  assignment_status,
  group_booking,
  total_price,
  amount_due,
  amount_paid,
  booking_source,
  created_at,
  health_notes,
  customer_notes,
  booking_items(service_name_snapshot, service_price_snapshot, service_duration_snapshot),
  booking_participants(display_name, participant_gender, health_notes, participant_notes, consent_acknowledged)
`;

function isFutureBooking(booking: ClientBookingRecord) {
  return new Date(`${booking.booking_date}T${booking.start_time}`) >= new Date();
}

function getClientSelect({
  canViewContactDetails,
  canViewNotes,
}: {
  canViewContactDetails: boolean;
  canViewNotes: boolean;
}) {
  const fields = canViewContactDetails ? CLIENT_SELECT : CLIENT_SAFE_SELECT;
  return canViewNotes ? `${fields}, notes` : fields;
}

function getBookingSelect({
  canViewContactDetails,
  canViewHealthNotes,
}: {
  canViewContactDetails: boolean;
  canViewHealthNotes: boolean;
}) {
  if (canViewContactDetails && canViewHealthNotes) return BOOKING_SELECT;
  if (canViewContactDetails) return BOOKING_CONTACT_SELECT;
  if (canViewHealthNotes) return BOOKING_HEALTH_SELECT;
  return BOOKING_SAFE_SELECT;
}

function bookingStatusTone(status: string): AdminTone {
  switch (status) {
    case "confirmed":
      return "success";
    case "pending":
      return "info";
    case "cancelled":
      return "danger";
    case "completed":
      return "default";
    case "no_show":
      return "warning";
    default:
      return "muted";
  }
}

function paymentStatusTone(status: string): AdminTone {
  switch (status) {
    case "paid":
      return "success";
    case "partial":
      return "info";
    case "outstanding":
    case "due":
      return "warning";
    default:
      return "muted";
  }
}

function lifecycleBadge(bookingCount: number): { label: string; tone: AdminTone } {
  if (bookingCount === 0) return { label: "New client", tone: "info" };
  if (bookingCount === 1) return { label: "First visit booked", tone: "info" };
  if (bookingCount < 3) return { label: "Returning", tone: "success" };
  return { label: "Established", tone: "success" };
}

export default async function ClientDetailPage({
  params,
  searchParams,
}: ClientDetailPageProps) {
  const { clientId } = await params;
  const {
    tab: tabParam,
    status: statusParam,
    service: serviceParam,
    updated: updatedParam,
  } = await searchParams;
  const tab = coerceTab(tabParam);
  const statusFilter = coerceStatus(statusParam);
  const serviceFilter = serviceParam?.trim() || null;
  const supabase = await createSupabaseServerClient();
  const profile = await getStaffProfile(supabase);

  if (!profile || !profile.active) {
    redirect("/admin/login");
  }

  const pageAccess = getAdminPageAccess(profile, "clientDetail");
  if (!pageAccess.access) {
    return <InsufficientPermissions />;
  }

  const adminClient = createSupabaseAdminClient();
  const hasAllClientAccess =
    pageAccess.dataScope === "all" || pageAccess.dataScope === "sensitive_hidden";
  let hasAssignedClientAccess = false;
  let clientAccess = getClientDataAccess(profile, {
    hasAssignedBooking: hasAssignedClientAccess,
  });
  let bookingHistory: ClientBookingRecord[] = [];
  let client: ClientRecord | null = null;

  if (hasAllClientAccess) {
    const clientSelect = getClientSelect({
      canViewContactDetails: clientAccess.canViewContactDetails,
      canViewNotes:
        clientAccess.canViewHealthNotes ||
        clientAccess.canCreateClientNote ||
        clientAccess.canViewSensitiveNoteQueue,
    });
    const bookingSelect = getBookingSelect({
      canViewContactDetails: clientAccess.canViewContactDetails,
      canViewHealthNotes: clientAccess.canViewHealthNotes,
    });
    const [clientResult, bookingsResult] = await Promise.all([
      adminClient
        .from("clients")
        .select(clientSelect)
        .eq("id", clientId)
        .single<ClientRecord>(),
      adminClient
        .from("bookings")
        .select(bookingSelect)
        .eq("client_id", clientId)
        .order("booking_date", { ascending: false })
        .order("start_time", { ascending: false })
        .returns<ClientBookingRecord[]>(),
    ]);
    client = clientResult.data;
    bookingHistory = bookingsResult.data ?? [];
  } else {
    const { data: assignments } = await adminClient
      .from("booking_assignments")
      .select("booking_id")
      .eq("assigned_staff_id", profile.id);
    const assignedBookingIds = Array.from(
      new Set((assignments ?? []).map((assignment) => assignment.booking_id))
    );
    if (assignedBookingIds.length > 0) {
      clientAccess = getClientDataAccess(profile, { hasAssignedBooking: true });
      const bookingSelect = getBookingSelect({
        canViewContactDetails: clientAccess.canViewContactDetails,
        canViewHealthNotes: clientAccess.canViewHealthNotes,
      });
      const { data: assignedBookings } = await adminClient
        .from("bookings")
        .select(bookingSelect)
        .eq("client_id", clientId)
        .in("id", assignedBookingIds)
        .order("booking_date", { ascending: false })
        .order("start_time", { ascending: false })
        .returns<ClientBookingRecord[]>();
      bookingHistory = assignedBookings ?? [];
      hasAssignedClientAccess = bookingHistory.length > 0;
    } else {
      hasAssignedClientAccess = false;
    }

    clientAccess = getClientDataAccess(profile, {
      hasAssignedBooking: hasAssignedClientAccess,
    });
    if (clientAccess.canViewClient) {
      const clientSelect = getClientSelect({
        canViewContactDetails: clientAccess.canViewContactDetails,
        canViewNotes:
          clientAccess.canViewHealthNotes ||
          clientAccess.canCreateClientNote ||
          clientAccess.canViewSensitiveNoteQueue,
      });
      const { data: assignedClient } = await adminClient
        .from("clients")
        .select(clientSelect)
        .eq("id", clientId)
        .single<ClientRecord>();
      client = assignedClient;
    }
  }

  // A soft-deleted client is gone as far as every working surface is concerned
  // (brief §5.3): the profile 404s for every role, so no Edit, Delete, note or
  // "Book again" affordance below is reachable for one. The list page keeps its
  // own "Show deleted" view for the audit trail.
  if (!client || client.deleted_at) notFound();

  if (!clientAccess.canViewClient) {
    return <InsufficientPermissions />;
  }

  const upcomingBookings = bookingHistory.filter(isFutureBooking);
  const pastBookings = bookingHistory.filter((booking) => !isFutureBooking(booking));
  const upcomingCount = upcomingBookings.length;
  const completedCount = bookingHistory.filter(
    (booking) => booking.status === "completed"
  ).length;
  const totalSpend = bookingHistory.reduce(
    (total, booking) => total + Number(booking.amount_paid ?? 0),
    0
  );
  const lastVisit = pastBookings[0];
  const commonServices = getCommonServices(bookingHistory);

  let clientNotes: ClientNoteRecord[] = [];
  let privacyRequests: ClientPrivacyRequestRecord[] = [];
  let auditLogs: { id: string; action_type: string; created_at: string }[] = [];

  if (clientAccess.canViewHealthNotes || clientAccess.canViewSensitiveNoteQueue) {
    let clientNotesQuery = adminClient
      .from("client_notes")
      .select("id, note, is_sensitive, created_at, staff_profiles(name)")
      .eq("client_id", clientId)
      .order("created_at", { ascending: false });
    if (!clientAccess.canViewSensitiveNoteQueue) {
      clientNotesQuery = clientNotesQuery.eq("is_sensitive", false);
    }
    const clientNotesResult = await clientNotesQuery.returns<ClientNoteRecord[]>();
    clientNotes = clientNotesResult.data ?? [];
  }

  if (clientAccess.canManagePrivacyOperations) {
    const { data: requests } = await adminClient
      .from("client_privacy_requests")
      .select("id, request_type, status, request_note, created_at")
      .eq("client_id", clientId)
      .order("created_at", { ascending: false })
      .returns<ClientPrivacyRequestRecord[]>();
    privacyRequests = requests ?? [];

    const auditTargetIds = [
      clientId,
      ...clientNotes.map((note) => note.id),
      ...privacyRequests.map((request) => request.id),
    ];
    const { data: auditEvents } = await adminClient
      .from("audit_logs")
      .select("id, action_type, created_at")
      .in("target_id", auditTargetIds)
      .order("created_at", { ascending: false })
      .limit(10);
    auditLogs = auditEvents ?? [];
  }

  const canCreateBooking = canManageAllBookings(profile);
  const canEditClient = canManageAllClients(profile);
  const canDeleteClient = canManageClientDestructiveOps(profile);
  const lifecycle = lifecycleBadge(bookingHistory.length);
  const sourceLabel = formatLabel(client.client_source);
  const sourceDetailLabel = client.source_detail ? client.source_detail : null;
  const showHealthCard = clientAccess.canViewHealthNotes;
  const showNotesCard =
    clientAccess.canViewHealthNotes || clientAccess.canCreateClientNote;
  const showPrivacyCard = clientAccess.canManagePrivacyOperations;
  const showAuditCard = clientAccess.canManagePrivacyOperations;
  const showFallback =
    !showHealthCard && !showNotesCard && !showPrivacyCard;

  const tabCounts: Record<TabKey, number> = {
    upcoming: upcomingBookings.length,
    past: pastBookings.length,
    all: bookingHistory.length,
  };
  const bookingsForTab =
    tab === "upcoming"
      ? upcomingBookings
      : tab === "past"
        ? pastBookings
        : [...upcomingBookings, ...pastBookings];
  const matchesStatus = (booking: ClientBookingRecord) =>
    statusFilter === "all" || booking.status === statusFilter;
  const matchesService = (booking: ClientBookingRecord) =>
    !serviceFilter ||
    booking.booking_items.some(
      (item) => item.service_name_snapshot === serviceFilter
    );
  const visibleBookings = bookingsForTab.filter(
    (booking) => matchesStatus(booking) && matchesService(booking)
  );
  const filtersApplied = statusFilter !== "all" || Boolean(serviceFilter);
  const showFilterStrip = bookingsForTab.length >= FILTER_THRESHOLD || filtersApplied;
  const nextVisit = upcomingBookings[upcomingBookings.length - 1];
  const sensitiveNotes = clientNotes.filter((note) => note.is_sensitive);
  const criticalNote =
    sensitiveNotes.find((note) => CRITICAL_NOTE_PATTERN.test(note.note)) ?? null;
  const pinnedSensitiveNoteForPanel =
    sensitiveNotes.find((note) => note.id !== criticalNote?.id) ?? null;
  const regularNotes = clientNotes.filter(
    (note) =>
      note.id !== criticalNote?.id &&
      note.id !== pinnedSensitiveNoteForPanel?.id
  );
  const avatarHue = deterministicHue(client.id);
  const avatarInitials = getInitials(client.full_name);
  const showRecentActivityBalance =
    visibleBookings.length <= 2 && auditLogs.length > 0;
  const newBookingHref = canCreateBooking
    ? `/admin/bookings/new?clientId=${client.id}`
    : undefined;

  return (
    <div className="grid gap-6 pb-8 md:pb-0 print:gap-4 print:pb-0">
      {updatedParam === "1" ? (
        <ClientFlashToast message="Client updated." param="updated" />
      ) : null}
      <ClientDetailShortcuts newBookingHref={newBookingHref} />
      <header className="grid gap-3">
        <Link
          href="/admin/clients"
          className="inline-flex items-center gap-1.5 text-xs font-medium text-[var(--admin-text-muted)] transition-colors hover:text-[var(--admin-primary)] focus-visible:rounded focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[var(--admin-focus)]/55 print:hidden"
        >
          <ChevronRight className="size-3 -rotate-180" aria-hidden="true" />
          Back to clients
        </Link>
        <div className="flex flex-wrap items-start justify-between gap-4">
          <div className="flex min-w-0 items-start gap-4">
            <span
              aria-hidden="true"
              className="inline-flex size-14 shrink-0 items-center justify-center rounded-full text-base font-semibold text-[var(--admin-heading)] ring-1 ring-[var(--admin-border)] sm:size-16 sm:text-lg print:size-12 print:text-base"
              style={{ backgroundColor: `oklch(82% 0.05 ${avatarHue})` }}
            >
              {avatarInitials}
            </span>
            <div className="min-w-0">
              <h1 className="font-display text-balance text-[clamp(1.778rem,3vw,2.369rem)] font-semibold leading-[1.15] tracking-[-0.02em] text-[var(--admin-heading)]">
                {client.full_name}
              </h1>
              <p className="mt-1 text-sm leading-6 text-[var(--admin-text-muted)]">
                {sourceLabel === "Not set"
                  ? `Client since ${formatDate(client.created_at.slice(0, 10))}`
                  : `${sourceLabel}${sourceDetailLabel ? ` · ${sourceDetailLabel}` : ""} · Client since ${formatDate(client.created_at.slice(0, 10))}`}
              </p>
              <div className="mt-2 flex flex-wrap items-center gap-2">
                <AdminStatusBadge value={lifecycle.label} tone={lifecycle.tone} />
              </div>
            </div>
          </div>
          <div className="flex shrink-0 flex-wrap items-center gap-2 print:hidden">
            <PrintRecordButton />
            {/* Brief §4.2 order: Print · Edit · Delete · Book again. Edit is
                gated on the client permission the destination route itself
                enforces — the booking permission it originally used is
                equivalent for every live role, but coupling a client
                affordance to a booking permission is a latent hazard. */}
            {canEditClient ? (
              <Link
                href={`/admin/clients/${client.id}/edit`}
                title="Edit this client's details"
                className="inline-flex h-10 shrink-0 items-center gap-1.5 rounded-[var(--admin-radius-control)] border border-[var(--admin-border-form)] bg-transparent px-3 text-sm font-medium text-[var(--admin-body)] outline-none transition-colors hover:bg-[var(--admin-panel-muted)] focus-visible:ring-2 focus-visible:ring-[var(--admin-focus)]/55"
              >
                <Pencil className="size-4" aria-hidden="true" />
                Edit
              </Link>
            ) : null}
            {canDeleteClient ? (
              <DeleteClientButton
                clientId={client.id}
                clientName={client.full_name}
              />
            ) : null}
            {canCreateBooking ? (
              <Link
                href={`/admin/bookings/new?clientId=${client.id}`}
                title="Start a new booking with this client pre-filled (B)"
                className="inline-flex h-10 items-center gap-1.5 rounded-[var(--admin-radius-control)] bg-[var(--admin-primary)] px-4 text-sm font-semibold !text-[var(--admin-on-primary)] outline-none transition-colors hover:bg-[var(--admin-primary-hover)] focus-visible:ring-2 focus-visible:ring-[var(--admin-focus)]/55"
              >
                <CalendarPlus className="size-4" aria-hidden="true" />
                New booking
              </Link>
            ) : null}
          </div>
        </div>
        {nextVisit ? (
          <Link
            href={`/admin/bookings/${nextVisit.id}`}
            className="group flex flex-wrap items-center gap-3 rounded-[var(--admin-radius-card)] border border-[oklch(88%_0.055_155)] bg-[oklch(93.5%_0.038_155)] px-4 py-3 text-sm transition-colors hover:bg-[oklch(91.5%_0.045_155)] focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[var(--admin-focus)]/55"
            aria-label="Open next upcoming booking"
          >
            <span
              aria-hidden="true"
              className="inline-flex size-9 shrink-0 items-center justify-center rounded-full bg-[oklch(99.5%_0.003_88)] text-[oklch(22%_0.085_155)]"
            >
              <CalendarCheck className="size-4" />
            </span>
            <div className="min-w-0 flex-1">
              <p className="text-xs font-medium uppercase tracking-[0.04em] text-[oklch(22%_0.085_155)]/75">
                Next visit
              </p>
              <p className="mt-0.5 text-sm font-semibold text-[var(--admin-heading)]">
                {formatDate(nextVisit.booking_date)} · {formatTime(nextVisit.start_time)}
                {Array.from(
                  new Set(
                    nextVisit.booking_items.map(
                      (item) => item.service_name_snapshot
                    )
                  )
                )
                  .slice(0, 1)
                  .map((service) => (
                    <span
                      key={service}
                      className="font-normal text-[var(--admin-body)]"
                    >
                      {" — "}
                      {service}
                    </span>
                  ))}
              </p>
            </div>
            <ChevronRight
              className="size-4 shrink-0 text-[oklch(22%_0.085_155)] transition-transform group-hover:translate-x-0.5"
              aria-hidden="true"
            />
          </Link>
        ) : null}
        {criticalNote ? (
          <div
            role="region"
            aria-label="Critical client note"
            className="flex items-start gap-3 rounded-[var(--admin-radius-card)] border border-[oklch(88%_0.045_20)] bg-[oklch(95.5%_0.028_20)] px-4 py-3 text-sm"
          >
            <AlertTriangle
              className="mt-0.5 size-4 shrink-0 text-[oklch(26%_0.14_25)]"
              aria-hidden="true"
            />
            <div className="min-w-0 flex-1">
              <p className="flex flex-wrap items-center gap-2 text-xs font-semibold uppercase tracking-[0.04em] text-[oklch(26%_0.14_25)]">
                <Pin className="size-3" aria-hidden="true" />
                Critical note
              </p>
              <p className="mt-1 whitespace-pre-wrap text-sm leading-6 text-[var(--admin-body)]">
                {criticalNote.note}
              </p>
              <p className="mt-1 text-xs text-[var(--admin-text-muted)]">
                {criticalNote.staff_profiles?.name ?? "Unknown staff"} ·{" "}
                {formatDateTime(criticalNote.created_at)}
              </p>
            </div>
          </div>
        ) : null}
      </header>

      <ClientLtvRibbon
        clientId={client.id}
        bookings={bookingHistory}
        scopeNarrowed={!hasAllClientAccess}
      />

      <div className="grid gap-5 lg:grid-cols-[24rem_minmax(0,1fr)]">
        {/* Sidebar — reference column */}
        <aside className="order-2 grid content-start gap-4 lg:order-1">
          <ContactPanel
            client={client}
            showContactDetails={clientAccess.canViewContactDetails}
          />
          <StatsPanel
            clientId={client.id}
            bookingCount={bookingHistory.length}
            upcomingCount={upcomingCount}
            completedCount={completedCount}
            totalSpend={totalSpend}
            lastVisit={lastVisit}
            commonServices={commonServices}
          />
          {showHealthCard ? (
            <HealthContextPanel bookings={bookingHistory} />
          ) : null}
          {showNotesCard ? (
            <NotesPanel
              client={client}
              notes={regularNotes}
              pinnedNote={pinnedSensitiveNoteForPanel}
              canCreateNote={clientAccess.canCreateClientNote}
              isSensitiveNote={clientAccess.canCreateSensitiveNote}
            />
          ) : null}
          {showPrivacyCard ? (
            <PrivacyPanel requests={privacyRequests} clientId={client.id} />
          ) : null}
          {showAuditCard ? <AuditPanel events={auditLogs} /> : null}
          {showFallback ? <FallbackPanel /> : null}
        </aside>

        {/* Main — operational column */}
        <section className="order-1 grid content-start gap-4 lg:order-2">
          <AdminPanel>
            <AdminPanelHeader
              icon={CalendarCheck}
              title="Booking history"
              description="Confirm, follow up, or rebook — every visit linked here."
            />
            <div className="mt-4">
              <BookingTabs clientId={client.id} active={tab} counts={tabCounts} />
            </div>
            {showFilterStrip ? (
              <BookingFilterStrip
                clientId={client.id}
                activeTab={tab}
                statusFilter={statusFilter}
                serviceFilter={serviceFilter}
              />
            ) : null}
            <div className="mt-4">
              {visibleBookings.length === 0 ? (
                filtersApplied ? (
                  <EmptyFilteredState
                    clientId={client.id}
                    activeTab={tab}
                  />
                ) : (
                  <EmptyTab
                    tab={tab}
                    clientId={client.id}
                    canCreateBooking={canCreateBooking}
                  />
                )
              ) : (
                <ul
                  className="grid list-none gap-3 pl-0"
                  aria-label={`${tab} bookings`}
                >
                  {visibleBookings.map((booking) => (
                    <li key={booking.id} className="list-none">
                      <BookingHistoryCard booking={booking} />
                    </li>
                  ))}
                </ul>
              )}
            </div>
          </AdminPanel>
          {showRecentActivityBalance && showAuditCard ? (
            <RecentActivityBalanceCard events={auditLogs.slice(0, 5)} />
          ) : null}
        </section>
      </div>
    </div>
  );
}

function BookingTabs({
  clientId,
  active,
  counts,
}: {
  clientId: string;
  active: TabKey;
  counts: Record<TabKey, number>;
}) {
  const tabs: { key: TabKey; label: string; title: string }[] = [
    { key: "upcoming", label: "Upcoming", title: `Upcoming (${counts.upcoming})` },
    { key: "past", label: "Past", title: `Past (${counts.past})` },
    { key: "all", label: "All", title: `All (${counts.all})` },
  ];

  return (
    <nav
      role="tablist"
      aria-label="Booking history filter"
      className="flex flex-wrap gap-1.5 rounded-[var(--admin-radius-control)] bg-[var(--admin-panel-muted)] p-1"
    >
      {tabs.map((tabItem) => {
        const isActive = tabItem.key === active;
        const href =
          tabItem.key === "upcoming"
            ? `/admin/clients/${clientId}`
            : `/admin/clients/${clientId}?tab=${tabItem.key}`;
        return (
          <Link
            key={tabItem.key}
            href={href}
            role="tab"
            aria-current={isActive ? "page" : undefined}
            aria-selected={isActive}
            title={tabItem.title}
            className={
              isActive
                ? "inline-flex min-h-11 items-center gap-1.5 rounded-[0.375rem] bg-[var(--admin-primary)] px-3.5 text-sm font-medium !text-[var(--admin-on-primary)] outline-none transition-colors focus-visible:ring-2 focus-visible:ring-[var(--admin-focus)]/55"
                : "inline-flex min-h-11 items-center gap-1.5 rounded-[0.375rem] px-3.5 text-sm font-medium text-[var(--admin-body)] outline-none transition-colors hover:bg-[var(--admin-panel)] hover:text-[var(--admin-heading)] focus-visible:ring-2 focus-visible:ring-[var(--admin-focus)]/55"
            }
          >
            <span>{tabItem.label}</span>
            <span
              className={
                isActive
                  ? "rounded-full bg-[oklch(99.5%_0.003_88)]/30 px-1.5 text-[0.6875rem] font-semibold tabular-nums !text-[var(--admin-on-primary)] ring-1 ring-inset ring-white/35"
                  : "rounded-full bg-[var(--admin-panel)] px-1.5 text-[0.6875rem] font-semibold tabular-nums text-[var(--admin-text-muted)]"
              }
            >
              {counts[tabItem.key]}
            </span>
          </Link>
        );
      })}
    </nav>
  );
}

function EmptyTab({
  tab,
  clientId,
  canCreateBooking,
}: {
  tab: TabKey;
  clientId: string;
  canCreateBooking: boolean;
}) {
  const config: Record<TabKey, { title: string; message: string; cta: boolean }> = {
    upcoming: {
      title: "No upcoming bookings",
      message: "Book this client in when they're ready.",
      cta: true,
    },
    past: {
      title: "No past bookings yet",
      message: "Their first visit will show up here once it's complete.",
      cta: false,
    },
    all: {
      title: "No bookings yet",
      message: "Book this client in to start a history.",
      cta: true,
    },
  };
  const { title, message, cta } = config[tab];
  return (
    <EmptyState
      icon={CalendarCheck}
      title={title}
      message={message}
      action={
        cta && canCreateBooking
          ? {
              label: "Book now",
              href: `/admin/bookings/new?clientId=${clientId}`,
            }
          : undefined
      }
    />
  );
}

function ContactPanel({
  client,
  showContactDetails,
}: {
  client: ClientRecord;
  showContactDetails: boolean;
}) {
  const whatsapp = client.phone ? whatsappHref(client.phone) : "";
  return (
    <AdminPanel>
      <AdminPanelHeader icon={UserSquare} title="Contact" />
      <dl className="mt-4 grid gap-3 text-sm">
        {showContactDetails ? (
          <>
            <DetailRow
              label="Phone"
              icon={<Phone className="size-3.5" aria-hidden="true" />}
              value={
                client.phone ? (
                  <div className="flex flex-wrap items-center gap-2">
                    <a
                      href={`tel:${client.phone}`}
                      className="text-[var(--admin-body)] underline-offset-2 hover:underline focus-visible:outline-none focus-visible:underline"
                    >
                      {client.phone}
                    </a>
                    {whatsapp ? (
                      <a
                        href={whatsapp}
                        target="_blank"
                        rel="noopener noreferrer"
                        title="Open in WhatsApp"
                        aria-label="Message on WhatsApp"
                        className="inline-flex size-6 items-center justify-center rounded-full bg-[oklch(93.5%_0.038_155)] text-[oklch(22%_0.085_155)] transition-colors hover:bg-[oklch(88%_0.055_155)] focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[var(--admin-focus)]/55 print:hidden"
                      >
                        <MessageCircle className="size-3.5" aria-hidden="true" />
                      </a>
                    ) : null}
                  </div>
                ) : (
                  <span className="text-[var(--admin-text-muted)]">—</span>
                )
              }
            />
            <DetailRow
              label="Email"
              icon={<Mail className="size-3.5" aria-hidden="true" />}
              value={
                client.email ? (
                  <a
                    href={`mailto:${client.email}`}
                    className="break-all text-[var(--admin-body)] underline-offset-2 hover:underline focus-visible:outline-none focus-visible:underline"
                  >
                    {client.email}
                  </a>
                ) : (
                  <span className="text-[var(--admin-text-muted)]">—</span>
                )
              }
            />
            <DetailRow
              label="Address"
              icon={<MapPin className="size-3.5" aria-hidden="true" />}
              value={
                <span className="text-[var(--admin-body)]">
                  {client.address ?? "—"}
                  {client.postcode ? (
                    <span className="block text-xs text-[var(--admin-text-muted)]">
                      {client.postcode}
                    </span>
                  ) : null}
                </span>
              }
            />
          </>
        ) : (
          <p className="text-sm leading-6 text-[var(--admin-text-muted)]">
            Contact details require explicit permission.
          </p>
        )}
      </dl>
    </AdminPanel>
  );
}

function StatsPanel({
  clientId,
  bookingCount,
  upcomingCount,
  completedCount,
  totalSpend,
  lastVisit,
  commonServices,
}: {
  clientId: string;
  bookingCount: number;
  upcomingCount: number;
  completedCount: number;
  totalSpend: number;
  lastVisit?: ClientBookingRecord;
  commonServices: string[];
}) {
  return (
    <AdminPanel>
      <AdminPanelHeader icon={History} title="Client summary" />
      <dl className="mt-4 grid grid-cols-2 gap-3 text-sm">
        <StatCell label="Total visits" value={String(bookingCount)} />
        <StatCell label="Upcoming" value={String(upcomingCount)} />
        <StatCell label="Completed" value={String(completedCount)} />
        <StatCell label="Repeat" value={bookingCount > 1 ? "Yes" : "No"} />
        <StatCell label="Total paid" value={formatMoney(totalSpend)} />
        <StatCell
          label="Last visit"
          value={
            lastVisit
              ? `${formatDate(lastVisit.booking_date)} · ${formatTime(lastVisit.start_time)}`
              : "—"
          }
        />
      </dl>
      {commonServices.length > 0 ? (
        <div className="mt-4 border-t border-[var(--admin-border)] pt-3">
          <p className="text-xs font-medium text-[var(--admin-text-muted)]">
            Common services
          </p>
          <div className="mt-2 flex flex-wrap gap-1.5">
            {commonServices.map((service) => (
              <Link
                key={service}
                href={buildClientUrl(clientId, { tab: "all", service })}
                title={`Filter booking history by ${service}`}
                className="inline-flex max-w-full items-center gap-1 truncate rounded-full border border-[var(--admin-border)] bg-[var(--admin-panel-muted)] px-2.5 py-1 text-xs font-medium text-[var(--admin-body)] outline-none transition-colors hover:border-[var(--admin-primary)]/40 hover:bg-[var(--admin-hover-mist)] focus-visible:ring-2 focus-visible:ring-[var(--admin-focus)]/55"
              >
                <span className="truncate">{service}</span>
              </Link>
            ))}
          </div>
        </div>
      ) : null}
    </AdminPanel>
  );
}

function HealthContextPanel({ bookings }: { bookings: ClientBookingRecord[] }) {
  const notes = bookings.flatMap((booking) => [
    ...(booking.health_notes
      ? [{ label: "Booking health note", value: booking.health_notes }]
      : []),
    ...((booking.booking_participants ?? [])
      .filter(
        (participant) => participant.health_notes || participant.participant_notes
      )
      .map((participant) => ({
        label:
          participant.display_name ?? formatLabel(participant.participant_gender),
        value:
          participant.health_notes ?? participant.participant_notes ?? "",
      }))),
  ]);

  return (
    <AdminPanel>
      <AdminPanelHeader icon={HeartPulse} title="Health context" />
      {notes.length === 0 ? (
        <p className="mt-4 text-sm leading-6 text-[var(--admin-text-muted)]">
          No health or participant safety notes recorded yet.
        </p>
      ) : (
        <ul className="mt-4 grid list-none gap-3 pl-0">
          {notes.slice(0, 6).map((note, index) => (
            <li
              key={`${note.label}-${index}`}
              className="list-none rounded-[var(--admin-radius-control)] border border-[var(--admin-border)] bg-[var(--admin-panel-muted)] p-3"
            >
              <p className="text-xs font-medium text-[var(--admin-text-muted)]">
                {note.label}
              </p>
              <p className="mt-1 whitespace-pre-wrap text-sm leading-6 text-[var(--admin-body)]">
                {note.value}
              </p>
            </li>
          ))}
        </ul>
      )}
    </AdminPanel>
  );
}

function NotesPanel({
  client,
  notes,
  pinnedNote,
  canCreateNote,
  isSensitiveNote,
}: {
  client: ClientRecord;
  notes: ClientNoteRecord[];
  pinnedNote: ClientNoteRecord | null;
  canCreateNote: boolean;
  isSensitiveNote: boolean;
}) {
  const hasAnyContent =
    Boolean(client.notes) || notes.length > 0 || Boolean(pinnedNote);

  return (
    <AdminPanel>
      <AdminPanelHeader icon={StickyNote} title="Notes" />
      {client.notes ? (
        <div className="mt-4 rounded-[var(--admin-radius-control)] border border-[oklch(88%_0.055_75)] bg-[oklch(96%_0.038_75)] p-3">
          <p className="flex items-center gap-1.5 text-xs font-medium uppercase tracking-[0.04em] text-[oklch(28%_0.12_55)]">
            <Sparkles className="size-3" aria-hidden="true" />
            Profile note
          </p>
          <p className="mt-1 whitespace-pre-wrap text-sm leading-6 text-[var(--admin-body)]">
            {client.notes}
          </p>
        </div>
      ) : null}
      {pinnedNote ? (
        <div className="mt-3 rounded-[var(--admin-radius-control)] border border-[oklch(88%_0.06_65)] bg-[oklch(95%_0.05_65)] p-3">
          <p className="flex items-center gap-1.5 text-xs font-medium uppercase tracking-[0.04em] text-[oklch(26%_0.13_55)]">
            <Pin className="size-3" aria-hidden="true" />
            Pinned sensitive note
          </p>
          <p className="mt-1 whitespace-pre-wrap text-sm leading-6 text-[var(--admin-body)]">
            {pinnedNote.note}
          </p>
          <p className="mt-2 text-xs text-[var(--admin-text-muted)]">
            {pinnedNote.staff_profiles?.name ?? "Unknown staff"} ·{" "}
            {formatDateTime(pinnedNote.created_at)}
          </p>
        </div>
      ) : null}
      {!hasAnyContent ? (
        <p className="mt-4 text-sm leading-6 text-[var(--admin-text-muted)]">
          No notes yet. Add one to keep the team in the loop.
        </p>
      ) : null}
      {notes.length > 0 ? (
        <ul className="mt-4 grid list-none gap-3 pl-0">
          {notes.map((note) => (
            <li
              key={note.id}
              className="list-none rounded-[var(--admin-radius-control)] border border-[var(--admin-border)] bg-[var(--admin-panel-muted)] p-3"
            >
              <p className="whitespace-pre-wrap text-sm leading-6 text-[var(--admin-body)]">
                {note.note}
              </p>
              <p className="mt-2 flex flex-wrap items-center gap-2 text-xs text-[var(--admin-text-muted)]">
                <span className="font-medium text-[var(--admin-heading)]">
                  {note.staff_profiles?.name ?? "Unknown staff"}
                </span>
                <span
                  className="font-mono text-[0.6875rem]"
                  title={`${formatDateTime(note.created_at)}`}
                >
                  {formatDateTime(note.created_at)}
                </span>
                {note.is_sensitive ? (
                  <AdminStatusBadge value="Sensitive" tone="restricted" compact />
                ) : null}
              </p>
            </li>
          ))}
        </ul>
      ) : null}
      {canCreateNote ? (
        <div className="mt-4 border-t border-[var(--admin-border)] pt-4 print:hidden">
          <ClientNoteForm
            clientId={client.id}
            clientName={client.full_name}
            isSensitiveNote={isSensitiveNote}
          />
        </div>
      ) : null}
    </AdminPanel>
  );
}

function PrivacyPanel({
  requests,
  clientId,
}: {
  requests: ClientPrivacyRequestRecord[];
  clientId: string;
}) {
  return (
    <AdminPanel>
      <AdminPanelHeader icon={ShieldCheck} title="Privacy" />
      {requests.length === 0 ? (
        <p className="mt-4 text-sm leading-6 text-[var(--admin-text-muted)]">
          No privacy requests yet. Data access and deletion requests appear here
          when the client asks.
        </p>
      ) : (
        <ul className="mt-4 grid list-none gap-2 pl-0">
          {requests.map((request) => (
            <li
              key={request.id}
              className="list-none flex items-start justify-between gap-3 rounded-[var(--admin-radius-control)] border border-[var(--admin-border)] bg-[var(--admin-panel-muted)] p-3 text-sm"
            >
              <div className="min-w-0">
                <p className="font-medium text-[var(--admin-heading)]">
                  {formatLabel(request.request_type)}
                </p>
                <p
                  className="mt-0.5 font-mono text-[0.6875rem] text-[var(--admin-text-muted)]"
                  title={formatDateTime(request.created_at)}
                >
                  {formatDateTime(request.created_at)}
                </p>
              </div>
              <AdminStatusBadge
                value={formatLabel(request.status)}
                tone={privacyStatusTone(request.status)}
                compact
              />
            </li>
          ))}
        </ul>
      )}
      <div className="mt-4 border-t border-[var(--admin-border)] pt-4">
        <ClientPrivacyRequestForm clientId={clientId} />
      </div>
    </AdminPanel>
  );
}

function AuditPanel({
  events,
}: {
  events: { id: string; action_type: string; created_at: string }[];
}) {
  return (
    <AdminPanel>
      <AdminPanelHeader icon={FileText} title="Recent audit activity" />
      {events.length === 0 ? (
        <p className="mt-4 text-sm leading-6 text-[var(--admin-text-muted)]">
          Updates to this client&apos;s record will appear here.
        </p>
      ) : (
        <ul className="mt-4 grid list-none gap-2 pl-0 text-sm">
          {events.map((event) => (
            <li
              key={event.id}
              className="list-none flex items-center justify-between gap-3 rounded-[var(--admin-radius-control)] bg-[var(--admin-panel-muted)] px-3 py-2"
            >
              <span className="text-[var(--admin-body)]">
                {auditActionPhrase(event.action_type)}
              </span>
              <span
                className="font-mono text-[0.6875rem] text-[var(--admin-text-muted)]"
                title={formatDateTime(event.created_at)}
              >
                {formatDateTime(event.created_at)}
              </span>
            </li>
          ))}
        </ul>
      )}
    </AdminPanel>
  );
}

function RecentActivityBalanceCard({
  events,
}: {
  events: { id: string; action_type: string; created_at: string }[];
}) {
  return (
    <AdminPanel>
      <AdminPanelHeader
        icon={History}
        title="Recent activity"
        description="Quick context while the booking list is still light."
      />
      <ul className="mt-4 grid list-none gap-2 pl-0 text-sm">
        {events.map((event) => (
          <li
            key={event.id}
            className="list-none flex items-center justify-between gap-3 rounded-[var(--admin-radius-control)] bg-[var(--admin-panel-muted)] px-3 py-2"
          >
            <span className="text-[var(--admin-body)]">
              {auditActionPhrase(event.action_type)}
            </span>
            <span
              className="font-mono text-[0.6875rem] text-[var(--admin-text-muted)]"
              title={formatDateTime(event.created_at)}
            >
              {formatDateTime(event.created_at)}
            </span>
          </li>
        ))}
      </ul>
    </AdminPanel>
  );
}

function BookingFilterStrip({
  clientId,
  activeTab,
  statusFilter,
  serviceFilter,
}: {
  clientId: string;
  activeTab: TabKey;
  statusFilter: StatusFilter;
  serviceFilter: string | null;
}) {
  const options: { key: StatusFilter; label: string }[] = [
    { key: "all", label: "All statuses" },
    { key: "confirmed", label: "Confirmed" },
    { key: "pending", label: "Pending" },
    { key: "completed", label: "Completed" },
    { key: "cancelled", label: "Cancelled" },
  ];
  return (
    <div className="mt-3 flex flex-wrap items-center gap-2 print:hidden">
      <span className="text-xs font-medium text-[var(--admin-text-muted)]">
        Filter
      </span>
      <div
        role="group"
        aria-label="Filter booking history by status"
        className="flex flex-wrap items-center gap-1.5"
      >
        {options.map((option) => {
          const isActive = option.key === statusFilter;
          const href = buildClientUrl(clientId, {
            tab: activeTab,
            status: option.key,
            service: serviceFilter ?? undefined,
          });
          return (
            <Link
              key={option.key}
              href={href}
              aria-pressed={isActive}
              className={
                isActive
                  ? "inline-flex h-8 items-center rounded-full bg-[var(--admin-primary)] px-3 text-xs font-medium !text-[var(--admin-on-primary)] outline-none transition-colors focus-visible:ring-2 focus-visible:ring-[var(--admin-focus)]/55"
                  : "inline-flex h-8 items-center rounded-full border border-[var(--admin-border)] bg-[var(--admin-panel)] px-3 text-xs font-medium text-[var(--admin-body)] outline-none transition-colors hover:bg-[var(--admin-panel-muted)] focus-visible:ring-2 focus-visible:ring-[var(--admin-focus)]/55"
              }
            >
              {option.label}
            </Link>
          );
        })}
      </div>
      {serviceFilter ? (
        <Link
          href={buildClientUrl(clientId, {
            tab: activeTab,
            status: statusFilter,
          })}
          className="inline-flex h-8 items-center gap-1 rounded-full bg-[oklch(93.5%_0.038_155)] px-3 text-xs font-medium text-[oklch(22%_0.085_155)] outline-none transition-colors hover:bg-[oklch(88%_0.055_155)] focus-visible:ring-2 focus-visible:ring-[var(--admin-focus)]/55"
          title="Clear service filter"
        >
          <span className="truncate max-w-[12rem]">{serviceFilter}</span>
          <span aria-hidden="true">×</span>
        </Link>
      ) : null}
    </div>
  );
}

function EmptyFilteredState({
  clientId,
  activeTab,
}: {
  clientId: string;
  activeTab: TabKey;
}) {
  return (
    <EmptyState
      icon={FilterX}
      title="No bookings match those filters"
      message="Try a different status or clear the service filter."
      compact
      actions={
        <Link
          href={buildClientUrl(clientId, { tab: activeTab })}
          className="inline-flex h-8 items-center rounded-full border border-[var(--admin-border-form)] bg-transparent px-3 text-xs font-medium text-[var(--admin-body)] outline-none transition-colors hover:bg-[var(--admin-panel-muted)] focus-visible:ring-2 focus-visible:ring-[var(--admin-focus)]/55"
        >
          Clear filters
        </Link>
      }
    />
  );
}

function FallbackPanel() {
  return (
    <AdminPanel tone="restricted">
      <AdminPanelHeader
        icon={ShieldCheck}
        title="Limited view"
        tone="restricted"
      />
      <p className="mt-3 text-sm leading-6 text-[var(--admin-text-muted)]">
        Contact details and booking history are available above. Other sections
        need more permissions.
      </p>
    </AdminPanel>
  );
}

function privacyStatusTone(status: string): AdminTone {
  switch (status) {
    case "received":
    case "reviewing":
      return "warning";
    case "completed":
      return "success";
    case "declined":
      return "danger";
    default:
      return "muted";
  }
}

function BookingHistoryCard({
  booking,
}: {
  booking: ClientBookingRecord;
}) {
  const serviceNames = Array.from(
    new Set(booking.booking_items.map((item) => item.service_name_snapshot))
  );
  const showAssignmentChip =
    booking.status !== "confirmed" &&
    booking.status !== "completed" &&
    booking.status !== "cancelled" &&
    booking.assignment_status &&
    booking.assignment_status !== "fully_assigned";
  const locationLine = [
    booking.service_address_line1,
    booking.service_city,
    booking.service_postcode,
  ]
    .filter(Boolean)
    .join(", ");

  return (
    <Link
      href={`/admin/bookings/${booking.id}`}
      className="block rounded-[var(--admin-radius-card)] border border-[var(--admin-border)] bg-[var(--admin-panel)] p-4 transition-colors hover:border-[var(--admin-primary)]/40 hover:shadow-[var(--admin-shadow-hover)] focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[var(--admin-focus)]/55 focus-visible:ring-offset-2 focus-visible:ring-offset-[var(--admin-panel)]"
    >
      <div className="flex flex-wrap items-start gap-4 sm:flex-nowrap">
        <div className="min-w-0 flex-1">
          <p className="text-base font-semibold leading-tight text-[var(--admin-heading)]">
            {formatDate(booking.booking_date)}
            <span className="text-[var(--admin-text-muted)]"> · </span>
            <span className="font-normal">{formatTime(booking.start_time)}</span>
          </p>
          <p className="mt-1 text-sm text-[var(--admin-body)]">
            {serviceNames.join(", ") || "No service recorded"}
          </p>
          {locationLine ? (
            <p className="mt-1 truncate text-xs text-[var(--admin-text-muted)]">
              {locationLine}
            </p>
          ) : null}
        </div>
        <div className="flex shrink-0 flex-col items-end gap-1.5 text-right">
          <p className="font-semibold text-[var(--admin-heading)]">
            {formatMoney(booking.total_price)}
          </p>
          <div className="flex flex-wrap items-center justify-end gap-1.5">
            <AdminStatusBadge
              value={formatLabel(booking.status)}
              tone={bookingStatusTone(booking.status)}
              compact
            />
            <AdminStatusBadge
              value={formatLabel(booking.payment_status)}
              tone={paymentStatusTone(booking.payment_status)}
              compact
            />
            {showAssignmentChip ? (
              <AdminStatusBadge
                value={formatLabel(booking.assignment_status)}
                tone="warning"
                compact
              />
            ) : null}
            {booking.group_booking ? (
              <AdminStatusBadge value="Group" tone="info" compact />
            ) : null}
          </div>
        </div>
      </div>
    </Link>
  );
}

function DetailRow({
  label,
  icon,
  value,
}: {
  label: string;
  icon?: React.ReactNode;
  value: React.ReactNode;
}) {
  return (
    <div className="grid gap-1">
      <dt className="flex items-center gap-1.5 text-xs font-medium text-[var(--admin-text-muted)]">
        {icon}
        {label}
      </dt>
      <dd className="text-sm text-[var(--admin-body)]">{value}</dd>
    </div>
  );
}

function StatCell({ label, value }: { label: string; value: string }) {
  return (
    <div className="rounded-[var(--admin-radius-control)] border border-[var(--admin-border)] bg-[var(--admin-panel-muted)] p-3">
      <dt className="text-xs font-medium text-[var(--admin-text-muted)]">
        {label}
      </dt>
      <dd className="mt-1 text-sm font-semibold text-[var(--admin-heading)]">
        {value}
      </dd>
    </div>
  );
}

function getCommonServices(bookings: ClientBookingRecord[]) {
  const counts = new Map<string, number>();
  for (const booking of bookings) {
    for (const item of booking.booking_items) {
      counts.set(
        item.service_name_snapshot,
        (counts.get(item.service_name_snapshot) ?? 0) + 1
      );
    }
  }
  return [...counts.entries()]
    .sort((a, b) => b[1] - a[1] || a[0].localeCompare(b[0]))
    .slice(0, 3)
    .map(([serviceName]) => serviceName);
}

function InsufficientPermissions() {
  return (
    <AdminAccessDenied
      title="You don't have access to this client's profile"
      message="Contact the owner if you need access."
    />
  );
}
