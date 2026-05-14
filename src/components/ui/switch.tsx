"use client";

import * as React from "react";
import { cn } from "@/lib/utils";

export interface SwitchProps {
  checked?: boolean;
  defaultChecked?: boolean;
  onCheckedChange?: (checked: boolean) => void;
  disabled?: boolean;
  name?: string;
  value?: string;
  id?: string;
  className?: string;
  "aria-label"?: string;
  "aria-labelledby"?: string;
  "aria-describedby"?: string;
}

export function Switch({
  checked,
  defaultChecked,
  onCheckedChange,
  disabled = false,
  name,
  value,
  id,
  className,
  ...ariaProps
}: SwitchProps) {
  const [internalChecked, setInternalChecked] = React.useState(
    defaultChecked ?? false
  );
  const isControlled = checked !== undefined;
  const isChecked = isControlled ? checked : internalChecked;

  function handleClick() {
    if (disabled) return;
    const next = !isChecked;
    if (!isControlled) setInternalChecked(next);
    onCheckedChange?.(next);
  }

  function handleKeyDown(e: React.KeyboardEvent) {
    if (e.key === " " || e.key === "Enter") {
      e.preventDefault();
      handleClick();
    }
  }

  return (
    <>
      {name && (
        <input
          type="hidden"
          name={name}
          value={isChecked ? (value ?? "on") : ""}
        />
      )}
      <button
        id={id}
        type="button"
        role="switch"
        aria-checked={isChecked}
        disabled={disabled}
        onClick={handleClick}
        onKeyDown={handleKeyDown}
        data-slot="switch"
        data-state={isChecked ? "checked" : "unchecked"}
        className={cn(
          "relative inline-flex h-6 w-11 shrink-0 cursor-pointer items-center rounded-full border-2 border-transparent",
          "transition-colors duration-[var(--motion-duration-fast)] ease-gentle",
          "focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[var(--admin-focus)] focus-visible:ring-offset-2 focus-visible:ring-offset-[var(--admin-canvas)]",
          "disabled:cursor-not-allowed disabled:opacity-50",
          isChecked
            ? "bg-[var(--admin-primary)]"
            : "bg-[var(--admin-border)]",
          className
        )}
        {...ariaProps}
      >
        <span
          aria-hidden="true"
          className={cn(
            "pointer-events-none block h-5 w-5 rounded-full bg-white shadow-sm",
            "transition-transform duration-[var(--motion-duration-fast)] ease-gentle",
            isChecked ? "translate-x-5" : "translate-x-0"
          )}
        />
      </button>
    </>
  );
}
