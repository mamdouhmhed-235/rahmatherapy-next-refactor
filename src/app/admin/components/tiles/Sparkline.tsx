"use client";

import { SparklineChart, type SparklinePoint } from "../charts/SparklineChart";

export interface SparklineProps {
  values?: number[];
  height?: number;
  stroke?: string;
  className?: string;
}

/**
 * Tile-tail wrapper around <SparklineChart>. Accepts a plain number[]
 * (consumers don't need to shape `{ value }` objects). 32px default height
 * matches the KpiTile tail spec.
 */
export function Sparkline({ values, height = 32, stroke, className }: SparklineProps) {
  const data: SparklinePoint[] | undefined = values?.map((v) => ({ value: v }));
  return <SparklineChart data={data} height={height} stroke={stroke} className={className} />;
}
