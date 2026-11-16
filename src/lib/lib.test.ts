import { describe, expect, it } from 'vitest';
import { landingRotation, pickIndex, segmentAt, segmentSizes } from './wheel';
import { dayNumber, dayOfYear, daysTo, daysUntilChristmas, isoDate } from './dates';
import { decodeShare, encodeShare, resolvePlan, upcoming, type Changes, type Week } from './plan';

describe('wheel', () => {
  it('respects weights', () => {
    expect(pickIndex([1, 3], () => 0.1)).toBe(0);
    expect(pickIndex([1, 3], () => 0.3)).toBe(1);
    expect(pickIndex([0, 1], () => 0)).toBe(1);
  });
  it('always lands the chosen segment under the pointer', () => {
    const sizes = segmentSizes([1, 2, 1, 3, 1]);
    for (let i = 0; i < sizes.length; i++) {
      for (const j of [-1, 0, 1]) {
        for (const cur of [0, 123.4, 1800.9]) {
          expect(segmentAt(sizes, landingRotation(sizes, i, cur, 5, j))).toBe(i);
        }
      }
    }
  });
  it('always turns forward by at least the spins', () => {
    const s = segmentSizes([1, 1, 1]);
    expect(landingRotation(s, 0, 50, 5)).toBeGreaterThanOrEqual(50 + 5 * 360);
  });
});

describe('dates', () => {
  it('counts to Christmas, including the day itself and rollover', () => {
    expect(daysUntilChristmas(new Date(2026, 11, 16))).toBe(9);
    expect(daysUntilChristmas(new Date(2026, 11, 25, 23, 59))).toBe(0);
    expect(daysUntilChristmas(new Date(2026, 11, 26))).toBe(364);
  });
  it('is stable across the clocks changing', () => {
    expect(daysUntilChristmas(new Date(2026, 9, 24))).toBe(62);
  });
  it('counts days to a date', () => {
    expect(daysTo(new Date(2026, 10, 16, 23), '2026-11-16')).toBe(0);
    expect(daysTo(new Date(2026, 10, 16), '2026-11-23')).toBe(7);
  });
  it('day number steps by one each day, even across clock changes and New Year', () => {
    expect(dayNumber(new Date(2026, 0, 1)) - dayNumber(new Date(2025, 11, 31))).toBe(1);
    expect(dayNumber(new Date(2026, 2, 29, 12)) - dayNumber(new Date(2026, 2, 28, 12))).toBe(1);
    expect(dayNumber(new Date(2026, 9, 25, 23, 59)) - dayNumber(new Date(2026, 9, 24, 0, 1))).toBe(1);
  });
  it('local ISO date and day of year', () => {
    expect(isoDate(new Date(2026, 0, 5, 23, 59))).toBe('2026-01-05');
    expect(dayOfYear(new Date(2026, 0, 1))).toBe(1);
    expect(dayOfYear(new Date(2026, 11, 31))).toBe(365);
  });
});

const week: Week = {
  school: { mon: { pickup: '3:30', activity: 'Swimming' }, tue: { pickup: '3:30', activity: 'Football' } },
  holiday: { mon: { headline: 'Free day' } },
};
const none: Changes = { holidays: [], oneOffs: [] };

describe('plan', () => {
  const mon = new Date(2026, 10, 16); // Monday 16 Nov 2026
  it('uses weekday defaults', () => {
    expect(resolvePlan(mon, week, none)).toMatchObject({ mode: 'school', activity: 'Swimming', source: 'default' });
  });
  it('switches to holiday inside a range, manual mode wins', () => {
    const c: Changes = { holidays: [{ from: '2026-11-14', to: '2026-11-20', label: 'Half term' }], oneOffs: [] };
    expect(resolvePlan(mon, week, c)).toMatchObject({ mode: 'holiday', headline: 'Free day', holidayLabel: 'Half term' });
    expect(resolvePlan(mon, week, c, { mode: 'school' }).mode).toBe('school');
  });
  it('one-off replaces only the fields given; override beats one-off', () => {
    const c: Changes = { holidays: [], oneOffs: [{ date: '2026-11-16', activity: 'Dentist' }] };
    expect(resolvePlan(mon, week, c)).toMatchObject({ activity: 'Dentist', pickup: '3:30', source: 'one-off' });
    expect(resolvePlan(mon, week, c, { overrides: { '2026-11-16': { activity: 'Cinema' } } })).toMatchObject({ activity: 'Cinema', source: 'override' });
  });
  it('ignores other dates', () => {
    const c: Changes = { holidays: [], oneOffs: [{ date: '2026-11-17', activity: 'Dentist' }] };
    expect(resolvePlan(mon, week, c).activity).toBe('Swimming');
  });
  it('share links round-trip and reject junk', () => {
    const s = { oneOffs: [{ date: '2026-11-16', activity: 'Dentist' }], holidays: [] };
    expect(decodeShare(encodeShare(s))?.oneOffs?.[0]).toMatchObject({ date: '2026-11-16', activity: 'Dentist' });
    expect(decodeShare('not-valid!!')).toBeNull();
  });
  it('shows important dates on their day and in the week ahead', () => {
    const c: Changes = { holidays: [], oneOffs: [], important: [{ date: '2026-11-18', label: 'Party' }] };
    expect(resolvePlan(new Date(2026, 10, 18), week, c).notes).toEqual(['Party']);
    const up = upcoming(mon, 7, week, c);
    expect(up).toHaveLength(7);
    expect(up[0]!.date).toBe('2026-11-17');
    expect(up[6]!.date).toBe('2026-11-23');
    expect(up[1]!.plan.notes).toEqual(['Party']);
    expect(up[0]!.plan.activity).toBe('Football');
  });
  it('a replacement usual week changes the defaults for the days it sets', () => {
    const w = { school: { mon: { pickup: '4:00', activity: 'Art' } } };
    expect(resolvePlan(mon, week, none, { week: w })).toMatchObject({ pickup: '4:00', activity: 'Art' });
    expect(resolvePlan(new Date(2026, 10, 17), week, none, { week: w }).activity).toBe('Football');
  });
  it('share links carry important dates and the usual week', () => {
    const s = { oneOffs: [], holidays: [], important: [{ date: '2026-12-01', label: 'Trip' }], week: { school: { mon: { activity: 'Art' } } } };
    const d = decodeShare(encodeShare(s));
    expect(d?.important?.[0]).toMatchObject({ label: 'Trip' });
    expect(d?.week?.school?.mon).toEqual({ activity: 'Art' });
  });
});
