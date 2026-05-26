"use client";

import { useMemo } from "react";
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
import { EmptyState } from "../components/EmptyState";
import { buildDemandTrendData } from "./dashboard-helpers";

interface Booking {
  booking_date: string;
}

interface DemandTrendClientProps {
  bookings: Booking[];
  from: string;
  to: string;
  today?: string;
}

export function DemandTrendClient({ bookings, from, to }: DemandTrendClientProps) {
  const data = useMemo(() => buildDemandTrendData(bookings, from, to), [bookings, from, to]);

  const totalBookings = data.reduce((sum, d) => sum + d.bookings, 0);

  return (
    <div className="min-w-0">
      {totalBookings > 0 ? (
        <div
          className="w-full"
          style={{ height: 288, minWidth: 0 }}
          title={`${totalBookings} booking${totalBookings === 1 ? "" : "s"} across ${data.length} day${data.length === 1 ? "" : "s"}. Hover the chart for daily breakdown.`}
        >
          <ResponsiveContainer width="100%" height={288}>
            <AreaChart data={data} margin={{ top: 4, right: 4, bottom: 4, left: -20 }}>
              <defs>
                <linearGradient id="demandGradient" x1="0" y1="0" x2="0" y2="1">
                  <stop offset="0%" stopColor="var(--admin-accent)" stopOpacity={0.28} />
                  <stop offset="100%" stopColor="var(--admin-accent)" stopOpacity={0.02} />
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
                stroke="var(--admin-accent)"
                strokeWidth={2}
                fill="url(#demandGradient)"
                dot={{ r: 3, fill: "var(--admin-accent)", strokeWidth: 0 }}
                activeDot={{ r: 5, fill: "var(--admin-primary)", strokeWidth: 0 }}
              />
            </AreaChart>
          </ResponsiveContainer>
        </div>
      ) : (
        <EmptyState
          icon={CalendarDays}
          title="No bookings in this range"
          message="Adjust the date filter to see demand patterns."
          tone="muted"
        />
      )}
    </div>
  );
}
