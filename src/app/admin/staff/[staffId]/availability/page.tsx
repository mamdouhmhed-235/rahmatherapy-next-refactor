import { notFound, redirect } from "next/navigation";
import Link from "next/link";
import { createSupabaseServerClient } from "@/lib/supabase/server";
import { getStaffProfile, PERMISSIONS } from "@/lib/auth/rbac";
import { ChevronLeft, User, Globe } from "lucide-react";
import { AvailabilityModeSelector } from "./AvailabilityModeSelector";
import { StaffAvailabilityRulesForm } from "./StaffAvailabilityRulesForm";
import { AdminAccessDenied } from "../../../components/admin-ui";


interface AvailabilityPageProps {
  params: Promise<{ staffId: string }>;
}

export const metadata = {
  title: "Staff Availability — Rahma Therapy Admin",
};

export default async function AvailabilityPage({ params }: AvailabilityPageProps) {
  const supabase = await createSupabaseServerClient();
  const profile = await getStaffProfile(supabase);

  if (!profile || !profile.active) {
    redirect("/admin/login");
  }

  const { staffId } = await params;
  const isOwnProfile = profile.id === staffId;
  const canManageGlobal = profile.permissions.has(PERMISSIONS.MANAGE_AVAILABILITY_GLOBAL);
  const canManageOwn = profile.permissions.has(PERMISSIONS.MANAGE_AVAILABILITY_OWN);

  // Permission gate
  if (!canManageGlobal && !(isOwnProfile && canManageOwn)) {
    return (
      <AdminAccessDenied
        title="Availability access limited"
        message="You can manage your own availability with own-availability permission, or any staff availability with global availability permission."
        permission="manage_availability_own or manage_availability_global"
      />
    );
  }

  // Fetch staff member details
  const { data: staff } = await supabase
    .from("staff_profiles")
    .select("*")
    .eq("id", staffId)
    .single();

  if (!staff) notFound();

  const { data: availabilityRules } = await supabase
    .from("staff_availability_rules")
    .select("id, day_of_week, start_time, end_time, is_working_day")
    .eq("staff_id", staffId)
    .order("day_of_week")
    .order("start_time");

  const canEdit = canManageGlobal || (isOwnProfile && canManageOwn);

  return (
    <div>
      {/* Breadcrumb */}
      <div className="mb-6">
        <Link
          href={`/admin/staff/${staffId}`}
          className="flex items-center gap-1.5 text-sm text-[var(--rahma-muted)] hover:text-[var(--rahma-charcoal)] transition-colors"
        >
          <ChevronLeft className="size-3.5" />
          {staff.name} Profile
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
              <h1 className="font-display text-2xl font-semibold text-[var(--rahma-charcoal)]">
                {staff.name}
              </h1>
              <p className="flex items-center gap-2 text-sm text-[var(--rahma-muted)]">
                <Globe className="size-3.5" />
                Availability Management
              </p>
            </div>
          </div>
        </div>
        <div className="px-8 pb-6 pt-14">
          <nav className="flex gap-8 border-b border-[var(--rahma-border)]">
            <Link 
              href={`/admin/staff/${staffId}`}
              className="border-b-2 border-transparent px-1 pb-4 text-sm font-medium text-[var(--rahma-muted)] hover:text-[var(--rahma-charcoal)] transition-colors"
            >
              Profile Settings
            </Link>
            <Link 
              href={`/admin/staff/${staffId}/availability`}
              className="border-b-2 border-[var(--rahma-green)] px-1 pb-4 text-sm font-semibold text-[var(--rahma-charcoal)]"
            >
              Availability
            </Link>
          </nav>
        </div>
      </div>

      {/* Main Content */}
      <AvailabilityModeSelector 
        staff={staff} 
        canManageGlobal={canManageGlobal} 
        isOwnProfile={isOwnProfile} 
      />

      <div className="mt-8">
        <StaffAvailabilityRulesForm
          staffId={staffId}
          initialRules={availabilityRules ?? []}
          canEdit={canEdit}
        />
      </div>
    </div>
  );
}
