---
title: calendar-week-view — Design Spec
date: 2026-08-18
status: approved
---

# calendar-week-view — Design Spec

> [!abstract] What this is
> A new Home Assistant Lovelace card that renders the **current week** as a horizontal strip of day-columns, highlights **today**, lets the user page **prev/next week**, and supports **quick event creation**. Derived from [FamousWolf/week-planner-card](https://github.com/FamousWolf/week-planner-card) (MIT), rebuilt as a focused week view rather than a configurable multi-day list.

## 1. Origin, license, and scope

- **Derived from** `week-planner-card` (MIT © 2024 Rudy Gnodde). This is a *derivative work*: we reuse the proven data layer (REST calendar fetch, multi-day event splitting, per-calendar filters, combine-similar) and replace the rendering, navigation, and configuration surface.
- **License:** MIT. Retain the original copyright + permission notice in `LICENSE`, add the new author's line, and credit the origin in `README.md`.
- **This is a fresh project**, not a fork's branch: new repo at `/Users/mswiszcz/Labs/calendar-week-view`, new card type `custom:calendar-week-view`, new HACS entry.
- **Non-goals (explicitly out):** month view, arbitrary N-day view, per-column-count config, the original's whole-card tap `actions`, daily-only weather, `maxEvents`/`maxDayEvents` caps (per-column scroll replaces them), historical weather.

## 2. Visitor & mode

- **Mode:** Operate. The visitor completes a task — scan the week, see what's next, add an event.
- **Primary scene:** a wall- or desk-mounted **tablet** in a home, plus normal desktop/mobile dashboards. Glanceability and touch targets outrank expression.
- **Success:** at a glance the visitor knows what day it is, what's on today and the next two days, and can add an event in a couple taps.

## 3. Tech stack & tooling

| Concern | Choice |
|---|---|
| Language | TypeScript, ESM |
| UI | Lit 3 (`LitElement`) |
| Dates | Luxon (robust week/timezone/DST math — justified over native `Date`) |
| Package manager | pnpm, exact pinned versions, `minimumReleaseAge` + `ignore-scripts` |
| Lint / format | oxlint · oxfmt |
| Types | `tsc --noEmit` |
| Tests | vitest (pure logic in `week.ts`) |
| Bundle | esbuild → single self-contained ESM `dist/calendar-week-view.js`, assets inlined |
| Distribution | HACS; `hacs.json` `filename: calendar-week-view.js` |

### Module layout

```
src/
  index.ts             # register custom element + window.customCards
  card.ts              # CalendarWeekViewCard (LitElement): fetch, render, nav, legend, event dialog
  card.styles.ts       # Lit css tokens + component styles
  editor.ts            # ha-form schema-driven config editor
  add-event-dialog.ts  # add-event dialog element + calendar.create_event
  week.ts              # PURE, injected `now`: week range, day list, multi-day split, all-day detect, auto-scroll index, weather map, formatting
  weather.ts           # hourly-forecast subscription + event→forecast lookup
  types.ts             # config + event + forecast types
test/
  week.test.ts         # vitest against week.ts (see §11)
```

> [!note] Boundary discipline
> Everything testable and framework-free lives in `week.ts` / `weather.ts` (pure functions, `now` injected). `card.ts` is the Lit shell (DOM + `hass` I/O). This keeps `card.ts` focused and the logic unit-testable without a DOM.

## 4. Visual contract (the locked comp)

The approved look is `assets/calendar-week-view-comp.html` (screens: `comp-light.png`, `comp-dark.png`). Direction: **"Ambient glance"** — soft rounded day tiles, calendar color carried by **dots** (never a thick left-bar), a **featured today** column, and a single floating add button. Native to Home Assistant: uses HA theme CSS variables with fallbacks, works in light and dark, and reads as an `ha-card`.

### 4.1 Layout — horizontal 3-up scroll strip

- The week is a **single horizontal row** of day-columns inside an `overflow-x` scroll strip; **never wraps** to a second row.
- **`visibleDays` (default 3)** columns are visible at once; columns are equal width (`calc((100% - gaps) / visibleDays)`) so exactly N fit. Scroll reveals the rest.
- **Scroll-snap** on the x-axis (`scroll-snap-type: x proximity`, `scroll-snap-align: start` per day) for clean tablet paging.
- On load and on week change, **auto-scroll so today is at the start** of the visible window:
  - normal: window = `[today, today+1, today+2]`
  - if today is the **last** day of the week: window = `[today−2, today−1, today]`
  - if today is the **almost-last** day: window = `[today−1, today, today+1]`
  - Generalized: `startIndex = clamp(todayIndex, 0, dayCount − visibleDays)`. When the shown week is **not** the current week (navigated away), scroll to the start of the week.
- `hideWeekend: true` → 5 days (Mon–Fri).

### 4.2 Day column anatomy (top → bottom)

1. **Header (pinned, no scroll):** weekday label (`MON`, uppercase, tracked) + large date number. No per-day add button.
2. **All-day / multi-day band (pinned, no scroll):** rounded pills; see §4.4.
3. **Timed events (vertical scroll):** `overflow-y: auto`, `min-height: 0`; fixed column height from `height` (default `480px`). Per-column scroll is independent.

### 4.3 Featured "today" column

Today is emphasized by **height + border + accent**, not a saturated fill (column **widths stay equal** so exactly `visibleDays` fit — today is not wider):
- **Taller** than neighbors (e.g. base `416px` → today `456px`), vertically centered so it **pops above and below** the row (the "best-value pricing plan" treatment).
- **Border** (≈1.5px, primary-tinted) instead of a drop shadow.
- **Accent-colored** weekday + date number (primary color), date number slightly larger.
- Subtle primary tint fill (`today-tint`), quiet.

### 4.4 Events

- **Timed event row:** calendar-color **dot** + **start–end time range** (`08:30 – 09:15`, tabular numerals) + optional **weather** (icon + temp, right-aligned on the time line); **title** on the line below, indented under the time. Flat rows (no per-event card/shadow/left-bar); hover = subtle tint. Click opens the **event-details dialog** (title, calendar, datetime, location, description) — reused from the original.
- **All-day / multi-day:** pills in the all-day band. Multi-day events are split per covered day (reused splitter) and rendered in **each** covered column with **continuation chevrons**: `‹` if it continues from the previous day, `›` if into the next (a Mon–Wed event reads as one span across three columns).
- **Empty day:** quiet "Nothing planned" text (no add prompt — add is the FAB).
- **Past events:** may render slightly dimmed (optional); no weather.

### 4.5 Top bar

- **Navigation:** round prev / next week buttons + week-range label (e.g. `17 – 23 Aug` / `2026`) + a prominent **This week** reset button. Prev/next shift by ±7 days; reset returns to the live current week.
- **Legend:** calendar chips (name + colored dot). With `legendToggle`, clicking a calendar hides/shows its events.

### 4.6 Add — floating action button

- A single **FAB, bottom-right**, 56px (tablet touch target), primary color, flat drop (no soft glow). Shown only when `addEvents: true` **and** ≥1 writable calendar exists.
- Because the FAB is global (not per-day), the **add-event dialog includes a date field** (default: today, or the day currently leading the view). See §6.

## 5. Configuration schema

```yaml
type: custom:calendar-week-view
title: string?                       # optional card heading
calendars:                           # required, ≥1
  - entity: calendar.personal        # required
    name: string?
    color: string?                   # CSS color; else palette rotation
    icon: string?                    # mdi:*
    filter: string?                  # regex → exclude matching events
    filterText: string?              # regex → strip from title
    hideInLegend: boolean?
    initiallyHidden: boolean?
weekStartsOn: monday | sunday        # default: monday
visibleDays: number                  # default: 3  (columns visible at once)
hideWeekend: boolean                 # default: false (Mon–Fri when true)
height: string                       # default: '480px' (column scroll height)
showNavigation: boolean              # default: true
showLegend: boolean                  # default: true
legendToggle: boolean                # default: true
addEvents: boolean                   # default: false (show FAB)
addEventCalendars: string[]?         # allowlist for the add dialog's picker; default = all writable
weather:                             # optional; omit to disable
  entity: weather.home               # required if weather present
  showTemperature: boolean           # default: true
  roundTemperature: boolean          # default: true
combineSimilarEvents: boolean        # default: false (merge identical events across calendars)
updateInterval: number               # default: 60 (seconds between re-fetch)
compact: boolean                     # default: false
noCardBackground: boolean            # default: false
locale: string?                      # Luxon locale
timeFormat: string                   # default: 'HH:mm'
dateFormat: string?                  # week-range label format
texts: {...}?                        # i18n string overrides
```

**Editor:** `ha-form`, schema-driven (much smaller than the original's hand-rolled editor). Writable calendars for `addEventCalendars` are discovered at runtime (see §6).

## 6. Add-event flow

1. Tap FAB → open `ha-dialog`.
2. Fields:
   - **Date** — defaults to today (or the leading visible day); date picker.
   - **Calendar** — dropdown of **writable** calendars = `states[entity].attributes.supported_features & 1` (`CalendarEntityFeature.CREATE_EVENT`), intersected with `addEventCalendars` when set. Default = first.
   - **Title** — required; the confirm button is disabled until non-empty.
   - **All day** — toggle, default **on**.
   - **Start / end time** — shown only when all-day is off; end defaults to start + 1h.
3. Confirm → `hass.callService('calendar', 'create_event', { entity_id }, data)`:
   - all-day: `{ summary, start_date, end_date }` (end = next day, HA's exclusive-end convention)
   - timed: `{ summary, start_date_time, end_date_time }` (ISO local, HA timezone)
4. On success → close dialog, re-fetch events so the new one appears.
5. On failure → surface `ha-alert` inside the dialog; dialog stays open.
6. No writable calendars → FAB hidden; editor shows a hint.

## 7. Data flow

- **Fetch:** for each configured calendar, HA REST `GET calendars/<entity>?start=&end=` over the shown week (reused from the original). Apply per-calendar/global `filter`/`filterText`, `combineSimilarEvents`. Multi-day events are split into per-day pieces by the reused splitter; each piece knows whether it continues left/right (from `originalStart`/`originalEnd`) to drive the chevrons.
- **Weather (§8).**
- **Refresh:** periodic re-fetch (default 60s) re-anchors "now"; when viewing the current week (offset 0) it stays live, without yanking the view if the user paged away.
- **Create:** §6.

## 8. Weather (per-event, hourly)

- Optional `weather.entity`. Subscribe to `weather/subscribe_forecast` with `forecast_type: 'hourly'`.
- Build a map `hourISO → { condition, temperature }`. For each **timed** event, look up the forecast slot at the event's **start hour**; render a native `mdi:weather-*` icon (via `ha-icon`) + temperature (respecting HA unit system; `roundTemperature`).
- **Horizon limitation (documented, not a bug):** hourly forecasts only extend ~24–48h (a few days for some integrations). Events **beyond the horizon show no weather** (not a blank/placeholder icon). **All-day** and **past** events show no weather.
- Icons are drawn from the mdi weather set; **no bundled image assets** (unlike the original's PNGs).

## 9. Visual tokens (from the comp)

Prefer HA theme variables; the values below are fallbacks and the palette the comp was tuned against.

| Token | Light | Dark |
|---|---|---|
| card bg | `#ffffff` | `#1b1d21` |
| page bg | `#eef0f3` | `#0e0f12` |
| text | `#1a1c1e` | `#e8eaed` |
| secondary text | `#6b7280` | `#9aa0a6` |
| divider | `rgba(0,0,0,.08)` | `rgba(255,255,255,.10)` |
| primary (accent) | `#0aa2e6` | `#22b8f0` |
| on-primary | `#ffffff` | `#04222f` |
| neutral tile | text 3% over card | white 4% over card |
| today tint | primary 8% over card | primary 14% over card |

- **Calendar default palette** (user overrides per calendar): personal `#3b82f6`/`#60a5fa`, work `#10b981`/`#34d399`, family `#f59e0b`/`#fbbf24`, birthday `#a855f7`/`#c084fc`.
- **Radius:** card `16px`, day tile `14px` (today `16px`), pills `999px`, FAB `50%`.
- **Spacing:** card padding `16px`; column gap `10px`; day height `416px`/today `456px`; event row `6–8px`, gap `1px`.
- **Type:** weekday `11px/700`, uppercase, tracking `.1em`; date `26px/700` (today `31px`); time `11px/600` tabular; title `13px/500`; weather `11px`.
- **Theme-awareness:** define light tokens on `:root`; override under `@media (prefers-color-scheme: dark)` and `[data-theme="dark"]`. Native card inherits HA theme vars first.

## 10. Edge cases & error handling

- Calendar fetch error → per-calendar error surfaced via `ha-alert` (reused pattern); other calendars still render.
- No events in a day → "Nothing planned".
- No writable calendar → FAB hidden.
- Multi-day event spanning the week boundary → only the in-week pieces render; chevrons still indicate continuation.
- DST / timezone → all date math in Luxon using HA's timezone.
- Very long titles → ellipsize (rare with wide columns).
- `create_event` failure → inline error, dialog stays open, no optimistic insert.

## 11. Testing

`vitest` against `week.ts` / `weather.ts` (pure, `now` injected — deterministic):

- Week range for `weekStartsOn` = monday and sunday.
- Prev/next week offset paging.
- `visibleDays` auto-scroll index: today normal, today = last day (→ `today−2`), today = almost last (→ `today−1`), navigated-away week (→ start).
- Multi-day split incl. across a week boundary; continuation-flag (left/right) correctness.
- All-day detection.
- Weather map: event→forecast lookup, beyond-horizon → none, all-day/past → none.
- Week-range label formatting.

Lit rendering and the `create_event` service call are verified manually in Home Assistant (no brittle DOM harness). Per project standards: test logic deeply, don't test config/schemas.

## 12. Open items (resolve during planning/impl)

- Exact HA `supported_features` bit constant for CREATE_EVENT (verify against current HA).
- Whether `compact` needs its own token overrides (as the original had).
- Default `height` behavior when the dashboard gives the card a fixed height vs `auto`.
- Confirm hourly-forecast field names across common weather integrations.

## 13. Attribution

Built on the data layer of **week-planner-card** by Rudy Gnodde (MIT). This project keeps the upstream copyright notice, adds its own, and links back in the README.
