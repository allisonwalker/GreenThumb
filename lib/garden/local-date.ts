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

export function daysBetween(startDate: string, endDate: string): number {
  const start = Date.parse(`${startDate}T00:00:00.000Z`);
  const end = Date.parse(`${endDate}T00:00:00.000Z`);
  if (!Number.isFinite(start) || !Number.isFinite(end)) {
    throw new Error(`Invalid date range: ${startDate} → ${endDate}`);
  }
  return Math.round((end - start) / 86_400_000);
}
