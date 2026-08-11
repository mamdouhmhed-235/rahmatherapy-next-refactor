# Item 2 — Section 6 privacy-notice rewrite: candidates + adversarial audit

Scope: `src/app/(public)/privacy/page.tsx`, section id `how-long-we-keep-it`
(heading `6. How long we keep it`). Read-only derivation — no source file was
written. This file is the deliverable.

## 0. Full page read (voice check)

Read the entire file (222 lines, all 9 sections). Register: second person
("you"/"your"), plain English, one em-dash per aside, contractions written as
HTML entities (`&apos;`, `&ldquo;`/`&rdquo;` for quoted section titles — see
section 7's own back-reference to "Who we are"), body copy at
`className={bodyText}` = `"text-sm leading-7 text-rahma-muted sm:text-base"`.
Confirmed file is CRLF (`Get-Content -Raw ... -match "\`r\`n"` → `True`).

Current section 6 `<p>` (lines 167–172), read verbatim:

```
Our policy is to keep booking and treatment records for 7 years after your last
visit with us. If you make an enquiry that doesn&apos;t turn into a booking, we
keep it for around 12 months. Analytics information, where you&apos;ve given
consent for it, is kept according to Google&apos;s own retention settings.
```

Third sentence, isolated (this is the byte-for-byte KEPT sentence, reproduced
in every candidate below):

> Analytics information, where you&apos;ve given consent for it, is kept
> according to Google&apos;s own retention settings.

Indentation measured directly (`awk 'NR==166..173{print length($0), $0}'`):
`<h3>`/`<p>`/`</p>` sit at **12 spaces**; the wrapped body-text lines inside
`<p>` sit at **14 spaces** (matches the task's stated indent). Line widths of
the current paragraph, measured the same way: 93, 93, 90, 88 characters total
(indent included) — confirms the file's own ~92-column wrap convention, which
the recommended JSX block below follows. Section 7 wraps its own
`&ldquo;Who we are&rdquo;` back-reference exactly the same way — split
mid-quote across two lines (`...in &ldquo;Who` / `are&rdquo; above.`,
87 + 31 chars) — so my JSX candidate doing the same is following existing
precedent in this file, not introducing a new pattern.

## 1. Verifying the four adversarial claims against the codebase

Every claim below is a claim I tested, not a fact I was handed.

### Claim: "nothing deletes by age"

Checked all four cron routes (the only scheduled/automated code in the repo
that touches the database) end to end:

- `src/app/api/cron/booking-reminders/route.ts` — reads tomorrow's bookings,
  sends reminder emails. No delete.
- `src/app/api/cron/scheduled-emails/route.ts` — claims and sends queued
  `email_delivery_events` rows. No delete.
- `src/app/api/cron/review-emails/route.ts` — sends "leave a review" emails
  for bookings completed 2h–7d ago. No delete.
- `src/app/api/cron/extend-recurring-horizons/route.ts` — creates future
  occurrences for recurring series. The only `.delete()` calls in this file
  are in `rollbackOccurrence` (lines 565–573), and that fires only to undo a
  booking this same run just half-created after an insert error later in the
  same transaction sequence — not an age/retention purge of anything.

Also searched migrations for a scheduled purge job:

```
grep -rln "pg_cron\|cron.schedule\|expire\|expiry\|retention\|ttl" supabase
→ 6 files matched, all false positives on inspection: `manage_token_expires_at`
  (a magic-link expiry column, unrelated to data retention) and two comments
  about a scheduled-email delivery *window* (not deletion).
```

No `pg_cron` schedule, no age-keyed `DELETE`, no TTL column anywhere in the
repo. **Claim TRUE.**

### Claim: "deletion is on-demand and admin-triggered only"

```
grep -rn "deleteClient(" src --include=*.ts --include=*.tsx | grep -v "__tests__\|\.test\."
→ src/app/admin/clients/actions.ts:723   (adminDeleteClient — single-client delete button)
→ src/app/admin/clients/actions.ts:762   (bulkDeleteClients)
→ src/app/admin/privacy/actions.ts:100   (updatePrivacyRequestStatus, only when a
                                           privacy manager marks a deletion_review
                                           request "completed")
```

Read `deleteClient` in full (`src/app/admin/clients/actions.ts:504-708`). It
permission-gates on `manage_client_destructive_ops` (admin path) or
`manage_privacy_operations` (GDPR-erasure path) before doing anything, then
cancels open recurring templates, cancels open bookings (completed bookings
are explicitly never touched — comment: "a tax + ICO record"), hard-deletes
only sensitive `client_notes`, and soft-deletes the client last. Every one of
its three call sites is a human clicking a button or changing a status in the
admin UI. No cron, no timer, no code path reaches it automatically.
**Claim TRUE.**

### Claim: "enquiries are never deleted by any code path at all"

```
grep -n "delete" -i src/app/admin/enquiries/actions.ts src/app/admin/enquiries/enquiries-data.ts
→ (no output — zero matches)

grep -rn '\.from("enquiries")' src --include=*.ts --include=*.tsx | grep -v "__tests__\|\.test\."
→ 14 call sites (bookings/actions.ts ×2, bookings/new/page.tsx, booking-detail-data.ts,
   nav-notifications.ts ×2, performance-data.ts, dashboard-data.ts, enquiries/actions.ts ×2,
   enquiries-data.ts ×2, reporting.ts, notifications.ts) — read the two in
   bookings/actions.ts directly: both are a `.update({ status: "booked", ... })`
   when an enquiry converts to a booking, not a delete.
```

Went further than the brief's checklist: even `deleteClient`'s GDPR-erasure
cascade (read above) never touches the `enquiries` table — it cascades to
`recurring_booking_templates`, `bookings`, and sensitive `client_notes` only.
So there is currently no code path — automated *or* admin-triggered — that
removes an enquiry row. That's a stronger fact than the claim asked me to
check, and it matters for wording: "ask us to delete it" is a rights
commitment the business can act on outside this codebase (a manual/dev-run
deletion), not a claim that an in-app button exists for every record type.
I've kept the recommended wording to the rights commitment only and not
implied a mechanism, for exactly this reason. **Claim TRUE** (as stated, and
more absolute than stated).

### Claim: "there is no committed response time"

```
grep -rn -i "within 30 days|business day|working day|respond within|response time|1 month|calendar month" \
  src/app/admin/privacy "src/app/(public)/privacy"
→ no matches
```

Also read `src/app/admin/privacy/page.tsx` for any promised turnaround copy —
none found (the one text match was an unrelated "25-row rail" CSS comment).
**Claim TRUE.**

## 2. Three candidates, sentence-by-sentence adversarial audit

Each candidate = new sentence(s) + the byte-for-byte KEPT analytics sentence.
For each new sentence: *could someone point at this codebase and say it's
false?*, checked specifically against the four claims verified above.

### Candidate 1 — affirmative, criteria-led

> We keep booking, treatment and enquiry records for as long as we need
> them — for the care we&apos;ve given you, and to meet our legal, insurance
> and accounting obligations. Exactly how long that is depends on the type
> of record and which of those obligations applies to it, rather than a
> fixed period. You can ask what we hold about you, or ask us to delete it,
> at any time, using the contact details in &ldquo;Who we are&rdquo; above.
> Analytics information, where you&apos;ve given consent for it, is kept
> according to Google&apos;s own retention settings.

- S1 ("for as long as we need them... care... obligations"): states a
  *purpose*, not a mechanism. Doesn't claim any deletion event happens, so
  it can't be contradicted by "nothing deletes by age." Minor stylistic
  risk: a very literal reader could read "as long as we need them" as
  implying an eventual automatic sunset even though none exists in code —
  low risk, not a false claim, but worth flagging.
- S2 ("depends on the type of record... rather than a fixed period"): this
  is directly and positively verifiable — there is no fixed-duration logic
  anywhere in the codebase. **True.**
- S3 ("ask what we hold... or ask us to delete it... using the contact
  details in 'Who we are'"): matches "deletion is on-demand and
  admin-triggered only" exactly — it only says you may ask, not that
  deletion is automatic or self-service. "at any time" describes when a
  person may *ask*, not a promise of how fast Rahma Therapy responds — no
  response-time commitment made. Operational caveat noted above (no in-app
  delete path for enquiries specifically) applies equally to every
  candidate, since the Owner's binding constraints require this sentence
  verbatim in content.

Verdict: 3/3 sentences survive; S1 carries a low-severity stylistic risk.

### Candidate 2 — leads with the strongest falsifiable claim

> We don&apos;t keep your records for a fixed number of years. Instead, we
> hold on to booking, treatment and enquiry records for as long as
> they&apos;re needed — for the care we&apos;ve given you, and to meet our
> legal, insurance and accounting obligations. How long that is depends on
> the type of record and which of those obligations applies to it.
> You&apos;re welcome to ask what we hold about you, or ask us to delete it,
> using the contact details in &ldquo;Who we are&rdquo; above. Analytics
> information, where you&apos;ve given consent for it, is kept according to
> Google&apos;s own retention settings.

- S1 ("We don't keep your records for a fixed number of years."): the
  single most directly checkable sentence across all three candidates — I
  searched the entire codebase and migrations for exactly this and found
  none. **True, and the strongest available proof against the "not even a
  soft duration" failure mode.**
- S2 (same "for as long as they're needed" purpose framing as Candidate 1
  S1): same low-severity note as above — states purpose, not a deletion
  mechanism.
- S3 ("depends on the type of record and which of those obligations
  applies"): same as Candidate 1 S2 — verifiably true, no fixed-duration
  logic exists.
- S4 (rights sentence, same construction as Candidate 1 S3): same analysis,
  passes.

Verdict: 4/4 sentences survive; same low-severity note on the purpose
framing, but opens with the most defensible claim of any candidate.

### Candidate 3 — leads with negation, but S2 overreaches

> How long we keep booking, treatment and enquiry records isn&apos;t set by
> a fixed period — it depends on the type of record and on the legal,
> insurance, accounting and care obligations that apply to it. We keep each
> record only for as long as one of those obligations still applies. You
> can ask what we hold about you, or ask us to delete it, at any time,
> using the contact details in &ldquo;Who we are&rdquo; above. Analytics
> information, where you&apos;ve given consent for it, is kept according to
> Google&apos;s own retention settings.

- S1: same verifiably-true "no fixed period" claim as Candidate 2 S1.
  Passes.
- S2 ("We keep each record only for as long as one of those obligations
  still applies."): **this is the sentence I'd flag hardest.** "Only for as
  long as X still applies" reads as a conditional retention rule — it
  implies that once an obligation lapses, the record stops being kept, i.e.
  a trigger-based removal keyed to a condition. There is zero code anywhere
  that removes a record when an obligation lapses — every deletion in this
  codebase is a human clicking a button or changing a status, never a
  condition-lapse check. This is the closest any sentence in any candidate
  comes to implying "scheduled, automatic or age-triggered deletion,"
  which the Owner's constraints explicitly rule out. Someone could
  reasonably point at `deleteClient`'s three call sites (all human-gated)
  and the four cron routes (none of which check "does an obligation still
  apply") and say this sentence overstates what the system does.
- S3/kept: same as other candidates, passes.

Verdict: 3/4 new-content sentences survive; S2 is a genuine risk against the
Owner's explicit "must not imply... age-triggered deletion" constraint, not
just a stylistic nit.

## 3. Ranking and recommendation

**Ranking: Candidate 2 > Candidate 1 > Candidate 3.**

- Candidate 3 is ranked last: its S2 ("only for as long as one of those
  obligations still applies") is the one sentence across all nine audited
  that risks implying an automatic, condition-triggered deletion mechanism
  the code does not have — exactly the failure mode the brief calls out by
  name.
- Candidates 1 and 2 both pass cleanly; Candidate 2 is ranked above
  Candidate 1 because its opening sentence ("We don't keep your records for
  a fixed number of years") is the single most directly falsifiable-and-true
  statement available — it forecloses a duration reading explicitly rather
  than by omission, which most directly serves the Owner's "not even a
  soft one" instruction — while every other required element (criteria,
  obligation types, rights pointer) is identical in substance to
  Candidate 1.

**Recommended: Candidate 2.** Reason (one line): it opens with the single
most directly-verifiable claim in the codebase (no fixed-duration deletion
logic exists anywhere) before stating criteria, which most explicitly rules
out any duration reading while every other candidate does so only by
omission.

## 4. JSX-ready form (recommended candidate)

Exact text as it must appear inside the existing `<p className={bodyText}>`
element at lines 167–172, matching the file's 12-space `<p>`/`</p>` indent,
14-space body indent, and its own ~92-column-including-indent wrap
convention (verified against section 6's current lines: 93/93/90/88, and
section 7's own mid-quote wrap of `&ldquo;Who we are&rdquo;`):

```jsx
            <p className={bodyText}>
              We don&apos;t keep your records for a fixed number of years. Instead, we hold
              on to booking, treatment and enquiry records for as long as they&apos;re needed
              — for the care we&apos;ve given you, and to meet our legal, insurance and
              accounting obligations. How long that is depends on the type of record and
              which of those obligations applies to it. You&apos;re welcome to ask what we
              hold about you, or ask us to delete it, using the contact details in &ldquo;Who
              we are&rdquo; above. Analytics information, where you&apos;ve given consent for
              it, is kept according to Google&apos;s own retention settings.
            </p>
```

Line widths (indent included, via PowerShell length check): 91, 93, 87, 88,
90, 93, 93, 76 — all within the file's own 88–93 range for this paragraph
except the final (shorter, sentence-terminal) line, same as the current
source's own last line (88).

Not applied to the source file — this task is read-only; `src/` was not
touched. This is the candidate text ready for whoever executes Item 2 to
paste in.
