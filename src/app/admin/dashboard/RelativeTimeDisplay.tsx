"use client";

import { useEffect, useState } from "react";

interface RelativeTimeDisplayProps {
  targetISO: string;
}

/**
 * Renders "in 1h 12m" etc. relative to the target datetime.
 *
 * Renders an empty string on SSR + first hydration to avoid hydration mismatch,
 * then computes and updates on mount + every minute.
 */
export function RelativeTimeDisplay({ targetISO }: RelativeTimeDisplayProps) {
  const [text, setText] = useState("");

  useEffect(() => {
    const update = () => setText(computeRelative(targetISO));
    update();
    const id = setInterval(update, 60_000);
    return () => clearInterval(id);
  }, [targetISO]);

  return <>{text}</>;
}

function computeRelative(targetISO: string): string {
  const target = new Date(targetISO);
  const now = new Date();
  const ms = target.getTime() - now.getTime();
  if (ms < 0) return "now"; // appointment is at-or-past start time
  const mins = Math.floor(ms / 60_000);
  const hours = Math.floor(mins / 60);
  const remainingMins = mins % 60;
  if (hours > 0) return `in ${hours}h ${remainingMins}m`;
  return `in ${mins}m`;
}
