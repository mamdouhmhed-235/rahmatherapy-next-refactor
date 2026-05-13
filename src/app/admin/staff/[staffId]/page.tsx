import Link from "next/link";
import { redirect } from "next/navigation";
import {
  CalendarCheck,
  CheckCircle2,
  ChevronLeft,
  Clock,
  Mail,
  ShieldCheck,
  User,
  XCircle,
} from "lucide-react";

import { Badge } from "@/components/ui/badge";
import { createSupabaseAdminClient } from "@/lib/supabase/admin";
import { createSupabaseServerClient } from "@/lib/supabase/server";
import {
  canAssignStaffRoles,
  canManagePermissionOverrides,
  getStaffProfile,
} from "@/lib/auth/rbac";
import { AdminAccessDenied, AdminPanel, AdminStatusBadge } from "../../components/admin-ui";
import {
  canEditSafeStaffProfile,
  getStaffTeamAccess,
  getStaffTeamSelect,
  staffProfilesFrom,
} from "../team-access";
import { StaffPermissionOverridesForm } from "./StaffPermissionOverridesForm";
import { StaffProfileForm } from "./StaffProfileForm";

interface StaffDetailPageProps {
  params: Promise<{ staffId: string }>;
}

type StaffRole = { id?: string; name: string; display_label?: string | null };
type StaffDetailRow = {
  id: string;
  auth_user_id?: string | null;
  name: string;
  email?: string | null;
  role_id?: string;
  gender: "male" | "female";
  active: boolean;
  can_take_bookings: boolean;
  availability_mode: string;
  profile_photo_path?: string | null;
  phone?: string | null;
  show_phone_on_profile?: boolean | null;
  short_bio?: string | null;
  specialties?: string[] | null;
  languages?: string[] | null;
  service_areas?: string[] | null;
  roles?: StaffRole | null;
};
type AssignmentRow = {
  id: string;
  status: string;
  required_therapist_gender: string;
  bookings: {
    id: string;
    booking_date: string;
    start_time: string;
    status: string;
    contact_full_name?: string | null;
    service_city?: string | null;
  } | null;
};

export const metadata = {
  title: "Staff Detail - Rahma Therapy Admin",
};

export default async function StaffDetailPage({ params }: StaffDetailPageProps) {
  const supabase = await createSupabaseServerClient();
  const profile = await getStaffProfile(supabase);

  if (!profile || !profile.active) {
    redirect("/admin/login");
  }

  const { staffId } = await params;
  const isOwnProfile = profile.id === staffId;
  const teamAccess = getStaffTeamAccess(profile);

  if (!teamAccess.access && !isOwnProfile) {
    return (
      <AdminAccessDenied
        title="Team access limited"
        message="You can view your own profile, but do not have permission to view other team profiles."
        permission="view_staff"
      />
    );
  }

  const adminClient = createSupabaseAdminClient();
  const staffProfiles = staffProfilesFrom(adminClient);
  const staffSelect =
    isOwnProfile || teamAccess.scope === "admin"
      ? getStaffTeamSelect({ ...teamAccess, scope: "admin" })
      : getStaffTeamSelect(teamAccess);

  let staffQuery = staffProfiles.select<StaffDetailRow>(staffSelect).eq("id", staffId);
  if (!isOwnProfile && teamAccess.scope === "assignment") {
    staffQuery = staffQuery.eq("active", true).eq("can_take_bookings", true);
  }
  if (!isOwnProfile && teamAccess.scope === "same_gender_team") {
    staffQuery = staffQuery
      .eq("active", true)
      .eq("can_take_bookings", true)
      .eq("gender", profile.gender);
  }

  const { data: staff } = await staffQuery.maybeSingle();
  if (!staff) {
    return (
      <AdminAccessDenied
        title="Team profile not visible"
        message="This profile is outside your current team visibility scope."
        permission="view_staff"
      />
    );
  }

  const typedStaff = staff as unknown as StaffDetailRow;
  const canViewContactFields = teamAccess.canViewContactFields || isOwnProfile;
  const canShowAdminPanels = teamAccess.canViewAdminFields;
  const canEditSafeProfile = canEditSafeStaffProfile(profile, staffId);
  const canOpenWorkloadBookings =
    teamAccess.canViewClientWorkloadContext || teamAccess.scope === "assignment" || isOwnProfile;

  const [
    { data: roles },
    { data: rolePermissions },
    { data: staffOverrides },
    { data: allPermissions },
    { data: assignments },
    { data: auditLogs },
    { data: availabilityRules },
  ] = await Promise.all([
    teamAccess.canViewRoleControls
      ? supabase
          .from("roles")
          .select("id, name, display_label, active, sort_order")
          .eq("active", true)
          .order("sort_order", { ascending: true })
          .order("name", { ascending: true })
      : Promise.resolve({ data: [] }),
    canShowAdminPanels && typedStaff.role_id
      ? adminClient
          .from("role_permissions")
          .select("permission_id, permissions(name)")
          .eq("role_id", typedStaff.role_id)
      : Promise.resolve({ data: [] }),
    teamAccess.canViewPermissionControls
      ? adminClient
          .from("staff_permission_overrides")
          .select("permission_id, is_granted")
          .eq("staff_id", staffId)
      : Promise.resolve({ data: [] }),
    teamAccess.canViewPermissionControls
      ? adminClient
          .from("permissions")
          .select("id, name, description, category, scope, risk_level, active")
          .eq("active", true)
          .order("category", { ascending: true })
          .order("name", { ascending: true })
      : Promise.resolve({ data: [] }),
    adminClient
      .from("booking_assignments")
      .select(
        teamAccess.canViewClientWorkloadContext
          ? "id, status, required_therapist_gender, bookings(id, booking_date, start_time, status, contact_full_name, service_city)"
          : "id, status, required_therapist_gender, bookings(id, booking_date, start_time, status)"
      )
      .eq("assigned_staff_id", staffId)
      .order("created_at", { ascending: false })
      .limit(8),
    teamAccess.canViewAudit
      ? adminClient
          .from("audit_logs")
          .select("id, action_type, created_at")
          .eq("target_id", staffId)
          .order("created_at", { ascending: false })
          .limit(8)
      : Promise.resolve({ data: [] }),
    adminClient.from("staff_availability_rules").select("id").eq("staff_id", staffId),
  ]);

  const permissions = (rolePermissions ?? [])
    .map((row) => (row.permissions as unknown as { name: string } | null)?.name)
    .filter((permission): permission is string => Boolean(permission));
  const inheritedPermissionIds = (rolePermissions ?? []).map((row) => row.permission_id);
  const overrideMap = Object.fromEntries(
    (staffOverrides ?? []).map((override) => [
      override.permission_id,
      override.is_granted,
    ])
  );
  const typedAssignments = (assignments ?? []) as unknown as AssignmentRow[];
  const upcomingAssignments = typedAssignments.filter((assignment) => {
    const booking = assignment.bookings;
    return (
      booking &&
      ["pending", "confirmed"].includes(booking.status) &&
      `${booking.booking_date}T${booking.start_time}` >= new Date().toISOString().slice(0, 16)
    );
  });
  const onboarding = [
    { label: "Auth linked", done: Boolean(typedStaff.auth_user_id) },
    { label: "Role assigned", done: Boolean(typedStaff.role_id) },
    { label: "Gender set", done: Boolean(typedStaff.gender) },
    { label: "Active", done: typedStaff.active },
    { label: "Can take bookings", done: typedStaff.can_take_bookings },
    {
      label: "Availability configured",
      done: typedStaff.availability_mode === "use_global" || (availabilityRules?.length ?? 0) > 0,
    },
  ];
  return (
    <div>
      <div className="mb-6">
        <Link
          href="/admin/staff"
          className="flex items-center gap-1.5 text-sm text-[var(--rahma-muted)] transition-colors hover:text-[var(--rahma-charcoal)]"
        >
          <ChevronLeft className="size-3.5" />
          Team Directory
        </Link>
      </div>

      <div
        className="mb-8 overflow-hidden rounded-2xl border bg-white shadow-soft"
        style={{ borderColor: "var(--rahma-border)" }}
      >
        <div className="relative h-24 border-b border-[var(--rahma-border)] bg-[var(--rahma-ivory)]">
          <div className="absolute -bottom-10 left-8 flex items-end gap-6">
            <div
              className="flex size-24 items-center justify-center rounded-2xl border-4 border-white text-white shadow-md"
              style={{
                background: typedStaff.active ? "var(--rahma-green)" : "var(--rahma-muted)",
              }}
            >
              <User className="size-10" />
            </div>
            <div className="mb-2 pb-1">
              <h1 className="font-display text-2xl font-semibold text-[var(--rahma-charcoal)]">
                {typedStaff.name}
              </h1>
              {canViewContactFields && typedStaff.email ? (
                <p className="flex items-center gap-2 text-sm text-[var(--rahma-muted)]">
                  <Mail className="size-3.5" />
                  {typedStaff.email}
                </p>
              ) : null}
            </div>
          </div>
        </div>
        <div className="px-8 pb-6 pt-14">
          <nav className="flex gap-8 border-b border-[var(--rahma-border)]">
            <Link
              href={`/admin/staff/${staffId}`}
              aria-current="page"
              className="border-b-2 border-[var(--rahma-green)] px-1 pb-4 text-sm font-semibold text-[var(--rahma-charcoal)]"
            >
              Profile
            </Link>
            {(canShowAdminPanels || isOwnProfile) ? (
              <Link
                href={`/admin/staff/${staffId}/availability`}
                className="border-b-2 border-transparent px-1 pb-4 text-sm font-medium text-[var(--rahma-muted)] transition-colors hover:text-[var(--rahma-charcoal)]"
              >
                Availability
              </Link>
            ) : null}
          </nav>
        </div>
      </div>

      {canEditSafeProfile || canShowAdminPanels ? (
        <StaffProfileForm
          staff={{ ...typedStaff, role_id: typedStaff.role_id ?? "" }}
          roles={roles ?? []}
          canManageUsers={canShowAdminPanels}
          canEditSafeProfile={canEditSafeProfile}
          canAssignRoles={canAssignStaffRoles(profile)}
        />
      ) : (
        <AdminPanel title="Profile">
          <div className="grid gap-4 text-sm text-[var(--rahma-muted)]">
            {typedStaff.short_bio ? (
              <p className="text-[var(--rahma-charcoal)]">{typedStaff.short_bio}</p>
            ) : null}
            <ProfileList label="Specialties" values={typedStaff.specialties ?? []} />
            <ProfileList label="Languages" values={typedStaff.languages ?? []} />
            <ProfileList label="Service areas" values={typedStaff.service_areas ?? []} />
            <div className="flex items-center gap-2">
              <ShieldIcon />
              <span>Gender: {typedStaff.gender}</span>
            </div>
          </div>
        </AdminPanel>
      )}

      <div className="mt-8 grid gap-6 xl:grid-cols-2">
        {canShowAdminPanels || isOwnProfile ? (
          <AdminPanel title="Profile completion">
            <div className="grid gap-3 text-sm">
              {[
                ["Phone", Boolean(typedStaff.phone)],
                ["Short bio", Boolean(typedStaff.short_bio)],
                ["Specialties", Boolean(typedStaff.specialties?.length)],
                ["Languages", Boolean(typedStaff.languages?.length)],
                ["Service areas", Boolean(typedStaff.service_areas?.length)],
              ].map(([label, done]) => (
                <div
                  key={String(label)}
                  className="flex items-center justify-between gap-4 rounded-lg bg-[var(--rahma-ivory)]/70 px-3 py-2"
                >
                  <span className="text-[var(--rahma-charcoal)]">{label}</span>
                  {done ? (
                    <CheckCircle2 className="size-4 text-emerald-600" />
                  ) : (
                    <XCircle className="size-4 text-orange-600" />
                  )}
                </div>
              ))}
            </div>
          </AdminPanel>
        ) : null}

        {canShowAdminPanels ? (
          <AdminPanel title="Onboarding checklist">
            <div className="grid gap-3">
              {onboarding.map((item) => (
                <div
                  key={item.label}
                  className="flex items-center justify-between gap-4 rounded-lg bg-[var(--rahma-ivory)]/70 px-3 py-2 text-sm"
                >
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
        ) : null}

        {canShowAdminPanels ? (
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
        ) : null}

        {canManagePermissionOverrides(profile) ? (
          <AdminPanel
            title="Individual permission overrides"
            description={
              isOwnProfile
                ? "Self overrides are disabled to prevent lockout."
                : "Overrides sit on top of the fixed role bundle."
            }
          >
            {isOwnProfile ? (
              <p className="text-sm text-[var(--rahma-muted)]">
                Ask another owner-level admin to change your permission overrides.
              </p>
            ) : (
              <StaffPermissionOverridesForm
                staffId={staffId}
                permissions={allPermissions ?? []}
                inheritedPermissionIds={inheritedPermissionIds}
                overrides={overrideMap}
              />
            )}
          </AdminPanel>
        ) : null}

        {canShowAdminPanels ? (
        <AdminPanel
          title="Assigned bookings and workload"
          description={`${upcomingAssignments.length} upcoming assignment${
            upcomingAssignments.length === 1 ? "" : "s"
          }`}
        >
          {(assignments ?? []).length === 0 ? (
            <p className="text-sm text-[var(--rahma-muted)]">No assigned bookings yet.</p>
          ) : (
            <div className="grid gap-3">
              {typedAssignments.map((assignment) => {
                const booking = assignment.bookings;
                const content = (
                  <div className="flex items-start justify-between gap-3">
                    <div>
                      <p className="font-medium text-[var(--rahma-charcoal)]">
                        {teamAccess.canViewClientWorkloadContext
                          ? booking?.contact_full_name ?? "Unknown contact"
                          : "Booking context hidden"}
                      </p>
                      <p className="mt-1 flex items-center gap-1.5 text-xs text-[var(--rahma-muted)]">
                        <CalendarCheck className="size-3" />
                        {booking?.booking_date ?? "No date"}{" "}
                        {booking?.start_time?.slice(0, 5) ?? ""}
                      </p>
                      <p className="mt-1 flex items-center gap-1.5 text-xs text-[var(--rahma-muted)]">
                        <Clock className="size-3" />
                        {teamAccess.canViewClientWorkloadContext
                          ? booking?.service_city ?? "No city"
                          : assignment.required_therapist_gender}
                      </p>
                    </div>
                    <AdminStatusBadge value={assignment.status} tone="muted" />
                  </div>
                );

                return canOpenWorkloadBookings && booking ? (
                  <Link
                    key={assignment.id}
                    href={`/admin/bookings/${booking.id}`}
                    className="rounded-lg border border-[var(--rahma-border)] bg-white px-3 py-3 text-sm transition-shadow hover:shadow-card"
                  >
                    {content}
                  </Link>
                ) : (
                  <div
                    key={assignment.id}
                    className="rounded-lg border border-[var(--rahma-border)] bg-white px-3 py-3 text-sm"
                  >
                    {content}
                  </div>
                );
              })}
            </div>
          )}
        </AdminPanel>
        ) : null}

        {teamAccess.canViewAudit ? (
          <AdminPanel title="Audit history">
            {(auditLogs ?? []).length === 0 ? (
              <p className="text-sm text-[var(--rahma-muted)]">
                No recent staff audit entries.
              </p>
            ) : (
              <div className="grid gap-2 text-sm">
                {(auditLogs ?? []).map((event) => (
                  <div
                    key={event.id}
                    className="flex items-center justify-between gap-4 border-b border-[var(--rahma-border)] py-2 last:border-0"
                  >
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
        ) : null}
      </div>
    </div>
  );
}

function ProfileList({ label, values }: { label: string; values: string[] }) {
  return values.length > 0 ? (
    <div>
      <p className="mb-2 font-medium text-[var(--rahma-charcoal)]">{label}</p>
      <div className="flex flex-wrap gap-2">
        {values.map((value) => (
          <Badge
            key={value}
            variant="outline"
            className="border-[var(--rahma-border)] text-[var(--rahma-muted)]"
          >
            {value}
          </Badge>
        ))}
      </div>
    </div>
  ) : null;
}

function ShieldIcon() {
  return <ShieldCheck className="size-3.5 shrink-0" />;
}
