import { DateTime } from 'luxon';
import type { HourlyForecast, WeekEvent } from '@/types';

type ForecastSlot = { condition: string; temperature: number };

const ICONS: Record<string, string> = {
  'clear-night': 'mdi:weather-night',
  cloudy: 'mdi:weather-cloudy',
  fog: 'mdi:weather-fog',
  hail: 'mdi:weather-hail',
  lightning: 'mdi:weather-lightning',
  'lightning-rainy': 'mdi:weather-lightning-rainy',
  partlycloudy: 'mdi:weather-partly-cloudy',
  pouring: 'mdi:weather-pouring',
  rainy: 'mdi:weather-rainy',
  snowy: 'mdi:weather-snowy',
  'snowy-rainy': 'mdi:weather-snowy-rainy',
  sunny: 'mdi:weather-sunny',
  windy: 'mdi:weather-windy',
  'windy-variant': 'mdi:weather-windy-variant',
  exceptional: 'mdi:weather-cloudy-alert',
};

function hourKey(dt: DateTime): string {
  return dt.startOf('hour').toISO({ suppressSeconds: true, suppressMilliseconds: true }) ?? '';
}

/**
 * Map each hourly forecast to its hour key, expressed in `zone`.
 *
 * Events are normalized in the HA timezone, so the forecast must be keyed in the
 * same zone — otherwise a browser whose timezone differs from the HA server keys
 * the same instant differently and no forecast ever matches an event.
 */
export function buildForecastMap(list: HourlyForecast[], zone = 'local'): Map<string, ForecastSlot> {
  const map = new Map<string, ForecastSlot>();
  for (const f of list) {
    map.set(hourKey(DateTime.fromISO(f.datetime, { zone })), {
      condition: f.condition,
      temperature: f.temperature,
    });
  }
  return map;
}

/** Forecast for a timed, upcoming, in-horizon event; otherwise null. */
export function forecastForEvent(event: WeekEvent, now: DateTime, map: Map<string, ForecastSlot>): ForecastSlot | null {
  if (event.allDay) return null;
  if (event.start < now) return null;
  return map.get(hourKey(event.start)) ?? null;
}

export function weatherIcon(condition: string): string {
  return ICONS[condition] ?? 'mdi:weather-cloudy';
}

const LABELS: Record<string, string> = {
  'clear-night': 'Clear',
  cloudy: 'Cloudy',
  fog: 'Fog',
  hail: 'Hail',
  lightning: 'Thunder',
  'lightning-rainy': 'Thunderstorms',
  partlycloudy: 'Partly cloudy',
  pouring: 'Heavy rain',
  rainy: 'Rain',
  snowy: 'Snow',
  'snowy-rainy': 'Sleet',
  sunny: 'Sunny',
  windy: 'Windy',
  'windy-variant': 'Windy',
  exceptional: 'Severe',
};

/** Human-readable name for a weather condition (used by the details popup). */
export function weatherLabel(condition: string): string {
  return LABELS[condition] ?? 'Weather';
}

export type WeatherSampleKind = 'clock' | 'eventday' | 'night' | 'nextday';

export interface WeatherSample {
  kind: WeatherSampleKind;
  time: DateTime;
  condition: string;
  temperature: number;
}

/**
 * Weather samples for the event-details popup, read from the hourly forecast.
 *
 * Timed events up to an hour resolve to a single sample at the start; longer ones
 * sample the start, midpoint, and end. All-day and multi-day events swap to a
 * near-term outlook anchored to the event's own day — event day, night, next day.
 * A future event samples its own day; one already in progress falls back to today,
 * since its start day's forecast is gone. Samples whose hour is missing — already
 * past, or beyond the forecast horizon — are dropped, so the result holds 0…3 entries.
 */
export function weatherSamplesForEvent(
  event: WeekEvent,
  now: DateTime,
  map: Map<string, ForecastSlot>,
): WeatherSample[] {
  const targets: { kind: WeatherSampleKind; time: DateTime }[] = [];
  if (event.allDay) {
    if (event.originalEnd <= now) return [];
    const anchor = DateTime.max(now.startOf('day'), event.originalStart.startOf('day'));
    const noon = anchor.plus({ hours: 12 });
    targets.push({ kind: 'eventday', time: now > noon ? now.startOf('hour') : noon });
    targets.push({ kind: 'night', time: anchor.plus({ hours: 21 }) });
    targets.push({ kind: 'nextday', time: anchor.plus({ days: 1, hours: 12 }) });
  } else {
    const { originalStart: start, originalEnd: end } = event;
    targets.push({ kind: 'clock', time: start });
    if (end.diff(start).as('minutes') > 60) {
      targets.push({ kind: 'clock', time: start.plus({ minutes: end.diff(start).as('minutes') / 2 }) });
      targets.push({ kind: 'clock', time: end });
    }
  }
  const samples: WeatherSample[] = [];
  for (const { kind, time } of targets) {
    const slot = map.get(hourKey(time));
    if (slot) samples.push({ kind, time, condition: slot.condition, temperature: slot.temperature });
  }
  return samples;
}
