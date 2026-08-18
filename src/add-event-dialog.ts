import { LitElement, css, html } from 'lit';
import { property, state } from 'lit/decorators.js';
import { DateTime } from 'luxon';
import type { HomeAssistant } from 'custom-card-helpers';
import type { CalendarConfig } from '@/types';

export class CalendarWeekViewAddDialog extends LitElement {
  static styles = css`
    .row {
      margin: 12px 0;
      display: flex;
      flex-direction: column;
      gap: 6px;
    }
    .times {
      flex-direction: row;
      gap: 12px;
    }
    ha-textfield,
    ha-select {
      width: 100%;
    }
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

  /** Open the dialog, seeding the first writable calendar and the default date. */
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
          <ha-textfield
            label="Title"
            .value=${this._title}
            @input=${(e: Event) => (this._title = (e.target as HTMLInputElement).value)}
          ></ha-textfield>
        </div>
        <div class="row">
          <ha-select
            label="Calendar"
            .value=${this._entity}
            @selected=${(e: CustomEvent) => (this._entity = (e.target as HTMLSelectElement).value)}
            @closed=${(e: Event) => e.stopPropagation()}
          >
            ${this.calendars.map(
              (c) => html`<mwc-list-item value=${c.entity}>${c.name ?? c.entity}</mwc-list-item>`,
            )}
          </ha-select>
        </div>
        <div class="row">
          <ha-formfield label="All day">
            <ha-switch
              .checked=${this._allDay}
              @change=${(e: Event) => (this._allDay = (e.target as HTMLInputElement).checked)}
            ></ha-switch>
          </ha-formfield>
        </div>
        <div class="row">
          <ha-textfield
            type="date"
            label="Date"
            .value=${this._date}
            @input=${(e: Event) => (this._date = (e.target as HTMLInputElement).value)}
          ></ha-textfield>
        </div>
        ${this._allDay
          ? ''
          : html`<div class="row times">
              <ha-textfield
                type="time"
                label="Start"
                .value=${this._start}
                @input=${(e: Event) => (this._start = (e.target as HTMLInputElement).value)}
              ></ha-textfield>
              <ha-textfield
                type="time"
                label="End"
                .value=${this._end}
                @input=${(e: Event) => (this._end = (e.target as HTMLInputElement).value)}
              ></ha-textfield>
            </div>`}
        <mwc-button slot="secondaryAction" dialogAction="close">Cancel</mwc-button>
        <mwc-button slot="primaryAction" .disabled=${this._title.trim() === ''} @click=${this._save}>
          Add
        </mwc-button>
      </ha-dialog>
    `;
  }

  /** Create the event via the calendar service, then close and notify the card. */
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
