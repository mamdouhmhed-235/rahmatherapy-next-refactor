import { redirect } from "next/navigation";
import { createSupabaseServerClient } from "@/lib/supabase/server";
import { getStaffProfile, PERMISSIONS } from "@/lib/auth/rbac";
import { AdminAccessDenied } from "../components/admin-ui";
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
        message="You need settings management permission to access this page."
        permission="manage_settings"
      />
    );
  }

  const { data: settings } = await supabase
    .from("business_settings")
    .select("*")
    .eq("id", 1)
    .single();

  return (
    <div>
      <div className="mb-8">
        <h1 className="font-display text-2xl font-semibold text-[var(--rahma-charcoal)]">
          Settings
        </h1>
        <p className="mt-1 text-sm text-[var(--rahma-muted)]">
          Manage the booking window, service areas, buffers, and request intake
          switch used by the booking rules.
        </p>
      </div>

      <SettingsForm settings={settings ?? fallbackSettings} />
    </div>
  );
}
