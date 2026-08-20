#!/usr/bin/env node

// ⛔ ONE-OFF, 2026-08-20 — capture every row belonging to client `Badar` before
// the Owner-instructed hard delete (ruling D-016).
//
// Writes OUTSIDE the repository on purpose. The capture contains a real
// person's name, address, phone number, email and health details, and the repo
// is version-controlled; `.production-readiness/` is gitignored but that is a
// weaker guarantee than simply not putting it there.
//
//   node scripts/backup-badar-record.mjs <destination-directory>
//
// Exit 0 = written and re-read successfully. Exit 1 = wrote nothing usable.
// ⛔ "Could not capture" is never "safe to delete".

import fs from "node:fs";
import path from "node:path";
import process from "node:process";
import { createClient } from "@supabase/supabase-js";

const CLIENT_ID = "4978ae6d-79d0-4119-a8c0-fd374e8dc75d";

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

async function main() {
  const destDir = process.argv[2];
  if (!destDir) throw new Error("Usage: node scripts/backup-badar-record.mjs <destination-directory>");

  const env = loadEnv();
  if (!env.NEXT_PUBLIC_SUPABASE_URL || !env.SUPABASE_SERVICE_ROLE_KEY) {
    throw new Error("Missing Supabase URL or service role key in .env.");
  }
  const db = createClient(env.NEXT_PUBLIC_SUPABASE_URL, env.SUPABASE_SERVICE_ROLE_KEY, {
    auth: { autoRefreshToken: false, persistSession: false },
  });

  const take = async (label, query) => {
    const { data, error } = await query;
    if (error) throw new Error(`${label} read failed: ${error.message}`);
    return data ?? [];
  };

  const clients = await take("clients", db.from("clients").select("*").eq("id", CLIENT_ID));
  const bookings = await take("bookings", db.from("bookings").select("*").eq("client_id", CLIENT_ID));
  const bookingIds = bookings.map((b) => b.id);

  const byBooking = (table) =>
    bookingIds.length
      ? take(table, db.from(table).select("*").in("booking_id", bookingIds))
      : Promise.resolve([]);

  const capture = {
    captured_at: new Date().toISOString(),
    reason:
      "Owner ruling D-016 (2026-08-20): hard-delete the Badar record. Captured so the deletion is recoverable.",
    client_id: CLIENT_ID,
    booking_ids: bookingIds,
    clients,
    bookings,
    booking_participants: await byBooking("booking_participants"),
    booking_items: await byBooking("booking_items"),
    booking_assignments: await byBooking("booking_assignments"),
    email_delivery_events: await byBooking("email_delivery_events"),
    client_notes: await take("client_notes", db.from("client_notes").select("*").eq("client_id", CLIENT_ID)),
    client_privacy_requests: await take(
      "client_privacy_requests",
      db.from("client_privacy_requests").select("*").eq("client_id", CLIENT_ID)
    ),
    enquiries: await take("enquiries", db.from("enquiries").select("*").eq("client_id", CLIENT_ID)),
    recurring_booking_templates: await take(
      "recurring_booking_templates",
      db.from("recurring_booking_templates").select("*").eq("client_id", CLIENT_ID)
    ),
    audit_logs: bookingIds.length
      ? await take("audit_logs", db.from("audit_logs").select("*").in("target_id", bookingIds))
      : [],
  };

  const rowCount = Object.entries(capture)
    .filter(([, v]) => Array.isArray(v))
    .reduce((n, [, v]) => n + v.length, 0);

  // ⛔ Refuse to report success on an empty capture. If the client row is gone
  // the deletion has already happened and there is nothing to protect; if it is
  // present but nothing else read, the capture is incomplete and unusable.
  if (clients.length === 0) {
    throw new Error(`client ${CLIENT_ID} not found — nothing captured, and nothing to delete`);
  }

  fs.mkdirSync(destDir, { recursive: true });
  const outPath = path.join(destDir, `badar-record-backup-${capture.captured_at.slice(0, 10)}.json`);
  fs.writeFileSync(outPath, JSON.stringify(capture, null, 2), "utf8");

  // Read it back and re-parse, so "written" means readable, not merely attempted.
  const reread = JSON.parse(fs.readFileSync(outPath, "utf8"));
  if (reread.clients?.[0]?.id !== CLIENT_ID) {
    throw new Error("re-read verification failed — the capture on disk is not usable");
  }

  console.log(`backup written: ${outPath}`);
  console.log(`bytes:          ${fs.statSync(outPath).size}`);
  console.log(`rows captured:  ${rowCount}`);
  for (const [table, rows] of Object.entries(capture)) {
    if (Array.isArray(rows) && rows.length) console.log(`  ${table.padEnd(28)} ${rows.length}`);
  }
  console.log("re-read verified: OK");
}

main().catch((error) => {
  console.error(`backup-badar-record: FAILED — ${error.message}`);
  process.exit(1);
});
