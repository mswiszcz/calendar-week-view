import { CalendarWeekViewCard } from '@/card';

customElements.define('calendar-week-view', CalendarWeekViewCard);
(window as unknown as { customCards: unknown[] }).customCards ??= [];
(window as unknown as { customCards: unknown[] }).customCards.push({
  type: 'calendar-week-view',
  name: 'Calendar Week View',
  description: 'Current-week calendar with quick add and hourly weather.',
});
console.info('%c CALENDAR-WEEK-VIEW %c v0.1.0 ', 'color:white;background:#0aa2e6', 'color:#0aa2e6;background:white');
