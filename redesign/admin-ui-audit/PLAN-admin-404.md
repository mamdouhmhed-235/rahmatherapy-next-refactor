# PLAN — the admin's bare 404 (six routes, not one)

**Status:** ✅ **DONE 2026-09-03** — commit 89567e4, one new file: src/app/admin/not-found.tsx.
Verified on all 6 routes at 320 and 1280: admin shell present, 10 navigation links
(was 0), a working way back, zero overflow. See §3 for the measurement.
**Written** 2026-09-03 · at HEAD `bc6e5e8`
**Size:** small — one new file, no changes to existing pages.

---

## 1. What is actually wrong

Verified at HEAD, not inherited from the earlier research:

```bash
find src -name "not-found.tsx"     # returns NOTHING
```

**There is no `not-found.tsx` anywhere in the application.** Next.js therefore
falls back to its own built-in 404: a white page, default system font, no admin
shell, no navigation, no sign-out, no link back. A signed-in member of staff who
reaches one is stranded — on a phone there is not even a browser chrome back
button in a PWA-style view.

The earlier note called this "one remaining path". It is **six**:

| # | Route | Trigger | File |
|---|---|---|---|
| 1 | `/admin/clients/[clientId]` | client missing **or soft-deleted** | [page.tsx:444](src/app/admin/clients/[clientId]/page.tsx:444) |
| 2 | `/admin/clients/[clientId]/edit` | client missing **or soft-deleted** | [page.tsx:81](src/app/admin/clients/[clientId]/edit/page.tsx:81) |
| 3 | `/admin/emails/templates/[templateId]` | unknown template id | [page.tsx:67](src/app/admin/emails/templates/[templateId]/page.tsx:67) |
| 4 | `/admin/roles/[roleId]` | unknown role id | [page.tsx:89](src/app/admin/roles/[roleId]/page.tsx:89) |
| 5 | `/admin/staff/[staffId]/availability` | unknown staff id | [page.tsx:92](src/app/admin/staff/[staffId]/availability/page.tsx:92) |
| 6 | `/admin/staff/[staffId]/performance` | unknown staff id | [page.tsx:87](src/app/admin/staff/[staffId]/performance/page.tsx:87) |

⚠️ Route 1 is not hypothetical. A therapist assigned to a booking whose client
was later soft-deleted reaches it by clicking a client link in their own booking.

✅ **Already fixed and not part of this:** the *access-denied* case on route 1.
Commit `f3317be` reordered the permission refusal ahead of the existence check,
so a therapist without access now gets the styled refusal screen instead of a
404. Only the genuinely-missing / deleted case still falls through.

---

## 2. The fix

**One new file:** `src/app/admin/not-found.tsx`.

Next.js resolves `not-found.tsx` from the nearest route segment upward, so a
single file placed at the `admin/` segment covers **all six routes at once** and
leaves the public site's behaviour untouched.

It should render inside the admin chrome and say three things:
1. what was not found, in plain words ("That client record no longer exists");
2. **why**, when it is knowable — a deleted client is a different situation from
   a mistyped URL, and staff will otherwise assume the system is broken;
3. a way onward — a link back to the section they came from, plus the dashboard.

⚠️ **The one design constraint:** `not-found.tsx` renders inside `admin/layout.tsx`,
so the shell, nav and bottom tab bar come for free — but it must not assume any
page-level data. Keep it presentational.

⚠️ Do NOT add a root `src/app/not-found.tsx` in the same change. That would also
capture unmatched **public** URLs and change what customers see on a bad link.
That is a separate decision, and the public site is unaudited
(`PUBLIC-SITE-KNOWN-UNKNOWN.md`).

---

## 3. How it gets proved

The audit rule stands: **a fix whose measurement did not move is not a fix.**

1. **Before:** capture the six routes with deliberately invalid ids at 320 / 768 /
   1280 and record what renders. Expected: a bare white page, no `.admin-shell`
   in the DOM, zero navigation links.
2. **After:** the same six routes must show the admin shell present, a working
   link back, and no horizontal overflow at 320.
3. The metric that must move: **navigation links reachable from the 404 page,
   0 → non-zero.** That is the actual harm — being stranded — and it is
   measurable rather than a matter of taste.
4. `tsc`, `vitest`, and a production build must stay clean; 1280 must not regress.

⛔ Use invalid ids only — a made-up UUID. Do not soft-delete a real client to
produce the state.

---

## 4. Why it is worth doing

It is one file, it needs no changes to any existing page, and it removes a
dead-end from six routes at once — including one a therapist can reach through
ordinary use.

Not urgent: reaching these states requires a stale link, a deleted record or a
hand-edited URL. It is a papercut with an unusually good effort-to-benefit ratio,
not an outage.
