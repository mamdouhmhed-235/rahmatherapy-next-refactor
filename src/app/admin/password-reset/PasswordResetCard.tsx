import Image from "next/image";
import Link from "next/link";
import type { ReactNode } from "react";

/**
 * Shared card chrome for every password-reset state.
 *
 * Slot composition (brief §5):
 *   - logo (fixed; vendored by Login session)
 *   - heading (H1; one per state)
 *   - chip (Pending / Confirmed / Cancelled / Restricted; absent on state 1)
 *   - body (1–2 sentence plain-English context)
 *   - affordance (form / dl / CTA per state)
 *   - back-link slot ("Back to sign in" Ghost; hidden during state 4 mid-flow)
 *
 * The card never branches on state internally. State-specific content is
 * composed by the state components in ./states/. The card guarantees:
 *   - id="admin-main" skip-link target on the card root (per brief Feature
 *     Preservation Manifest: this surface strips top nav, so the skip-link
 *     anchor lives at the card root)
 *   - max-width 440px desktop (brief §5: 40px wider than Login's 400px to
 *     accommodate state-4's two password fields + state-3's status <dl>)
 *   - centred horizontally + vertically on a min-h-[100dvh] flex column
 *   - 32px / 24px padding (xl desktop, lg mobile)
 *   - no shadow at rest (DESIGN.md Tonal Lift Rule)
 */

export function PasswordResetCard({
  heading,
  chip,
  children,
  showBackLink = true,
  ariaDescribedBy,
}: {
  heading: string;
  chip?: ReactNode;
  children: ReactNode;
  showBackLink?: boolean;
  ariaDescribedBy?: string;
}) {
  return (
    <main
      className="flex min-h-[100dvh] flex-col items-center justify-center bg-[var(--admin-canvas)] px-6 py-12"
      id="admin-main"
    >
      <div className="flex w-full max-w-[440px] flex-col">
        <article
          className="rounded-[var(--admin-radius-md)] border bg-[var(--admin-panel)] p-6 sm:p-8"
          style={{ borderColor: "var(--admin-border)" }}
          aria-labelledby="password-reset-heading"
          aria-describedby={ariaDescribedBy}
        >
          {/* Logo block — identical to Login (180px desktop / 140px mobile, natural colours).
              xl (32px) bottom margin per brief §5: anchors the brand cluster before
              the heading group. */}
          <div className="mb-8 flex justify-center">
            <Image
              src="/images/brand/rahma/logo-refined.svg"
              alt="Rahma Therapy"
              width={180}
              height={66}
              priority
              className="h-auto w-[140px] sm:w-[180px]"
            />
          </div>

          {/* Heading + state chip — tight grouping (gap-2.5, 10px) so the chip
              reads as a sub-line of the H1, not a separate element. */}
          <header className="mb-6 flex flex-col items-center gap-2.5 text-center">
            <h1
              id="password-reset-heading"
              className="font-display text-[1.778rem] font-semibold leading-[1.2] tracking-[-0.015em] text-[var(--admin-heading)]"
            >
              {heading}
            </h1>
            {chip ? <div>{chip}</div> : null}
          </header>

          {/* State-specific body + affordance — lg (24px) gap creates a clear
              break between the message zone (body copy) and the action zone
              (form / button). Inside forms, the gap-4 stays tight. */}
          <div className="flex flex-col gap-6">{children}</div>
        </article>

        {showBackLink ? (
          <div className="mt-5 flex justify-center">
            <Link
              href="/admin/login"
              className="rounded-sm px-2 py-2 text-sm font-medium text-[var(--admin-text-muted)] underline-offset-2 transition-colors hover:text-[var(--admin-heading)] hover:underline focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[var(--admin-focus)]/55"
            >
              Back to sign in
            </Link>
          </div>
        ) : null}

        {/* Page footer — extra top-margin when the back-link is hidden (state 4)
            so the "Rahma Therapy staff portal." line doesn't sit visually
            crammed against the card. Inline values guarantee the rule lands
            regardless of the project's spacing-scale generation. */}
        <p
          style={{ marginTop: showBackLink ? "1.5rem" : "2.5rem" }}
          className="text-center text-xs text-[var(--admin-text-muted)]"
        >
          Rahma Therapy staff portal.
        </p>
      </div>
    </main>
  );
}

/**
 * Build a screen-reader-friendly label for the masked email.
 *
 * Without this, VoiceOver pronounces "u••@rahmatherapy.example.test" as
 * "u dot dot at rahmatherapy dot example dot test", which is obscure. With
 * the override, the label reads as a plain English sentence the screen
 * reader can speak naturally while the sighted user still sees the masked
 * form.
 */
export function maskedEmailA11yLabel(maskedEmail: string): string {
  const at = maskedEmail.indexOf("@");
  if (at <= 0) return `Sent to ${maskedEmail}`;
  const head = maskedEmail.slice(0, 1) || "?";
  const domain = maskedEmail.slice(at + 1);
  return `Sent to your email at ${domain}, address starts with the letter ${head}`;
}

/**
 * Plain-text-only renderer for hostile content (reviewer notes, etc.).
 *
 * React escapes children by default; we use this wrapper purely to make the
 * "no dangerouslySetInnerHTML" contract self-documenting. The `whitespace-pre-wrap`
 * keeps multi-line notes legible without re-introducing an HTML render path.
 */
export function PlainTextWell({
  label,
  text,
}: {
  label: string;
  text: string;
}) {
  return (
    <section
      aria-label={label}
      // Reviewer-note well — brief §design tokens: surface-page background,
      // 8px radius (--admin-radius-md), 1px border-subtle, md (16px) padding.
      className="rounded-[var(--admin-radius-md)] border bg-[var(--admin-canvas)] p-4"
      style={{ borderColor: "var(--admin-border)" }}
    >
      {/* Label = Work Sans 500 label step (0.75rem) per brief; body = Work Sans
          400 body step (1rem) per brief. */}
      <p className="mb-2 text-xs font-medium tracking-[0.01em] text-[var(--admin-heading)]">
        {label}
      </p>
      <p className="whitespace-pre-wrap text-base leading-[1.55] text-[var(--admin-body)]">
        {text}
      </p>
    </section>
  );
}
