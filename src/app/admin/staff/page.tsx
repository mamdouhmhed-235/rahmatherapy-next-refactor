import Link from "next/link";
import { createSupabaseServerClient } from "@/lib/supabase/server";
import { createSupabaseAdminClient } from "@/lib/supabase/admin";
import { getStaffProfile, PERMISSIONS } from "@/lib/auth/rbac";
import { redirect } from "next/navigation";
import { CalendarCheck, ChevronRight, User, ShieldCheck, Mail } from "lucide-react";

import { Badge } from "@/components/ui/badge";
import { AdminAccessDenied } from "../components/admin-ui";
import { NewStaffForm } from "./NewStaffForm";

export const metadata = {
  title: "Staff Management — Rahma Therapy Admin",
};

export default async function StaffPage() {
  const supabase = await createSupabaseServerClient();
  const profile = await getStaffProfile(supabase);

  if (!profile || !profile.active) {
    redirect("/admin/login");
  }

  // Permission gate
  if (!profile.permissions.has(PERMISSIONS.MANAGE_USERS)) {
    return (
      <AdminAccessDenied
        title="Staff access limited"
        message="You need user management permission to access this page."
        permission="manage_users"
      />
    );
  }

  // Fetch all staff members
  const adminClient = createSupabaseAdminClient();
  const [{ data: staff }, { data: assignments }] = await Promise.all([
    supabase
    .from("staff_profiles")
    .select(`
      *,
      roles (
        name
      )
    `)
    .order("name"),
    adminClient
      .from("booking_assignments")
      .select("assigned_staff_id, status, bookings(booking_date, start_time, status)")
      .not("assigned_staff_id", "is", null),
  ]);

  const { data: roles } = await supabase
    .from("roles")
    .select("id, name")
    .order("name");

  return (
    <div>
      {/* Page header */}
      <div className="mb-8 flex items-end justify-between">
        <div>
          <h1 className="font-display text-2xl font-semibold text-[var(--rahma-charcoal)]">
            Staff Management
          </h1>
          <p className="mt-1 text-sm text-[var(--rahma-muted)]">
            Manage your team, their roles, and booking availability.
          </p>
        </div>
        <NewStaffForm roles={roles ?? []} />
      </div>

      {/* Staff list */}
      <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-3">
        {(staff ?? []).map((member) => {
          const roleName = (member.roles as unknown as { name: string })?.name ?? "No Role";
          const upcomingWorkload = (assignments ?? []).filter((assignment) => {
            const booking = assignment.bookings as unknown as {
              booking_date: string;
              start_time: string;
              status: string;
            } | null;

            return (
              assignment.assigned_staff_id === member.id &&
              booking &&
              ["pending", "confirmed"].includes(booking.status) &&
              `${booking.booking_date}T${booking.start_time}` >= new Date().toISOString().slice(0, 16)
            );
          }).length;
          const onboardingItems = [
            Boolean(member.auth_user_id),
            Boolean(member.role_id),
            Boolean(member.gender),
            member.active,
            member.can_take_bookings,
            Boolean(member.availability_mode),
          ];
          const onboardingComplete = onboardingItems.filter(Boolean).length;
          
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
              {/* Header: Name & Role */}
              <div className="mb-4 flex items-start justify-between">
                <div className="flex items-center gap-3">
                  <div 
                    className="flex size-10 shrink-0 items-center justify-center rounded-full text-white"
                    style={{ background: member.active ? "var(--rahma-green)" : "var(--rahma-muted)" }}
                  >
                    <User className="size-5" />
                  </div>
                  <div className="min-w-0">
                    <h3 className="font-semibold text-[var(--rahma-charcoal)] truncate group-hover:text-[var(--rahma-green)] transition-colors">
                      {member.name}
                    </h3>
                    <p className="text-xs font-medium uppercase tracking-wider text-[var(--rahma-muted)]">
                      {roleName}
                    </p>
                  </div>
                </div>
                {!member.active && (
                  <Badge variant="secondary" className="bg-gray-100 text-gray-500 border-none">
                    Inactive
                  </Badge>
                )}
              </div>

              {/* Body: Info & Status */}
              <div className="space-y-3 flex-1">
                <div className="flex items-center gap-2 text-sm text-[var(--rahma-muted)]">
                  <Mail className="size-3.5 shrink-0" />
                  <span className="truncate">{member.email}</span>
                </div>
                
                <div className="flex items-center gap-2 text-sm text-[var(--rahma-muted)]">
                  <ShieldCheck className="size-3.5 shrink-0" />
                  <span>Gender: {member.gender || "Not set"}</span>
                </div>

                <div className="flex items-center gap-2 text-sm text-[var(--rahma-muted)]">
                  <CalendarCheck className="size-3.5 shrink-0" />
                  <span>{upcomingWorkload} upcoming assignment{upcomingWorkload === 1 ? "" : "s"}</span>
                </div>

                <div className="mt-4 flex flex-wrap gap-2 pt-2 border-t border-[var(--rahma-border)]">
                  {member.can_take_bookings ? (
                    <Badge className="bg-[var(--rahma-green)]/10 text-[var(--rahma-green)] border-none normal-case tracking-normal py-0.5">
                      Accepting Bookings
                    </Badge>
                  ) : (
                    <Badge variant="secondary" className="bg-orange-50 text-orange-600 border-none normal-case tracking-normal py-0.5">
                      Bookings Off
                    </Badge>
                  )}
                  
                  <Badge variant="outline" className="text-[var(--rahma-muted)] border-[var(--rahma-border)] normal-case tracking-normal py-0.5">
                    {member.availability_mode.replace(/_/g, ' ')}
                  </Badge>
                  <Badge variant="outline" className="text-[var(--rahma-muted)] border-[var(--rahma-border)] normal-case tracking-normal py-0.5">
                    Onboarding {onboardingComplete}/6
                  </Badge>
                </div>
              </div>

              {/* Footer: Action hint */}
              <div className="mt-4 flex items-center justify-between text-xs font-medium text-[var(--rahma-green)] opacity-0 group-hover:opacity-100 transition-opacity">
                <span>View Profile</span>
                <ChevronRight className="size-4" />
              </div>
            </Link>
          );
        })}
      </div>

      {/* Empty state */}
      {(!staff || staff.length === 0) && (
        <div className="mt-12 rounded-2xl border-2 border-dashed bg-white/50 px-6 py-20 text-center"
          style={{ borderColor: "var(--rahma-border)" }}>
          <User className="mx-auto mb-4 size-12 text-[var(--rahma-muted)]/30" />
          <h3 className="text-lg font-semibold text-[var(--rahma-charcoal)]">No staff members found</h3>
          <p className="mt-1 text-[var(--rahma-muted)]">Get started by inviting your first team member.</p>
        </div>
      )}
    </div>
  );
}
