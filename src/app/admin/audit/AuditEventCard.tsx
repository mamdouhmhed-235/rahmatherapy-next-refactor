import { ChevronRight, ExternalLink, Eye, Lock, Pencil, Plus, Trash2 } from "lucide-react";
import Link from "next/link";
import type { LucideIcon } from "lucide-react";
import {
  buildFilterHref,
  buildTargetHref,
  buildTargetLabel,
  describeAction,
  formatAbsolute,
  formatRelative,
  targetTypeLabel,
  truncateUuid,
  type AuditFilterState,
} from "./format";
import { redactStatePayload, summariseRedactions } from "./redaction";
import { AuditRowMenu } from "./AuditRowMenu";
import type { AuditEventRow } from "./actions";

// Per `quieter` axis: tone down chip presence. A small family-tinted icon sits
// beside the verb. The icon SHAPE differentiates the family for sighted users
// who can't rely on colour alone (Named Status Rule, §2). The icon's
// surrounding `aria-label` / `title` names the family for screen readers.
type ChipKind = ReturnType<typeof describeAction>["chip"];

function chipMeta(
  chip: ChipKind
): { Icon: LucideIcon; className: string } | null {
  switch (chip) {
    case "confirmed":
      return { Icon: Plus, className: "text-[oklch(38%_0.10_155)]" };
    case "pending":
      return { Icon: Pencil, className: "text-[oklch(55%_0.16_70)]" };
    case "cancelled":
      return { Icon: Trash2, className: "text-[oklch(45%_0.19_25)]" };
    case "restricted":
      return { Icon: Eye, className: "text-[var(--admin-status-restricted-chip-icon)]" };
    default:
      return null;
  }
}

function chipLabel(chip: ReturnType<typeof describeAction>["chip"]): string {
  switch (chip) {
    case "confirmed":
      return "Creation event";
    case "pending":
      return "State change";
    case "cancelled":
      return "Destructive action";
    case "restricted":
      return "Read-only event";
    default:
      return "";
  }
}

// Deterministic warm-clinical avatar tint per actor id, matching DESIGN.md §6.
function avatarTint(seed: string | null): string {
  const tints = [
    "bg-[oklch(91%_0.025_155)] text-[var(--admin-status-confirmed-text)]",
    "bg-[oklch(92%_0.030_80)] text-[var(--admin-status-pending-text)]",
    "bg-[var(--admin-avatar-tint-violet)] text-[var(--admin-status-restricted-text)]",
    "bg-[var(--admin-status-completed-bg)] text-[var(--admin-status-completed-text)]",
    "bg-[oklch(92%_0.025_120)] text-[var(--admin-status-confirmed-text)]",
  ];
  if (!seed) return tints[0];
  let hash = 0;
  for (let i = 0; i < seed.length; i++) hash = (hash * 31 + seed.charCodeAt(i)) >>> 0;
  return tints[hash % tints.length];
}

function initials(name: string): string {
  return name
    .split(/\s+/)
    .filter(Boolean)
    .slice(0, 2)
    .map((part) => (Array.from(part)[0] ?? "").toUpperCase())
    .join("") || "·";
}

function prettyJson(value: Record<string, unknown> | null): string {
  if (!value) return "";
  const redacted = redactStatePayload(value);
  return JSON.stringify(redacted, null, 2);
}

interface AuditEventCardProps {
  event: AuditEventRow;
  actorName: string;
  targetExists: boolean | null;
  currentFilters: AuditFilterState;
}

function renderTargetChipContent(
  targetType: string | null | undefined,
  targetId: string | null | undefined,
  searchQuery: string
): React.ReactNode {
  const typeLabel = targetTypeLabel(targetType);
  const truncated = truncateUuid(targetId);
  // Highlight the matched search prefix on the truncated UUID head
  if (searchQuery && targetId && targetId.toLowerCase().startsWith(searchQuery.toLowerCase())) {
    const matchLen = searchQuery.length;
    const head = truncated.slice(0, Math.min(matchLen, truncated.indexOf("…")));
    const tail = truncated.slice(head.length);
    return (
      <>
        {typeLabel}{" "}
        <mark className="rounded-[2px] bg-[oklch(95%_0.05_75)] px-0.5 text-[var(--admin-status-pending-text)]">
          {head}
        </mark>
        {tail}
      </>
    );
  }
  return truncated ? `${typeLabel} ${truncated}` : typeLabel;
}

export function AuditEventCard({ event, actorName, targetExists, currentFilters }: AuditEventCardProps) {
  const description = describeAction(event.action_type);
  const redaction = summariseRedactions(event.before_state, event.after_state);
  const chip = chipMeta(description.chip);
  const tint = avatarTint(event.actor_staff_id);

  const targetHref = buildTargetHref(event.target_type, event.target_id);
  const targetLabel = buildTargetLabel(event.target_type);
  const showOpenTarget = targetHref && targetExists !== false;

  const relative = formatRelative(event.created_at);
  const absolute = formatAbsolute(event.created_at);

  const beforeNull = event.before_state === null;
  const afterNull = event.after_state === null;

  // Build one-click filter hrefs that preserve the rest of the current URL state.
  const actorFilterHref = event.actor_staff_id
    ? buildFilterHref(currentFilters, { actor: event.actor_staff_id })
    : null;
  const isActorActive = currentFilters.actor === event.actor_staff_id;
  const familyKey = description.family;
  const familyFilterHref = chip
    ? buildFilterHref(currentFilters, { family: familyKey })
    : null;
  const isFamilyActive = currentFilters.family === familyKey;

  return (
    <article className="rounded-[var(--admin-radius-card)] border border-[var(--admin-border)] bg-[var(--admin-panel)] p-4 transition-colors print:break-inside-avoid print:border print:bg-white">
      <h2 className="sr-only">
        {actorName} {description.phrase} {targetTypeLabel(event.target_type)} {truncateUuid(event.target_id)} {relative}
      </h2>

      <header className="flex flex-wrap items-start justify-between gap-3">
        <div className="flex min-w-0 items-start gap-3">
          <span
            aria-hidden="true"
            className={`inline-flex size-8 shrink-0 items-center justify-center rounded-full text-[0.6875rem] font-semibold ${tint}`}
          >
            {initials(actorName)}
          </span>
          <div className="min-w-0">
            <p className="flex flex-wrap items-baseline gap-x-1.5 gap-y-0.5 text-[0.9375rem] leading-tight">
              {chip ? (
                familyFilterHref && !isFamilyActive ? (
                  <Link
                    href={familyFilterHref}
                    className={`${chip.className} mt-1.5 inline-flex shrink-0 self-start outline-none transition-transform hover:scale-125 focus-visible:ring-2 focus-visible:ring-[var(--admin-focus)]/55 focus-visible:ring-offset-2`}
                    aria-label={`Filter by action family: ${chipLabel(description.chip)}`}
                    title={`Filter by ${chipLabel(description.chip)}`}
                  >
                    <chip.Icon className="size-3.5" aria-hidden="true" />
                  </Link>
                ) : (
                  <span
                    className={`${chip.className} mt-1.5 inline-flex shrink-0 self-start`}
                    aria-label={`Action family: ${chipLabel(description.chip)}`}
                    title={chipLabel(description.chip)}
                  >
                    <chip.Icon className="size-3.5" aria-hidden="true" />
                  </span>
                )
              ) : null}
              {actorFilterHref && !isActorActive ? (
                <Link
                  href={actorFilterHref}
                  className="font-display font-semibold text-[var(--admin-heading)] underline-offset-4 outline-none transition-colors hover:underline focus-visible:underline focus-visible:ring-2 focus-visible:ring-[var(--admin-focus)]/55"
                  title={`Filter by ${actorName}`}
                >
                  {actorName}
                </Link>
              ) : (
                <span className="font-display font-semibold text-[var(--admin-heading)]">{actorName}</span>
              )}
              <span className="text-[var(--admin-body)]">{description.phrase}</span>
              {event.target_type ? (
                <span className="inline-flex items-center gap-1 rounded-[4px] border border-[var(--admin-border)] bg-[var(--admin-page,_var(--admin-panel))] px-1.5 py-0.5 font-mono text-[0.75rem] tracking-tight text-[var(--admin-body)] [font-variant-numeric:tabular-nums]">
                  {renderTargetChipContent(event.target_type, event.target_id, currentFilters.q)}
                </span>
              ) : null}
            </p>
          </div>
        </div>
        <time
          dateTime={event.created_at}
          title={absolute}
          className="shrink-0 text-[0.75rem] font-medium text-[var(--admin-text-muted)]"
        >
          {relative}
        </time>
      </header>

      {redaction.count > 0 ? (
        <div className="mt-2 flex flex-wrap items-center gap-2">
          <span
            className="inline-flex items-center gap-1 rounded-full bg-[var(--admin-status-restricted-bg)] px-2 py-0.5 text-[0.6875rem] text-[var(--admin-status-restricted-text)]"
            title={`Hidden: ${redaction.keysHidden.join(", ")}`}
          >
            <Lock className="size-3" aria-hidden="true" />
            Redacted: {redaction.count === 1 ? "1 field" : `${redaction.count} field(s)`}
          </span>
        </div>
      ) : null}

      <details className="group mt-3 print:!open" data-audit-json="true">
        <summary className="-mx-2 inline-flex min-h-[44px] cursor-pointer list-none items-center gap-1.5 rounded-[var(--admin-radius-control)] px-2 py-2 text-xs font-medium text-[var(--admin-body)] outline-none transition-colors hover:text-[var(--admin-heading)] focus-visible:ring-2 focus-visible:ring-[var(--admin-focus)]/55 md:min-h-0 md:py-0 [&::-webkit-details-marker]:hidden">
          <ChevronRight
            className="size-3.5 transition-transform duration-200 ease-out group-open:rotate-90 motion-reduce:transition-none"
            aria-hidden="true"
          />
          Show before / after
        </summary>
        <div className="mt-3 grid gap-3 rounded-[var(--admin-radius-card)] border border-[var(--admin-border)] bg-[var(--admin-page,_oklch(97.8%_0.006_88))] p-3 md:grid-cols-2 md:divide-x md:divide-[var(--admin-border)]">
          <div className="min-w-0">
            <p className="mb-1.5 text-[0.6875rem] font-semibold uppercase tracking-wide text-[var(--admin-text-muted)]">
              Before{beforeNull ? ": (created)" : ""}
            </p>
            {beforeNull ? (
              <p className="text-xs italic text-[var(--admin-text-muted)]">No prior state.</p>
            ) : (
              <pre className="overflow-x-auto whitespace-pre-wrap break-words font-mono text-[0.75rem] leading-5 text-[var(--admin-heading)]">
                {prettyJson(event.before_state)}
              </pre>
            )}
          </div>
          <div className="min-w-0 md:pl-3">
            <p className="mb-1.5 text-[0.6875rem] font-semibold uppercase tracking-wide text-[var(--admin-text-muted)]">
              After{afterNull ? ": (deleted)" : ""}
            </p>
            {afterNull ? (
              <p className="text-xs italic text-[var(--admin-text-muted)]">Row removed.</p>
            ) : (
              <pre className="overflow-x-auto whitespace-pre-wrap break-words font-mono text-[0.75rem] leading-5 text-[var(--admin-heading)]">
                {prettyJson(event.after_state)}
              </pre>
            )}
          </div>
        </div>
      </details>

      <footer className="mt-3 flex flex-wrap items-center justify-between gap-3 text-xs print:hidden">
        <div className="flex flex-wrap items-center gap-2">
          {showOpenTarget ? (
            <Link
              href={targetHref}
              className="inline-flex min-h-[44px] items-center gap-1 rounded-[var(--admin-radius-control)] px-2.5 py-1.5 text-xs font-medium text-[var(--admin-body)] outline-none transition-colors hover:bg-[var(--admin-panel-muted)] hover:text-[var(--admin-heading)] focus-visible:ring-2 focus-visible:ring-[var(--admin-focus)]/55 md:min-h-0 md:py-1"
            >
              <ExternalLink className="size-3" aria-hidden="true" />
              {targetLabel}
            </Link>
          ) : targetHref && targetExists === false ? (
            <span className="text-xs text-[var(--admin-text-muted)]">Target row no longer exists.</span>
          ) : null}
        </div>
        <AuditRowMenu eventId={event.id} targetId={event.target_id} />
      </footer>
    </article>
  );
}
