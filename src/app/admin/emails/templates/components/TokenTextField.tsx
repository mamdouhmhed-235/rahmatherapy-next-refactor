"use client";

// C-15 Phase C, Step 9 — chip-token input.
//
// Directed decision (Q9.1): textarea + cursor-insert chips, NOT a
// contenteditable-with-pill-spans field. Both approaches would persist the
// exact same canonical `{token}` string (this component's `value` is a
// plain string throughout — no special encoding), but contenteditable pill
// spans are a well-known accessibility/mobile-IME liability (caret
// placement, screen-reader announcement, Android composition events) for a
// gain the plan's own risk table already rates medium/medium. This makes
// that fallback genuinely good rather than grudging: insert-at-caret (never
// append), focus + caret restored after insertion, a live character
// counter, keyboard-operable chips with real aria-labels, min-h-11 touch
// targets, and chips that wrap at 375px.

import { useEffect, useRef, useState, useId, type ChangeEvent } from "react";
import { Plus } from "lucide-react";
import { cn } from "@/lib/utils";
import type { TemplateToken } from "@/app/admin/emails/components/templates-data";

export interface TokenTextFieldProps {
  /** The field's registry `kind` — also the `saveTemplateOverride` form
   *  field name (`field:{kind}`) so a native form submit picks this input
   *  up without extra plumbing (matches the codebase's existing
   *  SafeFieldInput convention). */
  kind: string;
  label: string;
  helper: string;
  placeholder: string;
  maxLength: number;
  multiline?: boolean;
  value: string;
  onChange: (value: string) => void;
  tokens?: TemplateToken[];
  /** Registry default text — shown only as a preview in the "Use default"
   *  reveal. Never written back verbatim (see onUseDefault). */
  defaultValue: string;
  /** Clears the field. Empty string is the canonical "use the built-in
   *  default" signal both at save time (saveTemplateOverride deletes the
   *  override row) and at render time (templates.ts's `||` fallback) — so
   *  clearing, not writing back `defaultValue`, is what actually restores
   *  the true runtime default for fields whose real default is conditional
   *  (group_copy, footer_contact, booking_restored's greeting_intro). */
  onUseDefault: () => void;
  readOnly?: boolean;
  errorMessage?: string;
}

export function TokenTextField({
  kind,
  label,
  helper,
  placeholder,
  maxLength,
  multiline = false,
  value,
  onChange,
  tokens,
  defaultValue,
  onUseDefault,
  readOnly = false,
  errorMessage,
}: TokenTextFieldProps) {
  const inputId = useId();
  const helperId = useId();
  const errorId = useId();
  const fieldRef = useRef<HTMLTextAreaElement & HTMLInputElement>(null);
  const pendingCaretRef = useRef<number | null>(null);
  const [defaultRevealed, setDefaultRevealed] = useState(false);
  const revealRef = useRef<HTMLDivElement>(null);

  const isOverridden = value !== "";
  const tooLong = value.length > maxLength;
  const hasError = Boolean(errorMessage) || tooLong;

  // Restore focus + caret position after a chip insertion so typing can
  // continue exactly where the operator left off, never just append-to-end.
  // Guarded so ordinary typing (which also changes `value`) never fights
  // the browser's own caret handling.
  useEffect(() => {
    if (pendingCaretRef.current == null) return;
    const pos = pendingCaretRef.current;
    pendingCaretRef.current = null;
    const el = fieldRef.current;
    if (!el) return;
    el.focus();
    el.setSelectionRange(pos, pos);
  }, [value]);

  // Close the default-reveal popover on outside click or Escape.
  useEffect(() => {
    if (!defaultRevealed) return;
    function onPointerDown(e: PointerEvent) {
      if (revealRef.current && !revealRef.current.contains(e.target as Node)) {
        setDefaultRevealed(false);
      }
    }
    function onKeyDown(e: KeyboardEvent) {
      if (e.key === "Escape") setDefaultRevealed(false);
    }
    document.addEventListener("pointerdown", onPointerDown);
    document.addEventListener("keydown", onKeyDown);
    return () => {
      document.removeEventListener("pointerdown", onPointerDown);
      document.removeEventListener("keydown", onKeyDown);
    };
  }, [defaultRevealed]);

  function insertToken(token: string) {
    if (readOnly) return;
    const el = fieldRef.current;
    const start = el?.selectionStart ?? value.length;
    const end = el?.selectionEnd ?? value.length;
    const next = (value.slice(0, start) + token + value.slice(end)).slice(0, maxLength);
    pendingCaretRef.current = Math.min(start + token.length, maxLength);
    onChange(next);
  }

  function handleChange(e: ChangeEvent<HTMLTextAreaElement | HTMLInputElement>) {
    // Defensive clamp — the native `maxLength` attribute already blocks
    // typed input past the limit, but a paste can still exceed it.
    onChange(e.target.value.slice(0, maxLength));
  }

  function handleUseDefault() {
    setDefaultRevealed(false);
    onUseDefault();
  }

  const describedBy = [helperId, hasError ? errorId : null].filter(Boolean).join(" ");

  const fieldClassName = cn(
    "rounded-[var(--admin-radius-control)] border bg-[var(--admin-input)] px-3 text-sm text-[var(--admin-body)] outline-none transition-colors placeholder:text-[var(--admin-text-muted)] focus:border-[var(--admin-focus)] focus:ring-2 focus:ring-[var(--admin-focus)]/55",
    "read-only:cursor-default read-only:bg-[var(--admin-panel-muted)] read-only:text-[var(--admin-text-muted)] read-only:focus:ring-0",
    hasError ? "border-[oklch(40%_0.14_25)]" : "border-[var(--admin-border-form)]",
    multiline ? "min-h-[5.5rem] py-2 leading-relaxed" : "h-11"
  );

  return (
    <div className="flex flex-col gap-1.5">
      <div className="flex items-center justify-between gap-2">
        <label
          htmlFor={inputId}
          className="text-xs font-medium tracking-[0.01em] text-[var(--admin-heading)]"
        >
          {label}
        </label>
        {!readOnly && isOverridden ? (
          <div ref={revealRef} className="relative inline-flex">
            <button
              type="button"
              onClick={() => setDefaultRevealed((v) => !v)}
              aria-expanded={defaultRevealed}
              className="inline-flex min-h-6 items-center gap-1 rounded-[var(--admin-radius-control)] px-1.5 text-[11px] font-medium text-[var(--admin-text-muted)] outline-none transition-colors hover:bg-[var(--admin-panel-muted)] hover:text-[var(--admin-heading)] focus-visible:ring-2 focus-visible:ring-[var(--admin-focus)]/55"
            >
              Edited — Use default
            </button>
            {defaultRevealed ? (
              <div className="absolute right-0 top-full z-20 mt-1 w-64 max-w-[80vw] rounded-[var(--admin-radius-card)] border border-[var(--admin-border)] bg-[var(--admin-panel)] p-3 text-xs shadow-[var(--admin-shadow-overlay)]">
                <p className="mb-2 font-medium text-[var(--admin-text-muted)]">
                  Default text
                </p>
                <p className="mb-3 max-h-40 overflow-y-auto whitespace-pre-wrap text-[var(--admin-body)]">
                  {defaultValue}
                </p>
                <button
                  type="button"
                  onClick={handleUseDefault}
                  className="inline-flex min-h-8 w-full items-center justify-center rounded-[var(--admin-radius-control)] bg-[var(--admin-primary)] px-3 text-xs font-semibold text-[var(--admin-on-primary)] outline-none transition-colors hover:bg-[var(--admin-primary-hover)] focus-visible:ring-2 focus-visible:ring-[var(--admin-focus)]/55"
                >
                  Use default text
                </button>
              </div>
            ) : null}
          </div>
        ) : null}
      </div>

      {multiline ? (
        <textarea
          ref={fieldRef}
          id={inputId}
          name={`field:${kind}`}
          rows={3}
          value={value}
          placeholder={placeholder}
          maxLength={maxLength}
          readOnly={readOnly}
          aria-describedby={describedBy || undefined}
          aria-invalid={hasError || undefined}
          onChange={handleChange}
          className={fieldClassName}
        />
      ) : (
        <input
          ref={fieldRef}
          id={inputId}
          name={`field:${kind}`}
          type="text"
          value={value}
          placeholder={placeholder}
          maxLength={maxLength}
          readOnly={readOnly}
          aria-describedby={describedBy || undefined}
          aria-invalid={hasError || undefined}
          onChange={handleChange}
          className={fieldClassName}
        />
      )}

      {!readOnly && tokens && tokens.length > 0 ? (
        <div
          role="group"
          aria-label={`Insert a variable into ${label}`}
          className="flex flex-wrap items-center gap-1.5"
        >
          {tokens.map((t) => (
            <button
              key={t.token}
              type="button"
              onClick={() => insertToken(t.token)}
              aria-label={`Insert ${t.label}`}
              title={`Insert ${t.label} (${t.token}) at the cursor`}
              className="inline-flex min-h-11 items-center gap-1 rounded-full border border-[var(--admin-border-form)] bg-[var(--admin-panel-muted)] px-2.5 text-xs font-medium text-[var(--admin-body)] outline-none transition-colors hover:border-[var(--admin-primary)]/40 hover:bg-[var(--admin-hover-mist)] focus-visible:ring-2 focus-visible:ring-[var(--admin-focus)]/55"
            >
              <Plus className="size-3 shrink-0" aria-hidden="true" />
              {t.label}
            </button>
          ))}
        </div>
      ) : null}

      <div id={helperId} className="flex items-start justify-between gap-3 text-xs">
        <span className="text-[var(--admin-text-muted)]">{helper}</span>
        {!readOnly ? (
          <span
            className={tooLong ? "text-[oklch(26%_0.14_25)]" : "text-[var(--admin-text-muted)]"}
          >
            {value.length}/{maxLength}
          </span>
        ) : null}
      </div>

      {errorMessage ? (
        <p id={errorId} role="alert" className="text-xs text-[oklch(26%_0.14_25)]">
          {errorMessage}
        </p>
      ) : null}
    </div>
  );
}
