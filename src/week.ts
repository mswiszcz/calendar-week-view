import { DateTime } from 'luxon';
import type {
  CalendarConfig,
  CalendarEventInput,
  DayColumn,
  EventStatus,
  PositionedEvent,
  StackedEvent,
  WeekEvent,
  WeekStart,
} from '@/types';

/** Minutes in a day — the calendar-view grid spans a full 0…MINUTES_PER_DAY. */
const MINUTES_PER_DAY = 24 * 60;

/** HA calendar entity feature bit flags (bitwise `supported_features`). */
export const CalendarFeature = { CREATE: 1, DELETE: 2, UPDATE: 4 } as const;

/** True when a calendar entity state exposes the given feature bit. */
export function supportsFeature(
  state: { attributes?: { supported_features?: number } } | undefined,
  bit: number,
): boolean {
  return !!state && (Number(state.attributes?.supported_features ?? 0) & bit) !== 0;
}

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

/**
 * Days for a multi-week carousel window: `weeks` consecutive weeks starting at
 * `firstWeekStart`, each contributing its first `dayCount` days. With `dayCount`
 * of 5 this yields a continuous weekday strip (weekends skipped between weeks).
 */
export function windowDays(firstWeekStart: DateTime, weeks: number, dayCount: number): DateTime[] {
  const days: DateTime[] = [];
  for (let w = 0; w < weeks; w++) {
    for (let d = 0; d < dayCount; d++) {
      days.push(firstWeekStart.plus({ days: w * 7 + d }).startOf('day'));
    }
  }
  return days;
}

/**
 * Days for the lock-to-today view: `count` (>= 1) consecutive days starting at
 * `today`, skipping Saturday and Sunday when `hideWeekend` — so a weekend-hidden
 * lock lands on the next weekday rather than a blank column.
 */
export function lockedDays(today: DateTime, count: number, hideWeekend: boolean): DateTime[] {
  const want = Math.max(1, Math.round(count));
  const days: DateTime[] = [];
  let d = today.startOf('day');
  while (days.length < want) {
    if (!hideWeekend || (d.weekday !== 6 && d.weekday !== 7)) days.push(d);
    d = d.plus({ days: 1 });
  }
  return days;
}

/**
 * First child index whose far edge clears `edge` (a scroll-space coordinate),
 * i.e. the first column still visible past the strip's leading edge. `starts`
 * and `sizes` are the children's main-axis offsets and lengths; falls back to 0
 * when `edge` lies past every child. Axis-agnostic (x or y).
 */
export function edgeIndex(starts: number[], sizes: number[], edge: number): number {
  for (let i = 0; i < starts.length; i++) {
    if (starts[i] + sizes[i] > edge + 1) return i;
  }
  return 0;
}

/** Last child index that still begins before `edge`; 0 when none do. Axis-agnostic. */
export function lastVisibleIndex(starts: number[], edge: number): number {
  let last = 0;
  for (let i = 0; i < starts.length; i++) {
    if (starts[i] < edge - 1) last = i;
    else break;
  }
  return last;
}

/** Clamp a scroll target to the strip's valid `[0, max]` range. */
export function clampScroll(target: number, max: number): number {
  return Math.max(0, Math.min(max, target));
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
    uid: input.uid ?? null,
    recurrenceId: input.recurrence_id ?? null,
    rrule: input.rrule ?? null,
    recurring: !!(input.recurrence_id || input.rrule),
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

function byStart(a: WeekEvent, b: WeekEvent): number {
  return a.originalStart.toMillis() - b.originalStart.toMillis();
}

/**
 * Minute offsets of a day-clamped event piece from its own midnight. Both ends
 * are measured from the start piece's midnight, so a piece clamped to the next
 * midnight (as `buildDayColumns` produces) ends at `MINUTES_PER_DAY`.
 */
function eventMinutes(event: WeekEvent): { startMin: number; endMin: number } {
  const dayStart = event.start.startOf('day');
  const startMin = Math.min(MINUTES_PER_DAY, Math.max(0, event.start.diff(dayStart).as('minutes')));
  const rawEnd = event.end.diff(dayStart).as('minutes');
  const endMin = Math.min(MINUTES_PER_DAY, Math.max(rawEnd, startMin + 1));
  return { startMin, endMin };
}

/**
 * Lay timed events onto the hour grid, splitting overlaps into side-by-side lanes.
 *
 * Events are grouped into clusters of transitively-overlapping pieces; within a
 * cluster each event takes the first lane whose previous event has ended, and
 * every event in the cluster reports the cluster's lane count so the column
 * width divides evenly. Non-overlapping events each get a full-width single lane.
 */
export function layoutDayEvents(events: WeekEvent[]): PositionedEvent[] {
  const placed: PositionedEvent[] = events
    .map((event) => ({ event, ...eventMinutes(event), col: 0, cols: 1 }))
    // `map` already returned a fresh array, so sorting it in place is safe.
    // oxlint-disable-next-line no-array-sort
    .sort((a, b) => a.startMin - b.startMin || a.endMin - b.endMin);

  let cluster: PositionedEvent[] = [];
  let laneEnds: number[] = [];
  let clusterEnd = -Infinity;
  const closeCluster = (): void => {
    const cols = laneEnds.length;
    for (const p of cluster) p.cols = cols;
    cluster = [];
    laneEnds = [];
    clusterEnd = -Infinity;
  };
  for (const p of placed) {
    if (p.startMin >= clusterEnd) closeCluster();
    let lane = laneEnds.findIndex((end) => p.startMin >= end);
    if (lane === -1) {
      lane = laneEnds.length;
      laneEnds.push(0);
    }
    laneEnds[lane] = p.endMin;
    p.col = lane;
    cluster.push(p);
    clusterEnd = Math.max(clusterEnd, p.endMin);
  }
  closeCluster();
  return placed;
}

/**
 * Lay timed events full width, stacked so none overlaps — the expanded calendar
 * layout. Events keep their real start time until one would overlap the previous
 * block, then cascade down. Each block is at least `minMinutes` tall so its text
 * stays readable; `durationMin` preserves the event's true length.
 */
export function stackDayEvents(events: WeekEvent[], minMinutes: number): StackedEvent[] {
  const sorted = events
    .map((event) => ({ event, ...eventMinutes(event) }))
    // `map` already returned a fresh array, so sorting it in place is safe.
    // oxlint-disable-next-line no-array-sort
    .sort((a, b) => a.startMin - b.startMin || a.endMin - b.endMin);

  let cursor = -Infinity;
  return sorted.map(({ event, startMin, endMin }) => {
    const durationMin = endMin - startMin;
    const heightMin = Math.max(minMinutes, durationMin);
    const topMin = Math.max(startMin, cursor);
    cursor = topMin + heightMin;
    return { event, topMin, heightMin, durationMin };
  });
}

/**
 * The next event to surface in the header, with the time until it starts.
 *
 * Prefers the nearest future timed event. All-day events are skipped, except a
 * single all-day event starting tomorrow is surfaced when no timed event remains
 * today — the "what's next" once the day is done.
 */
export function pickUpcoming(now: DateTime, events: WeekEvent[]): WeekEvent | null {
  const timedFuture = events.filter((e) => !e.allDay && !e.multiDay && e.originalStart > now);
  timedFuture.sort(byStart);
  const noMoreToday = !timedFuture.some((e) => e.originalStart.hasSame(now, 'day'));
  if (noMoreToday) {
    const tomorrow = now.plus({ days: 1 }).startOf('day');
    const tomorrowAllDay = events.filter((e) => (e.allDay || e.multiDay) && e.originalStart.hasSame(tomorrow, 'day'));
    tomorrowAllDay.sort(byStart);
    if (tomorrowAllDay[0]) return tomorrowAllDay[0];
  }
  return timedFuture[0] ?? null;
}

/** Compact "time until start" label, e.g. `in 30m`, `in 2h 15m`, `in 3d`, or `Tomorrow`. */
export function formatCountdown(now: DateTime, ev: WeekEvent): string {
  if (ev.allDay || ev.multiDay) {
    const days = Math.round(ev.originalStart.startOf('day').diff(now.startOf('day'), 'days').days);
    if (days <= 0) return 'Today';
    if (days === 1) return 'Tomorrow';
    return `in ${days}d`;
  }
  const totalMin = Math.round(ev.originalStart.diff(now).as('minutes'));
  if (totalMin < 1) return 'now';
  if (totalMin < 60) return `in ${totalMin}m`;
  if (totalMin < 1440) {
    const h = Math.floor(totalMin / 60);
    const m = totalMin % 60;
    return m ? `in ${h}h ${m}m` : `in ${h}h`;
  }
  return `in ${Math.floor(totalMin / 1440)}d`;
}

/** Compact minute span for a countdown hero: `45m`, `2h 15m`, `3h`, `2d` (min 1m). */
function compactMinutes(totalMin: number): string {
  const min = Math.max(1, Math.round(totalMin));
  if (min < 60) return `${min}m`;
  if (min < 1440) {
    const h = Math.floor(min / 60);
    const m = min % 60;
    return m ? `${h}h ${m}m` : `${h}h`;
  }
  return `${Math.round(min / 1440)}d`;
}

/** Human event length for the details popup: `45 min`, `1 hr`, `1 hr 30 min`. */
export function formatEventDuration(ev: WeekEvent): string {
  const min = Math.max(0, Math.round(ev.originalEnd.diff(ev.originalStart).as('minutes')));
  if (min < 60) return `${min} min`;
  const h = Math.floor(min / 60);
  const m = min % 60;
  return m ? `${h} hr ${m} min` : `${h} hr`;
}

/**
 * Live status of an event relative to `now` for the details popup's countdown
 * hero. Timed events count down to their start, show the time left while running
 * (with an elapsed `progress`), then read "Ended". All-day events resolve to a
 * day-relative headline (Today / Tomorrow / In 3d / Yesterday / 2d ago).
 */
export function eventStatus(now: DateTime, ev: WeekEvent): EventStatus {
  if (ev.allDay || ev.multiDay) {
    const startDay = ev.originalStart.startOf('day');
    const endDay = ev.originalEnd.startOf('day');
    const today = now.startOf('day');
    const detail = ev.allDay ? 'all-day event' : 'multi-day event';
    if (today >= startDay && today < endDay) {
      return { phase: 'now', headline: 'Today', detail, progress: null };
    }
    const days = Math.round(startDay.diff(today, 'days').days);
    if (days > 0) {
      return { phase: 'upcoming', headline: days === 1 ? 'Tomorrow' : `In ${days}d`, detail, progress: null };
    }
    const ago = Math.abs(days);
    return { phase: 'ended', headline: ago === 1 ? 'Yesterday' : `${ago}d ago`, detail, progress: null };
  }
  const { originalStart: start, originalEnd: end } = ev;
  if (now < start) {
    return {
      phase: 'upcoming',
      headline: compactMinutes(start.diff(now).as('minutes')),
      detail: 'until it starts',
      progress: null,
    };
  }
  if (now < end) {
    const total = end.diff(start).as('minutes');
    const progress = total > 0 ? Math.min(1, Math.max(0, now.diff(start).as('minutes') / total)) : 1;
    return {
      phase: 'now',
      headline: compactMinutes(end.diff(now).as('minutes')),
      detail: 'left · happening now',
      progress,
    };
  }
  return {
    phase: 'ended',
    headline: 'Ended',
    detail: `${compactMinutes(now.diff(end).as('minutes'))} ago`,
    progress: null,
  };
}

/** Where today sits relative to the visible day range: -1 before, 0 within, 1 after. */
export function todayRelation(today: DateTime, left: DateTime, right: DateTime): -1 | 0 | 1 {
  const t = today.startOf('day');
  if (t < left.startOf('day')) return -1;
  if (t > right.startOf('day')) return 1;
  return 0;
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
