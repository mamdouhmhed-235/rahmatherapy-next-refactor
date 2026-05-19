"use client";

import { useActionState, useEffect, useId, useMemo, useRef, useState } from "react";
import { CheckCircle, Info, Loader2, RefreshCcw, RotateCcw, XCircle } from "lucide-react";
import { toast } from "sonner";
import { cn } from "@/lib/utils";
import type { TemplateMeta } from "./templates-data";
import {
  saveTemplateOverride,
  type SaveTemplateOverrideResult,
} from "../../email-templates/actions";

interface TemplateEditFormProps {
  template: TemplateMeta;
  onDirtyChange: (dirty: boolean) => void;
  registerLeaveGuard: (canLeave: () => boolean) => void;
  /** Saved override values for this template, fetched server-side. The form
   *  uses these as the "what's saved" baseline so the `dirty` check + the
   *  pre-populated edit experience work correctly. A live sessionStorage
   *  draft (if present) still wins for `values` on mount — drafts represent
   *  in-progress edits the user hasn't saved yet. */
  serverInitialValues?: Record<string, string>;
}

// Variables the runtime substitutes inside template copy. If an operator
// types {clientNam} or {clientmane}, we want to catch it.
const ALLOWED_VARIABLES = new Set([
  "clientName",
  "companyName",
  "bookingDate",
  "startTime",
  "endTime",
  "contactPhone",
  "contactEmail",
  "participantCount",
  "manageUrl",
  "addressLines",
  "totalPrice",
  "therapistName",
  "changeSummary",
  "date",
  "bookingId",
  "customerNotes",
  "requestedDate",
  "requestedTime",
]);

const ALLOWED_LIST_LABEL = Array.from(ALLOWED_VARIABLES)
  .map((v) => `{${v}}`)
  .join(", ");

function extractUnknownVariables(value: string): string[] {
  const matches = value.match(/\{[^{}\s]*\}/g) ?? [];
  const unknown: string[] = [];
  for (const raw of matches) {
    const inner = raw.slice(1, -1).trim();
    if (!inner) continue;
    if (!ALLOWED_VARIABLES.has(inner)) unknown.push(raw);
  }
  return unknown;
}

const DRAFT_KEY_PREFIX = "admin.email-templates.draft.";

function readDraft(templateId: string): Record<string, string> | null {
  try {
    const raw = window.sessionStorage.getItem(DRAFT_KEY_PREFIX + templateId);
    if (!raw) return null;
    const parsed = JSON.parse(raw);
    if (parsed && typeof parsed === "object") return parsed as Record<string, string>;
  } catch {
    /* unavailable or corrupt — skip */
  }
  return null;
}

function writeDraft(templateId: string, values: Record<string, string>) {
  try {
    const hasAny = Object.values(values).some((v) => v && v.length > 0);
    if (!hasAny) {
      window.sessionStorage.removeItem(DRAFT_KEY_PREFIX + templateId);
    } else {
      window.sessionStorage.setItem(DRAFT_KEY_PREFIX + templateId, JSON.stringify(values));
    }
  } catch {
    /* unavailable — skip */
  }
}

export function TemplateEditForm({
  template,
  onDirtyChange,
  registerLeaveGuard,
  serverInitialValues,
}: TemplateEditFormProps) {
  // Initial values: any persisted draft (survives tab switches) wins; else
  // the server-supplied saved overrides; else empty.
  const [values, setValues] = useState<Record<string, string>>(() => {
    const initial: Record<string, string> = {};
    for (const f of template.fields) initial[f.kind] = serverInitialValues?.[f.kind] ?? "";
    const draft = typeof window !== "undefined" ? readDraft(template.id) : null;
    return draft ? { ...initial, ...draft } : initial;
  });
  const [initialValues, setInitialValues] = useState<Record<string, string>>(() => {
    const initial: Record<string, string> = {};
    for (const f of template.fields) initial[f.kind] = serverInitialValues?.[f.kind] ?? "";
    return initial;
  });
  const [state, formAction, isPending] = useActionState<
    SaveTemplateOverrideResult | null,
    FormData
  >(saveTemplateOverride, null);
  const [lastSavedAt, setLastSavedAt] = useState<Date | null>(null);
  const [, setTick] = useState(0);

  // Reset on template change — server values become the new baseline,
  // and a draft (if any) is layered on top for the live `values` state.
  useEffect(() => {
    const initial: Record<string, string> = {};
    for (const f of template.fields) initial[f.kind] = serverInitialValues?.[f.kind] ?? "";
    const draft = readDraft(template.id);
    setValues(draft ? { ...initial, ...draft } : initial);
    setInitialValues(initial);
    setLastSavedAt(null);
  }, [template.id, serverInitialValues]); // eslint-disable-line react-hooks/exhaustive-deps

  // Persist draft on every change so unsaved edits survive tab switches.
  useEffect(() => {
    writeDraft(template.id, values);
  }, [template.id, values]);

  // Re-render the "Saved {time}" relative label, but only while the label is
  // still in its fast-changing window (under an hour). After that, the locale
  // string is stable until the user reloads anyway.
  useEffect(() => {
    if (!lastSavedAt) return;
    const ageMs = Date.now() - lastSavedAt.getTime();
    if (ageMs > 60 * 60 * 1000) return;
    const id = window.setInterval(() => setTick((t) => t + 1), 30_000);
    return () => window.clearInterval(id);
  }, [lastSavedAt]);

  const dirty = template.fields.some(
    (f) => (values[f.kind] ?? "") !== (initialValues[f.kind] ?? "")
  );

  // Aggregate validation across all editable fields.
  const fieldErrors = useMemo<{
    kind: string;
    message: string;
    showVariableList?: boolean;
  }[]>(() => {
    const errs: { kind: string; message: string; showVariableList?: boolean }[] = [];
    for (const f of template.fields) {
      const v = values[f.kind] ?? "";
      if (v.length > f.maxLength) {
        errs.push({
          kind: f.kind,
          message: `Trim this to ${f.maxLength} characters or fewer.`,
        });
      }
      const unknown = extractUnknownVariables(v);
      if (unknown.length > 0) {
        errs.push({
          kind: f.kind,
          message:
            "That variable isn't recognised, check spelling. Available variables shown below.",
          showVariableList: true,
        });
      }
    }
    return errs;
  }, [template.fields, values]);
  const firstError = fieldErrors[0];

  useEffect(() => {
    onDirtyChange(dirty);
    registerLeaveGuard(() => !dirty);
  }, [dirty, onDirtyChange, registerLeaveGuard]);

  // Browser nav-away guard while dirty (defence in depth — TemplatesTab handles
  // in-page template-switch and tab-switch via the leave-guard ref).
  useEffect(() => {
    if (!dirty) return;
    function onBeforeUnload(event: BeforeUnloadEvent) {
      event.preventDefault();
      event.returnValue = "";
    }
    window.addEventListener("beforeunload", onBeforeUnload);
    return () => window.removeEventListener("beforeunload", onBeforeUnload);
  }, [dirty]);

  useEffect(() => {
    if (state?.ok) {
      toast.success("Template updated.");
      // Server returns the post-HTML-strip values it actually stored. Apply
      // them so the textarea/input contents reflect what's in the DB (e.g.
      // `<b>bold</b>` → `bold`). Falls back to the current values when the
      // server doesn't include cleaned values (idempotent no-op save).
      if (state.cleanedValues && Object.keys(state.cleanedValues).length > 0) {
        const merged = { ...values, ...state.cleanedValues };
        setValues(merged);
        setInitialValues(merged);
      } else {
        setInitialValues(values);
      }
      setLastSavedAt(new Date());
      // Saved state matches storage — clear the draft so re-visit starts clean.
      try {
        window.sessionStorage.removeItem(DRAFT_KEY_PREFIX + template.id);
      } catch {
        /* skip */
      }
    } else if (state?.error) {
      toast.error(state.error, {
        duration: Infinity,
        action: {
          label: "Retry",
          onClick: () => {
            const form = document.getElementById(formId) as HTMLFormElement | null;
            form?.requestSubmit();
          },
        },
      });
    }
  }, [state]); // eslint-disable-line react-hooks/exhaustive-deps

  const formId = `tpl-form-${template.id}`;
  const errorRegionId = `${formId}-error`;
  const canSubmit = dirty && fieldErrors.length === 0 && !isPending;

  const savedLabelText = isPending
    ? "Saving…"
    : dirty
      ? "Unsaved changes"
      : lastSavedAt
        ? `Saved ${formatRelative(lastSavedAt)}`
        : "";

  const savedAbsoluteTitle = lastSavedAt
    ? `Saved ${lastSavedAt.toLocaleString("en-GB", {
        day: "numeric",
        month: "short",
        year: "numeric",
        hour: "2-digit",
        minute: "2-digit",
        timeZoneName: "short",
      })}`
    : undefined;

  return (
    <div className="flex flex-col gap-4">
      {/* Header row: title + info tooltip + right-aligned status / Save */}
      <header className="flex flex-wrap items-center justify-between gap-3">
        <div className="flex items-center gap-1.5">
          <h2 className="m-0 font-display text-base font-semibold tracking-[-0.01em] text-[var(--admin-heading)]">
            Editable fields
          </h2>
          <span
            className="inline-flex items-center text-[var(--admin-text-muted)]"
            title="These fields are safe to edit. Booking details, IDs, and participant data are generated automatically."
            aria-label="These fields are safe to edit. Booking details, IDs, and participant data are generated automatically."
            tabIndex={0}
          >
            <Info className="size-[14px]" aria-hidden="true" />
          </span>
        </div>
        <div className="flex items-center gap-3">
          <p
            className="text-xs text-[var(--admin-text-muted)]"
            title={savedAbsoluteTitle}
            aria-live="polite"
          >
            {savedLabelText}
          </p>
          <button
            type="submit"
            form={formId}
            disabled={!canSubmit}
            aria-busy={isPending || undefined}
            className="hidden md:inline-flex h-10 min-w-[140px] items-center justify-center gap-1.5 rounded-[var(--admin-radius-control)] bg-[var(--admin-primary)] px-4 text-sm font-semibold text-[var(--admin-on-primary)] outline-none transition-colors hover:bg-[var(--admin-primary-hover)] focus-visible:ring-2 focus-visible:ring-[var(--admin-focus)]/55 disabled:cursor-not-allowed disabled:opacity-60"
          >
            {isPending ? (
              <Loader2 className="size-4 animate-spin" aria-hidden="true" />
            ) : lastSavedAt && !dirty ? (
              <CheckCircle className="size-4" aria-hidden="true" />
            ) : null}
            <span>{isPending ? "Saving…" : "Save changes"}</span>
          </button>
        </div>
      </header>

      <form
        id={formId}
        action={formAction}
        className="flex flex-col gap-4"
        noValidate
      >
        <input type="hidden" name="template_id" value={template.id} />

        <div className="flex flex-col gap-4">
          {template.fields.map((field) => (
            <SafeFieldInput
              key={field.kind}
              kind={field.kind}
              label={field.label}
              placeholder={field.placeholder}
              helper={field.helper}
              maxLength={field.maxLength}
              multiline={field.multiline ?? false}
              value={values[field.kind] ?? ""}
              onChange={(v) => setValues((prev) => ({ ...prev, [field.kind]: v }))}
              errorRegionId={errorRegionId}
              fieldError={fieldErrors.find((e) => e.kind === field.kind)?.message}
            />
          ))}
        </div>

        {state?.error || fieldErrors.length > 0 ? (
          <>
            <div
              id={errorRegionId}
              role="alert"
              aria-live="polite"
              aria-atomic="true"
              className="flex items-start gap-2 rounded-[var(--admin-radius-control)] bg-[oklch(95.5%_0.028_20)] px-3 py-2.5 text-sm text-[oklch(26%_0.14_25)]"
            >
              <XCircle className="mt-0.5 size-4 shrink-0" aria-hidden="true" />
              <span>{state?.error ?? firstError?.message}</span>
            </div>
            {firstError?.showVariableList ? (
              <details className="-mt-2 px-3 text-xs text-[oklch(26%_0.14_25)]">
                <summary className="cursor-pointer underline-offset-2 hover:underline">
                  Show available variables
                </summary>
                <p className="mt-1.5 font-mono text-[11px] leading-relaxed">
                  {ALLOWED_LIST_LABEL}
                </p>
              </details>
            ) : null}
          </>
        ) : null}

        {state?.error ? (
          <button
            type="button"
            onClick={() => {
              const form = document.getElementById(formId) as HTMLFormElement | null;
              form?.requestSubmit();
            }}
            className="self-end inline-flex h-9 items-center gap-1.5 rounded-[var(--admin-radius-control)] px-2.5 text-xs font-medium text-[var(--admin-body)] outline-none transition-colors hover:bg-[var(--admin-panel-muted)] focus-visible:ring-2 focus-visible:ring-[var(--admin-focus)]/55"
          >
            <RefreshCcw className="size-3.5" aria-hidden="true" />
            Retry
          </button>
        ) : null}
      </form>

      {/* Mobile sticky action bar — brief §5 + §Per-viewport intent (mirrors
          AdminMobileActionBar from admin-ui.tsx but at the brief's <768px
          breakpoint rather than the component's default <1024px). */}
      <div className="sticky bottom-2 z-10 -mx-4 mt-2 border-t border-[var(--admin-border)] bg-[var(--admin-panel)] px-4 py-3 md:hidden">
        <button
          type="submit"
          form={formId}
          disabled={!canSubmit}
          aria-busy={isPending || undefined}
          className="inline-flex h-11 w-full items-center justify-center gap-1.5 rounded-[var(--admin-radius-control)] bg-[var(--admin-primary)] px-4 text-sm font-semibold text-[var(--admin-on-primary)] outline-none transition-colors hover:bg-[var(--admin-primary-hover)] focus-visible:ring-2 focus-visible:ring-[var(--admin-focus)]/55 disabled:cursor-not-allowed disabled:opacity-60"
        >
          {isPending ? (
            <Loader2 className="size-4 animate-spin" aria-hidden="true" />
          ) : lastSavedAt && !dirty ? (
            <CheckCircle className="size-4" aria-hidden="true" />
          ) : null}
          <span>{isPending ? "Saving…" : "Save changes"}</span>
        </button>
      </div>
    </div>
  );
}

interface SafeFieldInputProps {
  kind: string;
  label: string;
  placeholder: string;
  helper: string;
  maxLength: number;
  multiline: boolean;
  value: string;
  onChange: (v: string) => void;
  errorRegionId: string;
  fieldError?: string;
}

function SafeFieldInput({
  kind,
  label,
  placeholder,
  helper,
  maxLength,
  multiline,
  value,
  onChange,
  errorRegionId,
  fieldError,
}: SafeFieldInputProps) {
  const inputId = useId();
  const helperId = useId();
  const tokensId = useId();
  const tooLong = value.length > maxLength;
  const hasError = Boolean(fieldError);
  const tokensInValue = useMemo(() => {
    const found = new Set<string>();
    const matches = value.match(/\{[^{}\s]*\}/g) ?? [];
    for (const m of matches) found.add(m);
    return Array.from(found);
  }, [value]);

  return (
    <div className="flex flex-col gap-1.5">
      <div className="flex items-center justify-between gap-2">
        <label
          htmlFor={inputId}
          className="text-xs font-medium tracking-[0.01em] text-[var(--admin-heading)]"
        >
          {label}
        </label>
        {value.length > 0 ? (
          <button
            type="button"
            onClick={() => onChange("")}
            title="Clear this field. Saving an empty value falls back to the built-in default."
            className="inline-flex h-6 items-center gap-1 rounded-[var(--admin-radius-control)] px-1.5 text-[11px] font-medium text-[var(--admin-text-muted)] outline-none transition-colors hover:bg-[var(--admin-panel-muted)] hover:text-[var(--admin-heading)] focus-visible:ring-2 focus-visible:ring-[var(--admin-focus)]/55"
          >
            <RotateCcw className="size-3" aria-hidden="true" />
            Reset to default
          </button>
        ) : null}
      </div>
      {multiline ? (
        <textarea
          id={inputId}
          name={`field:${kind}`}
          value={value}
          rows={3}
          placeholder={placeholder}
          maxLength={maxLength + 50}
          aria-describedby={`${helperId}${tokensInValue.length > 0 ? ` ${tokensId}` : ""}${hasError ? ` ${errorRegionId}` : ""}`}
          aria-invalid={hasError}
          onChange={(e) => onChange(e.target.value)}
          className={cn(
            "rounded-[var(--admin-radius-control)] border bg-[var(--admin-input)] px-3 py-2 text-sm leading-relaxed text-[var(--admin-body)] outline-none transition-colors placeholder:text-[var(--admin-text-muted)] focus:border-[var(--admin-focus)] focus:ring-2 focus:ring-[var(--admin-focus)]/55",
            hasError ? "border-[oklch(40%_0.14_25)]" : "border-[var(--admin-border-form)]"
          )}
        />
      ) : (
        <input
          id={inputId}
          name={`field:${kind}`}
          type="text"
          value={value}
          placeholder={placeholder}
          maxLength={maxLength + 50}
          aria-describedby={`${helperId}${tokensInValue.length > 0 ? ` ${tokensId}` : ""}${hasError ? ` ${errorRegionId}` : ""}`}
          aria-invalid={hasError}
          onChange={(e) => onChange(e.target.value)}
          className={cn(
            "h-10 rounded-[var(--admin-radius-control)] border bg-[var(--admin-input)] px-3 text-sm text-[var(--admin-body)] outline-none transition-colors placeholder:text-[var(--admin-text-muted)] focus:border-[var(--admin-focus)] focus:ring-2 focus:ring-[var(--admin-focus)]/55",
            hasError ? "border-[oklch(40%_0.14_25)]" : "border-[var(--admin-border-form)]"
          )}
        />
      )}
      {tokensInValue.length > 0 ? (
        <div id={tokensId} className="flex flex-wrap items-center gap-1 text-[11px]">
          {tokensInValue.map((tok) => {
            const inner = tok.slice(1, -1);
            const recognised = ALLOWED_VARIABLES.has(inner);
            return (
              <span
                key={tok}
                className={cn(
                  "inline-flex items-center gap-1 rounded-full px-2 py-0.5 font-mono",
                  recognised
                    ? "bg-[oklch(93.5%_0.038_155)] text-[oklch(22%_0.085_155)]"
                    : "bg-[oklch(95.5%_0.028_20)] text-[oklch(26%_0.14_25)]"
                )}
              >
                {recognised ? (
                  <CheckCircle className="size-3" aria-hidden="true" />
                ) : (
                  <XCircle className="size-3" aria-hidden="true" />
                )}
                {tok}
              </span>
            );
          })}
        </div>
      ) : null}
      <div id={helperId} className="flex items-start justify-between gap-3 text-xs">
        <span className="text-[var(--admin-text-muted)]">{helper}</span>
        <span
          className={
            tooLong ? "text-[oklch(26%_0.14_25)]" : "text-[var(--admin-text-muted)]"
          }
        >
          {value.length}/{maxLength}
        </span>
      </div>
    </div>
  );
}

function formatRelative(date: Date): string {
  const diffMs = Date.now() - date.getTime();
  const seconds = Math.round(diffMs / 1000);
  if (seconds < 30) return "just now";
  if (seconds < 90) return "a minute ago";
  const minutes = Math.round(seconds / 60);
  if (minutes < 60) return `${minutes} minutes ago`;
  return date.toLocaleString();
}
