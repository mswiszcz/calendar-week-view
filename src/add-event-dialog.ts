import { LitElement, css, html } from 'lit';
import { property, state } from 'lit/decorators.js';
import { DateTime } from 'luxon';
import type { HomeAssistant } from 'custom-card-helpers';
import type { CalendarConfig, RecurrenceScope, WeekEvent } from '@/types';

type Mode = 'add' | 'edit';

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
    .cal-fixed {
      display: flex;
      align-items: center;
      gap: 8px;
      font-size: 14px;
      color: var(--secondary-text-color);
    }
    .cal-fixed .dot {
      width: 10px;
      height: 10px;
      border-radius: 50%;
      background: var(--c, var(--primary-color));
    }
    .scope-label {
      font-size: 12px;
      font-weight: 600;
      letter-spacing: 0.04em;
      text-transform: uppercase;
      color: var(--secondary-text-color);
    }
  `;

  @property({ attribute: false }) hass!: HomeAssistant;
  @property({ attribute: false }) calendars: CalendarConfig[] = [];
  @property({ attribute: false }) defaultDate: DateTime = DateTime.now();

  @state() private _open = false;
  @state() private _mode: Mode = 'add';
  @state() private _title = '';
  @state() private _entity = '';
  @state() private _calendarName = '';
  @state() private _allDay = true;
  @state() private _date = '';
  @state() private _start = '09:00';
  @state() private _end = '10:00';
  @state() private _error = '';
  @state() private _recurring = false;
  @state() private _scope: RecurrenceScope = 'this';
  @state() private _rrule: string | null = null;
  @state() private _uid = '';
  @state() private _recurrenceId: string | null = null;

  /** Open in add mode, seeding the first writable calendar and the default date. */
  show(): void {
    this._mode = 'add';
    this._entity = this.calendars[0]?.entity ?? '';
    this._calendarName = this.calendars[0]?.name ?? this._entity;
    this._date = this.defaultDate.toISODate() ?? '';
    this._title = '';
    this._allDay = true;
    this._start = '09:00';
    this._end = '10:00';
    this._recurring = false;
    this._error = '';
    this._open = true;
  }

  /** Open in edit mode, prefilled from an existing event. */
  edit(e: WeekEvent): void {
    this._mode = 'edit';
    this._entity = e.calendarEntity;
    this._calendarName = e.calendarName;
    this._title = e.summary;
    this._allDay = e.allDay;
    this._date = e.originalStart.toISODate() ?? '';
    this._start = e.originalStart.toFormat('HH:mm');
    this._end = e.originalEnd.toFormat('HH:mm');
    this._recurring = e.recurring;
    this._scope = 'this';
    this._rrule = e.rrule;
    this._uid = e.uid ?? '';
    this._recurrenceId = e.recurrenceId;
    this._error = '';
    this._open = true;
  }

  render() {
    if (!this._open) return html``;
    const heading = this._mode === 'edit' ? 'Edit event' : 'Add event';
    return html`
      <ha-dialog open .heading=${heading} @closed=${() => (this._open = false)}>
        ${this._error ? html`<ha-alert alert-type="error">${this._error}</ha-alert>` : ''}
        <div class="row">
          <ha-textfield
            label="Title"
            .value=${this._title}
            @input=${(e: Event) => (this._title = (e.target as HTMLInputElement).value)}
          ></ha-textfield>
        </div>
        ${this._mode === 'edit' ? this._renderFixedCalendar() : this._renderCalendarSelect()}
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
        ${
          this._allDay
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
              </div>`
        }
        ${this._mode === 'edit' && this._recurring ? this._renderScope() : ''}
        <mwc-button slot="secondaryAction" dialogAction="close">Cancel</mwc-button>
        <mwc-button slot="primaryAction" .disabled=${this._title.trim() === ''} @click=${this._save}>
          ${this._mode === 'edit' ? 'Save' : 'Add'}
        </mwc-button>
      </ha-dialog>
    `;
  }

  private _renderCalendarSelect() {
    return html`
      <div class="row">
        <ha-select
          label="Calendar"
          fixedMenuPosition
          naturalMenuWidth
          .value=${this._entity}
          @selected=${(e: CustomEvent) => (this._entity = (e.target as HTMLSelectElement).value)}
          @closed=${(e: Event) => e.stopPropagation()}
        >
          ${this.calendars.map((c) => html`<mwc-list-item value=${c.entity}>${c.name ?? c.entity}</mwc-list-item>`)}
        </ha-select>
      </div>
    `;
  }

  private _renderFixedCalendar() {
    return html`<div class="row cal-fixed"><span class="dot"></span>${this._calendarName}</div>`;
  }

  private _renderScope() {
    return html`
      <div class="row">
        <span class="scope-label">Apply changes to</span>
        <ha-select
          fixedMenuPosition
          naturalMenuWidth
          .value=${this._scope}
          @selected=${(e: CustomEvent) => (this._scope = (e.target as HTMLSelectElement).value as RecurrenceScope)}
          @closed=${(e: Event) => e.stopPropagation()}
        >
          <mwc-list-item value="this">This event</mwc-list-item>
          <mwc-list-item value="future">This &amp; following events</mwc-list-item>
          <mwc-list-item value="all">All events</mwc-list-item>
        </ha-select>
      </div>
    `;
  }

  private async _save(): Promise<void> {
    try {
      if (this._mode === 'edit') await this._update();
      else await this._create();
      this._open = false;
      this.dispatchEvent(new CustomEvent('cwv-saved', { bubbles: true, composed: true }));
    } catch (e) {
      const verb = this._mode === 'edit' ? 'update' : 'create';
      this._error = `Could not ${verb} event: ${(e as Error).message}`;
    }
  }

  /** Create a new event via the calendar service. */
  private async _create(): Promise<void> {
    const data: Record<string, string> = { summary: this._title.trim() };
    if (this._allDay) {
      data.start_date = this._date;
      data.end_date = DateTime.fromISO(this._date).plus({ days: 1 }).toISODate() ?? '';
    } else {
      data.start_date_time = DateTime.fromISO(`${this._date}T${this._start}`).toISO() ?? '';
      data.end_date_time = DateTime.fromISO(`${this._date}T${this._end}`).toISO() ?? '';
    }
    await this.hass.callService('calendar', 'create_event', data, { entity_id: this._entity });
  }

  /** Update an existing event via the HA websocket, honoring the recurring scope. */
  private async _update(): Promise<void> {
    const zone = this.hass.config?.time_zone ?? 'local';
    const event: Record<string, string> = { summary: this._title.trim() };
    if (this._allDay) {
      event.dtstart = this._date;
      event.dtend = DateTime.fromISO(this._date, { zone }).plus({ days: 1 }).toISODate() ?? '';
    } else {
      event.dtstart = DateTime.fromISO(`${this._date}T${this._start}`, { zone }).toISO() ?? '';
      event.dtend = DateTime.fromISO(`${this._date}T${this._end}`, { zone }).toISO() ?? '';
    }
    if (this._rrule && this._scope !== 'this') event.rrule = this._rrule;

    const msg: {
      type: string;
      entity_id: string;
      uid: string;
      event: Record<string, string>;
      recurrence_id?: string;
      recurrence_range?: string;
    } = { type: 'calendar/event/update', entity_id: this._entity, uid: this._uid, event };
    if (this._recurring && this._recurrenceId && this._scope !== 'all') {
      msg.recurrence_id = this._recurrenceId;
      if (this._scope === 'future') msg.recurrence_range = 'THISANDFUTURE';
    }
    await this.hass.connection.sendMessagePromise(msg);
  }
}
