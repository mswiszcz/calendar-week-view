import { DateTime } from 'luxon';
import type { CalendarConfig, CalendarEventInput, DayColumn, WeekEvent, WeekStart } from '@/types';

/** Luxon weekday number for the configured week start (Mon=1 … Sun=7). */
export function weekStartWeekday(weekStartsOn: WeekStart): number {
  return weekStartsOn === 'sunday' ? 7 : 1;
}

/** Start-of-day DateTime for the first day of the shown week. */
export function computeWeekStart(now: DateTime, weekStartsOn: WeekStart, weekOffset: number): DateTime {
  const target = weekStartWeekday(weekStartsOn);
  let d = now.startOf('day');
  const back = (d.weekday - target + 7) % 7;
  d = d.minus({ days: back });
  return d.plus({ weeks: weekOffset });
}

export function dayCountFor(hideWeekend: boolean): number {
  return hideWeekend ? 5 : 7;
}

export function weekDays(weekStart: DateTime, dayCount: number): DateTime[] {
  return Array.from({ length: dayCount }, (_, i) => weekStart.plus({ days: i }).startOf('day'));
}

/** First visible column index so today stays on screen within a `visibleDays` window. */
export function autoScrollStartIndex(todayIndex: number, dayCount: number, visibleDays: number): number {
  if (todayIndex < 0) return 0;
  const max = Math.max(0, dayCount - visibleDays);
  return Math.min(Math.max(todayIndex, 0), max);
}

export function formatWeekLabel(weekStart: DateTime, dayCount: number): string {
  const end = weekStart.plus({ days: dayCount - 1 });
  if (weekStart.month === end.month) {
    return `${weekStart.day} – ${end.day} ${end.toFormat('LLL')}`;
  }
  return `${weekStart.toFormat('d LLL')} – ${end.toFormat('d LLL')}`;
}

/** All-day when both ends are date-only (or the span is whole-day aligned ≥24h). */
export function isAllDay(start: DateTime, end: DateTime): boolean {
  const startMidnight = start.hasSame(start.startOf('day'), 'millisecond');
  const endMidnight = end.hasSame(end.startOf('day'), 'millisecond');
  return startMidnight && endMidnight && end.diff(start, 'hours').hours >= 24;
}

function parseApiDate(part: { dateTime?: string; date?: string }, zone: string): { dt: DateTime; dateOnly: boolean } {
  if (part.date) return { dt: DateTime.fromISO(part.date, { zone }).startOf('day'), dateOnly: true };
  return { dt: DateTime.fromISO(part.dateTime ?? '', { zone }), dateOnly: false };
}

/**
 * Convert a raw HA calendar event into a normalized WeekEvent (pre-split).
 *
 * @param zone IANA timezone (the HA timezone) used to parse date-only and offset-less
 *   datetimes, so event days align with the day-column grid built in the same zone.
 */
export function normalizeEvent(
  input: CalendarEventInput,
  cal: CalendarConfig,
  combineSimilar: boolean,
  zone = 'local',
): WeekEvent {
  const start = parseApiDate(input.start, zone);
  const end = parseApiDate(input.end, zone);
  const summary = input.summary ?? '';
  const allDay = start.dateOnly && end.dateOnly ? true : isAllDay(start.dt, end.dt);
  const multiDay = end.dt.startOf('day') > start.dt.startOf('day').plus({ days: allDay ? 1 : 0 });
  const baseKey = `${start.dt.toISO()}|${end.dt.toISO()}|${summary}`;
  return {
    key: combineSimilar ? baseKey : `${baseKey}|${cal.entity}`,
    summary,
    description: input.description ?? null,
    location: input.location ?? null,
    start: start.dt,
    end: end.dt,
    originalStart: start.dt,
    originalEnd: end.dt,
    allDay,
    multiDay,
    continuesLeft: false,
    continuesRight: false,
    calendarEntity: cal.entity,
    color: cal.color ?? 'var(--primary-color)',
    calendarName: cal.name ?? cal.entity,
  };
}

/** Distribute events across the given days, computing continuation flags. */
export function buildDayColumns(args: { days: DateTime[]; now: DateTime; events: WeekEvent[] }): DayColumn[] {
  const today = args.now.startOf('day');
  return args.days.map((date) => {
    const dayStart = date.startOf('day');
    const dayEnd = dayStart.plus({ days: 1 });
    const allDayEvents: WeekEvent[] = [];
    const timedEvents: WeekEvent[] = [];
    for (const ev of args.events) {
      const covers = ev.originalStart < dayEnd && ev.originalEnd > dayStart;
      if (!covers) continue;
      const piece: WeekEvent = {
        ...ev,
        start: ev.originalStart > dayStart ? ev.originalStart : dayStart,
        end: ev.originalEnd < dayEnd ? ev.originalEnd : dayEnd,
        continuesLeft: ev.originalStart < dayStart,
        continuesRight: ev.originalEnd > dayEnd,
      };
      if (ev.allDay || ev.multiDay) allDayEvents.push(piece);
      else timedEvents.push(piece);
    }
    timedEvents.sort((a, b) => a.start.toMillis() - b.start.toMillis());
    return {
      date: dayStart,
      isToday: dayStart.hasSame(today, 'day'),
      isPast: dayStart < today,
      allDayEvents,
      timedEvents,
    };
  });
}
