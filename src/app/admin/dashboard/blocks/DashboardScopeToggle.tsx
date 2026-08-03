"use client";

// C-07 Phase B2 step 11 (B-139) — Team/Mine scope pill for the Business
// (Owner/Admin) dashboard header.
//
// State lives in the URL (`?scope=mine`; absent = team) so it survives
// navigation and is readable by the server component that fetches the data.
// Mounted ONLY from `BusinessDashboard.tsx` — Coordinator and Therapist
// dashboards never render it (their data is already role-scoped, brief §2.9).

import { useRouter, useSearchParams, usePathname } from "next/navigation";

export type DashboardScopeValue = "team" | "mine";

interface DashboardScopeToggleProps {
  currentScope: DashboardScopeValue;
}

const BUTTON_BASE =
  "px-3 py-1.5 text-xs font-medium outline-none transition-colors duration-150 ease-out focus-visible:ring-[3px] focus-visible:ring-inset focus-visible:ring-[var(--admin-focus)]/55 motion-reduce:transition-none";

export function DashboardScopeToggle({ currentScope }: DashboardScopeToggleProps) {
  const router = useRouter();
  const searchParams = useSearchParams();
  const pathname = usePathname();

  const setScope = (next: DashboardScopeValue) => {
    const params = new URLSearchParams(searchParams.toString());
    if (next === "mine") {
      params.set("scope", "mine");
    } else {
      params.delete("scope");
    }
    const query = params.toString();
    router.push(query ? `${pathname}?${query}` : pathname);
  };

  return (
    <div
      role="group"
      aria-label="Dashboard scope"
      className="inline-flex overflow-hidden rounded-[var(--admin-radius-control)] border border-[var(--admin-border-form)]"
    >
      <button
        type="button"
        onClick={() => setScope("team")}
        className={`${BUTTON_BASE} ${
          currentScope === "team"
            ? "bg-[var(--admin-primary)] text-[var(--admin-on-primary)]"
            : "bg-transparent text-[var(--admin-body)] hover:bg-[var(--admin-panel-muted)]"
        }`}
        aria-pressed={currentScope === "team"}
      >
        Team
      </button>
      <button
        type="button"
        onClick={() => setScope("mine")}
        className={`${BUTTON_BASE} ${
          currentScope === "mine"
            ? "bg-[var(--admin-primary)] text-[var(--admin-on-primary)]"
            : "bg-transparent text-[var(--admin-body)] hover:bg-[var(--admin-panel-muted)]"
        }`}
        aria-pressed={currentScope === "mine"}
      >
        Mine
      </button>
    </div>
  );
}
