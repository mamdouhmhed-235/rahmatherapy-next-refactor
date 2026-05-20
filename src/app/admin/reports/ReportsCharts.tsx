"use client";

import {
  Bar,
  BarChart,
  CartesianGrid,
  Legend,
  Line,
  LineChart,
  ResponsiveContainer,
  Tooltip,
  XAxis,
  YAxis,
} from "recharts";

interface RevenuePoint {
  period: string;
  booked: number;
  collected: number;
  outstanding: number;
}

interface CountPoint {
  name: string;
  value: number;
}

export function RevenueChart({ data }: { data: RevenuePoint[] }) {
  return (
    <div className="w-full" aria-label="Revenue by period chart">
      <ResponsiveContainer width="100%" height={288} minWidth={0} minHeight={288}>
        <LineChart data={data} margin={{ top: 8, right: 12, bottom: 0, left: 0 }}>
          <CartesianGrid strokeDasharray="3 3" stroke="var(--admin-border)" />
          <XAxis dataKey="period" tick={{ fontSize: 12 }} />
          <YAxis tick={{ fontSize: 12 }} width={56} />
          <Tooltip formatter={(value) => `£${Number(value).toFixed(2)}`} />
          <Legend />
          <Line type="monotone" dataKey="booked" stroke="var(--admin-primary)" strokeWidth={2} dot={false} />
          <Line type="monotone" dataKey="collected" stroke="var(--admin-success)" strokeWidth={2} dot={false} />
          <Line type="monotone" dataKey="outstanding" stroke="var(--admin-warning)" strokeWidth={2} dot={false} />
        </LineChart>
      </ResponsiveContainer>
    </div>
  );
}

export function CountBarChart({
  data,
  label,
}: {
  data: CountPoint[];
  label: string;
}) {
  return (
    <div className="w-full" aria-label={label}>
      <ResponsiveContainer width="100%" height={288} minWidth={0} minHeight={288}>
        <BarChart data={data.slice(0, 8)} margin={{ top: 8, right: 12, bottom: 0, left: 0 }}>
          <CartesianGrid strokeDasharray="3 3" stroke="var(--admin-border)" />
          <XAxis dataKey="name" tick={{ fontSize: 12 }} interval={0} angle={-20} height={62} />
          <YAxis tick={{ fontSize: 12 }} width={36} allowDecimals={false} />
          <Tooltip />
          <Bar dataKey="value" fill="var(--admin-primary)" radius={[4, 4, 0, 0]} />
        </BarChart>
      </ResponsiveContainer>
    </div>
  );
}
