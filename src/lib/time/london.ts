export const BUSINESS_TIME_ZONE = "Europe/London";

interface DateParts {
  year: number;
  month: number;
  day: number;
  hour: number;
  minute: number;
  second: number;
}

const businessDateFormatter = new Intl.DateTimeFormat("en-GB", {
  timeZone: BUSINESS_TIME_ZONE,
  year: "numeric",
  month: "2-digit",
  day: "2-digit",
});

const businessDateTimeFormatter = new Intl.DateTimeFormat("en-GB", {
  timeZone: BUSINESS_TIME_ZONE,
  year: "numeric",
  month: "2-digit",
  day: "2-digit",
  hour: "2-digit",
  minute: "2-digit",
  second: "2-digit",
  hourCycle: "h23",
});

function getParts(formatter: Intl.DateTimeFormat, date: Date) {
  return Object.fromEntries(
    formatter.formatToParts(date).map((part) => [part.type, part.value])
  );
}

function pad(value: number) {
  return String(value).padStart(2, "0");
}

function parseDate(value: string) {
  const [year, month, day] = value.split("-").map(Number);
  return { year, month, day };
}

function parseTime(value: string) {
  const [hour, minute] = value.slice(0, 5).split(":").map(Number);
  return { hour, minute };
}

function getBusinessParts(date: Date): DateParts {
  const parts = getParts(businessDateTimeFormatter, date);

  return {
    year: Number(parts.year),
    month: Number(parts.month),
    day: Number(parts.day),
    hour: Number(parts.hour),
    minute: Number(parts.minute),
    second: Number(parts.second),
  };
}

export function getBusinessDate(now = new Date()) {
  const parts = getParts(businessDateFormatter, now);
  return `${parts.year}-${parts.month}-${parts.day}`;
}

export function addBusinessDays(date: string, days: number) {
  const { year, month, day } = parseDate(date);
  const utcDate = new Date(Date.UTC(year, month - 1, day + days, 12));
  return utcDate.toISOString().slice(0, 10);
}

export function getBusinessDayOfWeek(date: string) {
  const { year, month, day } = parseDate(date);
  return new Date(Date.UTC(year, month - 1, day, 12)).getUTCDay();
}

export function toBusinessDateTime(date: string, time: string) {
  const { year, month, day } = parseDate(date);
  const { hour, minute } = parseTime(time);
  const utcGuess = Date.UTC(year, month - 1, day, hour, minute);
  const zonedParts = getBusinessParts(new Date(utcGuess));
  const zonedAsUtc = Date.UTC(
    zonedParts.year,
    zonedParts.month - 1,
    zonedParts.day,
    zonedParts.hour,
    zonedParts.minute,
    zonedParts.second
  );
  const offsetMs = zonedAsUtc - utcGuess;

  return new Date(utcGuess - offsetMs);
}

/**
 * The single source of truth for the customer booking window (C-14 Phase D):
 * the first and last dates a customer may pick, as London `YYYY-MM-DD`.
 *
 * `latest` is today + `bookingWindowDays`, inclusive — so the last clickable
 * day in the picker is exactly the last day the slots API accepts.
 *
 * `earliest` is the London date of `now + minimumNoticeHours`: the first day
 * that contains any moment satisfying the notice rule. It defaults to 0 hours,
 * which makes `earliest` today — the lower bound the server has always used.
 * The server keeps doing the finer per-slot notice check separately, in
 * `isOutsideMinimumNotice`, so a same-day evening slot stays bookable while
 * the picker (which cannot disable half a day) uses the coarser day floor.
 */
export function getBookingDateBounds({
  now = new Date(),
  bookingWindowDays,
  minimumNoticeHours = 0,
}: {
  now?: Date;
  bookingWindowDays: number;
  minimumNoticeHours?: number;
}) {
  const today = getBusinessDate(now);
  const earliest =
    minimumNoticeHours > 0
      ? getBusinessDate(
          new Date(now.getTime() + minimumNoticeHours * 60 * 60 * 1000)
        )
      : today;

  return { earliest, latest: addBusinessDays(today, bookingWindowDays) };
}

export function isDateInBusinessWindow({
  date,
  now = new Date(),
  bookingWindowDays,
}: {
  date: string;
  now?: Date;
  bookingWindowDays: number;
}) {
  const { earliest, latest } = getBookingDateBounds({ now, bookingWindowDays });

  return date >= earliest && date <= latest;
}

export function isOutsideMinimumNotice({
  date,
  time,
  now = new Date(),
  minimumNoticeHours,
}: {
  date: string;
  time: string;
  now?: Date;
  minimumNoticeHours: number;
}) {
  const requestedAt = toBusinessDateTime(date, time);
  const minimumNoticeAt = new Date(
    now.getTime() + minimumNoticeHours * 60 * 60 * 1000
  );

  return requestedAt >= minimumNoticeAt;
}

export function formatBusinessDate(value: string) {
  const { year, month, day } = parseDate(value);
  return new Intl.DateTimeFormat("en-GB", {
    dateStyle: "medium",
    timeZone: BUSINESS_TIME_ZONE,
  }).format(new Date(Date.UTC(year, month - 1, day, 12)));
}

/**
 * The same business date, spelled out in full ("Friday, 12 June 2026").
 *
 * ITEM I.1 — two hand-rolled copies of this existed and had already drifted:
 * `email/templates.ts` formatted in the HOST timezone, `booking/manage/page.tsx`
 * pinned Europe/London. Both parsed `new Date(`${value}T00:00:00`)`, which is a
 * LOCAL-time parse, so the pinned one rendered the PREVIOUS day on any host east
 * of London: local midnight there is still the day before in London.
 *
 * Parsing at UTC noon removes the class of bug rather than the instance — noon
 * is far enough from either boundary that no offset or DST transition can move
 * the calendar date. `formatBusinessDate` above already does exactly this; this
 * is its long-form twin, kept separate because `dateStyle` is the one thing the
 * two callers genuinely need to differ on.
 */
export function formatBusinessDateLong(value: string) {
  const { year, month, day } = parseDate(value);
  return new Intl.DateTimeFormat("en-GB", {
    dateStyle: "full",
    timeZone: BUSINESS_TIME_ZONE,
  }).format(new Date(Date.UTC(year, month - 1, day, 12)));
}

export function addMinutesToTime(time: string, minutesToAdd: number) {
  const { hour, minute } = parseTime(time);
  const totalMinutes = hour * 60 + minute + minutesToAdd;
  const endHours = Math.floor(totalMinutes / 60);
  const endMinutes = totalMinutes % 60;

  return `${pad(endHours)}:${pad(endMinutes)}`;
}
