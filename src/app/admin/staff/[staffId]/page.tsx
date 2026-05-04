import { notFound, redirect } from "next/navigation";
import Link from "next/link";
import { createSupabaseServerClient } from "@/lib/supabase/server";
import { createSupabaseAdminClient } from "@/lib/supabase/admin";
import { getStaffProfile, PERMISSIONS } from "@/lib/auth/rbac";
import { CalendarCheck, CheckCircle2, ChevronLeft, Clock, Mail, User, XCircle } from "lucide-react";
import { StaffProfileForm } from "./StaffProfileForm";
import { Badge } from "@/components/ui/badge";
import { AdminAccessDenied, AdminPanel, AdminStatusBadge } from "../../components/admin-ui";


interface StaffDetailPageProps {
  params: Promise<{ staffId: string }>;
}

export const metadata = {
  title: "Staff Detail — Rahma Therapy Admin",
};

export default async function StaffDetailPage({ params }: StaffDetailPageProps) {
  const supabase = await createSupabaseServerClient();
  const profile = await getStaffProfile(supabase);

  if (!profile || !profile.active) {
    redirect("/admin/login");
  }

  // Permission gate: Can view own profile, or MANAGE_USERS for others
  const { staffId } = await params;
  const isOwnProfile = profile.id === staffId;
  const canManageUsers = profile.permissions.has(PERMISSIONS.MANAGE_USERS);

  if (!isOwnProfile && !canManageUsers) {
    return (
      <AdminAccessDenied
        title="Staff access limited"
        message="You can view your own profile, but need user management permission to view other staff profiles."
        permission="manage_users"
      />
    );
  }

  // Fetch staff member details
  const { data: staff } = await supabase
    .from("staff_profiles")
    .select(`
      *,
      roles (
        id,
        name
      )
    `)
    .eq("id", staffId)
    .single();

  if (!staff) notFound();

  // Fetch roles for selection if manager
  const { data: roles } = await supabase
    .from("roles")
    .select("id, name")
    .order("name");

  const adminClient = createSupabaseAdminClient();
  const [{ data: rolePermissions }, { data: assignments }, { data: auditLogs }, { data: availabilityRules }] =
    await Promise.all([
      adminClient
        .from("role_permissions")
        .select("permissions(name)")
        .eq("role_id", staff.role_id),
      adminClient
        .from("booking_assignments")
        .select("id, status, required_therapist_gender, bookings(id, booking_date, start_time, status, contact_full_name, service_city)")
        .eq("assigned_staff_id", staffId)
        .order("created_at", { ascending: false })
        .limit(8),
      adminClient
        .from("audit_logs")
        .select("id, action_type, created_at")
        .eq("target_id", staffId)
        .order("created_at", { ascending: false })
        .limit(8),
      adminClient
        .from("staff_availability_rules")
        .select("id")
        .eq("staff_id", staffId),
    ]);

  const permissions = (rolePermissions ?? [])
    .map((row) => (row.permissions as unknown as { name: string } | null)?.name)
    .filter((permission): permission is string => Boolean(permission));
  const upcomingAssignments = (assignments ?? []).filter((assignment) => {
    const booking = assignment.bookings as unknown as {
      booking_date: string;
      start_time: string;
      status: string;
    } | null;
    return (
      booking &&
      ["pending", "confirmed"].includes(booking.status) &&
      `${booking.booking_date}T${booking.start_time}` >= new Date().toISOString().slice(0, 16)
    );
  });
  const onboarding = [
    { label: "Auth linked", done: Boolean(staff.auth_user_id) },
    { label: "Role assigned", done: Boolean(staff.role_id) },
    { label: "Gender set", done: Boolean(staff.gender) },
    { label: "Active", done: staff.active },
    { label: "Can take bookings", done: staff.can_take_bookings },
    {
      label: "Availability configured",
      done: staff.availability_mode === "use_global" || (availabilityRules?.length ?? 0) > 0,
    },
  ];

  return (
    <div>
      {/* Breadcrumb */}
      <div className="mb-6">
        <Link
          href="/admin/staff"
          className="flex items-center gap-1.5 text-sm text-[var(--rahma-muted)] hover:text-[var(--rahma-charcoal)] transition-colors"
        >
          <ChevronLeft className="size-3.5" />
          Staff Management
        </Link>
      </div>

      {/* Page Header Card */}
      <div 
        className="mb-8 overflow-hidden rounded-2xl border bg-white shadow-soft"
        style={{ borderColor: "var(--rahma-border)" }}
      >
        <div className="h-24 bg-[var(--rahma-ivory)] border-b border-[var(--rahma-border)] relative">
          <div className="absolute -bottom-10 left-8 flex items-end gap-6">
            <div 
              className="flex size-24 items-center justify-center rounded-2xl border-4 border-white text-white shadow-md"
              style={{ background: staff.active ? "var(--rahma-green)" : "var(--rahma-muted)" }}
            >
              <User className="size-10" />
            </div>
            <div className="mb-2 pb-1">
              <h1 className="font-display text-2xl font-semibold text-[var(--rahma-charcoal)] flex items-center gap-3">
                {staff.name}
                {staff.can_take_bookings && (
                  <Badge className="bg-[var(--rahma-green)]/10 text-[var(--rahma-green)] border-none normal-case tracking-normal">
                    Available for Bookings
                  </Badge>
                )}
              </h1>
              <p className="flex items-center gap-2 text-sm text-[var(--rahma-muted)]">
                <Mail className="size-3.5" />
                {staff.email}
              </p>
            </div>
          </div>
        </div>
        <div className="px-8 pb-6 pt-14">
          <nav className="flex gap-8 border-b border-[var(--rahma-border)]">
            <Link 
              href={`/admin/staff/${staffId}`}
              className="border-b-2 border-[var(--rahma-green)] px-1 pb-4 text-sm font-semibold text-[var(--rahma-charcoal)]"
            >
              Profile Settings
            </Link>
            <Link 
              href={`/admin/staff/${staffId}/availability`}
              className="border-b-2 border-transparent px-1 pb-4 text-sm font-medium text-[var(--rahma-muted)] hover:text-[var(--rahma-charcoal)] transition-colors"
            >
              Availability
            </Link>
          </nav>
        </div>
      </div>

      {/* Main Content */}
      <StaffProfileForm 
        staff={staff} 
        roles={roles ?? []} 
        canManageUsers={canManageUsers} 
      />

      <div className="mt-8 grid gap-6 xl:grid-cols-2">
        <AdminPanel title="Onboarding checklist">
          <div className="grid gap-3">
            {onboarding.map((item) => (
              <div key={item.label} className="flex items-center justify-between gap-4 rounded-lg bg-[var(--rahma-ivory)]/70 px-3 py-2 text-sm">
                <span className="text-[var(--rahma-charcoal)]">{item.label}</span>
                {item.done ? (
                  <CheckCircle2 className="size-4 text-emerald-600" />
                ) : (
                  <XCircle className="size-4 text-orange-600" />
                )}
              </div>
            ))}
          </div>
        </AdminPanel>

        <AdminPanel title="Role permissions">
          {permissions.length === 0 ? (
            <p className="text-sm text-[var(--rahma-muted)]">No role permissions found.</p>
          ) : (
            <div className="flex flex-wrap gap-2">
              {permissions.map((permission) => (
                <AdminStatusBadge key={permission} value={permission} tone="muted" />
              ))}
            </div>
          )}
        </AdminPanel>

        <AdminPanel
          title="Assigned bookings and workload"
          description={`${upcomingAssignments.length} upcoming assignment${upcomingAssignments.length === 1 ? "" : "s"}`}
        >
          {(assignments ?? []).length === 0 ? (
            <p className="text-sm text-[var(--rahma-muted)]">No assigned bookings yet.</p>
          ) : (
            <div className="grid gap-3">
              {(assignments ?? []).map((assignment) => {
                const booking = assignment.bookings as unknown as {
                  id: string;
                  booking_date: string;
                  start_time: string;
                  status: string;
                  contact_full_name: string | null;
                  service_city: string | null;
                } | null;

                return (
                  <Link
                    key={assignment.id}
                    href={booking ? `/admin/bookings/${booking.id}` : "#"}
                    className="rounded-lg border border-[var(--rahma-border)] bg-white px-3 py-3 text-sm transition-shadow hover:shadow-card"
                  >
                    <div className="flex items-start justify-between gap-3">
                      <div>
                        <p className="font-medium text-[var(--rahma-charcoal)]">
                          {booking?.contact_full_name ?? "Unknown contact"}
                        </p>
                        <p className="mt-1 flex items-center gap-1.5 text-xs text-[var(--rahma-muted)]">
                          <CalendarCheck className="size-3" />
                          {booking?.booking_date ?? "No date"} {booking?.start_time?.slice(0, 5) ?? ""}
                        </p>
                        <p className="mt-1 flex items-center gap-1.5 text-xs text-[var(--rahma-muted)]">
                          <Clock className="size-3" />
                          {booking?.service_city ?? "No city"}
                        </p>
                      </div>
                      <AdminStatusBadge value={assignment.status} tone="muted" />
                    </div>
                  </Link>
                );
              })}
            </div>
          )}
        </AdminPanel>

        <AdminPanel title="Audit history">
          {(auditLogs ?? []).length === 0 ? (
            <p className="text-sm text-[var(--rahma-muted)]">No recent staff audit entries.</p>
          ) : (
            <div className="grid gap-2 text-sm">
              {(auditLogs ?? []).map((event) => (
                <div key={event.id} className="flex items-center justify-between gap-4 border-b border-[var(--rahma-border)] py-2 last:border-0">
                  <span className="text-[var(--rahma-charcoal)]">
                    {event.action_type.replace(/_/g, " ")}
                  </span>
                  <span className="text-xs text-[var(--rahma-muted)]">
                    {new Intl.DateTimeFormat("en-GB", {
                      dateStyle: "medium",
                      timeStyle: "short",
                    }).format(new Date(event.created_at))}
                  </span>
                </div>
              ))}
            </div>
          )}
        </AdminPanel>
      </div>
    </div>
  );
}
