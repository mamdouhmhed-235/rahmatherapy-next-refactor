# Verification And Deployment Checklist

## Status

- Phase: 9 checklist update
- Completion status: Complete for remediation planning
- Purpose: Provide reusable verification and deployment gates for future remediation implementation.
- Runtime remediation performed in this phase: None

## Documentation Checklist

| Check | Status | Notes |
|---|---|---|
| All required audit files exist | Complete | All 12 required files exist under `docs/audits/planned-site-quality-audit/`. |
| Every in-scope route has a complete compliance matrix | Complete | Completed in `02-plan-compliance-matrix.md`. |
| Every route has visual/responsive notes | Complete | Completed in `03-visual-ui-ux-audit.md` and `04-responsive-mobile-audit.md`. |
| Every planned-page interactive component has accessibility notes | Complete | Completed in `05-accessibility-audit.md`. |
| Content/copy/CTA/performance/deployment scans are documented | Complete | Completed in `06`, `07`, and `08` audit files. |
| Every issue appears in the master register | Complete | `09-master-issue-register.md` consolidated 21 canonical issues with alias mapping. |
| Remediation plan covers every canonical issue | Complete | `10-remediation-implementation-plan.md` assigns every canonical issue to a phase. |
| Asset-dependent issues are isolated | Complete | VISUAL-001 and VISUAL-002 are in the asset replacement phase; PLAN-HOME-001 and PLAN-FAQS-002 have asset-decision notes. |
| No runtime source files changed during planning | Complete | Phase 9 changed audit documentation only. |
| No screenshots committed | Complete | Screenshots are not required artifacts. |

## Required Validation Commands

Run after each remediation phase:

```powershell
pnpm lint
pnpm exec tsc --noEmit --incremental false
pnpm build
```

If `package.json` includes a `test` script at remediation time, also run:

```powershell
pnpm test
```

Record exact command output, exit code, and any known environment issue before proceeding.

## Common Local Smoke Routes

Use trailing-slash URLs because the audit observed slashless local routes redirect with `308`.

| Route | Required check |
|---|---|
| `/home-planned/` | Planned home content, booking CTA, mobile overflow, disclaimer, header/footer. |
| `/home-planning/` | Redirect alias behavior to planned home. |
| `/services/` | Services page, package finder, package cards, booking CTAs. |
| `/services/supreme-combo-package/` | Package hero, package booking preselection, related package links. |
| `/services/hijama-package/` | Package hero, package booking preselection, related package links. |
| `/services/fire-cupping-package/` | Package hero, package booking preselection, related package links. |
| `/services/massage-therapy-30-mins/` | Package hero, package booking preselection, related package links. |
| `/services/massage-therapy-1-hour/` | Package hero, package booking preselection, related package links. |
| `/about/` | Team/trust content, visual assets, shared shell. |
| `/reviews/` | Review proof, filters, search, load more, card disclosure, performance. |
| `/faqs-aftercare/` | Tabs, FAQ categories, aftercare content, booking/WhatsApp CTAs. |

## Common Live Deployment Routes

Primary deployment:

```txt
https://rahmatherapy-next-refactor.vercel.app/
```

| Route | Required live URL |
|---|---|
| `/home-planned/` | `https://rahmatherapy-next-refactor.vercel.app/home-planned/` |
| `/services/` | `https://rahmatherapy-next-refactor.vercel.app/services/` |
| `/services/supreme-combo-package/` | `https://rahmatherapy-next-refactor.vercel.app/services/supreme-combo-package/` |
| `/services/hijama-package/` | `https://rahmatherapy-next-refactor.vercel.app/services/hijama-package/` |
| `/services/fire-cupping-package/` | `https://rahmatherapy-next-refactor.vercel.app/services/fire-cupping-package/` |
| `/services/massage-therapy-30-mins/` | `https://rahmatherapy-next-refactor.vercel.app/services/massage-therapy-30-mins/` |
| `/services/massage-therapy-1-hour/` | `https://rahmatherapy-next-refactor.vercel.app/services/massage-therapy-1-hour/` |
| `/about/` | `https://rahmatherapy-next-refactor.vercel.app/about/` |
| `/reviews/` | `https://rahmatherapy-next-refactor.vercel.app/reviews/` |
| `/faqs-aftercare/` | `https://rahmatherapy-next-refactor.vercel.app/faqs-aftercare/` |

Alternate deployments, only if primary is stale or unavailable:

```txt
https://rahmatherapy-next-ref-git-5fb7c0-mamdouh9001-gmailcoms-projects.vercel.app/
https://rahmatherapy-next-refactor-qgg5pr3n5.vercel.app/
```

## Phase Gates

### Phase 1 Gate: Critical CTA And Mobile Containment

Issue IDs:

- INTERACTION-001
- RESP-003

Validation:

- Required commands run and results recorded.
- `/services/?booking=1` opens booking popup.
- `/services/?booking=1&services=hijama-package` opens booking popup and preselects Hijama package.
- A visible booking trigger opens the popup on `/home-planned/`, `/services/`, `/reviews/`, and `/faqs-aftercare/`.
- Modal focus enters, traps, closes on Escape, and restores.
- `/home-planned/` at 390px has `document.documentElement.scrollWidth <= window.innerWidth`.

Deployment:

- Commit message: `fix planned booking popup and home mobile overflow`
- Push to default branch.
- Wait for Vercel.
- Check `/home-planned/`, `/services/?booking=1`, `/services/?booking=1&services=hijama-package`, `/reviews/?booking=1`, `/faqs-aftercare/?booking=1`.

Proceed only if all checks pass.

### Phase 2 Gate: Content And Plan-Compliance Restoration

Issue IDs:

- PLAN-HOME-002
- CTA-001
- PLAN-REVIEWS-001
- PLAN-HOME-001
- PLAN-SERVICES-001
- PLAN-FAQS-002

Validation:

- Required commands run and results recorded.
- Exact required disclaimer appears on `/home-planned/`.
- Static scan finds no `Book Now page`, `/book-now`, or `?package=` in scoped planned source.
- Reviews hero and featured proof text match canonical review data where rendered as review quotes.
- `PackageFinder` uses services image wrapper.
- `AftercareTabs` uses FAQ/aftercare image wrapper.
- Home hero image path decision is documented if asset is unavailable.

Deployment:

- Commit message: `fix planned content compliance and image wrappers`
- Push to default branch.
- Wait for Vercel.
- Check `/home-planned/`, `/services/`, `/reviews/`, `/faqs-aftercare/`.

Proceed only if copy and review integrity pass.

### Phase 3 Gate: Accessibility And Interaction Fixes

Issue IDs:

- A11Y-001
- A11Y-002
- A11Y-003
- A11Y-004
- A11Y-005

Validation:

- Required commands run and results recorded.
- First Tab stop is a visible skip link to `main#main-content`.
- Heading outline has one H1 per page and logical H2/H3 nesting on affected routes.
- Aftercare and FAQ category tabs support ArrowLeft, ArrowRight, Home, and End or use an accessible tabs primitive.
- Package finder recommendation changes are announced.
- Review card disclosure has clear role/name/state and no unnamed focusable article.

Deployment:

- Commit message: `fix planned page accessibility interactions`
- Push to default branch.
- Wait for Vercel.
- Check `/home-planned/`, `/services/`, `/reviews/`, `/faqs-aftercare/`.

Proceed only if keyboard checks pass.

### Phase 4 Gate: Responsive Layout And Shared Navigation

Issue IDs:

- UX-001
- UX-002
- RESP-001
- RESP-002
- CTA-002

Validation:

- Required commands run and results recorded.
- Header shows one clear navigation mode at 1024px and 1440px.
- Planned shell navigation decision for `Home` is implemented and verified.
- Services, package, and FAQs/aftercare tablet heroes are no longer overlong.
- Package mobile heroes balance copy, CTA, and proof at 390px.
- FAQ/aftercare mobile tabs are discoverable without guessing horizontal scroll.

Deployment:

- Commit message: `improve planned responsive layout and navigation`
- Push to default branch.
- Wait for Vercel.
- Check `/home-planned/`, `/services/`, `/services/supreme-combo-package/`, `/faqs-aftercare/`.

Proceed only if 390px, 768px, 1024px, and 1440px checks pass on affected routes.

### Phase 5 Gate: Asset Replacement And Visual Polish

Issue IDs:

- VISUAL-001
- VISUAL-002

Validation:

- Approved assets are available before implementation starts.
- Required commands run and results recorded.
- Planned images render on affected routes.
- No prominent production placeholder remains unless explicitly marked asset-blocked.
- Reviews proof uses planned imagery and preserves exact review text.
- Overlay contrast remains readable.
- No new overflow introduced at 390px, 768px, 1024px, or 1440px.

Deployment:

- Commit message: `add planned media assets and visual proof polish`
- Push to default branch.
- Wait for Vercel.
- Check all affected planned routes.

Proceed only if assets are approved and rendered. If assets are unavailable, mark the specific sections as deferred and do not invent replacements.

### Phase 6 Gate: Performance, SEO, And Deployment Hardening

Issue IDs:

- PERF-001

Validation:

- Required commands run and results recorded.
- Review wall renders fewer/lighter animated cards or removes costly per-card layout animation.
- Search, filters, load more, and review disclosure still work.
- Reduced motion remains respected.
- Static scan confirms no Review or AggregateRating schema was added.
- Metadata still renders on planned routes.

Deployment:

- Commit message: `optimize planned reviews wall performance`
- Push to default branch.
- Wait for Vercel.
- Check `/reviews/`, `/home-planned/`, `/services/`, `/faqs-aftercare/`.

Proceed only if review page interaction and performance behavior are both acceptable.

### Phase 7 Gate: Final Cross-Page Verification

Issue IDs:

- Verifies all remediated issue IDs.

Validation:

- Required commands run and results recorded.
- Every in-scope planned route returns expected local content.
- Booking popup opens from general and package query strings.
- No forbidden booking URLs exist in scoped planned source.
- Accessibility keyboard checks pass.
- Responsive checks pass at 390px, 768px, 1024px, and 1440px.
- Asset-blocked items, if any, have explicit rationale.

Deployment:

- Commit message if documentation/status is updated: `verify planned site remediation`
- Push to default branch if there are changes.
- Wait for Vercel.
- Check every in-scope planned route on primary deployment.
- Check alternate deployments only if primary is stale or unavailable.

Final completion requires all non-deferred issues to be closed by verification evidence.

## Rollback Checklist

For each remediation phase:

| Step | Requirement |
|---|---|
| Identify commit | Record the phase commit hash after commit. |
| Identify files | List files changed by the phase. |
| Prefer safe revert | Use a normal `git revert <commit>` in future remediation work unless the user explicitly requests another rollback path. |
| Avoid destructive commands | Do not use `git reset --hard` or destructive checkout commands without explicit user approval. |
| Re-test dependencies | If rolling back a shared-shell phase, re-test booking, header, footer, and all affected planned routes. |
| Record result | Document rollback reason and post-rollback validation result. |

## Final Acceptance Checklist

| Area | Acceptance criterion |
|---|---|
| Route scope | Only planned pages and shared planned-page surfaces changed. |
| Booking | `?booking=1` and `?booking=1&services=<valid-id>` work on planned pages. |
| Forbidden routes | No `?package=`, `/book-now`, or `/services/mobile-massage-therapy` in scoped planned source. |
| Content | Required disclaimer exact; review text preserved; no unsupported medical claims. |
| Accessibility | Skip link, keyboard tabs, live recommendation, review disclosure, and heading hierarchy pass. |
| Responsive | No horizontal overflow; tablet/mobile hero and tab layouts pass. |
| Visual | Approved assets render; placeholders only remain where explicitly deferred. |
| Performance | Reviews wall avoids unnecessary high-card-count animation and respects reduced motion. |
| SEO | Metadata remains present; no self-serving Review/AggregateRating schema. |
| Validation | Lint, TypeScript command, build, and tests if present are recorded. |
| Deployment | Vercel route checks recorded after every phase. |

## Phase 9 Documentation Gate

| Check | Status |
|---|---|
| Every issue assigned to a remediation phase or asset-blocked phase | Complete |
| Plan detailed enough for future implementation without chat context | Complete |
| Validation commands included | Complete |
| Local route checks included | Complete |
| Live Vercel checks included | Complete |
| Commit and rollback notes included | Complete |
| Runtime code changed | No |
