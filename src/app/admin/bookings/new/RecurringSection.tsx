"use client";

import { useEffect, useState } from "react";
import { AdminInput, AdminPanel } from "@/app/admin/components/admin-ui";

/**
 * C-02 Phase E (Step 13) — the recurring/standing-booking controls for the
 * manual booking form's step-4 review block.
 *
 * Every hidden input below is named for `recurringSchema` in
 * `../recurring-actions.ts`. That pairing is runtime-only — tsc cannot see it —
 * so a rename on either side has to be mirrored here by hand.
 *
 * Two fields the action also reads are deliberately NOT emitted here:
 * `client_id` and `consent_acknowledged` already sit in ManualBookingForm's own
 * hidden-input block, and `FormData.get` returns the FIRST entry of a name, so a
 * second copy would shadow the real one.
 */

type Cadence = "weekly" | "fortnightly" | "monthly";
type EndType = "until_cancelled" | "after_count" | "until_date";

const WEEKDAYS = [
  "Sunday",
  "Monday",
  "Tuesday",
  "Wednesday",
  "Thursday",
  "Friday",
  "Saturday",
];

/** Weekday name for a YYYY-MM-DD string, read in UTC so SSR and the client agree. */
function weekdayOf(isoDate: string): string {
  if (!/^\d{4}-\d{2}-\d{2}$/.test(isoDate)) return "";
  return WEEKDAYS[new Date(`${isoDate}T00:00:00Z`).getUTCDay()] ?? "";
}

export interface RecurringSectionProps {
  enabled: boolean;
  onEnabledChange: (enabled: boolean) => void;
  /** Existing client row id. Empty when the booking will create a new client. */
  clientId: string;
  participantCount: number;
  participantGender: "male" | "female" | "";
  selectedServiceSlugs: string[];
  /** slug → services.allow_recurrence */
  allowRecurrenceMap: Record<string, boolean>;
  /** Empty when the visit is being left unassigned. */
  selectedTherapistId: string;
  selectedTherapistName: string;
  /** YYYY-MM-DD, from step 3. */
  firstOccurrenceDate: string;
  /** HH:MM, from step 3. */
  startTime: string;
  serviceAddress: { line1: string; postcode: string; city: string; area: string };
  notes: string;
}

export function RecurringSection({
  enabled,
  onEnabledChange,
  clientId,
  participantCount,
  participantGender,
  selectedServiceSlugs,
  allowRecurrenceMap,
  selectedTherapistId,
  selectedTherapistName,
  firstOccurrenceDate,
  startTime,
  serviceAddress,
  notes,
}: RecurringSectionProps) {
  const [cadence, setCadence] = useState<Cadence>("weekly");
  const [endType, setEndType] = useState<EndType>("until_cancelled");
  const [endCount, setEndCount] = useState("12");
  const [endDate, setEndDate] = useState("");
  const [lockTherapist, setLockTherapist] = useState(true);

  const serviceSlug = selectedServiceSlugs[0] ?? "";
  const weekday = weekdayOf(firstOccurrenceDate);
  const dayOfMonth = /^\d{4}-\d{2}-\d{2}$/.test(firstOccurrenceDate)
    ? Number(firstOccurrenceDate.slice(8, 10))
    : 0;
  // The template CHECKs anchor_day_of_month to 1..28 and the date arithmetic
  // loses the anchor permanently after a month-end clamp, so day 29-31 is
  // refused here rather than at the server.
  const monthlyAllowed = dayOfMonth >= 1 && dayOfMonth <= 28;

  // Ordered widest-first: the operator should hear about the structural reason,
  // not the last one that happens to fail.
  const blockReason =
    !clientId
      ? "Repeat visits need an existing client. Open this form from the client's profile to set a series up."
      : participantCount > 1
      ? "Repeat visits cover one person. Book the group visit on its own, then set up a series for each person."
      : selectedServiceSlugs.length !== 1
      ? "Repeat visits cover one service. Pick a single package or massage to repeat."
      : !allowRecurrenceMap[serviceSlug]
      ? "Repeat visits aren't available for this service. An owner can switch them on from Services."
      : !participantGender
      ? "Set the client's gender in step 2 before setting up repeat visits."
      : !firstOccurrenceDate || !startTime
      ? "Pick the date and start time in step 3 before setting up repeat visits."
      : "";

  // A change made after the toggle was ticked (a second person added, the
  // service swapped) must not leave the form pointed at the recurring action
  // with no fields to send.
  useEffect(() => {
    if (enabled && blockReason) onEnabledChange(false);
  }, [enabled, blockReason, onEnabledChange]);

  const countValue = Number(endCount);
  const countError =
    endType === "after_count" && !(Number.isInteger(countValue) && countValue >= 1 && countValue <= 520)
      ? "Enter how many visits to book, between 1 and 520."
      : "";
  const endDateError =
    endType === "until_date" && (!endDate || endDate <= firstOccurrenceDate)
      ? "Pick an end date after the first visit."
      : "";
  const cadenceError =
    cadence === "monthly" && !monthlyAllowed
      ? "Monthly repeats need a first visit between the 1st and 28th. Change the date in step 3 or pick another cadence."
      : "";

  const openToAnyTherapist = !selectedTherapistId || !lockTherapist;

  return (
    <AdminPanel title="Repeat visits">
      <div className="grid gap-4">
        <div className="grid gap-1.5">
          <label className="flex cursor-pointer items-start gap-3 text-sm">
            <input
              type="checkbox"
              id="is_recurring"
              checked={enabled}
              disabled={!!blockReason}
              onChange={(event) => onEnabledChange(event.target.checked)}
              className="mt-0.5 shrink-0 accent-[var(--admin-primary)] disabled:cursor-not-allowed disabled:opacity-60"
            />
            <span className="text-[var(--admin-body)]">Yes, repeat this booking</span>
          </label>
          {blockReason ? (
            <p className="text-xs text-[var(--admin-text-muted)]">{blockReason}</p>
          ) : (
            <p className="text-xs text-[var(--admin-text-muted)]">
              Books the same visit on a schedule instead of once.
            </p>
          )}
        </div>

        {enabled && !blockReason && (
          <div className="grid gap-4 border-t border-[var(--admin-border)] pt-4">
            <div className="grid gap-1.5">
              <label
                htmlFor="recurring_cadence"
                className="text-sm font-medium text-[var(--admin-heading)]"
              >
                How often
              </label>
              <select
                id="recurring_cadence"
                value={cadence}
                onChange={(event) => setCadence(event.target.value as Cadence)}
                className="flex h-10 w-full rounded-[var(--admin-radius-control)] border border-[var(--admin-border-form)] bg-[var(--admin-surface-input)] px-3 py-2 text-sm text-[var(--admin-body)] outline-none transition-colors focus-visible:border-[var(--admin-focus)] focus-visible:ring-2 focus-visible:ring-[var(--admin-focus)]/30"
              >
                <option value="weekly">
                  {weekday ? `Weekly (every ${weekday})` : "Weekly"}
                </option>
                <option value="fortnightly">
                  {weekday ? `Fortnightly (every other ${weekday})` : "Fortnightly"}
                </option>
                <option value="monthly" disabled={!monthlyAllowed}>
                  {monthlyAllowed
                    ? `Monthly (day ${dayOfMonth} of each month)`
                    : "Monthly (needs a date from the 1st to the 28th)"}
                </option>
              </select>
              {cadenceError ? (
                <p role="alert" className="text-xs text-[var(--admin-status-cancelled-text)]">
                  {cadenceError}
                </p>
              ) : (
                <p className="text-xs text-[var(--admin-text-muted)]">
                  To change this later, cancel the series and create a new one.
                </p>
              )}
            </div>

            <fieldset className="grid gap-2">
              <legend className="text-sm font-medium text-[var(--admin-heading)]">
                Until when
              </legend>

              <label className="flex cursor-pointer items-start gap-3 text-sm">
                <input
                  type="radio"
                  name="recurring_end_type"
                  value="until_cancelled"
                  checked={endType === "until_cancelled"}
                  onChange={() => setEndType("until_cancelled")}
                  className="mt-0.5 shrink-0 accent-[var(--admin-primary)]"
                />
                <span className="text-[var(--admin-body)]">Until cancelled</span>
              </label>

              <label className="flex cursor-pointer items-start gap-3 text-sm">
                <input
                  type="radio"
                  name="recurring_end_type"
                  value="after_count"
                  checked={endType === "after_count"}
                  onChange={() => setEndType("after_count")}
                  className="mt-0.5 shrink-0 accent-[var(--admin-primary)]"
                />
                <span className="flex-1">
                  <span className="block text-[var(--admin-body)]">After a set number of visits</span>
                  {endType === "after_count" && (
                    <AdminInput
                      id="recurring_end_count"
                      className="mt-2"
                      type="number"
                      aria-label="Number of visits"
                      min={1}
                      max={520}
                      inputMode="numeric"
                      value={endCount}
                      error={countError || undefined}
                      onChange={(event) => setEndCount(event.target.value)}
                    />
                  )}
                </span>
              </label>

              <label className="flex cursor-pointer items-start gap-3 text-sm">
                <input
                  type="radio"
                  name="recurring_end_type"
                  value="until_date"
                  checked={endType === "until_date"}
                  onChange={() => setEndType("until_date")}
                  className="mt-0.5 shrink-0 accent-[var(--admin-primary)]"
                />
                <span className="flex-1">
                  <span className="block text-[var(--admin-body)]">Until a set date</span>
                  {endType === "until_date" && (
                    <AdminInput
                      id="recurring_end_date"
                      className="mt-2"
                      type="date"
                      aria-label="Last visit date"
                      min={firstOccurrenceDate}
                      value={endDate}
                      error={endDateError || undefined}
                      onChange={(event) => setEndDate(event.target.value)}
                    />
                  )}
                </span>
              </label>
            </fieldset>

            <div className="grid gap-1.5">
              {selectedTherapistId ? (
                <>
                  <label className="flex cursor-pointer items-start gap-3 text-sm">
                    <input
                      type="checkbox"
                      id="recurring_lock_therapist"
                      checked={lockTherapist}
                      onChange={(event) => setLockTherapist(event.target.checked)}
                      className="mt-0.5 shrink-0 accent-[var(--admin-primary)]"
                    />
                    <span className="text-[var(--admin-body)]">
                      Lock every visit to {selectedTherapistName || "the chosen therapist"}
                    </span>
                  </label>
                  <p className="text-xs text-[var(--admin-text-muted)]">
                    {lockTherapist
                      ? "Future visits are assigned to them automatically."
                      : "Any available therapist of the right gender can take each visit."}
                  </p>
                </>
              ) : (
                <p className="text-xs text-[var(--admin-text-muted)]">
                  No therapist chosen, so every visit is created as an open request.
                </p>
              )}
            </div>

            <p className="text-xs text-[var(--admin-text-muted)]">
              We&apos;ll create the next 12 weeks of visits now and extend the schedule
              automatically after that.
            </p>

            {/* ── Hidden inputs for createRecurringSeries ── */}
            <input type="hidden" name="service_slug" value={serviceSlug} />
            <input type="hidden" name="participant_gender" value={participantGender} />
            <input type="hidden" name="first_occurrence_date" value={firstOccurrenceDate} />
            <input type="hidden" name="anchor_start_time" value={startTime} />
            <input type="hidden" name="cadence" value={cadence} />
            <input type="hidden" name="end_type" value={endType} />
            {endType === "after_count" && (
              <input type="hidden" name="end_count" value={endCount} />
            )}
            {endType === "until_date" && <input type="hidden" name="end_date" value={endDate} />}
            <input
              type="hidden"
              name="bound_therapist_id"
              value={openToAnyTherapist ? "" : selectedTherapistId}
            />
            <input
              type="hidden"
              name="open_to_any_therapist"
              value={openToAnyTherapist ? "on" : ""}
            />
            {/* The series snapshots the address the operator reviewed, not the
                client's stored one — step 3 may have overridden it. */}
            <input type="hidden" name="service_address_line1" value={serviceAddress.line1} />
            <input type="hidden" name="service_postcode" value={serviceAddress.postcode} />
            <input type="hidden" name="service_city" value={serviceAddress.city} />
            <input type="hidden" name="service_area" value={serviceAddress.area} />
            <input type="hidden" name="notes" value={notes} />
          </div>
        )}
      </div>
    </AdminPanel>
  );
}
