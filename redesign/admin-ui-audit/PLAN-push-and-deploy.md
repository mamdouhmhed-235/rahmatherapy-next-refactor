# PLAN — push 70 commits to live, keep maintenance mode on

**Status:** ✅ **EXECUTED 2026-09-03.** Owner said "push it". Pushed
`fdeb273..03e6d83`, 70 commits; Cloudflare rebuilt automatically.
**Verified three times, spaced: 8/8 PASS every time.** The new build is proven
live — the served stylesheet contains `:is(p,h1,h2,h3).truncate{text-wrap:nowrap}`,
a rule committed today. Maintenance banner present, **zero** booking dialogs
mounted, database still `BASELINE EXACT`.
**Written** 2026-09-03 · HEAD `03225c0`→`03e6d83` · 70 commits ahead, **0 behind**
**Owner's requirement, verbatim:** *"i still want the maintenance mode maintained
in the live site, but not locally"*

---

## 1. The short answer

**Your requirement is already how the system is built. The push preserves it by
doing nothing.**

`src/lib/maintenance.ts:34`

```ts
export const MAINTENANCE_MODE = process.env.NEXT_PUBLIC_BOOKING_ENABLED !== "true";
```

It is **opt-OUT**. Anything other than the exact string `"true"` — absent, empty,
`TRUE`, `1`, a typo — leaves maintenance **ON**.

| | flag | result |
|---|---|---|
| **Local** | `.env` sets it `true` | booking works |
| **Live** | `.env` is gitignored, so it is simply **absent** | **booking page closed** |

⛔ **Absence is the control.** Nothing is configured anywhere to hold the live
site closed. That is why local and live differ with zero setup — and why a push
cannot change it.

---

## 2. Verified myself, not taken from a document

Several documents in this repo are **stale and say the opposite** (see §6). Every
line below was measured today.

| Check | Result |
|---|---|
| `.env` tracked by git? | **No.** Only `.env.example`, which never mentions the flag |
| `NEXT_PUBLIC_BOOKING_ENABLED` in any committed config? | **Nowhere** — `wrangler.jsonc` has no `vars` block at all |
| Build output committed? | **No** — `.open-next/` is gitignored, so Cloudflare builds from source |
| Do the 70 commits touch any switch, config or env file? | **No.** 47 files: 44 admin-only + 3 shared |
| Branch state | **70 ahead, 0 behind** — clean fast-forward |
| Live site right now | banner present ×2, **0 booking dialogs mounted** |
| `business_settings.booking_status_enabled` | **`true`** (read from the live database today) |

### The three shared files, examined individually

- **`site-parity.css`** — rescopes `body { overflow-x: hidden }` to
  `html:not(:has(.admin-shell)) body`. On a customer page there is no admin
  shell, so the selector still matches: **behaviour identical**.
- **`london.ts`** — **pure addition**, 16 insertions, 0 deletions.
- **`globals.css`** — exactly **one** rule is not admin-scoped:
  `:is(p,h1,h2,h3).truncate { text-wrap: nowrap }`. I grepped all **28 rendered
  public pages**: **zero** matches. It cannot reach a customer.

Corroborated by the public canary already on disk: **26 of 28 cells identical**,
the two differences being a background-video "Pause"/"Play" label captured in
different states.

---

## 3. ⛔ The one thing that would actually break it

**`pnpm deploy` builds on THIS machine**, which means my local `.env` — with
`NEXT_PUBLIC_BOOKING_ENABLED=true` — gets **inlined into the production bundle**
and **opens bookings on the live site**.

`package.json` exposes three such commands:

```
deploy   opennextjs-cloudflare build && opennextjs-cloudflare deploy
upload   opennextjs-cloudflare build && opennextjs-cloudflare upload
preview  opennextjs-cloudflare build && opennextjs-cloudflare preview
```

⚠️ **README.md documents only this manual path and never mentions the git
auto-deploy** — which is exactly how someone reaches for the wrong one.

> ⛔ **THE RULE: deploy by `git push` and nothing else.**
> Never `pnpm deploy`, never `pnpm upload`, never `opennextjs-cloudflare deploy`.

---

## 4. The procedure

### Step 0 — re-measure (nothing is trusted from this conversation)

```bash
node --env-file=.env scripts/verify-baseline.mjs
corepack pnpm exec tsc --noEmit
corepack pnpm exec vitest run
git rev-list --count origin/master..HEAD    # expect 70
git status --short                          # expect only untracked redesign/
```

⚠️ **If you run `pnpm build` as part of this, run `git status` afterwards.** The
build regenerates `src/lib/media/image-manifest.ts`. If it changed, **commit it** —
the push becomes 71 commits, which is correct, not a mistake.

### Step 1 — capture the "before" (already done, re-runnable)

```bash
node scripts/verify-live-after-deploy.mjs
```
Currently **8/8 PASS**. This is the calibrated baseline.

### Step 2 — push

```bash
git push origin master
```

⛔ **Stage nothing.** No `git add .`, no `-A`, no `-u`, no `commit -am` — this
repo has a recorded history of that going wrong. There is nothing to stage; the
commits already exist.

⚠️ `Bash(git push *)` was deliberately removed from the permission allow-list
(D-050), so this **will prompt**. That is the intended safety gate, not a fault.

### Step 3 — wait for Cloudflare, then verify

Deploy takes roughly **3 minutes**. Then:

```bash
node scripts/verify-live-after-deploy.mjs
```

⛔ **All 8 checks must still pass.** The one that matters most:

> `booking dialog is NOT mounted` — **must stay 0.**
> If it ever reads non-zero, **bookings are open on the live site.**

⚠️ **Sample three times, spaced a minute apart.** Cloudflare points of presence
serve different versions during a rollout, and the edge cache is
`s-maxage=31536000` (one year) — whether a deploy purges it is **not known**.
One green result is not proof.

⚠️ Use `curl -sLI`, never `curl -I`. `/home` answers `308` to `/home/`, and a
previous run wrongly reported every security header missing because of exactly
this.

### Step 4 — if something is wrong

⛔ **Do NOT try to fix forward by deploying locally.** That is the one action that
opens bookings.

- **If bookings opened:** confirm `NEXT_PUBLIC_BOOKING_ENABLED` is **not** set in
  the Cloudflare **build** environment, remove it if it is, and redeploy from a
  clean `git push`.
- **Otherwise:** roll back to the previous Worker version in the Cloudflare
  dashboard.
  ⚠️ **Rollback has never been rehearsed on this project, and how many prior
  versions Cloudflare retains is unknown.** Treat it as untested.

---

## 5. ⛔ Traps — every one of these has bitten this project before

| Trap | Why it bites | Avoid |
|---|---|---|
| **`pnpm deploy` locally** | Inlines your `.env` → opens bookings | `git push` only |
| **Setting the flag in Cloudflare "to be explicit"** | That IS the act that opens bookings | Change nothing in Cloudflare |
| **Setting `NEXT_PUBLIC_*` as a Cloudflare *runtime* variable** | `NEXT_PUBLIC_*` is baked in at **build** time; a runtime var does nothing | If ever opening bookings: **build** environment **+ redeploy** |
| **`git add .` / `-am`** | Recorded history of sweeping up unintended files | Stage by explicit path |
| **Probing the live booking endpoint "to check"** | The last probe **created a real booking and emailed the Owner** | Do not probe. D31 already established the state |
| **`curl -I` on a redirecting URL** | Reports every header absent — looks like a regression you caused | `curl -sLI` |
| **One post-deploy request as the verdict** | PoPs and a 1-year edge cache | Sample 3×, spaced |
| **"Fixing" the lint errors first** | They are the accepted baseline | Leave them |
| **Filesystem APIs (`fs`, `process.cwd()`)** | Work locally, fail totally on Workers — **the one deploy that demonstrably went wrong**: ~210 photos became placeholders | None added here; nothing to do |

---

## 6. ⛔ Documents that are STALE — do not act on them

At least **nine** documents still say a push opens live bookings. **They are
wrong.** They describe a hardcoded `MAINTENANCE_MODE = true` that commit
`3eb2939` deleted and `8243d87` replaced with the opt-out flag on **2026-08-30**.

Stale: `handoff/CONTEXT.md:21-22` · `handoff/HANDOFF.md:147,253` (its own banner
contradicts its body — **read lines 1-11 first**) · `AGENTS.md` · gate 19
`RESULT.md:37` · `redesign/evidence/checkpoint-3/post-deploy-runbook.md §0` ·
D-015 · D-050 · plus five session handoffs.

⛔ **Trust `src/lib/maintenance.ts:34` and `git diff` over any prose in this
repo.**

⚠️ My own `DEFERRED-ISSUES.md` reached the right conclusion for the **wrong
reason** ("held closed by a database row and a Cloudflare setting"). Corrected
2026-09-03.

---

## 7. ⛔ Name the surface — there are TWO switches

| Surface | Held by | State today |
|---|---|---|
| Booking **PAGE** | `NEXT_PUBLIC_BOOKING_ENABLED` (build-time, absent live) | **CLOSED** ✅ |
| Booking **ENDPOINT** `POST /api/bookings` | `business_settings.booking_status_enabled` (database row) | **OPEN** ⚠️ |

The endpoint has **no maintenance guard at all** — only a rate limit, a body cap,
a honeypot and schema validation.

⛔ **This is a decision, not an oversight.** On 2026-08-30 you were shown the
endpoint was still reachable and chose **"option C: leave it"** (D31). It is
recorded as *"Do not re-open it."* I raise it here only because you asked for
maintenance mode to be maintained, and precision about *which* surface matters.

**A customer's experience today, and after this deploy:** the "Book Now" buttons
still render and look clickable — they are not gated — but clicking one navigates
to `?booking=1` and **nothing opens**, because the dialog component never mounts.
The banner explains why and gives the phone number.

---

## 8. ⚠️ What I cannot verify, and what I did instead

**The Cloudflare dashboard.** Gate 19 is the one **BLOCKED** gate — it needs your
login. So **nobody has ever confirmed from inside Cloudflare** that
`NEXT_PUBLIC_BOOKING_ENABLED` is absent from the build environment.

**The strongest available substitute:** the live site **right now** serves the
maintenance banner and **zero booking dialogs**. That is only possible if the
build that produced it did not have the flag set to `"true"`. Since this push
changes no config, no env file and no switch, the next build has the same inputs.

⚠️ **That is inference from behaviour, not confirmation from the dashboard.** If
you want certainty, check the Cloudflare build environment yourself before
approving — it is the only thing that would close this gap.

Also unverified, all dashboard-only: which branch the git integration is set to,
the build image's Node version, whether the four crons fire, whether `CRON_SECRET`
is set, and how many versions are retained for rollback.

---

## 9. What is NOT in this plan

- **No staff-account work.** That is `G1`, and your decision was **at go-live**,
  separately, by you — it needs credentials no agent may handle.
- **No Cloudflare changes.** Nothing.
- **No database changes.**
- **No deferred work.** Per your 2026-09-03 instruction, everything else waits.

---

## 10. ⛔ Authority note

The newest recorded instruction before today is **"keep holding"** (2026-09-03),
and standing rule **D13** says: *"next agent should wait for me to give it
permission before implementing anything"* — plan, verify, report, then **stop**.

⛔ **So this plan is not self-authorising.** Your message asking for a push plan
supersedes "keep holding" only if you say so explicitly. **I will not push until
you tell me to.**
