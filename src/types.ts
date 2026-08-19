import type { DateTime } from 'luxon';

export type WeekStart = 'monday' | 'sunday';

/** Agenda lists events per day; calendar spans them over an hour grid. */
export type ViewMode = 'agenda' | 'calendar';

/** Agenda layout axis: a horizontal day strip, or days stacked vertically. */
export type Orientation = 'horizontal' | 'vertical';

export interface CalendarConfig {
  entity: string;
  name?: string;
  color?: string;
  icon?: string;
  filter?: string;
  filterText?: string;
  hideInLegend?: boolean;
  initiallyHidden?: boolean;
}

export interface WeatherConfig {
  entity: string;
  showTemperature?: boolean;
  roundTemperature?: boolean;
}

/** Optional overrides for UI element colors; each maps to a base CSS token. */
export interface UiColors {
  accent?: string;
  today?: string;
  dayBackground?: string;
  cardBackground?: string;
  text?: string;
  secondaryText?: string;
}

export interface CardConfig {
  type: string;
  title?: string;
  calendars: CalendarConfig[];
  weekStartsOn?: WeekStart;
  viewMode?: ViewMode;
  orientation?: Orientation;
  startHour?: number;
  visibleDays?: number;
  hideWeekend?: boolean;
  lockToday?: boolean;
  height?: string;
  highlightToday?: boolean;
  showNavigation?: boolean;
  showLegend?: boolean;
  legendToggle?: boolean;
  addEvents?: boolean;
  addEventCalendars?: string[];
  weather?: WeatherConfig;
  colors?: UiColors;
  combineSimilarEvents?: boolean;
  updateInterval?: number;
  compact?: boolean;
  noCardBackground?: boolean;
  locale?: string;
  timeFormat?: string;
  dateFormat?: string;
  showClock?: boolean;
  showNextEvent?: boolean;
  clockFormat?: string;
  headerDateFormat?: string;
  texts?: Record<string, string>;
}

/** Raw event shape returned by HA REST `GET calendars/<entity>`. */
export interface CalendarEventInput {
  summary?: string;
  description?: string;
  location?: string;
  uid?: string;
  recurrence_id?: string;
  rrule?: string;
  start: { dateTime?: string; date?: string };
  end: { dateTime?: string; date?: string };
}

export interface WeekEvent {
  key: string;
  summary: string;
  description: string | null;
  location: string | null;
  uid: string | null;
  recurrenceId: string | null;
  rrule: string | null;
  recurring: boolean;
  start: DateTime;
  end: DateTime;
  originalStart: DateTime;
  originalEnd: DateTime;
  allDay: boolean;
  multiDay: boolean;
  continuesLeft: boolean;
  continuesRight: boolean;
  calendarEntity: string;
  color: string;
  calendarName: string;
}

/** Scope for mutating a recurring event, matching HA's native calendar dialog. */
export type RecurrenceScope = 'this' | 'future' | 'all';

export interface DayColumn {
  date: DateTime;
  isToday: boolean;
  isPast: boolean;
  allDayEvents: WeekEvent[];
  timedEvents: WeekEvent[];
}

/**
 * A timed event placed on the calendar-view hour grid. `startMin`/`endMin` are
 * minutes from the column's midnight; `col`/`cols` split the column width so
 * concurrent events sit side by side (`col` of `cols` lanes).
 */
export interface PositionedEvent {
  event: WeekEvent;
  startMin: number;
  endMin: number;
  col: number;
  cols: number;
}

export interface HourlyForecast {
  datetime: string;
  condition: string;
  temperature: number;
}
