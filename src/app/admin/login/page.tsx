import { redirect } from "next/navigation";
import { createSupabaseServerClient } from "@/lib/supabase/server";
import { getStaffProfile } from "@/lib/auth/rbac";
import { LoginForm } from "./LoginForm";

interface LoginPageProps {
  searchParams: Promise<{ redirectTo?: string; reason?: string }>;
}

export const metadata = {
  title: "Sign In — Rahma Therapy Admin",
};

export default async function AdminLoginPage({ searchParams }: LoginPageProps) {
  const supabase = await createSupabaseServerClient();
  const profile = await getStaffProfile(supabase);

  // Already authenticated and active — send to dashboard
  if (profile?.active) {
    redirect("/admin/dashboard");
  }

  const params = await searchParams;
  const requestedRedirect = params.redirectTo;
  const redirectTo =
    requestedRedirect === "/admin" || requestedRedirect === "/admin/"
      ? "/admin/dashboard"
      : requestedRedirect?.startsWith("/admin") &&
          !requestedRedirect.startsWith("//")
        ? requestedRedirect
        : "/admin/dashboard";
  const inactiveReason = params.reason === "inactive";

  return (
    <div className="flex min-h-screen items-center justify-center bg-[var(--rahma-ivory)] px-4">
      <div className="w-full max-w-sm">
        {/* Logo / Brand mark */}
        <div className="mb-8 text-center">
          <div
            className="mx-auto mb-4 flex size-12 items-center justify-center rounded-xl"
            style={{ background: "var(--rahma-green)" }}
          >
            <svg
              width="24"
              height="24"
              viewBox="0 0 24 24"
              fill="none"
              aria-hidden="true"
            >
              <path
                d="M12 3C7 3 3 7 3 12s4 9 9 9 9-4 9-9-4-9-9-9Z"
                stroke="#ffffff"
                strokeWidth="1.5"
                strokeLinecap="round"
              />
              <path
                d="M12 8v8M8 12h8"
                stroke="#ffffff"
                strokeWidth="1.5"
                strokeLinecap="round"
              />
            </svg>
          </div>
          <h1 className="font-display text-2xl font-semibold text-[var(--rahma-charcoal)]">
            Rahma Therapy
          </h1>
          <p className="mt-1 text-sm text-[var(--rahma-muted)]">
            Admin &amp; Staff Portal
          </p>
        </div>

        {/* Card */}
        <div
          className="rounded-2xl border bg-white px-8 py-8"
          style={{
            borderColor: "var(--rahma-border)",
            boxShadow: "var(--shadow-card-token)",
          }}
        >
          <h2 className="mb-6 text-lg font-semibold text-[var(--rahma-charcoal)]">
            Sign in to your account
          </h2>
          <LoginForm redirectTo={redirectTo} inactiveReason={inactiveReason} />
        </div>

        <p className="mt-6 text-center text-xs text-[var(--rahma-muted)]">
          Staff access only. Contact your administrator if you need help.
        </p>
      </div>
    </div>
  );
}
