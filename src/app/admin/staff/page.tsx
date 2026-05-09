import Link from "next/link";
import { redirect } from "next/navigation";
import {
  CalendarCheck,
  ChevronRight,
  Languages,
  Mail,
  MapPin,
  ShieldCheck,
  User,
} from "lucide-react";

import { Badge } from "@/components/ui/badge";
import { createSupabaseAdminClient } from "@/lib/supabase/admin";
import { createSupabaseServerClient } from "@/lib/supabase/server";
import { getRoleDisplayName, getStaffProfile } from "@/lib/auth/rbac";
import { AdminAccessDenied } from "../components/admin-ui";
import { NewStaffForm } from "./NewStaffForm";
import { getStaffProfileCompletion } from "./profile-access";
import { getStaffTeamAccess, getStaffTeamSelect, staffProfilesFrom } from "./team-access";

export const metadata = {
  title: "Team - Rahma Therapy Admin",
};

type StaffRole = { name: string; display_label?: string | null };
type StaffDirectoryRow = {
  id: string;
  auth_user_id?: string | null;
  name: string;
  email?: string | null;
  role_id?: string | null;
  gender: string | null;
  active: boolean;
  can_take_bookings: boolean;
  availability_mode: string;
  phone?: string | null;
  short_bio?: string | null;
  specialties?: string[] | null;
  languages?: string[] | null;
  service_areas?: string[] | null;
  roles?: StaffRole | null;
};
type AssignmentRow = {
  assigned_staff_id: string | null;
  status: string;
  bookings: {
    booking_date: string;
    start_time: string;
    status: string;
  } | null;
};

export default async function StaffPage() {
  const supabase = await createSupabaseServerClient();
  const profile = await getStaffProfile(supabase);

  if (!profile || !profile.active) {
    redirect("/admin/login");
  }

  const teamAccess = getStaffTeamAccess(profile);
  if (!teamAccess.access) {
    return (
      <AdminAccessDenied
        title="Team access limited"
        message="You do not have permission to view the team directory."
        permission="view_staff"
      />
    );
  }

  const adminClient = createSupabaseAdminClient();
  const staffProfiles = staffProfilesFrom(adminClient);
  const staffSelect = getStaffTeamSelect(teamAccess);
  let staff: StaffDirectoryRow[] = [];

  if (teamAccess.scope === "admin") {
    const { data } = await staffProfiles
      .select<StaffDirectoryRow[]>(staffSelect)
      .order("name");
    staff = (data ?? []) as unknown as StaffDirectoryRow[];
  } else if (teamAccess.scope === "assignment") {
    const { data } = await staffProfiles
      .select<StaffDirectoryRow[]>(staffSelect)
      .eq("active", true)
      .eq("can_take_bookings", true)
      .order("name");
    staff = (data ?? []) as unknown as StaffDirectoryRow[];
  } else if (teamAccess.scope === "same_gender_team") {
    const [{ data: sameGenderStaff }, { data: ownProfile }] = await Promise.all([
      staffProfiles
        .select<StaffDirectoryRow[]>(staffSelect)
        .eq("active", true)
        .eq("can_take_bookings", true)
        .eq("gender", profile.gender)
        .order("name"),
      staffProfiles
        .select<StaffDirectoryRow>(staffSelect)
        .eq("id", profile.id)
        .maybeSingle(),
    ]);
    staff = Array.from(
      new Map(
        ([...(sameGenderStaff ?? []), ownProfile].filter(Boolean) as StaffDirectoryRow[])
          .map((member) => [member.id, member])
      ).values()
    ).sort((left, right) => left.name.localeCompare(right.name));
  }

  const staffIds = staff.map((member) => member.id);
  const { data: assignments } =
    staffIds.length > 0
      ? await adminClient
          .from("booking_assignments")
          .select("assigned_staff_id, status, bookings(booking_date, start_time, status)")
          .in("assigned_staff_id", staffIds)
      : { data: [] };
  const typedAssignments = (assignments ?? []) as unknown as AssignmentRow[];

  const { data: roles } = teamAccess.canCreateStaff
    ? await supabase
        .from("roles")
        .select("id, name, display_label, active, sort_order")
        .eq("active", true)
        .order("sort_order", { ascending: true })
        .order("name", { ascending: true })
    : { data: [] };

  const pageTitle = teamAccess.scope === "admin" ? "Staff Management" : "Team Directory";
  const pageDescription =
    teamAccess.scope === "admin"
      ? "Manage your team, their roles, and booking availability."
      : teamAccess.scope === "assignment"
        ? "Active bookable staff for assignment planning."
        : "Active same-gender team members and your own profile.";

  return (
    <div>
      <div className="mb-8 flex items-end justify-between">
        <div>
          <h1 className="font-display text-2xl font-semibold text-[var(--rahma-charcoal)]">
            {pageTitle}
          </h1>
          <p className="mt-1 text-sm text-[var(--rahma-muted)]">{pageDescription}</p>
        </div>
        {teamAccess.canCreateStaff ? <NewStaffForm roles={roles ?? []} /> : null}
      </div>

      <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-3">
        {staff.map((member) => {
          const role = member.roles as StaffRole | null | undefined;
          const roleName =
            teamAccess.canViewAdminFields && role
              ? getRoleDisplayName(role)
              : member.can_take_bookings
                ? "Bookable team member"
                : "Team member";
          const upcomingWorkload = typedAssignments.filter(
            (assignment) => {
              const booking = assignment.bookings;
              return (
                assignment.assigned_staff_id === member.id &&
                booking &&
                ["pending", "confirmed"].includes(booking.status) &&
                `${booking.booking_date}T${booking.start_time}` >=
                  new Date().toISOString().slice(0, 16)
              );
            }
          ).length;
          const onboardingItems = [
            Boolean(member.auth_user_id),
            Boolean(member.role_id),
            Boolean(member.gender),
            member.active,
            member.can_take_bookings,
            Boolean(member.availability_mode),
          ];
          const onboardingComplete = onboardingItems.filter(Boolean).length;
          const profileCompletion = getStaffProfileCompletion(member);

          return (
            <Link
              key={member.id}
              href={`/admin/staff/${member.id}`}
              className="group relative flex flex-col rounded-2xl border bg-white p-6 transition-all duration-200 hover:shadow-card active:scale-[0.98]"
              style={{
                borderColor: "var(--rahma-border)",
                boxShadow: "var(--shadow-soft-token)",
              }}
            >
              <div className="mb-4 flex items-start justify-between">
                <div className="flex items-center gap-3">
                  <div
                    className="flex size-10 shrink-0 items-center justify-center rounded-full text-white"
                    style={{
                      background: member.active ? "var(--rahma-green)" : "var(--rahma-muted)",
                    }}
                  >
                    <User className="size-5" />
                  </div>
                  <div className="min-w-0">
                    <h3 className="truncate font-semibold text-[var(--rahma-charcoal)] transition-colors group-hover:text-[var(--rahma-green)]">
                      {member.name}
                    </h3>
                    <p className="text-xs font-medium uppercase tracking-wider text-[var(--rahma-muted)]">
                      {roleName}
                    </p>
                  </div>
                </div>
                {teamAccess.canViewAdminFields && !member.active ? (
                  <Badge variant="secondary" className="border-none bg-gray-100 text-gray-500">
                    Inactive
                  </Badge>
                ) : null}
              </div>

              <div className="flex-1 space-y-3">
                {teamAccess.canViewContactFields && member.email ? (
                  <div className="flex items-center gap-2 text-sm text-[var(--rahma-muted)]">
                    <Mail className="size-3.5 shrink-0" />
                    <span className="truncate">{member.email}</span>
                  </div>
                ) : null}

                <div className="flex items-center gap-2 text-sm text-[var(--rahma-muted)]">
                  <ShieldCheck className="size-3.5 shrink-0" />
                  <span>Gender: {member.gender || "Not set"}</span>
                </div>

                {member.languages?.length ? (
                  <div className="flex items-center gap-2 text-sm text-[var(--rahma-muted)]">
                    <Languages className="size-3.5 shrink-0" />
                    <span className="truncate">{member.languages.join(", ")}</span>
                  </div>
                ) : null}

                {member.service_areas?.length ? (
                  <div className="flex items-center gap-2 text-sm text-[var(--rahma-muted)]">
                    <MapPin className="size-3.5 shrink-0" />
                    <span className="truncate">{member.service_areas.join(", ")}</span>
                  </div>
                ) : null}

                {teamAccess.canViewWorkloadSummary ? (
                  <div className="flex items-center gap-2 text-sm text-[var(--rahma-muted)]">
                    <CalendarCheck className="size-3.5 shrink-0" />
                    <span>
                      {upcomingWorkload} upcoming assignment
                      {upcomingWorkload === 1 ? "" : "s"}
                    </span>
                  </div>
                ) : null}

                {member.specialties?.length ? (
                  <div className="flex flex-wrap gap-2 pt-1">
                    {member.specialties.slice(0, 3).map((specialty) => (
                      <Badge
                        key={specialty}
                        variant="outline"
                        className="border-[var(--rahma-border)] text-[var(--rahma-muted)]"
                      >
                        {specialty}
                      </Badge>
                    ))}
                  </div>
                ) : null}

                <div className="mt-4 flex flex-wrap gap-2 border-t border-[var(--rahma-border)] pt-2">
                  {member.can_take_bookings ? (
                    <Badge className="border-none bg-[var(--rahma-green)]/10 py-0.5 normal-case tracking-normal text-[var(--rahma-green)]">
                      Accepting bookings
                    </Badge>
                  ) : teamAccess.canViewAdminFields ? (
                    <Badge
                      variant="secondary"
                      className="border-none bg-orange-50 py-0.5 normal-case tracking-normal text-orange-600"
                    >
                      Bookings off
                    </Badge>
                  ) : null}

                  <Badge
                    variant="outline"
                    className="border-[var(--rahma-border)] py-0.5 normal-case tracking-normal text-[var(--rahma-muted)]"
                  >
                    {member.availability_mode.replace(/_/g, " ")}
                  </Badge>
                  {teamAccess.canViewAdminFields ? (
                    <>
                      <Badge
                        variant="outline"
                        className="border-[var(--rahma-border)] py-0.5 normal-case tracking-normal text-[var(--rahma-muted)]"
                      >
                        Onboarding {onboardingComplete}/6
                      </Badge>
                      <Badge
                        variant="outline"
                        className="border-[var(--rahma-border)] py-0.5 normal-case tracking-normal text-[var(--rahma-muted)]"
                      >
                        Profile {profileCompletion.completed}/{profileCompletion.total}
                      </Badge>
                    </>
                  ) : null}
                </div>
              </div>

              <div className="mt-4 flex items-center justify-between text-xs font-medium text-[var(--rahma-green)] opacity-0 transition-opacity group-hover:opacity-100">
                <span>View profile</span>
                <ChevronRight className="size-4" />
              </div>
            </Link>
          );
        })}
      </div>

      {staff.length === 0 ? (
        <div
          className="mt-12 rounded-2xl border-2 border-dashed bg-white/50 px-6 py-20 text-center"
          style={{ borderColor: "var(--rahma-border)" }}
        >
          <User className="mx-auto mb-4 size-12 text-[var(--rahma-muted)]/30" />
          <h3 className="text-lg font-semibold text-[var(--rahma-charcoal)]">
            No staff members found
          </h3>
          <p className="mt-1 text-[var(--rahma-muted)]">
            No team profiles are visible in your current scope.
          </p>
        </div>
      ) : null}
    </div>
  );
}
