VERDICT: PASS

# C-19 fix-round re-verification — `ab80687`

Independent re-check of the fix round that followed the FAIL closeout on C-19 (public privacy notice). Read-only verifier; no writes except this report.

---

## Exhaustive field-by-field cross-check (primary task)

Schema read by symbol: `bookingRequestSchema` in `src/app/api/bookings/route.ts` (public route) and `manualBookingSchema` in `src/app/admin/bookings/actions.ts` (admin/manual route). Cross-read against `src/features/booking/components/AboutYouStep.tsx`, `ConfirmStep.tsx`, `ScheduleStep.tsx`, `PackageSelectionStep.tsx`, and `src/features/booking/schemas/booking-schema.ts` (client-side mirror — confirmed identical field set to the server schema). Also read `src/app/api/bookings/createBookingTransaction.ts` to see exactly what reaches the RPC.

| Field (schema symbol) | What it is | Page bullet (quoted) | Verdict |
|---|---|---|---|
| `selectedPackageIds` | Treatments chosen | "The treatments you choose and your preferred date and time." | disclosed |
| `details.bookingFor` | self / someone_else / group | "Whether the booking is for yourself, someone else, or a group..." | disclosed |
| `details.fullName` | Main contact name | "Your name, phone number and email address." | disclosed |
| `details.phone` | Phone/WhatsApp number | same bullet | disclosed |
| `details.email` | Email address | same bullet | disclosed |
| `details.notes` | Treatment notes ("what you'd like help with") | "Any treatment notes you add about what you'd like help with." | disclosed |
| `details.healthNotes` | Health/safety notes (allergies, meds, pregnancy, surgery, injuries, skin concerns, fainting history) | "Any health or safety notes you choose to share — for example allergies, medication, pregnancy, recent surgery, injuries or skin concerns..." | disclosed (list is "for example", non-exhaustive by design — "fainting history" from the placeholder text is legitimately folded in) |
| `details.clientGender` | Booker's own gender (self-booking) or the one participant's gender | "...plus the gender of the person being treated — including your own if the booking is for you..." | disclosed (this is fix #2) |
| `details.numberOfPeople` | Participant count | not named as its own bullet; only inferable from the group/participant-list bullet | disclosed implicitly — NON-BLOCKING (a bare headcount derived from the participant list isn't a distinct privacy-relevant category; flagging as a nicety, not a gap) |
| `details.participantGenders` | Genders of other participants | "...and the names and genders of anyone else included." | disclosed |
| `details.participantNames` | Names/labels of other participants | same clause | disclosed |
| `details.participantNotes` | Free-text notes about other participants (may include their health info) | "If you book for other people, any notes you add about them. Those notes are about someone else, not you, and may include information about that person's health too." | disclosed |
| `details.postcode` | Postcode | "...postcode..." | disclosed |
| `details.address` | Street address | "Your address..." | disclosed |
| `details.city` | Town/city (`register("city")`, form label "City / Town", `autoComplete="address-level2"`) | "Your address, town or city, area and postcode..." | disclosed (this is fix #1) |
| `details.area` | Area/county (form label "Area / County", `autoComplete="address-level1"`) | same bullet, "area" | disclosed |
| `details.accessNotes` | Access notes (flat number, entry, lift/stairs) | "...plus any access or parking notes..." | disclosed |
| `details.parkingNotes` | Parking notes | same bullet | disclosed |
| `preferredDate` | Preferred appointment date | "...your preferred date and time." | disclosed |
| `preferredTime` | Preferred appointment time | same bullet | disclosed |
| `details.consentAcknowledged` | Treatment/health-info consent checkbox | not a "what we collect" category — covered as a consent mechanism in §3 ("given when you confirm your booking") | not personal data — NON-BLOCKING, correctly out of §2 |
| `details.paymentAcknowledged` | Payment-terms acknowledgement checkbox | not mentioned | not personal data — NON-BLOCKING, no disclosure needed |
| `details.manageAcknowledged` | Manage/cancellation acknowledgement checkbox | not mentioned | not personal data — NON-BLOCKING, no disclosure needed |
| `company_website` (honeypot, public form only) | Bot trap; deliberately excluded from `bookingRequestSchema`, never reaches the RPC, no work done for a filled value | not mentioned | correctly absent — it is not collected/stored in any real sense (route.ts comment confirms it "can never reach the RPC") |
| `bookingSource` (admin/manual schema only) | Enum: website/phone/whatsapp/facebook/instagram/referral/admin/manual/other — internal channel tag set by staff | not mentioned | NON-BLOCKING — operational metadata about how the booking was taken, not personal information about the data subject; out of the audited field list in the C-19 brief header, and not something the customer supplies. Judgment call, not a gap on the order of the two original findings. |
| `sendConfirmationEmail`, `overrideAvailability` (admin/manual schema only) | Staff-side operational flags | not mentioned | correctly absent — not personal data |

**No MISSING findings.** **No OVER-DISCLOSED findings** — every bullet in "What we collect" maps to a real schema field; nothing is claimed that the code doesn't actually collect.

---

## Secondary — the two specific fixes

1. **Town/city bullet.** `route.ts`'s `details.city` (`z.string().trim().min(2)`) is a field distinct from `area`. `AboutYouStep.tsx` renders it as its own required input, `label="City / Town"`, `autoComplete="address-level2"` (lines 498–509), separate from `label="Area / County"` / `autoComplete="address-level1"` (lines 511–522). The revised bullet — "Your address, town or city, area and postcode, plus any access or parking notes, so we can find and reach you." — now names it. Confirmed.
2. **Booker's own gender.** `AboutYouStep.tsx` line 297–301: the `<legend>` reads `"Your gender"` when `bookingFor !== "someone_else"` (i.e. for a self-booking) and `"Participant gender"` for `"someone_else"`. That value is stored in `clientGender` (`genderInputSchema`), which is the same field `route.ts` requires. The revised bullet — "...plus the gender of the person being treated — including your own if the booking is for you — and the names and genders of anyone else included." — now covers it. Confirmed.
3. **Register/plain-English check.** Both edited bullets read naturally and match the page's existing tone (short clauses, no jargon, consistent with the rest of §2). No clumsiness found. NON-BLOCKING: none to report.

---

## Also confirm

**4. Scope.** `git show ab80687 --stat` → exactly one file: `src/app/(public)/privacy/page.tsx` (5 insertions, 4 deletions). No other path touched. PASS.

**5. Deferred items untouched.**
- `src/lib/observability/sentry-scrubbing.ts` — not modified (`git log ab80687^..HEAD -- <file>` empty for the fix commit range checked; grep only shows unrelated pre-existing content).
- `src/components/shared/SectionHeading.tsx` — not modified; still exports the missing-`<h1>` shape as before.
- Metadata title — `title: "Privacy Policy — Rahma Therapy"` (page.tsx:21), em-dash intact, byte-for-byte as the plan specified.
PASS on all three.

**6. Owner's three recorded answers hold.**
- Contact: `contactLinks.email.value` = `"rahmatherapy@outlook.com"`, `contactLinks.phone.value` = `"07798897222"` in `src/content/site/contact.ts` — page.tsx sources both via `contactLinks.email.href`/`.value` and `contactLinks.phone.href`/`.value` (lines 60–66), not retyped literals. No postal address anywhere on the page. PASS.
- Retention: "7 years after your last visit" / "around 12 months" for non-converting enquiries / "according to Google's own retention settings" (page.tsx:167–172). No claim of automatic deletion anywhere on the page (grepped for "automatic"/"automatically" — zero hits). PASS.
- Controller: "RAHMATHERAPY LIMITED (company number 16769945), trading as Rahma Therapy" (page.tsx:53–54) — brand named alongside, not instead of, the legal entity. PASS.

**7. All nine brief sections present with anchors**, unchanged by the fix commit (grepped `id="..."` across the file): `who-we-are`, `what-we-collect`, `why-we-use-it`, `who-helps-us-run-the-site`, `where-data-goes`, `how-long-we-keep-it`, `your-rights`, `concerns`, `no-automated-decisions`. PASS — matches the brief's nine-section list exactly, structure undisturbed.

**8. Gates, by identity.**
- `npx tsc --noEmit` → 0 errors. PASS.
- `pnpm vitest run` → **5 failed, 2014 passed** (2019 total). Failing identities, confirmed by name:
  - `src/lib/auth/admin-access.test.ts > admin access matrix > gives Owner broad access while keeping owner-only role actions permission-gated`
  - `src/lib/auth/admin-access.test.ts > admin access matrix > gives Admin broad operational access without role template management`
  - `src/app/admin/bookings/new/ManualBookingForm.test.tsx > ManualBookingForm > renders step 1 on first load`
  - `src/app/admin/bookings/new/ManualBookingForm.test.tsx > ManualBookingForm > moves focus to the first invalid field when continuing with errors`
  - `src/app/admin/bookings/new/ManualBookingForm.test.tsx > ManualBookingForm > shows the consent error when trying to create booking without consent`
  This is exactly `admin-access.test.ts` ×2 + `ManualBookingForm.test.tsx` ×3, matching the inherited baseline by identity. The passed total (2014, up from the prior baseline) is explained by C-20 Phase A's 7 new tests in `src/lib/address/`, consistent with the dispatch's note — not drift. PASS.
- `pnpm lint` → **59 errors, 7 warnings**, confirmed in exactly these files (unique file list extracted from lint output): `design_handoff_area_pages/prototype/area-page.jsx`, `design_handoff_area_pages/prototype/shared.jsx`, `design_handoff_area_pages/prototype/site-chrome.jsx`, `src/features/booking/BookingExperience.tsx`, `src/features/booking/BookingExperienceLoader.tsx`, `src/features/booking/utils/returning-customer.ts`. The privacy page does not appear anywhere in lint output (grepped "privacy" case-insensitive — zero hits). PASS.
- `pnpm build` — **not run**, per instruction (banned for agents this session).

**9. Live render.** Loaded `http://localhost:3000/privacy/` on the Owner's already-running dev server (confirmed via `window.location.href` after navigation — the tab-context summary truncates the path but the actual URL is correct). Read back "2. What we collect" via `get_page_text`; it renders exactly as the source: both fix-round bullets present verbatim, including "town or city" and "including your own if the booking is for you". No console errors surfaced during the check. PASS.

---

## Findings

None BLOCKING.

Non-blocking observations (informational only, not required for PASS):
1. `numberOfPeople` (participant headcount) has no dedicated bullet in §2 — it's only inferable from the participant-list clause. Not a distinct privacy category; not actionable.
2. `bookingSource` (admin/manual-booking-only enum tracking how a booking was taken — phone/whatsapp/website/etc.) is not mentioned in §2. It's staff-entered operational metadata, not something the customer supplies, and wasn't in the C-19 brief's audited field list. Worth a mental note for a future revision if the notice is ever extended to more explicitly cover admin-side data capture, but does not rise to the level of the original two findings.

## Checks I could not run

- `pnpm build` — deliberately not run per dispatch instruction (banned for agents this session).
- Supabase-side verification of what the RPC (`create_booking_request`) ultimately persists to the database beyond what's visible in `createBookingTransaction.ts`'s call parameters — not needed for this task since the notice describes fields collected via the form/API, and the RPC call parameters map 1:1 to the schema fields already audited above; no SQL inspection was necessary to reach a verdict.

Model run as: Sonnet 5 (claude-sonnet-5), per environment instructions.
