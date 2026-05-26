"use client";

/**
 * Shared empty / error placeholder rendered inside chart primitives when
 * `data === undefined` (error) or `data.length === 0` (empty). Keeps the
 * surrounding ResponsiveContainer mounted so the consumer's layout doesn't
 * jump between data-present and data-absent renders.
 */
export function ChartEmpty({
  height = 240,
  message,
}: {
  height?: number;
  message: string;
}) {
  return (
    <div
      role="status"
      className="grid w-full place-items-center text-center text-sm text-[var(--admin-text-muted)]"
      style={{ minHeight: height }}
    >
      {message}
    </div>
  );
}

export function ChartError({ height = 240 }: { height?: number }) {
  return (
    <div
      role="status"
      className="grid w-full place-items-center text-center text-sm text-[var(--admin-text-muted)]"
      style={{ minHeight: height }}
    >
      Couldn&rsquo;t load this chart. Try refreshing.
    </div>
  );
}
