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
