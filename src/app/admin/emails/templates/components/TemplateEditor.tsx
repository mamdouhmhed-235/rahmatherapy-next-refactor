"use client";

// C-15 Phase C, Step 11 — editor client shell.
//
// Owns: breadcrumb + header (incl. the dirty-guarded back link), the fields
// column (subject + body fields in render order — subject is already
// `template.fields[0]` per the Phase A registry, so no special-casing is
// needed here), the "Filled automatically" legend, save via the existing
// `saveTemplateOverride` action (unchanged since Phase A), the unsaved-
// changes guard, and read-only rendering. The live preview lives in the
// sibling LivePreview component, fed by this component's current draft
// `values` state.
//
// Read-only enforcement here is the VISUAL half only (brief §2.3, dispatch
// item 2) — the REAL gate is server-side: this page (page.tsx) computes
// `canEdit` from `canManageEmailTemplates(profile)` before ever rendering,
// and `saveTemplateOverride` itself re-checks `MANAGE_EMAIL_TEMPLATES` via
// `requirePermission` regardless of what this component renders. A
// determined client can't turn `canEdit` back on from here and reach a save.

import { useActionState, useEffect, useMemo, useState } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import {
  CheckCircle,
  ChevronLeft,
  Lock,
  Loader2,
  RefreshCcw,
  Send,
  XCircle,
} from "lucide-react";
import { toast } from "sonner";
import { AdminStatusBadge } from "@/app/admin/components/admin-ui";
import { cn } from "@/lib/utils";
import type { TemplateMeta } from "@/app/admin/emails/components/templates-data";
import {
  resetTemplateToDefault,
  saveTemplateOverride,
  sendTestEmail,
  type ResetTemplateToDefaultResult,
  type SaveTemplateOverrideResult,
  type SendTestEmailResult,
} from "@/app/admin/email-templates/actions";
import { TokenTextField } from "./TokenTextField";
import { LivePreview } from "./LivePreview";

// Duplicated on purpose, not imported: templates.ts is explicitly SERVER
// ONLY (imports the Supabase admin client) and must never be pulled into a
// client bundle. Same regex as templates.ts's hasControlChars — a save-time
// preview of the render-time/save-time guard already enforced there, so an
// operator sees the problem before submitting rather than only from the
// server's rejection.
const CONTROL_CHAR_RE = /[\x00-\x1f]/;

const GALLERY_HREF = "/admin/emails?tab=templates";

interface TemplateEditorProps {
  template: TemplateMeta;
  canEdit: boolean;
  /** Saved override values, field kind -> value. Missing keys mean "not
   *  overridden" and are seeded as "" (empty means default throughout this
   *  system — brief + Phase A/B). */
  initialValues: Record<string, string>;
}

export function TemplateEditor({ template, canEdit, initialValues }: TemplateEditorProps) {
  const router = useRouter();

  const [values, setValues] = useState<Record<string, string>>(() => {
    const seed: Record<string, string> = {};
    for (const f of template.fields) seed[f.kind] = initialValues[f.kind] ?? "";
    return seed;
  });
  const [initial, setInitial] = useState<Record<string, string>>(values);

  // Which fields currently have a SAVED override row (brief §5.4 — Reset is
  // disabled when this is empty). Seeded from initialValues (exactly the
  // keys resolveTemplateOverrides returned for this template) and kept in
  // sync after each successful save/reset below — never re-derived from the
  // draft `values`, since an unsaved edit doesn't create an override row.
  const [overriddenKeys, setOverriddenKeys] = useState<Set<string>>(
    () => new Set(Object.keys(initialValues))
  );
  const hasOverrides = overriddenKeys.size > 0;

  const [state, formAction, isPending] = useActionState<
    SaveTemplateOverrideResult | null,
    FormData
  >(saveTemplateOverride, null);
  const [lastSavedAt, setLastSavedAt] = useState<Date | null>(null);

  const [resetState, resetFormAction, isResetPending] = useActionState<
    ResetTemplateToDefaultResult | null,
    FormData
  >(resetTemplateToDefault, null);

  const [testState, testFormAction, isTestPending] = useActionState<
    SendTestEmailResult | null,
    FormData
  >(sendTestEmail, null);

  const dirty = template.fields.some(
    (f) => (values[f.kind] ?? "") !== (initial[f.kind] ?? "")
  );

  const fieldErrors = useMemo<Record<string, string>>(() => {
    const errs: Record<string, string> = {};
    for (const f of template.fields) {
      const v = values[f.kind] ?? "";
      if (v.length > f.maxLength) {
        errs[f.kind] = `Trim this to ${f.maxLength} characters or fewer.`;
        continue;
      }
      if (f.kind === "subject" && CONTROL_CHAR_RE.test(v)) {
        errs[f.kind] = "Subject can't contain line breaks.";
      }
    }
    return errs;
  }, [template.fields, values]);

  const canSubmit = canEdit && dirty && Object.keys(fieldErrors).length === 0 && !isPending;
  const canReset = canEdit && hasOverrides && !isResetPending && !isPending && !isTestPending;
  const canTestSend =
    canEdit && Object.keys(fieldErrors).length === 0 && !isTestPending && !isPending && !isResetPending;
  const formId = `tpl-editor-${template.id}`;

  useEffect(() => {
    if (!state) return;
    if (state.ok) {
      toast.success("Template updated.");
      if (state.cleanedValues && Object.keys(state.cleanedValues).length > 0) {
        const merged = { ...values, ...state.cleanedValues };
        // eslint-disable-next-line react-hooks/set-state-in-effect
        setValues(merged);
        setInitial(merged);
        setOverriddenKeys((prev) => {
          const next = new Set(prev);
          for (const [key, value] of Object.entries(state.cleanedValues!)) {
            if (value === "") next.delete(key);
            else next.add(key);
          }
          return next;
        });
      } else {
        setInitial(values);
      }
      setLastSavedAt(new Date());
    } else if (state.error) {
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
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [state]);

  // C-15 Phase D, Step 13 — reset result. Success means every override row
  // for this template is gone server-side, so the draft/saved baseline here
  // collapses to "" (use-default) for every field, and the Reset button's
  // own disabled gate (hasOverrides) goes false until something is saved
  // again.
  useEffect(() => {
    if (!resetState) return;
    if (resetState.ok) {
      toast.success(`"${template.cardName}" reset to its default wording.`);
      const cleared: Record<string, string> = {};
      for (const f of template.fields) cleared[f.kind] = "";
      // eslint-disable-next-line react-hooks/set-state-in-effect
      setValues(cleared);
      setInitial(cleared);
      setOverriddenKeys(new Set());
      setLastSavedAt(new Date());
    } else if (resetState.error) {
      toast.error(resetState.error);
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [resetState]);

  // C-15 Phase D, Step 14 — test-send result. Purely informational: a test
  // send never changes any saved/draft state, so this effect only toasts.
  useEffect(() => {
    if (!testState) return;
    if (testState.ok) {
      toast.success("Test email sent — check your inbox.");
    } else if (testState.error) {
      toast.error(testState.error, { duration: Infinity });
    }
  }, [testState]);

  function handleResetClick(event: React.MouseEvent<HTMLButtonElement>) {
    const confirmed = window.confirm(
      `Reset '${template.cardName}' to its default wording? Your customisations to this template will be removed. Emails already sent are not affected.`
    );
    if (!confirmed) {
      event.preventDefault();
    }
  }

  // Unsaved-changes guard (brief §5.1). Draft lives in component state only
  // — no localStorage/sessionStorage persistence (deliberate, matches the
  // brief; see C-15 progress file §0.5).
  useEffect(() => {
    if (!dirty || !canEdit) return;
    function onBeforeUnload(event: BeforeUnloadEvent) {
      event.preventDefault();
      event.returnValue = "";
    }
    window.addEventListener("beforeunload", onBeforeUnload);
    return () => window.removeEventListener("beforeunload", onBeforeUnload);
  }, [dirty, canEdit]);

  function handleBackClick(event: React.MouseEvent) {
    if (!dirty || !canEdit) return;
    event.preventDefault();
    if (
      window.confirm(
        `Leave without saving? Your edits to "${template.cardName}" will be lost.`
      )
    ) {
      router.push(GALLERY_HREF);
    }
  }

  return (
    <div className={cn("grid gap-4", canEdit ? "pb-44 md:pb-24" : "pb-24 md:pb-8")}>
      <div>
        <Link
          href={GALLERY_HREF}
          onClick={handleBackClick}
          className="inline-flex items-center gap-1.5 text-sm font-medium text-[var(--admin-text-muted)] outline-none transition-colors hover:text-[var(--admin-heading)] focus-visible:ring-2 focus-visible:ring-[var(--admin-focus)]/55"
        >
          <ChevronLeft className="size-4" aria-hidden="true" />
          Templates
        </Link>
      </div>

      <header className="flex flex-wrap items-start justify-between gap-3">
        <div className="min-w-0">
          <div className="flex flex-wrap items-center gap-2">
            <h1 className="min-w-0 break-words font-display text-2xl font-semibold tracking-[-0.02em] text-[var(--admin-heading)] sm:text-[1.75rem]">
              {template.cardName}
            </h1>
            {audienceBadge(template.audience)}
          </div>
          <p className="mt-1 max-w-[60ch] text-sm leading-6 text-[var(--admin-text-muted)]">
            {template.trigger}
          </p>
        </div>

        {canEdit ? (
          <div className="flex flex-wrap items-center gap-2">
            <button
              type="submit"
              form={formId}
              formAction={resetFormAction}
              onClick={handleResetClick}
              disabled={!canReset}
              aria-busy={isResetPending || undefined}
              title={hasOverrides ? undefined : "This template is already using its defaults."}
              className="inline-flex min-h-11 items-center justify-center gap-1.5 rounded-[var(--admin-radius-control)] border border-[var(--admin-border-form)] bg-[var(--admin-panel)] px-3.5 text-sm font-medium text-[var(--admin-body)] outline-none transition-colors hover:bg-[var(--admin-panel-muted)] focus-visible:ring-2 focus-visible:ring-[var(--admin-focus)]/55 disabled:cursor-not-allowed disabled:opacity-60"
            >
              {isResetPending ? (
                <Loader2 className="size-4 animate-spin" aria-hidden="true" />
              ) : (
                <RefreshCcw className="size-4" aria-hidden="true" />
              )}
              Reset to default
            </button>
            <button
              type="submit"
              form={formId}
              formAction={testFormAction}
              disabled={!canTestSend}
              aria-busy={isTestPending || undefined}
              className="inline-flex min-h-11 items-center justify-center gap-1.5 rounded-[var(--admin-radius-control)] border border-[var(--admin-border-form)] bg-[var(--admin-panel)] px-3.5 text-sm font-medium text-[var(--admin-body)] outline-none transition-colors hover:bg-[var(--admin-panel-muted)] focus-visible:ring-2 focus-visible:ring-[var(--admin-focus)]/55 disabled:cursor-not-allowed disabled:opacity-60"
            >
              {isTestPending ? (
                <Loader2 className="size-4 animate-spin" aria-hidden="true" />
              ) : (
                <Send className="size-4" aria-hidden="true" />
              )}
              Send me a test
            </button>
          </div>
        ) : null}
      </header>

      {!canEdit ? (
        <p className="rounded-[var(--admin-radius-control)] bg-[var(--admin-panel-muted)] px-3 py-2.5 text-xs leading-relaxed text-[var(--admin-text-muted)]">
          You can view but not edit this template. Contact the owner to make changes.
        </p>
      ) : null}

      <div className="grid gap-4 md:grid-cols-[minmax(0,2fr)_minmax(0,3fr)] md:items-start">
        <section className="flex min-w-0 flex-col gap-4">
          <form id={formId} action={formAction} className="flex flex-col gap-4" noValidate>
            <input type="hidden" name="template_id" value={template.id} />
            {template.fields.map((field) => {
              // C-15 closeout fix round (2nd) — the subject field shows
              // `template.subjectDefault` here, NOT `field.placeholder` /
              // `field.defaultValue`. Those two SafeField-level strings still
              // feed the <title> tag (resolveTitleSubject) and are
              // deliberately frozen by the render-parity fixture — but they
              // drifted from the real Subject: header for 12/16 templates
              // once the first closeout round corrected `subjectDefault`
              // alone. Threading the same `subjectDefault` the editor's
              // `template` prop already carries (rather than copying a
              // second string into the registry) keeps a single source of
              // truth: what real sends use is what the editor shows. Every
              // other field's placeholder/defaultValue is untouched.
              const isSubject = field.kind === "subject";
              return (
                <TokenTextField
                  key={field.kind}
                  kind={field.kind}
                  label={field.label}
                  helper={field.helper}
                  placeholder={isSubject ? template.subjectDefault : field.placeholder}
                  maxLength={field.maxLength}
                  multiline={field.multiline}
                  tokens={field.tokens}
                  defaultValue={isSubject ? template.subjectDefault : field.defaultValue}
                  value={values[field.kind] ?? ""}
                  onChange={(v) => setValues((prev) => ({ ...prev, [field.kind]: v }))}
                  onUseDefault={() => setValues((prev) => ({ ...prev, [field.kind]: "" }))}
                  readOnly={!canEdit}
                  errorMessage={fieldErrors[field.kind]}
                />
              );
            })}
          </form>

          {template.fixedParts.length > 0 ? (
            <details className="rounded-[var(--admin-radius-card)] border border-[var(--admin-border)] bg-[var(--admin-panel)] p-3">
              <summary className="flex cursor-pointer list-none items-center gap-1.5 text-sm font-medium text-[var(--admin-heading)] outline-none focus-visible:ring-2 focus-visible:ring-[var(--admin-focus)]/55 [&::-webkit-details-marker]:hidden">
                <Lock className="size-3.5 shrink-0" aria-hidden="true" />
                Filled automatically ({template.fixedParts.length})
              </summary>
              <ul className="m-0 mt-2 grid list-none gap-2 p-0 text-xs">
                {template.fixedParts.map((fp) => (
                  <li
                    key={fp.label}
                    className="border-t border-[var(--admin-border)] pt-2 first:border-0 first:pt-0"
                  >
                    <p className="font-medium text-[var(--admin-body)]">{fp.label}</p>
                    <p className="mt-0.5 text-[var(--admin-text-muted)]">{fp.source}</p>
                  </li>
                ))}
              </ul>
            </details>
          ) : null}

          {state?.error ? (
            <div
              role="alert"
              aria-live="polite"
              className="flex items-start gap-2 rounded-[var(--admin-radius-control)] bg-[oklch(95.5%_0.028_20)] px-3 py-2.5 text-sm text-[oklch(26%_0.14_25)]"
            >
              <XCircle className="mt-0.5 size-4 shrink-0" aria-hidden="true" />
              <span>{state.error}</span>
              <button
                type="button"
                onClick={() => {
                  const form = document.getElementById(formId) as HTMLFormElement | null;
                  form?.requestSubmit();
                }}
                className="ml-auto inline-flex h-7 items-center gap-1 rounded-[var(--admin-radius-control)] px-2 text-xs font-medium outline-none transition-colors hover:bg-[oklch(92%_0.045_20)] focus-visible:ring-2 focus-visible:ring-[var(--admin-focus)]/55"
              >
                <RefreshCcw className="size-3.5" aria-hidden="true" />
                Retry
              </button>
            </div>
          ) : null}
        </section>

        <aside className="min-w-0 md:sticky md:top-4">
          <LivePreview templateId={template.id} cardName={template.cardName} values={values} />
        </aside>
      </div>

      {canEdit ? (
        <div className="fixed inset-x-0 bottom-14 z-40 border-t border-[var(--admin-border)] bg-[var(--admin-panel)] px-4 pb-[max(env(safe-area-inset-bottom,0),0.75rem)] pt-3 shadow-[0_-1px_8px_oklch(23%_0.073_155_/_0.04)] md:bottom-0">
          <div className="mx-auto flex max-w-5xl items-center justify-between gap-2">
            <p className="text-xs text-[var(--admin-text-muted)]" aria-live="polite">
              {isPending ? "Saving…" : dirty ? "Unsaved changes" : lastSavedAt ? "Saved" : ""}
            </p>
            <button
              type="submit"
              form={formId}
              disabled={!canSubmit}
              aria-busy={isPending || undefined}
              className={cn(
                "inline-flex min-h-11 items-center justify-center gap-1.5 rounded-[var(--admin-radius-control)] bg-[var(--admin-primary)] px-5 text-sm font-semibold text-[var(--admin-on-primary)] outline-none transition-colors hover:bg-[var(--admin-primary-hover)] focus-visible:ring-2 focus-visible:ring-[var(--admin-focus)]/55 disabled:cursor-not-allowed disabled:opacity-60"
              )}
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
      ) : null}
    </div>
  );
}

function audienceBadge(audience: TemplateMeta["audience"]) {
  if (audience === "staff") {
    return <AdminStatusBadge value="Staff only" tone="muted" compact />;
  }
  if (audience === "admin_internal") {
    return <AdminStatusBadge value="Internal only" tone="restricted" compact />;
  }
  return null;
}
