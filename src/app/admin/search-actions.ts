"use server";

import { createSupabaseAdminClient } from "@/lib/supabase/admin";
import { createSupabaseServerClient } from "@/lib/supabase/server";
import { getStaffProfile, PERMISSIONS } from "@/lib/auth/rbac";

export interface AdminSearchResult {
  id: string;
  type: "booking" | "client";
  title: string;
  detail: string;
  href: string;
}

interface BookingSearchRecord {
  id: string;
  contact_full_name: string;
  contact_email: string;
  contact_phone: string;
  service_postcode: string | null;
  booking_date: string;
  start_time: string;
  status: string;
}

interface ClientSearchRecord {
  id: string;
  full_name: string;
  email: string | null;
  phone: string | null;
  postcode: string | null;
}

function escapeLike(value: string) {
  return value.replace(/[\\%_]/g, (match) => `\\${match}`);
}

function isUuid(value: string) {
  return /^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i.test(
    value
  );
}

function hasAnyPermission(permissions: Set<string>, values: string[]) {
  return values.some((permission) => permissions.has(permission));
}

async function getOwnBookingIds(staffId: string) {
  const adminClient = createSupabaseAdminClient();
  const { data } = await adminClient
    .from("booking_assignments")
    .select("booking_id")
    .eq("assigned_staff_id", staffId);

  return Array.from(new Set((data ?? []).map((item) => item.booking_id as string)));
}

async function searchBookings(
  query: string,
  profile: NonNullable<Awaited<ReturnType<typeof getStaffProfile>>>
): Promise<AdminSearchResult[]> {
  const canSearchAll = hasAnyPermission(profile.permissions, [
    PERMISSIONS.MANAGE_BOOKINGS_ALL,
    PERMISSIONS.VIEW_ALL_BOOKINGS,
  ]);
  const canSearchOwn = hasAnyPermission(profile.permissions, [
    PERMISSIONS.MANAGE_BOOKINGS_OWN,
    PERMISSIONS.VIEW_OWN_BOOKINGS,
  ]);

  if (!canSearchAll && !canSearchOwn) return [];

  const adminClient = createSupabaseAdminClient();
  let request = adminClient
    .from("bookings")
    .select(
      "id, contact_full_name, contact_email, contact_phone, service_postcode, booking_date, start_time, status"
    )
    .order("booking_date", { ascending: false })
    .limit(8);

  if (!canSearchAll) {
    const ownBookingIds = await getOwnBookingIds(profile.id);
    if (ownBookingIds.length === 0) return [];
    request = request.in("id", ownBookingIds);
  }

  if (isUuid(query)) {
    request = request.eq("id", query);
  } else {
    const likeQuery = `%${escapeLike(query)}%`;
    request = request.or(
      [
        `contact_full_name.ilike.${likeQuery}`,
        `contact_email.ilike.${likeQuery}`,
        `contact_phone.ilike.${likeQuery}`,
        `service_postcode.ilike.${likeQuery}`,
      ].join(",")
    );
  }

  const { data } = await request.returns<BookingSearchRecord[]>();

  return (data ?? []).map((booking) => ({
    id: booking.id,
    type: "booking",
    title: booking.contact_full_name || "Unknown booking contact",
    detail: `${booking.booking_date} ${booking.start_time.slice(0, 5)} - ${booking.status} - ${booking.service_postcode ?? "no postcode"}`,
    href: `/admin/bookings/${booking.id}`,
  }));
}

async function searchClients(
  query: string,
  permissions: Set<string>
): Promise<AdminSearchResult[]> {
  const canSearchClients = hasAnyPermission(permissions, [
    PERMISSIONS.MANAGE_CLIENTS,
    PERMISSIONS.VIEW_CLIENTS,
  ]);

  if (!canSearchClients) return [];

  const likeQuery = `%${escapeLike(query)}%`;
  const { data } = await createSupabaseAdminClient()
    .from("clients")
    .select("id, full_name, email, phone, postcode")
    .or(
      [
        `full_name.ilike.${likeQuery}`,
        `email.ilike.${likeQuery}`,
        `phone.ilike.${likeQuery}`,
        `postcode.ilike.${likeQuery}`,
      ].join(",")
    )
    .order("full_name")
    .limit(8)
    .returns<ClientSearchRecord[]>();

  return (data ?? []).map((client) => ({
    id: client.id,
    type: "client",
    title: client.full_name,
    detail: [client.email, client.phone, client.postcode]
      .filter(Boolean)
      .join(" - "),
    href: `/admin/clients/${client.id}`,
  }));
}

export async function searchAdminCommand(query: string) {
  const normalizedQuery = query.trim();
  if (normalizedQuery.length < 2) return [];

  const supabase = await createSupabaseServerClient();
  const profile = await getStaffProfile(supabase);

  if (!profile || !profile.active) return [];

  const [bookingResults, clientResults] = await Promise.all([
    searchBookings(normalizedQuery, profile),
    searchClients(normalizedQuery, profile.permissions),
  ]);

  return [...bookingResults, ...clientResults].slice(0, 12);
}
