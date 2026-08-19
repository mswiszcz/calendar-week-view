import { LitElement, html } from 'lit';
import { state } from 'lit/decorators.js';
import { classMap } from 'lit/directives/class-map.js';
import { repeat } from 'lit/directives/repeat.js';
import { DateTime } from 'luxon';
import { handleAction } from 'custom-card-helpers';
import type { HomeAssistant } from 'custom-card-helpers';
import type {
  ButtonConfig,
  CalendarConfig,
  CalendarEventInput,
  CardConfig,
  DayColumn,
  HourlyForecast,
  RecurrenceScope,
  StackedEvent,
  WeekEvent,
} from '@/types';
import {
  buildDayColumns,
  CalendarFeature,
  clampScroll,
  computeWeekStart,
  dayCountFor,
  edgeIndex,
  formatCountdown,
  lastVisibleIndex,
  layoutDayEvents,
  lockedDays,
  normalizeEvent,
  pickUpcoming,
  stackDayEvents,
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

/** Pixel height of one hour row in calendar view. Must match `--cwv-hour-h`. */
const HOUR_H = 56;
/** Reserved height of the all-day band when any visible column has all-day events. */
const ALLDAY_H = 46;
/** Smallest rendered height for a timed block, so brief events stay tappable. */
const MIN_EVENT_H = 20;
/** Minimum block height in the expanded layout — a readable two lines, so the
 *  toggle visibly enlarges cramped/short events, not just overlapping ones. */
const EXPANDED_MIN_EVENT_H = 44;

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
  @state() private _expanded = false;

  private _hass?: HomeAssistant;
  private _resizeObs?: ResizeObserver;
  private _loading = false;
  private _refetchQueued = false;
  private _scrollToToday = true;
  private _jumping = false;
  private _jumpSmooth = false;
  private _scrollTimer?: number;
  private _clockTimer?: number;
  private _pageTargetCol?: number;
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

  /**
   * Sections-view sizing. Vertical agenda has no internal scroll, so let the grid
   * grow to the full-height day list (`rows: 'auto'`) instead of clamping it to a
   * fixed row count; other modes keep the default fixed-height cell.
   */
  getGridOptions(): { rows?: number | 'auto' } {
    return this._config && this._isVertical() ? { rows: 'auto' } : {};
  }

  set hass(hass: HomeAssistant) {
    const first = !this._hass;
    this._hass = hass;
    if (first && this._config) {
      this._scheduleTick();
      void this._fetchAndBuild();
    }
  }

  get hass(): HomeAssistant {
    return this._hass as HomeAssistant;
  }

  connectedCallback(): void {
    super.connectedCallback();
    if (this._config && this._hass) {
      this._scheduleTick();
      void this._fetchAndBuild();
    }
  }

  disconnectedCallback(): void {
    super.disconnectedCallback();
    if (this._timer) window.clearTimeout(this._timer);
    if (this._scrollTimer) window.clearTimeout(this._scrollTimer);
    if (this._clockTimer) window.clearTimeout(this._clockTimer);
    this._resizeObs?.disconnect();
    this._resizeObs = undefined;
    this._weatherUnsub?.();
    this._weatherUnsub = undefined;
  }

  /** Whether the header has a live element (clock or next-event) that needs periodic ticks. */
  private _headerLive(): boolean {
    return this._config?.showClock !== false || this._config?.showNextEvent !== false;
  }

  /**
   * Tick the header on the next natural boundary — driving both the clock and the
   * next-event countdown. Per second only when a visible clock shows seconds.
   */
  private _scheduleTick(): void {
    if (this._clockTimer) window.clearTimeout(this._clockTimer);
    if (!this._hass || !this._headerLive()) return;
    const showsSeconds = this._config?.showClock !== false && /[sS]/.test(this._config?.clockFormat ?? 'HH:mm');
    const now = this._now();
    const ms = showsSeconds ? 1000 - now.millisecond : (60 - now.second) * 1000 - now.millisecond;
    this._clockTimer = window.setTimeout(
      () => {
        this._tick++;
        this._scheduleTick();
      },
      Math.max(250, ms),
    );
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
      const now = this._now();
      const days = this._isStaticSpan()
        ? lockedDays(now, cfg.visibleDays ?? 3, cfg.hideWeekend ?? false)
        : windowDays(
            computeWeekStart(now, cfg.weekStartsOn ?? 'monday', this._windowOffset),
            WINDOW_WEEKS,
            dayCountFor(cfg.hideWeekend ?? false),
          );
      const start = days[0];
      const end = days[days.length - 1].plus({ days: 1 });
      const { events, errors } = await this._fetchRange(start, end);
      if (!this.isConnected) return;
      this._error = errors.join('\n');
      const finalEvents = this._dedupe(events);
      this._columns = buildDayColumns({ days, now, events: finalEvents });
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
    if (this._config.showNextEvent === false) return;
    const now = this._now();
    // The rendered window carries enough lookahead only in the seamless view; a
    // static span is just a few days, so fall through to the agenda fetch —
    // otherwise the next event past that span would never surface.
    if (!this._isStaticSpan() && this._columns.some((c) => c.isToday)) {
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

  /** Configured calendars that support event creation. */
  private _writableCalendars(): CalendarConfig[] {
    return this._config.calendars.filter((c) => supportsFeature(this._hass?.states[c.entity], CalendarFeature.CREATE));
  }

  private _canMutate(e: WeekEvent, bit: number): boolean {
    return !!e.uid && supportsFeature(this._hass?.states[e.calendarEntity], bit);
  }

  private _strip(): HTMLElement | null {
    return this.renderRoot.querySelector<HTMLElement>('.week');
  }

  /** The day columns in order, skipping the calendar-view hour gutter. */
  private _days(strip: HTMLElement): HTMLElement[] {
    return Array.from(strip.querySelectorAll<HTMLElement>(':scope > .day'));
  }

  /** Main-axis length the sticky hour gutter covers at the strip's leading edge (0 in agenda view). */
  private _lead(strip: HTMLElement): number {
    const gutter = strip.querySelector<HTMLElement>(':scope > .gutter');
    return gutter ? this._axis().size(gutter) : 0;
  }

  /** Main-axis offset of a day column from the strip's content origin (scroll-independent). */
  private _childOffset(strip: HTMLElement, i: number): number {
    const child = this._days(strip)[i];
    if (!child) return 0;
    const ax = this._axis();
    return ax.rectStart(child) - ax.rectStart(strip) + ax.scroll(strip);
  }

  /** Measured main-axis offsets of every day column, in order. */
  private _dayOffsets(strip: HTMLElement): number[] {
    return this._days(strip).map((_day, i) => this._childOffset(strip, i));
  }

  /** Index of the first day column still visible past the strip's leading edge. */
  private _firstVisibleIndex(strip: HTMLElement): number {
    const ax = this._axis();
    const sizes = this._days(strip).map((d) => ax.size(d));
    return edgeIndex(this._dayOffsets(strip), sizes, ax.scroll(strip) + this._lead(strip));
  }

  /** Index of the last day column whose leading edge is still within the viewport. */
  private _lastVisibleIndex(strip: HTMLElement): number {
    const ax = this._axis();
    return lastVisibleIndex(this._dayOffsets(strip), ax.scroll(strip) + ax.client(strip));
  }

  /** Recompute whether today sits within the visible day range, and which way it lies. */
  private _updateTodayVisibility(): void {
    const strip = this._strip();
    if (!strip || this._columns.length === 0) return;
    const left = this._columns[this._firstVisibleIndex(strip)]?.date;
    const right = this._columns[this._lastVisibleIndex(strip)]?.date;
    if (!left || !right) return;
    const rel = todayRelation(this._now(), left, right);
    if ((rel === 0) !== this._todayVisible) this._todayVisible = rel === 0;
    if (rel !== this._todayDir) this._todayDir = rel;
  }

  private _reducedMotion(): boolean {
    return window.matchMedia?.('(prefers-reduced-motion: reduce)').matches ?? false;
  }

  /**
   * Absolute scroll offset that lands day column `i` at the strip's leading edge,
   * past the calendar-view hour gutter, clamped to range. Axis-aware.
   */
  private _columnScroll(strip: HTMLElement, i: number): number {
    const ax = this._axis();
    const max = Math.max(0, ax.scrollSize(strip) - ax.client(strip));
    return clampScroll(this._childOffset(strip, i) - this._lead(strip), max);
  }

  /**
   * Page the strip by one viewport, landing on a whole day column, using the
   * browser's native smooth scroll (compositor-driven — no main-thread rAF, so
   * it stays fluid on tablet webviews). The pending target column is tracked so
   * a click mid-scroll advances one more page from there; the window recenter
   * runs only once scrolling settles (see `_afterScroll`), never mid-motion.
   */
  private _carousel(dir: 1 | -1): void {
    const strip = this._strip();
    if (!strip || this._columns.length === 0) return;
    const step = Math.max(1, Math.round(this._config.visibleDays ?? 3));
    const base = this._pageTargetCol ?? this._firstVisibleIndex(strip);
    const target = Math.max(0, Math.min(this._columns.length - 1, base + dir * step));
    this._pageTargetCol = target;
    this._axis().scrollTo(strip, this._columnScroll(strip, target), this._reducedMotion() ? 'auto' : 'smooth');
  }

  /** Jump to today: smooth-scroll it to the leading edge if loaded, otherwise reset the window and land it. */
  private _goToday(): void {
    this._pageTargetCol = undefined;
    const strip = this._strip();
    const idx = this._columns.findIndex((c) => c.isToday);
    if (strip && idx >= 0) {
      this._axis().scrollTo(strip, this._columnScroll(strip, idx), this._reducedMotion() ? 'auto' : 'smooth');
      return;
    }
    // Today is outside the loaded window: reset it and let updated() land today on
    // the first render that contains it — robust to a refetch already in flight
    // (a queued rebuild still triggers updated). Its smooth scroll there also
    // retargets any page animation still running, so it can't drag off today.
    this._jumping = true;
    this._jumpSmooth = true;
    this._scrollToToday = true;
    this._windowOffset = -BUFFER_WEEKS;
    void this._fetchAndBuild();
  }

  private _isCalendar(): boolean {
    return (this._config.viewMode ?? 'agenda') === 'calendar';
  }

  /** Vertical layout applies to agenda view only; calendar keeps its horizontal time-grid. */
  private _isVertical(): boolean {
    return (this._config.orientation ?? 'horizontal') === 'vertical' && !this._isCalendar();
  }

  private _isLocked(): boolean {
    return !!this._config.lockToday;
  }

  /**
   * A static span renders a fixed run of days from today with no seamless window:
   * lock-to-today by request, and vertical agenda because it grows to fit its
   * content rather than scrolling/paging a buffered window.
   */
  private _isStaticSpan(): boolean {
    return this._isLocked() || this._isVertical();
  }

  /** Paging arrows, return glyph, and the seamless window are active only for a scrolling window. */
  private _navEnabled(): boolean {
    return this._config.showNavigation !== false && !this._isStaticSpan();
  }

  /**
   * Reader/writer set for the strip's main scroll axis, so all scroll geometry
   * works for both the horizontal day strip and the vertical stacked layout.
   */
  private _axis() {
    const vert = this._isVertical();
    return {
      vert,
      scroll: (el: HTMLElement) => (vert ? el.scrollTop : el.scrollLeft),
      setScroll: (el: HTMLElement, n: number) => {
        if (vert) el.scrollTop = n;
        else el.scrollLeft = n;
      },
      scrollTo: (el: HTMLElement, n: number, behavior: ScrollBehavior) =>
        el.scrollTo(vert ? { top: n, behavior } : { left: n, behavior }),
      client: (el: HTMLElement) => (vert ? el.clientHeight : el.clientWidth),
      scrollSize: (el: HTMLElement) => (vert ? el.scrollHeight : el.scrollWidth),
      size: (el: HTMLElement) => (vert ? el.offsetHeight : el.offsetWidth),
      rectStart: (el: HTMLElement) => (vert ? el.getBoundingClientRect().top : el.getBoundingClientRect().left),
    };
  }

  /** Configured start hour, clamped to a valid 0–23 grid row. */
  private _startHour(): number {
    return Math.min(23, Math.max(0, Math.round(this._config.startHour ?? 8)));
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
    // A static span (locked, or vertical agenda) has no seamless window — never recenter.
    if (this._isStaticSpan()) return;
    this._pageTargetCol = undefined;
    this._updateTodayVisibility();
    const idx = this._firstVisibleIndex(strip);
    const count = dayCountFor(this._config.hideWeekend ?? false);
    if (idx < count) await this._recenter(-1, strip, idx);
    else if (idx >= (WINDOW_WEEKS - 1) * count) await this._recenter(1, strip, idx);
  }

  /**
   * Slide the rendered window one week and pin the anchor day to its current
   * screen position, so the swap of the off-screen buffer week is invisible.
   */
  private async _recenter(dir: 1 | -1, strip: HTMLElement, idx: number): Promise<void> {
    const ax = this._axis();
    const anchorDate = this._columns[idx].date.toISODate() ?? '';
    const viewportOffset = this._childOffset(strip, idx) - ax.scroll(strip);
    this._windowOffset += dir;
    await this._fetchAndBuild();
    await this.updateComplete;
    const after = this._strip();
    const i = this._columns.findIndex((c) => c.date.toISODate() === anchorDate);
    if (after && i >= 0) ax.setScroll(after, this._childOffset(after, i) - viewportOffset);
    // The rebuild remapped every column index; a page target captured against the
    // old window (a click during the refetch) is now stale — drop it so the next
    // click pages from the current leftmost.
    this._pageTargetCol = undefined;
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

  /** Fire a custom button's Home Assistant action (navigate, url, call-service, …). */
  private _runButton(btn: ButtonConfig): void {
    if (!this._hass || !btn.tap_action) return;
    handleAction(this, this._hass, { entity: '', tap_action: btn.tap_action }, 'tap');
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

  protected updated(): void {
    this._ensureResizeObserver();
    if (this._scrollToToday) this._landToday();
  }

  /**
   * Watch the strip so a deferred "land on today" fires once the card actually
   * has a size. HA can render a card while its container is hidden or zero-width
   * (lazy layout), where measuring would land the strip at 0 (far edge); the
   * observer retries the land when the real size arrives.
   */
  private _ensureResizeObserver(): void {
    if (this._resizeObs || typeof ResizeObserver === 'undefined') return;
    const strip = this._strip();
    if (!strip) return;
    this._resizeObs = new ResizeObserver(() => {
      this._updateTodayVisibility();
      if (this._scrollToToday) this._landToday();
    });
    this._resizeObs.observe(strip);
  }

  /**
   * Land the strip with today at the leading edge (left horizontally, top
   * vertically), plus the start hour in calendar view, on the first render that
   * contains it — the initial load (instant) or a Today reset (smooth, which also
   * retargets any page scroll still animating). No-op until the strip is laid
   * out, so the flag is consumed only after a correct, measurable landing.
   */
  private _landToday(): void {
    const strip = this._strip();
    if (!strip || this._columns.length === 0 || this._axis().client(strip) === 0) return;
    // Static span: it starts at today, so there is no window landing to wait for —
    // only the calendar grid needs its start-hour scroll.
    if (this._isStaticSpan()) {
      if (this._isCalendar()) strip.scrollTop = this._startHour() * HOUR_H;
      this._scrollToToday = false;
      return;
    }
    const idx = this._columns.findIndex((c) => c.isToday);
    if (idx < 0) return;
    const behavior: ScrollBehavior = this._jumpSmooth && !this._reducedMotion() ? 'smooth' : 'auto';
    this._axis().scrollTo(strip, this._columnScroll(strip, idx), behavior);
    if (this._isCalendar()) strip.scrollTop = this._startHour() * HOUR_H;
    this._scrollToToday = false;
    this._jumpSmooth = false;
    this._jumping = false;
    this._updateTodayVisibility();
  }

  render() {
    if (!this._config) return html``;
    const cfg = this._config;
    const calendar = this._isCalendar();
    const expanded = calendar && this._expanded;
    const hasAllDay = calendar && this._columns.some((c) => c.allDayEvents.length > 0);
    const stacks = expanded
      ? this._columns.map((c) => stackDayEvents(c.timedEvents, (EXPANDED_MIN_EVENT_H / HOUR_H) * 60))
      : null;
    const gridMin = stacks ? Math.max(1440, ...stacks.flatMap((s) => s.map((x) => x.topMin + x.heightMin))) : 1440;
    const styleParts = [
      `--cwv-visible:${cfg.visibleDays ?? 3}`,
      `--cwv-hour-h:${HOUR_H}px`,
      `--cwv-allday-h:${hasAllDay ? ALLDAY_H : 0}px`,
      `--cwv-grid-h:${(gridMin / 60) * HOUR_H}px`,
    ];
    if (cfg.height) styleParts.push(`--cwv-min-h:${cfg.height}`);
    for (const [key, token] of Object.entries(COLOR_TOKENS)) {
      const value = cfg.colors?.[key as keyof typeof cfg.colors];
      if (value) styleParts.push(`${token}:${value}`);
    }
    return html`
      <ha-card
        class=${classMap({
          nobackground: !!cfg.noCardBackground,
          compact: !!cfg.compact,
          nohighlight: cfg.highlightToday === false,
          notodayborder: cfg.todayBorder === false,
          notodaytext: cfg.todayText === false,
          vagenda: this._isVertical(),
        })}
        style=${styleParts.join(';')}
      >
        <div class="cwv">
          ${this._error ? html`<ha-alert alert-type="error">${this._error}</ha-alert>` : ''}
          ${this._weatherError ? html`<ha-alert alert-type="warning">${this._weatherError}</ha-alert>` : ''}
          ${cfg.title ? html`<div class="card-title">${cfg.title}</div>` : ''}
          <div class="topbar">
            ${this._renderStatus()}
            <div class="topbar-right">
              ${this._renderLegend()} ${calendar ? this._renderExpandToggle() : ''} ${this._renderHeaderButtons()}
            </div>
          </div>
          <div class=${classMap({ carousel: true, nonav: !this._navEnabled(), vert: this._isVertical() })}>
            ${this._renderArrow(-1)}
            <div class=${classMap({ week: true, cal: calendar, vert: this._isVertical() })} @scroll=${this._onScroll}>
              ${calendar ? this._renderGutter() : ''}
              ${repeat(
                this._columns,
                (col) => col.date.toISODate() ?? '',
                (col, i) => this._renderDay(col, calendar, stacks ? stacks[i] : undefined),
              )}
            </div>
            ${this._renderArrow(1)}
          </div>
        </div>
        ${this._renderFabRow()}
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

  /** A paging arrow, oriented to the layout axis (left/right horizontally, up/down vertically). */
  private _renderArrow(dir: 1 | -1) {
    if (!this._navEnabled()) return html``;
    const vert = this._isVertical();
    const prev = dir < 0;
    const cls = vert ? (prev ? 'up' : 'down') : prev ? 'left' : 'right';
    const icon = vert
      ? prev
        ? 'mdi:chevron-up'
        : 'mdi:chevron-down'
      : prev
        ? 'mdi:chevron-left'
        : 'mdi:chevron-right';
    return html`<button
      class="car-arrow ${cls}"
      aria-label=${prev ? 'Previous days' : 'Next days'}
      @click=${() => this._carousel(dir)}
    >
      <ha-icon icon=${icon}></ha-icon>
    </button>`;
  }

  /**
   * Top-left status cluster. The clock + date (`showClock`) and the next-event
   * chip (`showNextEvent`) are gated independently; a return glyph keeps the
   * header alive when both are off but today has scrolled away.
   */
  private _renderStatus() {
    const cfg = this._config;
    const now = this._now();
    const clock = cfg.showClock !== false;
    const nextEvent = cfg.showNextEvent !== false;
    const showReturn = this._navEnabled() && !this._todayVisible;
    const hasRow = showReturn || (nextEvent && !!this._upcoming);
    const row = hasRow
      ? html`<div class="statusrow">${this._renderReturn()}${nextEvent ? this._renderUpcoming(now) : html``}</div>`
      : html``;
    if (!clock) {
      return hasRow ? html`<div class="status status-compact">${row}</div>` : html``;
    }
    return html`
      <div class="status">
        <div class="clock">${this._fmt(now, cfg.clockFormat ?? 'HH:mm')}</div>
        <div class="statusmeta">
          <div class="sdate">${this._fmt(now, cfg.headerDateFormat ?? 'cccc, d LLLL')}</div>
          ${row}
        </div>
      </div>
    `;
  }

  /** Return-to-today glyph, pointing the way back; shown only when today is off-screen. */
  private _renderReturn() {
    const cfg = this._config;
    if (!this._navEnabled() || this._todayVisible) return html``;
    const vert = this._isVertical();
    const back = this._todayDir < 0;
    const icon = vert
      ? back
        ? 'mdi:arrow-up'
        : 'mdi:arrow-down'
      : back
        ? 'mdi:calendar-arrow-left'
        : 'mdi:calendar-arrow-right';
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

  /** Calendar-view control: expand overlapping events into a full-width stacked layout. */
  private _renderExpandToggle() {
    const label = this._expanded ? 'Collapse overlapping events' : 'Expand overlapping events';
    return html`
      <button
        class=${classMap({ 'expand-btn': true, on: this._expanded })}
        aria-label=${label}
        title=${label}
        aria-pressed=${this._expanded ? 'true' : 'false'}
        @click=${() => (this._expanded = !this._expanded)}
      >
        <ha-icon icon=${this._expanded ? 'mdi:arrow-collapse-vertical' : 'mdi:arrow-expand-vertical'}></ha-icon>
      </button>
    `;
  }

  /** Right-aligned custom header buttons: an icon with an optional label, each firing an HA action. */
  private _renderHeaderButtons() {
    const buttons = this._config.headerButtons ?? [];
    if (buttons.length === 0) return html``;
    return html`
      <div class="header-actions">
        ${buttons.map(
          (btn) => html`
            <button
              class=${classMap({ hbtn: true, labeled: !!btn.name })}
              style=${btn.color ? `--c:${btn.color}` : ''}
              aria-label=${btn.name ?? btn.icon}
              title=${btn.name ?? ''}
              @click=${() => this._runButton(btn)}
            >
              <ha-icon icon=${btn.icon}></ha-icon>
              ${btn.name ? html`<span class="hbtn-label">${btn.name}</span>` : ''}
            </button>
          `,
        )}
      </div>
    `;
  }

  /**
   * Bottom-right floating cluster: custom icon buttons in a row to the left of the
   * quick-add `+` (which stays rightmost). Rendered whenever there are floating
   * buttons or the quick-add is enabled, so custom buttons work without quick-add.
   */
  private _renderFabRow() {
    const floating = this._config.floatingButtons ?? [];
    const showAdd = !!this._config.addEvents && this._writableCalendars().length > 0;
    if (floating.length === 0 && !showAdd) return html``;
    return html`
      <div class="fab-row">
        ${floating.map(
          (btn) => html`
            <button
              class="fbtn"
              style=${btn.color ? `--c:${btn.color}` : ''}
              aria-label=${btn.name ?? btn.icon}
              title=${btn.name ?? ''}
              @click=${() => this._runButton(btn)}
            >
              <ha-icon icon=${btn.icon}></ha-icon>
            </button>
          `,
        )}
        ${
          showAdd
            ? html`
                <button class="fab" aria-label="Add event" @click=${this._openAdd}>
                  <ha-icon icon="mdi:plus"></ha-icon>
                </button>
              `
            : ''
        }
      </div>
    `;
  }

  private _renderDay(col: DayColumn, calendar = false, stack?: StackedEvent[]) {
    const allday = col.allDayEvents.length
      ? html`<div class="allday">${col.allDayEvents.map((e) => this._renderPill(e))}</div>`
      : '';
    if (calendar) {
      return html`
        <div class=${classMap({ day: true, cal: true, today: col.isToday, past: col.isPast })}>
          <div class="cal-head">
            <div class="cal-dayhead">
              <span class="cd-name">${this._fmt(col.date, 'ccc')}</span>
              <span class="cd-num">${col.date.day}</span>
            </div>
            ${allday}
          </div>
          ${this._renderGrid(col, stack)}
        </div>
      `;
    }
    return html`
      <div class=${classMap({ day: true, today: col.isToday, past: col.isPast })}>
        <div class="day-head">
          <div class="dstack">
            <span class="dmeta">${this._fmt(col.date, this._config.dateFormat ?? 'yyyy · LLLL · cccc')}</span>
            <span class="dnum">${col.date.day}</span>
          </div>
        </div>
        ${allday}
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

  /** The pinned hour axis for calendar view: a sticky corner above 24 hour labels. */
  private _renderGutter() {
    const use12 = /[ah]/.test(this._config.timeFormat ?? 'HH:mm');
    const fmt = use12 ? 'h a' : 'HH';
    const base = this._now().startOf('day');
    return html`
      <div class="gutter">
        <div class="gutter-corner"></div>
        <div class="gutter-hours">
          ${Array.from(
            { length: 24 },
            (_unused, h) =>
              html`<div class="hour" style="top:${h * HOUR_H}px">${this._fmt(base.plus({ hours: h }), fmt)}</div>`,
          )}
        </div>
      </div>
    `;
  }

  /**
   * Render a day's timed events. Normally overlaps split into side-by-side lanes;
   * when expanded (`stack` given) each event is full width and stacked so nothing
   * is clipped. A 1px inset on every block keeps consecutive events from merging.
   */
  private _renderGrid(col: DayColumn, stack?: StackedEvent[]) {
    const blocks = stack
      ? stack.map((s) => {
          const top = (s.topMin / 60) * HOUR_H + 1;
          const height = (s.heightMin / 60) * HOUR_H - 2;
          const style = `top:${top}px;height:${height}px;left:2px;right:2px;--tev-min-h:${height}px;--c:${s.event.color}`;
          return this._tevBlock(s.event, style, s.durationMin);
        })
      : layoutDayEvents(col.timedEvents).map((p) => {
          const top = (p.startMin / 60) * HOUR_H + 1;
          const height = Math.max(MIN_EVENT_H, ((p.endMin - p.startMin) / 60) * HOUR_H) - 2;
          const width = 100 / p.cols;
          const left = p.col * width;
          const style =
            `top:${top}px;height:${height}px;left:calc(${left}% + 2px);` +
            `width:calc(${width}% - 4px);--tev-min-h:${height}px;--c:${p.event.color}`;
          return this._tevBlock(p.event, style, p.endMin - p.startMin);
        });
    return html` <div class="grid">${blocks} ${col.isToday ? this._renderNow() : ''}</div> `;
  }

  /** One timed-event block: start–end time, title, optional weather; single-line when short. */
  private _tevBlock(e: WeekEvent, style: string, durationMin: number) {
    const cfg = this._config;
    const fmt = cfg.timeFormat ?? 'HH:mm';
    const wx = cfg.weather ? forecastForEvent(e, this._now(), this._forecast) : null;
    const round = cfg.weather?.roundTemperature ?? true;
    const short = durationMin <= 30;
    return html`
      <button
        class=${classMap({ tev: true, short })}
        style=${style}
        title=${e.summary}
        @click=${() => this._openDetails(e)}
      >
        <span class="tev-time">
          ${this._fmt(e.start, fmt)} – ${this._fmt(e.end, fmt)}
          ${
            wx
              ? html`<span class="tev-wx">
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
        <span class="tev-title">${e.summary}</span>
      </button>
    `;
  }

  /** The current-time line, drawn across today's grid. */
  private _renderNow() {
    const now = this._now();
    const top = ((now.hour * 60 + now.minute) / 60) * HOUR_H;
    return html`<div class="nowline" style="top:${top}px"><span class="now-dot"></span></div>`;
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
