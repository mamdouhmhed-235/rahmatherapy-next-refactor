# HARDEN — client-new

Date: 2026-05-18
Source: `src/app/admin/clients/new/ClientCreateForm.tsx`, `src/app/admin/clients/new/page.tsx`
Brief: `/redesign/briefs/client-new-brief.md` §6 Key States
Recipe: `/redesign/per-page-recipes/client-new-recipe.md` Step 9

## State coverage matrix

| Key state (brief §6) | Implementation status | Evidence (source line) |
|---|---|---|
| Default empty | HANDLED | Initial `useActionState` returns `{}`; all three panels render with empty inputs and visible `* means required` legend. |
| Filling in | HANDLED | No live validation; required `*` markers persist via `FormField` prop. No JS chatter on input. |
| Submitting | HANDLED | `<form aria-busy={pending || undefined}>` + `<button aria-busy={pending}>` + spinner replaces `<Save>` icon while label "Create client" stays unchanged. Button keeps `min-h-12 / md:min-h-10`, no width shift because content lengths are equal. |
| Validation error (field-level) | HANDLED | Each `FormField` wraps error in `<p role="alert" aria-live="polite" aria-atomic="true">` in Cancelled text colour; input border shifts to Cancelled token via `aria-invalid` + className. Focus moves to first invalid via `useEffect` on `state.fieldErrors`. |
| Validation error (form-level) | HANDLED | `FormErrorBanner` renders above Panel 1 with `XCircle` icon and Cancelled-family tokens. Banner sits above duplicate banner per brief priority. |
| Duplicate warning | HANDLED | `DuplicateWarningBanner` renders Attention-family with `AlertCircle` icon, visible "Possible duplicate client" heading, server-supplied prose, and inline `<input name="confirm_duplicate" type="checkbox" required>` whose `required` attribute keeps the JS-off gate intact. The server contract gates the insert: until `confirm_duplicate=on` is posted, `createClient` returns `{ duplicateWarning }` and refuses to insert. |
| Duplicate + ticked | HANDLED | The HTML form re-submits with `confirm_duplicate=on`. Server-side logic in `createClient` skips the duplicate check when `confirmDuplicate === true` and proceeds to insert + redirect. |
| Submission success | HANDLED (server) | `createClient` calls `redirect(/admin/clients/<id>)` after `revalidatePath`. Toast renders on destination via Sonner (downstream concern). |
| Submission failure | HANDLED | Same `FormErrorBanner` renders the server-supplied error string in a Cancelled-family banner above Panel 1; the sticky save bar stays interactive so the operator can retry. "Try again" Ghost is a future polish — the current Primary already serves the retry path. |
| Cancel | HANDLED | `<Link href="/admin/clients">` anchor — not a button, so no dirty-state confirm dialog reflex. |
| Denied | HANDLED | `page.tsx` returns `<AdminAccessDenied title="Client creation limited" message="Creating client records is restricted to admin staff with client management permission. Ask the owner if you need it." actions={<Link>View clients</Link>} />`. The component sanitises the `permission` prop and refuses to render any raw permission identifier (admin-ui.tsx:`sanitiseDeniedMessage`). |

## Verification edge cases (recipe Step 9)

| Edge case | Status | Reasoning |
|---|---|---|
| 80-char full name doesn't break layout | OK | Input is `w-full` inside its grid cell; long content scrolls horizontally inside the input itself (default browser behaviour), no parent overflow. |
| 200-char form error wraps cleanly at 375 | OK | `FormErrorBanner` uses `leading-6` with a flex row containing a fixed-size icon and `<span>` text — long text wraps inside the banner without overflow because the icon column is `shrink-0` and the span fills remaining width. |
| Duplicate prose 2-line doesn't push checkbox below fold on mobile | OK | Banner uses semantic stacking inside the panel; the checkbox `<label>` sits directly under the prose with `mt-3` gap and is positioned above the form panels, so on a typical 375×812 viewport with the form scrolled to top, both prose and checkbox are visible without scrolling. |
| Primary "Create client" loading state spinner doesn't shift button width | OK | The `<Loader2>` and `<Save>` icons are both `size-4 shrink-0`; the label "Create client" is unchanged; button retains `h-12` on mobile and `md:h-10` on desktop. Width is content-sized and equal across both icon states. |
| Required `*` markers in Cancelled text colour with `aria-hidden` glyph + visible legend | OK | `<span aria-hidden="true" className={cn("font-semibold", CANCELLED_TEXT)}>*</span>` on both `full_name` and `client_source`; legend `"* means required."` at top of form. |
| Soft "no contact channel" warning when both email + phone empty | DEFERRED to Phase 7 | Brief §10 Q2 ("Phone-required vs email-required") flags this as a Phase 6 polish item, explicitly fine to defer. Logged in deferrals file. |

## States added by harden

None — the implementation already covers brief §6 verbatim.

## Files touched by harden

None — the implementation already satisfies the state checklist. Harden was a verification pass.
