import Link from "next/link";
import { redirect } from "next/navigation";
import {
  CalendarCheck,
  ChevronRight,
  Mail,
  Phone,
  Plus,
  Search,
  UserSquare,
} from "lucide-react";
import { Badge } from "@/components/ui/badge";
import { buttonVariants } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { createSupabaseAdminClient } from "@/lib/supabase/admin";
import { createSupabaseServerClient } from "@/lib/supabase/server";
import { getStaffProfile, PERMISSIONS } from "@/lib/auth/rbac";
import {
  AdminAccessDenied,
  AdminFilterBar,
  AdminPageHeader,
} from "../components/admin-ui";
import { cn } from "@/lib/utils";
import { formatDate, formatLabel, formatMoney, formatTime } from "./format";
import type { ClientBookingRecord, ClientRecord } from "./types";

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
  }>;
}

const CLIENT_SELECT = `
  id,
  full_name,
  phone,
  email,
  address,
  postcode,
  client_source,
  source_detail,
  notes,
  created_at,
  updated_at
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
  created_at,
  booking_items(service_name_snapshot, service_price_snapshot, service_duration_snapshot)
`;

function matchesSearch(client: ClientRecord, query: string) {
  const normalizedQuery = query.trim().toLowerCase();
  if (!normalizedQuery) return true;

  return [client.full_name, client.phone, client.email]
    .filter((value): value is string => Boolean(value))
    .some((value) => value.toLowerCase().includes(normalizedQuery));
}

function isUpcomingBooking(booking: ClientBookingRecord) {
  return `${booking.booking_date}T${booking.start_time}` >= new Date().toISOString().slice(0, 16);
}

function getOutstandingAmount(bookings: ClientBookingRecord[]) {
  return bookings.reduce((total, booking) => {
    const due = Number(booking.amount_due ?? booking.total_price ?? 0);
    const paid = Number(booking.amount_paid ?? 0);
    return total + Math.max(0, due - paid);
  }, 0);
}

function getClientTotalSpend(bookings: ClientBookingRecord[]) {
  return bookings.reduce(
    (total, booking) => total + Number(booking.amount_paid ?? 0),
    0
  );
}

function matchesFilters({
  client,
  bookings,
  lifecycle,
  payment,
  location,
  source,
}: {
  client: ClientRecord;
  bookings: ClientBookingRecord[];
  lifecycle: string;
  payment: string;
  location: string;
  source: string;
}) {
  const hasUpcoming = bookings.some(isUpcomingBooking);
  const outstanding = getOutstandingAmount(bookings);
  const normalizedLocation = location.trim().toLowerCase();

  if (lifecycle === "repeat" && bookings.length <= 1) return false;
  if (lifecycle === "upcoming" && !hasUpcoming) return false;
  if (lifecycle === "no_future" && hasUpcoming) return false;
  if (payment === "outstanding" && outstanding <= 0) return false;
  if (source && client.client_source !== source && !bookings.some((booking) => booking.booking_source === source)) {
    return false;
  }
  if (
    normalizedLocation &&
    ![
      client.postcode,
      client.address,
      ...bookings.flatMap((booking) => [
        booking.service_city,
        booking.service_postcode,
        booking.service_address_line1,
      ]),
    ]
      .filter((value): value is string => Boolean(value))
      .some((value) => value.toLowerCase().includes(normalizedLocation))
  ) {
    return false;
  }

  return true;
}

function getLatestBooking(bookings: ClientBookingRecord[]) {
  return [...bookings].sort((a, b) => {
    const dateCompare = b.booking_date.localeCompare(a.booking_date);
    return dateCompare || b.start_time.localeCompare(a.start_time);
  })[0];
}

export default async function ClientsPage({ searchParams }: ClientsPageProps) {
  const {
    q = "",
    lifecycle = "",
    payment = "",
    location = "",
    source = "",
  } = await searchParams;
  const supabase = await createSupabaseServerClient();
  const profile = await getStaffProfile(supabase);

  if (!profile || !profile.active) {
    redirect("/admin/login");
  }

  const canManageClients = profile.permissions.has(PERMISSIONS.MANAGE_CLIENTS);

  if (!canManageClients && !profile.permissions.has(PERMISSIONS.VIEW_CLIENTS)) {
    return <InsufficientPermissions />;
  }

  const adminClient = createSupabaseAdminClient();
  const [{ data: clients }, { data: bookings }] = await Promise.all([
    adminClient
      .from("clients")
      .select(CLIENT_SELECT)
      .order("full_name")
      .returns<ClientRecord[]>(),
    adminClient
      .from("bookings")
      .select(BOOKING_SELECT)
      .order("booking_date", { ascending: false })
      .order("start_time", { ascending: false })
      .returns<ClientBookingRecord[]>(),
  ]);

  const bookingsByClientId = new Map<string, ClientBookingRecord[]>();
  for (const booking of bookings ?? []) {
    bookingsByClientId.set(booking.client_id, [
      ...(bookingsByClientId.get(booking.client_id) ?? []),
      booking,
    ]);
  }

  const visibleClients = (clients ?? []).filter((client) => {
    const clientBookings = bookingsByClientId.get(client.id) ?? [];
    return (
      matchesSearch(client, q) &&
      matchesFilters({
        client,
        bookings: clientBookings,
        lifecycle,
        payment,
        location,
        source,
      })
    );
  });

  return (
    <div>
      <AdminPageHeader
        title="Clients"
        description="Search customer profiles, booking-specific snapshots, repeat status, source attribution, and payment follow-up."
        actions={
          canManageClients ? (
          <Link
            href="/admin/clients/new"
            className={cn(buttonVariants({ size: "sm" }), "min-h-10")}
          >
            <Plus className="size-4" />
            Create client
          </Link>
          ) : null
        }
      />

      <AdminFilterBar>
        <form className="grid w-full gap-3 md:grid-cols-[minmax(14rem,1.4fr)_repeat(4,minmax(9rem,1fr))_auto]">
          <label className="relative block">
            <Search className="pointer-events-none absolute left-3 top-1/2 size-4 -translate-y-1/2 text-[var(--rahma-muted)]" />
            <Input
              name="q"
              defaultValue={q}
              placeholder="Name, phone, or email"
              className="pl-9"
            />
          </label>
          <Select name="lifecycle" defaultValue={lifecycle} label="Client state">
            <option value="">All clients</option>
            <option value="repeat">Repeat clients</option>
            <option value="upcoming">Upcoming booking</option>
            <option value="no_future">No future booking</option>
          </Select>
          <Select name="payment" defaultValue={payment} label="Payment">
            <option value="">Any payment</option>
            <option value="outstanding">Outstanding</option>
          </Select>
          <Input
            name="location"
            defaultValue={location}
            placeholder="Postcode or city"
          />
          <Select name="source" defaultValue={source} label="Source">
            <option value="">Any source</option>
            <option value="website">Website</option>
            <option value="phone">Phone</option>
            <option value="whatsapp">WhatsApp</option>
            <option value="instagram">Instagram</option>
            <option value="referral">Referral</option>
            <option value="manual">Manual</option>
            <option value="other">Other</option>
          </Select>
          <button
            type="submit"
            className={cn(buttonVariants({ variant: "outline", size: "md" }), "h-10")}
          >
            Filter
          </button>
        </form>
      </AdminFilterBar>

      <div className="mb-4 flex justify-end">
        <Badge
          variant="secondary"
          className="border-none bg-[var(--rahma-green)]/10 text-[var(--rahma-green)]"
        >
          {visibleClients.length} client{visibleClients.length === 1 ? "" : "s"}
        </Badge>
      </div>

      {visibleClients.length === 0 ? (
        <div
          className="rounded-2xl border-2 border-dashed bg-white/50 px-6 py-20 text-center"
          style={{ borderColor: "var(--rahma-border)" }}
        >
          <UserSquare className="mx-auto mb-4 size-12 text-[var(--rahma-muted)]/30" />
          <h2 className="text-lg font-semibold text-[var(--rahma-charcoal)]">
            No clients found
          </h2>
          <p className="mt-1 text-sm text-[var(--rahma-muted)]">
            {q ? "Try another name or phone number." : "Clients will appear here after booking requests are submitted."}
          </p>
        </div>
      ) : (
        <div className="grid gap-4">
          {visibleClients.map((client) => (
            <ClientCard
              key={client.id}
              client={client}
              bookings={bookingsByClientId.get(client.id) ?? []}
            />
          ))}
        </div>
      )}
    </div>
  );
}

function ClientCard({
  client,
  bookings,
}: {
  client: ClientRecord;
  bookings: ClientBookingRecord[];
}) {
  const latestBooking = getLatestBooking(bookings);
  const upcomingCount = bookings.filter(isUpcomingBooking).length;
  const outstandingAmount = getOutstandingAmount(bookings);
  const totalSpend = getClientTotalSpend(bookings);
  const serviceNames = latestBooking
    ? Array.from(
        new Set(
          latestBooking.booking_items.map((item) => item.service_name_snapshot)
        )
      )
    : [];

  return (
    <Link
      href={`/admin/clients/${client.id}`}
      className="group rounded-2xl border bg-white p-5 transition-shadow duration-150 hover:shadow-card"
      style={{
        borderColor: "var(--rahma-border)",
        boxShadow: "var(--shadow-soft-token)",
      }}
    >
      <div className="flex flex-wrap items-start justify-between gap-4">
        <div className="min-w-0">
          <div className="mb-2 flex flex-wrap items-center gap-2">
            <h2 className="font-semibold text-[var(--rahma-charcoal)]">
              {client.full_name}
            </h2>
            {bookings.length > 1 ? <StatusBadge value="repeat client" /> : null}
            <StatusBadge value={client.client_source} muted />
            <StatusBadge value={`${bookings.length} booking${bookings.length === 1 ? "" : "s"}`} muted />
          </div>
          <div className="flex flex-wrap gap-x-4 gap-y-1 text-sm text-[var(--rahma-muted)]">
            <span className="inline-flex items-center gap-1.5">
              <Phone className="size-3.5" />
              {client.phone ?? "No phone"}
            </span>
            <span className="inline-flex items-center gap-1.5">
              <Mail className="size-3.5" />
              {client.email ?? "No email"}
            </span>
          </div>
        </div>
        <ChevronRight className="mt-1 size-5 text-[var(--rahma-muted)] transition-transform group-hover:translate-x-1" />
      </div>

      <div className="mt-4 grid gap-3 border-t border-[var(--rahma-border)] pt-4 md:grid-cols-3">
        <Meta icon={<CalendarCheck className="size-4" />} label="Latest booking">
          {latestBooking
            ? `${formatDate(latestBooking.booking_date)} at ${formatTime(latestBooking.start_time)}`
            : "No bookings"}
        </Meta>
        <Meta label="Upcoming / outstanding">
          {upcomingCount} upcoming - {formatMoney(outstandingAmount)}
        </Meta>
        <Meta label="Services">
          {serviceNames.join(", ") || "No service snapshots"}
        </Meta>
        <Meta label="Collected spend">
          {formatMoney(totalSpend)}
        </Meta>
      </div>
    </Link>
  );
}

function Select({
  name,
  label,
  defaultValue,
  children,
}: {
  name: string;
  label: string;
  defaultValue: string;
  children: React.ReactNode;
}) {
  return (
    <label>
      <span className="sr-only">{label}</span>
      <select
        name={name}
        defaultValue={defaultValue}
        className="h-10 w-full rounded-md border border-[var(--rahma-border)] bg-white px-3 text-sm text-[var(--rahma-charcoal)] outline-none focus:ring-2 focus:ring-[var(--rahma-green)]/20"
      >
        {children}
      </select>
    </label>
  );
}

function Meta({
  icon,
  label,
  children,
}: {
  icon?: React.ReactNode;
  label: string;
  children: React.ReactNode;
}) {
  return (
    <div className="text-sm">
      <p className="mb-1 flex items-center gap-1.5 font-medium text-[var(--rahma-charcoal)]">
        {icon}
        {label}
      </p>
      <p className="text-[var(--rahma-muted)]">{children}</p>
    </div>
  );
}

function StatusBadge({ value, muted }: { value: string; muted?: boolean }) {
  return (
    <Badge
      variant="secondary"
      className={
        muted
          ? "border-none bg-gray-100 text-gray-600 capitalize"
          : "border-none bg-[var(--rahma-green)]/10 text-[var(--rahma-green)] capitalize"
      }
    >
      {formatLabel(value)}
    </Badge>
  );
}

function InsufficientPermissions() {
  return (
    <AdminAccessDenied
      title="Clients access limited"
      message="You need client management permission to access this page."
      permission="manage_clients"
    />
  );
}
