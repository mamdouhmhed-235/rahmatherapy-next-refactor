"use client";

import { useCallback, useEffect, useRef, useState } from "react";
import { Dialog as BaseDialog } from "@base-ui/react/dialog";
import { useRouter, useSearchParams } from "next/navigation";
import { ExternalLink, MailCheck, PencilLine, XCircle } from "lucide-react";
import { TemplateBrowser } from "./TemplateBrowser";
import { TemplatePreviewPanel, PreviewDummyDataNote } from "./TemplatePreviewPanel";
import { TemplateEditForm } from "./TemplateEditForm";
import { ManualSendSheet } from "./ManualSendSheet";
import {
  findTemplate,
  TEMPLATES,
  type TemplateMeta,
} from "./templates-data";

interface TemplatesTabProps {
  canEdit: boolean;
  /** When `false`, restrict the manual Send button to staff-audience templates
   *  only (Therapist scope per brief §10 Q5). */
  canSendAllAudiences?: boolean;
  /** Operator's own email address — used to prefill the manual-send sheet
   *  when they click "Send a test to me". */
  operatorEmail?: string | null;
}

const SESSION_KEY = "admin.email-templates.selected";

export function TemplatesTab({
  canEdit,
  canSendAllAudiences = true,
  operatorEmail,
}: TemplatesTabProps) {
  const router = useRouter();
  const searchParams = useSearchParams();

  // Selection state — URL `templateId` is the only source that matches SSR.
  // sessionStorage restore happens in a post-mount effect to avoid hydration
  // mismatch (Safari private-mode is also handled by try/catch there).
  const initialId = (() => {
    const fromUrl = searchParams.get("templateId");
    if (fromUrl && findTemplate(fromUrl)) return fromUrl;
    return null;
  })();
  const [selectedId, setSelectedId] = useState<string | null>(initialId);
  const [mounted, setMounted] = useState(false);

  // After mount: restore selection from sessionStorage (if no URL param)
  // and flip mounted so client-only chrome (mobile collapsed rail) can render.
  useEffect(() => {
    setMounted(true);
    if (selectedId) return;
    try {
      const stored = window.sessionStorage.getItem(SESSION_KEY);
      if (stored && findTemplate(stored)) setSelectedId(stored);
    } catch {
      /* unavailable */
    }
  }, []); // eslint-disable-line react-hooks/exhaustive-deps

  // Track mobile state at this level so we render the rail exactly once
  // (avoids duplicate-ID a11y violations on the focus-target buttons).
  const [isMobile, setIsMobile] = useState(false);
  useEffect(() => {
    const mq = window.matchMedia("(max-width: 767px)");
    setIsMobile(mq.matches);
    const fn = () => setIsMobile(mq.matches);
    mq.addEventListener("change", fn);
    return () => mq.removeEventListener("change", fn);
  }, []);
  const [sendForId, setSendForId] = useState<string | null>(null);
  const [prefillRecipient, setPrefillRecipient] = useState<string>("");
  const [, setDirty] = useState(false);
  const [pendingNextId, setPendingNextId] = useState<string | null>(null);
  const leaveGuardRef = useRef<() => boolean>(() => true);
  const keepEditingRef = useRef<HTMLButtonElement | null>(null);

  // Focus the safer default (Keep editing) when the discard modal opens.
  useEffect(() => {
    if (pendingNextId) {
      const id = window.setTimeout(() => keepEditingRef.current?.focus(), 50);
      return () => window.clearTimeout(id);
    }
  }, [pendingNextId]);

  // Persist selection.
  useEffect(() => {
    if (selectedId) {
      try {
        window.sessionStorage.setItem(SESSION_KEY, selectedId);
      } catch {
        /* sessionStorage unavailable — silently skip persistence */
      }
    }
    // Mirror to URL — push not replace so back-button works.
    const current = searchParams.get("templateId");
    if (selectedId && current !== selectedId) {
      const sp = new URLSearchParams(searchParams.toString());
      sp.set("templateId", selectedId);
      router.replace(`?${sp.toString()}`, { scroll: false });
    }
  }, [selectedId]); // eslint-disable-line react-hooks/exhaustive-deps

  const registerLeaveGuard = useCallback((fn: () => boolean) => {
    leaveGuardRef.current = fn;
  }, []);

  const selected = selectedId ? findTemplate(selectedId) ?? null : null;

  function handleSelect(id: string) {
    if (id === selectedId) return;
    if (!leaveGuardRef.current()) {
      // Dirty — show styled discard modal instead of native confirm.
      setPendingNextId(id);
      return;
    }
    setSelectedId(id);
  }

  function confirmDiscard() {
    if (pendingNextId) {
      setSelectedId(pendingNextId);
      setPendingNextId(null);
    }
  }

  function cancelDiscard() {
    setPendingNextId(null);
    // Restore focus to the field that triggered (best-effort).
    const formActive = document.querySelector<HTMLElement>(
      'form[data-redesign-backend="FAKE"] input, form[data-redesign-backend="FAKE"] textarea'
    );
    formActive?.focus();
  }

  function handleSend(id: string) {
    setPrefillRecipient("");
    setSendForId(id);
  }

  function handleSendTestToMe(id: string) {
    setPrefillRecipient(operatorEmail ?? "");
    setSendForId(id);
  }

  function canSendForTemplate(template: TemplateMeta): boolean {
    if (canSendAllAudiences) return true;
    return template.audience === "staff";
  }

  const sendTarget: TemplateMeta | null = sendForId
    ? findTemplate(sendForId) ?? null
    : null;

  // Track first paint of a newly-selected template so we can show field-skeleton
  // briefly while the iframe + helpers settle.
  const [showFieldSkeleton, setShowFieldSkeleton] = useState(false);
  useEffect(() => {
    if (!selectedId) return;
    setShowFieldSkeleton(true);
    const id = window.setTimeout(() => setShowFieldSkeleton(false), 280);
    return () => window.clearTimeout(id);
  }, [selectedId]);

  return (
    <section
      aria-label="Email templates"
      className="grid grid-cols-1 gap-4 md:grid-cols-[minmax(280px,320px)_minmax(0,1fr)]"
    >
      <div className="md:sticky md:top-4 md:self-start">
        {/* Render the rail exactly once. On mobile, when a template is
            selected, wrap it in a `<details>` so the preview can claim the
            viewport. Pre-mount: always show the rail inline (SSR-safe). */}
        {mounted && isMobile && selected ? (
          <details className="rounded-[var(--admin-radius-card)] border border-[var(--admin-border)] bg-[var(--admin-panel)]">
            <summary className="flex min-h-11 cursor-pointer list-none items-center gap-2 px-3 text-sm font-medium text-[var(--admin-heading)] outline-none transition-colors hover:bg-[var(--admin-panel-muted)] focus-visible:ring-2 focus-visible:ring-[var(--admin-focus)]/55 [&::-webkit-details-marker]:hidden">
              <span className="flex-1">
                Browse templates ·{" "}
                <span className="text-[var(--admin-text-muted)]">{selected.cardName}</span>
              </span>
              <span className="text-xs text-[var(--admin-text-muted)]">tap to change</span>
            </summary>
            <div className="border-t border-[var(--admin-border)] p-2">
              <TemplateBrowser
                templates={TEMPLATES}
                selectedId={selectedId}
                onSelect={handleSelect}
                onSend={handleSend}
                canSendForTemplate={canSendForTemplate}
              />
            </div>
          </details>
        ) : (
          <TemplateBrowser
            templates={TEMPLATES}
            selectedId={selectedId}
            onSelect={handleSelect}
            onSend={handleSend}
            canSendForTemplate={canSendForTemplate}
          />
        )}
      </div>

      <div className="flex min-w-0 flex-col">
        {/* Preview header — names the iframe as "the email recipient sees",
            offers the new-window deep-link, and a "Send test to me" shortcut. */}
        {selected ? (
          <header className="mb-2 flex flex-wrap items-center justify-between gap-2">
            <div className="flex items-center gap-2">
              <p className="text-xs font-medium uppercase tracking-[0.05em] text-[var(--admin-text-muted)]">
                Preview
              </p>
              <span aria-hidden="true" className="text-[var(--admin-text-muted)]">·</span>
              <p className="text-sm font-medium text-[var(--admin-heading)]">
                {selected.cardName}
              </p>
            </div>
            <div className="flex items-center gap-1">
              {operatorEmail ? (
                <button
                  type="button"
                  onClick={() => handleSendTestToMe(selected.id)}
                  className="inline-flex h-9 items-center gap-1.5 rounded-[var(--admin-radius-control)] px-2.5 text-xs font-medium text-[var(--admin-body)] outline-none transition-colors hover:bg-[var(--admin-panel-muted)] focus-visible:ring-2 focus-visible:ring-[var(--admin-focus)]/55"
                  title={`Send a test of "${selected.cardName}" to ${operatorEmail}`}
                >
                  <MailCheck className="size-3.5" aria-hidden="true" />
                  Send test to me
                </button>
              ) : null}
              <a
                href={`/admin/email-templates/preview/${selected.id}`}
                target="_blank"
                rel="noopener noreferrer"
                className="inline-flex h-9 items-center gap-1.5 rounded-[var(--admin-radius-control)] px-2.5 text-xs font-medium text-[var(--admin-body)] outline-none transition-colors hover:bg-[var(--admin-panel-muted)] focus-visible:ring-2 focus-visible:ring-[var(--admin-focus)]/55"
                title="Open the preview in a new tab"
              >
                <ExternalLink className="size-3.5" aria-hidden="true" />
                <span className="hidden sm:inline">Open in new tab</span>
                <span className="sm:hidden">Open</span>
              </a>
            </div>
          </header>
        ) : null}

        <TemplatePreviewPanel
          template={selected}
          readOnly={!canEdit}
          loadingFields={showFieldSkeleton && canEdit && Boolean(selected)}
        />

        {/* Bridge between preview and edit — a quiet cue that what's
            below modifies what's above. Hides when read-only. */}
        {selected && canEdit && !showFieldSkeleton ? (
          <p
            className="mt-3 flex items-center gap-1.5 text-xs text-[var(--admin-text-muted)]"
            aria-hidden="true"
          >
            <PencilLine className="size-3.5" aria-hidden="true" />
            Change a line below, then save.
          </p>
        ) : null}

        {selected && canEdit && !showFieldSkeleton ? (
          <div className="mt-2 rounded-[var(--admin-radius-card)] border border-[var(--admin-border)] bg-[var(--admin-panel)] p-4 sm:p-5">
            <TemplateEditForm
              key={selected.id}
              template={selected}
              onDirtyChange={setDirty}
              registerLeaveGuard={registerLeaveGuard}
            />
          </div>
        ) : null}
        {selected ? (
          <div className="mt-3">
            <PreviewDummyDataNote />
          </div>
        ) : null}

        {/* A11y status announcer — gives screen-reader users feedback when a
            new template is loaded. */}
        <p role="status" aria-live="polite" className="sr-only">
          {selected ? `Preview loaded for ${selected.cardName}.` : ""}
        </p>
      </div>

      <ManualSendSheet
        template={sendTarget}
        open={Boolean(sendForId)}
        onOpenChange={(open) => {
          if (!open) setSendForId(null);
        }}
        prefillRecipient={prefillRecipient}
      />

      {/* Discard confirmation — styled modal, brief §Copy "Confirmation dialog text" */}
      <BaseDialog.Root
        open={Boolean(pendingNextId)}
        onOpenChange={(open) => {
          if (!open) setPendingNextId(null);
        }}
      >
        <BaseDialog.Portal>
          <BaseDialog.Backdrop className="fixed inset-0 z-50 bg-[oklch(12%_0.01_165)]/35 backdrop-blur-sm data-[state=open]:animate-in data-[state=open]:fade-in data-[state=open]:duration-200 data-[state=closed]:animate-out data-[state=closed]:fade-out data-[state=closed]:duration-150 motion-reduce:!duration-0" />
          <BaseDialog.Popup className="fixed left-1/2 top-[30vh] z-50 w-[min(calc(100vw-2rem),26rem)] -translate-x-1/2 rounded-[var(--admin-radius-card)] border border-[var(--admin-border)] bg-[var(--admin-panel)] p-5 shadow-[var(--admin-shadow-overlay)] outline-none data-[state=open]:animate-in data-[state=open]:fade-in data-[state=open]:zoom-in-95 data-[state=open]:duration-200 data-[state=closed]:animate-out data-[state=closed]:fade-out data-[state=closed]:zoom-out-95 data-[state=closed]:duration-150 motion-reduce:!duration-0">
            <div className="flex items-start gap-3">
              <span className="mt-0.5 inline-flex size-9 shrink-0 items-center justify-center rounded-full bg-[oklch(95.5%_0.028_20)]">
                <XCircle className="size-5 text-[oklch(26%_0.14_25)]" aria-hidden="true" />
              </span>
              <div className="min-w-0 flex-1">
                <BaseDialog.Title className="text-base font-semibold text-[var(--admin-heading)]">
                  Leave without saving?
                </BaseDialog.Title>
                <BaseDialog.Description className="mt-1.5 text-sm leading-6 text-[var(--admin-text-muted)]">
                  Your edits to &ldquo;{selected?.cardName ?? "this template"}&rdquo; will
                  be lost.
                </BaseDialog.Description>
              </div>
            </div>
            <div className="mt-5 flex flex-wrap-reverse justify-end gap-2">
              <button
                ref={keepEditingRef}
                type="button"
                onClick={cancelDiscard}
                className="inline-flex min-h-10 items-center rounded-[var(--admin-radius-control)] border border-[var(--admin-border-form)] bg-transparent px-4 text-sm font-semibold text-[var(--admin-body)] outline-none transition-colors hover:bg-[var(--admin-panel-muted)] focus-visible:ring-2 focus-visible:ring-[var(--admin-focus)]/55"
              >
                Keep editing
              </button>
              <button
                type="button"
                onClick={confirmDiscard}
                className="inline-flex min-h-10 items-center gap-2 rounded-[var(--admin-radius-control)] bg-[oklch(40%_0.14_25)] px-4 text-sm font-semibold text-white outline-none transition-colors hover:bg-[oklch(33%_0.14_25)] focus-visible:ring-2 focus-visible:ring-[var(--admin-focus)]/55"
              >
                Leave
              </button>
            </div>
          </BaseDialog.Popup>
        </BaseDialog.Portal>
      </BaseDialog.Root>
    </section>
  );
}
