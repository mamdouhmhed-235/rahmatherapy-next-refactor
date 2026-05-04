import { redirect } from "next/navigation";
import { Siren } from "lucide-react";
import { createSupabaseAdminClient } from "@/lib/supabase/admin";
import { createSupabaseServerClient } from "@/lib/supabase/server";
import { getStaffProfile, PERMISSIONS } from "@/lib/auth/rbac";
import {
  AdminAccessDenied,
  AdminPageHeader,
  AdminPanel,
  AdminStatusBadge,
} from "../components/admin-ui";
import { formatDateTime, formatLabel } from "../clients/format";
import { updateOperationalEventStatus } from "./actions";

export const metadata = {
  title: "Operational Errors - Rahma Therapy Admin",
};

interface OperationalEvent {
  id: string;
  event_type: string;
  severity: "info" | "warning" | "error";
  status: "open" | "acknowledged" | "resolved";
  summary: string;
  safe_context: Record<string, unknown>;
  booking_id: string | null;
  staff_id: string | null;
  created_at: string;
}

function canOpenOperations(profile: NonNullable<Awaited<ReturnType<typeof getStaffProfile>>>) {
  return (
    profile.permissions.has(PERMISSIONS.MANAGE_SETTINGS) ||
    profile.permissions.has(PERMISSIONS.MANAGE_EMAILS) ||
    profile.permissions.has(PERMISSIONS.MANAGE_BOOKINGS_ALL)
  );
}

export default async function OperationsPage() {
  const supabase = await createSupabaseServerClient();
  const profile = await getStaffProfile(supabase);
  if (!profile || !profile.active) redirect("/admin/login");
  if (!canOpenOperations(profile)) return <InsufficientPermissions />;

  const adminClient = createSupabaseAdminClient();
  const { data: events } = await adminClient
    .from("operational_events")
    .select("id, event_type, severity, status, summary, safe_context, booking_id, staff_id, created_at")
    .order("created_at", { ascending: false })
    .limit(100)
    .returns<OperationalEvent[]>();

  return (
    <div>
      <AdminPageHeader
        title="Operational errors"
        description="Safe production support events without raw request bodies, health notes, secrets, or full email bodies."
      />

      <AdminPanel>
        <div className="grid gap-3">
          {(events ?? []).map((event) => (
            <article key={event.id} className="rounded-lg border border-[var(--rahma-border)] p-4">
              <div className="flex flex-wrap items-start justify-between gap-3">
                <div className="min-w-0">
                  <div className="mb-2 flex flex-wrap gap-2">
                    <AdminStatusBadge value={formatLabel(event.event_type)} tone="muted" />
                    <AdminStatusBadge value={event.status} tone={event.status === "open" ? "danger" : event.status === "acknowledged" ? "warning" : "success"} />
                    <AdminStatusBadge value={event.severity} tone={event.severity === "error" ? "danger" : "warning"} />
                  </div>
                  <p className="font-medium text-[var(--rahma-charcoal)]">{event.summary}</p>
                  <p className="mt-1 text-xs text-[var(--rahma-muted)]">
                    {formatDateTime(event.created_at)}
                    {event.booking_id ? ` · booking ${event.booking_id}` : ""}
                  </p>
                  <p className="mt-2 text-xs text-[var(--rahma-muted)]">
                    Safe context: {Object.keys(event.safe_context ?? {}).join(", ") || "none"}
                  </p>
                </div>
                <Siren className="size-5 text-red-600" />
              </div>
              {event.status !== "resolved" ? (
                <div className="mt-4 flex flex-wrap gap-2">
                  {event.status === "open" ? (
                    <form action={updateOperationalEventStatus}>
                      <input type="hidden" name="event_id" value={event.id} />
                      <input type="hidden" name="status" value="acknowledged" />
                      <button className="min-h-9 rounded-md border border-[var(--rahma-border)] px-3 text-sm font-semibold text-[var(--rahma-charcoal)]">
                        Acknowledge
                      </button>
                    </form>
                  ) : null}
                  <form action={updateOperationalEventStatus}>
                    <input type="hidden" name="event_id" value={event.id} />
                    <input type="hidden" name="status" value="resolved" />
                    <button className="min-h-9 rounded-md bg-[var(--rahma-green)] px-3 text-sm font-semibold text-white">
                      Resolve
                    </button>
                  </form>
                </div>
              ) : null}
            </article>
          ))}
          {(events ?? []).length === 0 ? (
            <p className="py-10 text-center text-sm text-[var(--rahma-muted)]">
              No operational events logged.
            </p>
          ) : null}
        </div>
      </AdminPanel>
    </div>
  );
}

function InsufficientPermissions() {
  return (
    <AdminAccessDenied
      title="Operational events access limited"
      message="You need owner/admin operational permission to review support events."
      permission="manage_settings or manage_emails"
    />
  );
}
