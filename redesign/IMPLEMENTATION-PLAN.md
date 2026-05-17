# Implementation Plan

Generated at the end of Phase 5. Locks in the order pages will be redesigned in Phase 6, and provides a pre-filled re-prime prompt per page so each fresh session starts correctly.

How to use:
1. Work top to bottom. Each row is one Phase 6 session.
2. For the next undone row, copy its re-prime prompt into a FRESH Claude Code session, paste, follow the per-page loop in Phase 6, commit.
3. When the page is approved + committed, change [ ] to [x] and fill in the commit hash on that row.
4. When every row is [x], advance to Phase 7.

Order is a recommendation. Reorder if you have a real constraint. If you reorder rows, top-to-bottom is the truth — the ## N. label is just a name, not the live position. Renumber if you want, or leave the labels alone.

Currently on: 9 of 29 — clients   ← update when you start a session (count by position from the top, not by label)

---

## 1. [x] 00-shared-components — commit: aa76451

**Tier:** Tier 1 — shared-components foundation (always first)

**Why this position:** AdminTopNav, AdminPanel, Buttons, Inputs, AdminStatusBadge, EmptyState, BookingListCard, AdminStat, AdminSheet, and ConfirmActionModal must exist before any page session can adopt the new vocabulary. Every downstream session imports from this primitive set.

Re-prime prompt (copy into a fresh Claude Code session):

```
Fresh session — re-priming for Phase 6 (Implementation) of the admin redesign recipe.
Page being redesigned in THIS session: 00-shared-components

STEP 1 — READ THESE FILES IN ORDER. Do not skim.
1. PRODUCT.md (foundation file — register, voice, anti-references)
2. /redesign/RECIPE-PROGRESS.md
3. /redesign/SAFETY-NET.md (so you know the rollback path for the branch I chose in Phase 0a)
4. DESIGN.md (full, incl. ## Admin-Specific Patterns)
5. /redesign/briefs/00-shared-components-brief.md   ← the brief for THIS page only
6. /redesign/BASELINE-ISSUES.md
7. /redesign/IMAGES-NEEDED.md

STEP 2 — CONFIRM IN ONE MESSAGE:
- One sentence per file, telling me what's in it
- The exact register from PRODUCT.md (must read "product" for this admin recipe — flag if it doesn't)
- The page you're about to redesign + its file path (cross-checked between RECON.md mentions and the brief)
- The Feature Preservation Manifest items from the brief (every form, button, JS hook that must survive)
- Pre-existing console errors I should NOT chase (from BASELINE-ISSUES.md)
- The phase + page we're entering (should be Phase 6 for 00-shared-components)

STEP 3 — STOP. Do not start /impeccable craft until I reply "primed — go".

CONFIRMATION CHALLENGE: after your one-sentence-per-file summary, quote the second sentence of the most-load-bearing file's most-load-bearing section verbatim (e.g. for the 5→6 re-prime, quote sentence 2 of the brief's "## 6. Key States" section; for any phase using PRODUCT.md, quote sentence 2 of "## Brand Personality"). If you can't quote it, you didn't actually re-read — re-read from disk now and try again. This guards against summarised cache.

If any file has been compacted or summarised in your context, re-read the original from disk.
```

---

## 2. [x] booking-new — commit: 892df61

**Tier:** Tier 2 — KEY_TASK 1 (Create bookings)

**Why this position:** PRODUCT.md's top daily task. Four-step wizard with pre-fill from `?clientId=` and `?enquiryId=`; highest operator impact if the form is broken. Worked immediately after shared-components while the new primitive vocabulary is freshest.

Re-prime prompt (copy into a fresh Claude Code session):

```
Fresh session — re-priming for Phase 6 (Implementation) of the admin redesign recipe.
Page being redesigned in THIS session: booking-new

STEP 1 — READ THESE FILES IN ORDER. Do not skim.
1. PRODUCT.md (foundation file — register, voice, anti-references)
2. /redesign/RECIPE-PROGRESS.md
3. /redesign/SAFETY-NET.md (so you know the rollback path for the branch I chose in Phase 0a)
4. DESIGN.md (full, incl. ## Admin-Specific Patterns)
5. /redesign/briefs/booking-new-brief.md   ← the brief for THIS page only
6. /redesign/BASELINE-ISSUES.md
7. /redesign/IMAGES-NEEDED.md

STEP 2 — CONFIRM IN ONE MESSAGE:
- One sentence per file, telling me what's in it
- The exact register from PRODUCT.md (must read "product" for this admin recipe — flag if it doesn't)
- The page you're about to redesign + its file path (cross-checked between RECON.md mentions and the brief)
- The Feature Preservation Manifest items from the brief (every form, button, JS hook that must survive)
- Pre-existing console errors I should NOT chase (from BASELINE-ISSUES.md)
- The phase + page we're entering (should be Phase 6 for booking-new)

STEP 3 — STOP. Do not start /impeccable craft until I reply "primed — go".

CONFIRMATION CHALLENGE: after your one-sentence-per-file summary, quote the second sentence of the most-load-bearing file's most-load-bearing section verbatim (e.g. for the 5→6 re-prime, quote sentence 2 of the brief's "## 6. Key States" section; for any phase using PRODUCT.md, quote sentence 2 of "## Brand Personality"). If you can't quote it, you didn't actually re-read — re-read from disk now and try again. This guards against summarised cache.

If any file has been compacted or summarised in your context, re-read the original from disk.
```

---

## 3. [x] bookings — commit: 449f722

**Tier:** Tier 2 — KEY_TASK 1 (Create bookings)

**Why this position:** The triage queue every role enters daily; 10 view tabs, SavedViewTabs wire-up (fixes BASELINE-CRITIQUE Alex #1), and mobile filter collapse to AdminSheet. Grouped with booking-new and booking-detail while the booking domain is fresh.

Re-prime prompt (copy into a fresh Claude Code session):

```
Fresh session — re-priming for Phase 6 (Implementation) of the admin redesign recipe.
Page being redesigned in THIS session: bookings

STEP 1 — READ THESE FILES IN ORDER. Do not skim.
1. PRODUCT.md (foundation file — register, voice, anti-references)
2. /redesign/RECIPE-PROGRESS.md
3. /redesign/SAFETY-NET.md (so you know the rollback path for the branch I chose in Phase 0a)
4. DESIGN.md (full, incl. ## Admin-Specific Patterns)
5. /redesign/briefs/bookings-brief.md   ← the brief for THIS page only
6. /redesign/BASELINE-ISSUES.md
7. /redesign/IMAGES-NEEDED.md

STEP 2 — CONFIRM IN ONE MESSAGE:
- One sentence per file, telling me what's in it
- The exact register from PRODUCT.md (must read "product" for this admin recipe — flag if it doesn't)
- The page you're about to redesign + its file path (cross-checked between RECON.md mentions and the brief)
- The Feature Preservation Manifest items from the brief (every form, button, JS hook that must survive)
- Pre-existing console errors I should NOT chase (from BASELINE-ISSUES.md)
- The phase + page we're entering (should be Phase 6 for bookings)

STEP 3 — STOP. Do not start /impeccable craft until I reply "primed — go".

CONFIRMATION CHALLENGE: after your one-sentence-per-file summary, quote the second sentence of the most-load-bearing file's most-load-bearing section verbatim (e.g. for the 5→6 re-prime, quote sentence 2 of the brief's "## 6. Key States" section; for any phase using PRODUCT.md, quote sentence 2 of "## Brand Personality"). If you can't quote it, you didn't actually re-read — re-read from disk now and try again. This guards against summarised cache.

If any file has been compacted or summarised in your context, re-read the original from disk.
```

---

## 4. [x] booking-detail — commit: b415bb7

**Tier:** Tier 2 — KEY_TASK 1 (Create bookings)

**Why this position:** Single booking command centre; ConfirmActionModal wired for cancel (BASELINE-CRITIQUE P1 fix); activity timeline and email-delivery sections. Closes the booking-domain cluster before moving to clients.

Re-prime prompt (copy into a fresh Claude Code session):

```
Fresh session — re-priming for Phase 6 (Implementation) of the admin redesign recipe.
Page being redesigned in THIS session: booking-detail

STEP 1 — READ THESE FILES IN ORDER. Do not skim.
1. PRODUCT.md (foundation file — register, voice, anti-references)
2. /redesign/RECIPE-PROGRESS.md
3. /redesign/SAFETY-NET.md (so you know the rollback path for the branch I chose in Phase 0a)
4. DESIGN.md (full, incl. ## Admin-Specific Patterns)
5. /redesign/briefs/booking-detail-brief.md   ← the brief for THIS page only
6. /redesign/BASELINE-ISSUES.md
7. /redesign/IMAGES-NEEDED.md

STEP 2 — CONFIRM IN ONE MESSAGE:
- One sentence per file, telling me what's in it
- The exact register from PRODUCT.md (must read "product" for this admin recipe — flag if it doesn't)
- The page you're about to redesign + its file path (cross-checked between RECON.md mentions and the brief)
- The Feature Preservation Manifest items from the brief (every form, button, JS hook that must survive)
- Pre-existing console errors I should NOT chase (from BASELINE-ISSUES.md)
- The phase + page we're entering (should be Phase 6 for booking-detail)

STEP 3 — STOP. Do not start /impeccable craft until I reply "primed — go".

CONFIRMATION CHALLENGE: after your one-sentence-per-file summary, quote the second sentence of the most-load-bearing file's most-load-bearing section verbatim (e.g. for the 5→6 re-prime, quote sentence 2 of the brief's "## 6. Key States" section; for any phase using PRODUCT.md, quote sentence 2 of "## Brand Personality"). If you can't quote it, you didn't actually re-read — re-read from disk now and try again. This guards against summarised cache.

If any file has been compacted or summarised in your context, re-read the original from disk.
```

---

## 5. [ ] clients — commit: ____

**Tier:** Tier 2 — KEY_TASK 2 (Rebook existing clients)

**Why this position:** "Find them fast" is the rebook entry point per PRODUCT.md. List-row paradigm replaces card grid; fixes BASELINE-CRITIQUE Sam #3 (unlabelled location filter). Upstream of client-detail and booking-new `?clientId=` pre-fill.

Re-prime prompt (copy into a fresh Claude Code session):

```
Fresh session — re-priming for Phase 6 (Implementation) of the admin redesign recipe.
Page being redesigned in THIS session: clients

STEP 1 — READ THESE FILES IN ORDER. Do not skim.
1. PRODUCT.md (foundation file — register, voice, anti-references)
2. /redesign/RECIPE-PROGRESS.md
3. /redesign/SAFETY-NET.md (so you know the rollback path for the branch I chose in Phase 0a)
4. DESIGN.md (full, incl. ## Admin-Specific Patterns)
5. /redesign/briefs/clients-brief.md   ← the brief for THIS page only
6. /redesign/BASELINE-ISSUES.md
7. /redesign/IMAGES-NEEDED.md

STEP 2 — CONFIRM IN ONE MESSAGE:
- One sentence per file, telling me what's in it
- The exact register from PRODUCT.md (must read "product" for this admin recipe — flag if it doesn't)
- The page you're about to redesign + its file path (cross-checked between RECON.md mentions and the brief)
- The Feature Preservation Manifest items from the brief (every form, button, JS hook that must survive)
- Pre-existing console errors I should NOT chase (from BASELINE-ISSUES.md)
- The phase + page we're entering (should be Phase 6 for clients)

STEP 3 — STOP. Do not start /impeccable craft until I reply "primed — go".

CONFIRMATION CHALLENGE: after your one-sentence-per-file summary, quote the second sentence of the most-load-bearing file's most-load-bearing section verbatim (e.g. for the 5→6 re-prime, quote sentence 2 of the brief's "## 6. Key States" section; for any phase using PRODUCT.md, quote sentence 2 of "## Brand Personality"). If you can't quote it, you didn't actually re-read — re-read from disk now and try again. This guards against summarised cache.

If any file has been compacted or summarised in your context, re-read the original from disk.
```

---

## 6. [ ] client-detail — commit: ____

**Tier:** Tier 2 — KEY_TASK 2 (Rebook existing clients)

**Why this position:** Profile + booking history gives the pre-fill context for rebooking; adds the missing back-link to booking-detail (BASELINE-CRITIQUE fix). Worked immediately after clients while the CRM mental model is fresh.

Re-prime prompt (copy into a fresh Claude Code session):

```
Fresh session — re-priming for Phase 6 (Implementation) of the admin redesign recipe.
Page being redesigned in THIS session: client-detail

STEP 1 — READ THESE FILES IN ORDER. Do not skim.
1. PRODUCT.md (foundation file — register, voice, anti-references)
2. /redesign/RECIPE-PROGRESS.md
3. /redesign/SAFETY-NET.md (so you know the rollback path for the branch I chose in Phase 0a)
4. DESIGN.md (full, incl. ## Admin-Specific Patterns)
5. /redesign/briefs/client-detail-brief.md   ← the brief for THIS page only
6. /redesign/BASELINE-ISSUES.md
7. /redesign/IMAGES-NEEDED.md

STEP 2 — CONFIRM IN ONE MESSAGE:
- One sentence per file, telling me what's in it
- The exact register from PRODUCT.md (must read "product" for this admin recipe — flag if it doesn't)
- The page you're about to redesign + its file path (cross-checked between RECON.md mentions and the brief)
- The Feature Preservation Manifest items from the brief (every form, button, JS hook that must survive)
- Pre-existing console errors I should NOT chase (from BASELINE-ISSUES.md)
- The phase + page we're entering (should be Phase 6 for client-detail)

STEP 3 — STOP. Do not start /impeccable craft until I reply "primed — go".

CONFIRMATION CHALLENGE: after your one-sentence-per-file summary, quote the second sentence of the most-load-bearing file's most-load-bearing section verbatim (e.g. for the 5→6 re-prime, quote sentence 2 of the brief's "## 6. Key States" section; for any phase using PRODUCT.md, quote sentence 2 of "## Brand Personality"). If you can't quote it, you didn't actually re-read — re-read from disk now and try again. This guards against summarised cache.

If any file has been compacted or summarised in your context, re-read the original from disk.
```

---

## 7. [ ] client-new — commit: ____

**Tier:** Tier 2 — KEY_TASK 2 (Rebook existing clients)

**Why this position:** Create-client form closes the client cluster; smallest surface in the group. Three-panel layout with duplicate-warning promotion and DESIGN.md Input spec carry-through.

Re-prime prompt (copy into a fresh Claude Code session):

```
Fresh session — re-priming for Phase 6 (Implementation) of the admin redesign recipe.
Page being redesigned in THIS session: client-new

STEP 1 — READ THESE FILES IN ORDER. Do not skim.
1. PRODUCT.md (foundation file — register, voice, anti-references)
2. /redesign/RECIPE-PROGRESS.md
3. /redesign/SAFETY-NET.md (so you know the rollback path for the branch I chose in Phase 0a)
4. DESIGN.md (full, incl. ## Admin-Specific Patterns)
5. /redesign/briefs/client-new-brief.md   ← the brief for THIS page only
6. /redesign/BASELINE-ISSUES.md
7. /redesign/IMAGES-NEEDED.md

STEP 2 — CONFIRM IN ONE MESSAGE:
- One sentence per file, telling me what's in it
- The exact register from PRODUCT.md (must read "product" for this admin recipe — flag if it doesn't)
- The page you're about to redesign + its file path (cross-checked between RECON.md mentions and the brief)
- The Feature Preservation Manifest items from the brief (every form, button, JS hook that must survive)
- Pre-existing console errors I should NOT chase (from BASELINE-ISSUES.md)
- The phase + page we're entering (should be Phase 6 for client-new)

STEP 3 — STOP. Do not start /impeccable craft until I reply "primed — go".

CONFIRMATION CHALLENGE: after your one-sentence-per-file summary, quote the second sentence of the most-load-bearing file's most-load-bearing section verbatim (e.g. for the 5→6 re-prime, quote sentence 2 of the brief's "## 6. Key States" section; for any phase using PRODUCT.md, quote sentence 2 of "## Brand Personality"). If you can't quote it, you didn't actually re-read — re-read from disk now and try again. This guards against summarised cache.

If any file has been compacted or summarised in your context, re-read the original from disk.
```

---

## 8. [ ] dashboard-owner-admin — commit: ____

**Tier:** Tier 2 — KEY_TASK 3 (CRM / business metrics)

**Why this position:** Every Owner and Admin login lands here; the highest-visibility surface in the product. Two-tier disclosure resolves BASELINE-CRITIQUE P2 density; three absolute-ban `border-l-4` fixes here too. My call for highest-stakes page.

Re-prime prompt (copy into a fresh Claude Code session):

```
Fresh session — re-priming for Phase 6 (Implementation) of the admin redesign recipe.
Page being redesigned in THIS session: dashboard-owner-admin

STEP 1 — READ THESE FILES IN ORDER. Do not skim.
1. PRODUCT.md (foundation file — register, voice, anti-references)
2. /redesign/RECIPE-PROGRESS.md
3. /redesign/SAFETY-NET.md (so you know the rollback path for the branch I chose in Phase 0a)
4. DESIGN.md (full, incl. ## Admin-Specific Patterns)
5. /redesign/briefs/dashboard-owner-admin-brief.md   ← the brief for THIS page only
6. /redesign/BASELINE-ISSUES.md
7. /redesign/IMAGES-NEEDED.md

STEP 2 — CONFIRM IN ONE MESSAGE:
- One sentence per file, telling me what's in it
- The exact register from PRODUCT.md (must read "product" for this admin recipe — flag if it doesn't)
- The page you're about to redesign + its file path (cross-checked between RECON.md mentions and the brief)
- The Feature Preservation Manifest items from the brief (every form, button, JS hook that must survive)
- Pre-existing console errors I should NOT chase (from BASELINE-ISSUES.md)
- The phase + page we're entering (should be Phase 6 for dashboard-owner-admin)

STEP 3 — STOP. Do not start /impeccable craft until I reply "primed — go".

CONFIRMATION CHALLENGE: after your one-sentence-per-file summary, quote the second sentence of the most-load-bearing file's most-load-bearing section verbatim (e.g. for the 5→6 re-prime, quote sentence 2 of the brief's "## 6. Key States" section; for any phase using PRODUCT.md, quote sentence 2 of "## Brand Personality"). If you can't quote it, you didn't actually re-read — re-read from disk now and try again. This guards against summarised cache.

If any file has been compacted or summarised in your context, re-read the original from disk.
```

---

## 9. [ ] dashboard-coordinator — commit: ____

**Tier:** Tier 2 — KEY_TASK 3 (CRM / business metrics)

**Why this position:** Coordinator dashboard variant; shares chrome with owner-admin; unassigned-first sort and Active Enquiries tile are the coordinator's daily front door. Worked while dashboard domain is fresh.

Re-prime prompt (copy into a fresh Claude Code session):

```
Fresh session — re-priming for Phase 6 (Implementation) of the admin redesign recipe.
Page being redesigned in THIS session: dashboard-coordinator

STEP 1 — READ THESE FILES IN ORDER. Do not skim.
1. PRODUCT.md (foundation file — register, voice, anti-references)
2. /redesign/RECIPE-PROGRESS.md
3. /redesign/SAFETY-NET.md (so you know the rollback path for the branch I chose in Phase 0a)
4. DESIGN.md (full, incl. ## Admin-Specific Patterns)
5. /redesign/briefs/dashboard-coordinator-brief.md   ← the brief for THIS page only
6. /redesign/BASELINE-ISSUES.md
7. /redesign/IMAGES-NEEDED.md

STEP 2 — CONFIRM IN ONE MESSAGE:
- One sentence per file, telling me what's in it
- The exact register from PRODUCT.md (must read "product" for this admin recipe — flag if it doesn't)
- The page you're about to redesign + its file path (cross-checked between RECON.md mentions and the brief)
- The Feature Preservation Manifest items from the brief (every form, button, JS hook that must survive)
- Pre-existing console errors I should NOT chase (from BASELINE-ISSUES.md)
- The phase + page we're entering (should be Phase 6 for dashboard-coordinator)

STEP 3 — STOP. Do not start /impeccable craft until I reply "primed — go".

CONFIRMATION CHALLENGE: after your one-sentence-per-file summary, quote the second sentence of the most-load-bearing file's most-load-bearing section verbatim (e.g. for the 5→6 re-prime, quote sentence 2 of the brief's "## 6. Key States" section; for any phase using PRODUCT.md, quote sentence 2 of "## Brand Personality"). If you can't quote it, you didn't actually re-read — re-read from disk now and try again. This guards against summarised cache.

If any file has been compacted or summarised in your context, re-read the original from disk.
```

---

## 10. [ ] dashboard-therapist — commit: ____

**Tier:** Tier 2 — KEY_TASK 3 (CRM / business metrics)

**Why this position:** Mobile-first 375px worker variant; fixes BASELINE-CRITIQUE Casey #4 dashed-border empty state. Claimable horizontal-scroll strip and Next Visit hero panel are the therapist's primary daily tool.

Re-prime prompt (copy into a fresh Claude Code session):

```
Fresh session — re-priming for Phase 6 (Implementation) of the admin redesign recipe.
Page being redesigned in THIS session: dashboard-therapist

STEP 1 — READ THESE FILES IN ORDER. Do not skim.
1. PRODUCT.md (foundation file — register, voice, anti-references)
2. /redesign/RECIPE-PROGRESS.md
3. /redesign/SAFETY-NET.md (so you know the rollback path for the branch I chose in Phase 0a)
4. DESIGN.md (full, incl. ## Admin-Specific Patterns)
5. /redesign/briefs/dashboard-therapist-brief.md   ← the brief for THIS page only
6. /redesign/BASELINE-ISSUES.md
7. /redesign/IMAGES-NEEDED.md

STEP 2 — CONFIRM IN ONE MESSAGE:
- One sentence per file, telling me what's in it
- The exact register from PRODUCT.md (must read "product" for this admin recipe — flag if it doesn't)
- The page you're about to redesign + its file path (cross-checked between RECON.md mentions and the brief)
- The Feature Preservation Manifest items from the brief (every form, button, JS hook that must survive)
- Pre-existing console errors I should NOT chase (from BASELINE-ISSUES.md)
- The phase + page we're entering (should be Phase 6 for dashboard-therapist)

STEP 3 — STOP. Do not start /impeccable craft until I reply "primed — go".

CONFIRMATION CHALLENGE: after your one-sentence-per-file summary, quote the second sentence of the most-load-bearing file's most-load-bearing section verbatim (e.g. for the 5→6 re-prime, quote sentence 2 of the brief's "## 6. Key States" section; for any phase using PRODUCT.md, quote sentence 2 of "## Brand Personality"). If you can't quote it, you didn't actually re-read — re-read from disk now and try again. This guards against summarised cache.

If any file has been compacted or summarised in your context, re-read the original from disk.
```

---

## 11. [x] reports — commit: 92047e8

**Tier:** Tier 2 — KEY_TASK 3 (CRM / business metrics)

**Why this position:** Dedicated CRM metrics surface; fixes BASELINE-CRITIQUE P1 Recharts `minHeight: 288`; three question-sections replace chart-grid-then-list order. All 6 GET params and 8 export keys preserved verbatim.

Re-prime prompt (copy into a fresh Claude Code session):

```
Fresh session — re-priming for Phase 6 (Implementation) of the admin redesign recipe.
Page being redesigned in THIS session: reports

STEP 1 — READ THESE FILES IN ORDER. Do not skim.
1. PRODUCT.md (foundation file — register, voice, anti-references)
2. /redesign/RECIPE-PROGRESS.md
3. /redesign/SAFETY-NET.md (so you know the rollback path for the branch I chose in Phase 0a)
4. DESIGN.md (full, incl. ## Admin-Specific Patterns)
5. /redesign/briefs/reports-brief.md   ← the brief for THIS page only
6. /redesign/BASELINE-ISSUES.md
7. /redesign/IMAGES-NEEDED.md

STEP 2 — CONFIRM IN ONE MESSAGE:
- One sentence per file, telling me what's in it
- The exact register from PRODUCT.md (must read "product" for this admin recipe — flag if it doesn't)
- The page you're about to redesign + its file path (cross-checked between RECON.md mentions and the brief)
- The Feature Preservation Manifest items from the brief (every form, button, JS hook that must survive)
- Pre-existing console errors I should NOT chase (from BASELINE-ISSUES.md)
- The phase + page we're entering (should be Phase 6 for reports)

STEP 3 — STOP. Do not start /impeccable craft until I reply "primed — go".

CONFIRMATION CHALLENGE: after your one-sentence-per-file summary, quote the second sentence of the most-load-bearing file's most-load-bearing section verbatim (e.g. for the 5→6 re-prime, quote sentence 2 of the brief's "## 6. Key States" section; for any phase using PRODUCT.md, quote sentence 2 of "## Brand Personality"). If you can't quote it, you didn't actually re-read — re-read from disk now and try again. This guards against summarised cache.

If any file has been compacted or summarised in your context, re-read the original from disk.
```

---

## 12. [ ] account-password-requests — commit: ____

**Tier:** Tier 3 — BASELINE-CRITIQUE: orphaned `account_password_requests` table (1 pending row in production, zero UI)

**Why this position:** Greenfield admin review queue that closes an active schema gap; ConfirmActionModal wired for approve/reject (first hard wire-up of the modal). Alphabetically first in Tier 3.

Re-prime prompt (copy into a fresh Claude Code session):

```
Fresh session — re-priming for Phase 6 (Implementation) of the admin redesign recipe.
Page being redesigned in THIS session: account-password-requests

STEP 1 — READ THESE FILES IN ORDER. Do not skim.
1. PRODUCT.md (foundation file — register, voice, anti-references)
2. /redesign/RECIPE-PROGRESS.md
3. /redesign/SAFETY-NET.md (so you know the rollback path for the branch I chose in Phase 0a)
4. DESIGN.md (full, incl. ## Admin-Specific Patterns)
5. /redesign/briefs/account-password-requests-brief.md   ← the brief for THIS page only
6. /redesign/BASELINE-ISSUES.md
7. /redesign/IMAGES-NEEDED.md

STEP 2 — CONFIRM IN ONE MESSAGE:
- One sentence per file, telling me what's in it
- The exact register from PRODUCT.md (must read "product" for this admin recipe — flag if it doesn't)
- The page you're about to redesign + its file path (cross-checked between RECON.md mentions and the brief)
- The Feature Preservation Manifest items from the brief (every form, button, JS hook that must survive)
- Pre-existing console errors I should NOT chase (from BASELINE-ISSUES.md)
- The phase + page we're entering (should be Phase 6 for account-password-requests)

STEP 3 — STOP. Do not start /impeccable craft until I reply "primed — go".

CONFIRMATION CHALLENGE: after your one-sentence-per-file summary, quote the second sentence of the most-load-bearing file's most-load-bearing section verbatim (e.g. for the 5→6 re-prime, quote sentence 2 of the brief's "## 6. Key States" section; for any phase using PRODUCT.md, quote sentence 2 of "## Brand Personality"). If you can't quote it, you didn't actually re-read — re-read from disk now and try again. This guards against summarised cache.

If any file has been compacted or summarised in your context, re-read the original from disk.
```

---

## 13. [x] availability — commit: 34b4422

**Tier:** Tier 3 — BASELINE-CRITIQUE Sam #1: H1→H3 heading skip confirmed on /admin/availability

**Why this position:** Three-manager redesign (rules/blocked/overrides); heading hierarchy fix is a WCAG AA blocker. Coordinator and Therapist denied states must strip raw permission names per DESIGN.md.

Re-prime prompt (copy into a fresh Claude Code session):

```
Fresh session — re-priming for Phase 6 (Implementation) of the admin redesign recipe.
Page being redesigned in THIS session: availability

STEP 1 — READ THESE FILES IN ORDER. Do not skim.
1. PRODUCT.md (foundation file — register, voice, anti-references)
2. /redesign/RECIPE-PROGRESS.md
3. /redesign/SAFETY-NET.md (so you know the rollback path for the branch I chose in Phase 0a)
4. DESIGN.md (full, incl. ## Admin-Specific Patterns)
5. /redesign/briefs/availability-brief.md   ← the brief for THIS page only
6. /redesign/BASELINE-ISSUES.md
7. /redesign/IMAGES-NEEDED.md

STEP 2 — CONFIRM IN ONE MESSAGE:
- One sentence per file, telling me what's in it
- The exact register from PRODUCT.md (must read "product" for this admin recipe — flag if it doesn't)
- The page you're about to redesign + its file path (cross-checked between RECON.md mentions and the brief)
- The Feature Preservation Manifest items from the brief (every form, button, JS hook that must survive)
- Pre-existing console errors I should NOT chase (from BASELINE-ISSUES.md)
- The phase + page we're entering (should be Phase 6 for availability)

STEP 3 — STOP. Do not start /impeccable craft until I reply "primed — go".

CONFIRMATION CHALLENGE: after your one-sentence-per-file summary, quote the second sentence of the most-load-bearing file's most-load-bearing section verbatim (e.g. for the 5→6 re-prime, quote sentence 2 of the brief's "## 6. Key States" section; for any phase using PRODUCT.md, quote sentence 2 of "## Brand Personality"). If you can't quote it, you didn't actually re-read — re-read from disk now and try again. This guards against summarised cache.

If any file has been compacted or summarised in your context, re-read the original from disk.
```

---

## 14. [x] calendar — commit: b0ee32e

**Tier:** Tier 3 — daily visual ops tool; PrintButton + @media print patterns; concurrent-booking Attention chip

**Why this position:** Used daily by all roles to visualise the schedule; PrintButton is a live feature (RECON Â§2) that must survive; concurrent-booking detection is net-new but operationally critical. High usage frequency warrants early attention.

Re-prime prompt (copy into a fresh Claude Code session):

```
Fresh session — re-priming for Phase 6 (Implementation) of the admin redesign recipe.
Page being redesigned in THIS session: calendar

STEP 1 — READ THESE FILES IN ORDER. Do not skim.
1. PRODUCT.md (foundation file — register, voice, anti-references)
2. /redesign/RECIPE-PROGRESS.md
3. /redesign/SAFETY-NET.md (so you know the rollback path for the branch I chose in Phase 0a)
4. DESIGN.md (full, incl. ## Admin-Specific Patterns)
5. /redesign/briefs/calendar-brief.md   ← the brief for THIS page only
6. /redesign/BASELINE-ISSUES.md
7. /redesign/IMAGES-NEEDED.md

STEP 2 — CONFIRM IN ONE MESSAGE:
- One sentence per file, telling me what's in it
- The exact register from PRODUCT.md (must read "product" for this admin recipe — flag if it doesn't)
- The page you're about to redesign + its file path (cross-checked between RECON.md mentions and the brief)
- The Feature Preservation Manifest items from the brief (every form, button, JS hook that must survive)
- Pre-existing console errors I should NOT chase (from BASELINE-ISSUES.md)
- The phase + page we're entering (should be Phase 6 for calendar)

STEP 3 — STOP. Do not start /impeccable craft until I reply "primed — go".

CONFIRMATION CHALLENGE: after your one-sentence-per-file summary, quote the second sentence of the most-load-bearing file's most-load-bearing section verbatim (e.g. for the 5→6 re-prime, quote sentence 2 of the brief's "## 6. Key States" section; for any phase using PRODUCT.md, quote sentence 2 of "## Brand Personality"). If you can't quote it, you didn't actually re-read — re-read from disk now and try again. This guards against summarised cache.

If any file has been compacted or summarised in your context, re-read the original from disk.
```

---

## 15. [x] login — commit: 7e7e930

**Tier:** Tier 3 — pre-auth entry gate; brand wordmark gap (IMAGES-NEEDED); `?reason=inactive` voice fix

**Why this position:** The door every session opens; brief resolves the missing brand wordmark on the login page (currently an inline SVG glyph, not the real logo). Worked before password-reset since login precedes the reset flow in the user journey.

Re-prime prompt (copy into a fresh Claude Code session):

```
Fresh session — re-priming for Phase 6 (Implementation) of the admin redesign recipe.
Page being redesigned in THIS session: login

STEP 1 — READ THESE FILES IN ORDER. Do not skim.
1. PRODUCT.md (foundation file — register, voice, anti-references)
2. /redesign/RECIPE-PROGRESS.md
3. /redesign/SAFETY-NET.md (so you know the rollback path for the branch I chose in Phase 0a)
4. DESIGN.md (full, incl. ## Admin-Specific Patterns)
5. /redesign/briefs/login-brief.md   ← the brief for THIS page only
6. /redesign/BASELINE-ISSUES.md
7. /redesign/IMAGES-NEEDED.md

STEP 2 — CONFIRM IN ONE MESSAGE:
- One sentence per file, telling me what's in it
- The exact register from PRODUCT.md (must read "product" for this admin recipe — flag if it doesn't)
- The page you're about to redesign + its file path (cross-checked between RECON.md mentions and the brief)
- The Feature Preservation Manifest items from the brief (every form, button, JS hook that must survive)
- Pre-existing console errors I should NOT chase (from BASELINE-ISSUES.md)
- The phase + page we're entering (should be Phase 6 for login)

STEP 3 — STOP. Do not start /impeccable craft until I reply "primed — go".

CONFIRMATION CHALLENGE: after your one-sentence-per-file summary, quote the second sentence of the most-load-bearing file's most-load-bearing section verbatim (e.g. for the 5→6 re-prime, quote sentence 2 of the brief's "## 6. Key States" section; for any phase using PRODUCT.md, quote sentence 2 of "## Brand Personality"). If you can't quote it, you didn't actually re-read — re-read from disk now and try again. This guards against summarised cache.

If any file has been compacted or summarised in your context, re-read the original from disk.
```

---

## 16. [ ] password-reset — commit: ____

**Tier:** Tier 3 — greenfield pre-auth; closes `account_password_requests` schema gap (staff-facing side)

**Why this position:** Six-state flow across two routes; paired with account-password-requests (row 12) which handles the admin-facing side. Greenfield — no existing files to break, but must integrate with the `account_password_requests` table already in production.

Re-prime prompt (copy into a fresh Claude Code session):

```
Fresh session — re-priming for Phase 6 (Implementation) of the admin redesign recipe.
Page being redesigned in THIS session: password-reset

STEP 1 — READ THESE FILES IN ORDER. Do not skim.
1. PRODUCT.md (foundation file — register, voice, anti-references)
2. /redesign/RECIPE-PROGRESS.md
3. /redesign/SAFETY-NET.md (so you know the rollback path for the branch I chose in Phase 0a)
4. DESIGN.md (full, incl. ## Admin-Specific Patterns)
5. /redesign/briefs/password-reset-brief.md   ← the brief for THIS page only
6. /redesign/BASELINE-ISSUES.md
7. /redesign/IMAGES-NEEDED.md

STEP 2 — CONFIRM IN ONE MESSAGE:
- One sentence per file, telling me what's in it
- The exact register from PRODUCT.md (must read "product" for this admin recipe — flag if it doesn't)
- The page you're about to redesign + its file path (cross-checked between RECON.md mentions and the brief)
- The Feature Preservation Manifest items from the brief (every form, button, JS hook that must survive)
- Pre-existing console errors I should NOT chase (from BASELINE-ISSUES.md)
- The phase + page we're entering (should be Phase 6 for password-reset)

STEP 3 — STOP. Do not start /impeccable craft until I reply "primed — go".

CONFIRMATION CHALLENGE: after your one-sentence-per-file summary, quote the second sentence of the most-load-bearing file's most-load-bearing section verbatim (e.g. for the 5→6 re-prime, quote sentence 2 of the brief's "## 6. Key States" section; for any phase using PRODUCT.md, quote sentence 2 of "## Brand Personality"). If you can't quote it, you didn't actually re-read — re-read from disk now and try again. This guards against summarised cache.

If any file has been compacted or summarised in your context, re-read the original from disk.
```

---

## 17. [x] settings — commit: 9102e8e

**Tier:** Tier 3 — BASELINE-CRITIQUE Sam #1: H1→H3 heading skip confirmed on /admin/settings; Fatimah #2 "Bookings off" voice fix

**Why this position:** Owner-only policy workstation; heading hierarchy fix is a WCAG AA blocker; intake Switch + ConfirmActionModal wires the destructive "Pause intake" flow. All 9 field names preserved verbatim.

Re-prime prompt (copy into a fresh Claude Code session):

```
Fresh session — re-priming for Phase 6 (Implementation) of the admin redesign recipe.
Page being redesigned in THIS session: settings

STEP 1 — READ THESE FILES IN ORDER. Do not skim.
1. PRODUCT.md (foundation file — register, voice, anti-references)
2. /redesign/RECIPE-PROGRESS.md
3. /redesign/SAFETY-NET.md (so you know the rollback path for the branch I chose in Phase 0a)
4. DESIGN.md (full, incl. ## Admin-Specific Patterns)
5. /redesign/briefs/settings-brief.md   ← the brief for THIS page only
6. /redesign/BASELINE-ISSUES.md
7. /redesign/IMAGES-NEEDED.md

STEP 2 — CONFIRM IN ONE MESSAGE:
- One sentence per file, telling me what's in it
- The exact register from PRODUCT.md (must read "product" for this admin recipe — flag if it doesn't)
- The page you're about to redesign + its file path (cross-checked between RECON.md mentions and the brief)
- The Feature Preservation Manifest items from the brief (every form, button, JS hook that must survive)
- Pre-existing console errors I should NOT chase (from BASELINE-ISSUES.md)
- The phase + page we're entering (should be Phase 6 for settings)

STEP 3 — STOP. Do not start /impeccable craft until I reply "primed — go".

CONFIRMATION CHALLENGE: after your one-sentence-per-file summary, quote the second sentence of the most-load-bearing file's most-load-bearing section verbatim (e.g. for the 5→6 re-prime, quote sentence 2 of the brief's "## 6. Key States" section; for any phase using PRODUCT.md, quote sentence 2 of "## Brand Personality"). If you can't quote it, you didn't actually re-read — re-read from disk now and try again. This guards against summarised cache.

If any file has been compacted or summarised in your context, re-read the original from disk.
```

---

## 18. [ ] staff — commit: ____

**Tier:** Tier 3 — BASELINE-CRITIQUE Sam #1: H1→H3 heading skip confirmed on /admin/staff

**Why this position:** Team directory replaces 3-col identical card grid with AdminEntityRow rows; heading hierarchy fix is a WCAG AA blocker; four-scope `getStaffTeamAccess` routing preserved verbatim (blast radius: every role sees this page).

Re-prime prompt (copy into a fresh Claude Code session):

```
Fresh session — re-priming for Phase 6 (Implementation) of the admin redesign recipe.
Page being redesigned in THIS session: staff

STEP 1 — READ THESE FILES IN ORDER. Do not skim.
1. PRODUCT.md (foundation file — register, voice, anti-references)
2. /redesign/RECIPE-PROGRESS.md
3. /redesign/SAFETY-NET.md (so you know the rollback path for the branch I chose in Phase 0a)
4. DESIGN.md (full, incl. ## Admin-Specific Patterns)
5. /redesign/briefs/staff-brief.md   ← the brief for THIS page only
6. /redesign/BASELINE-ISSUES.md
7. /redesign/IMAGES-NEEDED.md

STEP 2 — CONFIRM IN ONE MESSAGE:
- One sentence per file, telling me what's in it
- The exact register from PRODUCT.md (must read "product" for this admin recipe — flag if it doesn't)
- The page you're about to redesign + its file path (cross-checked between RECON.md mentions and the brief)
- The Feature Preservation Manifest items from the brief (every form, button, JS hook that must survive)
- Pre-existing console errors I should NOT chase (from BASELINE-ISSUES.md)
- The phase + page we're entering (should be Phase 6 for staff)

STEP 3 — STOP. Do not start /impeccable craft until I reply "primed — go".

CONFIRMATION CHALLENGE: after your one-sentence-per-file summary, quote the second sentence of the most-load-bearing file's most-load-bearing section verbatim (e.g. for the 5→6 re-prime, quote sentence 2 of the brief's "## 6. Key States" section; for any phase using PRODUCT.md, quote sentence 2 of "## Brand Personality"). If you can't quote it, you didn't actually re-read — re-read from disk now and try again. This guards against summarised cache.

If any file has been compacted or summarised in your context, re-read the original from disk.
```

---

## 19. [ ] staff-detail — commit: ____

**Tier:** Tier 3 — BASELINE-CRITIQUE Sam #1: mixed H2/H3 order confirmed on /admin/staff/[id]

**Why this position:** Two-column command centre with a 7-cell (role Ã— viewing-context) matrix; heading hierarchy fix is a WCAG AA blocker; permission-overrides editor inherits Brief 22's risk-tier confirm matrix. Worked while staff domain is fresh (follows staff row 18).

Re-prime prompt (copy into a fresh Claude Code session):

```
Fresh session — re-priming for Phase 6 (Implementation) of the admin redesign recipe.
Page being redesigned in THIS session: staff-detail

STEP 1 — READ THESE FILES IN ORDER. Do not skim.
1. PRODUCT.md (foundation file — register, voice, anti-references)
2. /redesign/RECIPE-PROGRESS.md
3. /redesign/SAFETY-NET.md (so you know the rollback path for the branch I chose in Phase 0a)
4. DESIGN.md (full, incl. ## Admin-Specific Patterns)
5. /redesign/briefs/staff-detail-brief.md   ← the brief for THIS page only
6. /redesign/BASELINE-ISSUES.md
7. /redesign/IMAGES-NEEDED.md

STEP 2 — CONFIRM IN ONE MESSAGE:
- One sentence per file, telling me what's in it
- The exact register from PRODUCT.md (must read "product" for this admin recipe — flag if it doesn't)
- The page you're about to redesign + its file path (cross-checked between RECON.md mentions and the brief)
- The Feature Preservation Manifest items from the brief (every form, button, JS hook that must survive)
- Pre-existing console errors I should NOT chase (from BASELINE-ISSUES.md)
- The phase + page we're entering (should be Phase 6 for staff-detail)

STEP 3 — STOP. Do not start /impeccable craft until I reply "primed — go".

CONFIRMATION CHALLENGE: after your one-sentence-per-file summary, quote the second sentence of the most-load-bearing file's most-load-bearing section verbatim (e.g. for the 5→6 re-prime, quote sentence 2 of the brief's "## 6. Key States" section; for any phase using PRODUCT.md, quote sentence 2 of "## Brand Personality"). If you can't quote it, you didn't actually re-read — re-read from disk now and try again. This guards against summarised cache.

If any file has been compacted or summarised in your context, re-read the original from disk.
```

---

## 20. [x] audit — commit: 3c69da8

**Tier:** Tier 4 — remaining pages, alphabetical

**Why this position:** Owner-only read-only forensic timeline; no mutations to preserve beyond filter GET params. Alphabetically first in Tier 4.

Re-prime prompt (copy into a fresh Claude Code session):

```
Fresh session — re-priming for Phase 6 (Implementation) of the admin redesign recipe.
Page being redesigned in THIS session: audit

STEP 1 — READ THESE FILES IN ORDER. Do not skim.
1. PRODUCT.md (foundation file — register, voice, anti-references)
2. /redesign/RECIPE-PROGRESS.md
3. /redesign/SAFETY-NET.md (so you know the rollback path for the branch I chose in Phase 0a)
4. DESIGN.md (full, incl. ## Admin-Specific Patterns)
5. /redesign/briefs/audit-brief.md   ← the brief for THIS page only
6. /redesign/BASELINE-ISSUES.md
7. /redesign/IMAGES-NEEDED.md

STEP 2 — CONFIRM IN ONE MESSAGE:
- One sentence per file, telling me what's in it
- The exact register from PRODUCT.md (must read "product" for this admin recipe — flag if it doesn't)
- The page you're about to redesign + its file path (cross-checked between RECON.md mentions and the brief)
- The Feature Preservation Manifest items from the brief (every form, button, JS hook that must survive)
- Pre-existing console errors I should NOT chase (from BASELINE-ISSUES.md)
- The phase + page we're entering (should be Phase 6 for audit)

STEP 3 — STOP. Do not start /impeccable craft until I reply "primed — go".

CONFIRMATION CHALLENGE: after your one-sentence-per-file summary, quote the second sentence of the most-load-bearing file's most-load-bearing section verbatim (e.g. for the 5→6 re-prime, quote sentence 2 of the brief's "## 6. Key States" section; for any phase using PRODUCT.md, quote sentence 2 of "## Brand Personality"). If you can't quote it, you didn't actually re-read — re-read from disk now and try again. This guards against summarised cache.

If any file has been compacted or summarised in your context, re-read the original from disk.
```

---

## 21. [ ] email-templates — commit: ____

**Tier:** Tier 4 — remaining pages, alphabetical

**Why this position:** Tabbed extension of /admin/emails sharing the same route; 9 template mappings from `src/lib/email/templates.ts`. Worked immediately before emails (row 22) since they share the `/admin/emails` parent route.

> **⚠ Session-ordering footnote (added 2026-05-15):** Despite the alphabetical position above, the `emails` session (row 22) must run **FIRST**, then `email-templates` (this row). The `emails` brief Recipe Context explicitly states *"Phase 6 implementation order: this brief first (shell), Brief 02 second (Templates content drops into the prepared slot)"* — `emails` owns the tab shell + Delivery + Reminders bodies + a Templates-tab stub; `email-templates` does a scoped swap-in to replace the stub with the real Templates tab component. Running this row first would force `emails` to either rebuild or merge-around the structures established here. See `redesign/per-page-recipes/email-templates-recipe.md` Hard rule #8 and `redesign/per-page-recipes/emails-recipe.md` Step 4 framing for the coordination contract.

Re-prime prompt (copy into a fresh Claude Code session):

```
Fresh session — re-priming for Phase 6 (Implementation) of the admin redesign recipe.
Page being redesigned in THIS session: email-templates

STEP 1 — READ THESE FILES IN ORDER. Do not skim.
1. PRODUCT.md (foundation file — register, voice, anti-references)
2. /redesign/RECIPE-PROGRESS.md
3. /redesign/SAFETY-NET.md (so you know the rollback path for the branch I chose in Phase 0a)
4. DESIGN.md (full, incl. ## Admin-Specific Patterns)
5. /redesign/briefs/email-templates-brief.md   ← the brief for THIS page only
6. /redesign/BASELINE-ISSUES.md
7. /redesign/IMAGES-NEEDED.md

STEP 2 — CONFIRM IN ONE MESSAGE:
- One sentence per file, telling me what's in it
- The exact register from PRODUCT.md (must read "product" for this admin recipe — flag if it doesn't)
- The page you're about to redesign + its file path (cross-checked between RECON.md mentions and the brief)
- The Feature Preservation Manifest items from the brief (every form, button, JS hook that must survive)
- Pre-existing console errors I should NOT chase (from BASELINE-ISSUES.md)
- The phase + page we're entering (should be Phase 6 for email-templates)

STEP 3 — STOP. Do not start /impeccable craft until I reply "primed — go".

CONFIRMATION CHALLENGE: after your one-sentence-per-file summary, quote the second sentence of the most-load-bearing file's most-load-bearing section verbatim (e.g. for the 5→6 re-prime, quote sentence 2 of the brief's "## 6. Key States" section; for any phase using PRODUCT.md, quote sentence 2 of "## Brand Personality"). If you can't quote it, you didn't actually re-read — re-read from disk now and try again. This guards against summarised cache.

If any file has been compacted or summarised in your context, re-read the original from disk.
```

---

## 22. [ ] emails — commit: ____

**Tier:** Tier 4 — remaining pages, alphabetical

**Why this position:** 3-tab hub (Delivery / Reminders / Templates); `sendManualBookingReminder` server action and `booking_id` hidden input preserved verbatim. Worked immediately after email-templates (row 21) since they share the same parent route.

Re-prime prompt (copy into a fresh Claude Code session):

```
Fresh session — re-priming for Phase 6 (Implementation) of the admin redesign recipe.
Page being redesigned in THIS session: emails

STEP 1 — READ THESE FILES IN ORDER. Do not skim.
1. PRODUCT.md (foundation file — register, voice, anti-references)
2. /redesign/RECIPE-PROGRESS.md
3. /redesign/SAFETY-NET.md (so you know the rollback path for the branch I chose in Phase 0a)
4. DESIGN.md (full, incl. ## Admin-Specific Patterns)
5. /redesign/briefs/emails-brief.md   ← the brief for THIS page only
6. /redesign/BASELINE-ISSUES.md
7. /redesign/IMAGES-NEEDED.md

STEP 2 — CONFIRM IN ONE MESSAGE:
- One sentence per file, telling me what's in it
- The exact register from PRODUCT.md (must read "product" for this admin recipe — flag if it doesn't)
- The page you're about to redesign + its file path (cross-checked between RECON.md mentions and the brief)
- The Feature Preservation Manifest items from the brief (every form, button, JS hook that must survive)
- Pre-existing console errors I should NOT chase (from BASELINE-ISSUES.md)
- The phase + page we're entering (should be Phase 6 for emails)

STEP 3 — STOP. Do not start /impeccable craft until I reply "primed — go".

CONFIRMATION CHALLENGE: after your one-sentence-per-file summary, quote the second sentence of the most-load-bearing file's most-load-bearing section verbatim (e.g. for the 5→6 re-prime, quote sentence 2 of the brief's "## 6. Key States" section; for any phase using PRODUCT.md, quote sentence 2 of "## Brand Personality"). If you can't quote it, you didn't actually re-read — re-read from disk now and try again. This guards against summarised cache.

If any file has been compacted or summarised in your context, re-read the original from disk.
```

---

## 23. [x] enquiries — commit: 1ebc18f

**Tier:** Tier 4 — remaining pages, alphabetical

**Why this position:** Lead pipeline; Coordinator's primary tool; "Convert →" Ghost deep-links to `/admin/bookings/new?enquiryId=` (ties back to booking-new row 2). Two-column layout with always-visible record-enquiry sidebar.

Re-prime prompt (copy into a fresh Claude Code session):

```
Fresh session — re-priming for Phase 6 (Implementation) of the admin redesign recipe.
Page being redesigned in THIS session: enquiries

STEP 1 — READ THESE FILES IN ORDER. Do not skim.
1. PRODUCT.md (foundation file — register, voice, anti-references)
2. /redesign/RECIPE-PROGRESS.md
3. /redesign/SAFETY-NET.md (so you know the rollback path for the branch I chose in Phase 0a)
4. DESIGN.md (full, incl. ## Admin-Specific Patterns)
5. /redesign/briefs/enquiries-brief.md   ← the brief for THIS page only
6. /redesign/BASELINE-ISSUES.md
7. /redesign/IMAGES-NEEDED.md

STEP 2 — CONFIRM IN ONE MESSAGE:
- One sentence per file, telling me what's in it
- The exact register from PRODUCT.md (must read "product" for this admin recipe — flag if it doesn't)
- The page you're about to redesign + its file path (cross-checked between RECON.md mentions and the brief)
- The Feature Preservation Manifest items from the brief (every form, button, JS hook that must survive)
- Pre-existing console errors I should NOT chase (from BASELINE-ISSUES.md)
- The phase + page we're entering (should be Phase 6 for enquiries)

STEP 3 — STOP. Do not start /impeccable craft until I reply "primed — go".

CONFIRMATION CHALLENGE: after your one-sentence-per-file summary, quote the second sentence of the most-load-bearing file's most-load-bearing section verbatim (e.g. for the 5→6 re-prime, quote sentence 2 of the brief's "## 6. Key States" section; for any phase using PRODUCT.md, quote sentence 2 of "## Brand Personality"). If you can't quote it, you didn't actually re-read — re-read from disk now and try again. This guards against summarised cache.

If any file has been compacted or summarised in your context, re-read the original from disk.
```

---

## 24. [x] operations — commit: 2a8b804

**Tier:** Tier 4 — remaining pages, alphabetical

**Why this position:** Production support events triage; three-column status board; bulk "Resolve all" wired through ConfirmActionModal. Owner/Admin only; low blast radius.

Re-prime prompt (copy into a fresh Claude Code session):

```
Fresh session — re-priming for Phase 6 (Implementation) of the admin redesign recipe.
Page being redesigned in THIS session: operations

STEP 1 — READ THESE FILES IN ORDER. Do not skim.
1. PRODUCT.md (foundation file — register, voice, anti-references)
2. /redesign/RECIPE-PROGRESS.md
3. /redesign/SAFETY-NET.md (so you know the rollback path for the branch I chose in Phase 0a)
4. DESIGN.md (full, incl. ## Admin-Specific Patterns)
5. /redesign/briefs/operations-brief.md   ← the brief for THIS page only
6. /redesign/BASELINE-ISSUES.md
7. /redesign/IMAGES-NEEDED.md

STEP 2 — CONFIRM IN ONE MESSAGE:
- One sentence per file, telling me what's in it
- The exact register from PRODUCT.md (must read "product" for this admin recipe — flag if it doesn't)
- The page you're about to redesign + its file path (cross-checked between RECON.md mentions and the brief)
- The Feature Preservation Manifest items from the brief (every form, button, JS hook that must survive)
- Pre-existing console errors I should NOT chase (from BASELINE-ISSUES.md)
- The phase + page we're entering (should be Phase 6 for operations)

STEP 3 — STOP. Do not start /impeccable craft until I reply "primed — go".

CONFIRMATION CHALLENGE: after your one-sentence-per-file summary, quote the second sentence of the most-load-bearing file's most-load-bearing section verbatim (e.g. for the 5→6 re-prime, quote sentence 2 of the brief's "## 6. Key States" section; for any phase using PRODUCT.md, quote sentence 2 of "## Brand Personality"). If you can't quote it, you didn't actually re-read — re-read from disk now and try again. This guards against summarised cache.

If any file has been compacted or summarised in your context, re-read the original from disk.
```

---

## 25. [ ] privacy — commit: ____

**Tier:** Tier 4 — remaining pages, alphabetical

**Why this position:** GDPR/UK-DPA workstation; ConfirmActionModal on Completed/Declined transitions (legal-posture copy); sensitive-note review rail. Existing `PrivacyStatusForm` field contract preserved verbatim.

Re-prime prompt (copy into a fresh Claude Code session):

```
Fresh session — re-priming for Phase 6 (Implementation) of the admin redesign recipe.
Page being redesigned in THIS session: privacy

STEP 1 — READ THESE FILES IN ORDER. Do not skim.
1. PRODUCT.md (foundation file — register, voice, anti-references)
2. /redesign/RECIPE-PROGRESS.md
3. /redesign/SAFETY-NET.md (so you know the rollback path for the branch I chose in Phase 0a)
4. DESIGN.md (full, incl. ## Admin-Specific Patterns)
5. /redesign/briefs/privacy-brief.md   ← the brief for THIS page only
6. /redesign/BASELINE-ISSUES.md
7. /redesign/IMAGES-NEEDED.md

STEP 2 — CONFIRM IN ONE MESSAGE:
- One sentence per file, telling me what's in it
- The exact register from PRODUCT.md (must read "product" for this admin recipe — flag if it doesn't)
- The page you're about to redesign + its file path (cross-checked between RECON.md mentions and the brief)
- The Feature Preservation Manifest items from the brief (every form, button, JS hook that must survive)
- Pre-existing console errors I should NOT chase (from BASELINE-ISSUES.md)
- The phase + page we're entering (should be Phase 6 for privacy)

STEP 3 — STOP. Do not start /impeccable craft until I reply "primed — go".

CONFIRMATION CHALLENGE: after your one-sentence-per-file summary, quote the second sentence of the most-load-bearing file's most-load-bearing section verbatim (e.g. for the 5→6 re-prime, quote sentence 2 of the brief's "## 6. Key States" section; for any phase using PRODUCT.md, quote sentence 2 of "## Brand Personality"). If you can't quote it, you didn't actually re-read — re-read from disk now and try again. This guards against summarised cache.

If any file has been compacted or summarised in your context, re-read the original from disk.
```

---

## 26. [ ] role-detail — commit: ____

**Tier:** Tier 4 — remaining pages, alphabetical

**Why this position:** Owner-only single-role workstation; risk-tier confirm matrix (critical/high/medium/low); `deleteRole` server action flagged for backend confirmation. Worked before roles (row 27) since detail is the more complex surface in the branch.

Re-prime prompt (copy into a fresh Claude Code session):

```
Fresh session — re-priming for Phase 6 (Implementation) of the admin redesign recipe.
Page being redesigned in THIS session: role-detail

STEP 1 — READ THESE FILES IN ORDER. Do not skim.
1. PRODUCT.md (foundation file — register, voice, anti-references)
2. /redesign/RECIPE-PROGRESS.md
3. /redesign/SAFETY-NET.md (so you know the rollback path for the branch I chose in Phase 0a)
4. DESIGN.md (full, incl. ## Admin-Specific Patterns)
5. /redesign/briefs/role-detail-brief.md   ← the brief for THIS page only
6. /redesign/BASELINE-ISSUES.md
7. /redesign/IMAGES-NEEDED.md

STEP 2 — CONFIRM IN ONE MESSAGE:
- One sentence per file, telling me what's in it
- The exact register from PRODUCT.md (must read "product" for this admin recipe — flag if it doesn't)
- The page you're about to redesign + its file path (cross-checked between RECON.md mentions and the brief)
- The Feature Preservation Manifest items from the brief (every form, button, JS hook that must survive)
- Pre-existing console errors I should NOT chase (from BASELINE-ISSUES.md)
- The phase + page we're entering (should be Phase 6 for role-detail)

STEP 3 — STOP. Do not start /impeccable craft until I reply "primed — go".

CONFIRMATION CHALLENGE: after your one-sentence-per-file summary, quote the second sentence of the most-load-bearing file's most-load-bearing section verbatim (e.g. for the 5→6 re-prime, quote sentence 2 of the brief's "## 6. Key States" section; for any phase using PRODUCT.md, quote sentence 2 of "## Brand Personality"). If you can't quote it, you didn't actually re-read — re-read from disk now and try again. This guards against summarised cache.

If any file has been compacted or summarised in your context, re-read the original from disk.
```

---

## 27. [ ] roles — commit: ____

**Tier:** Tier 4 — remaining pages, alphabetical

**Why this position:** Owner-only role library; AdminSheet create flow; Sam #1 heading fix (`<p>` role name → `<h2>`). Worked immediately after role-detail while the /admin/roles branch is fresh.

Re-prime prompt (copy into a fresh Claude Code session):

```
Fresh session — re-priming for Phase 6 (Implementation) of the admin redesign recipe.
Page being redesigned in THIS session: roles

STEP 1 — READ THESE FILES IN ORDER. Do not skim.
1. PRODUCT.md (foundation file — register, voice, anti-references)
2. /redesign/RECIPE-PROGRESS.md
3. /redesign/SAFETY-NET.md (so you know the rollback path for the branch I chose in Phase 0a)
4. DESIGN.md (full, incl. ## Admin-Specific Patterns)
5. /redesign/briefs/roles-brief.md   ← the brief for THIS page only
6. /redesign/BASELINE-ISSUES.md
7. /redesign/IMAGES-NEEDED.md

STEP 2 — CONFIRM IN ONE MESSAGE:
- One sentence per file, telling me what's in it
- The exact register from PRODUCT.md (must read "product" for this admin recipe — flag if it doesn't)
- The page you're about to redesign + its file path (cross-checked between RECON.md mentions and the brief)
- The Feature Preservation Manifest items from the brief (every form, button, JS hook that must survive)
- Pre-existing console errors I should NOT chase (from BASELINE-ISSUES.md)
- The phase + page we're entering (should be Phase 6 for roles)

STEP 3 — STOP. Do not start /impeccable craft until I reply "primed — go".

CONFIRMATION CHALLENGE: after your one-sentence-per-file summary, quote the second sentence of the most-load-bearing file's most-load-bearing section verbatim (e.g. for the 5→6 re-prime, quote sentence 2 of the brief's "## 6. Key States" section; for any phase using PRODUCT.md, quote sentence 2 of "## Brand Personality"). If you can't quote it, you didn't actually re-read — re-read from disk now and try again. This guards against summarised cache.

If any file has been compacted or summarised in your context, re-read the original from disk.
```

---

## 28. [ ] services — commit: ____

**Tier:** Tier 4 — remaining pages, alphabetical

**Why this position:** Owner-only treatment catalog; AdminSheet replaces Dialog for `ServiceFormDialog`; ConfirmActionModal on delete (with `usage_count > 0` guard preserved). All 12 field `name` attributes preserved verbatim.

Re-prime prompt (copy into a fresh Claude Code session):

```
Fresh session — re-priming for Phase 6 (Implementation) of the admin redesign recipe.
Page being redesigned in THIS session: services

STEP 1 — READ THESE FILES IN ORDER. Do not skim.
1. PRODUCT.md (foundation file — register, voice, anti-references)
2. /redesign/RECIPE-PROGRESS.md
3. /redesign/SAFETY-NET.md (so you know the rollback path for the branch I chose in Phase 0a)
4. DESIGN.md (full, incl. ## Admin-Specific Patterns)
5. /redesign/briefs/services-brief.md   ← the brief for THIS page only
6. /redesign/BASELINE-ISSUES.md
7. /redesign/IMAGES-NEEDED.md

STEP 2 — CONFIRM IN ONE MESSAGE:
- One sentence per file, telling me what's in it
- The exact register from PRODUCT.md (must read "product" for this admin recipe — flag if it doesn't)
- The page you're about to redesign + its file path (cross-checked between RECON.md mentions and the brief)
- The Feature Preservation Manifest items from the brief (every form, button, JS hook that must survive)
- Pre-existing console errors I should NOT chase (from BASELINE-ISSUES.md)
- The phase + page we're entering (should be Phase 6 for services)

STEP 3 — STOP. Do not start /impeccable craft until I reply "primed — go".

CONFIRMATION CHALLENGE: after your one-sentence-per-file summary, quote the second sentence of the most-load-bearing file's most-load-bearing section verbatim (e.g. for the 5→6 re-prime, quote sentence 2 of the brief's "## 6. Key States" section; for any phase using PRODUCT.md, quote sentence 2 of "## Brand Personality"). If you can't quote it, you didn't actually re-read — re-read from disk now and try again. This guards against summarised cache.

If any file has been compacted or summarised in your context, re-read the original from disk.
```

---

## 29. [ ] staff-availability — commit: ____

**Tier:** Tier 4 — remaining pages, alphabetical

**Why this position:** Per-staff availability workstation extended to three-manager stack (rules/blocked/overrides); four net-new server actions flagged for backend confirmation (Â§10 Q1 of the brief). Deepest in the staff hierarchy; worked last in the staff cluster with lowest blast radius.

Re-prime prompt (copy into a fresh Claude Code session):

```
Fresh session — re-priming for Phase 6 (Implementation) of the admin redesign recipe.
Page being redesigned in THIS session: staff-availability

STEP 1 — READ THESE FILES IN ORDER. Do not skim.
1. PRODUCT.md (foundation file — register, voice, anti-references)
2. /redesign/RECIPE-PROGRESS.md
3. /redesign/SAFETY-NET.md (so you know the rollback path for the branch I chose in Phase 0a)
4. DESIGN.md (full, incl. ## Admin-Specific Patterns)
5. /redesign/briefs/staff-availability-brief.md   ← the brief for THIS page only
6. /redesign/BASELINE-ISSUES.md
7. /redesign/IMAGES-NEEDED.md

STEP 2 — CONFIRM IN ONE MESSAGE:
- One sentence per file, telling me what's in it
- The exact register from PRODUCT.md (must read "product" for this admin recipe — flag if it doesn't)
- The page you're about to redesign + its file path (cross-checked between RECON.md mentions and the brief)
- The Feature Preservation Manifest items from the brief (every form, button, JS hook that must survive)
- Pre-existing console errors I should NOT chase (from BASELINE-ISSUES.md)
- The phase + page we're entering (should be Phase 6 for staff-availability)

STEP 3 — STOP. Do not start /impeccable craft until I reply "primed — go".

CONFIRMATION CHALLENGE: after your one-sentence-per-file summary, quote the second sentence of the most-load-bearing file's most-load-bearing section verbatim (e.g. for the 5→6 re-prime, quote sentence 2 of the brief's "## 6. Key States" section; for any phase using PRODUCT.md, quote sentence 2 of "## Brand Personality"). If you can't quote it, you didn't actually re-read — re-read from disk now and try again. This guards against summarised cache.

If any file has been compacted or summarised in your context, re-read the original from disk.
```

---

If you add a brief later: append a new numbered row using the template above and pre-fill the slug. Or rerun this prompt and accept the regenerated plan.

---

## Backend Plan Files (separate track from page redesigns)

These are plan files only. The recipe does NOT implement them. They sit here as references the user (or a separate engineering effort) handles before / alongside / after the frontend redesign. The recipe's only enforcement is at handoffs 5→6, 6→7, 7→8 — BLOCKS-REDESIGN items must reach handled status before the page that depends on them ships in Phase 7.

How to use:
1. Work through this section in dependency order — items at the top unblock items below them.
2. For each row, mark status: [ ] not handled / [→] in progress / [✓] handled / [≈] handled-via-FAKE / [Ã—] deferred.
3. Items tagged BLOCKS-REDESIGN must reach [✓] or [≈] before the page that depends on them ships in Phase 7.

**Dependency notes:**
- Row 21 (`approve-reject-password-reset`) requires rows 1 and 2 to be complete first.
- Row 22 (`email-templates-actions`) requires rows 6 and 19 to be complete first.
- Row 23 (`email-templates-preview-route`) requires row 6 to be complete first (soft — falls back to hardcoded defaults without override lookup).
- Rows 3 (`password-reset-request-actions`) and 21 (`approve-reject-password-reset`) are runtime-coupled (staff submits → admin approves → staff sets password) but have no code dependency on each other; both can be implemented in parallel.

### Dependency-ordered list

**— Layer 0: No plan-file dependencies, BLOCKS-REDESIGN —**

1. [ ] **BUILD** — `BUILD-rbac-permission-account-password-requests.md` — BLOCKS-REDESIGN — depended on by: account-password-requests *(also required by row 21)* — depends on: none
2. [ ] **BUILD** — `BUILD-password-reset-email-templates.md` — BLOCKS-REDESIGN — depended on by: account-password-requests, password-reset *(also required by row 21)* — depends on: none
3. [ ] **BUILD** — `BUILD-password-reset-request-actions.md` — BLOCKS-REDESIGN — depended on by: password-reset — depends on: none
4. [ ] **BUILD** — `BUILD-staff-filter-query.md` — BLOCKS-REDESIGN — depended on by: staff — depends on: none
5. [ ] **BUILD** — `BUILD-audit-filter-and-pagination.md` — BLOCKS-REDESIGN — depended on by: audit — depends on: none
6. [ ] **BUILD** — `BUILD-email-template-overrides-table.md` — BLOCKS-REDESIGN — depended on by: email-templates *(also required by rows 22 and 23)* — depends on: none
7. [ ] **BUILD** — `BUILD-email-delivery-filter-query.md` — BLOCKS-REDESIGN — depended on by: emails — depends on: none
8. [ ] **BUILD** — `BUILD-automated-booking-reminders.md` — BLOCKS-REDESIGN — depended on by: emails *(must be handled before or during Phase 6 emails session)* — depends on: none
9. [ ] **BUILD** — `BUILD-enquiries-filter-query.md` — BLOCKS-REDESIGN — depended on by: enquiries — depends on: none
10. [ ] **BUILD** — `BUILD-operations-filter-query.md` — BLOCKS-REDESIGN — depended on by: operations — depends on: none
11. [ ] **BUILD** — `BUILD-privacy-filter-query.md` — BLOCKS-REDESIGN — depended on by: privacy — depends on: none
12. [ ] **BUILD** — `BUILD-staff-blocked-dates-actions.md` — BLOCKS-REDESIGN — depended on by: staff-availability — depends on: none
13. [ ] **BUILD** — `BUILD-staff-availability-override-actions.md` — BLOCKS-REDESIGN — depended on by: staff-availability — depends on: none

**— Layer 0: No plan-file dependencies, non-blocking —**

14. [ ] **BUILD** — `BUILD-booking-create-override-flag.md` — non-blocking — depended on by: booking-new (override availability mode) — depends on: none. Adds `p_override_availability boolean default false` to `create_booking_request` RPC; fully backwards-compatible. Until built, override path degrades to a server error gracefully surfaced by the form.
15. [ ] **BUILD** — `BUILD-postcode-lookup-client.md` — non-blocking — depended on by: booking-new (Step 3 postcode auto-fill) — depends on: none. Pure client-side fetch to postcodes.io; no API key; no server changes. Falls back to manual entry gracefully.
16. [ ] **BUILD** — `BUILD-booking-create-inline-assignment.md` — non-blocking — depended on by: booking-new Step 4 (high-permission inline assignment) — depends on: none. Extends `createManualBooking` to accept `therapist_assignment_N` fields; applies assignments post-creation; RBAC-gated.
17. [ ] **BUILD** — `BUILD-group-session-id.md` — DEFERRED Phase 2 — depended on by: booking-new Phase 2 (split-time mixed-gender groups) — depends on: none. Adds `group_session_id UUID NULL` to `bookings`; links multiple booking records for different-time mixed-gender groups. No impact on Phase 1 implementation.
18. [ ] **BUILD** — `BUILD-clients-sort-last-visit.md` — non-blocking — depended on by: clients — depends on: none
19. [ ] **BUILD** — `BUILD-availability-this-week-chip.md` — non-blocking — depended on by: availability — depends on: none
20. [ ] **BUILD** — `BUILD-settings-last-changed-by.md` — non-blocking — depended on by: settings — depends on: none
21. [ ] **BUILD** — `BUILD-staff-workload-aggregates.md` — non-blocking — depended on by: staff — depends on: none
22. [ ] **BUILD** — `BUILD-audit-target-existence.md` — non-blocking — depended on by: audit — depends on: none
23. [ ] **BUILD** — `BUILD-rbac-permission-email-templates.md` — non-blocking — depended on by: email-templates *(required by row 26)* — depends on: none
24. [ ] **BUILD** — `BUILD-delete-role.md` — non-blocking — depended on by: role-detail — depends on: none

**— Layer 1: Depends on Layer 0 items, BLOCKS-REDESIGN —**

25. [ ] **BUILD** — `BUILD-approve-reject-password-reset.md` — BLOCKS-REDESIGN — depended on by: account-password-requests — depends on: rows 1 + 2
26. [ ] **BUILD** — `BUILD-email-templates-actions.md` — BLOCKS-REDESIGN — depended on by: email-templates — depends on: rows 6 + 23
27. [ ] **BUILD** — `BUILD-email-templates-preview-route.md` — BLOCKS-REDESIGN — depended on by: email-templates — depends on: row 6 (soft)

### DEFERRED items (reference only)
See `/redesign/DEFERRED-COMPLETENESS.md`.

- 2C-2 Framer Motion — no Phase 5 brief required it; CSS motion tokens cover all specified transitions
- 2C-8 Plain HTML form pattern — no Phase 5 brief proposed migration to RHF+Zod; all 29 briefs preserve the server-action + named-field contract

CRITICAL — this section is REFERENCE ONLY. Frontend work in Phase 6 proceeds independently of these plan files; the only gating is at the three handoffs above.
