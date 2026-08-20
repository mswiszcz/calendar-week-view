import { DateTime } from 'luxon';

/**
 * The dialog's editable event state, in the shapes its inputs produce: a single
 * ISO `date` for all-day events, and local wall-time `start`/`end`
 * (`YYYY-MM-DDTHH:mm`, from `datetime-local`) for timed ones. Kept free of any
 * Home Assistant types so the service payloads stay pure and unit-testable.
 */
export interface EventDraft {
  summary: string;
  entity: string;
  allDay: boolean;
  date: string;
  start: string;
  end: string;
  location: string;
  description: string;
}

/** Header schedule format: weekday, day, short month — e.g. `Sat 22 Aug`. */
const WHEN_FMT = 'ccc d LLL';

/** HA's all-day end is exclusive, so the stored end is the day after the last. */
function nextDay(date: string, zone: string): string {
  return DateTime.fromISO(date, { zone }).plus({ days: 1 }).toISODate() ?? date;
}

/** Parse a `datetime-local` wall-time string in the calendar's zone. */
function timed(local: string, zone: string): DateTime {
  return DateTime.fromISO(local, { zone });
}

/** Service data for `calendar.create_event`; the caller targets it with an entity. */
export function buildCreateData(d: EventDraft, zone: string): Record<string, string> {
  const data: Record<string, string> = { summary: d.summary.trim() };
  const location = d.location.trim();
  const description = d.description.trim();
  if (location) data.location = location;
  if (description) data.description = description;
  if (d.allDay) {
    data.start_date = d.date;
    data.end_date = nextDay(d.date, zone);
  } else {
    data.start_date_time = timed(d.start, zone).toISO() ?? '';
    data.end_date_time = timed(d.end, zone).toISO() ?? '';
  }
  return data;
}

/**
 * The `event` object for a `calendar/event/update` message. Base fields only —
 * the caller adds the envelope, `rrule`, and recurrence scope. `location` and
 * `description` are always present so emptying a prefilled field clears it.
 */
export function buildUpdateEvent(d: EventDraft, zone: string): Record<string, string> {
  const event: Record<string, string> = {
    summary: d.summary.trim(),
    location: d.location.trim(),
    description: d.description.trim(),
  };
  if (d.allDay) {
    event.dtstart = d.date;
    event.dtend = nextDay(d.date, zone);
  } else {
    event.dtstart = timed(d.start, zone).toISO() ?? '';
    event.dtend = timed(d.end, zone).toISO() ?? '';
  }
  return event;
}

/** The header's concrete schedule line — no countdown, no dependence on now. */
export function formatWhenLine(d: EventDraft, zone: string, timeFormat: string, locale?: string): string {
  const fmt = (x: DateTime, f: string): string => (locale ? x.setLocale(locale) : x).toFormat(f);
  if (d.allDay) {
    return `${fmt(DateTime.fromISO(d.date, { zone }), WHEN_FMT)} · All day`;
  }
  const start = timed(d.start, zone);
  const end = timed(d.end, zone);
  if (start.hasSame(end, 'day')) {
    return `${fmt(start, WHEN_FMT)} · ${fmt(start, timeFormat)} – ${fmt(end, timeFormat)}`;
  }
  return `${fmt(start, 'd LLL')} ${fmt(start, timeFormat)} → ${fmt(end, 'd LLL')} ${fmt(end, timeFormat)}`;
}

/** Null when the draft is saveable, else a user-facing reason it is not. */
export function draftError(d: EventDraft, zone: string): string | null {
  if (!d.summary.trim()) return 'Add a name';
  if (!d.allDay && timed(d.end, zone) <= timed(d.start, zone)) {
    return 'End must be after the start';
  }
  return null;
}
