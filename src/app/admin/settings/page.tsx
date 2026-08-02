import { redirect } from "next/navigation";
import { createSupabaseServerClient } from "@/lib/supabase/server";
import { getStaffProfile, PERMISSIONS } from "@/lib/auth/rbac";
import { AdminAccessDenied, AdminPageHeader } from "../components/admin-ui";
import { SettingsForm } from "./SettingsForm";
import { getSettingsPageData } from "./settings-data";

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
        message="Settings are restricted to the practice owner. Ask the owner if you need a policy changed."
      />
    );
  }

  const { settings, lastChange } = await getSettingsPageData();

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
