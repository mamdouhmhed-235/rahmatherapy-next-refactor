// SERVER COMPONENT — Mobile sticky bottom action bar (B-5 brief §5.8).
//
// Hidden on desktop (≥ md). Action shape is pre-computed by
// `mobileStickyActionForVariant` in `dashboard-helpers-b5.ts`. This component
// is render-only: receives the computed action (or null) and emits the bar.
//
// A11y: `role="region" aria-label="Quick actions"` per SHARED-NOTES §3.
// External hrefs (Maps / tel:) render as native <a> so the browser handles
// the protocol; internal hrefs use next/link.

import Link from "next/link";
import type {
  MobileStickyAction,
  StickyActionItem,
} from "./dashboard-helpers-b5";

export interface MobileStickyActionBarProps {
  action: MobileStickyAction | null;
}

export function MobileStickyActionBar({ action }: MobileStickyActionBarProps) {
  if (!action) return null;
  return (
    <aside
      role="region"
      aria-label="Quick actions"
      // Lifted clear of the bottom tab bar: h-14 (3.5rem) plus the phone's own
      // bottom inset, which the tab bar pays for itself. At bottom-0 the two
      // bars tied at z-40 inside the .admin-shell stacking context, so document
      // order decided — and the tab bar, written after <main>, swallowed every
      // tap on this button.
      // ⛔ Offset, never a higher z-index: raising this bar would only swap
      // which of the two is dead.
      // ⛔ The tab bar is in flow now, not fixed, but the shell is exactly
      // 100dvh tall, so the bar still occupies the bottom 3.5rem of the
      // viewport — and a `fixed` element still resolves against the viewport,
      // so it still lands on top. The offset is still required.
      // The upward shadow is the same one the admin's other two fixed bottom
      // bars carry (SettingsForm.tsx, TemplateEditor.tsx). Without it the bar
      // is a flat slab in the same --admin-panel as the stat tiles it scrolls
      // over, so it read as a row of tiles sliced in half rather than as a bar
      // floating above them. --admin-shadow-ink-04 is inverted in dark mode
      // (0.45 black), so the separation shows in both themes.
      className="fixed bottom-[calc(3.5rem+env(safe-area-inset-bottom,0px))] inset-x-0 z-40 border-t border-[var(--admin-border)] bg-[var(--admin-panel)] px-3 pt-3 shadow-[0_-1px_8px_var(--admin-shadow-ink-04)] md:hidden"
      // A flat 0.75rem: the tab bar underneath already owns the iOS home-bar
      // inset, and `bottom` above already clears it, so keeping the max() here
      // would double-count it.
      style={{ paddingBottom: "0.75rem" }}
    >
      <div className="flex items-stretch gap-2">
        <ActionItem item={action.primary} primary />
        {action.secondary ? (
          <ActionItem item={action.secondary} primary={false} />
        ) : null}
      </div>
    </aside>
  );
}

function ActionItem({
  item,
  primary,
}: {
  item: StickyActionItem;
  primary: boolean;
}) {
  const className = primary
    ? "inline-flex h-11 flex-1 items-center justify-center gap-1.5 rounded-[var(--admin-radius-control)] bg-[var(--admin-primary)] px-3 text-sm font-semibold text-[var(--admin-on-primary)] outline-none transition-colors duration-150 ease-out hover:bg-[var(--admin-primary-hover)] focus-visible:ring-[3px] focus-visible:ring-offset-2 focus-visible:ring-[var(--admin-focus)]/55 motion-reduce:transition-none"
    : "inline-flex h-11 flex-1 items-center justify-center gap-1.5 rounded-[var(--admin-radius-control)] border border-[var(--admin-border)] bg-[var(--admin-panel)] px-3 text-sm font-semibold text-[var(--admin-body)] outline-none transition-colors duration-150 ease-out hover:bg-[var(--admin-panel-muted)] focus-visible:ring-[3px] focus-visible:ring-offset-2 focus-visible:ring-[var(--admin-focus)]/55 motion-reduce:transition-none";

  if (item.external) {
    return (
      <a href={item.href} className={className}>
        {item.label}
      </a>
    );
  }
  return (
    <Link href={item.href} className={className}>
      {item.label}
    </Link>
  );
}
