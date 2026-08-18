import { LitElement, html } from 'lit';
import { state } from 'lit/decorators.js';
import { classMap } from 'lit/directives/class-map.js';
import { DateTime } from 'luxon';
import type { HomeAssistant } from 'custom-card-helpers';
import type {
  CalendarConfig,
  CalendarEventInput,
  CardConfig,
  DayColumn,
  HourlyForecast,
  WeekEvent,
} from '@/types';
import {
  autoScrollStartIndex,
  buildDayColumns,
  computeWeekStart,
  dayCountFor,
  formatWeekLabel,
  normalizeEvent,
  weekDays,
} from '@/week';
import { buildForecastMap, forecastForEvent, weatherIcon } from '@/weather';
import { styles } from '@/card.styles';

const CREATE_EVENT = 1;

type ForecastSlot = { condition: string; temperature: number };

export class CalendarWeekViewCard extends LitElement {
  static styles = styles;

  @state() private _config!: CardConfig;
  @state() private _columns: DayColumn[] = [];
  @state() private _weekOffset = 0;
  @state() private _hiddenCalendars = new Set<string>();
  @state() private _forecast = new Map<string, ForecastSlot>();
  @state() private _error = '';
  @state() private _detailsEvent: WeekEvent | null = null;

  private _hass?: HomeAssistant;
  private _loading = false;
  private _timer?: number;
  private _weatherUnsub?: () => void;
  private _weatherPending = false;

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
    const first = !this._hass;
    this._hass = hass;
    if (first && this._config) void this._fetchAndBuild();
  }

  get hass(): HomeAssistant {
    return this._hass as HomeAssistant;
  }

  connectedCallback(): void {
    super.connectedCallback();
    if (this._config && this._hass) void this._fetchAndBuild();
  }

  disconnectedCallback(): void {
    super.disconnectedCallback();
    if (this._timer) window.clearTimeout(this._timer);
    this._weatherUnsub?.();
    this._weatherUnsub = undefined;
  }

  private _now(): DateTime {
    return DateTime.now().setZone(this._hass?.config?.time_zone ?? 'local');
  }

  /** Fetch events for the shown week, normalize, split into day columns. */
  private async _fetchAndBuild(): Promise<void> {
    if (!this._hass || !this._config || this._loading) return;
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
            const raw = (await this._hass!.callApi('GET', url)) as CalendarEventInput[];
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
      let finalEvents = events;
      if (cfg.combineSimilarEvents) {
        const seen = new Set<string>();
        finalEvents = events.filter((e) => {
          if (seen.has(e.key)) return false;
          seen.add(e.key);
          return true;
        });
      }
      this._columns = buildDayColumns({ days, now: this._now(), events: finalEvents });
      if (cfg.weather) void this._subscribeWeather();
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

  /** Subscribe once to hourly forecasts; the feed is now-relative, not week-relative. */
  private async _subscribeWeather(): Promise<void> {
    if (!this._config.weather || this._weatherUnsub || this._weatherPending) return;
    this._weatherPending = true;
    try {
      this._weatherUnsub = await this._hass!.connection.subscribeMessage<{ forecast?: HourlyForecast[] }>(
        (msg) => {
          this._forecast = buildForecastMap(msg.forecast ?? []);
        },
        { type: 'weather/subscribe_forecast', forecast_type: 'hourly', entity_id: this._config.weather.entity },
      );
    } catch (e) {
      this._error = `Weather: ${(e as Error).message}`;
    } finally {
      this._weatherPending = false;
    }
  }

  /** Configured calendars that support event creation, honoring the allowlist. */
  private _writableCalendars(): CalendarConfig[] {
    const allow = this._config.addEventCalendars;
    return this._config.calendars.filter((c) => {
      const st = this._hass?.states[c.entity];
      const writable = !!st && (Number(st.attributes.supported_features ?? 0) & CREATE_EVENT) !== 0;
      return writable && (!allow || allow.includes(c.entity));
    });
  }

  private _shiftWeek(offset: number): void {
    this._weekOffset = offset === 0 ? 0 : this._weekOffset + offset;
    void this._fetchAndBuild();
  }

  private _toggleCalendar(entity: string): void {
    if (this._config.legendToggle === false) return;
    const next = new Set(this._hiddenCalendars);
    if (next.has(entity)) next.delete(entity);
    else next.add(entity);
    this._hiddenCalendars = next;
    void this._fetchAndBuild();
  }

  private _openAdd(): void {
    const dlg = this.renderRoot.querySelector('calendar-week-view-add-dialog') as
      | (HTMLElement & { show: () => void })
      | null;
    dlg?.show();
  }

  /** After each render, scroll the week strip so today leads the visible window. */
  protected updated(): void {
    const strip = this.renderRoot.querySelector<HTMLElement>('.week');
    if (!strip) return;
    const todayIndex = this._columns.findIndex((c) => c.isToday);
    const visible = this._config.visibleDays ?? 3;
    const startIndex = this._weekOffset === 0 ? autoScrollStartIndex(todayIndex, this._columns.length, visible) : 0;
    const target = strip.children[startIndex] as HTMLElement | undefined;
    if (target) strip.scrollLeft = target.offsetLeft - strip.offsetLeft;
  }

  render() {
    if (!this._config) return html``;
    const cfg = this._config;
    const styleParts = [`--cwv-visible:${cfg.visibleDays ?? 3}`];
    if (cfg.height) styleParts.push(`--cwv-day-h:${cfg.height}`);
    return html`
      <ha-card
        class=${classMap({ nobackground: !!cfg.noCardBackground, compact: !!cfg.compact })}
        style=${styleParts.join(';')}
      >
        <div class="cwv">
          ${this._error ? html`<ha-alert alert-type="error">${this._error}</ha-alert>` : ''}
          ${cfg.title ? html`<div class="card-title">${cfg.title}</div>` : ''}
          <div class="topbar">${this._renderNav()} ${this._renderLegend()}</div>
          <div class="week">${this._columns.map((col) => this._renderDay(col))}</div>
        </div>
        ${cfg.addEvents && this._writableCalendars().length > 0
          ? html`
              <button class="fab" aria-label="Add event" @click=${this._openAdd}>
                <ha-icon icon="mdi:plus"></ha-icon>
              </button>
              <calendar-week-view-add-dialog
                .hass=${this._hass}
                .calendars=${this._writableCalendars()}
                .defaultDate=${(this._columns.find((c) => c.isToday) ?? this._columns[0])?.date ?? this._now()}
                @cwv-created=${() => this._fetchAndBuild()}
              ></calendar-week-view-add-dialog>
            `
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
                >${c.name ?? c.entity}</span
              >
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
    const cfg = this._config;
    const fmt = cfg.timeFormat ?? 'HH:mm';
    const wx = cfg.weather ? forecastForEvent(e, this._now(), this._forecast) : null;
    const round = cfg.weather?.roundTemperature ?? true;
    return html`
      <div class="ev" style="--c:${e.color}" @click=${() => (this._detailsEvent = e)}>
        <span class="time">
          ${e.start.toFormat(fmt)} – ${e.end.toFormat(fmt)}
          ${wx
            ? html`<span class="wx">
                <ha-icon icon=${weatherIcon(wx.condition)}></ha-icon>
                ${cfg.weather?.showTemperature === false
                  ? ''
                  : html`${round ? Math.round(wx.temperature) : wx.temperature}°`}
              </span>`
            : ''}
        </span>
        <span class="title">${e.summary}</span>
      </div>
    `;
  }

  private _renderDetails() {
    const e = this._detailsEvent;
    if (!e) return html``;
    const when = e.allDay
      ? e.start.toFormat('cccc d LLLL')
      : `${e.start.toFormat('cccc d LLLL, HH:mm')} – ${e.end.toFormat('HH:mm')}`;
    return html`
      <ha-dialog open @closed=${() => (this._detailsEvent = null)} .heading=${e.summary}>
        <div class="details">
          <div class="muted">${e.calendarName}</div>
          <div>${when}</div>
          ${e.location ? html`<div>${e.location}</div>` : ''}
          ${e.description ? html`<div>${e.description}</div>` : ''}
        </div>
      </ha-dialog>
    `;
  }
}
