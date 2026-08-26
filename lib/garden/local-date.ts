/**
 * Garden-local calendar helpers.
 *
 * "Today" is the calendar date in the singleton `garden.timezone` (IANA),
 * never the server's timezone and never `new Date().toISOString().slice(0, 10)`.
 * Use `gardenLocalToday` for "is it today?", `localDateString` to map an
 * instant onto that calendar, and `daysBetween` / `addCalendarDays` for spans.
 */

const ISO_CALENDAR_DATE = /^(\d{4})-(\d{2})-(\d{2})$/;

export type GardenTimezone = {
  timezone: string;
};

export function parseIsoCalendarDate(value: string): {
  year: number;
  month: number;
  day: number;
} {
  const match = ISO_CALENDAR_DATE.exec(value);
  if (!match) {
    throw new Error(`Expected YYYY-MM-DD, got ${value}`);
  }

  return {
    year: Number(match[1]),
    month: Number(match[2]),
    day: Number(match[3]),
  };
}

function formatUtcCalendarDate(instant: Date): string {
  const year = instant.getUTCFullYear();
  const month = String(instant.getUTCMonth() + 1).padStart(2, "0");
  const day = String(instant.getUTCDate()).padStart(2, "0");
  return `${year}-${month}-${day}`;
}

/** True when `value` is a real Gregorian YYYY-MM-DD (rejects 2026-02-30). */
export function isIsoCalendarDate(value: string): boolean {
  if (!ISO_CALENDAR_DATE.test(value)) {
    return false;
  }

  const { year, month, day } = parseIsoCalendarDate(value);
  const utc = new Date(Date.UTC(year, month - 1, day));
  return formatUtcCalendarDate(utc) === value;
}

export function requireIsoCalendarDate(value: string, label: string): string {
  if (!isIsoCalendarDate(value)) {
    throw new Error(`${label} must be a valid date.`);
  }
  return value;
}

export function localDateString(instant: Date, timeZone: string): string {
  const parts = new Intl.DateTimeFormat("en-US", {
    timeZone,
    year: "numeric",
    month: "2-digit",
    day: "2-digit",
  }).formatToParts(instant);
  const part = (type: Intl.DateTimeFormatPartTypes) =>
    parts.find((value) => value.type === type)?.value;

  const year = part("year");
  const month = part("month");
  const day = part("day");
  if (!year || !month || !day) {
    throw new Error(`Could not format local date for timezone ${timeZone}`);
  }

  return `${year}-${month}-${day}`;
}

/**
 * Current garden-local calendar date.
 * Pass `timezone` from the singleton `garden` row.
 */
export function gardenLocalToday(
  garden: GardenTimezone,
  now: Date = new Date(),
): string {
  return localDateString(now, garden.timezone);
}

export function addCalendarDays(date: string, days: number): string {
  const { year, month, day } = parseIsoCalendarDate(date);
  const utc = new Date(Date.UTC(year, month - 1, day));
  utc.setUTCDate(utc.getUTCDate() + days);
  return formatUtcCalendarDate(utc);
}

function zonedParts(instant: Date, timeZone: string) {
  const parts = new Intl.DateTimeFormat("en-US", {
    timeZone,
    year: "numeric",
    month: "2-digit",
    day: "2-digit",
    hour: "2-digit",
    minute: "2-digit",
    second: "2-digit",
    hourCycle: "h23",
  }).formatToParts(instant);
  const part = (type: Intl.DateTimeFormatPartTypes) =>
    parts.find((value) => value.type === type)?.value;

  const year = part("year");
  const month = part("month");
  const day = part("day");
  const hour = part("hour");
  const minute = part("minute");
  const second = part("second");
  if (!year || !month || !day || !hour || !minute || !second) {
    throw new Error(`Could not format local date-time for timezone ${timeZone}`);
  }

  return { year, month, day, hour, minute, second };
}

export function localDateTimeString(
  instant: Date,
  timeZone: string,
): string {
  const parts = zonedParts(instant, timeZone);
  return `${parts.year}-${parts.month}-${parts.day}T${parts.hour}:${parts.minute}`;
}

export function zonedDateTimeToUtc(
  localDateTime: string,
  timeZone: string,
): Date {
  const match = /^(\d{4})-(\d{2})-(\d{2})T(\d{2}):(\d{2})(?::(\d{2}))?$/.exec(
    localDateTime,
  );
  if (!match) {
    throw new Error(`Expected YYYY-MM-DDTHH:mm, got ${localDateTime}`);
  }

  const year = Number(match[1]);
  const month = Number(match[2]);
  const day = Number(match[3]);
  const hour = Number(match[4]);
  const minute = Number(match[5]);
  const second = Number(match[6] ?? "0");
  const utcGuess = Date.UTC(year, month - 1, day, hour, minute, second);
  const asZone = zonedParts(new Date(utcGuess), timeZone);
  const zoneAsUtc = Date.UTC(
    Number(asZone.year),
    Number(asZone.month) - 1,
    Number(asZone.day),
    Number(asZone.hour),
    Number(asZone.minute),
    Number(asZone.second),
  );
  const instant = new Date(utcGuess - (zoneAsUtc - utcGuess));
  const roundTrip = zonedParts(instant, timeZone);
  if (
    Number(roundTrip.year) !== year ||
    Number(roundTrip.month) !== month ||
    Number(roundTrip.day) !== day ||
    Number(roundTrip.hour) !== hour ||
    Number(roundTrip.minute) !== minute
  ) {
    throw new Error(
      `${localDateTime} is not a valid local time in ${timeZone}.`,
    );
  }

  return instant;
}

export function startOfLocalCalendarDate(
  date: string,
  timeZone: string,
): Date {
  return zonedDateTimeToUtc(`${date}T00:00:00`, timeZone);
}

/** UTC instant of local midnight for `instant`'s calendar date in `timeZone`. */
export function startOfLocalDay(instant: Date, timeZone: string): Date {
  return startOfLocalCalendarDate(
    localDateString(instant, timeZone),
    timeZone,
  );
}

/** Last UTC instant that still falls on `date` in `timeZone`. */
export function endOfLocalDay(date: string, timeZone: string): Date {
  return new Date(
    startOfLocalCalendarDate(addCalendarDays(date, 1), timeZone).getTime() - 1,
  );
}

/** Half-open [start, end) covering the local calendar day of `instant`. */
export function localDayInterval(
  instant: Date,
  timeZone: string,
): { start: Date; end: Date } {
  const localDate = localDateString(instant, timeZone);
  const start = startOfLocalCalendarDate(localDate, timeZone);
  const end = startOfLocalCalendarDate(addCalendarDays(localDate, 1), timeZone);
  return { start, end };
}

/** Half-open [start, end) covering the local calendar month of `instant`. */
export function localMonthInterval(
  instant: Date,
  timeZone: string,
): { start: Date; end: Date; monthKey: string } {
  const { year, month } = parseIsoCalendarDate(
    localDateString(instant, timeZone),
  );
  const monthKey = `${year}-${String(month).padStart(2, "0")}`;
  const start = startOfLocalCalendarDate(`${monthKey}-01`, timeZone);
  const nextMonth = month === 12 ? 1 : month + 1;
  const nextYear = month === 12 ? year + 1 : year;
  const end = startOfLocalCalendarDate(
    `${nextYear}-${String(nextMonth).padStart(2, "0")}-01`,
    timeZone,
  );
  return { start, end, monthKey };
}

export function daysBetween(startDate: string, endDate: string): number {
  const start = Date.parse(`${startDate}T00:00:00.000Z`);
  const end = Date.parse(`${endDate}T00:00:00.000Z`);
  if (!Number.isFinite(start) || !Number.isFinite(end)) {
    throw new Error(`Invalid date range: ${startDate} → ${endDate}`);
  }
  return Math.round((end - start) / 86_400_000);
}
