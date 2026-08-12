// The travel-charge arithmetic, in one place (item 8 Phase 3).
//
// WHY INTEGER PENCE, and not plain float pounds.
// `bookings.total_price` is numeric(10,2) but `amount_due` is bare numeric with
// NO scale constraint — verified against the live schema, not assumed. So a
// float result like 45.30 - 14.30 + 20.10 = 51.099999999999994 would be rounded
// back to 51.10 by total_price's own scale on write, while amount_due would
// store the full 51.099999999999994. The two columns would then disagree by a
// fraction of a penny, silently, and every outstanding-balance calculation that
// subtracts one from the other would inherit the error.
//
// WHY A DELTA, and not a recompute.
// The fee is folded INTO total_price and amount_due rather than summed by
// readers, which is what makes all 17 existing readers of those columns correct
// with no code change. It must be applied to the value AS STORED — never by
// re-deriving service_price x participant_count, because the stored total is
// already multiplied. The worked example that has to hold:
//
//     45.00 service, 2 participants, 14.00 travel fee
//     stored total_price = 90.00           (45 x 2, set once at creation)
//     new total_price    = 90 - 0 + 14 = 104.00
//
// 104.00, NOT (45 + 14) x 2 = 118.00. If a "recalculate from scratch" path is
// ever added anywhere, it must add the fee strictly AFTER the multiply.
//
// Phase 4's series action and the horizon cron need this identical arithmetic;
// they must import it rather than reimplement it.

/**
 * Is this address inside the free-travel areas — i.e. is travel free?
 *
 * Matching is "equal or contains", case-insensitive, which is the rule the old
 * SQL gate used and which keeps "Luton" matching "Luton Town Centre".
 *
 * ⛔ FAIL-SAFE DIRECTION MATTERS. An empty town list means the settings read
 * failed, not that every address is chargeable — the settings form enforces a
 * minimum of one entry, so an empty list is never a real configured state.
 * Treating it as "outside" would hide the quick-confirm chip on every booking
 * in the system on a transient fetch failure, so an unknown answer resolves to
 * "inside" and leaves existing behaviour alone.
 */
export function isInFreeTravelArea(
  city: string | null | undefined,
  freeTravelCities: string[]
): boolean {
  if (freeTravelCities.length === 0) return true;

  const normalised = String(city ?? "").trim().toLowerCase();
  if (normalised === "") return true;

  return freeTravelCities.some((town) => {
    const candidate = town.trim().toLowerCase();
    return (
      candidate !== "" &&
      (normalised === candidate || normalised.includes(candidate))
    );
  });
}

/** Money as integer pence. `null`/`undefined`/unparseable all collapse to 0. */
export function toPence(value: number | string | null | undefined): number {
  const parsed = Number(value ?? 0);
  return Number.isFinite(parsed) ? Math.round(parsed * 100) : 0;
}

/** Integer pence back to pounds, exact to 2dp. */
export function fromPence(pence: number): number {
  return pence / 100;
}

export interface TravelFeeDeltaInput {
  /** The booking's stored total_price. Nullable in the schema. */
  totalPrice: number | string | null | undefined;
  /** The booking's stored amount_due. Nullable and unscaled in the schema. */
  amountDue: number | string | null | undefined;
  /** The fee currently folded into those two values. */
  previousTravelFee: number | string | null | undefined;
  /** The fee the admin has just entered. */
  nextTravelFee: number | string | null | undefined;
}

export interface TravelFeeDeltaResult {
  totalPrice: number;
  amountDue: number;
}

/**
 * Swap one travel fee for another inside the stored totals.
 *
 * `amount_paid` is deliberately never touched: what the customer has already
 * handed over does not change because the charge did.
 */
export function applyTravelFeeDelta(
  input: TravelFeeDeltaInput
): TravelFeeDeltaResult {
  const deltaPence =
    toPence(input.nextTravelFee) - toPence(input.previousTravelFee);

  return {
    totalPrice: fromPence(toPence(input.totalPrice) + deltaPence),
    amountDue: fromPence(toPence(input.amountDue) + deltaPence),
  };
}

/**
 * Parse the admin's travel-fee input.
 *
 * Returns `null` when the value is not a usable amount, so the caller can raise
 * a field-level error rather than writing NaN into a money column. An empty
 * field means "no charge", which is 0 — not an error.
 */
export function parseTravelFee(raw: string | null | undefined): number | null {
  const trimmed = String(raw ?? "").trim();
  if (trimmed === "") return 0;

  // Checked as text, not arithmetic. `14.30 * 100` is 1429.9999999999998 in
  // IEEE-754, so a numeric precision test would reject perfectly valid input.
  // This also rejects negatives, exponent notation and stray characters, which
  // Number() would otherwise accept or coerce.
  if (!/^\d+(\.\d{1,2})?$/.test(trimmed)) return null;

  const parsed = Number(trimmed);
  return Number.isFinite(parsed) ? parsed : null;
}
