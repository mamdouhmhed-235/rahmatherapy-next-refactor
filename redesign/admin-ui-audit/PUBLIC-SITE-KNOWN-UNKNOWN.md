# ✅ ANSWERED — the customer homepage is fine

**Question closed** 2026-09-03. **Nothing is broken. No change was made and none
is needed.**

---

## The question

While repairing the admin, the public pages were measured as a safety check. The
check reported **645 elements past the right edge of `/home` at 320px**, hidden
by the `overflow-x: hidden` rule on `html, body`. Nobody had ever looked at what
those elements were.

It mattered because these are the pages customers **book** on — a fault there
costs money, not staff time — and because the standard overflow metric reads
**0 by construction** on a masked page, so the usual check cannot see anything.

---

## How it was answered

⛔ Not by looking at screenshots. A 15,000px-tall page scaled into a thumbnail
proves nothing. The decisive test was the same one that exposed the admin's
problems: **lift the mask inside the live page and re-measure.**

```
                 mask ON              mask LIFTED
  320px      scrollWidth 320   →   scrollWidth 320   → real overflow 0px
  375px      scrollWidth 375   →   scrollWidth 375   → real overflow 0px
  414px      scrollWidth 414   →   scrollWidth 414   → real overflow 0px
```

⛔ **That single result closes the question.** With `overflow-x: hidden` removed
the document does not get one pixel wider. The rule is not hiding a fault — there
is nothing behind it to hide.

---

## What the overhanging elements actually are

404 elements sit past the 320px edge. Every one is accounted for:

| count | what it is | verdict |
|---|---|---|
| **264** | inside `overflow-x: auto` containers that genuinely scroll | swipeable carousels, working as designed |
| **129** | `<path>` elements inside `<svg>` | decorative vector internals, clipped by their own SVG viewBox |
| **15** | testimonial `<p>` in the reviews strip | see below |
| **0** | escaping every clipping ancestor | **nothing is loose** |
| **0** | carrying their own visible text and unreachable | **no content is lost** |

The 15 testimonials looked like the one real concern. They are not. Their
ancestor chain, measured live:

```
 0  <div> overflow-x:hidden   min-h-24 transition-[max-height]   ← collapsed "read more"
 1  <div> overflow-x:visible  w-[19rem] shrink-0                 ← one review card
 2  <div> overflow-x:auto     scrollable YES  7796px / 280px     ← the carousel, cursor-grab
 4  <section> overflow-x:hidden                                   ← section padding
```

They are collapsed review cards inside a **horizontally swipeable carousel**.
Their overhang values step up in ~324px increments — one card width each — which
is exactly what a carousel of slides looks like from the outside.

---

## Verdict

**The 645 was a false-positive count, not a defect.** It counted every element
that happens to sit right of the fold inside a carousel or an SVG — which on a
page built from horizontal scrollers is most of them.

⛔ **Do not remove `overflow-x: hidden` from the public site on the strength of
this.** The measurement says the homepage does not need it today; it says nothing
about whether some future change would. It is cheap insurance and the admin now
has its own scoped exemption (`html:not(:has(.admin-shell))`), so the two sites
no longer share one decision.

## What this did NOT cover

⚠️ Honest limits of a 20-minute answer:
- Only `/home` was interrogated this way. Every other public route already
  measured **0 elements past the edge**, so there was nothing to investigate.
- This is a **geometry** answer. It proves nothing is pushed off-screen or
  clipped away. It is **not** a design review, and it says nothing about whether
  the booking journey reads well, converts, or is pleasant to use.
- Emulated Chromium at 320/375/414. No real handset.

Evidence: `probe-public-home.mjs`, `_public-home-probe.json`, and the existing
screenshots in `canary/after/`.
