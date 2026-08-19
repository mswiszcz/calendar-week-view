import { DateTime } from 'luxon';
import { describe, expect, test } from 'vitest';
import type { CalendarConfig, CalendarEventInput } from '@/types';
import {
  buildDayColumns,
  CalendarFeature,
  clampScroll,
  computeWeekStart,
  dayCountFor,
  edgeIndex,
  isAllDay,
  lastVisibleIndex,
  layoutDayEvents,
  lockedDays,
  normalizeEvent,
  stackDayEvents,
  supportsFeature,
  weekDays,
  windowDays,
} from '@/week';
import type { WeekEvent } from '@/types';

const now = DateTime.fromISO('2026-08-19T10:00:00', { zone: 'utc' }); // Wed

describe('computeWeekStart', () => {
  test('when monday start returns Monday', () => {
    expect(computeWeekStart(now, 'monday', 0).toISODate()).toBe('2026-08-17');
  });
  test('when sunday start returns Sunday', () => {
    expect(computeWeekStart(now, 'sunday', 0).toISODate()).toBe('2026-08-16');
  });
  test('with positive offset moves forward a week', () => {
    expect(computeWeekStart(now, 'monday', 1).toISODate()).toBe('2026-08-24');
  });
  test('with negative offset moves back a week', () => {
    expect(computeWeekStart(now, 'monday', -1).toISODate()).toBe('2026-08-10');
  });
});

describe('windowDays', () => {
  const firstWeek = DateTime.fromISO('2026-08-17'); // Mon
  test('spans consecutive weeks with 7-day weeks', () => {
    const days = windowDays(firstWeek, 3, 7);
    expect(days).toHaveLength(21);
    expect(days[0].toISODate()).toBe('2026-08-17');
    expect(days[20].toISODate()).toBe('2026-09-06');
  });
  test('skips weekends with 5-day weeks', () => {
    const days = windowDays(firstWeek, 2, 5);
    expect(days).toHaveLength(10);
    expect(days[4].toISODate()).toBe('2026-08-21'); // Fri
    expect(days[5].toISODate()).toBe('2026-08-24'); // next Mon (Sat/Sun skipped)
  });
});

describe('lockedDays', () => {
  const wed = DateTime.fromISO('2026-08-19'); // Wed
  const fri = DateTime.fromISO('2026-08-21'); // Fri
  test('count of 1 returns today only', () => {
    const days = lockedDays(wed, 1, false);
    expect(days.map((d) => d.toISODate())).toEqual(['2026-08-19']);
  });
  test('count of 3 returns today-anchored consecutive days', () => {
    const days = lockedDays(wed, 3, false);
    expect(days.map((d) => d.toISODate())).toEqual(['2026-08-19', '2026-08-20', '2026-08-21']);
  });
  test('with hideWeekend skips Saturday and Sunday', () => {
    const days = lockedDays(fri, 3, true);
    expect(days.map((d) => d.toISODate())).toEqual(['2026-08-21', '2026-08-24', '2026-08-25']);
  });
  test('clamps a count below 1 to a single day', () => {
    expect(lockedDays(wed, 0, false).map((d) => d.toISODate())).toEqual(['2026-08-19']);
  });
});

describe('edgeIndex', () => {
  const starts = [0, 100, 200];
  const sizes = [100, 100, 100];
  test('returns the first child whose right edge clears the edge', () => {
    expect(edgeIndex(starts, sizes, 0)).toBe(0);
    expect(edgeIndex(starts, sizes, 100)).toBe(1);
    expect(edgeIndex(starts, sizes, 150)).toBe(1);
  });
  test('falls back to 0 when the edge is past every child', () => {
    expect(edgeIndex(starts, sizes, 1000)).toBe(0);
  });
});

describe('lastVisibleIndex', () => {
  const starts = [0, 100, 200];
  test('returns the last child starting before the edge', () => {
    expect(lastVisibleIndex(starts, 250)).toBe(2);
    expect(lastVisibleIndex(starts, 150)).toBe(1);
  });
  test('returns 0 when nothing starts before the edge', () => {
    expect(lastVisibleIndex(starts, 0)).toBe(0);
  });
});

describe('clampScroll', () => {
  test('clamps below 0 and above max', () => {
    expect(clampScroll(-5, 100)).toBe(0);
    expect(clampScroll(150, 100)).toBe(100);
    expect(clampScroll(50, 100)).toBe(50);
  });
});

describe('weekDays / dayCountFor', () => {
  test('with weekend gives 7 days', () => {
    const days = weekDays(computeWeekStart(now, 'monday', 0), dayCountFor(false));
    expect(days).toHaveLength(7);
    expect(days[0].toISODate()).toBe('2026-08-17');
    expect(days[6].toISODate()).toBe('2026-08-23');
  });
  test('without weekend gives 5 days', () => {
    expect(dayCountFor(true)).toBe(5);
    expect(weekDays(computeWeekStart(now, 'monday', 0), 5)).toHaveLength(5);
  });
});

const cal: CalendarConfig = { entity: 'calendar.personal', name: 'Personal', color: '#3b82f6' };

describe('isAllDay', () => {
  test('true for date-only span', () => {
    const s = DateTime.fromISO('2026-08-19');
    expect(isAllDay(s, s.plus({ days: 1 }))).toBe(true);
  });
  test('false for a timed 1h event', () => {
    const s = DateTime.fromISO('2026-08-19T09:00');
    expect(isAllDay(s, s.plus({ hours: 1 }))).toBe(false);
  });
});

describe('normalizeEvent', () => {
  test('maps a timed event', () => {
    const input: CalendarEventInput = {
      summary: 'Gym',
      start: { dateTime: '2026-08-19T08:30:00' },
      end: { dateTime: '2026-08-19T09:15:00' },
    };
    const ev = normalizeEvent(input, cal, false);
    expect(ev.summary).toBe('Gym');
    expect(ev.allDay).toBe(false);
    expect(ev.color).toBe('#3b82f6');
    expect(ev.calendarEntity).toBe('calendar.personal');
  });
  test('maps an all-day event', () => {
    const input: CalendarEventInput = {
      summary: 'Trash day',
      start: { date: '2026-08-17' },
      end: { date: '2026-08-18' },
    };
    expect(normalizeEvent(input, cal, false).allDay).toBe(true);
  });
  test('parses a date-only start in the given zone', () => {
    const ev = normalizeEvent(
      { summary: 'Trip', start: { date: '2026-08-19' }, end: { date: '2026-08-20' } },
      cal,
      false,
      'America/New_York',
    );
    expect(ev.start.zoneName).toBe('America/New_York');
    expect(ev.start.toISODate()).toBe('2026-08-19');
    expect(ev.start.hour).toBe(0);
  });
  test('captures uid and marks non-recurring events', () => {
    const ev = normalizeEvent(
      {
        summary: 'One-off',
        uid: 'abc-123',
        start: { dateTime: '2026-08-19T09:00' },
        end: { dateTime: '2026-08-19T10:00' },
      },
      cal,
      false,
    );
    expect(ev.uid).toBe('abc-123');
    expect(ev.recurrenceId).toBeNull();
    expect(ev.recurring).toBe(false);
  });
  test('marks events with an rrule or recurrence_id as recurring', () => {
    const master = normalizeEvent(
      {
        summary: 'Standup',
        uid: 'u1',
        rrule: 'FREQ=DAILY',
        start: { dateTime: '2026-08-19T09:00' },
        end: { dateTime: '2026-08-19T09:15' },
      },
      cal,
      false,
    );
    const instance = normalizeEvent(
      {
        summary: 'Standup',
        uid: 'u1',
        recurrence_id: '2026-08-19T09:00:00',
        start: { dateTime: '2026-08-19T09:00' },
        end: { dateTime: '2026-08-19T09:15' },
      },
      cal,
      false,
    );
    expect(master.recurring).toBe(true);
    expect(instance.recurring).toBe(true);
    expect(instance.recurrenceId).toBe('2026-08-19T09:00:00');
  });
});

describe('supportsFeature', () => {
  test('detects a set feature bit', () => {
    const state = {
      attributes: { supported_features: CalendarFeature.CREATE | CalendarFeature.DELETE },
    };
    expect(supportsFeature(state, CalendarFeature.CREATE)).toBe(true);
    expect(supportsFeature(state, CalendarFeature.DELETE)).toBe(true);
    expect(supportsFeature(state, CalendarFeature.UPDATE)).toBe(false);
  });
  test('is false for a missing state or no features', () => {
    expect(supportsFeature(undefined, CalendarFeature.DELETE)).toBe(false);
    expect(supportsFeature({ attributes: {} }, CalendarFeature.DELETE)).toBe(false);
  });
});

describe('normalizeEvent key / combineSimilar', () => {
  const calA: CalendarConfig = { entity: 'calendar.a', color: '#111' };
  const calB: CalendarConfig = { entity: 'calendar.b', color: '#222' };
  const input: CalendarEventInput = {
    summary: 'Sync',
    start: { dateTime: '2026-08-19T09:00' },
    end: { dateTime: '2026-08-19T09:30' },
  };
  test('with combineSimilar merges identical events across calendars', () => {
    expect(normalizeEvent(input, calA, true).key).toBe(normalizeEvent(input, calB, true).key);
  });
  test('without combineSimilar keeps per-calendar events distinct', () => {
    expect(normalizeEvent(input, calA, false).key).not.toBe(normalizeEvent(input, calB, false).key);
  });
});

const bySummary = (placed: ReturnType<typeof layoutDayEvents>) =>
  Object.fromEntries(placed.map((p) => [p.event.summary, p]));

describe('layoutDayEvents', () => {
  const timed = (summary: string, start: string, end: string): WeekEvent =>
    normalizeEvent(
      { summary, start: { dateTime: `2026-08-19T${start}` }, end: { dateTime: `2026-08-19T${end}` } },
      cal,
      false,
    );

  test('non-overlapping events each fill the whole width', () => {
    const placed = layoutDayEvents([timed('A', '09:00', '10:00'), timed('B', '11:00', '12:00')]);
    expect(placed.every((p) => p.cols === 1 && p.col === 0)).toBe(true);
  });

  test('computes minute offsets from midnight', () => {
    const [p] = layoutDayEvents([timed('A', '08:30', '09:15')]);
    expect(p.startMin).toBe(510);
    expect(p.endMin).toBe(555);
  });

  test('two overlapping events split into two lanes', () => {
    const p = bySummary(layoutDayEvents([timed('A', '09:00', '11:00'), timed('B', '10:00', '12:00')]));
    expect([p.A.cols, p.B.cols]).toEqual([2, 2]);
    expect([p.A.col, p.B.col]).toEqual([0, 1]);
  });

  test('a transitive cluster shares lanes where events do not overlap', () => {
    // A(9-11) & B(10-12) overlap; C(11:30-13) clears A, so C reuses A's lane.
    const p = bySummary(
      layoutDayEvents([timed('A', '09:00', '11:00'), timed('B', '10:00', '12:00'), timed('C', '11:30', '13:00')]),
    );
    expect([p.A.cols, p.B.cols, p.C.cols]).toEqual([2, 2, 2]);
    expect([p.A.col, p.B.col, p.C.col]).toEqual([0, 1, 0]);
  });

  test('back-to-back events reuse a lane within a cluster', () => {
    // B spans the pair, forcing 2 lanes; A ends as C starts, so they share lane 0.
    const p = bySummary(
      layoutDayEvents([timed('A', '09:00', '10:00'), timed('B', '09:00', '11:00'), timed('C', '10:00', '11:00')]),
    );
    expect([p.A.cols, p.B.cols, p.C.cols]).toEqual([2, 2, 2]);
    expect([p.A.col, p.B.col, p.C.col]).toEqual([0, 1, 0]);
  });
});

describe('stackDayEvents', () => {
  const timed = (summary: string, start: string, end: string): WeekEvent =>
    normalizeEvent(
      { summary, start: { dateTime: `2026-08-19T${start}` }, end: { dateTime: `2026-08-19T${end}` } },
      cal,
      false,
    );

  test('non-overlapping events keep their real time position', () => {
    const s = stackDayEvents([timed('A', '09:00', '10:00'), timed('B', '11:00', '12:00')], 30);
    expect(s.map((x) => x.topMin)).toEqual([540, 660]);
    expect(s.map((x) => x.heightMin)).toEqual([60, 60]);
  });

  test('overlapping events cascade below the previous block', () => {
    const s = stackDayEvents([timed('A', '09:00', '10:00'), timed('B', '09:30', '10:30')], 30);
    expect(s[0].topMin).toBe(540);
    expect(s[1].topMin).toBe(600); // pushed below A (540 + 60), not its real 570
  });

  test('applies the minimum height but preserves the true duration', () => {
    const [s] = stackDayEvents([timed('A', '09:00', '09:10')], 30);
    expect(s.heightMin).toBe(30);
    expect(s.durationMin).toBe(10);
  });
});

describe('buildDayColumns', () => {
  const days = weekDays(DateTime.fromISO('2026-08-17'), 7);
  const nowRef = DateTime.fromISO('2026-08-19T10:00');

  test('splits a multi-day event across covered days with chevrons', () => {
    const vacation = normalizeEvent(
      { summary: 'Vacation', start: { date: '2026-08-18' }, end: { date: '2026-08-21' } },
      { entity: 'calendar.family', color: '#f59e0b' },
      false,
    );
    const cols = buildDayColumns({ days, now: nowRef, events: [vacation] });
    // Tue(18) start, Wed(19) middle, Thu(20) end (end date 21 is exclusive)
    expect(cols[1].allDayEvents).toHaveLength(1);
    expect(cols[1].allDayEvents[0].continuesLeft).toBe(false);
    expect(cols[1].allDayEvents[0].continuesRight).toBe(true);
    expect(cols[2].allDayEvents[0].continuesLeft).toBe(true);
    expect(cols[2].allDayEvents[0].continuesRight).toBe(true);
    expect(cols[3].allDayEvents[0].continuesLeft).toBe(true);
    expect(cols[3].allDayEvents[0].continuesRight).toBe(false);
    expect(cols[4].allDayEvents).toHaveLength(0);
  });

  test('marks today and past days and sorts timed events', () => {
    const late = normalizeEvent(
      {
        summary: 'Late',
        start: { dateTime: '2026-08-19T15:00' },
        end: { dateTime: '2026-08-19T16:00' },
      },
      cal,
      false,
    );
    const early = normalizeEvent(
      {
        summary: 'Early',
        start: { dateTime: '2026-08-19T08:00' },
        end: { dateTime: '2026-08-19T09:00' },
      },
      cal,
      false,
    );
    const cols = buildDayColumns({ days, now: nowRef, events: [late, early] });
    expect(cols[0].isPast).toBe(true); // Mon
    expect(cols[2].isToday).toBe(true); // Wed
    expect(cols[2].timedEvents.map((e) => e.summary)).toEqual(['Early', 'Late']);
  });
});
