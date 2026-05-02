import { redirect } from "next/navigation";
import { ShieldCheck } from "lucide-react";
import { createSupabaseServerClient } from "@/lib/supabase/server";
import { getStaffProfile, PERMISSIONS } from "@/lib/auth/rbac";
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
};

export default async function SettingsPage() {
  const supabase = await createSupabaseServerClient();
  const profile = await getStaffProfile(supabase);

  if (!profile || !profile.active) {
    redirect("/admin/login");
  }

  if (!profile.permissions.has(PERMISSIONS.MANAGE_SETTINGS)) {
    return (
      <div>
        <h1 className="mb-2 font-display text-2xl font-semibold text-[var(--rahma-charcoal)]">
          Settings
        </h1>
        <div
          className="mt-6 rounded-2xl border bg-white px-6 py-8 text-center"
          style={{ borderColor: "var(--rahma-border)" }}
        >
          <ShieldCheck className="mx-auto mb-3 size-8 text-[var(--rahma-muted)]" />
          <p className="font-medium text-[var(--rahma-charcoal)]">
            Insufficient permissions
          </p>
          <p className="mt-1 text-sm text-[var(--rahma-muted)]">
            You need the{" "}
            <code className="rounded bg-muted px-1 py-0.5 text-xs">
              manage_settings
            </code>{" "}
            permission to access this page.
          </p>
        </div>
      </div>
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
