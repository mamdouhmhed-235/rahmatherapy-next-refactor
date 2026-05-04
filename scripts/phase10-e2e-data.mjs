#!/usr/bin/env node

import fs from "node:fs";
import process from "node:process";
import { createClient } from "@supabase/supabase-js";

const MARKER = "phase10_e2e";
const PASSWORD = "Phase10-Test-2026!";
const USERS = [
  { prefix: "OWNER", email: "phase10.owner@example.test", role: "Owner", gender: "male", active: true, canTakeBookings: false },
  { prefix: "ADMIN", email: "phase10.admin@example.test", role: "Admin", gender: "female", active: true, canTakeBookings: false },
  { prefix: "COORDINATOR", email: "phase10.coordinator@example.test", role: "Phase10 Booking Coordinator", gender: "female", active: true, canTakeBookings: false },
  { prefix: "THERAPIST_A", email: "phase10.therapist.a@example.test", role: "Therapist", gender: "female", active: true, canTakeBookings: true },
  { prefix: "THERAPIST_B", email: "phase10.therapist.b@example.test", role: "Therapist", gender: "female", active: true, canTakeBookings: true },
  { prefix: "REPORTING", email: "phase10.reporting@example.test", role: "Phase10 Reporting", gender: "male", active: true, canTakeBookings: false },
  { prefix: "INACTIVE", email: "phase10.inactive@example.test", role: "Inactive", gender: "female", active: false, canTakeBookings: false },
  { prefix: "NON_STAFF", email: "phase10.nonstaff@example.test", role: null, gender: "male", active: true, canTakeBookings: false },
];

function loadEnv() {
  const envText = fs.readFileSync(".env", "utf8");
  const env = {};

  for (const line of envText.split(/\r?\n/)) {
    if (!line || line.trim().startsWith("#") || !line.includes("=")) continue;
    const separatorIndex = line.indexOf("=");
    const key = line.slice(0, separatorIndex);
    const rawValue = line.slice(separatorIndex + 1);
    env[key] = rawValue.replace(/^"|"$/g, "");
  }

  return env;
}

function createAdminClient() {
  const env = loadEnv();
  if (!env.NEXT_PUBLIC_SUPABASE_URL || !env.SUPABASE_SERVICE_ROLE_KEY) {
    throw new Error("Missing Supabase URL or service role key in .env.");
  }

  return createClient(env.NEXT_PUBLIC_SUPABASE_URL, env.SUPABASE_SERVICE_ROLE_KEY, {
    auth: {
      autoRefreshToken: false,
      persistSession: false,
    },
  });
}

async function findUserByEmail(supabase, email) {
  let page = 1;
  const perPage = 100;

  while (true) {
    const { data, error } = await supabase.auth.admin.listUsers({ page, perPage });
    if (error) throw new Error(`Failed to list auth users: ${error.message}`);

    const user = data.users.find(
      (candidate) => candidate.email?.trim().toLowerCase() === email.toLowerCase()
    );

    if (user) return user;
    if (data.users.length < perPage) return null;
    page += 1;
  }
}

async function ensureUser(supabase, user) {
  const existing = await findUserByEmail(supabase, user.email);
  if (existing) return existing;

  const { data, error } = await supabase.auth.admin.createUser({
    email: user.email,
    password: PASSWORD,
    email_confirm: true,
    user_metadata: { purpose: MARKER },
  });

  if (error || !data.user) {
    throw new Error(`Failed to create ${user.email}: ${error?.message ?? "missing user"}`);
  }

  return data.user;
}

async function deleteUsers(supabase) {
  for (const user of USERS) {
    const existing = await findUserByEmail(supabase, user.email);
    if (existing) {
      const { error } = await supabase.auth.admin.deleteUser(existing.id);
      if (error) throw new Error(`Failed to delete ${user.email}: ${error.message}`);
    }
  }
}

async function getRoleMap(supabase) {
  const { data, error } = await supabase.from("roles").select("id, name");
  if (error) throw new Error(`Failed to load roles: ${error.message}`);
  return new Map((data ?? []).map((role) => [role.name, role.id]));
}

async function getPermissionMap(supabase) {
  const { data, error } = await supabase.from("permissions").select("id, name");
  if (error) throw new Error(`Failed to load permissions: ${error.message}`);
  return new Map((data ?? []).map((permission) => [permission.name, permission.id]));
}

async function ensureTestRoles(supabase) {
  const roles = [
    {
      name: "Phase10 Booking Coordinator",
      description: `${MARKER} temporary limited booking/client workflow role.`,
      permissions: [
        "view_dashboard",
        "manage_bookings_own",
        "view_all_bookings",
        "view_own_bookings",
        "manage_clients",
        "view_clients",
      ],
    },
    {
      name: "Phase10 Reporting",
      description: `${MARKER} temporary read-only reporting role.`,
      permissions: ["view_dashboard", "view_reports"],
    },
  ];

  for (const role of roles) {
    const { error } = await supabase
      .from("roles")
      .upsert({ name: role.name, description: role.description }, { onConflict: "name" });
    if (error) throw new Error(`Failed to upsert role ${role.name}: ${error.message}`);
  }

  const roleMap = await getRoleMap(supabase);
  const permissionMap = await getPermissionMap(supabase);

  for (const role of roles) {
    const roleId = roleMap.get(role.name);
    if (!roleId) throw new Error(`Missing role ${role.name}.`);

    const rows = role.permissions.map((name) => {
      const permissionId = permissionMap.get(name);
      if (!permissionId) throw new Error(`Missing permission ${name}.`);
      return { role_id: roleId, permission_id: permissionId };
    });

    const { error } = await supabase.from("role_permissions").upsert(rows, {
      onConflict: "role_id,permission_id",
    });
    if (error) throw new Error(`Failed to upsert permissions for ${role.name}: ${error.message}`);
  }
}

async function cleanup(supabase) {
  const { data: clientRows } = await supabase
    .from("clients")
    .select("id")
    .eq("source_detail", MARKER);
  const clientIds = (clientRows ?? []).map((client) => client.id);

  if (clientIds.length > 0) {
    const { data: bookingRows } = await supabase
      .from("bookings")
      .select("id")
      .in("client_id", clientIds);
    const bookingIds = (bookingRows ?? []).map((booking) => booking.id);

    if (bookingIds.length > 0) {
      await supabase.from("email_delivery_events").delete().in("booking_id", bookingIds);
      await supabase.from("operational_events").delete().in("booking_id", bookingIds);
      await supabase.from("audit_logs").delete().in("target_id", bookingIds);
      await supabase.from("bookings").delete().in("id", bookingIds);
    }

    await supabase.from("enquiries").delete().in("client_id", clientIds);
    await supabase.from("client_privacy_requests").delete().in("client_id", clientIds);
    await supabase.from("client_notes").delete().in("client_id", clientIds);
    await supabase.from("clients").delete().in("id", clientIds);
  }

  const testEmails = USERS.map((user) => user.email);
  const { data: staffRows } = await supabase
    .from("staff_profiles")
    .select("id")
    .in("email", testEmails);
  const staffIds = (staffRows ?? []).map((staff) => staff.id);

  if (staffIds.length > 0) {
    await supabase.from("staff_availability_rules").delete().in("staff_id", staffIds);
    await supabase.from("staff_permission_overrides").delete().in("staff_id", staffIds);
    await supabase.from("audit_logs").delete().in("actor_staff_id", staffIds);
    await supabase.from("staff_profiles").delete().in("id", staffIds);
  }

  const roleNames = ["Phase10 Booking Coordinator", "Phase10 Reporting"];
  const roleMap = await getRoleMap(supabase);
  const roleIds = roleNames.map((name) => roleMap.get(name)).filter(Boolean);
  if (roleIds.length > 0) {
    await supabase.from("role_permissions").delete().in("role_id", roleIds);
    await supabase.from("roles").delete().in("id", roleIds);
  }

  await deleteUsers(supabase);
}

async function setup(supabase) {
  await cleanup(supabase);
  await ensureTestRoles(supabase);

  const roleMap = await getRoleMap(supabase);
  const createdUsers = new Map();

  for (const user of USERS) {
    createdUsers.set(user.email, await ensureUser(supabase, user));
  }

  for (const user of USERS.filter((item) => item.role)) {
    const authUser = createdUsers.get(user.email);
    const roleId = roleMap.get(user.role);
    if (!roleId) throw new Error(`Missing role ${user.role}.`);

    const { error } = await supabase.from("staff_profiles").insert({
      auth_user_id: authUser.id,
      name: `Phase10 ${user.prefix.replaceAll("_", " ")}`,
      email: user.email,
      role_id: roleId,
      gender: user.gender,
      active: user.active,
      can_take_bookings: user.canTakeBookings,
      availability_mode: "use_global",
    });
    if (error) throw new Error(`Failed to create staff profile ${user.email}: ${error.message}`);
  }

  const { data: staffRows, error: staffError } = await supabase
    .from("staff_profiles")
    .select("id, email")
    .in("email", USERS.map((user) => user.email));
  if (staffError) throw new Error(`Failed to load test staff: ${staffError.message}`);
  const staffByEmail = new Map((staffRows ?? []).map((staff) => [staff.email, staff.id]));

  const { data: service, error: serviceError } = await supabase
    .from("services")
    .select("id, name, price, duration_mins")
    .eq("slug", "hijama-package")
    .single();
  if (serviceError || !service) {
    throw new Error(`Missing hijama-package service: ${serviceError?.message ?? "not found"}`);
  }

  const { data: client, error: clientError } = await supabase
    .from("clients")
    .insert({
      full_name: "Phase10 E2E Claim Client",
      phone: "07123456789",
      email: "phase10.claim.client@example.test",
      address: "10 Phase Street",
      postcode: "LU1 1AA",
      notes: MARKER,
      client_source: "manual",
      source_detail: MARKER,
    })
    .select("id")
    .single();
  if (clientError || !client) {
    throw new Error(`Failed to create claim client: ${clientError?.message ?? "missing client"}`);
  }

  const bookingDate = new Date(Date.now() + 14 * 24 * 60 * 60 * 1000)
    .toISOString()
    .slice(0, 10);
  const { data: booking, error: bookingError } = await supabase
    .from("bookings")
    .insert({
      client_id: client.id,
      booking_date: bookingDate,
      start_time: "10:00",
      end_time: "11:00",
      total_duration_mins: 60,
      total_price: service.price,
      amount_due: service.price,
      amount_paid: 0,
      contact_full_name: "Phase10 E2E Claim Client",
      contact_email: "phase10.claim.client@example.test",
      contact_phone: "07123456789",
      booking_source: "manual",
      payment_status: "unpaid",
      status: "pending",
      assignment_status: "unassigned",
      group_booking: false,
      service_address_line1: "10 Phase Street",
      service_city: "Luton",
      service_postcode: "LU1 1AA",
      access_notes: MARKER,
      customer_notes: MARKER,
      consent_acknowledged: true,
      health_notes: "Phase10 safe test health note",
    })
    .select("id")
    .single();
  if (bookingError || !booking) {
    throw new Error(`Failed to create claim booking: ${bookingError?.message ?? "missing booking"}`);
  }

  const { data: participant, error: participantError } = await supabase
    .from("booking_participants")
    .insert({
      booking_id: booking.id,
      participant_gender: "female",
      required_therapist_gender: "female",
      is_main_contact: true,
      display_name: "Phase10 Claim Participant",
      participant_notes: MARKER,
      health_notes: "Phase10 safe participant health note",
      consent_acknowledged: true,
    })
    .select("id")
    .single();
  if (participantError || !participant) {
    throw new Error(`Failed to create participant: ${participantError?.message ?? "missing participant"}`);
  }

  const { error: itemError } = await supabase.from("booking_items").insert({
    booking_id: booking.id,
    booking_participant_id: participant.id,
    service_id: service.id,
    service_name_snapshot: service.name,
    service_price_snapshot: service.price,
    service_duration_snapshot: service.duration_mins,
  });
  if (itemError) throw new Error(`Failed to create booking item: ${itemError.message}`);

  const { data: assignment, error: assignmentError } = await supabase
    .from("booking_assignments")
    .insert({
      booking_id: booking.id,
      participant_id: participant.id,
      assigned_staff_id: null,
      required_therapist_gender: "female",
      status: "unassigned",
    })
    .select("id")
    .single();
  if (assignmentError || !assignment) {
    throw new Error(`Failed to create assignment: ${assignmentError?.message ?? "missing assignment"}`);
  }

  const ownerStaffId = staffByEmail.get("phase10.owner@example.test");
  await supabase.from("enquiries").insert({
    client_id: client.id,
    source: "whatsapp",
    status: "new",
    full_name: "Phase10 E2E Enquiry",
    phone: "07123456788",
    email: "phase10.enquiry@example.test",
    service_interest: "Hijama Package",
    notes: MARKER,
    created_by_staff_id: ownerStaffId,
  });
  await supabase.from("client_privacy_requests").insert({
    client_id: client.id,
    request_type: "data_export",
    request_note: MARKER,
    created_by_staff_id: ownerStaffId,
  });

  const env = {
    E2E_OWNER_EMAIL: "phase10.owner@example.test",
    E2E_OWNER_PASSWORD: PASSWORD,
    E2E_ADMIN_EMAIL: "phase10.admin@example.test",
    E2E_ADMIN_PASSWORD: PASSWORD,
    E2E_COORDINATOR_EMAIL: "phase10.coordinator@example.test",
    E2E_COORDINATOR_PASSWORD: PASSWORD,
    E2E_THERAPIST_A_EMAIL: "phase10.therapist.a@example.test",
    E2E_THERAPIST_A_PASSWORD: PASSWORD,
    E2E_THERAPIST_B_EMAIL: "phase10.therapist.b@example.test",
    E2E_THERAPIST_B_PASSWORD: PASSWORD,
    E2E_REPORTING_EMAIL: "phase10.reporting@example.test",
    E2E_REPORTING_PASSWORD: PASSWORD,
    E2E_INACTIVE_EMAIL: "phase10.inactive@example.test",
    E2E_INACTIVE_PASSWORD: PASSWORD,
    E2E_NON_STAFF_EMAIL: "phase10.nonstaff@example.test",
    E2E_NON_STAFF_PASSWORD: PASSWORD,
    E2E_CLAIMABLE_BOOKING_PATH: `/admin/bookings/${booking.id}`,
  };

  console.log(JSON.stringify({ marker: MARKER, bookingId: booking.id, assignmentId: assignment.id, env }, null, 2));
}

const command = process.argv[2] ?? "setup";
const supabase = createAdminClient();

try {
  if (command === "setup") {
    await setup(supabase);
  } else if (command === "cleanup") {
    await cleanup(supabase);
    console.log(JSON.stringify({ marker: MARKER, cleaned: true }, null, 2));
  } else {
    throw new Error(`Unknown command: ${command}`);
  }
} catch (error) {
  console.error(error instanceof Error ? error.message : error);
  process.exitCode = 1;
}
