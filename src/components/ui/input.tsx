import * as React from "react";
import { cn } from "@/lib/utils";

/**
 * Base Input — public-site and admin shared.
 *
 * Admin usage: prefer the <AdminField> wrapper in admin-ui.tsx which adds the
 * visible <label>, required * marker (Cancelled colour), and role="alert" error
 * region per DESIGN.md §5 and WCAG 2.1 AA requirements.
 *
 * This component intentionally stays a raw <input> wrapper so the public-site
 * forms that import it are unaffected by admin-specific additions.
 */
export function Input({
  className,
  type = "text",
  ...props
}: React.ComponentPropsWithRef<"input">) {
  return (
    <input
      data-slot="input"
      type={type}
      className={cn(
        // Base geometry
        "flex h-11 w-full rounded-[var(--admin-radius-control,6px)]",
        // Surface — Input Ground (barely warmer than the surrounding card)
        "bg-[var(--admin-surface-input,oklch(98.5%_0.005_88))]",
        // Border — Form Seam (oklch 55%) meets WCAG 1.4.11 Non-text Contrast.
        // NOT border-subtle (Warm Veil, oklch 89%) which fails 1.4.11.
        "border border-[var(--admin-border-form,oklch(55%_0.022_80))]",
        // Typography
        "px-3 py-2 text-sm text-[var(--admin-body,oklch(23%_0.01_143))]",
        // Placeholder
        "placeholder:text-[var(--admin-text-muted,oklch(42%_0.008_143))]",
        // Focus — Focus Azure ring, border shifts to focus colour
        "focus-visible:border-[var(--admin-focus,oklch(47%_0.095_230))]",
        "focus-visible:outline-none",
        "focus-visible:ring-2 focus-visible:ring-[var(--admin-focus,oklch(47%_0.095_230))]/30",
        // Error state — applied via data-error attribute from AdminField wrapper
        "data-[error=true]:border-[oklch(26%_0.14_25)]",
        // Disabled
        "disabled:cursor-not-allowed disabled:opacity-60",
        // Transition
        "transition-colors duration-[var(--motion-duration-fast,160ms)] ease-gentle",
        className
      )}
      {...props}
    />
  );
}

/**
 * AdminField — admin-only compound: label + input + optional required marker
 * + error region. Use this for every admin form field instead of bare <Input>.
 *
 * The error region is wrapped in role="alert" aria-live="polite" so assistive
 * tech announces errors on submit without a page reload (WCAG 2.1 AA, SC 4.1.3).
 */
export function AdminField({
  label,
  required,
  error,
  hint,
  id,
  children,
  className,
}: {
  label: string;
  required?: boolean;
  error?: string;
  hint?: string;
  /** Explicit id — falls back to a generated one if omitted. */
  id?: string;
  children: React.ReactNode;
  className?: string;
}) {
  const generatedId = React.useId();
  const fieldId  = id ?? generatedId;
  const errorId  = `${fieldId}-error`;
  const hintId   = `${fieldId}-hint`;

  // Inject id, aria-describedby, and data-error into the child input
  const child = React.Children.only(children) as React.ReactElement<
    React.InputHTMLAttributes<HTMLInputElement> & { "data-error"?: string }
  >;

  const describedBy = [
    error ? errorId : null,
    hint  ? hintId  : null,
  ]
    .filter(Boolean)
    .join(" ") || undefined;

  const clonedInput = React.cloneElement(child, {
    id: fieldId,
    "aria-describedby": describedBy,
    "aria-invalid": error ? ("true" as const) : undefined,
    "aria-required": required ? ("true" as const) : undefined,
    "data-error": error ? "true" : undefined,
    ...(child.props as object),
  } as React.InputHTMLAttributes<HTMLInputElement>);

  return (
    <div className={cn("grid gap-1.5", className)}>
      {/* Label row */}
      <label
        htmlFor={fieldId}
        className="text-sm font-medium text-[var(--admin-heading,oklch(11%_0.014_155))]"
      >
        {label}
        {required ? (
          // Visually marks the field as required. aria-hidden so SR reads the
          // label's aria-required attribute instead of a bare asterisk.
          <span
            aria-hidden="true"
            className="ml-1 text-[var(--admin-status-cancelled-text)]"
          >
            *
          </span>
        ) : null}
      </label>

      {/* Hint (shown above the field, below the label) */}
      {hint ? (
        <p
          id={hintId}
          className="text-xs text-[var(--admin-text-muted)]"
        >
          {hint}
        </p>
      ) : null}

      {/* Input */}
      {clonedInput}

      {/* Error region — role="alert" announces to screen readers on mount */}
      {error ? (
        <div
          id={errorId}
          role="alert"
          aria-live="polite"
          aria-atomic="true"
          className="flex items-center gap-1.5 text-xs text-[var(--admin-status-cancelled-text)]"
        >
          <svg
            aria-hidden="true"
            viewBox="0 0 16 16"
            className="size-3.5 shrink-0 fill-current"
          >
            <path d="M8 1a7 7 0 1 0 0 14A7 7 0 0 0 8 1zM7.25 4.75a.75.75 0 0 1 1.5 0v3.5a.75.75 0 0 1-1.5 0v-3.5zM8 11a1 1 0 1 1 0-2 1 1 0 0 1 0 2z" />
          </svg>
          {error}
        </div>
      ) : null}
    </div>
  );
}
