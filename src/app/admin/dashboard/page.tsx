import { createSupabaseServerClient } from "@/lib/supabase/server";
import { getStaffProfile } from "@/lib/auth/rbac";
import { redirect } from "next/navigation";

export const metadata = {
  title: "Dashboard — Rahma Therapy Admin",
};

export default async function DashboardPage() {
  const supabase = await createSupabaseServerClient();
  const profile = await getStaffProfile(supabase);

  if (!profile || !profile.active) {
    redirect("/admin/login");
  }

  return (
    <div>
      {/* Page header */}
      <div className="mb-8">
        <h1 className="font-display text-2xl font-semibold text-[var(--rahma-charcoal)]">
          Welcome back, {profile.name}
        </h1>
        <p className="mt-1 text-sm text-[var(--rahma-muted)]">
          {profile.role_name} · Rahma Therapy Admin
        </p>
      </div>

      {/* Placeholder metric cards — wired in Phase 10 */}
      <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-3">
        {[
          { label: "New Bookings", note: "Requires Phase 10" },
          { label: "Unassigned Assignments", note: "Requires Phase 11" },
          { label: "Revenue This Month", note: "Requires Phase 10" },
        ].map(({ label, note }) => (
          <div
            key={label}
            className="rounded-2xl border bg-white px-6 py-5"
            style={{
              borderColor: "var(--rahma-border)",
              boxShadow: "var(--shadow-card-token)",
            }}
          >
            <p className="text-sm font-medium text-[var(--rahma-muted)]">
              {label}
            </p>
            <p className="mt-2 text-2xl font-semibold text-[var(--rahma-charcoal)]">
              —
            </p>
            <p className="mt-1 text-xs text-[var(--rahma-muted)]">{note}</p>
          </div>
        ))}
      </div>

      {/* Placeholder for "Needs Attention" unassigned bookings list */}
      <div
        className="mt-8 rounded-2xl border bg-white px-6 py-6"
        style={{
          borderColor: "var(--rahma-border)",
          boxShadow: "var(--shadow-card-token)",
        }}
      >
        <div className="flex items-center gap-3 mb-4">
          <h2 className="text-base font-semibold text-[var(--rahma-charcoal)]">
            Needs Attention
          </h2>
          {/* Badge placeholder — wired in Phase 10/11 */}
          <span className="rounded-full bg-red-100 px-2.5 py-0.5 text-xs font-semibold text-red-700">
            —
          </span>
        </div>
        <p className="text-sm text-[var(--rahma-muted)]">
          Unassigned booking assignments will appear here. Available in Phase 11.
        </p>
      </div>
    </div>
  );
}
