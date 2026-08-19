import { LitElement, html } from 'lit';
import { state } from 'lit/decorators.js';
import { classMap } from 'lit/directives/class-map.js';
import { repeat } from 'lit/directives/repeat.js';
import { DateTime } from 'luxon';
import type { HomeAssistant } from 'custom-card-helpers';
import type {
  CalendarConfig,
  CalendarEventInput,
  CardConfig,
  DayColumn,
  HourlyForecast,
  RecurrenceScope,
  WeekEvent,
} from '@/types';
import {
  buildDayColumns,
  CalendarFeature,
  computeWeekStart,
  dayCountFor,
  formatCountdown,
  normalizeEvent,
  pickUpcoming,
  supportsFeature,
  todayRelation,
  windowDays,
} from '@/week';
import { buildForecastMap, forecastForEvent, weatherIcon } from '@/weather';
import { styles } from '@/card.styles';

/** Maps `CardConfig.colors` keys to the CSS token each overrides on the card element. */
const COLOR_TOKENS: Record<string, string> = {
  accent: '--primary-color',
  today: '--today-tint',
  dayBackground: '--neutral-tile',
  cardBackground: '--card-background-color',
  text: '--primary-text-color',
  secondaryText: '--secondary-text-color',
};

/** Weeks of off-screen runway kept on each side of the viewport for seamless paging. */
const BUFFER_WEEKS = 1;
/** Total weeks of day columns rendered at once (viewport week plus buffers). */
const WINDOW_WEEKS = 1 + BUFFER_WEEKS * 2;

type ForecastSlot = { condition: string; temperature: number };

export class CalendarWeekViewCard extends LitElement {
  static styles = styles;

  @state() private _config!: CardConfig;
  @state() private _columns: DayColumn[] = [];
  @state() private _windowOffset = -BUFFER_WEEKS;
  @state() private _hiddenCalendars = new Set<string>();
  @state() private _forecast = new Map<string, ForecastSlot>();
  @state() private _error = '';
  @state() private _weatherError = '';
  @state() private _detailsEvent: WeekEvent | null = null;
  @state() private _confirmingDelete = false;
  @state() private _deleteError = '';
  @state() private _tick = 0;
  @state() private _upcoming: WeekEvent | null = null;
  @state() private _todayVisible = true;
  @state() private _todayDir: -1 | 0 | 1 = 0;

  private _hass?: HomeAssistant;
  private _loading = false;
  private _refetchQueued = false;
  private _scrollToToday = true;
  private _jumping = false;
  private _scrollTimer?: number;
  private _clockTimer?: number;
  private _anim?: number;
  private _animSafety?: number;
  private _animTarget = 0;
  private _timer?: number;
  private _weatherUnsub?: () => void;
  private _weatherPending = false;

  static getStubConfig(): Partial<CardConfig> {
    return {
      type: 'custom:calendar-week-view',
      calendars: [],
      weekStartsOn: 'monday',
      visibleDays: 3,
    };
  }

  static getConfigElement(): HTMLElement {
    return document.createElement('calendar-week-view-editor');
  }

  setConfig(config: CardConfig): void {
    if (!config.calendars || config.calendars.length === 0) {
      throw new Error('calendar-week-view: at least one calendar is required');
    }
    this._config = { weekStartsOn: 'monday', visibleDays: 3, updateInterval: 60, ...config };
    this._hiddenCalendars = new Set((config.calendars ?? []).filter((c) => c.initiallyHidden).map((c) => c.entity));
  }

  getCardSize(): number {
    return 8;
  }

  set hass(hass: HomeAssistant) {
    const first = !this._hass;
    this._hass = hass;
    if (first && this._config) {
      this._scheduleClock();
      void this._fetchAndBuild();
    }
  }

  get hass(): HomeAssistant {
    return this._hass as HomeAssistant;
  }

  connectedCallback(): void {
    super.connectedCallback();
    if (this._config && this._hass) {
      this._scheduleClock();
      void this._fetchAndBuild();
    }
  }

  disconnectedCallback(): void {
    super.disconnectedCallback();
    if (this._timer) window.clearTimeout(this._timer);
    if (this._scrollTimer) window.clearTimeout(this._scrollTimer);
    if (this._clockTimer) window.clearTimeout(this._clockTimer);
    if (this._animSafety) window.clearTimeout(this._animSafety);
    if (this._anim != null) window.cancelAnimationFrame(this._anim);
    this._anim = undefined;
    this._animSafety = undefined;
    this._weatherUnsub?.();
    this._weatherUnsub = undefined;
  }

  /** Tick the header clock on the next natural boundary — per second only if the format shows seconds. */
  private _scheduleClock(): void {
    if (this._clockTimer) window.clearTimeout(this._clockTimer);
    if (!this._hass || this._config?.showClock === false) return;
    const showsSeconds = /[sS]/.test(this._config?.clockFormat ?? 'HH:mm');
    const now = this._now();
    const ms = showsSeconds ? 1000 - now.millisecond : (60 - now.second) * 1000 - now.millisecond;
    this._clockTimer = window.setTimeout(() => {
      this._tick++;
      this._scheduleClock();
    }, Math.max(250, ms));
  }

  private _now(): DateTime {
    return DateTime.now().setZone(this._hass?.config?.time_zone ?? 'local');
  }

  /** Fetch and normalize events for one date range across all visible calendars. */
  private async _fetchRange(start: DateTime, end: DateTime): Promise<{ events: WeekEvent[]; errors: string[] }> {
    const cfg = this._config;
    const zone = this._hass!.config?.time_zone ?? 'local';
    const events: WeekEvent[] = [];
    const errors: string[] = [];
    await Promise.all(
      cfg.calendars.map(async (cal) => {
        if (this._hiddenCalendars.has(cal.entity)) return;
        const filter = cal.filter ? new RegExp(cal.filter) : null;
        try {
          const url =
            `calendars/${cal.entity}?start=${encodeURIComponent(start.toISO() ?? '')}` +
            `&end=${encodeURIComponent(end.toISO() ?? '')}`;
          const raw = (await this._hass!.callApi('GET', url)) as CalendarEventInput[];
          for (const item of raw) {
            if (filter && filter.test(item.summary ?? '')) continue;
            events.push(normalizeEvent(item, cal, cfg.combineSimilarEvents ?? false, zone));
          }
        } catch (e) {
          errors.push(`${cal.name ?? cal.entity}: ${(e as Error).message}`);
        }
      }),
    );
    return { events, errors };
  }

  private _dedupe(events: WeekEvent[]): WeekEvent[] {
    if (!this._config.combineSimilarEvents) return events;
    const seen = new Set<string>();
    return events.filter((e) => {
      if (seen.has(e.key)) return false;
      seen.add(e.key);
      return true;
    });
  }

  /** Fetch events across the whole carousel window, normalize, split into day columns. */
  private async _fetchAndBuild(): Promise<void> {
    if (!this._hass || !this._config) return;
    if (this._loading) {
      this._refetchQueued = true;
      return;
    }
    this._loading = true;
    try {
      const cfg = this._config;
      const firstWeek = computeWeekStart(this._now(), cfg.weekStartsOn ?? 'monday', this._windowOffset);
      const count = dayCountFor(cfg.hideWeekend ?? false);
      const days = windowDays(firstWeek, WINDOW_WEEKS, count);
      const start = days[0];
      const end = days[days.length - 1].plus({ days: 1 });
      const { events, errors } = await this._fetchRange(start, end);
      if (!this.isConnected) return;
      this._error = errors.join('\n');
      const finalEvents = this._dedupe(events);
      this._columns = buildDayColumns({ days, now: this._now(), events: finalEvents });
      this._refreshUpcoming(finalEvents);
      if (cfg.weather) void this._subscribeWeather();
    } finally {
      this._loading = false;
      if (this.isConnected) {
        if (this._refetchQueued) {
          this._refetchQueued = false;
          void this._fetchAndBuild();
        } else {
          this._scheduleRefresh();
        }
      }
    }
  }

  private _scheduleRefresh(): void {
    if (this._timer) window.clearTimeout(this._timer);
    const seconds = this._config.updateInterval ?? 60;
    this._timer = window.setTimeout(() => void this._fetchAndBuild(), seconds * 1000);
  }

  /**
   * Refresh the header's "upcoming event". The header is anchored to now, not to
   * the scroll position, so when the window already covers today we reuse its
   * events; otherwise we fetch a small now-relative agenda so the value stays
   * correct even while the strip is scrolled weeks away.
   */
  private _refreshUpcoming(windowEvents: WeekEvent[]): void {
    if (this._config.showClock === false) return;
    const now = this._now();
    if (this._columns.some((c) => c.isToday)) {
      this._upcoming = pickUpcoming(now, windowEvents);
      return;
    }
    void (async () => {
      const start = now.startOf('day');
      const { events } = await this._fetchRange(start, start.plus({ days: 14 }));
      if (!this.isConnected) return;
      this._upcoming = pickUpcoming(now, this._dedupe(events));
    })();
  }

  /** Subscribe once to hourly forecasts; the feed is now-relative, not week-relative. */
  private async _subscribeWeather(): Promise<void> {
    if (!this._config.weather || this._weatherUnsub || this._weatherPending) return;
    this._weatherPending = true;
    try {
      const zone = this._hass!.config?.time_zone ?? 'local';
      this._weatherUnsub = await this._hass!.connection.subscribeMessage<{
        forecast?: HourlyForecast[];
      }>(
        (msg) => {
          this._forecast = buildForecastMap(msg.forecast ?? [], zone);
        },
        {
          type: 'weather/subscribe_forecast',
          forecast_type: 'hourly',
          entity_id: this._config.weather.entity,
        },
      );
    } catch (e) {
      this._weatherError = `Weather: ${(e as Error).message}`;
    } finally {
      this._weatherPending = false;
    }
  }

  /** Configured calendars that support event creation, honoring the allowlist. */
  private _writableCalendars(): CalendarConfig[] {
    const allow = this._config.addEventCalendars;
    return this._config.calendars.filter((c) => {
      const writable = supportsFeature(this._hass?.states[c.entity], CalendarFeature.CREATE);
      return writable && (!allow || allow.includes(c.entity));
    });
  }

  private _canMutate(e: WeekEvent, bit: number): boolean {
    return !!e.uid && supportsFeature(this._hass?.states[e.calendarEntity], bit);
  }

  private _strip(): HTMLElement | null {
    return this.renderRoot.querySelector<HTMLElement>('.week');
  }

  /** Left of each child relative to the strip's content origin (scroll-independent). */
  private _childLeft(strip: HTMLElement, i: number): number {
    const child = strip.children[i] as HTMLElement | undefined;
    if (!child) return 0;
    return child.getBoundingClientRect().left - strip.getBoundingClientRect().left + strip.scrollLeft;
  }

  /** Index of the first day column whose right edge is still visible. */
  private _leftmostIndex(strip: HTMLElement): number {
    for (let i = 0; i < strip.children.length; i++) {
      const child = strip.children[i] as HTMLElement;
      if (this._childLeft(strip, i) + child.offsetWidth > strip.scrollLeft + 1) return i;
    }
    return 0;
  }

  /** Index of the last day column whose left edge is still within the viewport. */
  private _rightmostIndex(strip: HTMLElement): number {
    const edge = strip.scrollLeft + strip.clientWidth;
    let last = 0;
    for (let i = 0; i < strip.children.length; i++) {
      if (this._childLeft(strip, i) < edge - 1) last = i;
      else break;
    }
    return last;
  }

  /** Recompute whether today sits within the visible day range, and which way it lies. */
  private _updateTodayVisibility(): void {
    const strip = this._strip();
    if (!strip || this._columns.length === 0) return;
    const left = this._columns[this._leftmostIndex(strip)]?.date;
    const right = this._columns[this._rightmostIndex(strip)]?.date;
    if (!left || !right) return;
    const rel = todayRelation(this._now(), left, right);
    if ((rel === 0) !== this._todayVisible) this._todayVisible = rel === 0;
    if (rel !== this._todayDir) this._todayDir = rel;
  }

  private _reducedMotion(): boolean {
    return window.matchMedia?.('(prefers-reduced-motion: reduce)').matches ?? false;
  }

  private _endAnim(target?: number): void {
    if (this._anim != null) window.cancelAnimationFrame(this._anim);
    if (this._animSafety) window.clearTimeout(this._animSafety);
    this._anim = undefined;
    this._animSafety = undefined;
    const s = this._strip();
    if (s && target != null) s.scrollLeft = target;
    this._updateTodayVisibility();
  }

  /**
   * Ease the strip to an absolute scroll position with a self-driven animation.
   * The loop reads `_animTarget` every frame, so a click landing mid-animation
   * just retargets it — paging is never blocked waiting for the motion to end.
   * A timeout backstop lands the target even where rAF is throttled (background
   * tab, some webviews), so paging and "today" stay reliable.
   */
  private _animateTo(strip: HTMLElement, target: number): void {
    const max = Math.max(0, strip.scrollWidth - strip.clientWidth);
    this._animTarget = Math.max(0, Math.min(max, target));
    if (this._reducedMotion()) {
      this._endAnim(this._animTarget);
      return;
    }
    if (this._animSafety) window.clearTimeout(this._animSafety);
    this._animSafety = window.setTimeout(() => this._endAnim(this._animTarget), 700);
    if (this._anim != null) return;
    const step = (): void => {
      const s = this._strip();
      if (!s) {
        this._anim = undefined;
        return;
      }
      const dx = this._animTarget - s.scrollLeft;
      if (Math.abs(dx) < 1) {
        s.scrollLeft = this._animTarget;
        this._endAnim();
        return;
      }
      s.scrollLeft += dx * 0.22;
      this._anim = window.requestAnimationFrame(step);
    };
    this._anim = window.requestAnimationFrame(step);
  }

  /** Page the strip by one viewport; already-rendered buffer days scroll into view. */
  private _carousel(dir: 1 | -1): void {
    const strip = this._strip();
    if (!strip) return;
    const base = this._anim != null ? this._animTarget : strip.scrollLeft;
    this._animateTo(strip, base + dir * strip.clientWidth);
  }

  /** Jump to today: scroll it to the left edge if loaded, otherwise recenter the window on it. */
  private _goToday(): void {
    const strip = this._strip();
    const idx = this._columns.findIndex((c) => c.isToday);
    if (strip && idx >= 0) {
      this._animateTo(strip, this._childLeft(strip, idx));
      return;
    }
    this._jumping = true;
    this._windowOffset = -BUFFER_WEEKS;
    this._scrollToToday = true;
    void this._fetchAndBuild();
  }

  /** Format a DateTime with the configured locale applied, if any. */
  private _fmt(dt: DateTime, fmt: string): string {
    const loc = this._config.locale;
    return (loc ? dt.setLocale(loc) : dt).toFormat(fmt);
  }

  /** Recenter the window only once scrolling settles, so an active page animation is never cut short. */
  private _onScroll(): void {
    if (this._scrollTimer) clearTimeout(this._scrollTimer);
    this._scrollTimer = window.setTimeout(() => void this._afterScroll(), 120);
  }

  private async _afterScroll(): Promise<void> {
    const strip = this._strip();
    if (!strip || this._columns.length === 0 || this._loading || this._jumping) return;
    this._updateTodayVisibility();
    const idx = this._leftmostIndex(strip);
    const count = dayCountFor(this._config.hideWeekend ?? false);
    if (idx < count) await this._recenter(-1, strip, idx);
    else if (idx >= (WINDOW_WEEKS - 1) * count) await this._recenter(1, strip, idx);
  }

  /**
   * Slide the rendered window one week and pin the anchor day to its current
   * screen position, so the swap of the off-screen buffer week is invisible.
   */
  private async _recenter(dir: 1 | -1, strip: HTMLElement, idx: number): Promise<void> {
    const anchorDate = this._columns[idx].date.toISODate() ?? '';
    const viewportX = this._childLeft(strip, idx) - strip.scrollLeft;
    this._windowOffset += dir;
    await this._fetchAndBuild();
    await this.updateComplete;
    const after = this._strip();
    const i = this._columns.findIndex((c) => c.date.toISODate() === anchorDate);
    if (after && i >= 0) after.scrollLeft = this._childLeft(after, i) - viewportX;
  }

  private _toggleCalendar(entity: string): void {
    if (this._config.legendToggle === false) return;
    const next = new Set(this._hiddenCalendars);
    if (next.has(entity)) next.delete(entity);
    else next.add(entity);
    this._hiddenCalendars = next;
    void this._fetchAndBuild();
  }

  private _dialog(): (HTMLElement & { show: () => void; edit: (e: WeekEvent) => void }) | null {
    return this.renderRoot.querySelector('calendar-week-view-add-dialog') as
      | (HTMLElement & { show: () => void; edit: (e: WeekEvent) => void })
      | null;
  }

  private _openAdd(): void {
    this._dialog()?.show();
  }

  private _openEdit(e: WeekEvent): void {
    this._closeDetails();
    this._dialog()?.edit(e);
  }

  private _openDetails(e: WeekEvent): void {
    this._detailsEvent = e;
    this._confirmingDelete = false;
    this._deleteError = '';
  }

  private _closeDetails(): void {
    this._detailsEvent = null;
    this._confirmingDelete = false;
    this._deleteError = '';
  }

  /** Delete an event via the HA websocket, scoping recurring instances per the user's choice. */
  private async _deleteEvent(e: WeekEvent, scope: RecurrenceScope): Promise<void> {
    if (!e.uid) return;
    const msg: {
      type: string;
      entity_id: string;
      uid: string;
      recurrence_id?: string;
      recurrence_range?: string;
    } = {
      type: 'calendar/event/delete',
      entity_id: e.calendarEntity,
      uid: e.uid,
    };
    if (e.recurring && e.recurrenceId && scope !== 'all') {
      msg.recurrence_id = e.recurrenceId;
      if (scope === 'future') msg.recurrence_range = 'THISANDFUTURE';
    }
    try {
      await this._hass!.connection.sendMessagePromise(msg);
      this._closeDetails();
      void this._fetchAndBuild();
    } catch (err) {
      this._deleteError = `Could not delete event: ${(err as Error).message}`;
    }
  }

  /**
   * After the initial load (or a Today reset), land the strip with today at the
   * left edge. Waits for the render that actually contains today: setting
   * `_windowOffset` renders once with the old (today-less) columns before the
   * refetch resolves, and acting on that stale frame would mis-land the jump.
   */
  protected updated(): void {
    if (!this._scrollToToday) return;
    const strip = this._strip();
    if (!strip || this._columns.length === 0) return;
    const idx = this._columns.findIndex((c) => c.isToday);
    if (idx < 0) return;
    strip.scrollLeft = this._childLeft(strip, idx);
    this._scrollToToday = false;
    this._jumping = false;
    this._updateTodayVisibility();
  }

  render() {
    if (!this._config) return html``;
    const cfg = this._config;
    const styleParts = [`--cwv-visible:${cfg.visibleDays ?? 3}`];
    if (cfg.height) styleParts.push(`--cwv-min-h:${cfg.height}`);
    for (const [key, token] of Object.entries(COLOR_TOKENS)) {
      const value = cfg.colors?.[key as keyof typeof cfg.colors];
      if (value) styleParts.push(`${token}:${value}`);
    }
    return html`
      <ha-card
        class=${classMap({ nobackground: !!cfg.noCardBackground, compact: !!cfg.compact })}
        style=${styleParts.join(';')}
      >
        <div class="cwv">
          ${this._error ? html`<ha-alert alert-type="error">${this._error}</ha-alert>` : ''}
          ${this._weatherError ? html`<ha-alert alert-type="warning">${this._weatherError}</ha-alert>` : ''}
          ${cfg.title ? html`<div class="card-title">${cfg.title}</div>` : ''}
          <div class="topbar">${this._renderStatus()} ${this._renderLegend()}</div>
          <div class="carousel">
            ${
              cfg.showNavigation === false
                ? ''
                : html`<button class="car-arrow left" aria-label="Previous days" @click=${() => this._carousel(-1)}>
                    <ha-icon icon="mdi:chevron-left"></ha-icon>
                  </button>`
            }
            <div class="week" @scroll=${this._onScroll}>
              ${repeat(
                this._columns,
                (col) => col.date.toISODate() ?? '',
                (col) => this._renderDay(col),
              )}
            </div>
            ${
              cfg.showNavigation === false
                ? ''
                : html`<button class="car-arrow right" aria-label="Next days" @click=${() => this._carousel(1)}>
                    <ha-icon icon="mdi:chevron-right"></ha-icon>
                  </button>`
            }
          </div>
        </div>
        ${
          cfg.addEvents && this._writableCalendars().length > 0
            ? html`
                <button class="fab" aria-label="Add event" @click=${this._openAdd}>
                  <ha-icon icon="mdi:plus"></ha-icon>
                </button>
              `
            : ''
        }
        <calendar-week-view-add-dialog
          .hass=${this._hass}
          .calendars=${this._writableCalendars()}
          .defaultDate=${(this._columns.find((c) => c.isToday) ?? this._columns[0])?.date ?? this._now()}
          @cwv-saved=${() => this._fetchAndBuild()}
        ></calendar-week-view-add-dialog>
        ${this._renderDetails()}
      </ha-card>
    `;
  }

  /** Top-left status cluster: return-to-today button, live clock, date, and the next event. */
  private _renderStatus() {
    const cfg = this._config;
    if (cfg.showClock === false) return html``;
    const now = this._now();
    return html`
      <div class="status">
        ${this._renderReturn()}
        <div class="clock">${this._fmt(now, cfg.clockFormat ?? 'HH:mm')}</div>
        <div class="statusmeta">
          <div class="sdate">${this._fmt(now, cfg.headerDateFormat ?? 'cccc, d LLLL')}</div>
          ${this._renderUpcoming(now)}
        </div>
      </div>
    `;
  }

  /** Return-to-today glyph, pointing the way back; shown only when today is off-screen. */
  private _renderReturn() {
    const cfg = this._config;
    if (cfg.showNavigation === false || this._todayVisible) return html``;
    const icon = this._todayDir < 0 ? 'mdi:calendar-arrow-left' : 'mdi:calendar-arrow-right';
    const label = `Back to ${cfg.texts?.today ?? 'today'}`;
    return html`
      <button class="return-btn" aria-label=${label} title=${label} @click=${() => this._goToday()}>
        <ha-icon icon=${icon}></ha-icon>
      </button>
    `;
  }

  private _renderUpcoming(now: DateTime) {
    const e = this._upcoming;
    if (!e) return html``;
    return html`
      <button class="upnext" style="--c:${e.color}" title=${e.summary} @click=${() => this._openDetails(e)}>
        <span class="up-dot"></span>
        <span class="up-name">${e.summary}</span>
        <span class="up-when">${formatCountdown(now, e)}</span>
      </button>
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
            <span class="dmeta">${this._fmt(col.date, this._config.dateFormat ?? 'yyyy · LLLL · cccc')}</span>
            <span class="dnum">${col.date.day}</span>
          </div>
        </div>
        ${
          col.allDayEvents.length
            ? html`<div class="allday">${col.allDayEvents.map((e) => this._renderPill(e))}</div>`
            : ''
        }
        <div class="events">
          ${
            col.timedEvents.length
              ? col.timedEvents.map((e) => this._renderEvent(e))
              : html`<div class="empty">${this._config.texts?.noEvents ?? 'Nothing planned'}</div>`
          }
        </div>
      </div>
    `;
  }

  private _renderPill(e: WeekEvent) {
    return html`
      <div
        class=${classMap({ pill: true, contL: e.continuesLeft, contR: e.continuesRight })}
        style="--c:${e.color}"
        @click=${() => this._openDetails(e)}
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
      <div class="ev" style="--c:${e.color}" @click=${() => this._openDetails(e)}>
        <span class="time">
          ${this._fmt(e.start, fmt)} – ${this._fmt(e.end, fmt)}
          ${
            wx
              ? html`<span class="wx">
                  <ha-icon icon=${weatherIcon(wx.condition)}></ha-icon>
                  ${
                    cfg.weather?.showTemperature === false
                      ? ''
                      : html`${round ? Math.round(wx.temperature) : wx.temperature}°`
                  }
                </span>`
              : ''
          }
        </span>
        <span class="title">${e.summary}</span>
      </div>
    `;
  }

  private _renderDetails() {
    const e = this._detailsEvent;
    if (!e) return html``;
    const dateLine = this._fmt(e.start, 'cccc d LLLL');
    const timeLine = e.allDay ? 'All day' : `${this._fmt(e.start, 'HH:mm')} – ${this._fmt(e.end, 'HH:mm')}`;
    const canDelete = this._canMutate(e, CalendarFeature.DELETE);
    const canEdit = this._canMutate(e, CalendarFeature.UPDATE);
    return html`
      <ha-dialog open @closed=${() => this._closeDetails()} .heading=${e.summary}>
        <div class="details" style="--c:${e.color}">
          <div class="det-head">
            <span class="det-dot"></span>
            <span class="det-cal">${e.calendarName}</span>
            ${e.recurring ? html`<span class="det-recur"><ha-icon icon="mdi:repeat"></ha-icon>Repeats</span>` : ''}
          </div>
          <div class="det-when">
            <ha-icon icon=${e.allDay ? 'mdi:calendar-blank' : 'mdi:clock-time-four-outline'}></ha-icon>
            <span class="when-text">
              <span class="when-main">${dateLine}</span>
              <span class="when-sub">${timeLine}</span>
            </span>
          </div>
          ${
            e.location
              ? html`<div class="det-meta">
                  <ha-icon icon="mdi:map-marker-outline"></ha-icon><span>${e.location}</span>
                </div>`
              : ''
          }
          ${e.description ? html`<div class="det-desc">${e.description}</div>` : ''}
          ${this._deleteError ? html`<ha-alert alert-type="error">${this._deleteError}</ha-alert>` : ''}
          ${
            this._confirmingDelete
              ? html`<div class="confirm-note">
                  ${
                    e.recurring
                      ? 'This event repeats — choose which occurrences to delete.'
                      : 'Delete this event? This cannot be undone.'
                  }
                </div>`
              : ''
          }
        </div>
        ${this._confirmingDelete ? this._renderDeleteConfirm(e) : this._renderDetailActions(e, canEdit, canDelete)}
      </ha-dialog>
    `;
  }

  private _renderDetailActions(e: WeekEvent, canEdit: boolean, canDelete: boolean) {
    return html`
      <mwc-button slot="secondaryAction" dialogAction="close">Close</mwc-button>
      ${
        canEdit
          ? html`<mwc-button slot="secondaryAction" @click=${() => this._openEdit(e)}>
              <ha-icon icon="mdi:pencil"></ha-icon>&nbsp;Edit
            </mwc-button>`
          : ''
      }
      ${
        canDelete
          ? html`<mwc-button slot="primaryAction" class="danger" @click=${() => (this._confirmingDelete = true)}>
              <ha-icon icon="mdi:trash-can-outline"></ha-icon>&nbsp;Delete
            </mwc-button>`
          : ''
      }
    `;
  }

  private _renderDeleteConfirm(e: WeekEvent) {
    if (e.recurring) {
      return html`
        <mwc-button slot="secondaryAction" @click=${() => (this._confirmingDelete = false)}>Cancel</mwc-button>
        <mwc-button slot="primaryAction" @click=${() => this._deleteEvent(e, 'this')}>This event</mwc-button>
        <mwc-button slot="primaryAction" @click=${() => this._deleteEvent(e, 'future')}
          >This &amp; following</mwc-button
        >
        <mwc-button slot="primaryAction" class="danger" @click=${() => this._deleteEvent(e, 'all')}
          >All events</mwc-button
        >
      `;
    }
    return html`
      <mwc-button slot="secondaryAction" @click=${() => (this._confirmingDelete = false)}>Cancel</mwc-button>
      <mwc-button slot="primaryAction" class="danger" @click=${() => this._deleteEvent(e, 'all')}>
        Delete event
      </mwc-button>
    `;
  }
}
