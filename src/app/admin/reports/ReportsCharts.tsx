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
    <div className="h-72 w-full" aria-label="Revenue by period chart">
      <ResponsiveContainer width="100%" height="100%" minWidth={0} minHeight={288}>
        <LineChart data={data} margin={{ top: 8, right: 12, bottom: 0, left: 0 }}>
          <CartesianGrid strokeDasharray="3 3" stroke="#e8dfd2" />
          <XAxis dataKey="period" tick={{ fontSize: 12 }} />
          <YAxis tick={{ fontSize: 12 }} width={56} />
          <Tooltip formatter={(value) => `£${Number(value).toFixed(2)}`} />
          <Legend />
          <Line type="monotone" dataKey="booked" stroke="#30463f" strokeWidth={2} dot={false} />
          <Line type="monotone" dataKey="collected" stroke="#2f7d6d" strokeWidth={2} dot={false} />
          <Line type="monotone" dataKey="outstanding" stroke="#c27803" strokeWidth={2} dot={false} />
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
    <div className="h-72 w-full" aria-label={label}>
      <ResponsiveContainer width="100%" height="100%" minWidth={0} minHeight={288}>
        <BarChart data={data.slice(0, 8)} margin={{ top: 8, right: 12, bottom: 0, left: 0 }}>
          <CartesianGrid strokeDasharray="3 3" stroke="#e8dfd2" />
          <XAxis dataKey="name" tick={{ fontSize: 12 }} interval={0} angle={-20} height={62} />
          <YAxis tick={{ fontSize: 12 }} width={36} allowDecimals={false} />
          <Tooltip />
          <Bar dataKey="value" fill="#30463f" radius={[4, 4, 0, 0]} />
        </BarChart>
      </ResponsiveContainer>
    </div>
  );
}
