# HARDEN — email-templates

`/impeccable harden` recommendations applied to the email-templates redesign.

## Resilience matrix (after harden pass)

### Text overflow / wrapping

- ✓ Card name: `truncate` on H3 → ellipsis on overflow
- ✓ Trigger description: `line-clamp-2` with `leading-relaxed` for two-line breathing room
- ✓ Variable-list error: relocated under a `<details>` toggle inside the role=alert region so the long allowed-variables list doesn't overflow narrow viewports
- ✓ Saved-time label: native `title` shows absolute timestamp with locale-aware formatting; visible label is relative

### Input validation

- ✓ Per-field `maxLength` enforced client-side + live counter under each input
- ✓ Variable-token unknown-name detection with the user's first violation surfaced; full allowed list one expand-click away
- ✓ Server action regex-blocks `<script`, `</script`, `<iframe` and returns documented copy
- ✓ Email recipient validated client-side (regex + live aria-live hint) and server-side
- ✓ All required fields visibly marked with `*` in Cancelled colour `aria-hidden="true"`
- ✓ All inputs `aria-invalid` flips when validation fails; `aria-describedby` chains helper + error region

### Error states

- ✓ Save failure: persistent Sonner toast with Retry action + inline `role="alert" aria-live="polite" aria-atomic="true"` region below the form
- ✓ Send failure: persistent Sonner toast inside the sheet form
- ✓ Preview iframe load failure: Cancelled-family role="alert" region with "Try again" Ghost
- ✓ **New:** 10-second iframe load-timeout fallback — if the iframe never fires `onLoad`, state flips to error automatically
- ✓ AccessDenied page-level: inherited from emails session, no raw permission identifier leaked

### Concurrent operations

- ✓ Save button disabled while `isPending` (prevents double-submit)
- ✓ Send-now button disabled while `isPending` + when email regex fails + when recipient empty
- ✓ Template-card switch while dirty: routes through styled Discard modal (not native confirm)
- ✓ Full-page nav-away while dirty: `beforeunload` listener
- ✓ Sheet open + edit form open simultaneously: form refs are scoped (not querySelector-based) so requestSubmit targets the correct form

### Permission states

- ✓ `canEdit=false` (Therapist): edit panel hidden; read-only notice above preview; Send Ghost still active on cards
- ✓ `canSendAllAudiences=false` (Therapist): Send Ghost hidden on customer + admin-internal cards, present on staff cards only (brief §10 Q5)
- ✓ Permission probe in preview route handler returns 401 / 403 with no leaked permission identifier

### Browser compat / storage

- ✓ **New:** sessionStorage access wrapped in try/catch (Safari private mode + sandboxed-iframe contexts throw)
- ✓ OKLCH colour values: modern browser target (Next.js 15 + Tailwind 4 baseline)
- ✓ `motion-reduce:` overrides on every custom transition

### Accessibility resilience

- ✓ Keyboard nav in accordion: `↑` / `↓` / `Home` / `End` move focus across visible cards; `Enter` / `Space` selects
- ✓ Focus auto-management: Send-to input focused on sheet open (50ms delay to clear BaseDialog mount)
- ✓ Focus trap: BaseDialog provides it for both manual-send sheet and discard modal
- ✓ ESC closes sheet / discard modal (BaseDialog default)
- ✓ Reduce-motion respected on accordion expand, chevron rotate, card-tint transition, iframe fade-in, sheet slide-in, modal fade+zoom

### Performance resilience

- ✓ Iframe `loading="lazy"`
- ✓ Iframe response: `Cache-Control: no-store` (preview always fresh) — bandwidth tradeoff acceptable for low-volume admin
- ✓ Edit form: 30s `setInterval` to refresh relative-time label (cleared on unmount)
- ✓ All `setTimeout` / `setInterval` / event listeners cleared in cleanup

## Per-state coverage matrix (brief §6 cross-check)

| Brief state | Implementation | Token / behaviour |
|---|---|---|
| No template selected | `TemplatePreviewPanel.tsx:24-32` | EmptyState envelope-Mail icon, "Select a template to preview" + "Pick one from the list to see what gets sent." |
| Template loading | `TemplatePreviewPanel.tsx:71-86` + `TemplatesTab.tsx:88-95` | AdminSkeleton bars at iframe height + 3 skeleton input rows below |
| Template ready | `TemplatePreviewPanel.tsx:107-122` | Sandboxed iframe with fade-in on load |
| Field focused / unsaved | `TemplateEditForm.tsx:139-148` | Focus Azure border + "Unsaved changes" label |
| Saving | `TemplateEditForm.tsx:161-180` | aria-busy=true, spinner, "Saving…" |
| Saved | `TemplateEditForm.tsx:60-78` | Sonner toast "Template updated." + "Saved {relative}" label + native title absolute timestamp |
| Save error | `TemplateEditForm.tsx:118-130` | Persistent toast (Retry) + inline role=alert + variable-list disclosure |
| Read-only (Therapist) | `TemplatesTab.tsx:107` + `TemplatePreviewPanel.tsx:32-36` | Edit panel hidden; muted notice "You can view but not edit these templates. Contact the owner to make changes." |
| Manual send open | `ManualSendSheet.tsx` | BaseDialog right-slide, focus auto-managed, booking-context picker, per-template runtime fields |
| Unsaved leave | `TemplatesTab.tsx:142-179` | Styled BaseDialog discard modal with brief's verbatim copy + Destructive Leave + Secondary Keep editing |

## Edge cases verified

- ✓ Greeting-intro 300+ chars: live counter goes Cancelled-tinted at 301; aria-invalid flips
- ✓ Variable `{ clientNam }` typo: blocked client-side with disclosure of allowed list
- ✓ HTML/script paste: blocked server-side with documented copy
- ✓ Iframe sandbox: runtime DOM probe confirms `allow-same-origin` only; pointer-events: none
- ✓ Iframe response CSP: `script-src 'none'`
- ✓ Plain-text companion: rendered as `<pre>` IBM Plex Mono on `surface-card`, not iframe
- ✓ Therapist visibility: Send button hidden on non-staff templates
- ✓ Admin-internal preview: Restricted-family Lock-icon banner above iframe
- ✓ Network slow: 10s iframe-load timeout fallback flips to retryable error
- ✓ sessionStorage unavailable: silently skips persistence; URL param remains primary deep-link surface
