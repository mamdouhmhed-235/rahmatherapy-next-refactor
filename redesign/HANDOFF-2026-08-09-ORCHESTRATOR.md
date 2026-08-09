# HANDOFF — Band C orchestrator session, 2026-08-09

**Read this first, then `redesign/plans/C-phase/C-C-EXECUTION-PROTOCOL.md` end to end.**
Written at the Owner's request as a clean stopping point. **Nothing is mid-flight. No agent is running. The tree is clean apart from the standing `maintenance.ts`.**

| | |
|---|---|
| **HEAD at handoff** | `2ff2c92` |
| **Session start** | `425556b` · **32 commits** this session |
| **Master-plan rows** | **20 of 23 ✅**. Remaining: **C-20**, **C-14**, **C-10** |
| **Tree** | `git status --porcelain -- src/ supabase/` → only ` M src/lib/maintenance.ts` |
| **Drift checkpoint #4** | ✅ done (`DRIFT-CHECKPOINT-4-FORMAL.md`), ran after plan #20 (C-23 at `102241f`, checkpoint at `436300d`) |

---

## 1 — What shipped

**C-19 — Privacy policy page → ✅ SHIPPED** (`e70bef8`, fix `ab80687`, closeout `33f74fb`).
Its closeout **FAILED first time** with two blocking under-disclosures, both confirmed twice: the page omitted the required **`city`** field (the booking API collects four location fields, not three) and scoped gender collection to *"anyone else included"* when a self-booking also stores the **booker's own** `clientGender`. Fixed and re-verified with an exhaustive field-by-field mapping across **both** `bookingRequestSchema` and `manualBookingSchema`, checked in **both directions** — zero missing, **zero over-disclosed**.

**C-23 — Admin availability calendar → ✅ SHIPPED** (final code `2ad93d0`, closeout `102241f`).
Six commits, tiers declared in advance (B FULL, C TARGETED, D FULL, E fan-out). The ⛔ behavioural baseline was captured with **zero emails sent** — the confirmation toggle gates the only send in `createManualBooking` (`actions.ts:1689`), verified afterwards by `email_delivery_events` count = 0. Payload identity (blocking gate §3.3) confirmed **live** for branches 1 and 2; branch 3 byte-identical. **8 of 10 plan gates closed**, 2 held for an Owner ruling, 0 blocking defects.

**C-20 — Address autocomplete → implementation COMPLETE, held on one decision** (see §3.1).
Phases A–D shipped and verified; gate §3.2 (real-address matrix) and §3.5 (key sign-off) — the plan's **two unwaivable gates** — both closed.

**C-14 — Working hours + booking window → Phase D ✅, Phase A ✅ + migration applied.**
Phases B and C remain.

---

## 2 — ⛔/⏸ OWNER DECISIONS OUTSTANDING — this is what unblocks the programme

### 2.1 ⏸ C-20 — Google Maps consent classification *(the only thing between C-20 and ✅)*
**Is Maps *functional-on-interaction* (loads only when a user focuses the address field — the plan's recommendation) or *consent-gated* (does not load until accepted)?**
Unblocks Step 9's second half: a `cookie-registry.ts` entry + `CONSENT_BANNER_VERSION` bump. ~20 minutes to implement and re-verify.
**Do not ship C-20 without it.** Maps sets client-side storage, and C-18 built the registry precisely so `/cookies` discloses everything the site loads — shipping without the entry leaves that page understating reality, the same defect class C-18 was written to fix. **Note the bump re-prompts every returning visitor.** Nothing is live yet (deploy deferred), so there is no current gap.

### 2.2 ⛔ C-14 Phase A verify checkpoint — needs a SECOND approval
The live save round-trip was **not** performed. It writes `availability_rules` — the **real global rota** — and would stop customers booking Monday afternoons until reverted. Detail and a lower-risk no-op variant in `C-14-…-progress.md` §2.5.

### 2.3 ⛔ C-14 Phase C migration *(not yet drafted)*
```sql
DROP INDEX IF EXISTS public.availability_overrides_override_date_key;
ALTER TABLE public.staff_availability_overrides
  DROP CONSTRAINT IF EXISTS staff_availability_overrides_staff_id_override_date_key;
```
Both constraints **confirmed present** by pre-flight. **Must ship atomically with its code (D12):** `createAvailabilityOverride` uses `.upsert(onConflict: "override_date")`, and PostgREST's `ON CONFLICT` errors the instant that index disappears. Second casualty: `addStaffAvailabilityOverride` relies on catching `PG_UNIQUE_VIOLATION` for its duplicate-date message — that guard silently dies and needs replacing in the same commit.

### 2.4 ⏸ C-23's two gate rulings *(§3.4b of its progress file)*
Neither is observable without mutating production: the "public paused" half of gate 6, and the mixed-gender **partial** marker (no naturally-partial day exists — all bookable staff share global availability). **Orchestrator recommendation: accept the code-level proof for both.** Both were mutation-tested at unit level.

### 2.5 ⛔ Zone-2 cleanup — three C-23 baseline bookings
Bookings `29779a0c-…`, `836d6da6-…`, `98a676ca-…`; clients `7259cefa-…`, `c51b98f1-…`, `f6991be3-…`; participants `b1536446-…`, `512a5fd9-…`, `c65cdd64-…`, `69aa0501-…`. Full ids in `C-23-…-progress.md` §0.2a.

### 2.6 The recurring-series email defect *(found by drift checkpoint #4)*
`recurringSchema` has **no `send_confirmation_email` field** and `sendRecurringSeriesCreatedEmail` fires **unconditionally** (`src/app/admin/bookings/recurring-actions.ts:197`), while the single-booking path honours the checkbox. **Latent** (no live series) but it ships on the deploy. ~4 lines. No remaining plan owns that file, so it is logged, not fixed.

---

## 3 — Exact next actions

1. **C-20 §2.1 → implement, re-verify, flip row to ✅.**
2. **C-14 Phase B** (Steps 10–11) — reuse `WorkingHoursDayEditor` for per-staff rules. **`save_staff_availability_day` is already deployed**, so Phase B needs no new ⛔. Step 11 verifies `resolveStaffWindows` consumes multiple rows (likely already true — verify, don't assume).
3. **C-14 Phase C** behind §2.3.
4. **C-10 LAST** — and **not before C-14 completes**. It measures *final* page heights; C-14's remaining phases change the admin availability pages, so cataloguing early records geometry C-14 then invalidates (its own pre-flight #4 warns of exactly this for C-16). Needs the dev server + an Owner admin session.
5. **The single orchestrator build, last of all.** It must confirm: **54/54 static** (C-14 Phase D made `PublicLayout` async — reasoned safe, genuinely unverified), C-20's **+3 kB** and C-23's **+6 kB** bundle ceilings. No agent could measure any of them.
6. **Restore `src/lib/maintenance.ts` to `MAINTENANCE_MODE = true` before any deploy**, and state its state in the final report.

---

## 4 — Standing facts (unchanged, still binding)

- **`maintenance.ts`:** working copy `false`, **HEAD `true`**, last touched by `35bf817` (pre-programme), **never staged in 336+ commits**. Never stage/commit/revert it. For any claim about *deployed* behaviour read `git show HEAD:<path>`.
- **Dev server is Owner-run** at `localhost:3000`. Never spawn/restart/kill. `/` → 308 `/home/` is normal.
- **Agents never authenticate.** The Owner offered credentials again this session; declined again. The Owner signed in themselves and the orchestrator drove that session.
- **No `pnpm build` by agents.** Orchestrator gets ONE, last. Still unspent.
- **Baseline BY IDENTITY** at `2ff2c92`: tsc **0** · vitest failures exactly `admin-access.test.ts` ×2 + `ManualBookingForm.test.tsx` ×3 (**5 failed / 2120 passed / 2125**) · eslint **59E/7W** in exactly `design_handoff_area_pages/prototype/{area-page,shared,site-chrome}.jsx` + `src/features/booking/{BookingExperience.tsx,BookingExperienceLoader.tsx,utils/returning-customer.ts}`.
- **Deploy remains deferred** — the four-in-one Cloudflare deploy.

---

## 5 — Traps this session hit, so the next one does not

1. **"Logged in" is ambiguous across MCP browser profiles.** The Owner's session was in the **chrome-devtools** Chrome; the **Playwright** browser had a lone `about:blank` tab that redirected to login, and `curl` 307'd too. **Probe the specific browser you intend to drive.**
2. **The admin form's visible inputs carry no `name`** — the submitted values live in separate hidden mirrors. Writing to `input[name="city"]` sets the mirror, React re-renders it away, and the value is silently discarded. **Drive the visible control, then read the mirror to confirm.**
3. **`<input type="date">`/`type="time"` ignore the MCP fill helper.** The value appears in the DOM *and* the accessibility tree while the hidden mirror stays empty — a convincing false positive. Use Part 0's native-setter pattern and verify via the mirror.
4. **MCP viewport emulation reloads the page** (fires `beforeunload`), resetting multi-step wizards to step 1. That is tooling, **not** a mobile bug — do not report it as one.
5. **Line anchors go stale within a single session.** `ManualBookingForm.tsx` anchors drifted **twice** in this session alone. Always re-locate by symbol.
6. **vitest's `include` glob is `src/**`**, so scratchpad mutation copies often will not resolve. Four separate agents hit this. If you must stage inside `src/`, name it clearly, delete immediately, verify `git status`.
7. **A deeply-sourced argument is not evidence.** A verifier failed C-20 on a blocking claim citing react-dom internals, Base UI source and the DOM spec — that Escape would close the booking dialog. A two-minute **real key press** refuted it. The mechanism it missed was `e.preventDefault()` on the line *above* the `stopPropagation()` it analysed. **Where a claim is about observable runtime behaviour and the surface is reachable, test it before acting.**
8. **A led verification only finds what it is pointed at.** C-23 Phase C passed a TARGETED review led on five *risk* points, while shipping incomplete against a *brief requirement* (month navigation) that was not among them. **Check led points against the brief's requirement list, not just the risk list.**
9. **Defects live between components.** C-23's adversarial closeout found a real bug — the calendar not following a typed date — that four separate phase verifications had all passed over, because each was scoped to one side of the seam.

---

## 6 — Orchestrator process failures this session, recorded honestly

1. **Write-tasks ran during drift checkpoint #4.** Checkpoint #2 rated this BLOCKING and the adopted correction was explicit: checkpoints complete before the next plan's implementation begins. I dispatched C-20 Phase C concurrently; HEAD moved twice while the checkpoint wrote its report. Its own verdict was fair — clean **"by timing, not by control."**
2. **Bookkeeping commits landed while implementers were running**, twice; the C-14 implementer duly reported HEAD moving under it. Harmless (disjoint files) but an implementer should see a still tree. **Batch bookkeeping until agents return.**
3. **The API key was printed.** Confirming the lazy load meant capturing the loader's script URL, which contained the key; slicing a URL without considering its query string was careless. Kept out of the written record since. It did confirm `.env` holds the key exposed in chat — a question the backlog had marked unknown. **The Owner's no-rotate decision stands**; the mitigating facts are unchanged (a `NEXT_PUBLIC_*` Maps key is inlined into client bundles and public by nature; the referrer restriction is the real control).
4. **Two implementers bent "scratchpad copies only"** by staging mutation copies inside `src/` (deleted immediately, trees verified clean, no real file ever mutated). See trap 6 — this is a tooling constraint that needs solving properly if mutation testing continues.

---

*End of handoff. Position files: `redesign/per-page-progress/C-{14,20,23,19}-*-progress.md` · `OWNER-ACTION-BACKLOG.md` · `DRIFT-CHECKPOINT-4-FORMAL.md`.*
