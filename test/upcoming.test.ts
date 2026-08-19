import { DateTime } from 'luxon';
import { describe, expect, test } from 'vitest';
import type { CalendarConfig, CalendarEventInput } from '@/types';
import { eventStatus, formatCountdown, formatEventDuration, normalizeEvent, pickUpcoming, todayRelation } from '@/week';

const cal: CalendarConfig = { entity: 'calendar.personal', name: 'Personal', color: '#3b82f6' };
const now = DateTime.fromISO('2026-08-19T10:00:00', { zone: 'utc' }); // Wed

function ev(summary: string, start: string, end: string): ReturnType<typeof normalizeEvent> {
  const input: CalendarEventInput = { summary, start: { dateTime: start }, end: { dateTime: end } };
  return normalizeEvent(input, cal, false, 'utc');
}

function allDay(summary: string, startDate: string, endDate: string): ReturnType<typeof normalizeEvent> {
  const input: CalendarEventInput = { summary, start: { date: startDate }, end: { date: endDate } };
  return normalizeEvent(input, cal, false, 'utc');
}

describe('pickUpcoming', () => {
  test('returns null when nothing is ahead', () => {
    expect(pickUpcoming(now, [])).toBeNull();
  });

  test('picks the nearest future timed event', () => {
    const soon = ev('Soon', '2026-08-19T15:00:00', '2026-08-19T16:00:00');
    const later = ev('Later', '2026-08-22T09:00:00', '2026-08-22T10:00:00');
    expect(pickUpcoming(now, [later, soon])?.summary).toBe('Soon');
  });

  test('ignores an event already in progress', () => {
    const running = ev('Running', '2026-08-19T09:00:00', '2026-08-19T11:00:00');
    const next = ev('Next', '2026-08-19T15:00:00', '2026-08-19T16:00:00');
    expect(pickUpcoming(now, [running, next])?.summary).toBe('Next');
  });

  test('avoids all-day events while a timed event remains today', () => {
    const trip = allDay('Trip', '2026-08-19', '2026-08-21');
    const next = ev('Next', '2026-08-19T15:00:00', '2026-08-19T16:00:00');
    expect(pickUpcoming(now, [trip, next])?.summary).toBe('Next');
  });

  test('surfaces a tomorrow all-day event when nothing is left today', () => {
    const past = ev('Done', '2026-08-19T08:00:00', '2026-08-19T09:00:00');
    const holiday = allDay('Holiday', '2026-08-20', '2026-08-21');
    const far = ev('Far', '2026-08-24T09:00:00', '2026-08-24T10:00:00');
    expect(pickUpcoming(now, [past, holiday, far])?.summary).toBe('Holiday');
  });

  test('prefers the tomorrow all-day over a tomorrow timed event when today is clear', () => {
    const holiday = allDay('Holiday', '2026-08-20', '2026-08-21');
    const standup = ev('Standup', '2026-08-20T09:00:00', '2026-08-20T09:15:00');
    expect(pickUpcoming(now, [standup, holiday])?.summary).toBe('Holiday');
  });

  test('falls back to the next timed event when today is clear and no all-day tomorrow', () => {
    const far = ev('Far', '2026-08-24T09:00:00', '2026-08-24T10:00:00');
    expect(pickUpcoming(now, [far])?.summary).toBe('Far');
  });
});

describe('formatCountdown', () => {
  test('minutes only under an hour', () => {
    expect(formatCountdown(now, ev('x', '2026-08-19T10:30:00', '2026-08-19T11:00:00'))).toBe('in 30m');
  });

  test('hours and minutes within the day', () => {
    expect(formatCountdown(now, ev('x', '2026-08-19T12:15:00', '2026-08-19T13:00:00'))).toBe('in 2h 15m');
  });

  test('whole hours drop the minutes', () => {
    expect(formatCountdown(now, ev('x', '2026-08-19T13:00:00', '2026-08-19T14:00:00'))).toBe('in 3h');
  });

  test('days when more than a day away', () => {
    expect(formatCountdown(now, ev('x', '2026-08-22T10:00:00', '2026-08-22T11:00:00'))).toBe('in 3d');
  });

  test('tomorrow label for an all-day tomorrow event', () => {
    expect(formatCountdown(now, allDay('x', '2026-08-20', '2026-08-21'))).toBe('Tomorrow');
  });
});

describe('todayRelation', () => {
  const left = DateTime.fromISO('2026-08-18');
  const right = DateTime.fromISO('2026-08-22');

  test('0 when today is within the visible range', () => {
    expect(todayRelation(DateTime.fromISO('2026-08-19'), left, right)).toBe(0);
  });

  test('-1 when today is before the visible range', () => {
    expect(todayRelation(DateTime.fromISO('2026-08-10'), left, right)).toBe(-1);
  });

  test('1 when today is after the visible range', () => {
    expect(todayRelation(DateTime.fromISO('2026-09-10'), left, right)).toBe(1);
  });
});

describe('eventStatus', () => {
  test('when upcoming counts down to the start', () => {
    const s = eventStatus(now, ev('x', '2026-08-19T12:15:00', '2026-08-19T13:00:00'));
    expect(s.phase).toBe('upcoming');
    expect(s.headline).toBe('2h 15m');
    expect(s.detail).toBe('until it starts');
    expect(s.progress).toBeNull();
  });

  test('with under an hour shows minutes only', () => {
    expect(eventStatus(now, ev('x', '2026-08-19T10:30:00', '2026-08-19T11:00:00')).headline).toBe('30m');
  });

  test('when in progress shows time left and elapsed progress', () => {
    const s = eventStatus(now, ev('x', '2026-08-19T09:00:00', '2026-08-19T11:00:00'));
    expect(s.phase).toBe('now');
    expect(s.headline).toBe('1h');
    expect(s.detail).toBe('left · happening now');
    expect(s.progress).toBeCloseTo(0.5, 5);
  });

  test('when finished reads ended with time since', () => {
    const s = eventStatus(now, ev('x', '2026-08-19T08:00:00', '2026-08-19T09:00:00'));
    expect(s.phase).toBe('ended');
    expect(s.headline).toBe('Ended');
    expect(s.detail).toBe('1h ago');
  });

  test('when all-day today reads Today', () => {
    const s = eventStatus(now, allDay('x', '2026-08-19', '2026-08-20'));
    expect(s.phase).toBe('now');
    expect(s.headline).toBe('Today');
    expect(s.detail).toBe('all-day event');
    expect(s.progress).toBeNull();
  });

  test('when all-day tomorrow reads Tomorrow', () => {
    expect(eventStatus(now, allDay('x', '2026-08-20', '2026-08-21')).headline).toBe('Tomorrow');
  });

  test('when all-day days ahead counts the days', () => {
    expect(eventStatus(now, allDay('x', '2026-08-22', '2026-08-23')).headline).toBe('In 3d');
  });

  test('when all-day yesterday reads Yesterday and ended', () => {
    const s = eventStatus(now, allDay('x', '2026-08-18', '2026-08-19'));
    expect(s.phase).toBe('ended');
    expect(s.headline).toBe('Yesterday');
  });
});

describe('formatEventDuration', () => {
  test('minutes under an hour', () => {
    expect(formatEventDuration(ev('x', '2026-08-19T12:15:00', '2026-08-19T13:00:00'))).toBe('45 min');
  });

  test('whole hours drop the minutes', () => {
    expect(formatEventDuration(ev('x', '2026-08-19T09:00:00', '2026-08-19T11:00:00'))).toBe('2 hr');
  });

  test('hours and minutes together', () => {
    expect(formatEventDuration(ev('x', '2026-08-19T09:00:00', '2026-08-19T10:30:00'))).toBe('1 hr 30 min');
  });
});
