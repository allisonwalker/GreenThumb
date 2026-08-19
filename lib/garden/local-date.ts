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

/** UTC instant of local midnight for `instant`'s calendar date in `timeZone`. */
export function startOfLocalDay(instant: Date, timeZone: string): Date {
  return utcInstantFromLocalDateTime(
    localDateString(instant, timeZone),
    "00:00:00",
    timeZone,
  );
}

/** Last UTC instant that still falls on `date` in `timeZone`. */
export function endOfLocalDay(date: string, timeZone: string): Date {
  return new Date(
    utcInstantFromLocalDateTime(
      addCalendarDays(date, 1),
      "00:00:00",
      timeZone,
    ).getTime() - 1,
  );
}

function utcInstantFromLocalDateTime(
  date: string,
  time: string,
  timeZone: string,
): Date {
  const asUtc = new Date(`${date}T${time}Z`);
  if (Number.isNaN(asUtc.getTime())) {
    throw new Error(`Invalid local date-time ${date} ${time}`);
  }
  const firstOffset = localOffsetMs(asUtc, timeZone);
  const corrected = new Date(asUtc.getTime() - firstOffset);
  const secondOffset = localOffsetMs(corrected, timeZone);
  if (secondOffset !== firstOffset) {
    return new Date(asUtc.getTime() - secondOffset);
  }
  return corrected;
}

/** Local wall-clock interpreted as UTC, minus the real UTC instant. */
function localOffsetMs(instant: Date, timeZone: string): number {
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
    throw new Error(`Could not read local offset for timezone ${timeZone}`);
  }
  const localAsUtc = Date.UTC(
    Number(year),
    Number(month) - 1,
    Number(day),
    Number(hour),
    Number(minute),
    Number(second),
  );
  return localAsUtc - instant.getTime();
}

export function daysBetween(startDate: string, endDate: string): number {
  const start = Date.parse(`${startDate}T00:00:00.000Z`);
  const end = Date.parse(`${endDate}T00:00:00.000Z`);
  if (!Number.isFinite(start) || !Number.isFinite(end)) {
    throw new Error(`Invalid date range: ${startDate} → ${endDate}`);
  }
  return Math.round((end - start) / 86_400_000);
}
