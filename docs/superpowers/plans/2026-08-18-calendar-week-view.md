# calendar-week-view Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Build a new Home Assistant Lovelace card `custom:calendar-week-view` that renders the current week as a horizontal 3-up scroll strip of day-columns with a featured "today", per-event start–end times and hourly weather, and a floating quick-add button.

**Architecture:** Lit `LitElement` shell (`card.ts`) does `hass` I/O (REST fetch, weather subscription, `create_event`) and rendering; all date/week/weather logic lives in pure, `now`-injected modules (`week.ts`, `weather.ts`) that are unit-tested with vitest. Derivative work of `week-planner-card` (MIT © Rudy Gnodde) — the data-fetch approach is reused, the UI is new.

**Tech Stack:** TypeScript (ESM), Lit 3, Luxon 3, esbuild (single self-contained bundle), pnpm, oxlint + oxfmt, vitest. HA types via `custom-card-helpers` + `home-assistant-js-websocket`.

**Spec:** `docs/superpowers/specs/2026-08-18-calendar-week-view-design.md` (visual contract: `docs/superpowers/specs/assets/calendar-week-view-comp.html`, screenshots `comp-light.png` / `comp-dark.png`). Read the spec alongside this plan.

## Global Constraints

- **Runtime/output:** ESM only (`"type": "module"`). Single self-contained bundle `dist/calendar-week-view.js` (assets inlined; no external requests at runtime). Weather icons are `mdi:weather-*` via `ha-icon` — **no bundled image assets**.
- **Exact pinned versions** (no `^`/`~`): `lit@3.3.3`, `luxon@3.7.2`, `@types/luxon@3.7.4`, `typescript@7.0.2`, `esbuild@0.28.2`, `oxlint@1.79.0`, `oxfmt@0.64.0`, `vitest@4.1.11`, `custom-card-helpers@2.0.0`, `home-assistant-js-websocket@9.6.0`, `@types/node@26.2.0`.
- **pnpm supply-chain:** `pnpm config set minimumReleaseAge 1440` and `pnpm config set ignore-scripts true` before install.
- **Card type / element:** `custom:calendar-week-view`; custom element `calendar-week-view`; editor element `calendar-week-view-editor`.
- **License:** MIT. `LICENSE` retains the upstream copyright line (`Copyright (c) 2024 Rudy Gnodde`) plus the new author's line; README credits the origin.
- **Purity rule:** `week.ts` and `weather.ts` take `now: DateTime` as a parameter and import nothing from `lit`/DOM/`hass`. All Luxon math uses the HA timezone (passed in by the caller as an already-zoned `DateTime`).
- **Calendar create feature bit:** `CalendarEntityFeature.CREATE_EVENT = 1`; a calendar is writable when `state.attributes.supported_features & 1`.
- **Code limits (project standard):** ≤100 lines/function, ≤140-char lines, absolute imports only (no `../` — use the `@/` path alias configured in Task 1), Google-style docstrings on non-trivial public functions.

---

### Task 1: Project scaffold & tooling

**Files:**
- Create: `package.json`, `tsconfig.json`, `.oxlintrc.json`, `vitest.config.ts`, `scripts/build.mjs`, `hacs.json`, `LICENSE`, `README.md`, `.gitignore`, `src/index.ts` (stub), `test/smoke.test.ts`

**Interfaces:**
- Consumes: nothing.
- Produces: working `pnpm build` / `pnpm test` / `pnpm lint` / `pnpm typecheck`; `@/` path alias → `src/`.

- [ ] **Step 1: Configure pnpm supply-chain guards**

Run:
```bash
cd /Users/mswiszcz/Labs/calendar-week-view
pnpm config set minimumReleaseAge 1440
pnpm config set ignore-scripts true
```

- [ ] **Step 2: Create `package.json`**

```json
{
  "name": "calendar-week-view",
  "version": "0.1.0",
  "description": "Home Assistant Lovelace card: current-week calendar view with quick add and hourly weather.",
  "type": "module",
  "license": "MIT",
  "author": "Mateusz Świszcz",
  "scripts": {
    "build": "node scripts/build.mjs",
    "watch": "node scripts/build.mjs --watch",
    "typecheck": "tsc --noEmit",
    "lint": "oxlint src test",
    "format": "oxfmt src test",
    "test": "vitest run"
  },
  "dependencies": {
    "lit": "3.3.3",
    "luxon": "3.7.2"
  },
  "devDependencies": {
    "@types/luxon": "3.7.4",
    "@types/node": "26.2.0",
    "custom-card-helpers": "2.0.0",
    "esbuild": "0.28.2",
    "home-assistant-js-websocket": "9.6.0",
    "oxfmt": "0.64.0",
    "oxlint": "1.79.0",
    "typescript": "7.0.2",
    "vitest": "4.1.11"
  }
}
```

- [ ] **Step 3: Create `tsconfig.json`**

```json
{
  "compilerOptions": {
    "target": "ES2022",
    "module": "ESNext",
    "moduleResolution": "bundler",
    "lib": ["ES2022", "DOM", "DOM.Iterable"],
    "strict": true,
    "noUnusedLocals": true,
    "noUnusedParameters": true,
    "noImplicitReturns": true,
    "experimentalDecorators": true,
    "useDefineForClassFields": false,
    "baseUrl": ".",
    "paths": { "@/*": ["src/*"] },
    "types": ["node"],
    "skipLibCheck": true,
    "verbatimModuleSyntax": true
  },
  "include": ["src", "test"]
}
```

- [ ] **Step 4: Create `.oxlintrc.json`**

```json
{
  "$schema": "https://raw.githubusercontent.com/oxc-project/oxc/main/npm/oxlint/configuration_schema.json",
  "categories": { "correctness": "error", "suspicious": "warn" },
  "env": { "browser": true, "es2022": true }
}
```

- [ ] **Step 5: Create `vitest.config.ts`**

```ts
import { defineConfig } from 'vitest/config';
import { fileURLToPath } from 'node:url';

export default defineConfig({
  resolve: { alias: { '@': fileURLToPath(new URL('./src', import.meta.url)) } },
  test: { environment: 'node', include: ['test/**/*.test.ts'] },
});
```

- [ ] **Step 6: Create `scripts/build.mjs`**

```js
import { build, context } from 'esbuild';

const watch = process.argv.includes('--watch');
const options = {
  entryPoints: ['src/index.ts'],
  bundle: true,
  format: 'esm',
  target: 'es2022',
  outfile: 'dist/calendar-week-view.js',
  minify: !watch,
  sourcemap: watch,
  legalComments: 'none',
  loader: { '.svg': 'text' },
};

if (watch) {
  const ctx = await context(options);
  await ctx.watch();
  console.log('watching…');
} else {
  await build(options);
  console.log('built dist/calendar-week-view.js');
}
```

- [ ] **Step 7: Create `hacs.json`**

```json
{
  "name": "Calendar Week View",
  "content_in_root": false,
  "render_readme": true,
  "filename": "calendar-week-view.js",
  "homeassistant": "2024.4.0"
}
```

- [ ] **Step 8: Create `LICENSE`** (MIT, retaining upstream copyright)

```text
MIT License

Copyright (c) 2024 Rudy Gnodde (original week-planner-card)
Copyright (c) 2026 Mateusz Świszcz (calendar-week-view)

Permission is hereby granted, free of charge, to any person obtaining a copy
of this software and associated documentation files (the "Software"), to deal
in the Software without restriction, including without limitation the rights
to use, copy, modify, merge, publish, distribute, sublicense, and/or sell
copies of the Software, and to permit persons to whom the Software is
furnished to do so, subject to the following conditions:

The above copyright notice and this permission notice shall be included in all
copies or substantial portions of the Software.

THE SOFTWARE IS PROVIDED "AS IS", WITHOUT WARRANTY OF ANY KIND, EXPRESS OR
IMPLIED, INCLUDING BUT NOT LIMITED TO THE WARRANTIES OF MERCHANTABILITY,
FITNESS FOR A PARTICULAR PURPOSE AND NONINFRINGEMENT. IN NO EVENT SHALL THE
AUTHORS OR COPYRIGHT HOLDERS BE LIABLE FOR ANY CLAIM, DAMAGES OR OTHER
LIABILITY, WHETHER IN AN ACTION OF CONTRACT, TORT OR OTHERWISE, ARISING FROM,
OUT OF OR IN CONNECTION WITH THE SOFTWARE OR THE USE OR OTHER DEALINGS IN THE
SOFTWARE.
```

- [ ] **Step 9: Create `.gitignore`**

```text
node_modules/
dist/
*.log
.DS_Store
```

- [ ] **Step 10: Create `README.md`** (stub with attribution)

```markdown
# Calendar Week View

Home Assistant Lovelace card showing the current week as a horizontal strip of
day-columns with a highlighted today, per-event start–end times and hourly
weather, and a floating quick-add button.

Derived from [week-planner-card](https://github.com/FamousWolf/week-planner-card)
by Rudy Gnodde (MIT). Configuration and installation docs: TBD after v1.
```

- [ ] **Step 11: Create `src/index.ts` stub**

```ts
console.info('%c CALENDAR-WEEK-VIEW %c v0.1.0 ', 'color:white;background:#0aa2e6', 'color:#0aa2e6;background:white');
```

- [ ] **Step 12: Create `test/smoke.test.ts`**

```ts
import { expect, test } from 'vitest';

test('vitest runs', () => {
  expect(1 + 1).toBe(2);
});
```

- [ ] **Step 13: Install, then verify the toolchain**

Run:
```bash
pnpm install
pnpm test && pnpm typecheck && pnpm lint && pnpm build
```
Expected: test passes, typecheck clean, lint clean, `dist/calendar-week-view.js` written.

- [ ] **Step 14: Commit**

```bash
git add -A
git commit -m "chore: scaffold calendar-week-view project"
```

---

### Task 2: Types + pure week/day logic (`week.ts`)

**Files:**
- Create: `src/types.ts`, `src/week.ts`, `test/week.test.ts`

**Interfaces:**
- Consumes: Luxon `DateTime`.
- Produces (imported by later tasks):
  - Types in `src/types.ts`: `WeekStart`, `CalendarConfig`, `WeatherConfig`, `CardConfig`, `CalendarEventInput`, `WeekEvent`, `DayColumn`, `HourlyForecast`.
  - `computeWeekStart(now: DateTime, weekStartsOn: WeekStart, weekOffset: number): DateTime`
  - `weekDays(weekStart: DateTime, dayCount: number): DateTime[]`
  - `dayCountFor(hideWeekend: boolean): number` → 5 or 7
  - `autoScrollStartIndex(todayIndex: number, dayCount: number, visibleDays: number): number`
  - `isAllDay(start: DateTime, end: DateTime): boolean`
  - `normalizeEvent(input: CalendarEventInput, cal: CalendarConfig, combineSimilar: boolean): WeekEvent`
  - `buildDayColumns(args: { days: DateTime[]; now: DateTime; events: WeekEvent[] }): DayColumn[]`
  - `formatWeekLabel(weekStart: DateTime, dayCount: number): string`

- [ ] **Step 1: Create `src/types.ts`**

```ts
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
```

- [ ] **Step 2: Write failing tests for week boundaries + auto-scroll**

`test/week.test.ts`:
```ts
import { DateTime } from 'luxon';
import { describe, expect, test } from 'vitest';
import {
  autoScrollStartIndex,
  computeWeekStart,
  dayCountFor,
  formatWeekLabel,
  weekDays,
} from '@/week';

const now = DateTime.fromISO('2026-08-19T10:00:00', { zone: 'utc' }); // Wed

describe('computeWeekStart', () => {
  test('when monday start returns Monday', () => {
    expect(computeWeekStart(now, 'monday', 0).toISODate()).toBe('2026-08-17');
  });
  test('when sunday start returns Sunday', () => {
    expect(computeWeekStart(now, 'sunday', 0).toISODate()).toBe('2026-08-16');
  });
  test('with positive offset moves forward a week', () => {
    expect(computeWeekStart(now, 'monday', 1).toISODate()).toBe('2026-08-24');
  });
  test('with negative offset moves back a week', () => {
    expect(computeWeekStart(now, 'monday', -1).toISODate()).toBe('2026-08-10');
  });
});

describe('weekDays / dayCountFor', () => {
  test('with weekend gives 7 days', () => {
    const days = weekDays(computeWeekStart(now, 'monday', 0), dayCountFor(false));
    expect(days).toHaveLength(7);
    expect(days[0].toISODate()).toBe('2026-08-17');
    expect(days[6].toISODate()).toBe('2026-08-23');
  });
  test('without weekend gives 5 days', () => {
    expect(dayCountFor(true)).toBe(5);
    expect(weekDays(computeWeekStart(now, 'monday', 0), 5)).toHaveLength(5);
  });
});

describe('autoScrollStartIndex', () => {
  test('when today mid-week starts at today', () => {
    expect(autoScrollStartIndex(2, 7, 3)).toBe(2); // Wed
  });
  test('when today is last day shifts back by visible-1', () => {
    expect(autoScrollStartIndex(6, 7, 3)).toBe(4); // Sun → show Fri..Sun
  });
  test('when today almost last shifts by one', () => {
    expect(autoScrollStartIndex(5, 7, 3)).toBe(4); // Sat → show Fri..Sun
  });
  test('when today not in week returns 0', () => {
    expect(autoScrollStartIndex(-1, 7, 3)).toBe(0);
  });
});

describe('formatWeekLabel', () => {
  test('renders a compact range', () => {
    const label = formatWeekLabel(DateTime.fromISO('2026-08-17'), 7);
    expect(label).toContain('17');
    expect(label).toContain('23');
  });
});
```

- [ ] **Step 3: Run tests to verify they fail**

Run: `pnpm test`
Expected: FAIL — `@/week` has no such exports.

- [ ] **Step 4: Implement `src/week.ts` (boundaries + scroll + label)**

```ts
import { DateTime } from 'luxon';
import type { WeekStart } from '@/types';

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
```

- [ ] **Step 5: Run tests to verify they pass**

Run: `pnpm test`
Expected: PASS for the boundary/scroll/label tests.

- [ ] **Step 6: Write failing tests for event normalization + all-day**

Append to `test/week.test.ts`:
```ts
import { buildDayColumns, isAllDay, normalizeEvent } from '@/week';
import type { CalendarConfig, CalendarEventInput } from '@/types';

const cal: CalendarConfig = { entity: 'calendar.personal', name: 'Personal', color: '#3b82f6' };

describe('isAllDay', () => {
  test('true for date-only span', () => {
    const s = DateTime.fromISO('2026-08-19');
    expect(isAllDay(s, s.plus({ days: 1 }))).toBe(true);
  });
  test('false for a timed 1h event', () => {
    const s = DateTime.fromISO('2026-08-19T09:00');
    expect(isAllDay(s, s.plus({ hours: 1 }))).toBe(false);
  });
});

describe('normalizeEvent', () => {
  test('maps a timed event', () => {
    const input: CalendarEventInput = {
      summary: 'Gym',
      start: { dateTime: '2026-08-19T08:30:00' },
      end: { dateTime: '2026-08-19T09:15:00' },
    };
    const ev = normalizeEvent(input, cal, false);
    expect(ev.summary).toBe('Gym');
    expect(ev.allDay).toBe(false);
    expect(ev.color).toBe('#3b82f6');
    expect(ev.calendarEntity).toBe('calendar.personal');
  });
  test('maps an all-day event', () => {
    const input: CalendarEventInput = {
      summary: 'Trash day',
      start: { date: '2026-08-17' },
      end: { date: '2026-08-18' },
    };
    expect(normalizeEvent(input, cal, false).allDay).toBe(true);
  });
});

describe('buildDayColumns', () => {
  const days = weekDays(DateTime.fromISO('2026-08-17'), 7);
  const nowRef = DateTime.fromISO('2026-08-19T10:00');

  test('splits a multi-day event across covered days with chevrons', () => {
    const vacation = normalizeEvent(
      { summary: 'Vacation', start: { date: '2026-08-18' }, end: { date: '2026-08-21' } },
      { entity: 'calendar.family', color: '#f59e0b' },
      false,
    );
    const cols = buildDayColumns({ days, now: nowRef, events: [vacation] });
    // Tue(18) start, Wed(19) middle, Thu(20) end (end date 21 is exclusive)
    expect(cols[1].allDayEvents).toHaveLength(1);
    expect(cols[1].allDayEvents[0].continuesLeft).toBe(false);
    expect(cols[1].allDayEvents[0].continuesRight).toBe(true);
    expect(cols[2].allDayEvents[0].continuesLeft).toBe(true);
    expect(cols[2].allDayEvents[0].continuesRight).toBe(true);
    expect(cols[3].allDayEvents[0].continuesLeft).toBe(true);
    expect(cols[3].allDayEvents[0].continuesRight).toBe(false);
    expect(cols[4].allDayEvents).toHaveLength(0);
  });

  test('marks today and past days and sorts timed events', () => {
    const late = normalizeEvent(
      { summary: 'Late', start: { dateTime: '2026-08-19T15:00' }, end: { dateTime: '2026-08-19T16:00' } },
      cal, false,
    );
    const early = normalizeEvent(
      { summary: 'Early', start: { dateTime: '2026-08-19T08:00' }, end: { dateTime: '2026-08-19T09:00' } },
      cal, false,
    );
    const cols = buildDayColumns({ days, now: nowRef, events: [late, early] });
    expect(cols[0].isPast).toBe(true);       // Mon
    expect(cols[2].isToday).toBe(true);       // Wed
    expect(cols[2].timedEvents.map((e) => e.summary)).toEqual(['Early', 'Late']);
  });
});
```

- [ ] **Step 7: Run tests to verify they fail**

Run: `pnpm test`
Expected: FAIL — `isAllDay`/`normalizeEvent`/`buildDayColumns` not exported.

- [ ] **Step 8: Implement normalization + day-column building in `src/week.ts`**

Append:
```ts
import type { CalendarConfig, CalendarEventInput, DayColumn, WeekEvent } from '@/types';

/** All-day when both ends are date-only (or the span is whole-day aligned ≥24h). */
export function isAllDay(start: DateTime, end: DateTime): boolean {
  const startMidnight = start.hasSame(start.startOf('day'), 'millisecond');
  const endMidnight = end.hasSame(end.startOf('day'), 'millisecond');
  return startMidnight && endMidnight && end.diff(start, 'hours').hours >= 24;
}

function parseApiDate(part: { dateTime?: string; date?: string }): { dt: DateTime; dateOnly: boolean } {
  if (part.date) return { dt: DateTime.fromISO(part.date).startOf('day'), dateOnly: true };
  return { dt: DateTime.fromISO(part.dateTime ?? ''), dateOnly: false };
}

/** Convert a raw HA calendar event into a normalized WeekEvent (pre-split). */
export function normalizeEvent(input: CalendarEventInput, cal: CalendarConfig, combineSimilar: boolean): WeekEvent {
  const start = parseApiDate(input.start);
  const end = parseApiDate(input.end);
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
```

- [ ] **Step 9: Run tests to verify they pass; lint + typecheck**

Run: `pnpm test && pnpm typecheck && pnpm lint`
Expected: all PASS/clean.

- [ ] **Step 10: Commit**

```bash
git add src/types.ts src/week.ts test/week.test.ts
git commit -m "feat: pure week/day logic with tests"
```

---

### Task 3: Pure hourly-weather logic (`weather.ts`)

**Files:**
- Create: `src/weather.ts`, `test/weather.test.ts`

**Interfaces:**
- Consumes: `HourlyForecast`, `WeekEvent` from `@/types`; Luxon `DateTime`.
- Produces:
  - `buildForecastMap(list: HourlyForecast[]): Map<string, { condition: string; temperature: number }>` (key = `datetime` truncated to the hour, ISO).
  - `forecastForEvent(event: WeekEvent, now: DateTime, map: Map<...>): { condition: string; temperature: number } | null`
  - `weatherIcon(condition: string): string` (returns an `mdi:weather-*` name).

- [ ] **Step 1: Write failing tests**

`test/weather.test.ts`:
```ts
import { DateTime } from 'luxon';
import { describe, expect, test } from 'vitest';
import type { HourlyForecast, WeekEvent } from '@/types';
import { buildForecastMap, forecastForEvent, weatherIcon } from '@/weather';

const now = DateTime.fromISO('2026-08-19T10:00');
function ev(startISO: string, allDay = false): WeekEvent {
  const s = DateTime.fromISO(startISO);
  return {
    key: 'k', summary: 's', description: null, location: null,
    start: s, end: s.plus({ hours: 1 }), originalStart: s, originalEnd: s.plus({ hours: 1 }),
    allDay, multiDay: false, continuesLeft: false, continuesRight: false,
    calendarEntity: 'calendar.x', color: '#000', calendarName: 'X',
  };
}
const forecasts: HourlyForecast[] = [
  { datetime: '2026-08-19T12:00:00', condition: 'sunny', temperature: 24 },
  { datetime: '2026-08-19T15:00:00', condition: 'rainy', temperature: 18 },
];

describe('forecastForEvent', () => {
  const map = buildForecastMap(forecasts);
  test('returns forecast at the event start hour', () => {
    expect(forecastForEvent(ev('2026-08-19T12:00'), now, map)?.temperature).toBe(24);
  });
  test('returns null for a past event', () => {
    expect(forecastForEvent(ev('2026-08-19T08:00'), now, map)).toBeNull();
  });
  test('returns null for an all-day event', () => {
    expect(forecastForEvent(ev('2026-08-19T12:00', true), now, map)).toBeNull();
  });
  test('returns null beyond the forecast horizon', () => {
    expect(forecastForEvent(ev('2026-08-25T12:00'), now, map)).toBeNull();
  });
});

describe('weatherIcon', () => {
  test('maps known conditions', () => {
    expect(weatherIcon('sunny')).toBe('mdi:weather-sunny');
    expect(weatherIcon('partlycloudy')).toBe('mdi:weather-partly-cloudy');
  });
  test('falls back for unknown', () => {
    expect(weatherIcon('nonsense')).toBe('mdi:weather-cloudy');
  });
});
```

- [ ] **Step 2: Run tests to verify they fail**

Run: `pnpm test weather`
Expected: FAIL — `@/weather` missing.

- [ ] **Step 3: Implement `src/weather.ts`**

```ts
import type { DateTime } from 'luxon';
import { DateTime as LuxonDateTime } from 'luxon';
import type { HourlyForecast, WeekEvent } from '@/types';

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

/** Map each hourly forecast to its hour key. */
export function buildForecastMap(list: HourlyForecast[]): Map<string, { condition: string; temperature: number }> {
  const map = new Map<string, { condition: string; temperature: number }>();
  for (const f of list) {
    map.set(hourKey(LuxonDateTime.fromISO(f.datetime)), { condition: f.condition, temperature: f.temperature });
  }
  return map;
}

/** Forecast for a timed, upcoming, in-horizon event; otherwise null. */
export function forecastForEvent(
  event: WeekEvent,
  now: DateTime,
  map: Map<string, { condition: string; temperature: number }>,
): { condition: string; temperature: number } | null {
  if (event.allDay) return null;
  if (event.start < now) return null;
  return map.get(hourKey(event.start)) ?? null;
}

export function weatherIcon(condition: string): string {
  return ICONS[condition] ?? 'mdi:weather-cloudy';
}
```

- [ ] **Step 4: Run tests; typecheck; lint**

Run: `pnpm test && pnpm typecheck && pnpm lint`
Expected: PASS/clean.

- [ ] **Step 5: Commit**

```bash
git add src/weather.ts test/weather.test.ts
git commit -m "feat: pure hourly-weather mapping with tests"
```

---

### Task 4: Card shell — config, data fetch, weather subscription

**Files:**
- Create: `src/card.ts`
- Modify: `src/index.ts` (register element + `customCards`)

**Interfaces:**
- Consumes: everything from `@/week`, `@/weather`, `@/types`; `HomeAssistant` from `custom-card-helpers`.
- Produces (used by Task 5 render + Task 6 dialog):
  - Class `CalendarWeekViewCard extends LitElement` with reactive state: `_config: CardConfig`, `_columns: DayColumn[]`, `_weekOffset: number`, `_hiddenCalendars: Set<string>`, `_forecast: Map<...>`, `_error: string`, `_detailsEvent: WeekEvent | null`.
  - Methods: `setConfig(config)`, `set hass(hass)`, `getCardSize()`, `_fetchAndBuild()`, `_writableCalendars(): CalendarConfig[]`.

- [ ] **Step 1: Implement `src/card.ts` shell (config + fetch + build)**

```ts
import { LitElement, html } from 'lit';
import { property, state } from 'lit/decorators.js';
import { DateTime } from 'luxon';
import type { HomeAssistant } from 'custom-card-helpers';
import type { CalendarConfig, CardConfig, CalendarEventInput, DayColumn, WeekEvent } from '@/types';
import { buildDayColumns, computeWeekStart, dayCountFor, normalizeEvent, weekDays } from '@/week';
import { buildForecastMap } from '@/weather';
import { styles } from '@/card.styles';

const CREATE_EVENT = 1;

export class CalendarWeekViewCard extends LitElement {
  static styles = styles;

  @property({ attribute: false }) hass!: HomeAssistant;
  @state() private _config!: CardConfig;
  @state() private _columns: DayColumn[] = [];
  @state() private _weekOffset = 0;
  @state() private _hiddenCalendars = new Set<string>();
  @state() private _forecast = new Map<string, { condition: string; temperature: number }>();
  @state() private _error = '';
  @state() private _detailsEvent: WeekEvent | null = null;

  private _loading = false;
  private _timer?: number;
  private _weatherUnsub?: () => void;

  static getStubConfig(): Partial<CardConfig> {
    return { type: 'custom:calendar-week-view', calendars: [], weekStartsOn: 'monday', visibleDays: 3 };
  }

  static getConfigElement(): HTMLElement {
    return document.createElement('calendar-week-view-editor');
  }

  setConfig(config: CardConfig): void {
    if (!config.calendars || config.calendars.length === 0) {
      throw new Error('calendar-week-view: at least one calendar is required');
    }
    this._config = { weekStartsOn: 'monday', visibleDays: 3, updateInterval: 60, ...config };
    this._hiddenCalendars = new Set(
      (config.calendars ?? []).filter((c) => c.initiallyHidden).map((c) => c.entity),
    );
  }

  getCardSize(): number {
    return 8;
  }

  set hass(hass: HomeAssistant) {
    const first = !this.hass;
    (this as { _hass?: HomeAssistant })._hass = hass;
    if (first && this._config) void this._fetchAndBuild();
  }

  get hass(): HomeAssistant {
    return (this as { _hass?: HomeAssistant })._hass as HomeAssistant;
  }

  connectedCallback(): void {
    super.connectedCallback();
    if (this._config && this.hass) void this._fetchAndBuild();
  }

  disconnectedCallback(): void {
    super.disconnectedCallback();
    if (this._timer) window.clearTimeout(this._timer);
    this._weatherUnsub?.();
  }

  private _now(): DateTime {
    return DateTime.now().setZone(this.hass?.config?.time_zone ?? 'local');
  }

  /** Fetch events for the shown week, normalize, split into day columns. */
  private async _fetchAndBuild(): Promise<void> {
    if (!this.hass || !this._config || this._loading) return;
    this._loading = true;
    try {
      const cfg = this._config;
      const start = computeWeekStart(this._now(), cfg.weekStartsOn ?? 'monday', this._weekOffset);
      const count = dayCountFor(cfg.hideWeekend ?? false);
      const end = start.plus({ days: count });
      const days = weekDays(start, count);
      const events: WeekEvent[] = [];
      const errors: string[] = [];
      await Promise.all(
        cfg.calendars.map(async (cal) => {
          if (this._hiddenCalendars.has(cal.entity)) return;
          try {
            const url =
              `calendars/${cal.entity}?start=${encodeURIComponent(start.toISO() ?? '')}` +
              `&end=${encodeURIComponent(end.toISO() ?? '')}`;
            const raw = (await this.hass.callApi('GET', url)) as CalendarEventInput[];
            for (const item of raw) {
              const filter = cal.filter ? new RegExp(cal.filter) : null;
              if (filter && filter.test(item.summary ?? '')) continue;
              events.push(normalizeEvent(item, cal, cfg.combineSimilarEvents ?? false));
            }
          } catch (e) {
            errors.push(`${cal.name ?? cal.entity}: ${(e as Error).message}`);
          }
        }),
      );
      this._error = errors.join('\n');
      this._columns = buildDayColumns({ days, now: this._now(), events });
      if (cfg.weather) this._subscribeWeather();
    } finally {
      this._loading = false;
      this._scheduleRefresh();
    }
  }

  private _scheduleRefresh(): void {
    if (this._timer) window.clearTimeout(this._timer);
    const seconds = this._config.updateInterval ?? 60;
    this._timer = window.setTimeout(() => void this._fetchAndBuild(), seconds * 1000);
  }

  private _subscribeWeather(): void {
    if (this._weatherUnsub || !this._config.weather) return;
    this._weatherUnsub = this.hass.connection.subscribeMessage<{ forecast: { datetime: string; condition: string; temperature: number }[] }>(
      (msg) => {
        this._forecast = buildForecastMap(msg.forecast ?? []);
      },
      { type: 'weather/subscribe_forecast', forecast_type: 'hourly', entity_id: this._config.weather.entity },
    ) as unknown as () => void;
  }

  /** Configured calendars that support event creation, honoring the allowlist. */
  private _writableCalendars(): CalendarConfig[] {
    const allow = this._config.addEventCalendars;
    return this._config.calendars.filter((c) => {
      const st = this.hass.states[c.entity];
      const writable = st && (Number(st.attributes.supported_features ?? 0) & CREATE_EVENT) !== 0;
      return writable && (!allow || allow.includes(c.entity));
    });
  }

  render() {
    return html`<ha-card>calendar-week-view</ha-card>`; // replaced in Task 5
  }
}
```

- [ ] **Step 2: Create a temporary `src/card.styles.ts` so it compiles**

```ts
import { css } from 'lit';
export const styles = css``; // replaced in Task 5
```

- [ ] **Step 3: Update `src/index.ts` to register the element**

```ts
import { CalendarWeekViewCard } from '@/card';

customElements.define('calendar-week-view', CalendarWeekViewCard);
(window as unknown as { customCards: unknown[] }).customCards ??= [];
(window as unknown as { customCards: unknown[] }).customCards.push({
  type: 'calendar-week-view',
  name: 'Calendar Week View',
  description: 'Current-week calendar with quick add and hourly weather.',
});
console.info('%c CALENDAR-WEEK-VIEW %c v0.1.0 ', 'color:white;background:#0aa2e6', 'color:#0aa2e6;background:white');
```

- [ ] **Step 4: Typecheck, lint, build**

Run: `pnpm typecheck && pnpm lint && pnpm build`
Expected: clean; `dist/calendar-week-view.js` written.

- [ ] **Step 5: Commit**

```bash
git add src/card.ts src/card.styles.ts src/index.ts
git commit -m "feat: card shell — config, fetch, weather subscription"
```

---

### Task 5: Card rendering + styles (the visual contract)

**Files:**
- Modify: `src/card.ts` (replace `render()` and add private render helpers)
- Replace: `src/card.styles.ts` (port the comp's CSS)

**Interfaces:**
- Consumes: `_columns`, `_config`, `_forecast`, `_hiddenCalendars`, `_weekOffset`, `forecastForEvent`, `weatherIcon`, `formatWeekLabel`, `autoScrollStartIndex`.
- Produces: rendered card matching `docs/superpowers/specs/assets/calendar-week-view-comp.html`.

- [ ] **Step 1: Port the comp CSS into `src/card.styles.ts`**

Open `docs/superpowers/specs/assets/calendar-week-view-comp.html`. Copy the contents of its `<style>` block into a Lit `css` tagged template exported as `styles`, with these adaptations:
- **Drop** the preview-harness rules: `.toolbar`, `.stage`, and the `body`/page-background rules.
- Change the token selectors: `:root` → `:host`; `html[data-theme="dark"]` → both `:host([data-theme="dark"])` and an added `@media (prefers-color-scheme: dark) { :host(:not([data-theme="light"])) { … } }` with the same dark token values (so the card follows the HA theme).
- Keep all component rules from `.ha-card` downward verbatim (`.cwv`, `.topbar`, `.nav`, `.legend`, `.week`, `.day`, `.day.today`, `.day-head`, `.allday`, `.pill`, `.events`, `.ev`, `.wx`, `.empty`, `.fab`, `.rbtn`, `.today-reset`, `.range`).
- Add the height token wiring: replace the fixed `height:416px` / `height:456px` with `height: var(--cwv-day-h, 416px)` and today `calc(var(--cwv-day-h, 416px) + 40px)`; the host sets `--cwv-day-h` from `config.height`.

Keep the weather `<symbol>` sprite: move it into the render output (Step 4) as an inline `<svg>` in the template, OR replace weather icons with `<ha-icon icon="${weatherIcon(cond)}">` (preferred — native, themable). **Use `ha-icon`**; delete the sprite.

- [ ] **Step 2: Replace `render()` in `src/card.ts`**

```ts
import { classMap } from 'lit/directives/class-map.js';
import { forecastForEvent, weatherIcon } from '@/weather';
import { autoScrollStartIndex, formatWeekLabel } from '@/week';

// inside the class:
render() {
  if (!this._config) return html``;
  const cfg = this._config;
  const hostStyle = cfg.height ? `--cwv-day-h:${cfg.height}` : '';
  return html`
    <ha-card class=${classMap({ nobackground: !!cfg.noCardBackground, compact: !!cfg.compact })} style=${hostStyle}>
      <div class="cwv">
        ${this._error ? html`<ha-alert alert-type="error">${this._error}</ha-alert>` : ''}
        <div class="topbar">${this._renderNav()} ${this._renderLegend()}</div>
        <div class="week" @scroll=${() => undefined}>
          ${this._columns.map((col) => this._renderDay(col))}
        </div>
      </div>
      ${cfg.addEvents && this._writableCalendars().length > 0
        ? html`<button class="fab" aria-label="Add event" @click=${this._openAdd}>
            <ha-icon icon="mdi:plus"></ha-icon>
          </button>`
        : ''}
      ${this._renderDetails()}
    </ha-card>
  `;
}

private _renderNav() {
  if (this._config.showNavigation === false) return html``;
  const start = computeWeekStart(this._now(), this._config.weekStartsOn ?? 'monday', this._weekOffset);
  const count = dayCountFor(this._config.hideWeekend ?? false);
  return html`
    <div class="nav">
      <button class="rbtn" aria-label="Previous week" @click=${() => this._shiftWeek(-1)}>
        <ha-icon icon="mdi:chevron-left"></ha-icon>
      </button>
      <div class="range">${formatWeekLabel(start, count)}<small>${start.toFormat('yyyy')}</small></div>
      <button class="rbtn" aria-label="Next week" @click=${() => this._shiftWeek(1)}>
        <ha-icon icon="mdi:chevron-right"></ha-icon>
      </button>
      ${this._weekOffset !== 0
        ? html`<button class="today-reset" @click=${() => this._shiftWeek(0)}>This week</button>`
        : ''}
    </div>
  `;
}

private _renderLegend() {
  const cfg = this._config;
  if (cfg.showLegend === false) return html``;
  return html`
    <div class="legend">
      ${cfg.calendars
        .filter((c) => !c.hideInLegend)
        .map(
          (c) => html`
            <span
              class=${classMap({ cal: true, off: this._hiddenCalendars.has(c.entity) })}
              style="--c:${c.color ?? 'var(--primary-color)'}"
              @click=${() => this._toggleCalendar(c.entity)}
            >${c.name ?? c.entity}</span>
          `,
        )}
    </div>
  `;
}

private _renderDay(col: DayColumn) {
  return html`
    <div class=${classMap({ day: true, today: col.isToday, past: col.isPast })}>
      <div class="day-head">
        <div class="dstack">
          <span class="dow">${col.date.toFormat('ccc')}</span>
          <span class="dnum">${col.date.day}</span>
        </div>
      </div>
      ${col.allDayEvents.length
        ? html`<div class="allday">${col.allDayEvents.map((e) => this._renderPill(e))}</div>`
        : ''}
      <div class="events">
        ${col.timedEvents.length
          ? col.timedEvents.map((e) => this._renderEvent(e))
          : html`<div class="empty">${this._config.texts?.noEvents ?? 'Nothing planned'}</div>`}
      </div>
    </div>
  `;
}

private _renderPill(e: WeekEvent) {
  return html`
    <div
      class=${classMap({ pill: true, contL: e.continuesLeft, contR: e.continuesRight })}
      style="--c:${e.color}"
      @click=${() => (this._detailsEvent = e)}
    >
      ${e.continuesLeft ? html`<span class="chev">‹</span>` : ''}
      <span class="txt">${e.summary}</span>
      ${e.continuesRight ? html`<span class="chev">›</span>` : ''}
    </div>
  `;
}

private _renderEvent(e: WeekEvent) {
  const fmt = this._config.timeFormat ?? 'HH:mm';
  const wx = this._config.weather ? forecastForEvent(e, this._now(), this._forecast) : null;
  const round = this._config.weather?.roundTemperature ?? true;
  return html`
    <div class="ev" style="--c:${e.color}" @click=${() => (this._detailsEvent = e)}>
      <span class="time">
        ${e.start.toFormat(fmt)} – ${e.end.toFormat(fmt)}
        ${wx
          ? html`<span class="wx">
              <ha-icon icon=${weatherIcon(wx.condition)}></ha-icon>
              ${this._config.weather?.showTemperature === false
                ? ''
                : html`${round ? Math.round(wx.temperature) : wx.temperature}°`}
            </span>`
          : ''}
      </span>
      <span class="title">${e.summary}</span>
    </div>
  `;
}
```

- [ ] **Step 3: Add nav/legend/scroll behavior methods to `src/card.ts`**

```ts
private _shiftWeek(offset: number): void {
  this._weekOffset = offset === 0 ? 0 : this._weekOffset + offset;
  this._weatherUnsub?.();
  this._weatherUnsub = undefined;
  void this._fetchAndBuild();
}

private _toggleCalendar(entity: string): void {
  if (this._config.legendToggle === false) return;
  const next = new Set(this._hiddenCalendars);
  next.has(entity) ? next.delete(entity) : next.add(entity);
  this._hiddenCalendars = next;
  void this._fetchAndBuild();
}

/** After each render, scroll the week strip so today leads the visible window. */
protected updated(): void {
  const strip = this.renderRoot.querySelector<HTMLElement>('.week');
  if (!strip) return;
  const todayIndex = this._columns.findIndex((c) => c.isToday);
  const dayCount = this._columns.length;
  const visible = this._config.visibleDays ?? 3;
  const startIndex = this._weekOffset === 0 ? autoScrollStartIndex(todayIndex, dayCount, visible) : 0;
  const target = strip.children[startIndex] as HTMLElement | undefined;
  if (target) strip.scrollLeft = target.offsetLeft - strip.offsetLeft;
}
```

- [ ] **Step 4: Add a minimal event-details dialog + add-open stub**

```ts
private _openAdd(): void {
  this.dispatchEvent(new CustomEvent('cwv-open-add', { bubbles: true, composed: true }));
  // wired to the dialog in Task 6
}

private _renderDetails() {
  const e = this._detailsEvent;
  if (!e) return html``;
  return html`
    <ha-dialog open @closed=${() => (this._detailsEvent = null)} .heading=${e.summary}>
      <div class="details">
        <div>${e.calendarName}</div>
        <div>
          ${e.allDay ? e.start.toFormat('cccc d LLLL') : `${e.start.toFormat('cccc d LLLL, HH:mm')} – ${e.end.toFormat('HH:mm')}`}
        </div>
        ${e.location ? html`<div>${e.location}</div>` : ''}
        ${e.description ? html`<div>${e.description}</div>` : ''}
      </div>
    </ha-dialog>
  `;
}
```

- [ ] **Step 5: Typecheck, lint, build**

Run: `pnpm typecheck && pnpm lint && pnpm build`
Expected: clean.

- [ ] **Step 6: Manual verification in Home Assistant**

1. Copy `dist/calendar-week-view.js` to `config/www/` on a HA instance (or serve via the dev resource URL).
2. Add the resource (JavaScript Module) and a card:
   ```yaml
   type: custom:calendar-week-view
   weekStartsOn: monday
   visibleDays: 3
   addEvents: true
   weather: { entity: weather.home }
   calendars:
     - entity: calendar.personal
       name: Personal
       color: '#3b82f6'
     - entity: calendar.work
       name: Work
       color: '#10b981'
   ```
3. Confirm against the comp (light + dark): 3 wide columns, today featured (taller + border + accent), auto-scrolled to today, dots + start–end times, weather on upcoming events, all-day/multi-day chevron pills, legend toggle, prev/next/This-week nav, FAB bottom-right.

- [ ] **Step 7: Commit**

```bash
git add src/card.ts src/card.styles.ts
git commit -m "feat: render week strip, featured today, events, weather, nav, legend"
```

---

### Task 6: Add-event dialog (`calendar.create_event`)

**Files:**
- Create: `src/add-event-dialog.ts`
- Modify: `src/index.ts` (register `calendar-week-view-add-dialog`), `src/card.ts` (`_openAdd` shows the dialog)

**Interfaces:**
- Consumes: `HomeAssistant`, `CalendarConfig`, writable calendars from `_writableCalendars()`, `DateTime`.
- Produces: element `calendar-week-view-add-dialog` with `.hass`, `.calendars: CalendarConfig[]`, `.defaultDate: DateTime`; fires `cwv-created` on success.

- [ ] **Step 1: Implement `src/add-event-dialog.ts`**

```ts
import { LitElement, html, css } from 'lit';
import { property, state } from 'lit/decorators.js';
import { DateTime } from 'luxon';
import type { HomeAssistant } from 'custom-card-helpers';
import type { CalendarConfig } from '@/types';

export class CalendarWeekViewAddDialog extends LitElement {
  static styles = css`
    .row { margin: 12px 0; display: flex; flex-direction: column; gap: 6px; }
    .times { display: flex; gap: 12px; }
  `;

  @property({ attribute: false }) hass!: HomeAssistant;
  @property({ attribute: false }) calendars: CalendarConfig[] = [];
  @property({ attribute: false }) defaultDate: DateTime = DateTime.now();

  @state() private _open = false;
  @state() private _title = '';
  @state() private _entity = '';
  @state() private _allDay = true;
  @state() private _date = '';
  @state() private _start = '09:00';
  @state() private _end = '10:00';
  @state() private _error = '';

  show(): void {
    this._entity = this.calendars[0]?.entity ?? '';
    this._date = this.defaultDate.toISODate() ?? '';
    this._title = '';
    this._allDay = true;
    this._error = '';
    this._open = true;
  }

  render() {
    if (!this._open) return html``;
    return html`
      <ha-dialog open .heading=${'Add event'} @closed=${() => (this._open = false)}>
        ${this._error ? html`<ha-alert alert-type="error">${this._error}</ha-alert>` : ''}
        <div class="row">
          <ha-textfield label="Title" .value=${this._title}
            @input=${(e: Event) => (this._title = (e.target as HTMLInputElement).value)}></ha-textfield>
        </div>
        <div class="row">
          <ha-select label="Calendar" .value=${this._entity}
            @selected=${(e: CustomEvent) => (this._entity = (e.target as HTMLSelectElement).value)}>
            ${this.calendars.map((c) => html`<mwc-list-item value=${c.entity}>${c.name ?? c.entity}</mwc-list-item>`)}
          </ha-select>
        </div>
        <div class="row">
          <ha-formfield label="All day">
            <ha-switch .checked=${this._allDay}
              @change=${(e: Event) => (this._allDay = (e.target as HTMLInputElement).checked)}></ha-switch>
          </ha-formfield>
        </div>
        <div class="row">
          <ha-textfield type="date" label="Date" .value=${this._date}
            @input=${(e: Event) => (this._date = (e.target as HTMLInputElement).value)}></ha-textfield>
        </div>
        ${this._allDay
          ? ''
          : html`<div class="row times">
              <ha-textfield type="time" label="Start" .value=${this._start}
                @input=${(e: Event) => (this._start = (e.target as HTMLInputElement).value)}></ha-textfield>
              <ha-textfield type="time" label="End" .value=${this._end}
                @input=${(e: Event) => (this._end = (e.target as HTMLInputElement).value)}></ha-textfield>
            </div>`}
        <mwc-button slot="secondaryAction" dialogAction="close">Cancel</mwc-button>
        <mwc-button slot="primaryAction" .disabled=${this._title.trim() === ''} @click=${this._save}>Add</mwc-button>
      </ha-dialog>
    `;
  }

  private async _save(): Promise<void> {
    try {
      const data: Record<string, string> = { summary: this._title.trim() };
      if (this._allDay) {
        data.start_date = this._date;
        data.end_date = DateTime.fromISO(this._date).plus({ days: 1 }).toISODate() ?? '';
      } else {
        data.start_date_time = DateTime.fromISO(`${this._date}T${this._start}`).toISO() ?? '';
        data.end_date_time = DateTime.fromISO(`${this._date}T${this._end}`).toISO() ?? '';
      }
      await this.hass.callService('calendar', 'create_event', data, { entity_id: this._entity });
      this._open = false;
      this.dispatchEvent(new CustomEvent('cwv-created', { bubbles: true, composed: true }));
    } catch (e) {
      this._error = `Could not create event: ${(e as Error).message}`;
    }
  }
}
```

- [ ] **Step 2: Register the dialog element in `src/index.ts`**

Add:
```ts
import { CalendarWeekViewAddDialog } from '@/add-event-dialog';
customElements.define('calendar-week-view-add-dialog', CalendarWeekViewAddDialog);
```

- [ ] **Step 3: Wire the dialog into `src/card.ts`**

Add a dialog instance to `render()` (before `</ha-card>`), a ref, and replace `_openAdd`:
```ts
// in render(), before the details dialog:
<calendar-week-view-add-dialog
  .hass=${this.hass}
  .calendars=${this._writableCalendars()}
  .defaultDate=${(this._columns.find((c) => c.isToday) ?? this._columns[0])?.date ?? this._now()}
  @cwv-created=${() => this._fetchAndBuild()}
></calendar-week-view-add-dialog>
```
```ts
private _openAdd(): void {
  const dlg = this.renderRoot.querySelector('calendar-week-view-add-dialog') as
    | (HTMLElement & { show: () => void })
    | null;
  dlg?.show();
}
```

- [ ] **Step 4: Typecheck, lint, build**

Run: `pnpm typecheck && pnpm lint && pnpm build`
Expected: clean.

- [ ] **Step 5: Manual verification in HA**

Tap the FAB → dialog opens with today's date and the first writable calendar. Add an all-day event → it appears after refresh. Toggle "All day" off → time fields appear; add a timed event. Force a failure (e.g. a read-only calendar) → inline error, dialog stays open.

- [ ] **Step 6: Commit**

```bash
git add src/add-event-dialog.ts src/card.ts src/index.ts
git commit -m "feat: quick-add event dialog via calendar.create_event"
```

---

### Task 7: Config editor (`editor.ts`)

**Files:**
- Create: `src/editor.ts`
- Modify: `src/index.ts` (register `calendar-week-view-editor`)

**Interfaces:**
- Consumes: `HomeAssistant`, `CardConfig`.
- Produces: element `calendar-week-view-editor` with `setConfig(config)` and `.hass`, firing `config-changed`.

- [ ] **Step 1: Implement `src/editor.ts` with an `ha-form` schema**

```ts
import { LitElement, html } from 'lit';
import { property, state } from 'lit/decorators.js';
import type { HomeAssistant } from 'custom-card-helpers';
import type { CardConfig } from '@/types';

const SCHEMA = [
  { name: 'title', selector: { text: {} } },
  { name: 'weekStartsOn', selector: { select: { options: ['monday', 'sunday'], mode: 'dropdown' } } },
  { name: 'visibleDays', selector: { number: { min: 1, max: 7, mode: 'box' } } },
  { name: 'height', selector: { text: {} } },
  { name: 'hideWeekend', selector: { boolean: {} } },
  { name: 'showNavigation', selector: { boolean: {} } },
  { name: 'showLegend', selector: { boolean: {} } },
  { name: 'legendToggle', selector: { boolean: {} } },
  { name: 'addEvents', selector: { boolean: {} } },
];

export class CalendarWeekViewEditor extends LitElement {
  @property({ attribute: false }) hass!: HomeAssistant;
  @state() private _config!: CardConfig;

  setConfig(config: CardConfig): void {
    this._config = config;
  }

  render() {
    if (!this._config) return html``;
    return html`
      <ha-form
        .hass=${this.hass}
        .data=${this._config}
        .schema=${SCHEMA}
        .computeLabel=${(s: { name: string }) => s.name}
        @value-changed=${this._changed}
      ></ha-form>
      <p style="opacity:.7;font-size:.9em">
        Edit <code>calendars</code>, <code>weather</code>, and <code>addEventCalendars</code> in YAML.
      </p>
    `;
  }

  private _changed(ev: CustomEvent): void {
    this.dispatchEvent(
      new CustomEvent('config-changed', {
        detail: { config: { ...this._config, ...ev.detail.value } },
        bubbles: true,
        composed: true,
      }),
    );
  }
}
```

- [ ] **Step 2: Register the editor in `src/index.ts`**

```ts
import { CalendarWeekViewEditor } from '@/editor';
customElements.define('calendar-week-view-editor', CalendarWeekViewEditor);
```

- [ ] **Step 3: Typecheck, lint, build**

Run: `pnpm typecheck && pnpm lint && pnpm build`
Expected: clean.

- [ ] **Step 4: Manual verification in HA**

Open the card's visual editor → the `ha-form` fields render and edits update the card. Confirm the YAML note is shown for `calendars`.

- [ ] **Step 5: Commit**

```bash
git add src/editor.ts src/index.ts
git commit -m "feat: ha-form config editor"
```

---

### Task 8: Packaging, docs, and release wiring

**Files:**
- Modify: `README.md` (full config table), `package.json` (version bump to `1.0.0`)
- Create: `.github/workflows/build.yml` (optional CI build)

**Interfaces:**
- Consumes: the finished card.
- Produces: a documented, HACS-installable release.

- [ ] **Step 1: Write the full `README.md`** — installation (HACS + manual), the complete config table (every key from the spec §5 with type/default/description), the weather-horizon note, and the attribution to week-planner-card.

- [ ] **Step 2: Add CI build workflow `.github/workflows/build.yml`**

```yaml
name: build
on: [push, pull_request]
jobs:
  build:
    runs-on: ubuntu-latest
    steps:
      - uses: actions/checkout@v4
      - uses: pnpm/action-setup@v4
        with: { version: 10.15.1 }
      - uses: actions/setup-node@v4
        with: { node-version: 24, cache: pnpm }
      - run: pnpm install --frozen-lockfile
      - run: pnpm test && pnpm typecheck && pnpm lint && pnpm build
```

- [ ] **Step 3: Full verification**

Run: `pnpm install && pnpm test && pnpm typecheck && pnpm lint && pnpm build`
Expected: all green; `dist/calendar-week-view.js` present.

- [ ] **Step 4: Final manual smoke test in HA** — fresh dashboard, add via the visual card picker ("Calendar Week View" appears), verify light + dark against the comp, verify quick-add and weather.

- [ ] **Step 5: Bump version and commit**

```bash
git add -A
git commit -m "docs: full README + CI; release v1.0.0"
git tag v1.0.0
```

---

## Self-review notes (verified while writing)

- **Spec coverage:** week strip/3-up/auto-scroll (Task 5 `updated()` + `autoScrollStartIndex` Task 2), featured today (Task 5 CSS port), dots + start–end + weather (Task 5 `_renderEvent`, Task 3), all-day/multi-day chevrons (Task 2 `buildDayColumns`, Task 5 `_renderPill`), legend + toggle (Task 5), nav (Task 5), FAB add with date+calendar picker (Task 6), weather horizon (Task 3 `forecastForEvent`), config schema (Task 4 `setConfig` + Task 7 editor), license/attribution (Task 1), testing (Tasks 2–3). All spec sections map to a task.
- **Type consistency:** `WeekEvent`, `DayColumn`, `CardConfig`, `HourlyForecast` defined once in Task 2 `types.ts`; `forecastForEvent`/`buildForecastMap`/`weatherIcon` names match between Task 3 and Task 5; `_writableCalendars()`/`_fetchAndBuild()`/`_now()` referenced consistently across Tasks 4–6.
- **Open items carried from spec §12:** confirm hourly-forecast field names per integration (Task 3 uses `datetime`/`condition`/`temperature`), verify `supported_features` bit (Task 4 uses `1`), TS 7 `tsc --noEmit` behavior (Task 1 gate).
