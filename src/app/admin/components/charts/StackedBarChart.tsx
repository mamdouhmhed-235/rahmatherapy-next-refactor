"use client";

import {
  Bar,
  BarChart as RechartsBarChart,
  CartesianGrid,
  ResponsiveContainer,
  Tooltip,
  XAxis,
  YAxis,
} from "recharts";
import { ChartEmpty, ChartError } from "./chart-states";
import { defaultChartTheme } from "./theme";
import { useReducedMotion } from "../use-reduced-motion";

export interface StackedBarSeries {
  dataKey: string;
  label?: string;
  fill?: string;
}

export interface StackedBarChartProps<T extends Record<string, unknown>> {
  data?: T[] | null;
  series: StackedBarSeries[];
  categoryKey: string;
  height?: number;
  layout?: "horizontal" | "vertical";
  hideAxes?: boolean;
  ariaLabel?: string;
}

/**
 * Stacked bar primitive. Default `horizontal` uses vertical bars (Reports
 * status-breakdown). `vertical` layout with `hideAxes` is the workload-row
 * inline variant (18px high; no axes; bars stretch horizontally).
 */
export function StackedBarChart<T extends Record<string, unknown>>({
  data,
  series,
  categoryKey,
  height = 240,
  layout = "horizontal",
  hideAxes = false,
  ariaLabel,
}: StackedBarChartProps<T>) {
  const reduce = useReducedMotion();
  if (data == null) return <ChartError height={height} />;
  if (data.length === 0)
    return <ChartEmpty height={height} message="No activity recorded." />;
  const showAxes = !hideAxes;
  return (
    <div className="w-full" aria-label={ariaLabel}>
      <ResponsiveContainer width="100%" height={height} minHeight={height}>
        <RechartsBarChart
          data={data}
          layout={layout}
          margin={{ top: 8, right: 12, bottom: 0, left: 0 }}
        >
          {showAxes ? (
            <CartesianGrid
              strokeDasharray={defaultChartTheme.gridStrokeDasharray}
              stroke={defaultChartTheme.gridStroke}
              vertical={layout === "vertical"}
              horizontal={layout === "horizontal"}
            />
          ) : null}
          {showAxes ? (
            layout === "horizontal" ? (
              <>
                <XAxis
                  dataKey={categoryKey}
                  tick={{ fontSize: defaultChartTheme.fontSize, fill: defaultChartTheme.axisTickFill }}
                  stroke={defaultChartTheme.axisStroke}
                  interval={0}
                />
                <YAxis
                  tick={{ fontSize: defaultChartTheme.fontSize, fill: defaultChartTheme.axisTickFill }}
                  stroke={defaultChartTheme.axisStroke}
                  width={36}
                  allowDecimals={false}
                />
              </>
            ) : (
              <>
                <XAxis
                  type="number"
                  tick={{ fontSize: defaultChartTheme.fontSize, fill: defaultChartTheme.axisTickFill }}
                  stroke={defaultChartTheme.axisStroke}
                  allowDecimals={false}
                />
                <YAxis
                  dataKey={categoryKey}
                  type="category"
                  tick={{ fontSize: defaultChartTheme.fontSize, fill: defaultChartTheme.axisTickFill }}
                  stroke={defaultChartTheme.axisStroke}
                  width={96}
                />
              </>
            )
          ) : null}
          <Tooltip
            contentStyle={{
              background: defaultChartTheme.tooltipBg,
              border: `1px solid ${defaultChartTheme.tooltipBorder}`,
              borderRadius: defaultChartTheme.tooltipRadius,
              fontSize: defaultChartTheme.fontSize + 1,
            }}
          />
          {series.map((s) => (
            <Bar
              key={s.dataKey}
              dataKey={s.dataKey}
              name={s.label ?? s.dataKey}
              stackId="stack"
              fill={s.fill ?? defaultChartTheme.primaryStroke}
              isAnimationActive={!reduce}
            />
          ))}
        </RechartsBarChart>
      </ResponsiveContainer>
    </div>
  );
}
