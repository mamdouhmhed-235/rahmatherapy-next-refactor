import { NextRequest, NextResponse } from "next/server";
import { createSupabaseAdminClient } from "@/lib/supabase/admin";
import { createSupabaseServerClient } from "@/lib/supabase/server";
import { getStaffProfile, PERMISSIONS } from "@/lib/auth/rbac";
import {
  canViewRevenueReports,
  formatMoney,
  getReportData,
  getServicePerformance,
  getStaffRevenueAttribution,
  getStaffWorkload,
  parseReportFilters,
  summarizeReports,
} from "../reporting";

export async function GET(request: NextRequest) {
  const supabase = await createSupabaseServerClient();
  const profile = await getStaffProfile(supabase);
  if (!profile || !profile.active) {
    return new NextResponse("Unauthorized", { status: 401 });
  }
  if (
    !profile.permissions.has(PERMISSIONS.VIEW_REPORTS) &&
    !profile.permissions.has(PERMISSIONS.VIEW_OWN_BOOKINGS) &&
    !profile.permissions.has(PERMISSIONS.MANAGE_BOOKINGS_OWN)
  ) {
    return new NextResponse("Forbidden", { status: 403 });
  }

  const url = new URL(request.url);
  const report = url.searchParams.get("report") || "booking_list";
  const filters = parseReportFilters(Object.fromEntries(url.searchParams));
  const adminClient = createSupabaseAdminClient();
  const data = await getReportData(adminClient, profile, filters);
  const revenueAllowed = canViewRevenueReports(profile);
  const rows = getRows(report, data, revenueAllowed);

  await adminClient.from("audit_logs").insert({
    actor_staff_id: profile.id,
    action_type: "report_exported",
    target_type: "reports",
    target_id: null,
    after_state: {
      report,
      from: filters.from,
      to: filters.to,
      row_count: rows.length,
      revenue_included: revenueAllowed,
    },
  });

  return new NextResponse(toCsv(rows), {
    headers: {
      "content-type": "text/csv; charset=utf-8",
      "content-disposition": `attachment; filename=\"rahma-${report}-${filters.from}-to-${filters.to}.csv\"`,
    },
  });
}

function getRows(
  report: string,
  data: Awaited<ReturnType<typeof getReportData>>,
  revenueAllowed: boolean
) {
  const summary = summarizeReports(data);

  if (report === "revenue_summary") {
    return [
      {
        metric: "booked_revenue",
        value: revenueAllowed ? formatMoney(summary.bookedRevenue) : "hidden",
      },
      {
        metric: "collected_revenue",
        value: revenueAllowed ? formatMoney(summary.collectedRevenue) : "hidden",
      },
      {
        metric: "outstanding_revenue",
        value: revenueAllowed ? formatMoney(summary.outstandingRevenue) : "hidden",
      },
      {
        metric: "completed_revenue",
        value: revenueAllowed ? formatMoney(summary.completedRevenue) : "hidden",
      },
    ];
  }

  if (report === "client_summary") {
    return data.clients.map((client) => ({
      client_id: client.id,
      full_name: client.full_name,
      source: client.client_source,
      created_at: client.created_at,
    }));
  }

  if (report === "payment_report") {
    return data.bookings.map((booking) => ({
      booking_id: booking.id,
      booking_date: booking.booking_date,
      contact_name: booking.contact_full_name,
      payment_status: booking.payment_status,
      amount_due: revenueAllowed ? booking.amount_due ?? booking.total_price : "hidden",
      amount_paid: revenueAllowed ? booking.amount_paid : "hidden",
    }));
  }

  if (report === "staff_workload_report") {
    return getStaffWorkload(data).map((row) => ({
      staff_id: row.staffId,
      staff_name: row.staffName,
      assignments: row.assignments,
      completed: row.completed,
    }));
  }

  if (report === "staff_revenue_attribution_report") {
    return getStaffRevenueAttribution(data).map((row) => ({
      staff_id: row.staffId,
      staff_name: row.staffName,
      attributed_revenue: revenueAllowed ? row.revenue : "hidden",
    }));
  }

  if (report === "service_performance_report") {
    return getServicePerformance(data).map((row) => ({
      service: row.service,
      bookings: row.bookings,
      revenue: revenueAllowed ? row.revenue : "hidden",
    }));
  }

  if (report === "source_channel_report") {
    const sources = new Map<string, number>();
    for (const booking of data.bookings) {
      sources.set(booking.booking_source, (sources.get(booking.booking_source) ?? 0) + 1);
    }
    return [...sources.entries()].map(([source, bookings]) => ({ source, bookings }));
  }

  return data.bookings.map((booking) => ({
    booking_id: booking.id,
    booking_date: booking.booking_date,
    start_time: booking.start_time,
    contact_name: booking.contact_full_name,
    contact_email: booking.contact_email,
    contact_phone: booking.contact_phone,
    city: booking.service_city,
    postcode: booking.service_postcode,
    source: booking.booking_source,
    status: booking.status,
    assignment_status: booking.assignment_status,
    payment_status: booking.payment_status,
    total_price: revenueAllowed ? booking.total_price : "hidden",
  }));
}

function toCsv(rows: Record<string, unknown>[]) {
  if (rows.length === 0) return "";
  const headers = Object.keys(rows[0]);
  return [
    headers.join(","),
    ...rows.map((row) =>
      headers.map((header) => escapeCsv(row[header])).join(",")
    ),
  ].join("\n");
}

function escapeCsv(value: unknown) {
  const text = String(value ?? "");
  return /[",\n]/.test(text) ? `"${text.replace(/"/g, '""')}"` : text;
}
