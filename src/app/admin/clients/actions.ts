"use server";

import { revalidatePath, updateTag } from "next/cache";
import { redirect } from "next/navigation";
import { z } from "zod/v4";
import { createSupabaseAdminClient } from "@/lib/supabase/admin";
import { createSupabaseServerClient } from "@/lib/supabase/server";
import {
  canManageAllClients,
  canManageClientIdentityFields,
  getStaffProfile,
  PERMISSIONS,
  requirePermission,
} from "@/lib/auth/rbac";
import { getClientDataAccess } from "./access";

const CLIENT_SOURCES = [
  "website",
  "phone",
  "whatsapp",
  "instagram",
  "referral",
  "manual",
  "other",
] as const;

const GENDER_PREFERENCES = ["no_preference", "female", "male"] as const;

/**
 * Identity fields (brief §3 RBAC matrix): editable only by an actor holding
 * `manage_client_identity_fields`. Everything else on the record is
 * operational and editable by any client manager.
 */
const CLIENT_IDENTITY_FIELDS = [
  "full_name",
  "email",
  "gender_preference",
] as const;

const CLIENT_EDIT_COLUMNS =
  "id, full_name, phone, email, gender_preference, address, postcode, city, area, client_source, source_detail, notes, updated_at";

interface ClientEditableRow {
  id: string;
  full_name: string;
  phone: string | null;
  email: string | null;
  gender_preference: string;
  address: string | null;
  postcode: string | null;
  city: string | null;
  area: string | null;
  client_source: string;
  source_detail: string | null;
  notes: string | null;
  updated_at: string;
}

const PRIVACY_REQUEST_TYPES = [
  "data_export",
  "correction",
  "deletion_review",
  "sensitive_note_review",
] as const;

export interface ClientActionState {
  error?: string;
  fieldErrors?: Record<string, string>;
  duplicateWarning?: string;
  success?: boolean;
}

const clientSchema = z.object({
  full_name: z.string().trim().min(1, "Full name is required."),
  phone: z.string().trim().optional(),
  email: z.union([z.email("Enter a valid email."), z.literal("")]).optional(),
  address: z.string().trim().optional(),
  postcode: z.string().trim().optional(),
  city: z.string().trim().optional(),
  area: z.string().trim().optional(),
  client_source: z.enum(CLIENT_SOURCES),
  source_detail: z.string().trim().optional(),
  notes: z.string().trim().optional(),
});

const clientUpdateSchema = clientSchema.extend({
  gender_preference: z.enum(GENDER_PREFERENCES),
});

async function requireClientManager() {
  const supabase = await createSupabaseServerClient();
  const profile = await getStaffProfile(supabase);
  if (!profile || !profile.active || !canManageAllClients(profile)) {
    throw new Error("Insufficient permissions.");
  }
  return profile;
}

async function requireClientNoteActor() {
  const supabase = await createSupabaseServerClient();
  const profile = await getStaffProfile(supabase);
  if (!profile?.active) {
    throw new Error("Insufficient permissions.");
  }
  return profile;
}

async function requirePrivacyManager() {
  const supabase = await createSupabaseServerClient();
  return requirePermission(PERMISSIONS.MANAGE_PRIVACY_OPERATIONS, supabase);
}

function normalizeEmail(value: string | undefined) {
  const email = value?.trim().toLowerCase();
  return email || null;
}

function normalizePhone(value: string | undefined) {
  return value?.replace(/\s+/g, " ").trim() || null;
}

async function hasAssignedClientBooking(
  clientId: string,
  staffId: string,
  adminClient: ReturnType<typeof createSupabaseAdminClient>
) {
  const { data: bookings, error: bookingsError } = await adminClient
    .from("bookings")
    .select("id")
    .eq("client_id", clientId);
  if (bookingsError || !bookings || bookings.length === 0) return false;

  const { count, error } = await adminClient
    .from("booking_assignments")
    .select("id", { count: "exact", head: true })
    .in(
      "booking_id",
      bookings.map((booking) => booking.id)
    )
    .eq("assigned_staff_id", staffId);

  return !error && (count ?? 0) > 0;
}

function toFieldErrors(error: z.ZodError) {
  return Object.fromEntries(
    Object.entries(z.flattenError(error).fieldErrors).map(([key, value]) => [
      key,
      (value as string[] | undefined)?.[0] ?? "Invalid value.",
    ])
  );
}

export async function createClient(
  _previousState: ClientActionState,
  formData: FormData
): Promise<ClientActionState> {
  let actor;
  try {
    actor = await requireClientManager();
  } catch {
    return { error: "Insufficient permissions." };
  }

  const parsed = clientSchema.safeParse({
    full_name: formData.get("full_name"),
    phone: formData.get("phone"),
    email: formData.get("email"),
    address: formData.get("address"),
    postcode: formData.get("postcode"),
    city: formData.get("city"),
    area: formData.get("area"),
    client_source: formData.get("client_source"),
    source_detail: formData.get("source_detail"),
    notes: formData.get("notes"),
  });

  if (!parsed.success) {
    return {
      error: "Check the client details.",
      fieldErrors: toFieldErrors(parsed.error),
    };
  }

  const adminClient = createSupabaseAdminClient();
  const email = normalizeEmail(parsed.data.email);
  const phone = normalizePhone(parsed.data.phone);
  const confirmDuplicate = formData.get("confirm_duplicate") === "on";

  if (email || phone) {
    const [emailMatches, phoneMatches] = await Promise.all([
      email
        ? adminClient
            .from("clients")
            .select("id, full_name, email, phone")
            .eq("email", email)
            .limit(5)
        : Promise.resolve({ data: [], error: null }),
      phone
        ? adminClient
            .from("clients")
            .select("id, full_name, email, phone")
            .eq("phone", phone)
            .limit(5)
        : Promise.resolve({ data: [], error: null }),
    ]);
    if (emailMatches.error) return { error: emailMatches.error.message };
    if (phoneMatches.error) return { error: phoneMatches.error.message };

    const matchesById = new Map(
      [...(emailMatches.data ?? []), ...(phoneMatches.data ?? [])].map(
        (client) => [client.id, client]
      )
    );
    const matches = [...matchesById.values()];

    if (matches.length > 0 && !confirmDuplicate) {
      return {
        duplicateWarning: matches
          .map((client) => `${client.full_name} (${client.email ?? client.phone ?? "no contact"})`)
          .join(", "),
      };
    }
  }

  const payload = {
    full_name: parsed.data.full_name,
    phone,
    email,
    address: parsed.data.address || null,
    postcode: parsed.data.postcode || null,
    city: parsed.data.city || null,
    area: parsed.data.area || null,
    client_source: parsed.data.client_source,
    source_detail: parsed.data.source_detail || null,
    notes: parsed.data.notes || null,
  };

  const { data, error } = await adminClient
    .from("clients")
    .insert(payload)
    .select("id")
    .single();

  if (error) return { error: error.message };

  await adminClient.from("audit_logs").insert({
    actor_staff_id: actor.id,
    action_type: "client_created",
    target_type: "clients",
    target_id: data.id,
    after_state: payload,
  });

  updateTag("report-data");
  updateTag("dashboard-data");
  revalidatePath("/admin/clients");
  revalidatePath("/admin/dashboard");
  redirect(`/admin/clients/${data.id}`);
}

export async function updateClient(
  _previousState: ClientActionState,
  formData: FormData
): Promise<ClientActionState> {
  let actor;
  try {
    actor = await requireClientManager();
  } catch {
    return { error: "Insufficient permissions." };
  }

  const clientId = String(formData.get("client_id") ?? "").trim();
  const updatedAtToken = String(formData.get("client_updated_at") ?? "").trim();
  if (!clientId) return { error: "Client is required." };

  const parsed = clientUpdateSchema.safeParse({
    full_name: formData.get("full_name"),
    phone: formData.get("phone"),
    email: formData.get("email"),
    gender_preference: formData.get("gender_preference"),
    address: formData.get("address"),
    postcode: formData.get("postcode"),
    city: formData.get("city"),
    area: formData.get("area"),
    client_source: formData.get("client_source"),
    source_detail: formData.get("source_detail"),
    notes: formData.get("notes"),
  });

  if (!parsed.success) {
    return {
      error: "Check the client details.",
      fieldErrors: toFieldErrors(parsed.error),
    };
  }

  const adminClient = createSupabaseAdminClient();
  const { data: current, error: currentError } = await adminClient
    .from("clients")
    .select(CLIENT_EDIT_COLUMNS)
    .eq("id", clientId)
    .single<ClientEditableRow>();

  if (currentError || !current) {
    return { error: "This client record could not be loaded. Reload and try again." };
  }

  // Optimistic concurrency (brief §5.6). `clients.updated_at` is stamped by the
  // clients_updated_at trigger on every write, so a stale token means someone
  // else saved between this form loading and submitting.
  if (updatedAtToken !== current.updated_at) {
    return {
      error: "This client was updated by someone else. Reload to see the latest.",
    };
  }

  const patch: Record<string, string | null> = {
    full_name: parsed.data.full_name,
    email: normalizeEmail(parsed.data.email),
    gender_preference: parsed.data.gender_preference,
    phone: normalizePhone(parsed.data.phone),
    address: parsed.data.address || null,
    postcode: parsed.data.postcode || null,
    city: parsed.data.city || null,
    area: parsed.data.area || null,
    client_source: parsed.data.client_source,
    source_detail: parsed.data.source_detail || null,
    notes: parsed.data.notes || null,
  };

  // Field-level gate. The form already renders these read-only for actors
  // without the permission; dropping them here is the belt to that braces —
  // a hand-crafted POST gets the same treatment as the UI.
  if (!canManageClientIdentityFields(actor)) {
    for (const field of CLIENT_IDENTITY_FIELDS) {
      delete patch[field];
    }
  }

  if (patch.email && patch.email !== current.email) {
    const { data: clash, error: clashError } = await adminClient
      .from("clients")
      .select("id, full_name")
      .eq("email", patch.email)
      .neq("id", clientId)
      .limit(1)
      .maybeSingle<{ id: string; full_name: string }>();
    if (clashError) return { error: clashError.message };
    if (clash) {
      return {
        error: `Email already in use by ${clash.full_name}. Resolve manually.`,
      };
    }
  }

  const changed = Object.fromEntries(
    Object.entries(patch).filter(
      ([field, value]) => value !== current[field as keyof ClientEditableRow]
    )
  );

  if (Object.keys(changed).length > 0) {
    const { error: updateError } = await adminClient
      .from("clients")
      .update(changed)
      .eq("id", clientId);
    if (updateError) return { error: updateError.message };

    await adminClient.from("audit_logs").insert({
      actor_staff_id: actor.id,
      action_type: "client_updated",
      target_type: "clients",
      target_id: clientId,
      before_state: current,
      after_state: changed,
    });
  }

  updateTag("clients");
  updateTag("audit");
  revalidatePath("/admin/clients");
  revalidatePath(`/admin/clients/${clientId}`);
  redirect(`/admin/clients/${clientId}?updated=1`);
}

export async function addClientNote(
  _previousState: ClientActionState,
  formData: FormData
): Promise<ClientActionState> {
  let actor;
  try {
    actor = await requireClientNoteActor();
  } catch {
    return { error: "Insufficient permissions." };
  }

  const clientId = String(formData.get("client_id") ?? "").trim();
  const note = String(formData.get("note") ?? "").trim();
  if (!clientId) return { error: "Client is required." };
  if (!note) return { fieldErrors: { note: "Note is required." } };

  const adminClient = createSupabaseAdminClient();
  const hasAssignedBooking = await hasAssignedClientBooking(
    clientId,
    actor.id,
    adminClient
  );
  const access = getClientDataAccess(actor, { hasAssignedBooking });
  if (!access.canViewClient || !access.canCreateClientNote) {
    return { error: "Insufficient permissions." };
  }

  const { data, error } = await adminClient
    .from("client_notes")
    .insert({
      client_id: clientId,
      author_staff_id: actor.id,
      note,
      is_sensitive: access.canCreateSensitiveNote,
    })
    .select()
    .single();

  if (error) return { error: error.message };

  await adminClient.from("audit_logs").insert({
    actor_staff_id: actor.id,
    action_type: "client_note_added",
    target_type: "client_notes",
    target_id: data.id,
    after_state: { client_id: clientId, is_sensitive: true },
  });

  revalidatePath(`/admin/clients/${clientId}`);
  return { success: true };
}

export async function createClientPrivacyRequest(
  _previousState: ClientActionState,
  formData: FormData
): Promise<ClientActionState> {
  let actor;
  try {
    actor = await requirePrivacyManager();
  } catch {
    return { error: "Insufficient permissions." };
  }

  const clientId = String(formData.get("client_id") ?? "").trim();
  const requestType = String(formData.get("request_type") ?? "");
  const requestNote = String(formData.get("request_note") ?? "").trim();
  if (!clientId) return { error: "Client is required." };
  if (!PRIVACY_REQUEST_TYPES.includes(requestType as (typeof PRIVACY_REQUEST_TYPES)[number])) {
    return { fieldErrors: { request_type: "Choose a valid privacy request." } };
  }

  const adminClient = createSupabaseAdminClient();
  const access = getClientDataAccess(actor, { hasAssignedBooking: false });
  if (!access.canViewClient || !access.canManagePrivacyOperations) {
    return { error: "Insufficient permissions." };
  }

  const { data, error } = await adminClient
    .from("client_privacy_requests")
    .insert({
      client_id: clientId,
      request_type: requestType,
      request_note: requestNote || null,
      created_by_staff_id: actor.id,
    })
    .select()
    .single();

  if (error) return { error: error.message };

  await adminClient.from("audit_logs").insert({
    actor_staff_id: actor.id,
    action_type: "client_privacy_request_created",
    target_type: "client_privacy_requests",
    target_id: data.id,
    after_state: data,
  });

  revalidatePath(`/admin/clients/${clientId}`);
  return { success: true };
}
