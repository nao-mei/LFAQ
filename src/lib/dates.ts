export const DAY_KEYS = ['sun', 'mon', 'tue', 'wed', 'thu', 'fri', 'sat'] as const;
export type DayKey = (typeof DAY_KEYS)[number];
export const DAY_NAMES: Record<DayKey, string> = {
  sun: 'Sunday', mon: 'Monday', tue: 'Tuesday', wed: 'Wednesday', thu: 'Thursday', fri: 'Friday', sat: 'Saturday',
};

const pad = (n: number) => String(n).padStart(2, '0');

/** Local calendar date as YYYY-MM-DD (never UTC, so it flips at the child's midnight). */
export const isoDate = (d: Date): string => `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())}`;

export const dayKey = (d: Date): DayKey => DAY_KEYS[d.getDay()]!;

/** Whole local calendar days since 1 Jan 1970. Steps by exactly one at the child's midnight, whatever the clocks do. */
export const dayNumber = (d: Date): number => Math.floor(Date.UTC(d.getFullYear(), d.getMonth(), d.getDate()) / 86_400_000);

/** 1..366, local time. */
export function dayOfYear(d: Date): number {
  const start = new Date(d.getFullYear(), 0, 0);
  const today = new Date(d.getFullYear(), d.getMonth(), d.getDate());
  return Math.round((today.getTime() - start.getTime()) / 86_400_000);
}

/** Whole calendar days from `now` to the next occurrence of month/day (0 = today). Handles DST by using calendar dates. */
export function daysUntil(now: Date, month: number, day: number): number {
  const today = Date.UTC(now.getFullYear(), now.getMonth(), now.getDate());
  let year = now.getFullYear();
  let target = Date.UTC(year, month - 1, day);
  if (target < today) target = Date.UTC(++year, month - 1, day);
  return Math.round((target - today) / 86_400_000);
}

/** Whole calendar days from `now` to a YYYY-MM-DD date (negative if it has passed). */
export function daysTo(now: Date, iso: string): number {
  const [y, m, d] = iso.split('-').map(Number) as [number, number, number];
  return Math.round((Date.UTC(y, m - 1, d) - Date.UTC(now.getFullYear(), now.getMonth(), now.getDate())) / 86_400_000);
}

export const daysUntilChristmas = (now: Date) => daysUntil(now, 12, 25);

export const inRange = (date: string, from: string, to: string) => date >= from && date <= to;
