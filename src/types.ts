import type { DateTime } from 'luxon';

export type WeekStart = 'monday' | 'sunday';

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

export interface CardConfig {
  type: string;
  title?: string;
  calendars: CalendarConfig[];
  weekStartsOn?: WeekStart;
  visibleDays?: number;
  hideWeekend?: boolean;
  height?: string;
  showNavigation?: boolean;
  showLegend?: boolean;
  legendToggle?: boolean;
  addEvents?: boolean;
  addEventCalendars?: string[];
  weather?: WeatherConfig;
  combineSimilarEvents?: boolean;
  updateInterval?: number;
  compact?: boolean;
  noCardBackground?: boolean;
  locale?: string;
  timeFormat?: string;
  dateFormat?: string;
  texts?: Record<string, string>;
}

/** Raw event shape returned by HA REST `GET calendars/<entity>`. */
export interface CalendarEventInput {
  summary?: string;
  description?: string;
  location?: string;
  start: { dateTime?: string; date?: string };
  end: { dateTime?: string; date?: string };
}

export interface WeekEvent {
  key: string;
  summary: string;
  description: string | null;
  location: string | null;
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

export interface DayColumn {
  date: DateTime;
  isToday: boolean;
  isPast: boolean;
  allDayEvents: WeekEvent[];
  timedEvents: WeekEvent[];
}

export interface HourlyForecast {
  datetime: string;
  condition: string;
  temperature: number;
}
