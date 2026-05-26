import { redirect } from "next/navigation";
import { createSupabaseServerClient } from "@/lib/supabase/server";
import { createSupabaseAdminClient } from "@/lib/supabase/admin";
import { getStaffProfile, PERMISSIONS } from "@/lib/auth/rbac";
import { AdminAccessDenied, AdminPageHeader } from "../components/admin-ui";
import { SettingsForm } from "./SettingsForm";

export const metadata = {
  title: "Settings - Rahma Therapy Admin",
};

const fallbackSettings = {
  company_name: "Rahma Therapy",
  contact_email: null,
  contact_phone: null,
  booking_window_days: 30,
  buffer_time_mins: 30,
  minimum_notice_hours: 24,
  allowed_cities: ["Luton", "Dunstable", "Houghton Regis"],
  booking_status_enabled: true,
  customer_cancellation_cutoff_hours: 24,
};

interface LastChange {
  actor: string;
  display: string;
  isoTimestamp: string;
}

async function loadLastChange(): Promise<LastChange | null> {
  try {
    const admin = createSupabaseAdminClient();
    const { data: row } = await admin
      .from("audit_logs")
      .select("actor_staff_id, created_at")
      .eq("target_type", "business_settings")
      .order("created_at", { ascending: false })
      .limit(1)
      .maybeSingle();

    if (!row) return null;

    let actor = "System";
    if (row.actor_staff_id) {
      const { data: staff } = await admin
        .from("staff_profiles")
        .select("name")
        .eq("id", row.actor_staff_id)
        .maybeSingle();
      if (staff?.name) actor = staff.name;
    }

    const date = new Date(row.created_at);
    const display = date.toLocaleString("en-GB", {
      day: "numeric",
      month: "short",
      year: "numeric",
      hour: "2-digit",
      minute: "2-digit",
    });

    return { actor, display, isoTimestamp: row.created_at };
  } catch {
    return null;
  }
}

export default async function SettingsPage() {
  const supabase = await createSupabaseServerClient();
  const profile = await getStaffProfile(supabase);

  if (!profile || !profile.active) {
    redirect("/admin/login");
  }

  if (!profile.permissions.has(PERMISSIONS.MANAGE_SETTINGS)) {
    return (
      <AdminAccessDenied
        title="Settings access limited"
        message="Settings are restricted to the practice owner. Ask the owner if you need a policy changed."
      />
    );
  }

  const [{ data: settings }, lastChange] = await Promise.all([
    supabase.from("business_settings").select("*").eq("id", 1).single(),
    loadLastChange(),
  ]);

  return (
    <div>
      <AdminPageHeader
        title="Settings"
        description="Booking window, service areas, buffers, and the intake switch the customer-facing form reads."
      />

      <SettingsForm
        settings={settings ?? fallbackSettings}
        lastChange={lastChange}
      />
    </div>
  );
}
