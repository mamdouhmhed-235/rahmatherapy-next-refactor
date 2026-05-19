# Phase 6 — browser reconciliation walk plan

> **Run in a fresh Claude Code session** with the `/goal` command from the main agent. This file is your contract. Tick off each `[ ]` as you complete it using the Edit tool. Do not skip steps. Do not improvise. The earlier source-level reconciliation walk (see `WAVE-RECONCILIATION.md` lines 134+) substituted for browser walk when Playwright MCP wasn't reachable; your job is the **actual browser walk** now that the user is running you in a session with Playwright loaded.

## 1. Why this exists

Phase 6 of the Rahma Therapy admin redesign closed 2026-05-19 — all 29 admin pages merged into `redesign/start-state` (commit `7169417`, tag `phase6-complete`). POST-AGENT-AUDIT-PROTOCOL §7 step 2 requires an end-of-batch reconciliation walk: sign in as each of the 5 RBAC roles, walk every admin page at desktop (1440px) + mobile (375px), document cross-page inconsistencies in `redesign/WAVE-RECONCILIATION.md`. This walk is **documentation-only**. You are NOT fixing anything. Phase 7's `/impeccable audit admin` gauntlet is the deep audit; this walk is a surface-level cross-page sanity sweep.

A prior code-only reconciliation walk (WAVE-RECONCILIATION.md lines 134+) surfaced 7 cross-page inconsistencies via source-level analysis. Your job: verify those 7 in the browser and surface anything the code walk couldn't see (visual regressions, layout breaks at 375, sibling-page divergence in render).

## 2. Preflight (do once, then check the boxes)

- [x] **2.1 — Confirm dev server is running** at `http://localhost:3000`. Use `mcp__playwright__browser_navigate` on `http://localhost:3000/admin/login`. Expect HTTP 200 (or 308 trailing-slash redirect → 200). If it fails (ECONNREFUSED, timeout), emit `STUCK: dev server unreachable at http://localhost:3000 — user must start it (cd "C:\Users\mamdo\Desktop\rahmatherapy - Copy\rahmatherapy-next-refactor" && pnpm next dev -p 3000) before this walk can proceed` and STOP. **Do not start the dev server yourself.**

- [x] **2.2 — Confirm Playwright MCP loaded.** The `/goal` already loaded Playwright tool schemas. Verify by checking that `mcp__playwright__browser_navigate` is callable. If it returns `InputValidationError`, emit `STUCK: playwright schemas missing — re-run ToolSearch select:mcp__playwright__*` and STOP.

- [x] **2.3 — Read `redesign/test-credentials.md`.** Note the 5 role accounts. Use them verbatim. There is NO `test.owner@...` account; Owner is `rahmatherapy@outlook.com` / `Password123`.

- [x] **2.4 — Create the screenshots directory** `redesign/reconciliation-walk/` (Bash: `mkdir -p`). Confirm it exists.

## 3. The walk — sequential, role-by-role

**Sign-out pattern** between roles: in the browser context, send a POST request via `browser_evaluate`:
```js
await fetch('/admin/signout', { method: 'POST' })
```
Wait for navigation. Verify you land on `/admin/login`. **Never GET on `/admin/signout` — it returns 405 and leaves the session intact.**

**Screenshot naming:** `redesign/reconciliation-walk/<role>-<slug>-{1440,375}.png` — `<role>` ∈ {`owner`, `admin`, `coord`, `ther`, `inact`}.

**Per-page micro-flow:**
1. `browser_resize` to 1440×900
2. `browser_navigate` to the page URL
3. `browser_wait_for` until page is interactive (status 200 in DOM, no spinner)
4. `browser_take_screenshot` → save to `redesign/reconciliation-walk/<role>-<slug>-1440.png`
5. `browser_resize` to 375×812
6. `browser_take_screenshot` → save to `redesign/reconciliation-walk/<role>-<slug>-375.png`
7. Note any obvious issue in your running tally (don't write to WAVE-RECONCILIATION.md until §5)
8. Mark the checkbox in this plan with Edit (`[ ]` → `[x]`)

If a page won't load after 30s, mark the checkbox as `[!]` and write one-line reason in your tally as `NOTED FOR PHASE 7: <slug> failed to load — <reason>`. Move on. Don't get stuck.

### 3.1 — Sign in as Owner (`rahmatherapy@outlook.com` / `Password123`)

Navigate to `/admin/login`, fill `name="email"` + `name="password"` (use `browser_fill_form`), click Sign in. Verify redirect to `/admin/dashboard`. Then walk:

- [x] 3.1.01 — `owner-login-default` (capture BEFORE sign-in)
- [x] 3.1.02 — `owner-dashboard` (`/admin/dashboard` — Owner/Admin variant)
- [x] 3.1.03 — `owner-bookings` (`/admin/bookings`)
- [x] 3.1.04 — `owner-booking-new` (`/admin/bookings/new`)
- [x] 3.1.05 — `owner-booking-detail` — open any booking from the list at `/admin/bookings`; capture URL `/admin/bookings/<id>`
- [x] 3.1.06 — `owner-calendar` (`/admin/calendar`)
- [x] 3.1.07 — `owner-clients` (`/admin/clients`)
- [x] 3.1.08 — `owner-client-detail` — open any client; URL `/admin/clients/<id>`
- [x] 3.1.09 — `owner-client-new` (`/admin/clients/new`)
- [x] 3.1.10 — `owner-enquiries` (`/admin/enquiries`)
- [x] 3.1.11 — `owner-reports` (`/admin/reports`)
- [x] 3.1.12 — `owner-operations` (`/admin/operations`)
- [x] 3.1.13 — `owner-privacy` (`/admin/privacy`)
- [x] 3.1.14 — `owner-audit` (`/admin/audit`)
- [x] 3.1.15 — `owner-account-password-requests` (`/admin/account/password-requests`)
- [x] 3.1.16 — `owner-staff` (`/admin/staff`)
- [x] 3.1.17 — `owner-staff-detail` — open any staff; URL `/admin/staff/<id>`
- [x] 3.1.18 — `owner-staff-availability` (`/admin/staff/<id>/availability`)
- [x] 3.1.19 — `owner-availability` (`/admin/availability`)
- [x] 3.1.20 — `owner-emails` (`/admin/emails` — Delivery tab default)
- [x] 3.1.21 — `owner-email-templates` (`/admin/emails?tab=templates`)
- [x] 3.1.22 — `owner-settings` (`/admin/settings` — Owner-only)
- [x] 3.1.23 — `owner-roles` (`/admin/roles` — Owner-only)
- [x] 3.1.24 — `owner-role-detail` — open any role; URL `/admin/roles/<id>` (Owner-only)
- [x] 3.1.25 — `owner-services` (`/admin/services` — Owner-only)
- [x] 3.1.26 — `owner-password-reset` (`/admin/password-reset` — public)
- [x] 3.1.27 — `owner-signout` — POST `/admin/signout`; verify redirect to `/admin/login`

### 3.2 — Sign in as Admin (`test.admin@rahmatherapy.example.test` / `AdminTest123!`)

Walk only the **deltas from Owner**: the 4 Owner-only pages (settings, roles, role-detail, services) should render `AdminAccessDenied`. Plus 1 spot-check that dashboard renders the same Owner/Admin variant.

- [x] 3.2.01 — `admin-dashboard` (sibling to owner-dashboard; expect near-identical Owner/Admin variant)
- [x] 3.2.02 — `admin-settings` — expect `AdminAccessDenied`
- [x] 3.2.03 — `admin-roles` — expect `AdminAccessDenied`
- [x] 3.2.04 — `admin-role-detail` — try `/admin/roles/<id>` — expect `AdminAccessDenied`
- [x] 3.2.05 — `admin-services` — expect `AdminAccessDenied`
- [x] 3.2.06 — `admin-signout`

### 3.3 — Sign in as Coordinator (`test.coordinator@rahmatherapy.example.test` / `CoordinatorTest123!`)

Coordinator sees a different dashboard variant; access-denied on revenue (reports), staff*, availability, emails, audit, privacy, operations, settings, roles, role-detail, services, account-password-requests.

- [x] 3.3.01 — `coord-dashboard` (Coordinator variant — different from Owner)
- [x] 3.3.02 — `coord-bookings` (scoped)
- [x] 3.3.03 — `coord-clients` (scoped)
- [x] 3.3.04 — `coord-enquiries`
- [x] 3.3.05 — `coord-calendar`
- [x] 3.3.06 — `coord-reports` — expect `AdminAccessDenied`
- [x] 3.3.07 — `coord-staff` — expect `AdminAccessDenied`
- [x] 3.3.08 — `coord-emails` — expect `AdminAccessDenied`
- [x] 3.3.09 — `coord-signout`

### 3.4 — Sign in as Therapist (`test.therapist@rahmatherapy.example.test` / `TherapistTest123!`)

Therapist sees the narrowest variant; only their own bookings/clients; can see own staff-detail.

- [x] 3.4.01 — `ther-dashboard` (Therapist variant — Next Visit hero, claimable strip, casey-fix CTA when empty)
- [x] 3.4.02 — `ther-bookings` (scoped to own assigned bookings)
- [x] 3.4.03 — `ther-clients` (scoped via assigned bookings)
- [x] 3.4.04 — `ther-staff-detail` — own profile only (use the URL from a link in dashboard or guess from sign-in profile)
- [x] 3.4.05 — `ther-settings` — expect `AdminAccessDenied`. **CRITICAL: read the "Back to <X>" CTA label**. The code-walk found this is hardcoded to "Back to dashboard" because no call site passes the `variant` prop. The Therapist's role-correct copy should be "Back to My day" but won't render until the variant prop is wired. Record the rendered label verbatim in your tally — this is one of the 7 code-walk findings to verify.
- [x] 3.4.06 — `ther-signout`

### 3.5 — Sign in as Inactive (`test.inactive@rahmatherapy.example.test` / `InactiveTest123!`)

Inactive can't pass middleware.

- [x] 3.5.01 — `inact-login-attempt` — fill form, click Sign in; expect redirect to `/admin/login?reason=inactive` with the inactive notice rendered. Take BOTH viewport screenshots after the redirect lands.

## 4. What to look for — cross-page consistency, NOT per-page polish (that's Phase 7)

- **AdminTopNav consistency**: same chrome (brand wordmark, page name, right-rail: NotificationBell + cmd-K hint + avatar) across all pages for the same role. Variant-aware nav per role (max 5 primary items per DESIGN.md §5).
- **Sibling pages look like siblings**: 3 dashboards (Owner/Coord/Ther) read as variants of one surface; 3 email tabs (Delivery/Reminders/Templates) share tab shell.
- **`AdminAccessDenied`** surfaces consistent across all role/page combos — same shape (heading, body copy). No raw permission identifiers in the wild.
- **Sign-in/sign-out flows** complete cleanly for each role; middleware redirects Inactive.
- **Mobile (375px)**: no horizontal scroll on any page; AdminSheet nav opens; touch targets ≥44px.
- **Status badges**: every status pill carries text + icon (not color-only) per DESIGN.md Named Status Rule.
- **Empty states**: illustrated when expected; no dashed borders; voice is encouraging not apologetic.
- **Tab strips**: `aria-current="page"` on the active tab (Phase 6 commitment).

### The 7 code-walk findings to verify in browser

Read `redesign/WAVE-RECONCILIATION.md` lines 161-196 for the full list. Verify each in the browser; mark CONFIRMED, NOT REPRODUCED, or PARTIAL in §5 output:

1. `AdminAccessDenied` `variant` prop never passed by any of 23 call sites → Therapists see "Back to dashboard" instead of role-correct "Back to My day". (Test at step 3.4.05.)
2. Two empty-state components in parallel use across 25 surfaces.
3. Two call sites still pass deprecated `permission=` prop with raw permission strings.
4. Status-icon family has two `null` mappings.
5. (Read WAVE-RECONCILIATION.md for the rest — items 5-7.)
6. (See above.)
7. (See above.)

## 5. Output — write to `redesign/WAVE-RECONCILIATION.md`

When all checklist boxes in §2 + §3 are `[x]` or `[!]`, **append** (do NOT replace prior sections) a new section to `redesign/WAVE-RECONCILIATION.md`:

```markdown
## Phase 6 — browser reconciliation walk (browser-driven, 2026-05-19)

Method: Playwright MCP, real browser, real dev server at http://localhost:3000.
Total pages walked: <N>. Roles: 5. Viewports: 2.
Screenshots: redesign/reconciliation-walk/*.png (<count> files).

### Walk summary
| Role | Pages walked | Pages failed-to-load | Findings |
|---|---|---|---|
| Owner | 27 | 0 | <count> |
| Admin | 6 | 0 | <count> |
| Coord | 9 | 0 | <count> |
| Ther | 6 | 0 | <count> |
| Inact | 1 | 0 | <count> |

### Findings — by severity

#### BLOCKS-RELEASE
(none / list with file/screenshot ref)

#### CROSS-PAGE INCONSISTENCY (browser-confirmed)
- [Specific finding] — verified at step <N> screenshot <path>

#### COSMETIC
- ...

#### NOTED FOR PHASE 7
- ...

### Verification of the 7 source-level findings (from WAVE-RECONCILIATION.md lines 161-196)
1. AdminAccessDenied `variant` prop → Therapist "Back to dashboard" copy: **[CONFIRMED / NOT REPRODUCED / PARTIAL]** — screenshot: `redesign/reconciliation-walk/ther-settings-1440.png`
2. ...
3. ...
(verify each of the 7 in turn)

### Sign-off
- Browser walk complete: yes
- All 5 roles signed in successfully (or list which failed)
- Screenshots written to `redesign/reconciliation-walk/`
- Issues handed to Phase 7 gauntlet
```

Then emit the literal final line: `BROWSER_WALK_COMPLETE — awaiting user review`

## 6. Anti-drift rules — never violate these

1. **NEVER write source code.** No edits under `src/`. No new components. No fixes. This is observation only.
2. **NEVER kill or restart the dev server.** The user starts it manually before invoking this /goal. You connect to `http://localhost:3000`.
3. **NEVER stage or commit.** No `git add`. No `git commit`. The walk's output is documentation only.
4. **NEVER use `git add .` or `git add -A`.** Stays a hard rule even though you shouldn't be staging anything at all here.
5. **NEVER skip a checklist box.** If a page won't load, mark it `[!]` and write a one-line reason in your tally. Move on.
6. **NEVER invent findings.** Only report what the browser shows. Screenshots are your evidence.
7. **Always use exact role credentials from `redesign/test-credentials.md`.** No fabrication. There is NO `test.owner@...` account.
8. **Sign-out via POST** — never GET on `/admin/signout` (returns 405).
9. **NEVER modify any file outside** `redesign/WAVE-RECONCILIATION.md`, `redesign/reconciliation-walk/*.png`, and this plan file (for checkbox updates).

## 7. STUCK clause

If genuinely blocked, emit:
```
STUCK: <step number from this plan> — <specific actionable reason>
```
The /goal will end the loop. The user investigates and re-dispatches with a fix.

## 8. Hard cap

If 60 main-model turns elapse without GOAL_MET, emit:
```
TURN_CAP_REACHED — <summary: which steps complete, which missing>
```
and stop.

## 9. Done condition

When all of these hold:
- Every `[ ]` in this plan is `[x]` or `[!]`
- `redesign/WAVE-RECONCILIATION.md` has the new section appended (per §5)
- ≥45 screenshots exist under `redesign/reconciliation-walk/`

…emit the literal final line:
```
BROWSER_WALK_COMPLETE — awaiting user review
```

End of plan.
