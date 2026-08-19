import type { ActionConfig } from 'custom-card-helpers';
import type { DateTime } from 'luxon';

export type WeekStart = 'monday' | 'sunday';

/**
 * A user-defined button. `icon` is required; `name` labels it in the header and
 * is the tooltip on a floating button. `color` accents the glyph (and header
 * chip); `background` sets the button's fill (its hover shade is derived from it).
 * `tap_action` is a standard Home Assistant action (navigate, url, call-service,
 * more-info, toggle); a button without one renders but does nothing.
 */
export interface ButtonConfig {
  icon: string;
  name?: string;
  color?: string;
  background?: string;
  tap_action?: ActionConfig;
}

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
  todayBorder?: boolean;
  todayText?: boolean;
  showNavigation?: boolean;
  showLegend?: boolean;
  legendToggle?: boolean;
  addEvents?: boolean;
  weather?: WeatherConfig;
  colors?: UiColors;
  combineSimilarEvents?: boolean;
  updateInterval?: number;
  compact?: boolean;
  noCardBackground?: boolean;
  noDayBackground?: boolean;
  locale?: string;
  timeFormat?: string;
  /** Day-header templates: literal text plus `{luxonToken}` groups (e.g. `Day {d}`). */
  headerSuptext?: string;
  headerText?: string;
  /** Show the day-header suptext line (`headerSuptext`). */
  showHeaderSuptext?: boolean;
  /** Show the day-header main line (`headerText`). */
  showHeaderText?: boolean;
  showClock?: boolean;
  showNextEvent?: boolean;
  clockFormat?: string;
  headerDateFormat?: string;
  headerButtons?: ButtonConfig[];
  floatingButtons?: ButtonConfig[];
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

/**
 * Live status of an event relative to now, for the details popup's countdown hero.
 * `progress` is the elapsed fraction (0…1) while the event is happening, else null.
 */
export interface EventStatus {
  phase: 'upcoming' | 'now' | 'ended';
  headline: string;
  detail: string;
  progress: number | null;
}

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

/**
 * A timed event placed full width in the expanded calendar layout. `topMin` is
 * where the block starts (minutes from midnight, pushed down to clear the
 * previous block); `heightMin` is its rendered height; `durationMin` is the
 * event's true length (for single-line rendering of short events).
 */
export interface StackedEvent {
  event: WeekEvent;
  topMin: number;
  heightMin: number;
  durationMin: number;
}

export interface HourlyForecast {
  datetime: string;
  condition: string;
  temperature: number;
}
