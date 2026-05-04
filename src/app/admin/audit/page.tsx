import { redirect } from "next/navigation";
import { ShieldCheck } from "lucide-react";
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

export const metadata = {
  title: "Audit Log - Rahma Therapy Admin",
};

interface AuditEvent {
  id: string;
  action_type: string;
  target_type: string | null;
  target_id: string | null;
  actor_staff_id: string | null;
  before_state: Record<string, unknown> | null;
  after_state: Record<string, unknown> | null;
  created_at: string;
}

export default async function AuditPage() {
  const supabase = await createSupabaseServerClient();
  const profile = await getStaffProfile(supabase);
  if (!profile || !profile.active) redirect("/admin/login");
  if (!profile.permissions.has(PERMISSIONS.MANAGE_AUDIT_LOGS)) {
    return <InsufficientPermissions />;
  }

  const adminClient = createSupabaseAdminClient();
  const [{ data: events }, { data: staff }] = await Promise.all([
    adminClient
      .from("audit_logs")
      .select("*")
      .order("created_at", { ascending: false })
      .limit(100)
      .returns<AuditEvent[]>(),
    adminClient.from("staff_profiles").select("id, name"),
  ]);
  const staffNames = new Map((staff ?? []).map((member) => [member.id, member.name]));

  return (
    <div>
      <AdminPageHeader
        title="Audit log"
        description="Permission-gated operational audit trail with safe before/after summaries."
      />

      <AdminPanel>
        <div className="grid gap-3">
          {(events ?? []).map((event) => (
            <article key={event.id} className="rounded-lg border border-[var(--rahma-border)] p-4">
              <div className="flex flex-wrap items-start justify-between gap-3">
                <div className="min-w-0">
                  <div className="mb-2 flex flex-wrap items-center gap-2">
                    <AdminStatusBadge value={formatLabel(event.action_type)} tone="muted" />
                    <AdminStatusBadge value={event.target_type ?? "unknown"} tone="default" />
                  </div>
                  <p className="text-sm font-medium text-[var(--rahma-charcoal)]">
                    {event.actor_staff_id ? staffNames.get(event.actor_staff_id) ?? "Unknown staff" : "System"}
                  </p>
                  <p className="mt-1 text-xs text-[var(--rahma-muted)]">
                    {formatDateTime(event.created_at)} · {event.target_id ?? "No target id"}
                  </p>
                </div>
                <ShieldCheck className="size-5 text-[var(--rahma-green)]" />
              </div>
              <dl className="mt-4 grid gap-3 text-sm sm:grid-cols-2">
                <SafeSummary label="Before" value={event.before_state} />
                <SafeSummary label="After" value={event.after_state} />
              </dl>
            </article>
          ))}
          {(events ?? []).length === 0 ? (
            <p className="py-10 text-center text-sm text-[var(--rahma-muted)]">
              No audit events found.
            </p>
          ) : null}
        </div>
      </AdminPanel>
    </div>
  );
}

function SafeSummary({
  label,
  value,
}: {
  label: string;
  value: Record<string, unknown> | null;
}) {
  const keys = Object.keys(value ?? {}).filter((key) => !isSensitiveKey(key)).slice(0, 6);
  return (
    <div className="rounded-lg bg-[var(--rahma-ivory)]/70 p-3">
      <dt className="text-xs font-semibold uppercase tracking-wide text-[var(--rahma-muted)]">
        {label}
      </dt>
      <dd className="mt-2 text-[var(--rahma-charcoal)]">
        {keys.length === 0 ? "No safe summary fields." : keys.join(", ")}
      </dd>
    </div>
  );
}

function isSensitiveKey(key: string) {
  return /note|health|treatment|consent|token|secret|key|payload|body/i.test(key);
}

function InsufficientPermissions() {
  return (
    <AdminAccessDenied
      title="Audit access limited"
      message="You need audit-log permission to view this page."
      permission="manage_audit_logs"
    />
  );
}
