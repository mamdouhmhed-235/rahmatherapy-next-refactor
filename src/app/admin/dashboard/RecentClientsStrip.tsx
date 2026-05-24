// SERVER COMPONENT — Therapist recent-clients strip (brief §5.6 block 8).
//
// Last 6 unique clients seen by this Therapist within the past 30 days
// (computed by `getRecentClientsForTherapist`). Horizontal scroll on mobile,
// 4-card grid on desktop ≥md. Hidden entirely when input is empty
// (the helper returns []) — brand-new therapists never see this strip.
//
// AUDIT G-final-4: depends on data.bookings being narrowed to
// assigned_and_claimable upstream — that filter delivers "clients I personally
// saw" for free. Do not widen.

import Link from "next/link";
import type { RecentClient } from "./therapist-fullness";

export interface RecentClientsStripProps {
  clients: RecentClient[];
}

function pluralDays(n: number): string {
  if (n === 0) return "today";
  if (n === 1) return "1 day ago";
  return `${n} days ago`;
}

function pickInitials(name: string): string {
  return name
    .split(/\s+/)
    .filter(Boolean)
    .slice(0, 2)
    .map((part) => Array.from(part)[0] ?? "")
    .join("")
    .toUpperCase();
}

export function RecentClientsStrip({ clients }: RecentClientsStripProps) {
  if (clients.length === 0) return null;
  return (
    <section
      aria-labelledby="recent-clients-strip-heading"
      className="flex flex-col gap-3 rounded-[var(--admin-radius-card)] border border-[var(--admin-border)] bg-[var(--admin-panel)] p-5"
    >
      <div className="flex items-baseline justify-between gap-3">
        <h2
          id="recent-clients-strip-heading"
          style={{
            fontFamily:
              "var(--font-urbanist), var(--font-work-sans), Arial, sans-serif",
          }}
          className="text-[1.111rem] font-semibold tracking-[-0.01em] text-[var(--admin-heading)]"
        >
          Recent clients
        </h2>
        <p className="text-xs text-[var(--admin-text-muted)]">Last 30 days</p>
      </div>
      <ul
        className="m-0 flex list-none gap-3 overflow-x-auto p-0 md:grid md:grid-cols-4 md:overflow-visible"
        style={{ scrollSnapType: "x mandatory" }}
      >
        {clients.map((client) => (
          <li
            key={client.clientId}
            className="min-w-[200px] shrink-0 md:min-w-0"
            style={{ scrollSnapAlign: "start" }}
          >
            <Link
              href={`/admin/clients/${client.clientId}`}
              className="flex h-full flex-col gap-2 rounded-[var(--admin-radius-control)] border border-[var(--admin-border)] bg-[var(--admin-panel-muted)]/40 p-3 outline-none transition-colors duration-150 ease-out hover:bg-[var(--admin-panel-muted)] focus-visible:ring-[3px] focus-visible:ring-offset-2 focus-visible:ring-[var(--admin-focus)]/55 motion-reduce:transition-none"
            >
              <div className="flex items-center gap-2">
                <span
                  aria-hidden="true"
                  className="inline-flex size-8 shrink-0 items-center justify-center rounded-full text-xs font-semibold"
                  style={{
                    backgroundColor: "var(--status-confirmed-bg)",
                    color: "var(--status-confirmed-text)",
                  }}
                >
                  {pickInitials(client.fullName) || "—"}
                </span>
                <p className="min-w-0 flex-1 truncate text-sm font-semibold text-[var(--admin-heading)]">
                  {client.firstName}
                </p>
              </div>
              <p className="truncate text-xs text-[var(--admin-text-muted)]">
                {client.lastService}
              </p>
              <p className="text-xs text-[var(--admin-text-muted)]">
                {pluralDays(client.daysSinceLast)}
              </p>
            </Link>
          </li>
        ))}
      </ul>
    </section>
  );
}
