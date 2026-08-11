# Item 1 — Symbol/Anchor Re-location and Behavioural Verification

Verified against working tree HEAD `91a5864` (plan claims were stated "as of
commit `33f895f`"; `33f895f` is an ancestor — `docs(redesign): record the
end-of-programme build result and the bundle-gate gap`). All line numbers
below are read directly off the current files with `Read`/`Grep`, not
inferred from the plan.

## Summary

24 of 25 anchors are exact hits — zero drift. One (`getEmailsPageData`) has a
genuine anchor error: the claimed `142-197` is not the function's span. The
function itself is `128-254`; `142` is where the `unstable_cache(` wrapper
*inside* the function starts, and `197` is where the `remindersPromise` IIFE
(a different symbol, bundled into the same claim line) closes — not where the
function ends. The `remindersPromise` / "reminders query" half of that same
claim line (`175-197`) is itself an exact hit.

All 8 behavioural claims verified CONFIRMED against the code as written today
(no FALSE or PARTLY_TRUE among them) except claim 8, whose answer is **No**
— `review_email_sent` is not a key in `audit/format.ts`'s `ACTIONS` map,
exactly as claim 8 asked me to check (this is a fact-finding claim, not an
assertion to be confirmed/denied against a stated expectation — see below).

---

## Anchor-by-anchor

| # | Symbol | Claimed | Actual | Drift |
|---|--------|---------|--------|-------|
| 1 | `sendReviewRequestEmail` | `notifications.ts:1356-1444` | `1356-1444` | NONE |
| 2 | `sendTrackedEmail` | `notifications.ts:473-584` | `473-584` | NONE |
| 3 | `pickReviewMessages` (call site inside `sendReviewRequestEmail`) | inside `sendReviewRequestEmail` | called at `notifications.ts:1406`, within the function's `1356-1444` span (defined separately in `templates.ts:814`) | NONE |
| 4 | `resolveTemplateOverrides` (call site, same path) | inside the same path | called at `notifications.ts:1405`, within `1356-1444` (defined in `templates.ts:689`) | NONE |
| 5 | `resendEmail` | `actions.ts:120`, scope check `~159-201` | function at `120`; scope-check comment+block at `159-201` (comment `159-165`, `if` block `166-201`) | NONE |
| 6 | `dispatchResend` | `actions.ts` (no line given) | `298` | NONE |
| 7 | `sendManualBookingReminder` | `actions.ts` (no line given) | `31` | NONE |
| 8 | `RESEND_RATE_LIMIT_SECONDS` | `actions.ts:101`, value `60` | `101`, value `60` | NONE |
| 9 | `canResendBookingEmails` | `rbac.ts:221`, permission `resend_booking_emails` | `221`; `PERMISSIONS.RESEND_BOOKING_EMAILS = "resend_booking_emails"` at `rbac.ts:35` | NONE |
| 10 | `isQuietHourLondon` | `route.ts:55-65`, window 21:00-08:00 Europe/London | `55-65`; `QUIET_HOURS_START=21`, `QUIET_HOURS_END=8`, condition `londonHour >= 21 \|\| londonHour < 8` | NONE |
| 11 | `ReviewEmailSummary` | `route.ts:30-37` | `30-37` | NONE |
| 12 | `emptySummary` | `route.ts:39-48` | `39-48` | NONE |
| 13 | POST handler | `route.ts:67-` | `67` (`export async function POST(...)`) | NONE |
| 14 | candidate query | `route.ts:107-114` | `107-114` | NONE |
| 15 | audit `after_state` write | `route.ts:131-140` | `131-140` | NONE |
| 16 | `sendReviewRequestEmail` call | `route.ts:125` | `125` | NONE |
| 17a | `getEmailsPageData` | `emails-data.ts:142-197` | function is `128-254`; `142` is the `unstable_cache(` call *inside* the function, not the function start | **DRIFT** — claimed range does not bound the function; see note below |
| 17b | `remindersPromise` / "reminders query" | `emails-data.ts:175-197` | IIFE `175-197` (query itself `183-196`) | NONE |
| 18 | `TabKey` | `page.tsx:78` | `78` | NONE |
| 19 | `resolveTab` | `page.tsx:80-88` | `80-88` | NONE |
| 20 | tabs array | `page.tsx ~263-291` | `263-291` | NONE |
| 21 | `ReminderResendForm` placement | `page.tsx:925` | `925` (JSX usage; import at `43`) | NONE |
| 22 | `ACTIONS` map | `audit/format.ts:22-98` | `22-98` | NONE |
| 23 | `manual_booking_reminder_sent` entry | inside that `ACTIONS` map | `86`, inside `22-98` | NONE |
| 24 | `DELIVERY_STATUSES` | `emails/format.ts:31-39` | `31-39` | NONE |
| 25 | `review_email_sent` label | `clients/[clientId]/page.tsx:222` | `222` (`review_email_sent: "Review request email sent",`) | NONE |

### Note on #17 (the one real drift)

The plan's line `remindersPromise / getEmailsPageData claimed
src/app/admin/emails/emails-data.ts:142-197` folds two different symbols
into one claimed range, and that range belongs to neither cleanly:

- `getEmailsPageData` (the exported function) is `128-254`:
  ```
  128 export async function getEmailsPageData(
  ...
  253   return cached();
  254 }
  ```
- `142` is not the function's start — it's the line where the function's
  internal `unstable_cache(async (): Promise<EmailsPageData> => { ... })`
  wrapper begins.
- `remindersPromise` (the actual symbol most of the claim's detail — "reminders
  query :175-197" — is about) is its own const, `175-197`:
  ```
  175   const remindersPromise = (() => {
  ...
  196     return q.returns<ReminderBooking[]>();
  197   })();
  ```
  This sub-claim is an exact hit.

So: treat `getEmailsPageData` as `128-254` (claimed `142-197` is wrong on both
ends), and `remindersPromise`/reminders-query as `175-197` (claimed, exact).

---

## Behavioural claims

**1. `sendReviewRequestEmail`'s early-return reasons are exactly `no_email` /
`already_sent` / `send_failed`, and its return type.**
CONFIRMED. Signature (`notifications.ts:1359`):
```ts
): Promise<{ sent: boolean; reason?: "no_email" | "already_sent" | "send_failed" }> {
```
Three early returns, one per reason, no others exist in the function:
- `1370`: `return { sent: false, reason: "send_failed" };` — booking status
  isn't `"completed"` (flipped between cron read and now).
- `1373`: `return { sent: false, reason: "already_sent" };` — `review_email_sent_at` already set.
- `1383`: `return { sent: false, reason: "no_email" };` — no contact/client email.
- `1443`: `return { sent: true };` — success path, no `reason`.

**2. The `no_email` branch writes `review_email_sent_at` WITHOUT sending.**
CONFIRMED. Quote, `notifications.ts:1376-1384`:
```ts
  const customerEmail = booking.contact_email || booking.clients?.email;
  if (!customerEmail) {
    // Mark as "handled" — don't keep retrying a no-email booking.
    await supabase
      .from("bookings")
      .update({ review_email_sent_at: new Date().toISOString() })
      .eq("id", bookingId);
    return { sent: false, reason: "no_email" };
  }
```
No call to `sendTrackedEmail` or `sendEmail` anywhere in this branch.

**3. Short-circuits on `no_email` BEFORE calling `sendTrackedEmail`.**
CONFIRMED. The `no_email` return is at line `1383`; the only
`sendTrackedEmail` call in this function is at line `1410`, 27 lines later
and unreachable once the function has returned at `1383`.

**4. The call to `sendTrackedEmail` never passes `delaySeconds`.**
CONFIRMED. The call, `notifications.ts:1410-1425`, passes exactly
`bookingId, eventType, recipientRole, to, subject, html, text` — no
`delaySeconds` key. (`sendTrackedEmail`'s own parameter type, `473-491`,
declares `delaySeconds?: number` as optional, so omitting it is valid and
takes the immediate-send path at `555-583`, not the queued path at
`506-553`.)

**5. Cron candidate query.**
CONFIRMED — matches verbatim, `route.ts:107-114`:
```ts
const { data: candidates, error: queryErr } = await supabase
    .from("bookings")
    .select("id")
    .eq("status", "completed")
    .is("review_email_sent_at", null)
    .gte("completed_at", sevenDaysAgo)
    .lte("completed_at", twoHoursAgo)
    .limit(50);
```
`status='completed'` ✓, `review_email_sent_at IS NULL` ✓,
`completed_at BETWEEN (now-7d) AND (now-2h)` ✓ (`sevenDaysAgo`/`twoHoursAgo`
computed at `99-102`), `limit(50)` ✓, `.select("id")` ✓.

**6. `sendReviewRequestEmail` has exactly ONE production caller.**
CONFIRMED via repo-wide grep (`select:Grep` over `src/**/*.ts` and
`src/**/*.tsx` for `sendReviewRequestEmail`). Every hit outside its own
definition/self-references in `notifications.ts` (1356, 1367, 1440) and a
non-call comment in `templates.ts:880` is either a test file
(`src/lib/email/__tests__/sendReviewRequestEmail.test.ts`,
`src/app/api/cron/__tests__/review-emails.test.ts`) or the single production
call site: `src/app/api/cron/review-emails/route.ts:125`. No other route,
server action, or component calls it.

**7. `dispatchResend` has NO `review_request_client` case.**
CONFIRMED. Full switch, `actions.ts:311-364`, cases are:
`booking_confirmation`, `booking_cancellation_customer`/`booking_cancellation_admin`,
`booking_reminder`, `staff_assignment`, `staff_booking_change`,
`booking_confirmed_client`, `staff_unassignment`, `claim`,
`client_assigned_therapist`, and `default` (throws `Cannot resend event
type: ${eventType}`). No `review_request_client` case — an attempted resend
of that event type falls through to `default` and throws.

**8. Is `review_email_sent` present in `audit/format.ts`'s `ACTIONS` map today?**
**No.** `Grep "review_email_sent" src/app/admin/audit/format.ts` → no
matches. The map (`22-98`) has `manual_booking_reminder_sent` (`86`,
"sent a booking reminder") but no entry keyed `review_email_sent`, even
though the cron route writes `action_type: "review_email_sent"` into
`audit_logs` (`route.ts:132`). Consequence, read from `describeAction`
(`format.ts:100-110`): an unknown `action_type` doesn't crash or vanish —
it falls through to a defensive default (`phrase: actionType.replace(/_/g,
" ")`, i.e. "review email sent", `family: "operations_and_email"`,
`chip: "none"`), so the audit UI renders it, just without the map's
hand-authored phrasing/chip.
