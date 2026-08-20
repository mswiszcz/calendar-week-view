import { LitElement, css, html } from 'lit';
import { property, state } from 'lit/decorators.js';
import { DateTime } from 'luxon';
import type { HomeAssistant } from 'custom-card-helpers';
import type { CalendarConfig, RecurrenceScope, WeekEvent } from '@/types';
import {
  buildCreateData,
  buildUpdateEvent,
  draftError,
  type EventDraft,
  formatDateLabel,
  formatWhenLine,
  nudgedEnd,
} from '@/event-payload';

type Mode = 'add' | 'edit';
type PickKind = 'date' | 'time';

const LOCAL_DT = "yyyy-LL-dd'T'HH:mm";

export class CalendarWeekViewAddDialog extends LitElement {
  static styles = css`
    * {
      box-sizing: border-box;
    }
    :host {
      --neutral-tile: color-mix(in srgb, var(--primary-text-color, #1a1c1e) 5%, var(--card-background-color, #fff));
      --hover-tint: color-mix(in srgb, var(--primary-text-color, #1a1c1e) 8%, transparent);
    }
    ha-dialog {
      --mdc-dialog-min-width: 500px;
      --mdc-dialog-max-width: 560px;
      --ha-dialog-border-radius: 18px;
      --mdc-dialog-container-shape: 18px;
      --dialog-content-padding: 0;
    }

    /* The compose card materializes like the details popup — fade, a slight
       scale-up, and a blur that resolves. */
    .gate {
      border-radius: 18px;
      overflow: hidden;
      animation: gate-in 0.44s cubic-bezier(0.16, 1, 0.3, 1) both;
    }
    @keyframes gate-in {
      from {
        opacity: 0;
        transform: scale(0.965);
        filter: blur(7px);
      }
    }
    @media (prefers-reduced-motion: reduce) {
      .gate {
        animation: none;
      }
    }

    /* slim colour band — the calendar's colour signs the compose surface */
    .band {
      padding: 18px 20px 20px;
      color: #fff;
      text-shadow: 0 1px 0 rgba(0, 0, 0, 0.2);
      background: linear-gradient(
        160deg,
        color-mix(in srgb, var(--c, var(--primary-color)) 90%, #0b1a12),
        color-mix(in srgb, var(--c, var(--primary-color)) 64%, #0a1220)
      );
      transition: background 0.4s ease;
      display: flex;
      flex-direction: column;
      gap: 8px;
    }
    .band-title {
      width: 100%;
      font: inherit;
      font-size: 21px;
      font-weight: 700;
      letter-spacing: -0.02em;
      color: #fff;
      background: transparent;
      border: none;
      border-bottom: 1.5px dashed rgba(255, 255, 255, 0.35);
      padding: 2px 2px 6px;
      caret-color: #fff;
      transition: border-color 0.15s ease;
    }
    .band-title::placeholder {
      color: rgba(255, 255, 255, 0.55);
      font-weight: 600;
    }
    .band-title:focus {
      outline: none;
      border-bottom-color: #fff;
      border-bottom-style: solid;
    }
    .band-title.missing {
      border-bottom-color: #ffb4ab;
      border-bottom-style: solid;
    }
    .band-hint {
      font-size: 11.5px;
      font-weight: 600;
      color: #ffd7d2;
      margin-top: -2px;
    }
    .band-when {
      display: flex;
      align-items: center;
      gap: 8px;
      font-size: 12.5px;
      font-weight: 600;
      color: rgba(255, 255, 255, 0.86);
      font-variant-numeric: tabular-nums;
    }
    .band-when > ha-icon {
      --mdc-icon-size: 16px;
      opacity: 0.9;
      flex: none;
    }
    .band-rep {
      margin-left: auto;
      display: inline-flex;
      align-items: center;
      gap: 4px;
      font-size: 10px;
      font-weight: 700;
      letter-spacing: 0.05em;
      text-transform: uppercase;
      color: rgba(255, 255, 255, 0.92);
      background: rgba(255, 255, 255, 0.16);
      padding: 3px 8px;
      border-radius: 999px;
    }
    .band-rep ha-icon {
      --mdc-icon-size: 13px;
    }

    .body {
      padding: 14px 20px 6px;
      display: flex;
      flex-direction: column;
    }
    .body ha-alert {
      display: block;
      margin-bottom: 10px;
    }
    .flabel {
      font-size: 10.5px;
      font-weight: 800;
      letter-spacing: 0.09em;
      text-transform: uppercase;
      color: var(--secondary-text-color);
      margin: 14px 0 8px;
      display: block;
    }
    .flabel.first {
      margin-top: 4px;
    }
    .flabel .opt {
      font-weight: 600;
      letter-spacing: 0.02em;
      text-transform: none;
      color: var(--disabled-text-color);
      margin-left: 6px;
    }

    /* neutral-tile fields — the gate's material, not Material underlines */
    .tin {
      width: 100%;
      font: inherit;
      font-size: 14.5px;
      font-weight: 600;
      color: var(--primary-text-color);
      background: var(--neutral-tile);
      border: 1px solid var(--divider-color);
      border-radius: 12px;
      padding: 11px 13px;
      transition:
        border-color 0.15s ease,
        background 0.15s ease;
    }
    .tin::placeholder {
      color: var(--disabled-text-color);
      font-weight: 500;
    }
    .tin:focus {
      outline: none;
      border-color: color-mix(in srgb, var(--primary-color) 60%, var(--divider-color));
      background: var(--card-background-color);
    }
    textarea.tin {
      resize: vertical;
      min-height: 64px;
      line-height: 1.45;
      font-weight: 500;
      font-family: inherit;
    }
    .spaced {
      margin-bottom: 10px;
    }

    /* date / time picker tile — a luxon-formatted label (matching the header)
       over a transparent native input, so the display format is ours while the
       picker stays native. */
    .dt-field {
      display: flex;
      flex-direction: column;
      gap: 6px;
      margin-bottom: 10px;
    }
    .dt-cap {
      font-size: 11px;
      font-weight: 800;
      letter-spacing: 0.06em;
      text-transform: uppercase;
      color: var(--secondary-text-color);
    }
    .when-row {
      display: flex;
      gap: 10px;
    }
    .when-row .pick.date {
      flex: 2 1 0;
    }
    .when-row .pick.time {
      flex: 1 1 0;
    }
    .pick {
      position: relative;
      display: flex;
      align-items: center;
      gap: 9px;
      width: 100%;
      min-width: 0;
      background: var(--neutral-tile);
      border: 1px solid var(--divider-color);
      border-radius: 12px;
      padding: 11px 13px;
      cursor: pointer;
      overflow: hidden;
      transition:
        border-color 0.15s ease,
        background 0.15s ease;
    }
    .pick:focus-within {
      border-color: color-mix(in srgb, var(--primary-color) 60%, var(--divider-color));
      background: var(--card-background-color);
    }
    .pick-ic {
      --mdc-icon-size: 18px;
      color: var(--secondary-text-color);
      flex: none;
    }
    .pick-val {
      min-width: 0;
      font-size: 14.5px;
      font-weight: 600;
      color: var(--primary-text-color);
      font-variant-numeric: tabular-nums;
      white-space: nowrap;
      overflow: hidden;
      text-overflow: ellipsis;
    }
    .pick-native {
      position: absolute;
      inset: 0;
      width: 100%;
      height: 100%;
      opacity: 0;
      border: none;
      margin: 0;
      padding: 0;
      cursor: pointer;
      font: inherit;
    }

    /* segmented (all day / timed, recurrence scope) */
    .seg {
      display: inline-flex;
      width: 100%;
      background: var(--neutral-tile);
      border: 1px solid var(--divider-color);
      border-radius: 12px;
      padding: 3px;
      gap: 3px;
    }
    .seg button {
      flex: 1;
      font: inherit;
      font-size: 13px;
      font-weight: 700;
      color: var(--secondary-text-color);
      background: transparent;
      border: none;
      border-radius: 9px;
      padding: 9px 8px;
      cursor: pointer;
      display: inline-flex;
      align-items: center;
      justify-content: center;
      gap: 6px;
      transition:
        color 0.15s ease,
        background 0.15s ease;
    }
    .seg button ha-icon {
      --mdc-icon-size: 16px;
    }
    /* Selected segment reads as selected in both themes: an accent tint plus an
       accent ring, rather than a card-coloured fill that goes darker-than-track
       on a dark theme and looks sunken. */
    .seg button.on {
      color: var(--primary-text-color);
      background: color-mix(in srgb, var(--primary-color) 18%, var(--card-background-color));
      box-shadow: inset 0 0 0 1px color-mix(in srgb, var(--primary-color) 40%, transparent);
    }
    .seg button.on ha-icon {
      color: var(--primary-color);
    }

    /* calendar colour chips (add) / fixed calendar (edit) */
    .cal-chips {
      display: flex;
      flex-wrap: wrap;
      gap: 8px;
    }
    .cchip {
      display: inline-flex;
      align-items: center;
      gap: 8px;
      padding: 9px 13px;
      border-radius: 999px;
      border: 1px solid var(--divider-color);
      background: var(--neutral-tile);
      cursor: pointer;
      font: inherit;
      font-size: 12.5px;
      font-weight: 600;
      color: var(--primary-text-color);
      transition:
        border-color 0.15s ease,
        background 0.15s ease;
    }
    .cchip::before {
      content: '';
      width: 10px;
      height: 10px;
      border-radius: 50%;
      background: var(--cc, var(--primary-color));
      flex: none;
    }
    .cchip:hover {
      background: var(--hover-tint);
    }
    .cchip.on {
      border-color: color-mix(in srgb, var(--cc, var(--primary-color)) 55%, var(--divider-color));
      background: color-mix(in srgb, var(--cc, var(--primary-color)) 15%, var(--card-background-color));
    }
    .cal-fixed {
      display: inline-flex;
      align-items: center;
      gap: 9px;
      font-size: 14px;
      font-weight: 600;
      color: var(--primary-text-color);
    }
    .cal-fixed .dot {
      width: 11px;
      height: 11px;
      border-radius: 50%;
      background: var(--c, var(--primary-color));
    }
    .cal-fixed .lock {
      margin-left: 2px;
      color: var(--secondary-text-color);
    }
    .cal-fixed .lock ha-icon {
      --mdc-icon-size: 15px;
      display: block;
    }

    .scope-note {
      font-size: 12px;
      color: var(--secondary-text-color);
      margin: 14px 0 8px;
      display: flex;
      align-items: center;
      gap: 7px;
    }
    .scope-note ha-icon {
      --mdc-icon-size: 15px;
      color: var(--c, var(--primary-color));
    }

    /* action bar — the same language as the details popup */
    .acts {
      display: flex;
      align-items: center;
      gap: 6px;
      padding: 14px 16px;
      margin-top: 8px;
      border-top: 1px solid var(--divider-color);
    }
    .spacer {
      margin-left: auto;
    }
    .btn {
      display: inline-flex;
      align-items: center;
      gap: 6px;
      font: inherit;
      font-size: 13.5px;
      font-weight: 700;
      letter-spacing: 0.01em;
      padding: 9px 14px;
      border-radius: 11px;
      border: none;
      background: transparent;
      color: var(--primary-color);
      cursor: pointer;
      transition:
        background 0.14s ease,
        filter 0.14s ease;
    }
    .btn ha-icon {
      --mdc-icon-size: 18px;
    }
    .btn:hover {
      background: color-mix(in srgb, var(--primary-color) 12%, transparent);
    }
    .btn.ghost {
      color: var(--secondary-text-color);
    }
    .btn.ghost:hover {
      background: var(--hover-tint);
      color: var(--primary-text-color);
    }
    .btn.primary {
      background: var(--primary-color);
      color: var(--text-primary-color, #fff);
      padding: 10px 20px;
      box-shadow: 0 3px 12px color-mix(in srgb, var(--primary-color) 40%, transparent);
    }
    .btn.primary:hover {
      filter: brightness(1.06);
    }
    .btn:disabled {
      opacity: 0.5;
      cursor: not-allowed;
      box-shadow: none;
    }

    :is(.tin, .btn, .seg button, .cchip, .band-title, .pick-native):focus-visible {
      outline: 2px solid color-mix(in srgb, var(--primary-color) 65%, transparent);
      outline-offset: 2px;
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
  @state() private _color = '';
  @state() private _allDay = true;
  @state() private _date = '';
  @state() private _endDate = '';
  @state() private _start = '';
  @state() private _end = '';
  @state() private _submitting = false;
  @state() private _location = '';
  @state() private _description = '';
  @state() private _error = '';
  @state() private _nameMissing = false;
  @state() private _recurring = false;
  @state() private _scope: RecurrenceScope = 'this';
  @state() private _rrule: string | null = null;
  @state() private _uid = '';
  @state() private _recurrenceId: string | null = null;

  /** Open in add mode, seeding the first writable calendar and the default date. */
  show(): void {
    const cal = this.calendars[0];
    this._mode = 'add';
    this._entity = cal?.entity ?? '';
    this._calendarName = cal?.name ?? this._entity;
    this._color = cal?.color ?? '';
    this._date = this.defaultDate.toISODate() ?? '';
    this._endDate = this._date;
    this._start = this.defaultDate.set({ hour: 9, minute: 0 }).toFormat(LOCAL_DT);
    this._end = this.defaultDate.set({ hour: 10, minute: 0 }).toFormat(LOCAL_DT);
    this._submitting = false;
    this._title = '';
    this._location = '';
    this._description = '';
    this._allDay = true;
    this._recurring = false;
    this._error = '';
    this._nameMissing = false;
    this._open = true;
  }

  /** Open in edit mode, prefilled from an existing event. */
  edit(e: WeekEvent): void {
    this._mode = 'edit';
    this._entity = e.calendarEntity;
    this._calendarName = e.calendarName;
    this._color = e.color;
    this._title = e.summary;
    this._location = e.location ?? '';
    this._description = e.description ?? '';
    this._allDay = e.allDay;
    this._date = e.originalStart.toISODate() ?? '';
    // HA all-day ends are exclusive; the inclusive last day the user edits is one day back.
    this._endDate = e.allDay
      ? (e.originalEnd.minus({ days: 1 }).toISODate() ?? this._date)
      : (e.originalEnd.toISODate() ?? this._date);
    this._start = e.originalStart.toFormat(LOCAL_DT);
    this._end = e.originalEnd.toFormat(LOCAL_DT);
    this._recurring = e.recurring;
    // Per-occurrence scope needs a recurrence_id; without one, only a whole-series edit is possible.
    this._scope = e.recurrenceId ? 'this' : 'all';
    this._rrule = e.rrule;
    this._uid = e.uid ?? '';
    this._recurrenceId = e.recurrenceId;
    this._submitting = false;
    this._error = '';
    this._nameMissing = false;
    this._open = true;
  }

  render() {
    if (!this._open) return html``;
    const heading = this._mode === 'edit' ? 'Edit event' : 'Add event';
    const showCal = this.calendars.length > 1;
    return html`
      <ha-dialog open hideActions aria-label=${heading} @opened=${this._onOpened} @closed=${() => (this._open = false)}>
        <div class="gate" style="--c:${this._color || 'var(--primary-color)'}">
          <div class="band">
            <input
              class=${this._nameMissing ? 'band-title missing' : 'band-title'}
              autofocus
              .value=${this._title}
              placeholder="Name this event"
              aria-label="Event name"
              @input=${this._onNameInput}
              @focus=${() => (this._nameMissing = false)}
              @blur=${this._onNameBlur}
            />
            ${this._nameMissing ? html`<span class="band-hint">Please name this event</span>` : ''}
            <div class="band-when">
              <ha-icon icon="mdi:calendar-clock-outline"></ha-icon>
              <span>${this._whenLine()}</span>
              ${
                this._mode === 'edit' && this._recurring
                  ? html`<span class="band-rep"><ha-icon icon="mdi:repeat"></ha-icon>Repeats</span>`
                  : ''
              }
            </div>
          </div>
          <div class="body">
            ${this._error ? html`<ha-alert alert-type="error">${this._error}</ha-alert>` : ''}
            ${showCal ? (this._mode === 'edit' ? this._renderFixedCalendar() : this._renderCalendarChips()) : ''}
            <span class="flabel ${showCal ? '' : 'first'}">When</span>
            ${this._renderWhen()}
            <span class="flabel">Where <span class="opt">optional</span></span>
            <input
              class="tin spaced"
              .value=${this._location}
              placeholder="Add a location"
              aria-label="Location"
              @input=${(e: Event) => (this._location = (e.target as HTMLInputElement).value)}
            />
            <span class="flabel">Notes <span class="opt">optional</span></span>
            <textarea
              class="tin"
              rows="2"
              .value=${this._description}
              placeholder="Add a description"
              aria-label="Description"
              @input=${(e: Event) => (this._description = (e.target as HTMLTextAreaElement).value)}
            ></textarea>
            ${this._mode === 'edit' && this._recurring && this._recurrenceId ? this._renderScope() : ''}
          </div>
          <div class="acts">
            <button class="btn ghost" @click=${() => (this._open = false)}>
              <ha-icon icon="mdi:close"></ha-icon>Cancel
            </button>
            <span class="spacer"></span>
            <button class="btn primary" ?disabled=${this._title.trim() === '' || this._submitting} @click=${this._save}>
              <ha-icon icon=${this._mode === 'edit' ? 'mdi:check' : 'mdi:plus'}></ha-icon>
              ${this._mode === 'edit' ? 'Save' : 'Add'}
            </button>
          </div>
        </div>
      </ha-dialog>
    `;
  }

  private _renderCalendarChips() {
    return html`
      <span class="flabel first">Calendar</span>
      <div class="cal-chips">
        ${this.calendars.map(
          (c) => html`
            <button
              class=${c.entity === this._entity ? 'cchip on' : 'cchip'}
              style="--cc:${c.color ?? 'var(--primary-color)'}"
              @click=${() => this._selectCalendar(c)}
            >
              ${c.name ?? c.entity}
            </button>
          `,
        )}
      </div>
    `;
  }

  private _renderFixedCalendar() {
    return html`
      <span class="flabel first">Calendar</span>
      <div class="cal-fixed">
        <span class="dot"></span>${this._calendarName}
        <span class="lock" title="A calendar can't change on edit"><ha-icon icon="mdi:lock-outline"></ha-icon></span>
      </div>
    `;
  }

  private _renderWhen() {
    const startDate = this._start.slice(0, 10);
    const startTime = this._start.slice(11, 16);
    const endDate = this._end.slice(0, 10);
    const endTime = this._end.slice(11, 16);
    return html`
      <div class="seg spaced">
        <button class=${this._allDay ? 'on' : ''} @click=${() => this._setAllDay(true)}>
          <ha-icon icon="mdi:calendar-blank-outline"></ha-icon>All day
        </button>
        <button class=${this._allDay ? '' : 'on'} @click=${() => this._setAllDay(false)}>
          <ha-icon icon="mdi:clock-outline"></ha-icon>Timed
        </button>
      </div>
      ${
        this._allDay
          ? html`
              <div class="dt-field">
                <span class="dt-cap">Starts</span>
                ${this._picker('date', this._date, formatDateLabel(this._date), 'Start date', (v) =>
                  this._setAllDayStart(v),
                )}
              </div>
              <div class="dt-field">
                <span class="dt-cap">Ends</span>
                ${this._picker(
                  'date',
                  this._endDate,
                  formatDateLabel(this._endDate),
                  'End date',
                  (v) => (this._endDate = v),
                )}
              </div>
            `
          : html`
              <div class="dt-field">
                <span class="dt-cap">Starts</span>
                <div class="when-row">
                  ${this._picker('date', startDate, formatDateLabel(startDate), 'Start date', (v) =>
                    this._setStartDate(v),
                  )}
                  ${this._picker('time', startTime, startTime, 'Start time', (v) => this._setStartTime(v))}
                </div>
              </div>
              <div class="dt-field">
                <span class="dt-cap">Ends</span>
                <div class="when-row">
                  ${this._picker('date', endDate, formatDateLabel(endDate), 'End date', (v) => this._setEndDate(v))}
                  ${this._picker('time', endTime, endTime, 'End time', (v) => this._setEndTime(v))}
                </div>
              </div>
            `
      }
    `;
  }

  /** A formatted-label tile over a transparent native picker (see `.pick` CSS). */
  private _picker(kind: PickKind, value: string, label: string, ariaLabel: string, onChange: (v: string) => void) {
    const icon = kind === 'date' ? 'mdi:calendar-outline' : 'mdi:clock-outline';
    return html`
      <div class="pick ${kind}">
        <ha-icon class="pick-ic" icon=${icon}></ha-icon>
        <span class="pick-val" aria-hidden="true">${label}</span>
        <input
          class="pick-native"
          type=${kind}
          .value=${value}
          aria-label=${ariaLabel}
          @click=${this._showPicker}
          @input=${(e: Event) => onChange((e.target as HTMLInputElement).value)}
        />
      </div>
    `;
  }

  private _renderScope() {
    const opt = (v: RecurrenceScope, label: string) => html`
      <button class=${this._scope === v ? 'on' : ''} @click=${() => (this._scope = v)}>${label}</button>
    `;
    // No "All" for edits: this occurrence carries no master DTSTART, so a whole-series
    // update would reanchor the series to this occurrence's date. "This" and "Following"
    // both target via recurrence_id and are safe. (Delete keeps "All" — see the card.)
    return html`
      <div class="scope-note"><ha-icon icon="mdi:repeat"></ha-icon>This event repeats — apply changes to</div>
      <div class="seg">${opt('this', 'This')}${opt('future', 'Following')}</div>
    `;
  }

  /** Open the native picker on tap; falls back to plain focus where unsupported. */
  private _showPicker(e: Event): void {
    const el = e.currentTarget as HTMLInputElement & { showPicker?: () => void };
    try {
      el.showPicker?.();
    } catch {
      /* Some webviews reject showPicker(); focusing still opens the control. */
    }
  }

  /** Switch all-day/timed, carrying the dates across so the day never silently reverts. */
  private _setAllDay(allDay: boolean): void {
    if (allDay === this._allDay) return;
    this._allDay = allDay;
    this._error = '';
    if (allDay) {
      this._date = this._start.slice(0, 10) || this._date;
      this._endDate = this._end.slice(0, 10) || this._date;
      if (this._endDate < this._date) this._endDate = this._date;
    } else {
      const startTime = this._start.slice(11, 16) || '09:00';
      const endTime = this._end.slice(11, 16) || '10:00';
      this._start = `${this._date}T${startTime}`;
      // A multi-day all-day span's inclusive last day maps to the next day's midnight so
      // the final day stays covered; a single day keeps the plain start/end times.
      const rawEnd =
        this._endDate !== this._date
          ? `${DateTime.fromISO(this._endDate).plus({ days: 1 }).toISODate() ?? this._endDate}T00:00`
          : `${this._date}T${endTime}`;
      this._end = nudgedEnd(this._start, rawEnd, this._zone());
    }
  }

  /** Move the all-day start, dragging the end with it so it never lands before the start. */
  private _setAllDayStart(v: string): void {
    const singleDay = this._endDate === this._date;
    this._date = v;
    if (singleDay || this._endDate < v) this._endDate = v;
  }

  private _setStartDate(v: string): void {
    this._start = `${v}T${this._start.slice(11, 16)}`;
    this._nudgeEnd();
  }

  private _setStartTime(v: string): void {
    this._start = `${this._start.slice(0, 10)}T${v}`;
    this._nudgeEnd();
  }

  private _setEndDate(v: string): void {
    this._end = `${v}T${this._end.slice(11, 16)}`;
  }

  private _setEndTime(v: string): void {
    this._end = `${this._end.slice(0, 10)}T${v}`;
  }

  /** After a start edit, keep the end at least an hour past it. */
  private _nudgeEnd(): void {
    this._end = nudgedEnd(this._start, this._end, this._zone());
  }

  private _selectCalendar(c: CalendarConfig): void {
    this._entity = c.entity;
    this._calendarName = c.name ?? c.entity;
    this._color = c.color ?? '';
  }

  private _onNameInput(e: Event): void {
    this._title = (e.target as HTMLInputElement).value;
    if (this._title.trim()) this._nameMissing = false;
  }

  private _onNameBlur(): void {
    this._nameMissing = this._title.trim() === '';
  }

  /** Land the caret in the name field once the dialog has finished opening. */
  private _onOpened(): void {
    (this.renderRoot.querySelector('.band-title') as HTMLInputElement | null)?.focus();
  }

  private _zone(): string {
    return this.hass.config?.time_zone ?? 'local';
  }

  private _draft(): EventDraft {
    return {
      summary: this._title,
      entity: this._entity,
      allDay: this._allDay,
      date: this._date,
      endDate: this._endDate,
      start: this._start,
      end: this._end,
      location: this._location,
      description: this._description,
    };
  }

  private _whenLine(): string {
    return formatWhenLine(this._draft(), this._zone(), 'HH:mm');
  }

  private async _save(): Promise<void> {
    if (this._submitting) return;
    const draft = this._draft();
    const err = draftError(draft, this._zone());
    if (err) {
      this._error = err;
      this._nameMissing = this._title.trim() === '';
      return;
    }
    this._submitting = true;
    try {
      if (this._mode === 'edit') await this._update(draft);
      else await this._create(draft);
      this._open = false;
      this.dispatchEvent(new CustomEvent('cwv-saved', { bubbles: true, composed: true }));
    } catch (e) {
      const verb = this._mode === 'edit' ? 'update' : 'create';
      this._error = `Could not ${verb} event: ${(e as Error).message}`;
    } finally {
      this._submitting = false;
    }
  }

  /** Create a new event via the calendar service. */
  private async _create(draft: EventDraft): Promise<void> {
    await this.hass.callService('calendar', 'create_event', buildCreateData(draft, this._zone()), {
      entity_id: this._entity,
    });
  }

  /** Update an existing event via the HA websocket, honoring the recurring scope. */
  private async _update(draft: EventDraft): Promise<void> {
    const event = buildUpdateEvent(draft, this._zone());
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
