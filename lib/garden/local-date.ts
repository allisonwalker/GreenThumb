/** Garden-local calendar helpers. Prefer these over UTC date slicing. */

export function localDateString(
  instant: Date,
  timeZone: string,
): string {
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

export function addCalendarDays(date: string, days: number): string {
  const match = /^(\d{4})-(\d{2})-(\d{2})$/.exec(date);
  if (!match) {
    throw new Error(`Expected YYYY-MM-DD, got ${date}`);
  }

  const utc = new Date(
    Date.UTC(Number(match[1]), Number(match[2]) - 1, Number(match[3])),
  );
  utc.setUTCDate(utc.getUTCDate() + days);
  return utc.toISOString().slice(0, 10);
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

/** UTC instant of local midnight for `instant`'s calendar date in `timeZone`. */
export function startOfLocalDay(instant: Date, timeZone: string): Date {
  return zonedDateTimeToUtc(
    `${localDateString(instant, timeZone)}T00:00:00`,
    timeZone,
  );
}

/** Last UTC instant that still falls on `date` in `timeZone`. */
export function endOfLocalDay(date: string, timeZone: string): Date {
  return new Date(
    zonedDateTimeToUtc(
      `${addCalendarDays(date, 1)}T00:00:00`,
      timeZone,
    ).getTime() - 1,
  );
}

/** Half-open [start, end) covering the local calendar day of `instant`. */
export function localDayInterval(
  instant: Date,
  timeZone: string,
): { start: Date; end: Date } {
  const localDate = localDateString(instant, timeZone);
  const start = startOfLocalDay(
    new Date(`${localDate}T12:00:00.000Z`),
    timeZone,
  );
  const end = startOfLocalDay(
    new Date(`${addCalendarDays(localDate, 1)}T12:00:00.000Z`),
    timeZone,
  );
  return { start, end };
}

/** Half-open [start, end) covering the local calendar month of `instant`. */
export function localMonthInterval(
  instant: Date,
  timeZone: string,
): { start: Date; end: Date; monthKey: string } {
  const localDate = localDateString(instant, timeZone);
  const year = Number(localDate.slice(0, 4));
  const month = Number(localDate.slice(5, 7));
  const monthKey = localDate.slice(0, 7);
  const start = startOfLocalDay(
    new Date(
      `${year}-${String(month).padStart(2, "0")}-01T12:00:00.000Z`,
    ),
    timeZone,
  );
  const nextMonth = month === 12 ? 1 : month + 1;
  const nextYear = month === 12 ? year + 1 : year;
  const end = startOfLocalDay(
    new Date(
      `${nextYear}-${String(nextMonth).padStart(2, "0")}-01T12:00:00.000Z`,
    ),
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
