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

type ButtonKind = 'headerButtons' | 'floatingButtons';

/** Fields shared by both view modes. */
const GENERAL_SCHEMA = [
  { name: 'title', selector: { text: {} } },
  {
    name: 'weekStartsOn',
    selector: { select: { options: ['monday', 'sunday'], mode: 'dropdown' } },
  },
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
  { name: 'showClock', selector: { boolean: {} } },
  { name: 'showNextEvent', selector: { boolean: {} } },
  { name: 'addEvents', selector: { boolean: {} } },
];

/** Fields that only affect agenda view. */
const AGENDA_SCHEMA = [
  {
    name: 'orientation',
    selector: { select: { options: ['horizontal', 'vertical'], mode: 'dropdown' } },
  },
  { name: 'dateFormat', selector: { text: {} } },
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
  { name: 'height', selector: { text: {} } },
  { name: 'combineSimilarEvents', selector: { boolean: {} } },
  {
    name: 'updateInterval',
    selector: { number: { min: 10, max: 3600, mode: 'box', unit_of_measurement: 's' } },
  },
  { name: 'timeFormat', selector: { text: {} } },
  { name: 'clockFormat', selector: { text: {} } },
  { name: 'headerDateFormat', selector: { text: {} } },
  { name: 'locale', selector: { text: {} } },
];

const LABELS: Record<string, string> = {
  icon: 'Icon',
  name: 'Label',
  tap_action: 'Tap action',
  title: 'Title',
  weekStartsOn: 'Week starts on',
  viewMode: 'View mode',
  orientation: 'Layout orientation',
  startHour: 'Start hour',
  visibleDays: 'Visible days',
  height: 'Minimum height',
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
  dateFormat: 'Date format',
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
  compact: 'Tighter padding and shorter rows to fit more in less vertical space.',
  height:
    'The card never shrinks below this but still grows to fill its container, e.g. 520px. Ignored in vertical agenda, which sizes to its content.',
  timeFormat: 'Luxon tokens for event start/end times, e.g. HH:mm or h:mm a.',
  dateFormat: 'Luxon tokens for the meta line above each day number, e.g. yyyy · LLLL · cccc.',
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
    .cal {
      border: 1px solid var(--divider-color);
      border-radius: 10px;
      padding: 12px;
      margin-bottom: 10px;
      display: flex;
      flex-direction: column;
      gap: 10px;
    }
    .cal-head {
      display: flex;
      align-items: center;
      justify-content: space-between;
      gap: 8px;
    }
    .cal-title {
      font-weight: 600;
      font-size: 14px;
      overflow: hidden;
      text-overflow: ellipsis;
      white-space: nowrap;
    }
    .toggles {
      display: flex;
      flex-wrap: wrap;
      gap: 16px;
    }
    ha-entity-picker,
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
    .subhead {
      margin-top: 6px;
      font-weight: 600;
      font-size: 13px;
      color: var(--primary-text-color);
    }
  `;

  @property({ attribute: false }) hass!: HomeAssistant;
  @state() private _config!: CardConfig;

  setConfig(config: CardConfig): void {
    this._config = config;
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
          <div class="subhead">Header buttons</div>
          <div class="hint">Custom buttons at the top-right of the header. Each runs a Home Assistant action.</div>
          ${this._renderButtonList('headerButtons')}
          <div class="subhead">Floating buttons</div>
          <div class="hint">Custom buttons beside the floating + at the bottom-right.</div>
          ${this._renderButtonList('floatingButtons')}
        </div>
      </ha-expansion-panel>

      <ha-expansion-panel outlined .header=${'Styling'}>
        <div class="section">
          <ha-formfield label="Card background">
            <ha-switch
              .checked=${this._config.noCardBackground !== true}
              @change=${this._toggleCardBackground}
            ></ha-switch>
          </ha-formfield>
          <div class="subhead">Today</div>
          <div class="hint">Turn today's accent background, border, and text on or off.</div>
          ${this._form(data, TODAY_SCHEMA)}
          <div class="subhead">Colors</div>
          <div class="hint">Leave a color blank to follow the Home Assistant theme.</div>
          ${COLOR_FIELDS.map((f) => this._renderColorRow(f.key, f.label))}
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
    return html`
      <div class="cal">
        <div class="cal-head">
          <span class="cal-title">${cal.name || cal.entity || 'New calendar'}</span>
          <button class="icon-btn" title="Remove calendar" @click=${() => this._removeCalendar(i)}>
            <ha-icon icon="mdi:trash-can-outline"></ha-icon>
          </button>
        </div>
        <ha-entity-picker
          .hass=${this.hass}
          .value=${cal.entity}
          .includeDomains=${['calendar']}
          allow-custom-entity
          @value-changed=${(e: CustomEvent) => this._calChanged(i, { entity: e.detail.value })}
        ></ha-entity-picker>
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
    return html`
      <div class="cal">
        <div class="cal-head">
          <span class="cal-title">${btn.name || btn.icon || 'New button'}</span>
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
      </div>
    `;
  }

  private _renderWeather() {
    const w = this._config.weather;
    return html`
      <ha-entity-picker
        .hass=${this.hass}
        .value=${w?.entity ?? ''}
        .includeDomains=${['weather']}
        allow-custom-entity
        @value-changed=${(e: CustomEvent) => this._weatherEntity(e.detail.value)}
      ></ha-entity-picker>
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

  private _addCalendar(): void {
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
