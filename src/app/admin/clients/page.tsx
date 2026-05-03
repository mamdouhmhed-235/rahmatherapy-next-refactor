import Link from "next/link";
import { redirect } from "next/navigation";
import {
  CalendarCheck,
  ChevronRight,
  Mail,
  Phone,
  Search,
  ShieldCheck,
  UserSquare,
} from "lucide-react";
import { Badge } from "@/components/ui/badge";
import { Input } from "@/components/ui/input";
import { createSupabaseAdminClient } from "@/lib/supabase/admin";
import { createSupabaseServerClient } from "@/lib/supabase/server";
import { getStaffProfile, PERMISSIONS } from "@/lib/auth/rbac";
import { formatDate, formatLabel, formatMoney, formatTime } from "./format";
import type { ClientBookingRecord, ClientRecord } from "./types";

export const metadata = {
  title: "Clients - Rahma Therapy Admin",
};

interface ClientsPageProps {
  searchParams: Promise<{ q?: string }>;
}

const CLIENT_SELECT = `
  id,
  full_name,
  phone,
  email,
  address,
  postcode,
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
  service_city,
  service_postcode,
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

function getLatestBooking(bookings: ClientBookingRecord[]) {
  return [...bookings].sort((a, b) => {
    const dateCompare = b.booking_date.localeCompare(a.booking_date);
    return dateCompare || b.start_time.localeCompare(a.start_time);
  })[0];
}

export default async function ClientsPage({ searchParams }: ClientsPageProps) {
  const { q = "" } = await searchParams;
  const supabase = await createSupabaseServerClient();
  const profile = await getStaffProfile(supabase);

  if (!profile || !profile.active) {
    redirect("/admin/login");
  }

  if (!profile.permissions.has(PERMISSIONS.MANAGE_CLIENTS)) {
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

  const visibleClients = (clients ?? []).filter((client) =>
    matchesSearch(client, q)
  );

  return (
    <div>
      <div className="mb-8 flex flex-wrap items-end justify-between gap-4">
        <div>
          <h1 className="font-display text-2xl font-semibold text-[var(--rahma-charcoal)]">
            Clients
          </h1>
          <p className="mt-1 text-sm text-[var(--rahma-muted)]">
            Search customer profiles and view their booking history.
          </p>
        </div>
        <Badge
          variant="secondary"
          className="border-none bg-[var(--rahma-green)]/10 text-[var(--rahma-green)]"
        >
          {visibleClients.length} client{visibleClients.length === 1 ? "" : "s"}
        </Badge>
      </div>

      <form className="mb-6">
        <label className="relative block max-w-xl">
          <Search className="pointer-events-none absolute left-3 top-1/2 size-4 -translate-y-1/2 text-[var(--rahma-muted)]" />
          <Input
            name="q"
            defaultValue={q}
            placeholder="Search by name, phone, or email"
            className="pl-9"
          />
        </label>
      </form>

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
        <Meta label="Services">
          {serviceNames.join(", ") || "No service snapshots"}
        </Meta>
        <Meta label="Latest total">
          {latestBooking ? formatMoney(latestBooking.total_price) : formatMoney(0)}
        </Meta>
      </div>
    </Link>
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
    <div>
      <h1 className="mb-2 font-display text-2xl font-semibold text-[var(--rahma-charcoal)]">
        Clients
      </h1>
      <div
        className="mt-6 rounded-2xl border bg-white px-6 py-8 text-center"
        style={{ borderColor: "var(--rahma-border)" }}
      >
        <ShieldCheck className="mx-auto mb-3 size-8 text-[var(--rahma-muted)]" />
        <p className="font-medium text-[var(--rahma-charcoal)]">
          Insufficient permissions
        </p>
        <p className="mt-1 text-sm text-[var(--rahma-muted)]">
          You need client management permission to access this page.
        </p>
      </div>
    </div>
  );
}
