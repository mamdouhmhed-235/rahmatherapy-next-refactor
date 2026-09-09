# PLAN — push the staff-login feature live, keep maintenance mode ON

**Written** 2026-09-09
**Status:** ⛔ **PLAN ONLY. Nothing committed, nothing pushed.**

---

# ⛔ THE ONE RULE

> ## Deploy by `git push` and NOTHING else.
> **Never `pnpm deploy`. Never `pnpm upload`. Never `opennextjs-cloudflare deploy`.**

**Why this is the whole plan in one line:**

`pnpm deploy` **builds on this machine**, so it inlines **this machine's `.env`** —
which contains `NEXT_PUBLIC_BOOKING_ENABLED=true`. That would bake "bookings open"
into the production bundle and **take the clinic live for online booking**.

`git push` makes **Cloudflare** build. Cloudflare's environment does **not** have that
variable, so the build comes out with bookings closed — exactly like the one serving
the site right now.

---

# Why maintenance mode cannot break, verified today

`src/lib/maintenance.ts:34`

```ts
export const MAINTENANCE_MODE = process.env.NEXT_PUBLIC_BOOKING_ENABLED !== "true";
```

⛔ **It fails SAFE.** Anything other than the exact string `"true"` — absent, empty,
`"TRUE"`, `"1"`, a typo — leaves maintenance **ON**. Opening bookings requires someone
to deliberately set that exact value in Cloudflare.

| Check | Result today |
|---|---|
| Is the variable in any committed config (`wrangler.jsonc`, `next.config.ts`, `open-next.config.ts`)? | ⛔ **No — nowhere** |
| Does this change touch `maintenance.ts`, the banner, or the booking flow? | ⛔ **No.** 12 files, all admin-side |
| Does the live site show the banner right now? | ✅ **Yes** — *"This website is still being built — online booking is not yet available."* |
| Booking dialog on the live site? | ✅ **None** |

⚠️ **The genuine limit:** nobody has ever confirmed from **inside the Cloudflare
dashboard** that the variable is absent — that check needs the Owner's login and has
always been the one blocked gate. The strongest available evidence is the live site
itself: it serves the banner and no dialog, which is only possible if the build that
produced it did not have the flag set.

---

# ⚠️ There are TWO switches. Only one is "maintenance mode".

| Surface | Held by | State | Changed by this push? |
|---|---|---|---|
| Booking **PAGE** | `NEXT_PUBLIC_BOOKING_ENABLED` (build-time, absent live) | **CLOSED** ✅ | ⛔ **No** |
| Booking **ENDPOINT** `POST /api/bookings` | `business_settings.booking_status_enabled` (database) | **OPEN** ⚠️ | ⛔ **No** |

⛔ **The open endpoint is your own decision (D31, 2026-08-30), recorded as "do not
re-open it."** I verified the row today: `booking_status_enabled = true`. It is
reachable by a direct POST, though nothing on the website leads a customer there.

**Not raised as a fault** — raised because "maintenance mode" is often assumed to mean
both, and it means the page.

---

# What is being pushed

**12 files** — every one admin-side. Nothing public-facing, nothing in the booking flow.

| Area | Files |
|---|---|
| **New feature** — create a staff login in the admin | `staff/actions.ts`, `staff/NewStaffForm.tsx`, `lib/auth/password-policy.ts` *(new)* |
| **Reset loop** — link shown on screen, ordering fixed | `account-password-requests/actions.ts`, `ApproveModal.tsx` |
| **Status page** — tells the truth instead of "still waiting" | `password-reset/page.tsx`, `password-reset/actions.ts`, `SetNewPassword.tsx` |
| **Audit labels** | `audit/format.ts` |
| **Tests** | 2 test files, 9 new specs |
| **Baseline** | `scripts/verify-baseline.mjs` rebaselined after the 2026-09-03 wipe |

Plus untracked docs under `redesign/admin-ui-audit/` and `scripts/verify-live-after-deploy.mjs`.

---

# The steps

### 1. Commit
Several focused commits, not one lump — feature, bug fixes, tests, docs.
⛔ On `master`, matching this project's existing history.

### 2. ⛔ Pre-push gate — all must pass
- `npx tsc --noEmit` → 0
- `npx vitest run` → all green
- `npx eslint src/` → no NEW problems (6 pre-existing in booking/home files)
- `git diff origin/master --stat` → ⛔ **no file outside the list above**
- ⛔ **`git diff` must show `maintenance.ts` untouched**

### 3. Push
```
git push origin master
```
⚠️ Nothing else. No build command, no deploy command.

### 4. Wait for Cloudflare to build, then verify LIVE
- ⭐ **The banner is still there** — *"online booking is not yet available"*
- ⭐ **No booking dialog mounts** on `?booking=1`
- The admin login page loads
- `scripts/verify-live-after-deploy.mjs` passes

### 5. ⛔ If bookings are open after the deploy
1. Cloudflare → Settings → Variables → **delete `NEXT_PUBLIC_BOOKING_ENABLED`**
2. Redeploy from the Cloudflare dashboard
⚠️ It cannot come from this repo — the variable is in no committed file.

---

# ⛔ What the Owner still has to do

**Change the password.** `rahmatherapy@outlook.com` is the only account, holds all 40
permissions, and its password is published in a **public** repo — in `docs/users-credentials`
and 14 other files, downloadable anonymously today. **None of this work touches that.**

> Supabase → Authentication → Users → `rahmatherapy@outlook.com` → Update password

⚠️ Pushing does not make it worse. It does not make it better either.
