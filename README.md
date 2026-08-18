# Calendar Week View

A Home Assistant Lovelace card that renders the **current week** as a horizontal
strip of day-columns: a highlighted **today**, per-event **start–end times** and
**hourly weather**, all-day / multi-day pills with continuation chevrons, a
calendar legend, prev/next/this-week navigation, and a floating **quick-add**
button.

![Light](docs/superpowers/specs/assets/comp-light.png)
![Dark](docs/superpowers/specs/assets/comp-dark.png)

Derived from [week-planner-card](https://github.com/FamousWolf/week-planner-card)
by Rudy Gnodde (MIT) — the calendar data layer is reused; the UI, navigation, and
configuration surface are new.

## Installation

### HACS (recommended)

1. HACS → **Frontend** → menu → **Custom repositories**.
2. Add this repository with category **Dashboard** (Lovelace).
3. Install **Calendar Week View**, then reload resources.

### Manual

1. Download `dist/calendar-week-view.js` from a release.
2. Copy it into `config/www/` on your Home Assistant instance.
3. Settings → Dashboards → menu → **Resources** → **Add resource**:
   - URL `/local/calendar-week-view.js`
   - Type **JavaScript Module**

## Usage

Add the card via the dashboard **visual card picker** ("Calendar Week View"), or
in YAML:

```yaml
type: custom:calendar-week-view
title: This week
weekStartsOn: monday
visibleDays: 3
addEvents: true
weather:
  entity: weather.home
calendars:
  - entity: calendar.personal
    name: Personal
    color: '#3b82f6'
  - entity: calendar.work
    name: Work
    color: '#10b981'
```

## Configuration

| Option | Type | Default | Description |
|---|---|---|---|
| `type` | string | — | `custom:calendar-week-view` (required). |
| `title` | string | — | Optional heading shown above the week strip. |
| `calendars` | list | — | Required, at least one. See [Calendar options](#calendar-options). |
| `weekStartsOn` | `monday` \| `sunday` | `monday` | First day of the week. |
| `visibleDays` | number | `3` | Columns visible at once; the strip scrolls to reveal the rest. |
| `hideWeekend` | boolean | `false` | Show Monday–Friday only (5 columns). |
| `height` | string | `416px` | Day-column height. The featured today column is 40px taller. |
| `showNavigation` | boolean | `true` | Show the prev / next / this-week controls. |
| `showLegend` | boolean | `true` | Show the calendar legend chips. |
| `legendToggle` | boolean | `true` | Click a legend chip to hide/show that calendar's events. |
| `addEvents` | boolean | `false` | Show the floating quick-add button (needs ≥1 writable calendar). |
| `addEventCalendars` | list of entity ids | all writable | Restrict the add dialog's calendar picker. |
| `weather` | object | — | Optional hourly weather. See [Weather options](#weather-options). |
| `combineSimilarEvents` | boolean | `false` | Merge identical events that appear in more than one calendar. |
| `updateInterval` | number | `60` | Seconds between background re-fetches. |
| `compact` | boolean | `false` | Tighter padding and shorter columns. |
| `noCardBackground` | boolean | `false` | Render without the card background and shadow. |
| `timeFormat` | string | `HH:mm` | [Luxon](https://moment.github.io/luxon/#/formatting) token for event times. |
| `texts` | object | — | String overrides. Currently: `noEvents` (empty-day text). |

### Calendar options

| Option | Type | Default | Description |
|---|---|---|---|
| `entity` | string | — | Calendar entity id (required). |
| `name` | string | entity id | Display name in the legend and dialogs. |
| `color` | CSS color | `var(--primary-color)` | Dot / pill color for this calendar. |
| `filter` | regex string | — | Exclude events whose summary matches the pattern. |
| `hideInLegend` | boolean | `false` | Keep the calendar's events but omit it from the legend. |
| `initiallyHidden` | boolean | `false` | Start with this calendar's events hidden. |

### Weather options

| Option | Type | Default | Description |
|---|---|---|---|
| `entity` | string | — | A `weather.*` entity that provides an hourly forecast (required). |
| `showTemperature` | boolean | `true` | Show the temperature next to the icon. |
| `roundTemperature` | boolean | `true` | Round the temperature to a whole number. |

Weather is shown per **timed** event, at the event's start hour, using native
`mdi:weather-*` icons (no bundled image assets).

> **Weather horizon.** Hourly forecasts typically extend only ~24–48 hours (a
> few days for some integrations). Events beyond that horizon — as well as
> all-day and past events — show **no** weather rather than a blank icon. This is
> expected, not a bug.

### Reserved (not yet implemented)

These keys are accepted by the config schema but currently have no effect:
`locale`, `dateFormat`, and per-calendar `filterText` / `icon`.

## Development

```bash
pnpm install
pnpm test        # vitest — pure week/weather logic
pnpm typecheck   # tsc --noEmit
pnpm lint        # oxlint
pnpm build       # esbuild → dist/calendar-week-view.js
pnpm watch       # rebuild on change
```

Pure, timezone- and now-injected logic lives in `src/week.ts` and
`src/weather.ts` (unit-tested); `src/card.ts` is the Lit shell that does all
`hass` I/O and rendering.

## License & attribution

MIT. Built on the data layer of
[week-planner-card](https://github.com/FamousWolf/week-planner-card) by Rudy
Gnodde (MIT); this project retains the upstream copyright notice and adds its
own. See [`LICENSE`](LICENSE).
