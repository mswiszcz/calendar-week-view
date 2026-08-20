import { LitElement, css, html } from 'lit';
import { property, state } from 'lit/decorators.js';
import type { HomeAssistant } from 'custom-card-helpers';
import type { ButtonConfig, CalendarConfig, CardConfig, UiColors, WeatherConfig } from '@/types';

/** Per-button form fields, shared by header and floating button lists. */
const BUTTON_SCHEMA = [
  { name: 'icon', selector: { icon: {} } },
  { name: 'name', selector: { text: {} } },
  { name: 'tap_action', selector: { ui_action: {} } },
];

/**
 * Single-field entity pickers, rendered through `ha-form` so it imports and
 * registers `ha-entity-picker` on demand. A bare `<ha-entity-picker>` renders
 * nothing until something else in the frontend loads that element first.
 */
const CALENDAR_ENTITY_SCHEMA = [{ name: 'entity', selector: { entity: { filter: { domain: 'calendar' } } } }];
const WEATHER_ENTITY_SCHEMA = [{ name: 'entity', selector: { entity: { filter: { domain: 'weather' } } } }];

type ButtonKind = 'headerButtons' | 'floatingButtons';

/** Fields shared by both view modes. */
const GENERAL_SCHEMA = [
  {
    name: 'viewMode',
    selector: { select: { options: ['agenda', 'calendar'], mode: 'dropdown' } },
  },
  { name: 'visibleDays', selector: { number: { min: 1, max: 7, mode: 'box' } } },
  { name: 'hideWeekend', selector: { boolean: {} } },
  { name: 'lockToday', selector: { boolean: {} } },
  { name: 'showNavigation', selector: { boolean: {} } },
  { name: 'showLegend', selector: { boolean: {} } },
  { name: 'legendToggle', selector: { boolean: {} } },
  { name: 'addEvents', selector: { boolean: {} } },
];

/** Fields that only affect agenda view. */
const AGENDA_SCHEMA = [
  {
    name: 'orientation',
    selector: { select: { options: ['horizontal', 'vertical'], mode: 'dropdown' } },
  },
];

/** The whole header: the card's clock/next-event line plus the per-day column
    headers. Each on/off toggle sits directly above the format it controls. */
const HEADER_SCHEMA = [
  { name: 'showClock', selector: { boolean: {} } },
  { name: 'clockFormat', selector: { text: {} } },
  { name: 'headerDateFormat', selector: { text: {} } },
  { name: 'showNextEvent', selector: { boolean: {} } },
  { name: 'showHeaderSuptext', selector: { boolean: {} } },
  { name: 'headerSuptext', selector: { text: {} } },
  { name: 'showHeaderText', selector: { boolean: {} } },
  { name: 'headerText', selector: { text: {} } },
];

/** Fields that only affect calendar view. */
const CALENDAR_SCHEMA = [{ name: 'startHour', selector: { number: { min: 0, max: 23, mode: 'box' } } }];

/** Independent toggles for today's accent treatment. */
const TODAY_SCHEMA = [
  { name: 'highlightToday', selector: { boolean: {} } },
  { name: 'todayBorder', selector: { boolean: {} } },
  { name: 'todayText', selector: { boolean: {} } },
];

const ADVANCED_SCHEMA = [
  { name: 'compact', selector: { boolean: {} } },
  { name: 'combineSimilarEvents', selector: { boolean: {} } },
  {
    name: 'updateInterval',
    selector: { number: { min: 10, max: 3600, mode: 'box', unit_of_measurement: 's' } },
  },
  { name: 'timeFormat', selector: { text: {} } },
  { name: 'locale', selector: { text: {} } },
];

const LABELS: Record<string, string> = {
  icon: 'Icon',
  name: 'Label',
  tap_action: 'Tap action',
  viewMode: 'View mode',
  orientation: 'Layout orientation',
  startHour: 'Start hour',
  visibleDays: 'Visible days',
  hideWeekend: 'Hide weekend',
  lockToday: 'Lock to today (no navigation)',
  highlightToday: 'Background',
  todayBorder: 'Border',
  todayText: 'Text',
  showNavigation: 'Show navigation',
  showLegend: 'Show legend',
  legendToggle: 'Legend toggles calendars',
  showClock: 'Show clock & date',
  showNextEvent: 'Show next event',
  addEvents: 'Enable quick-add button',
  compact: 'Compact',
  combineSimilarEvents: 'Combine duplicate events',
  updateInterval: 'Update interval',
  timeFormat: 'Time format',
  headerSuptext: 'Header suptext',
  headerText: 'Header text',
  showHeaderSuptext: 'Show header suptext',
  showHeaderText: 'Show header text',
  clockFormat: 'Clock format',
  headerDateFormat: 'Header date format',
  locale: 'Locale',
};

/** Helper text shown under specific fields to explain what they do. */
const HELPERS: Record<string, string> = {
  orientation:
    'Vertical stacks the days full-height and grows the card to fit them — the dashboard scrolls, nothing inside the card does. Horizontal is a scrollable day strip.',
  visibleDays:
    'Days shown at once: strip columns when horizontal, and the number of days listed from today when vertical.',
  compact:
    'Tighter layout: shorter clock and min-height; in the vertical agenda, a halved header gap and an edge-to-edge day list.',
  timeFormat: 'Luxon tokens for event start/end times, e.g. HH:mm or h:mm a.',
  headerSuptext:
    'Small line above the day number. Literal text plus {luxonToken} groups, e.g. Week {W} or {cccc}. Default {yyyy · LLLL · cccc} (agenda) / {ccc} (calendar).',
  headerText: 'The day number line. Literal text plus {luxonToken} groups, e.g. {d} or Day {d}. Default {d}.',
  showHeaderSuptext: 'Show the suptext line (the header suptext below).',
  showHeaderText: 'Show the main day-header line (the header text below).',
  clockFormat: 'Luxon tokens for the header clock; add ss (e.g. HH:mm:ss) to tick every second.',
  headerDateFormat: 'Luxon tokens for the date beside the clock, e.g. cccc, d LLLL.',
  locale: 'BCP-47 locale applied to formatted dates and times, e.g. en, de, fr.',
};

/**
 * Effective card defaults, so editor controls reflect real behavior on a fresh
 * card (e.g. the next event shows by default, so its toggle must read as on).
 * Keys equal to their default are stripped from the saved config on change.
 */
const DEFAULTS: Partial<CardConfig> = {
  weekStartsOn: 'monday',
  viewMode: 'agenda',
  orientation: 'horizontal',
  visibleDays: 3,
  startHour: 8,
  updateInterval: 60,
  hideWeekend: false,
  lockToday: false,
  highlightToday: true,
  todayBorder: true,
  todayText: true,
  showNavigation: true,
  showLegend: true,
  legendToggle: true,
  showClock: true,
  showNextEvent: true,
  addEvents: false,
  compact: false,
  combineSimilarEvents: false,
  showHeaderSuptext: true,
  showHeaderText: true,
};

const COLOR_FIELDS: { key: keyof UiColors; label: string }[] = [
  { key: 'accent', label: 'Accent (today, buttons)' },
  { key: 'today', label: 'Today column' },
  { key: 'dayBackground', label: 'Day background' },
  { key: 'cardBackground', label: 'Card background color' },
  { key: 'text', label: 'Primary text' },
  { key: 'secondaryText', label: 'Secondary text' },
];

const HEX = /^#[0-9a-fA-F]{6}$/;

export class CalendarWeekViewEditor extends LitElement {
  static styles = css`
    ha-expansion-panel {
      display: block;
      margin-bottom: 12px;
      --expansion-panel-content-padding: 0;
    }
    .section {
      padding: 8px 16px 16px;
      display: flex;
      flex-direction: column;
      gap: 8px;
    }
    .grp-actions {
      display: flex;
      justify-content: flex-end;
      margin-bottom: -4px;
    }
    .toggles {
      display: flex;
      flex-wrap: wrap;
      gap: 16px;
    }
    ha-textfield {
      width: 100%;
    }
    .color-row {
      display: flex;
      align-items: center;
      gap: 10px;
    }
    .color-row label {
      flex: 1;
      font-size: 13.5px;
    }
    .color-row input[type='color'] {
      width: 36px;
      height: 28px;
      padding: 0;
      border: 1px solid var(--divider-color);
      border-radius: 6px;
      background: none;
      cursor: pointer;
    }
    .color-row ha-textfield {
      width: 150px;
    }
    .icon-btn {
      border: none;
      background: none;
      color: var(--secondary-text-color);
      cursor: pointer;
      display: grid;
      place-items: center;
      padding: 4px;
      border-radius: 8px;
    }
    .icon-btn:hover {
      color: var(--error-color, #db4437);
      background: var(--secondary-background-color);
    }
    .add-btn {
      align-self: flex-start;
      display: inline-flex;
      align-items: center;
      gap: 6px;
      font: inherit;
      font-weight: 600;
      color: var(--primary-color);
      background: none;
      border: 1px dashed var(--primary-color);
      border-radius: 8px;
      padding: 8px 14px;
      cursor: pointer;
    }
    .hint {
      font-size: 12.5px;
      color: var(--secondary-text-color);
    }
  `;

  @property({ attribute: false }) hass!: HomeAssistant;
  @state() private _config!: CardConfig;
  /** Which calendar / button item panels are expanded, keyed `kind:index`. A
      freshly added item is opened so its fields (e.g. the entity picker) show. */
  @state() private _openItems = new Set<string>();

  setConfig(config: CardConfig): void {
    this._config = config;
  }

  private _setItemOpen(key: string, open: boolean): void {
    if (open === this._openItems.has(key)) return;
    const next = new Set(this._openItems);
    if (open) next.add(key);
    else next.delete(key);
    this._openItems = next;
  }

  render() {
    if (!this._config) return html``;
    const calendars = this._config.calendars ?? [];
    const data = { ...DEFAULTS, ...this._config };
    return html`
      <ha-expansion-panel outlined .header=${'General'} expanded>
        <div class="section">${this._form(data, GENERAL_SCHEMA)}</div>
      </ha-expansion-panel>

      <ha-expansion-panel outlined .header=${'Agenda view'}>
        <div class="section">
          <div class="hint">Applies when View mode is Agenda.</div>
          ${this._form(data, AGENDA_SCHEMA)}
        </div>
      </ha-expansion-panel>

      <ha-expansion-panel outlined .header=${'Calendar view'}>
        <div class="section">
          <div class="hint">Applies when View mode is Calendar.</div>
          ${this._form(data, CALENDAR_SCHEMA)}
        </div>
      </ha-expansion-panel>

      <ha-expansion-panel outlined .header=${`Calendars (${calendars.length})`} expanded>
        <div class="section">
          ${calendars.map((cal, i) => this._renderCalendar(cal, i))}
          <button class="add-btn" @click=${this._addCalendar}><ha-icon icon="mdi:plus"></ha-icon> Add calendar</button>
        </div>
      </ha-expansion-panel>

      <ha-expansion-panel outlined .header=${'Weather'}>
        <div class="section">${this._renderWeather()}</div>
      </ha-expansion-panel>

      <ha-expansion-panel outlined .header=${'Buttons'}>
        <div class="section">
          <ha-expansion-panel outlined .header=${'Header buttons'}>
            <div class="section">
              <div class="hint">Custom buttons at the top-right of the header. Each runs a Home Assistant action.</div>
              ${this._renderButtonList('headerButtons')}
            </div>
          </ha-expansion-panel>
          <ha-expansion-panel outlined .header=${'Floating buttons'}>
            <div class="section">
              <div class="hint">Custom buttons beside the floating + at the bottom-right.</div>
              ${this._renderButtonList('floatingButtons')}
            </div>
          </ha-expansion-panel>
        </div>
      </ha-expansion-panel>

      <ha-expansion-panel outlined .header=${'Styling'}>
        <div class="section">
          <div class="toggles">
            <ha-formfield label="Card background">
              <ha-switch
                .checked=${this._config.noCardBackground !== true}
                @change=${this._toggleCardBackground}
              ></ha-switch>
            </ha-formfield>
            <ha-formfield label="Day background">
              <ha-switch
                .checked=${this._config.noDayBackground !== true}
                @change=${this._toggleDayBackground}
              ></ha-switch>
            </ha-formfield>
          </div>
          <ha-expansion-panel outlined .header=${'Header'}>
            <div class="section">
              <div class="hint">
                The card header (clock, next event) and the per-day column headers. Format fields take literal text plus
                {luxonToken} groups.
              </div>
              ${this._form(data, HEADER_SCHEMA)}
            </div>
          </ha-expansion-panel>
          <ha-expansion-panel outlined .header=${'Today highlight'}>
            <div class="section">
              <div class="hint">Turn today's accent background, border, and text on or off.</div>
              ${this._form(data, TODAY_SCHEMA)}
            </div>
          </ha-expansion-panel>
          <ha-expansion-panel outlined .header=${'Colors'}>
            <div class="section">
              <div class="hint">Leave a color blank to follow the Home Assistant theme.</div>
              ${COLOR_FIELDS.map((f) => this._renderColorRow(f.key, f.label))}
            </div>
          </ha-expansion-panel>
        </div>
      </ha-expansion-panel>

      <ha-expansion-panel outlined .header=${'Advanced'}>
        <div class="section">${this._form(data, ADVANCED_SCHEMA)}</div>
      </ha-expansion-panel>
    `;
  }

  private _form(data: CardConfig, schema: unknown) {
    return html`
      <ha-form
        .hass=${this.hass}
        .data=${data}
        .schema=${schema}
        .computeLabel=${(s: { name: string }) => LABELS[s.name] ?? s.name}
        .computeHelper=${(s: { name: string }) => HELPERS[s.name] ?? ''}
        @value-changed=${this._generalChanged}
      ></ha-form>
    `;
  }

  private _renderCalendar(cal: CalendarConfig, i: number) {
    const key = `cal:${i}`;
    return html`
      <ha-expansion-panel
        outlined
        .header=${cal.name || cal.entity || 'New calendar'}
        .expanded=${this._openItems.has(key)}
        @expanded-changed=${(e: CustomEvent) => this._setItemOpen(key, e.detail.expanded)}
      >
        <div class="section">
          <div class="grp-actions">
            <button class="icon-btn" title="Remove calendar" @click=${() => this._removeCalendar(i)}>
              <ha-icon icon="mdi:trash-can-outline"></ha-icon>
            </button>
          </div>
          <ha-form
            .hass=${this.hass}
            .data=${{ entity: cal.entity ?? '' }}
            .schema=${CALENDAR_ENTITY_SCHEMA}
            .computeLabel=${() => 'Calendar entity'}
            @value-changed=${(e: CustomEvent) => this._calChanged(i, { entity: e.detail.value.entity ?? '' })}
          ></ha-form>
          <ha-textfield
            label="Name"
            .value=${cal.name ?? ''}
            @input=${(e: Event) => this._calChanged(i, { name: (e.target as HTMLInputElement).value || undefined })}
          ></ha-textfield>
          ${this._colorInputs(cal.color ?? '', (v) => this._calChanged(i, { color: v || undefined }))}
          <ha-textfield
            label="Filter (regex, hides matching events)"
            .value=${cal.filter ?? ''}
            @input=${(e: Event) => this._calChanged(i, { filter: (e.target as HTMLInputElement).value || undefined })}
          ></ha-textfield>
          <div class="toggles">
            <ha-formfield label="Hide in legend">
              <ha-switch
                .checked=${!!cal.hideInLegend}
                @change=${(e: Event) => this._calChanged(i, { hideInLegend: (e.target as HTMLInputElement).checked || undefined })}
              ></ha-switch>
            </ha-formfield>
            <ha-formfield label="Initially hidden">
              <ha-switch
                .checked=${!!cal.initiallyHidden}
                @change=${(e: Event) => this._calChanged(i, { initiallyHidden: (e.target as HTMLInputElement).checked || undefined })}
              ></ha-switch>
            </ha-formfield>
          </div>
        </div>
      </ha-expansion-panel>
    `;
  }

  private _renderButtonList(kind: ButtonKind) {
    const buttons = this._config[kind] ?? [];
    return html`
      ${buttons.map((btn, i) => this._renderButton(kind, btn, i))}
      <button class="add-btn" @click=${() => this._addButton(kind)}>
        <ha-icon icon="mdi:plus"></ha-icon> Add button
      </button>
    `;
  }

  private _renderButton(kind: ButtonKind, btn: ButtonConfig, i: number) {
    const key = `${kind}:${i}`;
    return html`
      <ha-expansion-panel
        outlined
        .header=${btn.name || btn.icon || 'New button'}
        .expanded=${this._openItems.has(key)}
        @expanded-changed=${(e: CustomEvent) => this._setItemOpen(key, e.detail.expanded)}
      >
        <div class="section">
          <div class="grp-actions">
            <button class="icon-btn" title="Remove button" @click=${() => this._removeButton(kind, i)}>
              <ha-icon icon="mdi:trash-can-outline"></ha-icon>
            </button>
          </div>
          <ha-form
            .hass=${this.hass}
            .data=${btn}
            .schema=${BUTTON_SCHEMA}
            .computeLabel=${(s: { name: string }) => LABELS[s.name] ?? s.name}
            @value-changed=${(e: CustomEvent) => this._buttonChanged(kind, i, e.detail.value)}
          ></ha-form>
          <div class="color-row">
            <label>Color</label>
            ${this._colorInputs(btn.color ?? '', (v) => this._buttonChanged(kind, i, { color: v || undefined }))}
          </div>
          <div class="color-row">
            <label>Background</label>
            ${this._colorInputs(
              btn.background ?? '',
              (v) => this._buttonChanged(kind, i, { background: v || undefined }),
              'Background',
            )}
          </div>
        </div>
      </ha-expansion-panel>
    `;
  }

  private _renderWeather() {
    const w = this._config.weather;
    return html`
      <ha-form
        .hass=${this.hass}
        .data=${{ entity: w?.entity ?? '' }}
        .schema=${WEATHER_ENTITY_SCHEMA}
        .computeLabel=${() => 'Weather entity'}
        @value-changed=${(e: CustomEvent) => this._weatherEntity(e.detail.value.entity ?? '')}
      ></ha-form>
      ${
        w
          ? html`
              <div class="toggles">
                <ha-formfield label="Show temperature">
                  <ha-switch
                    .checked=${w.showTemperature !== false}
                    @change=${(e: Event) => this._weatherChanged({ showTemperature: (e.target as HTMLInputElement).checked })}
                  ></ha-switch>
                </ha-formfield>
                <ha-formfield label="Round temperature">
                  <ha-switch
                    .checked=${w.roundTemperature !== false}
                    @change=${(e: Event) => this._weatherChanged({ roundTemperature: (e.target as HTMLInputElement).checked })}
                  ></ha-switch>
                </ha-formfield>
              </div>
              <div class="hint">Needs a weather entity that provides an hourly forecast.</div>
            `
          : html`<div class="hint">Pick a weather entity to show hourly weather on timed events.</div>`
      }
    `;
  }

  private _renderColorRow(key: keyof UiColors, label: string) {
    const value = this._config.colors?.[key] ?? '';
    return html`
      <div class="color-row">
        <label>${label}</label>
        ${this._colorInputs(value, (v) => this._colorChanged(key, v), label)}
      </div>
    `;
  }

  /** A native swatch + text field pair, shared by calendar color and UI colors. */
  private _colorInputs(value: string, apply: (v: string) => void, label = 'Color') {
    return html`
      <input
        type="color"
        .value=${HEX.test(value) ? value : '#888888'}
        @input=${(e: Event) => apply((e.target as HTMLInputElement).value)}
      />
      <ha-textfield
        label=${label}
        placeholder="theme default"
        .value=${value}
        @input=${(e: Event) => apply((e.target as HTMLInputElement).value)}
      ></ha-textfield>
    `;
  }

  private _emit(config: CardConfig): void {
    this._config = config;
    this.dispatchEvent(new CustomEvent('config-changed', { detail: { config }, bubbles: true, composed: true }));
  }

  private _generalChanged(ev: CustomEvent): void {
    this._emit(this._normalize({ ...this._config, ...ev.detail.value }));
  }

  /** Drop keys whose value equals the effective default, keeping the saved config minimal. */
  private _normalize(config: CardConfig): CardConfig {
    const next = { ...config };
    for (const [key, value] of Object.entries(DEFAULTS)) {
      if (next[key as keyof CardConfig] === value) delete next[key as keyof CardConfig];
    }
    return next;
  }

  private _toggleCardBackground(e: Event): void {
    const config = { ...this._config };
    if ((e.target as HTMLInputElement).checked) delete config.noCardBackground;
    else config.noCardBackground = true;
    this._emit(config);
  }

  private _toggleDayBackground(e: Event): void {
    const config = { ...this._config };
    if ((e.target as HTMLInputElement).checked) delete config.noDayBackground;
    else config.noDayBackground = true;
    this._emit(config);
  }

  private _addCalendar(): void {
    this._setItemOpen(`cal:${(this._config.calendars ?? []).length}`, true);
    this._emit({ ...this._config, calendars: [...(this._config.calendars ?? []), { entity: '' }] });
  }

  private _removeCalendar(i: number): void {
    const calendars = (this._config.calendars ?? []).filter((_, idx) => idx !== i);
    this._emit({ ...this._config, calendars });
  }

  private _calChanged(i: number, patch: Partial<CalendarConfig>): void {
    const calendars = (this._config.calendars ?? []).map((c, idx) => (idx === i ? { ...c, ...patch } : c));
    this._emit({ ...this._config, calendars });
  }

  private _addButton(kind: ButtonKind): void {
    this._setItemOpen(`${kind}:${(this._config[kind] ?? []).length}`, true);
    this._emit({ ...this._config, [kind]: [...(this._config[kind] ?? []), { icon: '' }] });
  }

  private _removeButton(kind: ButtonKind, i: number): void {
    const buttons = (this._config[kind] ?? []).filter((_, idx) => idx !== i);
    const config = { ...this._config };
    if (buttons.length) config[kind] = buttons;
    else delete config[kind];
    this._emit(config);
  }

  private _buttonChanged(kind: ButtonKind, i: number, patch: Partial<ButtonConfig>): void {
    const buttons = (this._config[kind] ?? []).map((b, idx) => (idx === i ? this._cleanButton({ ...b, ...patch }) : b));
    this._emit({ ...this._config, [kind]: buttons });
  }

  /** Drop empty optional keys so a saved button stays minimal. */
  private _cleanButton(btn: ButtonConfig): ButtonConfig {
    const next = { ...btn };
    if (!next.name) delete next.name;
    if (!next.color) delete next.color;
    if (!next.background) delete next.background;
    if (!next.tap_action) delete next.tap_action;
    return next;
  }

  private _weatherEntity(entity: string): void {
    if (!entity) {
      const { weather: _drop, ...rest } = this._config;
      this._emit(rest);
      return;
    }
    this._emit({ ...this._config, weather: { ...this._config.weather, entity } });
  }

  private _weatherChanged(patch: Partial<WeatherConfig>): void {
    if (!this._config.weather) return;
    this._emit({ ...this._config, weather: { ...this._config.weather, ...patch } });
  }

  private _colorChanged(key: keyof UiColors, value: string): void {
    const colors: UiColors = { ...this._config.colors };
    if (value) colors[key] = value;
    else delete colors[key];
    const config = { ...this._config };
    if (Object.keys(colors).length) config.colors = colors;
    else delete config.colors;
    this._emit(config);
  }
}
