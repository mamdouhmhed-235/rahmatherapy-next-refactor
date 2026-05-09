"use client";

import Link from "next/link";
import { useMemo } from "react";
import { format, parseISO } from "date-fns";
import {
  AreaChart,
  Area,
  XAxis,
  YAxis,
  Tooltip,
  ResponsiveContainer,
  CartesianGrid,
} from "recharts";
import { CalendarDays } from "lucide-react";
import { cn } from "@/lib/utils";
import { AdminEmptyState } from "../components/admin-ui";
import { buildDemandTrendData } from "./dashboard-helpers";

interface Booking {
  booking_date: string;
}

interface DemandTrendClientProps {
  bookings: Booking[];
  from: string;
  to: string;
  today: string;
}

export function DemandTrendClient({ bookings, from, to, today }: DemandTrendClientProps) {
  const sevenDaysFrom = format(parseISO(today), "yyyy-MM-dd");
  const sevenDaysTo = format(parseISO(today).getTime() + 6 * 86400000, "yyyy-MM-dd");
  const thirtyDaysFrom = format(parseISO(today), "yyyy-MM-dd");
  const thirtyDaysTo = format(parseISO(today).getTime() + 29 * 86400000, "yyyy-MM-dd");

  const isSevenDays = from === sevenDaysFrom && to === sevenDaysTo;
  const isThirtyDays = from === thirtyDaysFrom && to === thirtyDaysTo;

  const data = useMemo(() => buildDemandTrendData(bookings, from, to), [bookings, from, to]);

  const totalBookings = data.reduce((sum, d) => sum + d.bookings, 0);

  return (
    <div className="min-w-0">
      <div className="mb-3 flex items-center justify-between gap-3">
        <p className="text-sm font-semibold text-[var(--admin-body)]">Demand trend</p>
        <div className="inline-flex items-center rounded-[var(--admin-radius-control)] border border-[var(--admin-border)] bg-white p-0.5 shadow-[var(--admin-shadow-subtle)]">
          <Link
            href={`/admin/dashboard?range=custom&from=${sevenDaysFrom}&to=${sevenDaysTo}`}
            className={cn(
              "inline-flex h-8 items-center justify-center whitespace-nowrap rounded-[0.375rem] px-3 text-xs font-semibold outline-none transition-colors focus-visible:ring-2 focus-visible:ring-[var(--admin-focus)]/35",
              isSevenDays
                ? "bg-[var(--admin-primary)] text-white"
                : "text-[var(--admin-body)] hover:bg-[var(--admin-panel-muted)]"
            )}
          >
            7 days
          </Link>
          <Link
            href={`/admin/dashboard?range=custom&from=${thirtyDaysFrom}&to=${thirtyDaysTo}`}
            className={cn(
              "inline-flex h-8 items-center justify-center whitespace-nowrap rounded-[0.375rem] px-3 text-xs font-semibold outline-none transition-colors focus-visible:ring-2 focus-visible:ring-[var(--admin-focus)]/35",
              isThirtyDays
                ? "bg-[var(--admin-primary)] text-white"
                : "text-[var(--admin-body)] hover:bg-[var(--admin-panel-muted)]"
            )}
          >
            30 days
          </Link>
        </div>
      </div>

      {totalBookings > 0 ? (
        <div className="h-32 w-full">
          <ResponsiveContainer width="100%" height="100%">
            <AreaChart data={data} margin={{ top: 4, right: 4, bottom: 4, left: -20 }}>
              <defs>
                <linearGradient id="demandGradient" x1="0" y1="0" x2="0" y2="1">
                  <stop offset="0%" stopColor="var(--admin-success)" stopOpacity={0.25} />
                  <stop offset="100%" stopColor="var(--admin-success)" stopOpacity={0.02} />
                </linearGradient>
              </defs>
              <CartesianGrid strokeDasharray="3 3" stroke="var(--admin-border)" vertical={false} />
              <XAxis
                dataKey="label"
                tick={{ fontSize: 11, fill: "var(--admin-text-muted)" }}
                tickLine={false}
                axisLine={{ stroke: "var(--admin-border)" }}
                interval="preserveStartEnd"
              />
              <YAxis
                tick={{ fontSize: 11, fill: "var(--admin-text-muted)" }}
                tickLine={false}
                axisLine={false}
                allowDecimals={false}
              />
              <Tooltip
                content={({ active, payload, label }) => {
                  if (!active || !payload?.length) return null;
                  const value = payload[0].value as number;
                  return (
                    <div className="rounded-[var(--admin-radius-control)] border border-[var(--admin-border)] bg-[var(--admin-panel)] px-3 py-2 shadow-elevated">
                      <p className="text-xs text-[var(--admin-text-muted)]">{label}</p>
                      <p className="text-sm font-semibold text-[var(--admin-heading)]">
                        {value} booking{value === 1 ? "" : "s"}
                      </p>
                    </div>
                  );
                }}
              />
              <Area
                type="monotone"
                dataKey="bookings"
                stroke="var(--admin-success)"
                strokeWidth={2}
                fill="url(#demandGradient)"
                dot={{ r: 3, fill: "var(--admin-success)", strokeWidth: 0 }}
                activeDot={{ r: 5, fill: "var(--admin-primary)", strokeWidth: 0 }}
              />
            </AreaChart>
          </ResponsiveContainer>
        </div>
      ) : (
        <AdminEmptyState
          icon={CalendarDays}
          title="No bookings in this range"
          message="Adjust the date filter to see demand patterns."
          tone="muted"
        />
      )}
    </div>
  );
}
