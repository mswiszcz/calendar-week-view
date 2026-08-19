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

This card is not in the default HACS store yet, so add it as a **custom repository**:

1. In Home Assistant, open **HACS**.
2. Top-right menu (⋮) → **Custom repositories**.
3. Paste `https://github.com/mswiszcz/calendar-week-view`, choose type **Dashboard**, and click **Add**.
4. Search HACS for **Calendar Week View** and click **Download** (installs the latest release).
5. HACS registers the dashboard resource automatically. If it does not, add it under
   **Settings → Dashboards → ⋮ → Resources → Add resource**:
   - URL: `/hacsfiles/calendar-week-view/calendar-week-view.js`
   - Resource type: **JavaScript Module**
6. Hard-refresh the browser, then add the card (see [Usage](#usage)).

[![Open in HACS](https://my.home-assistant.io/badges/hacs_repository.svg)](https://my.home-assistant.io/redirect/hacs_repository/?owner=mswiszcz&repository=calendar-week-view&category=dashboard)

### Manual

1. Download `calendar-week-view.js` from the
   [latest release](https://github.com/mswiszcz/calendar-week-view/releases/latest).
2. Copy it into `config/www/` on your Home Assistant instance.
3. **Settings → Dashboards → ⋮ → Resources → Add resource**:
   - URL: `/local/calendar-week-view.js`
   - Resource type: **JavaScript Module**
4. Hard-refresh the browser.

## Usage

Add the card via the dashboard **visual card picker** ("Calendar Week View").
The card ships a full **visual editor** — add, configure, and remove calendars,
pick a weather entity, choose UI colors, and set every option without touching
YAML. You can still configure it in YAML if you prefer:

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
| `height` | string | `520px` | **Minimum** height. The card fills its container (full height in a panel view) and never shrinks below this. |
| `showNavigation` | boolean | `true` | Show the week controls and the carousel day arrows. The strip pages by one view and rolls into adjacent weeks; swipe still works. |
| `showLegend` | boolean | `true` | Show the calendar legend chips. |
| `legendToggle` | boolean | `true` | Click a legend chip to hide/show that calendar's events. |
| `addEvents` | boolean | `false` | Show the floating quick-add button (needs ≥1 writable calendar). |
| `addEventCalendars` | list of entity ids | all writable | Restrict the add dialog's calendar picker. |
| `weather` | object | — | Optional hourly weather. See [Weather options](#weather-options). |
| `colors` | object | — | Override UI colors. See [Color options](#color-options). |
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

### Color options

All optional; each overrides one UI element and falls back to the active Home
Assistant theme when unset. Accepts any CSS color (hex, named, or `var(--token)`).

```yaml
colors:
  accent: '#0aa2e6'        # today accent, quick-add button, this-week button
  today: '#e8f4fd'         # today column background
  dayBackground: '#f5f5f7' # day column + legend chip background
  cardBackground: '#ffffff'
  text: '#1a1c1e'
  secondaryText: '#5f6368'
```

| Key | Overrides |
|---|---|
| `accent` | Today accent, quick-add FAB, this-week button, nav hover. |
| `today` | Today column background tint. |
| `dayBackground` | Day column and legend chip background. |
| `cardBackground` | Card and pill background base. |
| `text` | Primary text. |
| `secondaryText` | Day names, event times, subtitles. |

## Managing events

Click any event to open its overview. When the event's calendar supports it
(`local_calendar`, CalDAV, most Google setups), the overview offers **Edit** and
**Delete**. Recurring events ask whether the change applies to **this event**,
**this and following events**, or **all events**, matching Home Assistant's own
calendar. Use the floating **+** button (enable `addEvents`) to create events.

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

### Releasing

Bump `version` in `package.json`, commit on a feature branch, then:

```bash
make push        # verify → push branch → PR → merge to main → tag vX.Y.Z → push tag
```

Pushing the tag triggers `release.yml`, which builds and attaches
`dist/calendar-week-view.js` to the GitHub release. `make verify` runs the
test / typecheck / lint / build gate on its own.

Pure, timezone- and now-injected logic lives in `src/week.ts` and
`src/weather.ts` (unit-tested); `src/card.ts` is the Lit shell that does all
`hass` I/O and rendering.

## License & attribution

MIT. Built on the data layer of
[week-planner-card](https://github.com/FamousWolf/week-planner-card) by Rudy
Gnodde (MIT); this project retains the upstream copyright notice and adds its
own. See [`LICENSE`](LICENSE).
