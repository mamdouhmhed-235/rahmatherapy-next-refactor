# Pre-B-1 visual baseline

Captured 2026-05-24 (session 5, B-0 step 2) at git SHA `d2e6512`.

## Populated screenshots

12 PNGs — 4 viewports × 3 surfaces, all signed in as **Owner** (`rahmatherapy@outlook.com`).

| Viewport | Dashboard | Reports | Client detail |
|---|---|---|---|
| 375 × 812 (iPhone) | `375/owner-dashboard-populated.png` | `375/owner-reports-populated.png` | `375/owner-clients-detail-populated.png` |
| 768 × 1024 (iPad) | `768/owner-dashboard-populated.png` | `768/owner-reports-populated.png` | `768/owner-clients-detail-populated.png` |
| 1280 × 800 (laptop) | `1280/owner-dashboard-populated.png` | `1280/owner-reports-populated.png` | `1280/owner-clients-detail-populated.png` |
| 1440 × 900 (desktop) | `1440/owner-dashboard-populated.png` | `1440/owner-reports-populated.png` | `1440/owner-clients-detail-populated.png` |

Client detail target: Fatima Ahmed (`5d5d7a36-7209-4d07-a673-fc46222cd5c7`), 2 completed bookings.

## Skeleton / loading state — captured from source, not as a screenshot

Dev-mode timing is not reliable for capturing skeleton frames (Turbopack caches each route after first hit; Playwright MCP exposes no network-throttling). The visual diff B-1 needs to land is between the *pre-B-1 skeleton implementation* and the *post-B-1 skeleton implementation*. Both implementations are code-defined, so the baseline below is sourced from the codebase rather than a flaky frame capture.

### Component-level baseline: `AdminSkeleton`

Found in [`src/app/admin/components/admin-ui.tsx`](../../../src/app/admin/components/admin-ui.tsx#L1263).

```tsx
export function AdminSkeleton({ className }: { className?: string }) {
  return (
    <div
      aria-hidden="true"
      className={cn(
        "relative overflow-hidden rounded-[var(--admin-radius-control)] bg-[var(--admin-border)]/40",
        className
      )}
    >
      <span
        aria-hidden="true"
        className="absolute inset-0 -translate-x-full bg-gradient-to-r from-transparent via-[var(--admin-panel)]/80 to-transparent motion-reduce:hidden"
        style={{ animation: "shimmer 1.6s infinite" }}
      />
    </div>
  );
}
```

Driven by `@keyframes shimmer` at [`src/app/globals.css:41`](../../../src/app/globals.css#L41) (verified by grep — only definition).

**Already shimmer.** B-1 plan step 2 ("swap shimmer keyframe") is partially a no-op at the component level — the only valid B-1 step-2 work is whatever the shimmer animation's *visual tuning* is (gradient stops, duration, easing) per the B-1 brief's design intent. **See `redesign/per-page-progress/B0-baseline-progress.md` for the flagged discrepancy.**

### Route-level `loading.tsx` baseline (pre-B-1)

Four route-level `loading.tsx` files use **inline `animate-pulse`** Tailwind classes instead of `<AdminSkeleton>`. These are what users see on first navigation before a server component finishes rendering. They do NOT inherit the shimmer treatment.

| File | Pre-B-1 pattern | Lines using animate-pulse |
|---|---|---|
| `src/app/admin/loading.tsx` | `<div className="… animate-pulse …">` raw divs | 6 occurrences (header bars + 5 sample list rows) |
| `src/app/admin/clients/loading.tsx` | same pattern | 6 occurrences |
| `src/app/admin/emails/loading.tsx` | same pattern (NOT in B-1 scope) | n |
| `src/app/admin/reports/loading.tsx` | TBD — verify in B-4 |

B-1 plan step 2 + the brief's "skeleton shimmer" goal would best be satisfied by **migrating these `loading.tsx` files to `<AdminSkeleton>`** (which already shimmers), in addition to any tuning of the `AdminSkeleton` shimmer animation itself. Recommend B-1 implementer cross-check the brief vs reality on this point before step 2.

## Why no skeleton screenshots

Three options were considered for capturing pulse-state frames:
- Network throttling — not exposed via Playwright MCP.
- Race the frame on first-load — flaky in dev mode (Turbopack compile dominates timing on cold route).
- Add a deterministic `?force-loading` query param — out of scope for B-0 (would require code change).

A code-level baseline (what the current implementation actually is) is more durable than a fleeting screenshot. The post-B-1 verification gate compares against this code-level baseline plus a fresh shimmer-vs-pulse visual demonstration captured during B-1's own static gates.
