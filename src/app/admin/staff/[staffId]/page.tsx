import { notFound, redirect } from "next/navigation";
import Link from "next/link";
import { createSupabaseServerClient } from "@/lib/supabase/server";
import { getStaffProfile, PERMISSIONS } from "@/lib/auth/rbac";
import { ChevronLeft, User, Mail } from "lucide-react";
import { StaffProfileForm } from "./StaffProfileForm";
import { Badge } from "@/components/ui/badge";


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
    redirect("/admin/staff");
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
    </div>
  );
}
