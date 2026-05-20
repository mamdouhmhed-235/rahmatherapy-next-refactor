"use client";

import {
  useCallback,
  useEffect,
  useRef,
  useState,
  type ReactNode,
} from "react";
import { useRouter } from "next/navigation";
import { CalendarDays } from "lucide-react";
import { DayPicker, type DateRange } from "react-day-picker";
import { startOfDay } from "date-fns";

interface BaseParams {
  view: "day" | "week" | "month" | "range";
  date: string;
  staffId: string;
  paymentStatus: string;
  to: string;
}

interface CalendarDatePopoverProps {
  selectedDate: string;
  selectedTo: string;
  formattedLabel: string;
  baseParams: BaseParams;
}

const RANGE_SOFT_CAP_DAYS = 31;

function parseISODate(value: string): Date {
  const [y, m, d] = value.split("-").map(Number);
  return new Date(y, (m ?? 1) - 1, d ?? 1);
}

function toISODate(date: Date): string {
  const y = date.getFullYear();
  const m = String(date.getMonth() + 1).padStart(2, "0");
  const d = String(date.getDate()).padStart(2, "0");
  return `${y}-${m}-${d}`;
}

function daysBetween(fromISO: string, toISO: string): number {
  const [fy, fm, fd] = fromISO.split("-").map(Number);
  const [ty, tm, td] = toISO.split("-").map(Number);
  const f = Date.UTC(fy!, (fm ?? 1) - 1, fd ?? 1, 12);
  const t = Date.UTC(ty!, (tm ?? 1) - 1, td ?? 1, 12);
  return Math.round((t - f) / (24 * 60 * 60 * 1000)) + 1;
}

function firstOfMonth(iso: string): string {
  const [y, m] = iso.split("-");
  return `${y}-${m}-01`;
}

function buildHref(
  base: BaseParams,
  overrides: Partial<BaseParams>
): string {
  const merged = { ...base, ...overrides };
  const sp = new URLSearchParams();
  sp.set("view", merged.view);
  sp.set("date", merged.date);
  if (merged.to) sp.set("to", merged.to);
  if (merged.staffId) sp.set("staffId", merged.staffId);
  if (merged.paymentStatus) sp.set("paymentStatus", merged.paymentStatus);
  return `/admin/calendar?${sp.toString()}`;
}

export function CalendarDatePopover({
  selectedDate,
  selectedTo,
  formattedLabel,
  baseParams,
}: CalendarDatePopoverProps) {
  const [open, setOpen] = useState(false);
  // Local selection state. Initialised from the URL only when the URL already
  // encodes a range; otherwise the picker starts blank so the operator's first
  // click resets cleanly instead of extending an existing single-date "anchor".
  const initialSelection = (): DateRange | undefined =>
    selectedTo
      ? { from: parseISODate(selectedDate), to: parseISODate(selectedTo) }
      : undefined;
  const [selection, setSelection] = useState<DateRange | undefined>(
    initialSelection
  );
  const selectionRef = useRef(selection);
  const committedRef = useRef(false);
  const router = useRouter();
  const containerRef = useRef<HTMLDivElement>(null);
  const dialogRef = useRef<HTMLDivElement>(null);
  const triggerRef = useRef<HTMLButtonElement>(null);

  // Focus trap — keeps Tab/Shift+Tab cycling inside the popover while open.
  const trapFocus = useCallback((event: React.KeyboardEvent<HTMLDivElement>) => {
    if (event.key !== "Tab") return;
    const dialog = dialogRef.current;
    if (!dialog) return;
    const focusables = dialog.querySelectorAll<HTMLElement>(
      'button:not([disabled]), a[href], input:not([disabled]), [tabindex]:not([tabindex="-1"])'
    );
    if (focusables.length === 0) return;
    const first = focusables[0];
    const last = focusables[focusables.length - 1];
    const active = document.activeElement as HTMLElement | null;
    if (event.shiftKey && active === first) {
      event.preventDefault();
      last.focus();
    } else if (!event.shiftKey && active === last) {
      event.preventDefault();
      first.focus();
    }
  }, []);

  useEffect(() => {
    selectionRef.current = selection;
  }, [selection]);

  const navigateForSelection = useCallback(
    (fromISO: string, toISO: string | null) => {
      committedRef.current = true;
      setOpen(false);
      if (!toISO || fromISO === toISO) {
        router.push(
          buildHref(baseParams, { view: "day", date: fromISO, to: "" })
        );
        return;
      }
      // Normalise: from must be <= to.
      const [a, b] = fromISO <= toISO ? [fromISO, toISO] : [toISO, fromISO];
      const length = daysBetween(a, b);
      if (length > RANGE_SOFT_CAP_DAYS) {
        router.push(
          buildHref(baseParams, {
            view: "month",
            date: firstOfMonth(a),
            to: "",
          })
        );
        return;
      }
      router.push(
        buildHref(baseParams, {
          view: "range",
          date: a,
          to: b,
        })
      );
    },
    [baseParams, router]
  );

  const commitCurrent = useCallback(() => {
    const sel = selectionRef.current;
    if (!sel?.from || committedRef.current) {
      setOpen(false);
      return;
    }
    const fromISO = toISODate(startOfDay(sel.from));
    const toISO = sel.to ? toISODate(startOfDay(sel.to)) : null;
    navigateForSelection(fromISO, toISO);
  }, [navigateForSelection]);

  // Reset state every time the popover opens so the picker starts in a
  // predictable place (current URL state).
  useEffect(() => {
    if (open) {
      committedRef.current = false;
      // eslint-disable-next-line react-hooks/set-state-in-effect
      setSelection(initialSelection());
      // Move keyboard focus into the dialog (first focusable). aria-modal
      // alone doesn't shift focus; the user lands on background controls
      // otherwise. Defer one frame so the picker's first day-button is in
      // the DOM before we query for it.
      requestAnimationFrame(() => {
        const focusables = dialogRef.current?.querySelectorAll<HTMLElement>(
          'button:not([disabled]), a[href], input:not([disabled]), [tabindex]:not([tabindex="-1"])'
        );
        focusables?.[0]?.focus();
      });
    } else {
      // Restore focus to the trigger that opened the popover (WCAG 2.4.3).
      triggerRef.current?.focus();
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [open]);

  useEffect(() => {
    if (!open) return;
    function onDocClick(event: MouseEvent) {
      if (!containerRef.current) return;
      if (!containerRef.current.contains(event.target as Node)) {
        commitCurrent();
      }
    }
    function onKey(event: KeyboardEvent) {
      if (event.key === "Escape") commitCurrent();
    }
    document.addEventListener("mousedown", onDocClick);
    document.addEventListener("keydown", onKey);
    return () => {
      document.removeEventListener("mousedown", onDocClick);
      document.removeEventListener("keydown", onKey);
    };
  }, [open, commitCurrent]);

  return (
    <div className="relative" ref={containerRef}>
      <button
        ref={triggerRef}
        type="button"
        onClick={() => setOpen((prev) => !prev)}
        title={selectedTo ? `${selectedDate} → ${selectedTo}` : selectedDate}
        aria-haspopup="dialog"
        aria-expanded={open}
        aria-label={`Pick a date or date range — currently ${formattedLabel}`}
        className="inline-flex h-11 min-w-[10rem] items-center justify-center gap-2 rounded-[var(--admin-radius-control)] border border-[var(--admin-border)] bg-[var(--admin-panel)] px-3 text-sm font-medium text-[var(--admin-heading)] outline-none transition-colors hover:bg-[var(--admin-panel-muted)] focus-visible:ring-2 focus-visible:ring-[var(--admin-focus)]/55 sm:h-10"
      >
        <CalendarDays
          className="size-4 text-[var(--admin-primary)]"
          aria-hidden="true"
        />
        {formattedLabel}
      </button>
      {open ? (
        <div
          role="dialog"
          aria-modal="true"
          aria-label="Pick a date or date range"
          ref={dialogRef}
          onKeyDown={trapFocus}
          className="fixed left-1/2 top-[5rem] z-50 w-[calc(100vw-1rem)] max-w-[20rem] -translate-x-1/2 rounded-[var(--admin-radius-card)] border border-[var(--admin-border)] bg-[var(--admin-panel)] p-2 shadow-[var(--admin-shadow-overlay)] sm:absolute sm:left-0 sm:top-[calc(100%+0.5rem)] sm:w-auto sm:max-w-none sm:translate-x-0"
        >
          <p className="px-2 pb-1 pt-1 text-[0.6875rem] text-[var(--admin-text-muted)]">
            Click one day for a single date. Click two to pick a range.
          </p>
          <DayPicker
            mode="range"
            selected={selection}
            defaultMonth={
              selection?.from ?? parseISODate(selectedDate)
            }
            weekStartsOn={1}
            onSelect={(range) => {
              setSelection(range);
              // Defer commit to the explicit Apply button (or popover close)
              // so the user can pick a second date for a range without us
              // committing the single-day intermediate state.
            }}
          />
          <div className="mt-1 flex items-center justify-between gap-2 border-t border-[var(--admin-border)] px-1 pt-2">
            <SelectionSummary selection={selection} />
            <div className="flex items-center gap-1">
              <button
                type="button"
                onClick={() => {
                  setSelection(undefined);
                }}
                className="inline-flex h-8 items-center rounded-[var(--admin-radius-control)] px-2 text-xs font-medium text-[var(--admin-text-muted)] outline-none transition-colors hover:bg-[var(--admin-panel-muted)] focus-visible:ring-2 focus-visible:ring-[var(--admin-focus)]/55"
              >
                Clear
              </button>
              <button
                type="button"
                onClick={() => commitCurrent()}
                disabled={!selection?.from}
                className="inline-flex h-8 items-center rounded-[var(--admin-radius-control)] bg-[var(--admin-primary)] px-3 text-xs font-semibold text-[var(--admin-on-primary)] outline-none transition-colors hover:bg-[var(--admin-primary-hover)] focus-visible:ring-2 focus-visible:ring-[var(--admin-focus)]/55 disabled:cursor-not-allowed disabled:opacity-50"
              >
                Apply
              </button>
            </div>
          </div>
        </div>
      ) : null}
    </div>
  );
}

function SelectionSummary({ selection }: { selection: DateRange | undefined }) {
  if (!selection?.from) {
    return (
      <p className="text-[0.6875rem] text-[var(--admin-text-muted)]">
        No date picked.
      </p>
    );
  }
  const fromISO = toISODate(startOfDay(selection.from));
  const toISO = selection.to ? toISODate(startOfDay(selection.to)) : fromISO;
  if (fromISO === toISO) {
    return (
      <p className="text-[0.6875rem] font-medium tabular-nums text-[var(--admin-heading)]">
        {fromISO}
      </p>
    );
  }
  const length = daysBetween(fromISO, toISO);
  const cap = length > RANGE_SOFT_CAP_DAYS ? " — opens as month grid" : "";
  return (
    <p className="text-[0.6875rem] font-medium tabular-nums text-[var(--admin-heading)]">
      {fromISO} → {toISO}{" "}
      <span className="font-normal text-[var(--admin-text-muted)]">
        ({length} day{length === 1 ? "" : "s"}){cap}
      </span>
    </p>
  );
}

interface CalendarStepperNavProps {
  prevHref: string;
  nextHref: string;
  dayWord: "day" | "week" | "month" | "range";
  children: ReactNode;
}

export function CalendarStepperNav({
  prevHref,
  nextHref,
  dayWord,
  children,
}: CalendarStepperNavProps) {
  const router = useRouter();
  const wrapperRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    const wrapper = wrapperRef.current;
    if (!wrapper) return;

    function handleKey(event: KeyboardEvent) {
      if (event.metaKey || event.ctrlKey || event.altKey) return;
      const active = document.activeElement;
      if (!active || !wrapper) return;
      if (!wrapper.contains(active)) return;
      if (active.closest('[role="dialog"]')) return;
      if (event.key === "ArrowLeft") {
        event.preventDefault();
        router.push(prevHref);
      } else if (event.key === "ArrowRight") {
        event.preventDefault();
        router.push(nextHref);
      }
    }

    wrapper.addEventListener("keydown", handleKey);
    return () => wrapper.removeEventListener("keydown", handleKey);
  }, [prevHref, nextHref, router]);

  const helpText =
    dayWord === "range"
      ? "Use the left and right arrow keys to shift the range by its own length when focus is in this region."
      : `Use the left and right arrow keys to step one ${dayWord} when focus is in this region.`;

  return (
    <div ref={wrapperRef} data-calendar-stepper>
      <p className="sr-only">{helpText}</p>
      {children}
    </div>
  );
}
