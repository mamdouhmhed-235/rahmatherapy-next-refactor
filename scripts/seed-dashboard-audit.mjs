#!/usr/bin/env node
/**
 * Seed test data for the dashboard-owner-admin Phase 6 visual audit.
 * Creates: 1 client, 5 bookings (varied statuses), 2 enquiries,
 * 1 failed email_delivery_event, 1 open operational_event.
 * All rows tagged audit_marker = 'dashboard_audit_2026_05_17' for cleanup.
 *
 * Usage:
 *   node scripts/seed-dashboard-audit.mjs        # seed
 *   node scripts/seed-dashboard-audit.mjs --clean  # delete rows
 */

import fs from "node:fs";
import process from "node:process";
import { createClient } from "@supabase/supabase-js";

const MARKER = "dashboard_audit_2026_05_17";

function loadEnv() {
  const envText = fs.readFileSync(".env", "utf8");
  const env = {};
  for (const line of envText.split(/\r?\n/)) {
    if (!line || line.trim().startsWith("#") || !line.includes("=")) continue;
    const i = line.indexOf("=");
    env[line.slice(0, i)] = line.slice(i + 1).replace(/^"|"$/g, "");
  }
  return env;
}

function createAdminClient() {
  const env = loadEnv();
  if (!env.NEXT_PUBLIC_SUPABASE_URL || !env.SUPABASE_SERVICE_ROLE_KEY) {
    throw new Error("Missing Supabase URL or service role key in .env.");
  }
  return createClient(env.NEXT_PUBLIC_SUPABASE_URL, env.SUPABASE_SERVICE_ROLE_KEY, {
    auth: { autoRefreshToken: false, persistSession: false },
  });
}

async function clean(supabase) {
  console.log("Cleaning dashboard audit test data...");
  for (const table of ["operational_events", "email_delivery_events", "enquiries"]) {
    const { error } = await supabase
      .from(table)
      .delete()
      .eq("safe_context->>audit_marker", MARKER);
    if (error && error.code !== "42703") {
      // 42703 = column doesn't exist (some tables don't have safe_context)
    }
  }
  // Delete bookings + clients by note marker
  const { data: bookings } = await supabase.from("bookings").select("id, client_id").like("admin_notes", `%${MARKER}%`);
  if (bookings && bookings.length > 0) {
    const ids = bookings.map((b) => b.id);
    const clientIds = [...new Set(bookings.map((b) => b.client_id))];
    await supabase.from("booking_assignments").delete().in("booking_id", ids);
    await supabase.from("booking_items").delete().in("booking_id", ids);
    await supabase.from("booking_participants").delete().in("booking_id", ids);
    await supabase.from("bookings").delete().in("id", ids);
    await supabase.from("clients").delete().in("id", clientIds);
  }
  await supabase.from("enquiries").delete().like("notes", `%${MARKER}%`);
  await supabase.from("operational_events").delete().like("summary", `%${MARKER}%`);
  await supabase.from("email_delivery_events").delete().like("subject", `%${MARKER}%`);
  console.log("Cleaned.");
}

async function seed(supabase) {
  console.log("Seeding dashboard audit test data...");
  // Use London business date so seeded dates match what the server-side dashboard sees as "today".
  const todayLondon = new Intl.DateTimeFormat("en-CA", { timeZone: "Europe/London", year: "numeric", month: "2-digit", day: "2-digit" }).format(new Date());
  const isoDate = (offsetDays) => {
    const [y, m, d] = todayLondon.split("-").map(Number);
    const dt = new Date(Date.UTC(y, m - 1, d + offsetDays, 12));
    return dt.toISOString().slice(0, 10);
  };
  console.log(`Today (London): ${todayLondon}`);

  // Find an existing service (use first available)
  const { data: services, error: svcErr } = await supabase.from("services").select("id, name, price, duration_mins").limit(1);
  if (svcErr) throw svcErr;
  if (!services || services.length === 0) {
    throw new Error("No services in DB. Run service seed first.");
  }
  const service = services[0];
  const priceGBP = Number(service.price ?? 60);

  // Create a client
  const clientResults = [];
  for (let i = 0; i < 5; i++) {
    const { data: client, error } = await supabase
      .from("clients")
      .insert({
        full_name: `Audit Test Client ${i + 1}`,
        phone: `0700000000${i}`,
        email: `audit.client.${i + 1}.${Date.now()}@example.test`,
        client_source: ["website", "phone", "whatsapp", "referral", "instagram"][i],
        gender_preference: "no_preference",
      })
      .select()
      .single();
    if (error) {
      console.error(`Client ${i + 1} insert error:`, error);
      throw error;
    }
    clientResults.push(client);
  }

  // 5 bookings: 2 today (1 confirmed, 1 awaiting), 2 this week, 1 unpaid completed
  const bookingsToCreate = [
    { client: clientResults[0], offset: 0, start: "10:00", status: "confirmed", payment: "paid", assignment: "fully_assigned" },
    { client: clientResults[1], offset: 0, start: "14:30", status: "pending", payment: "unpaid", assignment: "unassigned" },
    { client: clientResults[2], offset: -2, start: "11:00", status: "completed", payment: "unpaid", assignment: "fully_assigned" },
    { client: clientResults[3], offset: -5, start: "15:00", status: "completed", payment: "paid", assignment: "fully_assigned" },
    { client: clientResults[4], offset: 3, start: "09:30", status: "confirmed", payment: "unpaid", assignment: "partially_assigned" },
  ];

  const createdBookingIds = [];
  for (const b of bookingsToCreate) {
    const startTime = b.start;
    const [h, m] = startTime.split(":").map(Number);
    const endTime = `${String(h + 1).padStart(2, "0")}:${String(m).padStart(2, "0")}`;
    const { data: booking, error: be } = await supabase
      .from("bookings")
      .insert({
        client_id: b.client.id,
        booking_date: isoDate(b.offset),
        start_time: startTime,
        end_time: endTime,
        total_duration_mins: 60,
        total_price: priceGBP,
        amount_due: priceGBP,
        amount_paid: b.payment === "paid" ? priceGBP : 0,
        payment_status: b.payment,
        status: b.status,
        assignment_status: b.assignment,
        booking_source: b.client.client_source,
        contact_full_name: b.client.full_name,
        contact_email: b.client.email,
        contact_phone: b.client.phone,
        service_city: ["Luton", "Bedford", "Dunstable", "Luton", "Houghton Regis"][bookingsToCreate.indexOf(b)],
        service_postcode: "LU1 1AA",
        service_address_line1: "123 Test Lane",
        admin_notes: `[AUDIT:${MARKER}] Seeded for dashboard audit`,
      })
      .select()
      .single();
    if (be) {
      console.error("Booking insert error:", be);
      throw be;
    }
    createdBookingIds.push(booking.id);

    // Create participant + item
    const { data: participant } = await supabase
      .from("booking_participants")
      .insert({
        booking_id: booking.id,
        participant_gender: "female",
        required_therapist_gender: "female",
        is_main_contact: true,
      })
      .select()
      .single();

    await supabase.from("booking_items").insert({
      booking_id: booking.id,
      booking_participant_id: participant?.id,
      service_id: service.id,
      service_name_snapshot: service.name,
      service_price_snapshot: priceGBP,
      service_duration_snapshot: service.duration_mins ?? 60,
    });
  }

  // Enquiries
  await supabase.from("enquiries").insert([
    {
      full_name: "Audit Enquiry One",
      phone: "07700000099",
      source: "website",
      status: "new",
      service_interest: service.name,
      notes: `[AUDIT:${MARKER}] New website enquiry awaiting response`,
    },
    {
      full_name: "Audit Enquiry Two",
      phone: "07700000098",
      source: "whatsapp",
      status: "new",
      service_interest: service.name,
      notes: `[AUDIT:${MARKER}] WhatsApp enquiry`,
    },
  ]);

  // Failed email event
  await supabase.from("email_delivery_events").insert({
    delivery_status: "failed",
    subject: `[AUDIT:${MARKER}] Booking confirmation failed`,
    recipient: "audit@example.test",
    booking_id: createdBookingIds[0],
    error_message: "SMTP timeout (simulated)",
    provider_event_id: `audit-${Date.now()}`,
  });

  // Operational event
  await supabase.from("operational_events").insert({
    event_type: "audit_seed",
    severity: "warning",
    status: "open",
    summary: `[AUDIT:${MARKER}] Test operational event for dashboard visual audit`,
    safe_context: { audit_marker: MARKER, note: "Seeded for dashboard visual audit" },
  });

  console.log("Seeded:");
  console.log(`  5 bookings (2 today, 2 past, 1 future)`);
  console.log(`  2 enquiries (status=new)`);
  console.log(`  1 failed email event`);
  console.log(`  1 open operational event`);
  console.log(`Cleanup: node scripts/seed-dashboard-audit.mjs --clean`);
}

const args = process.argv.slice(2);
const supabase = createAdminClient();
(args.includes("--clean") ? clean(supabase) : seed(supabase)).catch((e) => {
  console.error(e);
  process.exit(1);
});
