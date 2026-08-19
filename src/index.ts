import { CalendarWeekViewCard } from '@/card';
import { CalendarWeekViewAddDialog } from '@/add-event-dialog';
import { CalendarWeekViewEditor } from '@/editor';

customElements.define('calendar-week-view', CalendarWeekViewCard);
customElements.define('calendar-week-view-add-dialog', CalendarWeekViewAddDialog);
customElements.define('calendar-week-view-editor', CalendarWeekViewEditor);
(window as unknown as { customCards: unknown[] }).customCards ??= [];
(window as unknown as { customCards: unknown[] }).customCards.push({
  type: 'calendar-week-view',
  name: 'Calendar Week View',
  description: 'Current-week calendar with quick add and hourly weather.',
});
console.info('%c CALENDAR-WEEK-VIEW %c v1.6.1 ', 'color:white;background:#0aa2e6', 'color:#0aa2e6;background:white');
