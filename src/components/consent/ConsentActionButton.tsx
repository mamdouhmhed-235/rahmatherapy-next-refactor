"use client";

import type { ComponentProps } from "react";

// C-18 Phase C — the ONE button every consent action renders from.
//
// The ICO's April-2026 guidance requires refusing to be as easy as accepting on
// the first layer, and the usual way that requirement is quietly broken is two
// components that happen to match today and drift apart at the next redesign —
// or one that takes a `variant` prop nobody notices being set. So this
// component takes no styling props at all: `className` and `style` are removed
// from its prop type, which makes "Accept all" and "Reject all" identical in
// size, weight, colour and contrast by construction rather than by inspection.
// The label is the only thing that can differ.
//
// Colours: --rahma-green (#1c72ac) on white measures 5.18:1, and white on
// --rahma-green the same, so both the resting and hover states clear WCAG AA
// on the ivory banner surface (src/styles/tokens.css).
type ConsentActionButtonProps = Omit<
  ComponentProps<"button">,
  "className" | "style" | "type"
>;

export const CONSENT_ACTION_CLASS =
  "inline-flex min-h-11 flex-1 items-center justify-center rounded-full border border-rahma-green bg-white px-6 py-2 text-sm font-semibold text-rahma-green transition-colors duration-[var(--motion-duration-fast)] hover:bg-rahma-green hover:text-white focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-rahma-blue sm:flex-none";

export function ConsentActionButton(props: ConsentActionButtonProps) {
  return <button type="button" className={CONSENT_ACTION_CLASS} {...props} />;
}
