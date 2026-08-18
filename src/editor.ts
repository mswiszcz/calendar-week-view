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
