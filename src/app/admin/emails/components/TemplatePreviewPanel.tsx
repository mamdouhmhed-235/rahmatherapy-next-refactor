"use client";

import { useEffect, useState } from "react";
import { Info, Lock, Mail, RefreshCcw } from "lucide-react";
import { EmptyState } from "../../components/EmptyState";
import { AdminSkeleton } from "../../components/admin-ui";
import { cn } from "@/lib/utils";
import type { TemplateMeta } from "./templates-data";

interface TemplatePreviewPanelProps {
  template: TemplateMeta | null;
  readOnly: boolean;
  loadingFields?: boolean;
}

export function TemplatePreviewPanel({
  template,
  readOnly,
  loadingFields = false,
}: TemplatePreviewPanelProps) {
  if (!template) {
    return (
      <div className="flex min-h-[320px] items-center justify-center rounded-[var(--admin-radius-card)] border border-[var(--admin-border)] bg-[var(--admin-panel)] p-6">
        <EmptyState
          icon={Mail}
          title="Select a template to preview"
          message="Pick one from the list to see what gets sent."
        />
      </div>
    );
  }

  const isInternal = template.audience === "admin_internal";
  const isPlainText = template.rendersAs === "plain_text";

  // Tight grouping for notice+banner (gap-2), generous separation iframe→form
  // (consumer adds gap-5), info note below the form not interrupting iframe→form flow.
  return (
    <div className="flex flex-col gap-2">
      {readOnly ? (
        <p className="rounded-[var(--admin-radius-control)] bg-[var(--admin-panel-muted)] px-3 py-2.5 text-xs leading-relaxed text-[var(--admin-text-muted)]">
          You can view but not edit these templates. Contact the owner to make changes.
        </p>
      ) : null}
      {isInternal ? (
        <p className="flex items-start gap-2 rounded-[var(--admin-radius-control)] bg-[oklch(94.0%_0.008_280)] px-3 py-2.5 text-xs leading-relaxed text-[oklch(30%_0.020_280)]">
          <Lock className="mt-0.5 size-3.5 shrink-0" aria-hidden="true" />
          <span>Internal only — not seen by clients or therapists.</span>
        </p>
      ) : null}
      <div className="mt-1">
        {isPlainText ? (
          <PlainTextPreview templateId={template.id} />
        ) : (
          <HtmlPreview templateId={template.id} cardName={template.cardName} />
        )}
      </div>
      {loadingFields && !readOnly ? (
        <div className="mt-3 grid gap-3 rounded-[var(--admin-radius-card)] border border-[var(--admin-border)] bg-[var(--admin-panel)] p-4">
          <AdminSkeleton className="h-3 w-1/3" />
          <AdminSkeleton className="h-10 w-full" />
          <AdminSkeleton className="h-3 w-1/4" />
          <AdminSkeleton className="h-10 w-full" />
          <AdminSkeleton className="h-3 w-1/3" />
          <AdminSkeleton className="h-10 w-full" />
        </div>
      ) : null}
    </div>
  );
}

export function PreviewDummyDataNote() {
  return (
    <p className="flex items-start gap-2 text-xs text-[var(--admin-text-muted)]">
      <Info className="mt-0.5 size-3.5 shrink-0" aria-hidden="true" />
      <span>Preview uses dummy data. Real client details never appear here.</span>
    </p>
  );
}

interface HtmlPreviewProps {
  templateId: string;
  cardName: string;
}

function HtmlPreview({ templateId, cardName }: HtmlPreviewProps) {
  const [state, setState] = useState<"loading" | "ready" | "error">("loading");
  const [reloadKey, setReloadKey] = useState(0);
  const src = `/admin/email-templates/preview/${templateId}?k=${reloadKey}`;

  // Reset state when the selected template changes. We probe the URL with a
  // HEAD request because same-origin iframes fire onLoad even on 4xx/5xx
  // (the response body just gets rendered). 10s timeout is the absolute
  // fallback.
  useEffect(() => {
    setState("loading");
    let cancelled = false;
    const timeout = window.setTimeout(() => {
      if (!cancelled) setState((s) => (s === "loading" ? "error" : s));
    }, 10_000);
    fetch(src, { method: "HEAD" })
      .then((res) => {
        if (cancelled) return;
        if (!res.ok) setState("error");
      })
      .catch(() => {
        if (!cancelled) setState("error");
      });
    return () => {
      cancelled = true;
      window.clearTimeout(timeout);
    };
  }, [templateId, reloadKey, src]);

  return (
    <div className="relative overflow-hidden rounded-[var(--admin-radius-card)] border border-[var(--admin-border)] bg-[oklch(99.2%_0.004_88)]">
      {state === "loading" ? (
        <div className="absolute inset-0 z-10 flex flex-col gap-3 p-5" aria-hidden="true">
          <AdminSkeleton className="h-6 w-2/3" />
          <AdminSkeleton className="h-3 w-full" />
          <AdminSkeleton className="h-3 w-5/6" />
          <AdminSkeleton className="h-32 w-full" />
          <AdminSkeleton className="h-3 w-3/4" />
        </div>
      ) : null}
      {state === "error" ? (
        <div
          role="alert"
          aria-live="polite"
          aria-atomic="true"
          className="flex flex-col items-start gap-3 p-5 text-sm text-[oklch(26%_0.14_25)]"
        >
          <div>
            <p className="font-semibold">Couldn&apos;t load preview</p>
            <p className="mt-1 text-[oklch(26%_0.14_25)]/85">
              Try selecting the template again.
            </p>
          </div>
          <button
            type="button"
            onClick={() => {
              setState("loading");
              setReloadKey((k) => k + 1);
            }}
            className="inline-flex h-9 items-center gap-1.5 rounded-[var(--admin-radius-control)] px-3 text-sm font-medium text-[var(--admin-body)] outline-none transition-colors hover:bg-[var(--admin-panel-muted)] focus-visible:ring-2 focus-visible:ring-[var(--admin-focus)]/55"
          >
            <RefreshCcw className="size-3.5" aria-hidden="true" />
            Try again
          </button>
        </div>
      ) : null}
      <iframe
        key={reloadKey}
        title={`${cardName} preview`}
        src={src}
        sandbox="allow-same-origin"
        loading="lazy"
        onLoad={() => setState((s) => (s === "error" ? s : "ready"))}
        onError={() => setState("error")}
        className={cn(
          "block h-[420px] w-full bg-white sm:h-[480px] transition-opacity duration-200 motion-reduce:transition-none",
          state === "ready" ? "opacity-100" : "opacity-0"
        )}
        data-redesign-backend="FAKE"
      />
    </div>
  );
}

function PlainTextPreview({ templateId }: { templateId: string }) {
  const [body, setBody] = useState<string | null>(null);
  const [errored, setErrored] = useState(false);

  useEffect(() => {
    let cancelled = false;
    setBody(null);
    setErrored(false);
    fetch(`/admin/email-templates/preview/${templateId}`)
      .then((res) => {
        if (!res.ok) throw new Error(`status ${res.status}`);
        return res.text();
      })
      .then((html) => {
        if (cancelled) return;
        // Extract <body>...</body> content, strip tags for a plain-text feel.
        const match = html.match(/<body[^>]*>([\s\S]*?)<\/body>/i);
        const text = (match ? match[1] : html)
          .replace(/<[^>]+>/g, "")
          .replace(/&amp;/g, "&")
          .replace(/&lt;/g, "<")
          .replace(/&gt;/g, ">")
          .trim();
        setBody(text);
      })
      .catch(() => {
        if (!cancelled) setErrored(true);
      });
    return () => {
      cancelled = true;
    };
  }, [templateId]);

  if (errored) {
    return (
      <div
        role="alert"
        aria-live="polite"
        aria-atomic="true"
        className="rounded-[var(--admin-radius-card)] border border-[oklch(95.5%_0.028_20)] bg-[oklch(95.5%_0.028_20)] p-4 text-sm text-[oklch(26%_0.14_25)]"
      >
        Couldn&apos;t load preview. Try selecting the template again.
      </div>
    );
  }

  if (body == null) {
    return (
      <div className="rounded-[var(--admin-radius-card)] border border-[var(--admin-border)] bg-[var(--admin-panel)] p-5">
        <AdminSkeleton className="h-3 w-2/3" />
        <AdminSkeleton className="mt-3 h-3 w-full" />
        <AdminSkeleton className="mt-3 h-3 w-5/6" />
      </div>
    );
  }

  return (
    <pre
      data-redesign-backend="FAKE"
      className="m-0 max-h-[480px] overflow-auto whitespace-pre-wrap rounded-[var(--admin-radius-card)] border border-[var(--admin-border)] bg-[var(--admin-panel)] p-4 font-mono text-[13px] leading-relaxed text-[var(--admin-body)]"
    >
      {body}
    </pre>
  );
}
