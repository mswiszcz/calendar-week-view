import { CalendarWeekViewCard } from '@/card';
import { CalendarWeekViewAddDialog } from '@/add-event-dialog';
import { CalendarWeekViewEditor } from '@/editor';

/** Replaced at build time with the package.json version (see scripts/build.mjs). */
declare const __CWV_VERSION__: string;

customElements.define('calendar-week-view', CalendarWeekViewCard);
customElements.define('calendar-week-view-add-dialog', CalendarWeekViewAddDialog);
customElements.define('calendar-week-view-editor', CalendarWeekViewEditor);
(window as unknown as { customCards: unknown[] }).customCards ??= [];
(window as unknown as { customCards: unknown[] }).customCards.push({
  type: 'calendar-week-view',
  name: 'Calendar Week View',
  description: 'Current-week calendar with quick add and hourly weather.',
});
console.info(
  `%c CALENDAR-WEEK-VIEW %c v${__CWV_VERSION__} `,
  'color:white;background:#0aa2e6',
  'color:#0aa2e6;background:white',
);
