import { DateTime } from 'luxon';
import { describe, expect, test } from 'vitest';
import type { CalendarConfig, CalendarEventInput } from '@/types';
import {
  autoScrollStartIndex,
  buildDayColumns,
  CalendarFeature,
  computeWeekStart,
  dayCountFor,
  formatWeekLabel,
  isAllDay,
  normalizeEvent,
  supportsFeature,
  weekDays,
} from '@/week';

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

describe('autoScrollStartIndex', () => {
  test('when today mid-week starts at today', () => {
    expect(autoScrollStartIndex(2, 7, 3)).toBe(2); // Wed
  });
  test('when today is last day shifts back by visible-1', () => {
    expect(autoScrollStartIndex(6, 7, 3)).toBe(4); // Sun → show Fri..Sun
  });
  test('when today almost last shifts by one', () => {
    expect(autoScrollStartIndex(5, 7, 3)).toBe(4); // Sat → show Fri..Sun
  });
  test('when today not in week returns 0', () => {
    expect(autoScrollStartIndex(-1, 7, 3)).toBe(0);
  });
});

describe('formatWeekLabel', () => {
  test('renders a compact range', () => {
    const label = formatWeekLabel(DateTime.fromISO('2026-08-17'), 7);
    expect(label).toContain('17');
    expect(label).toContain('23');
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
