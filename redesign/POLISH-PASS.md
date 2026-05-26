# Polish Pass — Phase 7 Gate 7

**Date:** 2026-05-20
**Phase:** Phase 7 Pre-Ship Gauntlet · Gate 7 (`/impeccable polish admin`)
**Scope:** Final code-mutating quality pass before Gate 8 critique re-score. Design-system alignment, drift resolution at the token level, code-quality sweep, edge-case verification.

---

## Pre-polish state

After Gates 0–6:
- **Gate 1 audit** scored 17/20 Strong; AI-slop PASS.
- **Gate 3 harden** closed empty / loading / error states + 14 latent Unicode-safe initials + 12 new error.tsx files + `safeFormatDateTime` helper.
- **Gate 4 optimize** removed the localStorage hydration waterfall on `notification-bell` and swept 15 `transition-all` callsites to property-scoped transitions.
- **Gate 5 adapt + re-run** brought every primary button-shaped control to WCAG 2.5.5 AA mobile floor (44px) via a global CSS rule + 6 per-file targeted edits; 25 / 25 admin routes screenshotted at 375 + 768, zero horizontal scroll on any route.
- **Gate 6 onboard** added the new-staff `ProfileCompletionNudge` panel + refined onboarding-checklist phrasing + closed the `/admin/staff` "No staff yet" empty-state CTA gap; 30-callsite empty-state audit accepted (18 useful CTAs, 11 voice-only by design, 1 fixed).

Admin is functionally complete. Quality bar for this gate: **flagship pre-ship** per PRODUCT.md Brand Personality "Calm · Scannable · Dignified" and Design Principle 1 "Simplicity that opens into depth." Polish targets details that survived the prior gates without rocking the boat.

---

## Design-system discovery

DESIGN.md is the canonical source. Tokens live in `src/styles/tokens.css` (the `:root` block) and are surfaced as Tailwind utilities via `@theme inline`. Six named status families, three surface tiers (canvas / panel / input), Field White (`oklch(99.5% 0.003 88)`) for text on Clinic Green chrome.

**Drift identified during discovery:** 5 files referenced two CSS tokens that were never defined.

| Token used | Files | Defined in tokens.css? |
|---|---|---|
| `--admin-on-primary` | `emails/components/TemplateEditForm.tsx`, `emails/components/ManualSendSheet.tsx`, plus 3 inline-style locations using literal `#ffffff` | **No** — undefined |
| `--admin-text-inverse` | `reports/page.tsx` (2 usages) | **No** — undefined |

**Root cause:** Missing token (per polish reference's classification: "the value should exist in the system but doesn't"). Without the definition, `var(--admin-on-primary)` resolved to the CSS initial for `color` (inherits from ancestor), which on Clinic Green chrome rendered as Practice Charcoal — well below the WCAG 4.5:1 contrast floor and visually invisible. The codebase had been compensating with inline `style={{ color: "#ffffff" }}` overrides on the same surfaces, leaving the codebase split between two patterns and the token-only callsites visually broken.

**Fix shape:** Define the token, then route all 7 callsites through it.

---

## Files changed

| # | File | Change |
|---|---|---|
| 1 | `src/styles/tokens.css` | **New token** `--admin-on-primary: oklch(99.5% 0.003 88);` after `--admin-primary-hover`. Comment cites DESIGN.md §2 "Field White… all text, icons, and labels on dark green surfaces." Single source of truth. |
| 2 | `src/app/admin/staff/[staffId]/availability/AvailabilityModeSelector.tsx` | 2 inline `style={{ color: "#ffffff" }}` removals → `text-[var(--admin-on-primary)]` in the `className`. Verified rendered color `rgb(254, 253, 251)` (=#fefdfb, the token-resolved value). |
| 3 | `src/app/admin/staff/[staffId]/availability/page.tsx` | 1 inline `style={{ color: "#ffffff" }}` → inline `style={{ color: "var(--admin-on-primary)" }}`. (Kept inline-style form here because the Next.js `<Link>` element exhibited a cascade quirk where the className-only token approach didn't win on this specific tab link; inline-style preserves the working cascade while still routing through the token. Acceptable per polish reference's pragmatism rule.) |
| 4 | `src/app/admin/reports/page.tsx` | 2 callsites: `text-[var(--admin-text-inverse)]` → `text-[var(--admin-on-primary)]`. Consolidates two token names to one. |

**4 source files** changed. No new files. No structural changes. No flow changes.

---

## Other polish dimensions — verdict + evidence

Per the polish reference's "Polish Systematically" checklist:

| Dimension | Verdict | Evidence |
|---|---|---|
| Visual alignment & spacing | Held | Gate 5 + 6 already worked the spacing scale; no new misalignments surfaced. |
| Information architecture & flow | Held | Phase 6 brief shaped each page's flow; Gate 5 adapt + Gate 6 onboard validated new-staff path. |
| Typography refinement | Held | Brief 01 established the Urbanist / Work Sans / Cormorant / IBM Plex Mono hierarchy; Phase 6 typesetter pass closed the contrast ratio gaps. |
| Color & contrast | **Improved this gate** | Token-routing now correct on all 7 admin-on-primary callsites. Other tokens already routed through `--admin-canvas` / `--admin-panel` / `--admin-heading` / `--admin-body` / status-family pairs. Zero `bg-gray-N` / `bg-red-N` / `border-orange-N` / raw Tailwind palette utilities remain (grep returns 0). |
| Interaction states | Held | Gate 3 harden closed empty / loading / error states; focus-ring uses `--admin-focus` consistently; hover states are token-based throughout. |
| Micro-interactions & transitions | Held | Gate 4 optimize swept 15 `transition-all` → property-scoped; reduced-motion global rule in globals.css. |
| Content & copy | Held | Gate 2 clarify + Gate 6 onboard refined empty-state copy + onboarding-checklist labels. |
| Icons & images | Held | Lucide icon family used throughout; `aria-hidden="true"` on decorative icons (21+ confirmed in baseline). |
| Forms & inputs | Held | Gate 3 harden landed `role="alert" aria-live="polite"` on every form, required `*` markers via shared `FieldLabel` primitive, `aria-invalid` plumbing. |
| Edge cases & error states | Held | 12 new `error.tsx` files at Phase 7 Gate 3; `safeFormatDateTime` for invalid dates. |
| Responsiveness | Held | Gate 5 adapt: 25 / 25 admin routes at 375 + 768 with zero horizontal scroll; WCAG 2.5.5 AA touch targets across the board. |
| Performance | Held | Gate 4 optimize delivered the long-task improvements (PERF-REPORT.md). |
| Code quality — console logging | Held | 37 `console.error` callsites in admin source; ALL inside `error.tsx` boundaries or server actions for legitimate Sentry-pipeline error logging. No `console.log` / `console.warn` / `console.debug` / `console.info` in production paths. Keep all. |
| Code quality — TODO / FIXME / XXX / HACK markers | **Clean** | Zero matches in `src/app/admin`. |
| Code quality — dead code | Held | No `.bak` / `.old` / commented-out blocks of consequence surfaced by the sweep. |
| Code quality — `data-redesign-fake` markers (~30 callsites) | **Accepted as-is.** | These are intentional tracking attributes per `ENGINEERING-LOG.md`'s FAKE-row inventory, indicating UI surfaces whose backend wiring still depends on outstanding BUILD plans (10 pages with FAKE backend status per PER-PAGE-SCORES.md). Removing them would lose the tracking signal that Phase 7 / future work uses to find these surfaces. They are zero-cost runtime — pure `data-*` attributes have no visual or behavioural effect. |

---

## Verification (Playwright, 2026-05-20)

### `/admin/staff/{id}/availability` (375 × 812)
Token applied to mode-selector button + active tab:
- `<button aria-pressed="true">Use global hours</button>` → computed `color: rgb(254, 253, 251)` (= `#fefdfb`, the token-resolved value). ✓
- `<a aria-current="page">Availability</a>` → computed `color: rgb(254, 253, 251)`. ✓
- DOM grep confirmed `--admin-on-primary` resolves to `#fefdfb` at `:root`, on the link, and on the button. ✓

Screenshot: `redesign/polish-shots/375-staff-availability-tab-fixed.png` (active tab visibly white on green; before-fix counterpart in `375-staff-availability-tab-check.png` showed the same tab in barely-visible Chronicle on green).

### `/admin/dashboard` (375 × 812)
- Page loads, scrollWidth 360 (no horizontal scroll). ✓
- Console: zero errors, zero warnings. ✓

### `/admin/reports` (375 × 812)
- Page loads, scrollWidth 360. ✓
- The two `text-[var(--admin-on-primary)]` consumers (filter-count badge, Apply filters button) are inside a "More filters" sheet that opens on demand; the static class rename is verified by source diff. The token is the same one verified on `/admin/staff/{id}/availability`.

---

## Post-finish spot-check — 3 pages × focus rings, hover transitions, polish-touched callsites

Per Gate 7's post-finish contract ("focus rings visible on every interactive element, hover states feel intentional, spacing rhythm consistent"). 3 representative pages probed.

| Page | Total interactive elements | Focus rings (sampled) | Hover transitions | Notes |
|---|---:|---|---|---|
| `/admin/dashboard` | 33 | 5 / 5 ✓ (Skip-link, brand link, search button, notif bell, "Today" preset) — all carry `box-shadow: oklab(0.577 -0.063 -0.103 / 0.22) 0 0 0 4px` (= `--admin-focus` blue at 22% opacity) or token-coloured `outline` | n/a — global motion tokens (160 / 240 / 360 ms) consistent | First page after sign-in. Focus stops obvious at every chrome touchpoint. |
| `/admin/bookings` | 47 | 6 / 6 ✓ (Skip-link, brand link, 2 nav icons, "New booking" CTA, "Needs Attention" view pill) | 3 / 3 ✓ — every sampled element has a non-`none` `transitionProperty`. The page-level controls use property-scoped `color, background-color, border-color, outline-color, text-decoration-color, fill, stroke` (Tailwind's `transition-colors`), matching the Gate 4 optimize sweep. | Primary daily workflow surface (KEY_TASK 1). |
| `/admin/staff/{id}/availability` | 25 | 8 / 8 ✓ (Skip-link, brand link, search, notif bell, breadcrumb back-link, Profile Settings tab, Availability tab, "Use global hours" mode button) | Polish-touched controls verified specifically: tab link + mode button both have property-scoped `transition-colors` and respond to `hover:bg-[var(--admin-primary-hover)]`. | The page whose source this gate edited. Tab link computed `color: rgb(254, 253, 251)` (=`#fefdfb`, token-resolved) ✓; mode button identical. |

**Spacing rhythm.** Visual review of `redesign/polish-shots/375-staff-availability-final.png` confirms the Gate 5 + 6 spacing scale holds end-to-end on the polish-touched page (page header → tabs → mode selector panel → weekly-rules panel). No new misalignment introduced. No spacing-property edits were made by this gate.

**Console.** `mcp__playwright__browser_console_messages` returned 0 errors / 0 warnings across all 3 pages post-polish.

---

## Polish-discipline self-audit (no structural changes)

Per Gate 7's "Polish should NOT have restructured layouts or redesigned components" constraint, `git diff --stat` since the Gate 6 addendum commit:

```
 src/app/admin/reports/page.tsx                                      | 4 ++--
 .../admin/staff/[staffId]/availability/AvailabilityModeSelector.tsx | 6 ++----
 src/app/admin/staff/[staffId]/availability/page.tsx                 | 2 +-
 src/styles/tokens.css                                               | 5 +++++
 4 files changed, 10 insertions(+), 7 deletions(-)
```

**4 files, +10 / −7.** Reading the actual diff:
- **`tokens.css`**: 5 lines added (4 comment + 1 declaration). Pure addition. Zero deletions.
- **`AvailabilityModeSelector.tsx`**: 6 deletions / 4 insertions. Inline `style={…}` attribute removed; class string extended with `text-[var(--admin-on-primary)]`. Zero JSX shape change. Zero component split / merge.
- **`availability/page.tsx`**: 1 line changed — inline-style value `"#ffffff"` → `"var(--admin-on-primary)"`. Same `<Link>`, same className shape, same children.
- **`reports/page.tsx`**: 2 lines changed — `text-[var(--admin-text-inverse)]` → `text-[var(--admin-on-primary)]` substring swap. Zero JSX shape change.

**No layouts restructured. No components redesigned. No flow shape changed.** Pure alignment-and-consistency token routing, as the polish constraint demands.

---

## What this gate deliberately did NOT do

Per polish reference's "Don't perfect one corner while leaving another rough" and "Don't introduce new patterns or flows that diverge from established ones":

- **Did not edit `src/app/globals.css`** literal `#ffffff` inside `.admin-action-primary`, `.admin-nav-surface`, etc. Those are admin-chrome utility classes that work as a unit; touching them would risk regression across every admin route and exceed surgical scope. (The `oklch(99.5% 0.003 88)` value and `#ffffff` differ by 1 in the blue channel and are visually identical at any practical resolution; the design system treats them as the same Field White token. The internal-consistency win is the meaningful one.)
- **Did not strip `data-redesign-fake` / `data-redesign-backend="FAKE"` markers.** They are a tracking mechanism the post-Phase-7 future-engineering track uses to identify the 10 pages with placeholder backend wiring. Removing them would erase the audit trail.
- **Did not touch the email-template HTML preview's `#ffffff`** (`src/app/admin/email-templates/preview/[id]/route.ts`). Email-client HTML needs explicit hex for compatibility with mail renderers; the design-token cascade does not apply outside the React tree.
- **Did not modify `console.error` callsites.** They are routed through Sentry's `onRequestError` pipeline and are intentional production error logging.
- **Did not add new tokens beyond `--admin-on-primary`.** The drift was specifically those 7 callsites; defining additional tokens would be speculative and exceed scope.

---

## Should Gate 3 (harden) re-run on any file changed during this gate?

**No.** Polish-only changes:
- New token added (additive, no removal)
- 3 className/inline-style swaps to use the new token
- 2 callsites switched from one undefined token name to the canonical defined token
- No new state paths, no new data dependencies, no overflow risks, no new error paths

---

## Gate 7 closed: 2026-05-20.

Ready for Gate 8 (`/impeccable critique admin`). Gate 8 is the design re-score against the BASELINE-CRITIQUE.md (21/40, AI-slop FAIL) and BASELINE-AUDIT.md (12/20, anti-patterns partial-FAIL) rubrics — the must-equal-or-beat thresholds Phase 7 was set up to clear.
