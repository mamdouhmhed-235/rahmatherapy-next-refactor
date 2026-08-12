# B2 — audit/format.ts current state (verified, HEAD 530d154)

Scope: `src/app/admin/audit/format.ts` — does it register `review_email_sent`, and what
does a complete registration need to account for. All line numbers below were read
directly off the file at HEAD 530d154, not carried over from any plan/handoff.

## 1. Verbatim: `ActionFamily`, `ChipTone`, `ActionEntry`, `ACTIONS` (lines 4–103)

File: `src/app/admin/audit/format.ts`

```ts
4   export type ActionFamily =
5     | "bookings_and_assignments"
6     | "clients_and_enquiries"
7     | "staff_and_roles"
8     | "services_and_settings"
9     | "availability"
10    | "operations_and_email"
11    | "reports_and_exports"
12    | "account_security";
13
14  export type ChipTone = "confirmed" | "pending" | "cancelled" | "restricted" | "none";
15
16  interface ActionEntry {
17    phrase: string;
18    family: ActionFamily;
19    chip: ChipTone;
20  }
21
22  const ACTIONS: Record<string, ActionEntry> = {
23    // Bookings & assignments
24    booking_management_updated: { phrase: "updated booking", family: "bookings_and_assignments", chip: "pending" },
25    // Item 8 Phase 4. Registered explicitly so it does not inherit the fallback's
26    // miscategorisation — `recurring_series_cancelled` still renders through
27    // `describeAction` and lands in the wrong family, a pre-existing defect this
28    // deliberately does not repeat.
29    recurring_series_travel_fee_updated: { phrase: "updated series travel charge", family: "bookings_and_assignments", chip: "pending" },
30    booking_quick_confirm: { phrase: "confirmed booking", family: "bookings_and_assignments", chip: "confirmed" },
31    booking_quick_mark_paid: { phrase: "marked booking paid", family: "bookings_and_assignments", chip: "pending" },
32    booking_quick_cancel: { phrase: "cancelled booking", family: "bookings_and_assignments", chip: "cancelled" },
33    booking_quick_complete: { phrase: "completed booking", family: "bookings_and_assignments", chip: "pending" },
34    booking_assignment_claimed: { phrase: "claimed assignment for booking", family: "bookings_and_assignments", chip: "confirmed" },
35    booking_assignment_unassigned: { phrase: "unassigned therapist from booking", family: "bookings_and_assignments", chip: "cancelled" },
36    booking_assignment_reassigned: { phrase: "reassigned therapist for booking", family: "bookings_and_assignments", chip: "pending" },
37    booking_assignment_completed: { phrase: "completed assignment for booking", family: "bookings_and_assignments", chip: "pending" },
38    booking_assignment_no_show: { phrase: "marked assignment no-show for booking", family: "bookings_and_assignments", chip: "cancelled" },
39    manual_admin_booking_created: { phrase: "created booking", family: "bookings_and_assignments", chip: "confirmed" },
40    enquiry_converted_to_booking: { phrase: "converted enquiry to booking", family: "bookings_and_assignments", chip: "confirmed" },
41
42    // Clients & enquiries
43    client_created: { phrase: "created client", family: "clients_and_enquiries", chip: "confirmed" },
44    client_updated: { phrase: "updated client", family: "clients_and_enquiries", chip: "pending" },
45    client_deleted: { phrase: "deleted client", family: "clients_and_enquiries", chip: "cancelled" },
46    client_note_added: { phrase: "added a note to client", family: "clients_and_enquiries", chip: "pending" },
47    client_privacy_request_created: { phrase: "opened a privacy request for client", family: "clients_and_enquiries", chip: "pending" },
48    client_privacy_request_status_updated: { phrase: "updated privacy-request status for client", family: "clients_and_enquiries", chip: "pending" },
49    enquiry_created: { phrase: "created enquiry", family: "clients_and_enquiries", chip: "confirmed" },
50    enquiry_status_updated: { phrase: "updated enquiry status", family: "clients_and_enquiries", chip: "pending" },
51
52    // Staff & roles
53    staff_member_created: { phrase: "created staff member", family: "staff_and_roles", chip: "confirmed" },
54    staff_profile_updated: { phrase: "updated staff profile", family: "staff_and_roles", chip: "pending" },
55    staff_member_deactivated: { phrase: "deactivated staff member", family: "staff_and_roles", chip: "cancelled" },
56    staff_member_reactivated: { phrase: "reactivated staff member", family: "staff_and_roles", chip: "confirmed" },
57    staff_role_assigned: { phrase: "assigned role to staff member", family: "staff_and_roles", chip: "pending" },
58    // staff_availability_rules_updated / staff_permission_overrides_updated:
59    // reserved per RECON §6.2 as bulk-update event names. The singular
60    // *_created / *_deleted / *_updated variants are emitted by the per-action
61    // server actions in src/app/admin/staff/actions.ts and give finer forensic
62    // granularity than the bulk types.
63    staff_availability_rules_updated: { phrase: "updated availability rules for staff", family: "staff_and_roles", chip: "pending" },
64    staff_availability_rule_created: { phrase: "added an availability rule for staff", family: "staff_and_roles", chip: "confirmed" },
65    staff_availability_rule_deleted: { phrase: "removed an availability rule for staff", family: "staff_and_roles", chip: "cancelled" },
66    staff_permission_overrides_updated: { phrase: "updated permission overrides for staff", family: "staff_and_roles", chip: "pending" },
67    staff_permission_override_updated: { phrase: "updated a permission override for staff", family: "staff_and_roles", chip: "pending" },
68    role_created: { phrase: "created role", family: "staff_and_roles", chip: "confirmed" },
69    role_metadata_updated: { phrase: "updated role metadata", family: "staff_and_roles", chip: "pending" },
70    role_permission_toggled: { phrase: "toggled permission on role", family: "staff_and_roles", chip: "pending" },
71
72    // Services & settings
73    service_created: { phrase: "created service", family: "services_and_settings", chip: "confirmed" },
74    service_updated: { phrase: "updated service", family: "services_and_settings", chip: "pending" },
75    service_archived: { phrase: "archived service", family: "services_and_settings", chip: "cancelled" },
76    service_restored: { phrase: "restored service", family: "services_and_settings", chip: "confirmed" },
77    service_deleted: { phrase: "deleted service", family: "services_and_settings", chip: "cancelled" },
78    business_settings_updated: { phrase: "updated business settings", family: "services_and_settings", chip: "pending" },
79
80    // Availability (global)
81    availability_rule_created: { phrase: "created availability rule", family: "availability", chip: "confirmed" },
82    availability_rule_updated: { phrase: "updated availability rule", family: "availability", chip: "pending" },
83    availability_rule_deleted: { phrase: "deleted availability rule", family: "availability", chip: "cancelled" },
84    blocked_date_created: { phrase: "added a closure date", family: "availability", chip: "pending" },
85    blocked_date_deleted: { phrase: "removed a closure date", family: "availability", chip: "cancelled" },
86    availability_override_upserted: { phrase: "saved an availability override", family: "availability", chip: "pending" },
87    availability_override_deleted: { phrase: "removed an availability override", family: "availability", chip: "cancelled" },
88
89    // Operations & email
90    operational_event_status_updated: { phrase: "updated operations event status", family: "operations_and_email", chip: "pending" },
91    manual_booking_reminder_sent: { phrase: "sent a booking reminder", family: "operations_and_email", chip: "pending" },
92
93    // Reports & exports
94    report_exported: { phrase: "exported report", family: "reports_and_exports", chip: "restricted" },
95
96    // Account security (Brief 10)
97    password_reset_requested: { phrase: "submitted a password-reset request", family: "account_security", chip: "restricted" },
98    password_reset_request_lookup_failed: { phrase: "submitted a password-reset request (no matching account)", family: "account_security", chip: "restricted" },
99    password_reset_completed: { phrase: "completed password reset", family: "account_security", chip: "restricted" },
100   password_reset_token_rejected: { phrase: "rejected an expired or invalid reset token", family: "account_security", chip: "restricted" },
101   password_reset_approved: { phrase: "approved a password-reset request", family: "account_security", chip: "confirmed" },
102   password_reset_rejected: { phrase: "rejected a password-reset request", family: "account_security", chip: "cancelled" },
103 };
```

`ACTIONS` spans lines 22–103 inclusive (`const ACTIONS` opens at 22, closing `};` at 103).
Exact entry count, measured (not estimated):

```
$ grep -oP '^\s{2}\w+(?=: \{ phrase)' src/app/admin/audit/format.ts | wc -l
56
```

56 keys.

## 2. Is `review_email_sent` present in `ACTIONS` today? — VERIFIED ABSENT

```
$ grep -n "review_email_sent" src/app/admin/audit/format.ts
(no output, exit code 1)
```

The handoff's claim that it is absent is **correct**. `review_email_sent` also does not appear
anywhere else in `format.ts` (comments included) — confirmed by the same grep against the whole file.

### Every occurrence of the string `review_email_sent` in the repo (file:line)

```
$ grep -rn "review_email_sent" --include=*.ts --include=*.tsx src   [ + supabase/migrations via separate glob search ]
```

| File | Line | Context |
|---|---|---|
| `src/app/api/cron/review-emails/route.ts` | 173 | `action_type: "review_email_sent",` — the write site (cron sweep). Comment on line 171 already anticipates the manual-send batch: `// operator-driven manual send under the same action_type.` |
| `src/app/admin/clients/[clientId]/page.tsx` | 222 | `review_email_sent: "Review request email sent",` — local `AUDIT_PHRASING` map entry (see §3) |
| `src/lib/email/notifications.ts` | 1343, 1355, 1362, 1503, 1505, 1515, 1529, 1540, 1549, 1564, 1613, 1617, 1619 | all references to the **column** `bookings.review_email_sent_at` (the cooldown sentinel), not the audit `action_type` string — different symbol, same substring |
| `src/app/api/cron/__tests__/review-emails.test.ts` | 221, 250, 264, 278 | test fixtures/expectations for the cron route's audit write |
| `src/lib/email/__tests__/sendReviewRequestEmail.test.ts` | 94, 172, 174, 271, 273, 278, 301, 451, 462, 500 | all `review_email_sent_at` column references (test fixtures), not the action_type string |
| `supabase/migrations/20260729064606_c01_review_email_infrastructure.sql` | — | migration that added the `review_email_sent_at` column (not re-quoted here — out of this agent's write/verify scope, flagged for completeness only) |

**Plan-claim check on the client-detail line number:** the task brief says "plan says :222 —
relocate and verify." Relocated: it **is** line 222 in the file as it stands at HEAD 530d154.
No drift on this one claim — flagging that explicitly since 44 other plan claims have already
failed verification in prior sessions and this could easily have been another.

## 3. Local client-detail `AUDIT_PHRASING` map — verbatim, and the phrase/style question

File: `src/app/admin/clients/[clientId]/page.tsx`, lines 207–237:

```tsx
207 const AUDIT_PHRASING: Record<string, string> = {
208   client_created: "Client record created",
209   client_note_added: "Note added",
210   client_note_updated: "Note updated",
211   client_note_deleted: "Note deleted",
212   client_privacy_request_created: "Privacy request logged",
213   client_privacy_request_updated: "Privacy request updated",
214   booking_created: "Booking created",
215   booking_updated: "Booking updated",
216   booking_cancelled: "Booking cancelled",
217   booking_completed: "Booking completed",
218   booking_restored: "Booking restored",
219   booking_auto_promoted_completed:
220     "Booking auto-completed (all assignments complete)",
221   booking_quick_no_show: "Booking marked no-show",
222   review_email_sent: "Review request email sent",
223   email_resent: "Email resent",
224   notification_settings_updated: "Notification settings updated",
225   email_template_reset: "Email template reset to default",
226   email_template_test_sent: "Test email sent",
227   email_template_sent_manually: "Email template sent manually",
228   // C-02 Phase H (plan Step 25) — recurring-series audit rows. Anchored on
229   // literal keys, never a count: `recurring_series_created` (written by the
230   // `create_recurring_booking_series` RPC), `recurring_series_cancelled`
231   // (`cancelRecurringSeries`, recurring-actions.ts), `recurring_series_extended`
232   // (the horizon-extension cron, Phase G) — all three verified against what
233   // the code actually emits, not the plan's stale sketch.
234   recurring_series_created: "Recurring series created",
235   recurring_series_cancelled: "Recurring series cancelled",
236   recurring_series_extended: "Recurring series schedule extended",
237 };
238
239 function auditActionPhrase(actionType: string): string {
240   return AUDIT_PHRASING[actionType] ?? formatLabel(actionType);
241 }
```

For `review_email_sent` the local map's phrase is verbatim: **`"Review request email sent"`**
(title-case, full clause, no actor).

**Style conflict to flag, not a data conflict** — there is nothing in the global `ACTIONS` map to
literally conflict with (it's simply absent, per §2), but the two maps use different phrase
grammars and the new global entry must follow the *global* map's grammar, not copy the local
string verbatim:

- Local `AUDIT_PHRASING` (`client-detail` page): full title-case sentences — `"Review request email
  sent"`, `"Booking restored"`.
- Global `ACTIONS` (`format.ts`): lowercase verb-first fragments meant to follow an actor's name in
  a sentence — confirmed by `AuditEventCard.tsx` line 149 (`{actorName} {description.phrase}
  {targetTypeLabel(...)} ...`) and line 193 (`<span ...>{description.phrase}</span>` immediately
  after the actor name). E.g. `manual_booking_reminder_sent: { phrase: "sent a booking reminder", ... }`.

So the new `ACTIONS.review_email_sent` entry needs a phrase like `"sent a review-request email"`
(mirroring `manual_booking_reminder_sent`'s idiom exactly — same family fits too, see below), not
`"Review request email sent"` verbatim. This is a derivation, not a literal quote from source; flagging
it as such rather than dressing it up as "the code already told me the wording."

Family: `manual_booking_reminder_sent` (the closest sibling — another "operator/cron sends an email
to the client" action) is filed under `operations_and_email` with `chip: "pending"`. That is the
consistent choice for `review_email_sent` absent any brief text overriding it — no brief text for
this was in scope of this derivation task, so this is a recommendation for the implementer, not a
verified requirement.

## 4. `describeAction` fallback (verbatim, lines 105–115) and `ACTION_TYPES_BY_FAMILY` (lines 117–135)

```ts
105 export function describeAction(actionType: string): ActionEntry {
106   const known = ACTIONS[actionType];
107   if (known) return known;
108   // Defensive fallback for action types added between brief and runtime.
109   // Renders the raw label without underscores so the UI stays legible.
110   return {
111     phrase: actionType.replace(/_/g, " "),
112     family: "operations_and_email",
113     chip: "none",
114   };
115 }
116
117 // Inverse of describeAction's family field — used to expand a family filter
118 // into an `action_type IN (…)` list for SQL. Computed once at module load so
119 // the source of truth stays the ACTIONS map above.
120 export const ACTION_TYPES_BY_FAMILY: Record<ActionFamily, string[]> = (() => {
121   const map = {
122     bookings_and_assignments: [],
123     clients_and_enquiries: [],
124     staff_and_roles: [],
125     services_and_settings: [],
126     availability: [],
127     operations_and_email: [],
128     reports_and_exports: [],
129     account_security: [],
130   } as Record<ActionFamily, string[]>;
131   for (const [type, entry] of Object.entries(ACTIONS)) {
132     map[entry.family].push(type);
133   }
134   return map;
135 })();
```

**What an unregistered action type loses today**, concretely, for `review_email_sent` as it
currently stands:

1. **Family filter bucket**: `review_email_sent` is not in any `ACTION_TYPES_BY_FAMILY[...]` array
   (it's built purely from `ACTIONS`'s own keys). Per the existing test's own reasoning (see §6),
   narrowing the audit timeline to "Operations & email" via the family filter — which expands to
   `action_type IN (...)` in `queries.ts` line 116 — will **not** return `review_email_sent` rows.
   They will only surface when no family filter is applied.
2. **Chip tone**: falls back to `"none"` instead of a real tone (`confirmed`/`pending`/etc.), so the
   timeline card renders no status chip for these rows.
3. **Curated phrase**: falls back to `actionType.replace(/_/g, " ")` = `"review email sent"` (all
   lowercase, literal underscore-to-space swap) instead of a hand-written phrase. Coincidentally
   close to a decent phrase already, but it's the generic fallback, not curation.

## 5. Every `action_type` string literal written in `src/`, cross-checked against `ACTIONS`

Command used: `Grep pattern="action_type" path="src"` (content mode, all matches, no glob filter).
137 matching lines total across the repo (including type declarations, comments, and test files).
Below is the reduction to actual production write-sites (`.insert({ action_type: "..." })` or
equivalent), i.e. lines that actually persist an audit row — test files and type declarations are
excluded because they don't write real data.

### Full list of production write-sites, and their registration status

| action_type (as written) | Write site | Registered in `ACTIONS`? |
|---|---|---|
| `booking_management_updated` | `src/app/admin/bookings/actions.ts:581` | ✅ line 24 |
| `` `booking_quick_${action}` `` → `confirm`/`mark_paid`/`cancel`/`complete` (verified via the payload switch at `actions.ts:855` onward; `restore` short-circuits to `restoreBooking` at line 827, `no_show` is not a quick-action branch) | `src/app/admin/bookings/actions.ts:942` | ✅ all 4 realised values (`booking_quick_confirm/mark_paid/cancel/complete`) registered, lines 30–33 |
| `booking_assignment_claimed` | `src/app/admin/bookings/actions.ts:758` | ✅ line 34 |
| `` `booking_assignment_${status}` `` → `completed`/`no_show` (verified at `actions.ts:1401`) | `src/app/admin/bookings/actions.ts:1414` | ✅ both registered, lines 37–38 |
| `booking_assignment_unassigned` / `booking_assignment_reassigned` | `src/app/admin/bookings/actions.ts:1277` (ternary) | ✅ lines 35–36 |
| `booking_assignment_reassigned` | `src/app/admin/bookings/actions.ts:1697` | ✅ line 36 |
| `booking_restored` | `src/app/admin/bookings/actions.ts:1144` | ❌ **UNREGISTERED** |
| `booking_reschedule_reviewed` / `booking_reschedule_declined` | `src/app/admin/bookings/actions.ts:1479–1482` (ternary) | ❌ **UNREGISTERED** (both; no `booking_reschedule*` key anywhere in `format.ts`) |
| `booking_auto_promoted_completed` | `src/app/admin/bookings/actions.ts:265` | ❌ **UNREGISTERED** (only exists in the client-detail `AUDIT_PHRASING` local map, line 219) |
| `manual_admin_booking_created` | `src/app/admin/bookings/actions.ts:1650` | ✅ line 39 |
| `enquiry_converted_to_booking` | `src/app/admin/bookings/actions.ts:1746` | ✅ line 40 |
| `recurring_series_travel_fee_updated` | `src/app/admin/bookings/recurring-actions.ts:458` | ✅ line 29 (Item 8) |
| `recurring_series_cancelled` | `src/app/admin/bookings/recurring-actions.ts:295` | ❌ **UNREGISTERED** — documented as a known, deliberately-unfixed pre-existing defect in format.ts's own comment (lines 25–28) |
| `recurring_series_extended` | `src/app/api/cron/extend-recurring-horizons/route.ts:528` | ❌ **UNREGISTERED** |
| `review_email_sent` | `src/app/api/cron/review-emails/route.ts:173` | ❌ **UNREGISTERED** — this task's target |
| `manual_booking_reminder_sent` | `src/app/api/cron/booking-reminders/route.ts:152` | ✅ line 91 |
| `client_created` | `src/app/admin/clients/actions.ts:265` | ✅ line 43 |
| `client_updated` | `src/app/admin/clients/actions.ts:402` | ✅ line 44 |
| `client_deleted` | `src/app/admin/clients/actions.ts:546, 670` | ✅ line 45 |
| `client_note_added` | `src/app/admin/clients/actions.ts:821` | ✅ line 46 |
| `client_privacy_request_created` | `src/app/admin/clients/actions.ts:873` | ✅ line 47 |
| `client_privacy_request_status_updated` | `src/app/admin/privacy/actions.ts:68` | ✅ line 48 |
| `enquiry_created` | `src/app/admin/enquiries/actions.ts:101` | ✅ line 49 |
| `enquiry_status_updated` | `src/app/admin/enquiries/actions.ts:176` | ✅ line 50 |
| `staff_profile_created` | `src/app/admin/staff/actions.ts:251` | ❌ **UNREGISTERED** — `ACTIONS` has `staff_member_created` (line 53) instead; the two names do not match. Grepping the whole of `src` for `staff_member_created` finds **no write site at all** — it exists only as a dead `ACTIONS` key. |
| `staff_profile_updated` | `src/app/admin/staff/actions.ts:385` | ✅ line 54 |
| `staff_availability_mode_updated` | `src/app/admin/staff/actions.ts:441` | ❌ **UNREGISTERED** |
| `staff_availability_rules_updated` | `src/app/admin/staff/actions.ts:549` | ✅ line 63 |
| `staff_availability_rule_created` | `src/app/admin/staff/actions.ts:612` | ✅ line 64 |
| `staff_availability_rule_deleted` | `src/app/admin/staff/actions.ts:663` | ✅ line 65 |
| `staff_permission_override_updated` | `src/app/admin/staff/actions.ts:765` | ✅ line 67 |
| `blocked_date_created` | `src/app/admin/availability/actions.ts:195`, `src/app/admin/staff/[staffId]/availability/actions.ts:117` | ✅ line 84 |
| `blocked_date_deleted` | `src/app/admin/availability/actions.ts:236`, `src/app/admin/staff/[staffId]/availability/actions.ts:170` | ✅ line 85 |
| `availability_rule_updated` | `src/app/admin/availability/actions.ts:107` | ✅ line 82 |
| `availability_rule_deleted` | `src/app/admin/availability/actions.ts:151` | ✅ line 83 |
| `availability_override_upserted` | `src/app/admin/availability/actions.ts:337`, `src/app/admin/staff/[staffId]/availability/actions.ts:284` | ✅ line 86 |
| `availability_override_deleted` | `src/app/admin/availability/actions.ts:391`, `src/app/admin/staff/[staffId]/availability/actions.ts:344` | ✅ line 87 |
| `role_metadata_updated` | `src/app/admin/roles/actions.ts:70` | ✅ line 69 |
| `role_permission_revoked` / `role_permission_granted` | `src/app/admin/roles/actions.ts:181` (ternary) | ❌ **UNREGISTERED** — `ACTIONS` has `role_permission_toggled` (line 70) instead, which is never written anywhere in `src` |
| `service_created` | `src/app/admin/services/actions.ts:130` | ✅ line 73 |
| `service_updated` | `src/app/admin/services/actions.ts:183` | ✅ line 74 |
| `service_deleted` | `src/app/admin/services/actions.ts:239` | ✅ line 77 |
| `business_settings_updated` | `src/app/admin/settings/actions.ts:140` | ✅ line 78 |
| `operational_event_status_updated` | `src/app/admin/operations/actions.ts:60` | ✅ line 90 |
| `password_reset_requested` | `src/app/admin/password-reset/actions.ts:126` | ✅ line 97 |
| `password_reset_request_lookup_failed` | `src/app/admin/password-reset/actions.ts:136` | ✅ line 98 |
| `password_reset_token_rejected` | `src/app/admin/password-reset/actions.ts:196` | ✅ line 100 |
| `password_reset_completed` | `src/app/admin/password-reset/actions.ts:258` | ✅ line 99 |
| `password_reset_approved` | `src/app/admin/account-password-requests/actions.ts:214` | ✅ line 101 |
| `password_reset_rejected` | `src/app/admin/account-password-requests/actions.ts:346` | ✅ line 102 |
| `report_exported` | `src/app/admin/reports/export/route.ts:41` | ✅ line 94 |
| `notification_settings_updated` | `src/app/admin/me/actions.ts:96` | ❌ **UNREGISTERED** (exists only in client-detail `AUDIT_PHRASING`, line 224) |
| `email_resent` | `src/app/admin/emails/actions.ts:274` | ❌ **UNREGISTERED** (exists only in client-detail `AUDIT_PHRASING`, line 223) |
| `manual_booking_reminder_sent` | `src/app/admin/emails/actions.ts:73` | ✅ line 91 (duplicate write site of the cron one above) |
| `email_template_override_saved` | `src/app/admin/email-templates/actions.ts:203, 240` | ❌ **UNREGISTERED** |
| `email_template_reset` | `src/app/admin/email-templates/actions.ts:317` | ❌ **UNREGISTERED** (exists only in client-detail `AUDIT_PHRASING`, line 225) |
| `email_template_test_sent` | `src/app/admin/email-templates/actions.ts:547` | ❌ **UNREGISTERED** (exists only in client-detail `AUDIT_PHRASING`, line 226) |
| `customer_manage_note_added` | `src/app/booking/manage/actions.ts:96` | ❌ **UNREGISTERED** — public customer-facing "manage my booking" flow, `actor_staff_id: null` |
| `customer_booking_cancelled` | `src/app/booking/manage/actions.ts:160` | ❌ **UNREGISTERED** — same flow |
| `customer_reschedule_requested` | `src/app/booking/manage/actions.ts:235` | ❌ **UNREGISTERED** — same flow |

### Summary: action types written but NOT in `ACTIONS` (the completeness check this task asked for)

15 distinct unregistered strings (19 if `role_permission_revoked`/`role_permission_granted` and
`booking_reschedule_reviewed`/`booking_reschedule_declined` are counted individually rather than
per ternary):

1. `review_email_sent` — **this task's target**
2. `booking_restored`
3. `booking_reschedule_reviewed`
4. `booking_reschedule_declined`
5. `booking_auto_promoted_completed`
6. `recurring_series_extended`
7. `recurring_series_cancelled` — pre-existing, documented, deliberately not fixed by Item 8 (see format.ts comment lines 25–28)
8. `staff_profile_created` — naming drift vs. registered-but-dead `staff_member_created`
9. `staff_availability_mode_updated`
10. `role_permission_revoked`
11. `role_permission_granted` — naming drift vs. registered-but-dead `role_permission_toggled`
12. `notification_settings_updated`
13. `email_resent`
14. `email_template_override_saved`
15. `email_template_reset`
16. `email_template_test_sent`
17. `customer_manage_note_added`
18. `customer_booking_cancelled`
19. `customer_reschedule_requested`

Of these, only `review_email_sent` is in this task's assigned scope (`src/app/admin/audit/format.ts`,
registering exactly that one type). The other 14–18 are pre-existing gaps, several predating Item 8,
one (`recurring_series_cancelled`) explicitly acknowledged in-source as known and out of scope. Flagging
them here per the brief's explicit ask for a completeness check ("item 8 just shipped and may have
added some") — Item 8 in fact added exactly one new action type (`recurring_series_travel_fee_updated`)
and registered it correctly; none of the unregistered types above trace to Item 8. This list is
informational for the orchestrator, not a scope expansion of this Batch B task.

**Bonus finding (opposite direction, not asked for but relevant context):** 8 `ACTIONS` keys have no
write site anywhere in `src` today — they are registered but dead: `staff_member_created`,
`staff_member_deactivated`, `staff_member_reactivated`, `staff_role_assigned`, `role_created`,
`role_permission_toggled`, `service_archived`, `service_restored`. (Verified via `grep -n
"<key>" src -r` for each, restricted to `.ts` files, finding only the `format.ts` definition and,
for `staff_member_created`, nothing else at all.) Two of these (`staff_member_created`,
`role_permission_toggled`) look like renamed counterparts of the unregistered write-sites
`staff_profile_created` and `role_permission_revoked`/`role_permission_granted` above — plausibly a
brief-vs-implementation drift rather than two independent gaps, but not verified as such; noting the
correlation, not asserting the cause.

## 6. `src/app/admin/audit/__tests__/format.test.ts` — current state and idiom

Full file, verbatim (19 lines):

```ts
1  import { describe, expect, it } from "vitest";
2  import { ACTION_TYPES_BY_FAMILY, describeAction } from "../format";
3
4  describe("audit action taxonomy", () => {
5    // An action missing from the ACTIONS map falls through to describeAction's
6    // defensive fallback, which files it under `operations_and_email` and leaves
7    // it out of every other family's list. Because a family filter is expanded
8    // into `action_type IN (…)` (queries.ts), an unmapped `client_deleted` would
9    // vanish from "Clients & enquiries" — the one view an auditor narrows to when
10   // checking a GDPR erasure.
11   it("files client_deleted under clients & enquiries", () => {
12     expect(describeAction("client_deleted").family).toBe("clients_and_enquiries");
13   });
14
15   it("expands the clients family filter to include client_deleted", () => {
16     expect(ACTION_TYPES_BY_FAMILY.clients_and_enquiries).toContain("client_deleted");
17   });
18 });
```

Idiom for a new "labels review_email_sent" test: two assertions mirroring the existing pair — one on
`describeAction(...).family`, one on `ACTION_TYPES_BY_FAMILY[<family>]` containing the type — e.g.:

```ts
it("labels review_email_sent", () => {
  expect(describeAction("review_email_sent").family).toBe("operations_and_email");
});

it("expands the operations family filter to include review_email_sent", () => {
  expect(ACTION_TYPES_BY_FAMILY.operations_and_email).toContain("review_email_sent");
});
```

(Family choice `operations_and_email` follows §3's reasoning — sibling of
`manual_booking_reminder_sent` — not verified against any brief text, since none was in scope here.)

### Exact test run, this directory only

```
$ npx vitest run src/app/admin/audit --reporter=verbose

 ✓ src/app/admin/audit/__tests__/format.test.ts > audit action taxonomy > files client_deleted under clients & enquiries
 ✓ src/app/admin/audit/__tests__/format.test.ts > audit action taxonomy > expands the clients family filter to include client_deleted
 ✓ src/app/admin/audit/__tests__/audit-data.test.ts > getAuditPageData cache behaviour > runs the fetcher on a cache miss
 ✓ src/app/admin/audit/__tests__/audit-data.test.ts > getAuditPageData cache behaviour > does not re-run the fetcher on a cache hit
 ✓ src/app/admin/audit/__tests__/audit-data.test.ts > getAuditPageData cache behaviour > re-runs the fetcher after the audit tag is invalidated
 ✓ src/app/admin/audit/__tests__/audit-data.test.ts > getAuditPageData cache behaviour > keys separately per cursor, so page 2 never serves page 1
 ✓ src/app/admin/audit/__tests__/audit-data.test.ts > getAuditPageData cache behaviour > keys separately per filter set
 ✓ src/app/admin/audit/__tests__/audit-data.test.ts > getAuditPageData cache behaviour > returns a JSON-safe shape (staff is an array, not a Map)

 Test Files  2 passed (2)
      Tests  8 passed (8)
```

2 test files, 8 tests, all passing at HEAD 530d154. `format.test.ts` contributes 2 of the 8;
`audit-data.test.ts` (a different symbol, `getAuditPageData`, not covered by this task's scope)
contributes the other 6.

## Addendum — cross-checking `POST-BAND-C-FOLLOWUP-plan.md`'s own claims about this file

The task brief's method rules ask every plan/handoff claim to be treated as unverified. §1.8 and
related passages of `redesign/plans/POST-BAND-C-FOLLOWUP-plan.md` make several claims about
`format.ts` beyond what the task brief quoted. Checked all of them:

| Plan claim | Plan location | Verified? |
|---|---|---|
| `review_email_sent` "already exists and is labelled on the client detail page's local map (`.../page.tsx:222`)" | line 283 | ✅ correct, confirmed §2 above |
| `ACTIONS` map location for item 8's registration question, "`format.ts:22-35`" | line 326 | ✅ consistent — item 8's `recurring_series_travel_fee_updated` entry landed at line 29, inside that range |
| `booking_management_updated` "already registered in `src/app/admin/audit/format.ts:24`" | lines 2826, 3047–3048 | ✅ correct — still line 24 |
| New format.test.ts test should be named to prove `review_email_sent` is "labelled ... instead of falling back to the generic operations_and_email **phrase**" | line 399 | Informational, not a location claim — confirms the intent is a curated *phrase* (not necessarily a different *family*; the fallback's family is already `operations_and_email`, so my §3 recommendation to keep the family as `operations_and_email` while giving it a real phrase and chip is consistent with this, not contradicted by it |
| `describeAction` fallback at **"lines 100–110"** | lines 3050, 3066 | ❌ **FAILED — drift found.** `describeAction` is actually at **lines 105–115** in the file as it stands at HEAD 530d154 (verified in §4 above). Off by exactly 5 lines — explained by Item 8's own addition at lines 25–29 (a 4-line comment block + 1 new `ACTIONS` entry = 5 lines), which pushed everything below it down by 5. The plan text was evidently written before, or without re-verifying after, that shift. |

This is the "another one" the task brief predicted: one more plan line-number claim that doesn't
hold at current HEAD, with a traceable cause (Item 8's own edit shifting the file).

## Repo-gate cross-check (informational, not this task's job to fix)

Per the memory baseline (`5/2295 known-flaky vitest`), this directory's 8/8 pass is consistent —
none of the 5 named pre-existing failures live under `src/app/admin/audit/`. Not independently
re-verified against the full 2295 here — out of scope for this derivation (single-directory grep
task).
