import Image from "next/image";
import { redirect } from "next/navigation";
import { Lock } from "lucide-react";
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
    <main className="flex min-h-[100dvh] flex-col items-center justify-center bg-[var(--admin-canvas)] px-6 py-12">
      <div className="flex w-full max-w-[400px] flex-col">
        <div
          className="rounded-[var(--admin-radius-md)] border bg-[var(--admin-panel)] p-6 sm:p-8"
          style={{ borderColor: "var(--admin-border)" }}
        >
          <div className="mb-8 flex justify-center">
            <Image
              src="/images/brand/rahma/logo-refined.svg"
              alt="Rahma Therapy"
              width={180}
              height={66}
              priority
              className="h-auto w-[140px] sm:w-[180px]"
            />
          </div>

          <h1 className="mb-6 text-center font-display text-[1.778rem] font-semibold leading-tight tracking-tight text-[var(--admin-heading)]">
            Staff sign in
          </h1>

          {inactiveReason ? (
            <div
              role="status"
              className="mb-6 flex items-start gap-2.5 rounded-[var(--admin-radius-sm)] border bg-[var(--admin-restricted-bg)] p-4 text-sm text-[var(--admin-restricted)]"
              style={{
                borderColor:
                  "color-mix(in oklab, var(--admin-restricted) 28%, transparent)",
              }}
            >
              <Lock aria-hidden="true" className="mt-0.5 size-4 shrink-0" />
              <span>
                Your account has been deactivated. Contact the owner to regain
                access.
              </span>
            </div>
          ) : null}

          <LoginForm redirectTo={redirectTo} />
        </div>

        <p className="mt-6 text-center text-xs text-[var(--admin-text-muted)]">
          Rahma Therapy staff portal.
        </p>
      </div>
    </main>
  );
}
