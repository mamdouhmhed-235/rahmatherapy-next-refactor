"use server";

/**
 * R4 redesign 2026-05-21 — server actions that write to public.notification_state.
 *
 * Replaces the previous localStorage-only state model. Follows the project's
 * established convention (see staff/[staffId]/availability/actions.ts and
 * phase16_service_role_grants.sql): the cookie-scoped server client resolves
 * the caller's staff_profile, then the admin client performs the actual write
 * with staff_id manually scoped to that profile. The RLS policies on
 * notification_state are defence-in-depth but unused on this admin-client
 * path; only service_role has table-level DML grants.
 *
 * notification_id is a stable derived hash like 'booking:<uuid>:unassigned' —
 * emitted by nav-notifications.ts and grouped by (type, severity, reason) in
 * the centre UI.
 *
 * After every successful write, revalidatePath("/admin") so the next layout
 * fetch reflects the change. The realtime subscription in step 5 will push the
 * change to other tabs/devices within ~200ms; revalidate handles same-tab.
 */

import { revalidatePath } from "next/cache";
import { createSupabaseAdminClient } from "@/lib/supabase/admin";
import { createSupabaseServerClient } from "@/lib/supabase/server";
import { getStaffProfile } from "@/lib/auth/rbac";

// Defensive cap so a malformed client can't write 1MB strings into the PK.
// Real derived IDs are <100 chars (resource:uuid:reason).
const NOTIFICATION_ID_MAX = 200;

export type NotificationActionResult = { ok: true } | { ok: false; error: string };

function validateNotificationId(id: unknown): string | null {
  if (typeof id !== "string") return null;
  const trimmed = id.trim();
  if (trimmed.length === 0 || trimmed.length > NOTIFICATION_ID_MAX) return null;
  return trimmed;
}

/**
 * Validate snooze time. Must be a future ISO timestamp within a reasonable
 * window (≤ 365 days out) so a client can't pin something to year 9999.
 */
function validateSnoozeUntil(value: unknown): string | null {
  if (typeof value !== "string") return null;
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) return null;
  const now = Date.now();
  const max = now + 365 * 24 * 60 * 60 * 1000;
  if (date.getTime() <= now || date.getTime() > max) return null;
  return date.toISOString();
}

/**
 * Resolve the active staff profile from the cookie session, then return the
 * admin client for the actual write. Mirrors ensureStaffAvailabilityActor in
 * staff/[staffId]/availability/actions.ts.
 */
async function authenticate() {
  const supabase = await createSupabaseServerClient();
  const profile = await getStaffProfile(supabase);
  if (!profile || !profile.active) {
    return { ok: false as const, error: "Sign in to manage notifications." };
  }
  const adminClient = createSupabaseAdminClient();
  return { ok: true as const, adminClient, profile };
}

// ─── Read / unread ────────────────────────────────────────────────────────────

export async function markNotificationRead(
  notificationId: string
): Promise<NotificationActionResult> {
  const id = validateNotificationId(notificationId);
  if (!id) return { ok: false, error: "Invalid notification reference." };
  const auth = await authenticate();
  if (!auth.ok) return auth;
  const now = new Date().toISOString();
  const { error } = await auth.adminClient.from("notification_state").upsert(
    {
      staff_id: auth.profile.id,
      notification_id: id,
      read_at: now,
      updated_at: now,
    },
    { onConflict: "staff_id,notification_id" }
  );
  if (error) return { ok: false, error: error.message };
  revalidatePath("/admin");
  return { ok: true };
}

export async function markNotificationUnread(
  notificationId: string
): Promise<NotificationActionResult> {
  const id = validateNotificationId(notificationId);
  if (!id) return { ok: false, error: "Invalid notification reference." };
  const auth = await authenticate();
  if (!auth.ok) return auth;
  const now = new Date().toISOString();
  const { error } = await auth.adminClient.from("notification_state").upsert(
    {
      staff_id: auth.profile.id,
      notification_id: id,
      read_at: null,
      updated_at: now,
    },
    { onConflict: "staff_id,notification_id" }
  );
  if (error) return { ok: false, error: error.message };
  revalidatePath("/admin");
  return { ok: true };
}

/**
 * Batch-mark all given notification IDs as read. Used by the "Mark all read"
 * header button — caller passes the currently-visible unread IDs.
 */
export async function markAllNotificationsRead(
  notificationIds: string[]
): Promise<NotificationActionResult> {
  if (!Array.isArray(notificationIds) || notificationIds.length === 0) {
    return { ok: true };
  }
  const ids = notificationIds
    .map(validateNotificationId)
    .filter((id): id is string => typeof id === "string");
  if (ids.length === 0) return { ok: true };
  const auth = await authenticate();
  if (!auth.ok) return auth;
  const now = new Date().toISOString();
  const rows = ids.map((notification_id) => ({
    staff_id: auth.profile.id,
    notification_id,
    read_at: now,
    updated_at: now,
  }));
  const { error } = await auth.adminClient
    .from("notification_state")
    .upsert(rows, { onConflict: "staff_id,notification_id" });
  if (error) return { ok: false, error: error.message };
  revalidatePath("/admin");
  return { ok: true };
}

// ─── Snooze / unsnooze ────────────────────────────────────────────────────────

export async function snoozeNotification(
  notificationId: string,
  snoozedUntil: string
): Promise<NotificationActionResult> {
  const id = validateNotificationId(notificationId);
  if (!id) return { ok: false, error: "Invalid notification reference." };
  const until = validateSnoozeUntil(snoozedUntil);
  if (!until) return { ok: false, error: "Pick a snooze time in the future." };
  const auth = await authenticate();
  if (!auth.ok) return auth;
  const now = new Date().toISOString();
  const { error } = await auth.adminClient.from("notification_state").upsert(
    {
      staff_id: auth.profile.id,
      notification_id: id,
      snoozed_until: until,
      updated_at: now,
    },
    { onConflict: "staff_id,notification_id" }
  );
  if (error) return { ok: false, error: error.message };
  revalidatePath("/admin");
  return { ok: true };
}

export async function unsnoozeNotification(
  notificationId: string
): Promise<NotificationActionResult> {
  const id = validateNotificationId(notificationId);
  if (!id) return { ok: false, error: "Invalid notification reference." };
  const auth = await authenticate();
  if (!auth.ok) return auth;
  const now = new Date().toISOString();
  const { error } = await auth.adminClient.from("notification_state").upsert(
    {
      staff_id: auth.profile.id,
      notification_id: id,
      snoozed_until: null,
      updated_at: now,
    },
    { onConflict: "staff_id,notification_id" }
  );
  if (error) return { ok: false, error: error.message };
  revalidatePath("/admin");
  return { ok: true };
}

// ─── Archive / unarchive ──────────────────────────────────────────────────────

export async function archiveNotification(
  notificationId: string
): Promise<NotificationActionResult> {
  const id = validateNotificationId(notificationId);
  if (!id) return { ok: false, error: "Invalid notification reference." };
  const auth = await authenticate();
  if (!auth.ok) return auth;
  const now = new Date().toISOString();
  const { error } = await auth.adminClient.from("notification_state").upsert(
    {
      staff_id: auth.profile.id,
      notification_id: id,
      archived_at: now,
      updated_at: now,
    },
    { onConflict: "staff_id,notification_id" }
  );
  if (error) return { ok: false, error: error.message };
  revalidatePath("/admin");
  return { ok: true };
}

export async function unarchiveNotification(
  notificationId: string
): Promise<NotificationActionResult> {
  const id = validateNotificationId(notificationId);
  if (!id) return { ok: false, error: "Invalid notification reference." };
  const auth = await authenticate();
  if (!auth.ok) return auth;
  const now = new Date().toISOString();
  const { error } = await auth.adminClient.from("notification_state").upsert(
    {
      staff_id: auth.profile.id,
      notification_id: id,
      archived_at: null,
      updated_at: now,
    },
    { onConflict: "staff_id,notification_id" }
  );
  if (error) return { ok: false, error: error.message };
  revalidatePath("/admin");
  return { ok: true };
}

// ─── Legacy localStorage → server one-time migration (consumed in step 7) ────

/**
 * One-time post-deploy migration. Reads legacy localStorage IDs out of the
 * client and persists them server-side. Read IDs become read_at = now();
 * dismissed IDs become archived_at = now(). Caller gates with a sentinel key
 * so this only fires once per user per device.
 */
export async function migrateLegacyNotificationState(input: {
  readIds: string[];
  dismissedIds: string[];
}): Promise<NotificationActionResult> {
  const readIds = (input.readIds ?? [])
    .map(validateNotificationId)
    .filter((id): id is string => typeof id === "string");
  const dismissedIds = (input.dismissedIds ?? [])
    .map(validateNotificationId)
    .filter((id): id is string => typeof id === "string");
  if (readIds.length === 0 && dismissedIds.length === 0) {
    return { ok: true };
  }
  const auth = await authenticate();
  if (!auth.ok) return auth;
  const now = new Date().toISOString();
  // Merge into a single upsert. If the same notification_id appears in both
  // read and dismissed (rare), dismissed wins — archived state is the more
  // intentional discard.
  const merged = new Map<string, { read_at: string | null; archived_at: string | null }>();
  for (const id of readIds) merged.set(id, { read_at: now, archived_at: null });
  for (const id of dismissedIds) merged.set(id, { read_at: now, archived_at: now });
  const rows = Array.from(merged.entries()).map(([notification_id, flags]) => ({
    staff_id: auth.profile.id,
    notification_id,
    read_at: flags.read_at,
    archived_at: flags.archived_at,
    updated_at: now,
  }));
  const { error } = await auth.adminClient
    .from("notification_state")
    .upsert(rows, { onConflict: "staff_id,notification_id" });
  if (error) return { ok: false, error: error.message };
  revalidatePath("/admin");
  return { ok: true };
}
