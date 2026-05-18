"use client";

import { useEffect } from "react";
import { useRouter } from "next/navigation";

interface StaffDetailShortcutsProps {
  staffId: string;
  availabilityHref: string | null;
  prevHref: string | null;
  nextHref: string | null;
}

/**
 * Page-level keyboard shortcuts for the staff-detail workstation.
 *
 *  Cmd/Ctrl + S        — submit the StaffProfileForm save (looks up the visible "Save profile" button)
 *  Cmd/Ctrl + ]        — jump to Availability tab (when visible)
 *  Cmd/Ctrl + [        — jump to Profile tab (no-op on staff-detail; reserved)
 *  Cmd/Ctrl + Left     — previous sibling staff
 *  Cmd/Ctrl + Right    — next sibling staff
 *
 * No global event side-effects; mounts once per page, removes on unmount.
 */
export function StaffDetailShortcuts({
  staffId: _staffId,
  availabilityHref,
  prevHref,
  nextHref,
}: StaffDetailShortcutsProps) {
  const router = useRouter();

  useEffect(() => {
    function onKey(event: KeyboardEvent) {
      const mod = event.metaKey || event.ctrlKey;
      if (!mod) return;

      // Avoid intercepting when the user is mid-text-edit modifier combos in inputs.
      const target = event.target as HTMLElement | null;
      const inEditable =
        target &&
        (target.tagName === "INPUT" ||
          target.tagName === "TEXTAREA" ||
          target.isContentEditable);

      switch (event.key) {
        case "s":
        case "S": {
          // Save — find the visible "Save profile" button and click it.
          const saveBtn = Array.from(document.querySelectorAll<HTMLButtonElement>("button")).find(
            (btn) =>
              btn.textContent?.trim().startsWith("Save profile") && !btn.disabled
          );
          if (saveBtn) {
            event.preventDefault();
            saveBtn.click();
          }
          break;
        }
        case "]": {
          if (availabilityHref && !inEditable) {
            event.preventDefault();
            router.push(availabilityHref);
          }
          break;
        }
        case "ArrowLeft": {
          if (prevHref && !inEditable) {
            event.preventDefault();
            router.push(prevHref);
          }
          break;
        }
        case "ArrowRight": {
          if (nextHref && !inEditable) {
            event.preventDefault();
            router.push(nextHref);
          }
          break;
        }
        default:
          break;
      }
    }

    document.addEventListener("keydown", onKey);
    return () => document.removeEventListener("keydown", onKey);
  }, [router, availabilityHref, prevHref, nextHref]);

  return null;
}
