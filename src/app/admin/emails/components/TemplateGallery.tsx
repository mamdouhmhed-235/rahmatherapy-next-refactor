"use client";

// C-15 Phase E, Step 17 — template gallery. Replaces TemplateBrowser +
// TemplatesTab's mount on the Templates tab (page.tsx wires this in at
// Step 18). Cards are grouped by audience (brief §2.2, §4.1 layout sketch);
// the whole card navigates to the editor route (`/admin/emails/templates/
// [templateId]`, shipped in Phase C); a corner overflow menu — editors only —
// offers Reset (Phase D's resetTemplateToDefault) without leaving the
// gallery.
//
// Badge semantics mirror the editor's Reset-disabled gate exactly (brief
// §5.4, dispatch item 2): both are driven by the SAME derived signal — "does
// this template have at least one row in `badges`?" — sourced from the one
// grouped query in templates.ts's getTemplateOverrideSummaries(). A template
// can never show "Customised" while its own Reset is greyed out as
// already-default, or vice versa.
//
// RBAC (brief §3): gallery visibility is unchanged from the old Templates
// tab (page.tsx's existing canSeeDelivery || canResend gate — untouched by
// this file). `canEdit` gates the overflow menu entirely — a read-only
// viewer never sees a Reset control to begin with, rather than seeing one
// that's rendered-but-blocked (dispatch item 3).

import { useActionState, useEffect, useId, useState } from "react";
import Link from "next/link";
import { MoreHorizontal, RefreshCcw } from "lucide-react";
import { toast } from "sonner";
import { AdminStatusBadge } from "@/app/admin/components/admin-ui";
import {
  resetTemplateToDefault,
  type ResetTemplateToDefaultResult,
} from "@/app/admin/email-templates/actions";
import { relativeTime } from "../format";
import {
  AUDIENCE_GROUPS,
  templatesByAudience,
  type TemplateAudience,
  type TemplateMeta,
} from "./templates-data";

/** One entry per CUSTOMISED template. Absence from this map means Default —
 *  presence is the sole signal (brief §5.4), never a separate boolean that
 *  could drift from it. Built server-side (page.tsx) from ONE grouped query,
 *  never per-card. */
export interface TemplateGalleryBadge {
  updatedAt: string;
  updatedByName: string;
}

interface TemplateGalleryProps {
  canEdit: boolean;
  badges: Record<string, TemplateGalleryBadge>;
}

export function TemplateGallery({ canEdit, badges }: TemplateGalleryProps) {
  return (
    <div className="grid gap-6">
      {AUDIENCE_GROUPS.map((group) => {
        const items = templatesByAudience(group.id);
        if (items.length === 0) return null;
        return (
          <AudienceSection key={group.id} audience={group}>
            {items.map((template) => (
              <TemplateCard
                key={template.id}
                template={template}
                badge={badges[template.id] ?? null}
                canEdit={canEdit}
              />
            ))}
          </AudienceSection>
        );
      })}
    </div>
  );
}

function AudienceSection({
  audience,
  children,
}: {
  audience: { id: TemplateAudience; label: string };
  children: React.ReactNode;
}) {
  const headingId = useId();
  return (
    <section aria-labelledby={headingId}>
      <h2
        id={headingId}
        className="font-display mb-3 text-base font-semibold tracking-[-0.01em] text-[var(--admin-heading)]"
      >
        {audience.label}
      </h2>
      <div className="grid gap-3 sm:grid-cols-2 xl:grid-cols-3">{children}</div>
    </section>
  );
}

function TemplateCard({
  template,
  badge,
  canEdit,
}: {
  template: TemplateMeta;
  badge: TemplateGalleryBadge | null;
  canEdit: boolean;
}) {
  return (
    <article className="group relative rounded-[var(--admin-radius-card)] border border-[var(--admin-border)] bg-[var(--admin-panel)] p-4 transition-[transform,box-shadow,border-color] duration-200 ease-out hover:-translate-y-[1px] hover:border-[var(--admin-primary)]/35 hover:shadow-[var(--admin-shadow-hover)] motion-reduce:transform-none motion-reduce:transition-none">
      {/* Stretched link — the whole card is the click target (brief §2.2:
          "Card click → editor route"). Sits below the visible content and
          below the overflow menu in stacking order so neither is occluded. */}
      <Link
        href={`/admin/emails/templates/${template.id}`}
        className="absolute inset-0 z-0 rounded-[var(--admin-radius-card)] outline-none focus-visible:ring-2 focus-visible:ring-[var(--admin-focus)]/55"
      >
        <span className="sr-only">Open {template.cardName}</span>
      </Link>

      <div className="relative z-[1] flex items-start justify-between gap-2 pointer-events-none">
        <div className="min-w-0 pr-1">
          <h3 className="truncate text-sm font-semibold tracking-[-0.005em] text-[var(--admin-heading)]">
            {template.cardName}
          </h3>
          <p className="mt-1 line-clamp-2 text-xs leading-relaxed text-[var(--admin-text-muted)]">
            {template.trigger}
          </p>
        </div>
        {canEdit ? (
          <div className="pointer-events-auto -mr-1.5 -mt-1.5 shrink-0">
            <TemplateCardMenu template={template} hasOverrides={Boolean(badge)} />
          </div>
        ) : null}
      </div>

      <div className="relative z-[1] mt-3 pointer-events-none">
        {badge ? (
          <AdminStatusBadge
            tone="default"
            compact
            value={`Customised · ${badge.updatedByName} · ${relativeTime(badge.updatedAt)}`}
          />
        ) : (
          <AdminStatusBadge tone="muted" compact value="Default" />
        )}
      </div>
    </article>
  );
}

// ─── Overflow menu — Reset to default (brief §2.5, Phase D's action) ──────

function TemplateCardMenu({
  template,
  hasOverrides,
}: {
  template: TemplateMeta;
  hasOverrides: boolean;
}) {
  const [open, setOpen] = useState(false);
  const [resetState, resetFormAction, isPending] = useActionState<
    ResetTemplateToDefaultResult | null,
    FormData
  >(resetTemplateToDefault, null);

  // Confirm copy matches the editor's Reset button verbatim (brief §2.5) —
  // same action, same consequence, same wording regardless of which surface
  // triggered it.
  function handleResetClick(event: React.MouseEvent<HTMLButtonElement>) {
    const confirmed = window.confirm(
      `Reset '${template.cardName}' to its default wording? Your customisations to this template will be removed. Emails already sent are not affected.`
    );
    if (!confirmed) {
      event.preventDefault();
    }
  }

  useEffect(() => {
    if (!resetState) return;
    if (resetState.ok) {
      toast.success(`"${template.cardName}" reset to its default wording.`);
    } else if (resetState.error) {
      toast.error(resetState.error);
    }
    // eslint-disable-next-line react-hooks/set-state-in-effect
    setOpen(false);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [resetState]);

  return (
    <details
      className="relative inline-block text-left"
      open={open}
      onToggle={(event) => setOpen((event.target as HTMLDetailsElement).open)}
    >
      <summary
        aria-label={`More actions for ${template.cardName}`}
        title="More actions"
        className="inline-flex min-h-11 min-w-11 cursor-pointer list-none items-center justify-center rounded-[var(--admin-radius-control)] text-[var(--admin-text-muted)] outline-none transition-colors hover:bg-[var(--admin-panel-muted)] hover:text-[var(--admin-heading)] focus-visible:ring-2 focus-visible:ring-[var(--admin-focus)]/55 [&::-webkit-details-marker]:hidden"
      >
        <MoreHorizontal className="size-4" aria-hidden="true" />
      </summary>
      <div className="absolute right-0 z-20 mt-1 grid min-w-48 gap-0.5 rounded-[var(--admin-radius-card)] border border-[var(--admin-border)] bg-[var(--admin-panel)] p-1.5 shadow-[var(--admin-shadow-overlay)]">
        <form action={resetFormAction}>
          <input type="hidden" name="template_id" value={template.id} />
          <button
            type="submit"
            onClick={handleResetClick}
            disabled={!hasOverrides || isPending}
            aria-busy={isPending || undefined}
            title={hasOverrides ? undefined : "This template is already using its defaults."}
            className="flex min-h-11 w-full items-center gap-2 rounded-[var(--admin-radius-control)] px-3 text-left text-sm font-medium text-[var(--admin-body)] outline-none transition-colors hover:bg-[var(--admin-panel-muted)] hover:text-[var(--admin-heading)] focus-visible:ring-2 focus-visible:ring-[var(--admin-focus)]/55 disabled:cursor-not-allowed disabled:opacity-60"
          >
            <RefreshCcw className="size-3.5 shrink-0" aria-hidden="true" />
            Reset to default
          </button>
        </form>
      </div>
    </details>
  );
}
