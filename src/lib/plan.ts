import { DAY_KEYS, dayKey, inRange, isoDate, type DayKey } from './dates';
import { fromB64, toB64 } from './b64';

export type Mode = 'school' | 'holiday';
export interface Slot { headline?: string; pickup?: string; activity?: string }
export type WeekMode = Partial<Record<DayKey, Slot>>;
export interface Week { school: WeekMode; holiday: WeekMode }
export interface Dated { date: string; label: string }
export interface Changes {
  holidays: { from: string; to: string; label?: string }[];
  oneOffs: ({ date: string } & Slot)[];
  important?: Dated[];
}
/** What is stored on the device. Everything dated disappears once its day has passed. */
export interface Local {
  mode?: Mode;
  overrides?: Record<string, Slot>;
  oneOffs?: ({ date: string } & Slot)[];
  holidays?: Changes['holidays'];
  important?: Dated[];
  /** A replacement "usual week", from the grown-ups page. Kept until changed. */
  week?: Partial<Week>;
}

export interface Resolved extends Slot {
  mode: Mode;
  source: 'override' | 'one-off' | 'default';
  holidayLabel?: string;
  /** Important dates falling on this day. */
  notes: string[];
}

export const mergeWeek = (w: Week, o?: Partial<Week>): Week => ({
  school: { ...w.school, ...o?.school },
  holiday: { ...w.holiday, ...o?.holiday },
});

/**
 * Precedence: on-device override > dated one-off (repo, then shared link) > weekday default for the mode.
 * Mode: an on-device manual choice wins; otherwise a dated holiday range switches to Holiday automatically.
 */
export function resolvePlan(now: Date, weekIn: Week, changes: Changes, local: Local = {}): Resolved {
  const date = isoDate(now);
  const week = mergeWeek(weekIn, local.week);
  const hol = [...changes.holidays, ...(local.holidays ?? [])].find((h) => inRange(date, h.from, h.to));
  const mode: Mode = local.mode ?? (hol ? 'holiday' : 'school');
  const oneOff = [...changes.oneOffs, ...(local.oneOffs ?? [])].filter((o) => o.date === date).at(-1);
  const override = local.overrides?.[date];
  const merged: Slot = { ...week[mode][dayKey(now)] };
  for (const s of [oneOff, override]) {
    if (!s) continue;
    for (const k of ['headline', 'pickup', 'activity'] as const) if (s[k]) merged[k] = s[k];
  }
  const notes = [...(changes.important ?? []), ...(local.important ?? [])].filter((x) => x.date === date).map((x) => x.label);
  return {
    ...merged,
    mode,
    source: override ? 'override' : oneOff ? 'one-off' : 'default',
    ...(hol?.label ? { holidayLabel: hol.label } : {}),
    notes,
  };
}

/** The next `days` days after today (tomorrow first), each resolved. Works at noon so clock changes cannot skip a day. */
export function upcoming(now: Date, days: number, week: Week, changes: Changes, local: Local = {}) {
  return Array.from({ length: days }, (_, i) => {
    const d = new Date(now.getFullYear(), now.getMonth(), now.getDate() + i + 1, 12);
    return { date: isoDate(d), day: dayKey(d), d, plan: resolvePlan(d, week, changes, local) };
  });
}

export type Shareable = Pick<Local, 'oneOffs' | 'holidays' | 'important' | 'week'>;

/** Compact, URL-safe encoding for the "send to the child's device" link. */
export const encodeShare = (c: Shareable): string => toB64(JSON.stringify(c));

const DATE = /^\d{4}-\d{2}-\d{2}$/;
const str = (x: unknown) => (typeof x === 'string' && x.trim() ? x.trim().slice(0, 60) : undefined);
const slot = (x: unknown): Slot => {
  const o = (x ?? {}) as Record<string, unknown>;
  const s: Slot = {};
  for (const k of ['headline', 'pickup', 'activity'] as const) { const v = str(o[k]); if (v) s[k] = v; }
  return s;
};

/** Reads a share link's data defensively: wrong shapes are dropped and text is length-limited. */
export function decodeShare(s: string): Shareable | null {
  try {
    const o = JSON.parse(fromB64(s)) as Record<string, unknown>;
    const arr = (x: unknown) => (Array.isArray(x) ? x : []);
    const oneOffs = arr(o.oneOffs)
      .filter((x) => DATE.test(x?.date ?? '')).slice(0, 60)
      .map((x) => ({ date: x.date as string, ...slot(x) }));
    const holidays = arr(o.holidays)
      .filter((x) => DATE.test(x?.from ?? '') && DATE.test(x?.to ?? '')).slice(0, 30)
      .map((x) => ({ from: x.from as string, to: x.to as string, ...(str(x.label) ? { label: str(x.label)! } : {}) }));
    const important = arr(o.important)
      .filter((x) => DATE.test(x?.date ?? '') && str(x?.label)).slice(0, 60)
      .map((x) => ({ date: x.date as string, label: str(x.label)! }));
    let week: Partial<Week> | undefined;
    if (o.week && typeof o.week === 'object') {
      const w = o.week as Record<string, Record<string, unknown> | undefined>;
      week = {};
      for (const m of ['school', 'holiday'] as const) {
        if (!w[m]) continue;
        week[m] = Object.fromEntries(DAY_KEYS.filter((k) => w[m]![k]).map((k) => [k, slot(w[m]![k])]));
      }
    }
    return { oneOffs, holidays, important, ...(week ? { week } : {}) };
  } catch {
    return null;
  }
}
