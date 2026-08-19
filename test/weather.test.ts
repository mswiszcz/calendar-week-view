import { DateTime } from 'luxon';
import { describe, expect, test } from 'vitest';
import type { HourlyForecast, WeekEvent } from '@/types';
import { buildForecastMap, forecastForEvent, weatherIcon, weatherLabel, weatherSamplesForEvent } from '@/weather';

const now = DateTime.fromISO('2026-08-19T10:00');
function ev(startISO: string, allDay = false): WeekEvent {
  const s = DateTime.fromISO(startISO);
  return {
    key: 'k',
    summary: 's',
    description: null,
    location: null,
    uid: null,
    recurrenceId: null,
    rrule: null,
    recurring: false,
    start: s,
    end: s.plus({ hours: 1 }),
    originalStart: s,
    originalEnd: s.plus({ hours: 1 }),
    allDay,
    multiDay: false,
    continuesLeft: false,
    continuesRight: false,
    calendarEntity: 'calendar.x',
    color: '#000',
    calendarName: 'X',
  };
}
const forecasts: HourlyForecast[] = [
  { datetime: '2026-08-19T12:00:00', condition: 'sunny', temperature: 24 },
  { datetime: '2026-08-19T15:00:00', condition: 'rainy', temperature: 18 },
];

describe('forecastForEvent', () => {
  const map = buildForecastMap(forecasts);
  test('returns forecast at the event start hour', () => {
    expect(forecastForEvent(ev('2026-08-19T12:00'), now, map)?.temperature).toBe(24);
  });
  test('keys forecasts in the given zone so cross-timezone events match', () => {
    // 09:30 UTC == 15:00 in Asia/Kolkata (+05:30); a browser in any other zone must still match.
    const zone = 'Asia/Kolkata';
    const zonedMap = buildForecastMap(
      [{ datetime: '2026-08-19T09:30:00+00:00', condition: 'sunny', temperature: 30 }],
      zone,
    );
    const s = DateTime.fromISO('2026-08-19T15:00:00', { zone });
    const event: WeekEvent = { ...ev('2026-08-19T15:00'), start: s, end: s.plus({ hours: 1 }) };
    const zonedNow = DateTime.fromISO('2026-08-19T10:00:00', { zone });
    expect(forecastForEvent(event, zonedNow, zonedMap)?.temperature).toBe(30);
  });
  test('returns null for a past event', () => {
    expect(forecastForEvent(ev('2026-08-19T08:00'), now, map)).toBeNull();
  });
  test('returns null for an all-day event', () => {
    expect(forecastForEvent(ev('2026-08-19T12:00', true), now, map)).toBeNull();
  });
  test('returns null beyond the forecast horizon', () => {
    expect(forecastForEvent(ev('2026-08-25T12:00'), now, map)).toBeNull();
  });
});

describe('weatherIcon', () => {
  test('maps known conditions', () => {
    expect(weatherIcon('sunny')).toBe('mdi:weather-sunny');
    expect(weatherIcon('partlycloudy')).toBe('mdi:weather-partly-cloudy');
  });
  test('falls back for unknown', () => {
    expect(weatherIcon('nonsense')).toBe('mdi:weather-cloudy');
  });
});

describe('weatherLabel', () => {
  test('names known conditions', () => {
    expect(weatherLabel('partlycloudy')).toBe('Partly cloudy');
    expect(weatherLabel('clear-night')).toBe('Clear');
  });
  test('falls back for unknown', () => {
    expect(weatherLabel('nonsense')).toBe('Weather');
  });
});

describe('weatherSamplesForEvent', () => {
  // Afternoon into the night, plus tomorrow midday — a horizon that ends at 21:00 today.
  const list: HourlyForecast[] = [
    { datetime: '2026-08-19T12:00:00', condition: 'sunny', temperature: 24 },
    { datetime: '2026-08-19T17:00:00', condition: 'sunny', temperature: 22 },
    { datetime: '2026-08-19T18:00:00', condition: 'partlycloudy', temperature: 20 },
    { datetime: '2026-08-19T20:00:00', condition: 'cloudy', temperature: 18 },
    { datetime: '2026-08-19T21:00:00', condition: 'clear-night', temperature: 15 },
    { datetime: '2026-08-20T12:00:00', condition: 'rainy', temperature: 19 },
  ];
  const map = buildForecastMap(list);

  function timed(startISO: string, endISO: string): WeekEvent {
    const s = DateTime.fromISO(startISO);
    const e = DateTime.fromISO(endISO);
    return { ...ev(startISO), start: s, end: e, originalStart: s, originalEnd: e };
  }
  function allDay(startISO: string, endISO: string): WeekEvent {
    const s = DateTime.fromISO(startISO).startOf('day');
    const e = DateTime.fromISO(endISO).startOf('day');
    const multiDay = e.startOf('day') > s.startOf('day').plus({ days: 1 });
    return { ...timed(startISO, endISO), start: s, end: e, originalStart: s, originalEnd: e, allDay: true, multiDay };
  }

  test('one sample for an event up to an hour', () => {
    const s = weatherSamplesForEvent(timed('2026-08-19T17:00', '2026-08-19T18:00'), now, map);
    expect(s).toHaveLength(1);
    expect(s[0]).toMatchObject({ kind: 'clock', temperature: 22 });
  });
  test('samples start, middle, and end of a longer event', () => {
    const s = weatherSamplesForEvent(timed('2026-08-19T17:00', '2026-08-19T20:00'), now, map);
    // 17:00, midpoint 18:30 → 18:00 slot, 20:00
    expect(s.map((x) => x.temperature)).toEqual([22, 20, 18]);
  });
  test('drops a sample beyond the forecast horizon', () => {
    const s = weatherSamplesForEvent(timed('2026-08-19T20:00', '2026-08-19T23:00'), now, map);
    // 20:00 cloudy, midpoint 21:30 → 21:00 clear-night, 23:00 has no slot → dropped
    expect(s.map((x) => x.temperature)).toEqual([18, 15]);
  });
  test('no samples for a past event', () => {
    expect(weatherSamplesForEvent(timed('2026-08-19T06:00', '2026-08-19T07:00'), now, map)).toHaveLength(0);
  });
  test('event day / night / next day for a multi-day event', () => {
    const s = weatherSamplesForEvent(allDay('2026-08-19', '2026-08-21'), now, map);
    expect(s.map((x) => x.kind)).toEqual(['eventday', 'night', 'nextday']);
    expect(s.map((x) => x.temperature)).toEqual([24, 15, 19]);
  });
  test('anchors the outlook to a future event day, not today', () => {
    // now is 2026-08-19; the only future slot is 2026-08-20 12:00 (rainy 19). An
    // all-day event on the 20th must sample its own noon, not today's (sunny 24).
    const s = weatherSamplesForEvent(allDay('2026-08-20', '2026-08-21'), now, map);
    expect(s.map((x) => x.kind)).toEqual(['eventday']);
    expect(s.map((x) => x.temperature)).toEqual([19]);
  });
  test('no samples for an all-day event beyond the forecast horizon', () => {
    expect(weatherSamplesForEvent(allDay('2026-08-25', '2026-08-26'), now, map)).toHaveLength(0);
  });
});
