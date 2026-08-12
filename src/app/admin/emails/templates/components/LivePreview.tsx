"use client";

// C-15 Phase C, Step 10 — debounced live draft preview.
//
// Initial paint: GET /admin/email-templates/preview/[id] (brief §2.4 — the
// SAVED-overrides render). Every draft change after that: debounced (300ms)
// POST of the current field values, `srcdoc` swap into the same iframe (Q9.2
// — never a full iframe reload). AbortController cancels a stale in-flight
// request; a monotonically increasing request id is belt-and-braces "last
// response wins" in case an aborted fetch's promise still resolves.
//
// "Show what's editable" (brief §2.3/§4.2) outlines FixedPart regions in the
// rendered preview. Dispatch decision: this is done ENTIRELY client-side —
// a pure string transform applied to the HTML this component already
// fetched — rather than a renderer-side `?annotate=1` flag. Reasoning:
// every "fixed" block every renderer emits already shares one of two
// literal inline-style signatures (renderSummary + the admin info-boxes all
// use `background:#f7f3ec`; renderParticipants' list uses
// `padding-left:18px`), stable enough to target with a plain CSS attribute
// selector. Doing this here means the annotation code never touches
// templates.ts, never runs on the server, and is structurally incapable of
// reaching any real send path — not just "hard to trigger", but impossible,
// since nothing outside this file ever calls it. It also means Phase A's
// render-parity gate (registry-defaults.test.ts) needed zero changes and
// stays the sole source of truth for real render output. See
// injectFixedPartOutline's own tests (LivePreview.test.tsx) for the "differs
// when on, byte-identical passthrough when off" proof requested by the
// dispatch.

import { useEffect, useMemo, useRef, useState } from "react";
import { Info, RefreshCcw } from "lucide-react";
import { Switch } from "@/components/ui/switch";
import { AdminSkeleton } from "@/app/admin/components/admin-ui";
import { cn } from "@/lib/utils";

const DEBOUNCE_MS = 300;

export interface LivePreviewProps {
  templateId: string;
  cardName: string;
  /** Every field's current draft value (subject included) — sent verbatim
   *  as `draftValues` on every debounced POST. Empty-string entries are
   *  intentional (they mean "use the default" — the preview route already
   *  treats "" the same as no override, C-15 Phase B). */
  values: Record<string, string>;
}

const FIXED_PART_OUTLINE_CSS = `
div[style*="background:#f7f3ec"], ul[style*="padding-left:18px"] {
  outline: 1.5px dashed #0f5e8e;
  outline-offset: 3px;
  position: relative;
}
div[style*="background:#f7f3ec"]::before, ul[style*="padding-left:18px"]::before {
  content: "Auto";
  position: absolute;
  top: -9px;
  right: 6px;
  background: #0f5e8e;
  color: #ffffff;
  font-family: Arial, Helvetica, sans-serif;
  font-size: 10px;
  font-weight: 700;
  letter-spacing: 0.04em;
  text-transform: uppercase;
  padding: 1px 6px;
  border-radius: 999px;
  line-height: 1.4;
}
`;

/**
 * Pure string transform — inserts a `<style>` tag that outlines the
 * generic "fixed content" block signatures shared by every renderer. Never
 * mutates its input; when annotation is off, the exact bytes the preview
 * endpoint returned are used unmodified (see LivePreview.test.tsx).
 */
export function injectFixedPartOutline(html: string): string {
  const styleTag = `<style>${FIXED_PART_OUTLINE_CSS}</style>`;
  if (html.includes("</head>")) {
    return html.replace("</head>", `${styleTag}</head>`);
  }
  // Defensive fallback for any response without a <head> (every current
  // renderer output has one via renderLayout / the plain-text envelope /
  // the placeholder, but this keeps the toggle inert rather than broken if
  // that ever changes).
  return styleTag + html;
}

export function LivePreview({ templateId, cardName, values }: LivePreviewProps) {
  const [rawHtml, setRawHtml] = useState<string | null>(null);
  const [initialStatus, setInitialStatus] = useState<"loading" | "ready" | "error">("loading");
  const [isRefreshing, setIsRefreshing] = useState(false);
  const [refreshError, setRefreshError] = useState(false);
  const [annotate, setAnnotate] = useState(false);
  const [reloadTick, setReloadTick] = useState(0);

  const abortRef = useRef<AbortController | null>(null);
  const requestIdRef = useRef(0);
  const skipNextDebounceRef = useRef(true);

  // Initial paint — a real GET to the existing preview route, rendering the
  // template's SAVED overrides (brief §2.4). `values` at mount time is
  // seeded from the same saved overrides (TemplateEditor), so this and the
  // first debounced POST would render identically — skipNextDebounceRef
  // just avoids firing a redundant network call for that first render.
  useEffect(() => {
    skipNextDebounceRef.current = true;
    // Reacting to a prop (templateId) / an explicit retry request
    // (reloadTick), not synchronizing derived state — same pattern as
    // TemplateEditForm.tsx's template-switch reset.
    // eslint-disable-next-line react-hooks/set-state-in-effect
    setInitialStatus("loading");
    setRawHtml(null);
    setRefreshError(false);
    const myId = ++requestIdRef.current;
    fetch(`/admin/email-templates/preview/${templateId}`)
      .then((res) => {
        if (!res.ok) throw new Error(`status ${res.status}`);
        return res.text();
      })
      .then((html) => {
        if (requestIdRef.current !== myId) return;
        setRawHtml(html);
        setInitialStatus("ready");
      })
      .catch(() => {
        if (requestIdRef.current !== myId) return;
        setInitialStatus("error");
      });
  }, [templateId, reloadTick]);

  // Debounced draft preview. Keeps the last successful preview visible
  // while a refresh is in flight (no flicker) — only the very first paint
  // above ever blanks the pane.
  useEffect(() => {
    if (skipNextDebounceRef.current) {
      skipNextDebounceRef.current = false;
      return;
    }
    const timer = window.setTimeout(() => {
      abortRef.current?.abort();
      const controller = new AbortController();
      abortRef.current = controller;
      const myId = ++requestIdRef.current;
      setIsRefreshing(true);
      fetch(`/admin/email-templates/preview/${templateId}`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ draftValues: values }),
        signal: controller.signal,
      })
        .then((res) => {
          if (!res.ok) throw new Error(`status ${res.status}`);
          return res.text();
        })
        .then((html) => {
          if (requestIdRef.current !== myId) return;
          setRawHtml(html);
          setRefreshError(false);
          setIsRefreshing(false);
        })
        .catch((error: unknown) => {
          if (requestIdRef.current !== myId) return;
          setIsRefreshing(false);
          if (error instanceof DOMException && error.name === "AbortError") return;
          setRefreshError(true);
        });
    }, DEBOUNCE_MS);
    return () => window.clearTimeout(timer);
  }, [values, templateId]);

  const displayHtml = useMemo(() => {
    if (rawHtml == null) return null;
    return annotate ? injectFixedPartOutline(rawHtml) : rawHtml;
  }, [rawHtml, annotate]);

  return (
    <div className="flex flex-col gap-2">
      <div className="flex flex-wrap items-center justify-between gap-2">
        <p className="text-xs font-medium uppercase tracking-[0.05em] text-[var(--admin-text-muted)]">
          Preview
        </p>
        <label className="flex min-h-11 items-center gap-2 text-xs font-medium text-[var(--admin-body)]">
          <Switch
            checked={annotate}
            onCheckedChange={setAnnotate}
            aria-label="Show what's editable"
          />
          Show what&apos;s editable
        </label>
      </div>

      <div className="relative overflow-hidden rounded-[var(--admin-radius-card)] border border-[var(--admin-border)] bg-[var(--admin-email-preview-bg)]">
        {initialStatus === "loading" ? (
          <div className="absolute inset-0 z-10 flex flex-col gap-3 p-5" aria-hidden="true">
            <AdminSkeleton className="h-6 w-2/3" />
            <AdminSkeleton className="h-3 w-full" />
            <AdminSkeleton className="h-3 w-5/6" />
            <AdminSkeleton className="h-32 w-full" />
          </div>
        ) : null}

        {initialStatus === "error" ? (
          <div
            role="alert"
            aria-live="polite"
            className="flex flex-col items-start gap-3 p-5 text-sm text-[var(--admin-status-cancelled-text)]"
          >
            <p className="font-semibold">Couldn&apos;t load the preview</p>
            <button
              type="button"
              onClick={() => setReloadTick((t) => t + 1)}
              className="inline-flex h-9 items-center gap-1.5 rounded-[var(--admin-radius-control)] px-3 text-sm font-medium text-[var(--admin-body)] outline-none transition-colors hover:bg-[var(--admin-panel-muted)] focus-visible:ring-2 focus-visible:ring-[var(--admin-focus)]/55"
            >
              <RefreshCcw className="size-3.5" aria-hidden="true" />
              Try again
            </button>
          </div>
        ) : null}

        {displayHtml != null ? (
          <iframe
            title={`${cardName} preview`}
            srcDoc={displayHtml}
            sandbox="allow-same-origin"
            className={cn(
              "block h-[420px] w-full bg-white transition-opacity duration-200 motion-reduce:transition-none sm:h-[520px]",
              isRefreshing ? "opacity-80" : "opacity-100"
            )}
          />
        ) : null}
      </div>

      {refreshError ? (
        <p role="alert" aria-live="polite" className="text-xs text-[var(--admin-status-cancelled-text)]">
          Couldn&apos;t refresh the preview for your latest change — showing the last
          successful preview.
        </p>
      ) : null}

      <p className="flex items-start gap-2 text-xs text-[var(--admin-text-muted)]">
        <Info className="mt-0.5 size-3.5 shrink-0" aria-hidden="true" />
        <span>Preview uses sample data. Real client details never appear here.</span>
      </p>
    </div>
  );
}
