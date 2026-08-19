import { DateTime } from 'luxon';
import { describe, expect, test } from 'vitest';
import type { HourlyForecast, WeekEvent } from '@/types';
import { buildForecastMap, forecastForEvent, weatherIcon } from '@/weather';

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
