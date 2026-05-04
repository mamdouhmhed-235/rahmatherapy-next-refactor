"use server";

import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";
import { z } from "zod/v4";
import { createSupabaseAdminClient } from "@/lib/supabase/admin";
import { createSupabaseServerClient } from "@/lib/supabase/server";
import { PERMISSIONS, requirePermission } from "@/lib/auth/rbac";

const CLIENT_SOURCES = [
  "website",
  "phone",
  "whatsapp",
  "instagram",
  "referral",
  "manual",
  "other",
] as const;

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
  client_source: z.enum(CLIENT_SOURCES),
  source_detail: z.string().trim().optional(),
  notes: z.string().trim().optional(),
});

async function requireClientManager() {
  const supabase = await createSupabaseServerClient();
  return requirePermission(PERMISSIONS.MANAGE_CLIENTS, supabase);
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
    actor = await requirePrivacyManager();
  } catch {
    return { error: "Insufficient permissions." };
  }

  const parsed = clientSchema.safeParse({
    full_name: formData.get("full_name"),
    phone: formData.get("phone"),
    email: formData.get("email"),
    address: formData.get("address"),
    postcode: formData.get("postcode"),
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

  revalidatePath("/admin/clients");
  redirect(`/admin/clients/${data.id}`);
}

export async function addClientNote(
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
  const note = String(formData.get("note") ?? "").trim();
  if (!clientId) return { error: "Client is required." };
  if (!note) return { fieldErrors: { note: "Note is required." } };

  const adminClient = createSupabaseAdminClient();
  const { data, error } = await adminClient
    .from("client_notes")
    .insert({
      client_id: clientId,
      author_staff_id: actor.id,
      note,
      is_sensitive: true,
    })
    .select()
    .single();

  if (error) return { error: error.message };

  await adminClient.from("audit_logs").insert({
    actor_staff_id: actor.id,
    action_type: "client_note_created",
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
    actor = await requireClientManager();
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
