"use client";

import { useState } from "react";
import Link from "next/link";
import { Dialog } from "@base-ui/react/dialog";
import { X } from "lucide-react";
import type { ConsentChoices } from "@/lib/consent/consent-state";
import {
  type CookieRegistryEntry,
  type CookieRegistryGroup,
  groupRegistryByPurpose,
} from "@/lib/consent/cookie-registry";
import { ConsentActionButton } from "./ConsentActionButton";
import {
  ALL_DENIED,
  ALL_GRANTED,
  type GatedPurpose,
  closeConsentPanel,
  getConsentSnapshot,
  recordConsentChoices,
  useConsentPanelOpen,
} from "./consent-store";

// C-18 Phase C Step 6 — the second layer: one control per non-essential purpose
// in the registry, all off unless the visitor has already said otherwise.
//
// DIALOG MECHANISM. This uses @base-ui/react/dialog's primitives directly, the
// same way src/features/booking/components/BookingDialog.tsx does, rather than
// the wrapper in src/components/ui/dialog.tsx. The wrapper is otherwise a good
// fit — MaintenanceModal already uses it on public pages — but its DialogContent
// renders its own backdrop hard-coded at z-50 and accepts no class for it, and
// the site header sits at z-index 100 (src/styles/site-parity.css:384). A z-50
// backdrop would dim the page while leaving the header undimmed and on top of
// it. Base UI supplies the focus trap, ESC handling, aria-modal and focus
// restoration either way; only the z-index is hand-set here.
//
// Z-ORDER (C18-F4; the banner's own value is in CookieBanner.tsx):
//   backdrop 940 / popup 950 — above the site header (100) and its hamburger
//   button (101), and above the banner (900) that opens this panel; below the
//   booking dialog's backdrop (9998) and popup (9999), which is the accepted
//   posture: while the booking dialog is open the consent surfaces are
//   unreachable, and consent resumes when it closes.
const BACKDROP_CLASS =
  "fixed inset-0 z-[940] bg-rahma-charcoal/30 backdrop-blur-sm transition-opacity duration-[var(--motion-duration-normal)] data-[ending-style]:opacity-0 data-[starting-style]:opacity-0";

const POPUP_CLASS =
  "fixed left-1/2 top-1/2 z-[950] flex max-h-[calc(100dvh-2rem)] w-[min(calc(100vw-1.5rem),40rem)] -translate-x-1/2 -translate-y-1/2 flex-col overflow-hidden rounded-2xl border border-rahma-border bg-rahma-ivory text-left shadow-elevated transition-opacity duration-[var(--motion-duration-normal)] data-[ending-style]:opacity-0 data-[starting-style]:opacity-0";

type GatedGroup = CookieRegistryGroup & { purpose: GatedPurpose };

/**
 * The gated purposes that actually exist in the registry, in the registry's own
 * display order. One control is rendered per entry, so adding a purpose to
 * COOKIE_REGISTRY adds a control and no list has to be kept in step by hand.
 */
export const GATED_PURPOSES: GatedPurpose[] = groupRegistryByPurpose()
  .map((group) => group.purpose)
  .filter((purpose): purpose is GatedPurpose => purpose !== "essential");

function EntryDetail({ entry }: { entry: CookieRegistryEntry }) {
  return (
    <div className="rounded-xl border border-rahma-border bg-white/95 p-4">
      <p className="font-mono text-sm font-semibold text-rahma-charcoal">{entry.name}</p>
      <p className="mt-2 text-sm leading-6 text-rahma-muted">{entry.description}</p>
      <dl className="mt-3 grid gap-1 text-sm text-rahma-muted">
        <div className="flex gap-2">
          <dt className="font-semibold text-rahma-charcoal">Set by:</dt>
          <dd>{entry.provider}</dd>
        </div>
        <div className="flex gap-2">
          <dt className="font-semibold text-rahma-charcoal">How long:</dt>
          <dd>{entry.duration}</dd>
        </div>
      </dl>
    </div>
  );
}

function PurposeSection({
  group,
  checked,
  disabled,
  lockedReason,
  onChange,
}: {
  group: CookieRegistryGroup;
  checked: boolean;
  disabled?: boolean;
  lockedReason?: string;
  onChange?: (next: boolean) => void;
}) {
  const toggleId = `consent-purpose-${group.purpose}`;
  const labelId = `${toggleId}-label`;
  const descriptionId = `${toggleId}-description`;

  return (
    <section className="rounded-2xl border border-rahma-border bg-white/60 p-4 sm:p-5">
      <div className="flex items-start justify-between gap-4">
        <div className="min-w-0">
          <h3 id={labelId} className="font-display text-lg font-semibold text-rahma-charcoal">
            {group.label}
          </h3>
          <p id={descriptionId} className="mt-1 text-sm leading-6 text-rahma-muted">
            {group.description}
          </p>
        </div>
        <span className="inline-flex min-h-11 shrink-0 items-center px-2">
          <input
            id={toggleId}
            type="checkbox"
            className="size-6 accent-rahma-green disabled:opacity-60"
            checked={checked}
            disabled={disabled}
            aria-labelledby={labelId}
            aria-describedby={descriptionId}
            onChange={(event) => onChange?.(event.target.checked)}
          />
        </span>
      </div>

      {lockedReason ? (
        <p className="mt-3 text-sm leading-6 text-rahma-muted">{lockedReason}</p>
      ) : null}

      <details className="mt-3">
        <summary className="inline-flex min-h-11 cursor-pointer items-center text-sm font-semibold text-rahma-green focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-rahma-blue">
          {`What's in this group (${group.entries.length})`}
        </summary>
        <div className="mt-3 grid gap-3">
          {group.entries.map((entry) => (
            <EntryDetail key={entry.name} entry={entry} />
          ))}
        </div>
      </details>
    </section>
  );
}

/**
 * Rendered only while the panel is open, so its state is initialised fresh from
 * the stored choice every time the panel is reopened — the withdrawal surface
 * has to come up showing what was chosen last time, and nothing has to be reset
 * by hand on close.
 */
function PanelBody() {
  const groups = groupRegistryByPurpose();
  const essentialGroups = groups.filter((group) => group.purpose === "essential");
  const gatedGroups = groups.filter(
    (group): group is GatedGroup => group.purpose !== "essential"
  );

  const [choices, setChoices] = useState<ConsentChoices>(
    () => getConsentSnapshot()?.choices ?? ALL_DENIED
  );

  const commit = (next: ConsentChoices) => {
    recordConsentChoices(next);
    closeConsentPanel();
  };

  return (
    <>
      <header className="flex items-start justify-between gap-4 border-b border-rahma-border px-5 py-4 sm:px-6">
        <div className="min-w-0">
          <Dialog.Title className="font-display text-xl font-semibold text-rahma-charcoal">
            Cookie settings
          </Dialog.Title>
          {/* No blanket "nothing is on unless you turn it on": it is true of
              Functional and not yet of Analytics, and each group's own
              description below says which. */}
          <Dialog.Description className="mt-1 text-sm leading-6 text-rahma-muted">
            Choose what we may store on your device. Every group says what your choice
            changes for it today, and you can come back and change your mind whenever you
            like.
          </Dialog.Description>
        </div>
        <Dialog.Close
          aria-label="Close cookie settings"
          className="inline-flex size-11 shrink-0 items-center justify-center rounded-full border border-rahma-border bg-white text-rahma-charcoal transition-colors duration-[var(--motion-duration-fast)] hover:text-rahma-green focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-rahma-blue"
        >
          <X aria-hidden="true" className="size-4" />
        </Dialog.Close>
      </header>

      <div className="grid gap-4 overflow-y-auto px-5 py-5 sm:px-6">
        {essentialGroups.map((group) => (
          <PurposeSection
            key={group.purpose}
            group={group}
            checked
            disabled
            lockedReason="Without them the site can't do what you've asked it to do — things like holding on to what you picked in the booking form while you fill it in, or remembering the choice you make right here."
          />
        ))}
        {gatedGroups.map((group) => (
          <PurposeSection
            key={group.purpose}
            group={group}
            checked={choices[group.purpose]}
            onChange={(next) => setChoices((current) => ({ ...current, [group.purpose]: next }))}
          />
        ))}
        <p className="text-sm leading-6 text-rahma-muted">
          Full details of every item are on our{" "}
          <Link
            href="/cookies/"
            className="font-semibold text-rahma-green underline underline-offset-2"
          >
            cookies page
          </Link>
          .
        </p>
      </div>

      <footer className="flex flex-col gap-3 border-t border-rahma-border px-5 py-4 sm:flex-row sm:justify-end sm:px-6">
        <ConsentActionButton onClick={() => commit(choices)}>Save choices</ConsentActionButton>
        <ConsentActionButton onClick={() => commit(ALL_GRANTED)}>Accept all</ConsentActionButton>
        <ConsentActionButton onClick={() => commit(ALL_DENIED)}>Reject all</ConsentActionButton>
      </footer>
    </>
  );
}

export function ConsentPreferencesPanel() {
  const open = useConsentPanelOpen();

  return (
    <Dialog.Root
      open={open}
      onOpenChange={(next) => {
        if (!next) closeConsentPanel();
      }}
      modal
    >
      <Dialog.Portal>
        <Dialog.Backdrop className={BACKDROP_CLASS} />
        <Dialog.Popup className={POPUP_CLASS} aria-modal="true">
          {open ? <PanelBody /> : null}
        </Dialog.Popup>
      </Dialog.Portal>
    </Dialog.Root>
  );
}
