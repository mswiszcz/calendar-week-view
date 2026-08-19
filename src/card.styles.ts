import { css } from 'lit';

export const styles = css`
  * {
    box-sizing: border-box;
  }
  /*
   * Derived tints are relative to the HA theme tokens (--primary-text-color over
   * --card-background-color), so they track whatever HA theme is active — light or
   * dark — without keying off prefers-color-scheme, which does not follow the HA theme.
   */
  :host {
    --cwv-min-h: 520px;
    --cwv-visible: 3;
    /* calendar view — hour row height (mirrored by HOUR_H in card.ts), gutter
       width, the fixed head/all-day band, and grid line / now-line tints */
    --cwv-hour-h: 56px;
    --cwv-header-h: 44px;
    --cwv-allday-h: 0px;
    --cwv-gutter-w: 52px;
    --cwv-grid-h: calc(24 * var(--cwv-hour-h));
    --cwv-line: color-mix(in srgb, var(--primary-text-color, #1a1c1e) 9%, transparent);
    --cwv-now: var(--error-color, #ea4335);
    --on-primary: var(--text-primary-color, #ffffff);
    --neutral-tile: color-mix(in srgb, var(--primary-text-color, #1a1c1e) 3%, var(--card-background-color, #ffffff));
    --hover-tint: color-mix(in srgb, var(--primary-text-color, #1a1c1e) 5%, transparent);
    --today-tint: color-mix(in srgb, var(--primary-color, #0aa2e6) 8%, var(--card-background-color, #ffffff));
  }

  /* Fill the dashboard space: the card stretches to its container's height in a
     panel view, and falls back to --cwv-min-h in masonry / sections layouts. */
  ha-card {
    position: relative;
    overflow: hidden;
    height: 100%;
    min-height: var(--cwv-min-h, 520px);
    display: flex;
    flex-direction: column;
  }
  ha-card.nobackground {
    background: none;
    box-shadow: none;
    border: none;
  }
  ha-card.compact {
    --cwv-min-h: 420px;
  }
  /* vertical agenda grows to its full content height instead of filling a fixed
     box; the dashboard scrolls, nothing inside the card does. Minimum height is
     dropped so a short list never leaves empty space below it. */
  ha-card.vagenda {
    height: auto;
    min-height: 0;
  }
  .cwv {
    flex: 1;
    min-height: 0;
    display: flex;
    flex-direction: column;
    padding: 16px 16px 12px;
  }
  ha-card.compact .cwv {
    padding: 10px 10px 8px;
  }

  ha-alert {
    display: block;
    margin-bottom: 10px;
    white-space: pre-line;
  }
  .card-title {
    font-size: 20px;
    font-weight: 700;
    letter-spacing: -0.02em;
    margin: 2px 2px 12px;
    color: var(--primary-text-color);
  }

  /* floating cluster — bottom-right, custom buttons in a row left of the quick-add + */
  .fab-row {
    position: absolute;
    right: 16px;
    bottom: 16px;
    z-index: 5;
    display: flex;
    align-items: center;
    gap: 12px;
  }
  .fab {
    width: 56px;
    height: 56px;
    border-radius: 50%;
    border: none;
    cursor: pointer;
    display: grid;
    place-items: center;
    background: var(--primary-color);
    color: var(--on-primary);
    box-shadow: 0 2px 5px rgba(0, 0, 0, 0.22);
    transition:
      transform 0.14s cubic-bezier(0.2, 0.7, 0.3, 1),
      filter 0.14s ease;
  }
  .fab ha-icon {
    --mdc-icon-size: 26px;
  }
  /* custom floating buttons — a neutral surface so the accent + stays the hero */
  .fbtn {
    width: 48px;
    height: 48px;
    border-radius: 50%;
    border: 1px solid var(--divider-color);
    cursor: pointer;
    display: grid;
    place-items: center;
    background: var(--card-background-color);
    color: var(--c, var(--primary-text-color));
    box-shadow: 0 2px 5px rgba(0, 0, 0, 0.18);
    transition:
      transform 0.14s cubic-bezier(0.2, 0.7, 0.3, 1),
      filter 0.14s ease;
  }
  .fbtn ha-icon {
    --mdc-icon-size: 22px;
  }
  .fab:hover,
  .fbtn:hover {
    transform: translateY(-3px) scale(1.05);
    filter: brightness(1.05);
  }
  .fab:active,
  .fbtn:active {
    transform: translateY(-1px) scale(0.99);
  }

  /* topbar — status cluster on the left, right group (legend, controls, buttons) on the right */
  .topbar {
    display: flex;
    align-items: center;
    gap: 16px;
    flex-wrap: wrap;
    margin-bottom: 14px;
  }
  /* right side of the header — legend, calendar-view control, and custom buttons,
     right-aligned and vertically centered against the status cluster */
  .topbar-right {
    display: flex;
    align-items: center;
    flex-wrap: wrap;
    gap: 10px;
    margin-left: auto;
  }
  .topbar-right:empty {
    display: none;
  }
  /* status cluster — the live clock anchors the header; date and next event trail it */
  .status {
    display: flex;
    align-items: center;
    gap: 14px;
    min-width: 0;
  }
  .clock {
    font-size: 40px;
    font-weight: 800;
    line-height: 1;
    letter-spacing: -0.03em;
    color: var(--primary-text-color);
    font-variant-numeric: tabular-nums;
    font-feature-settings: 'tnum' 1;
  }
  ha-card.compact .clock {
    font-size: 32px;
  }
  .statusmeta {
    display: flex;
    flex-direction: column;
    gap: 6px;
    min-width: 0;
  }
  .statusrow {
    display: flex;
    align-items: center;
    flex-wrap: wrap;
    gap: 8px;
    min-width: 0;
  }
  .sdate {
    font-size: 13px;
    font-weight: 600;
    letter-spacing: 0.01em;
    line-height: 1.1;
    color: var(--secondary-text-color);
  }
  .upnext {
    display: inline-flex;
    align-items: center;
    gap: 8px;
    max-width: 100%;
    font: inherit;
    cursor: pointer;
    appearance: none;
    background: var(--neutral-tile);
    border: 1px solid var(--divider-color);
    border-radius: 999px;
    padding: 5px 12px 5px 10px;
    transition:
      background 0.15s ease,
      border-color 0.15s ease;
  }
  .upnext:hover {
    background: var(--hover-tint);
    border-color: color-mix(in srgb, var(--c) 40%, var(--divider-color));
  }
  .up-dot {
    width: 8px;
    height: 8px;
    border-radius: 50%;
    background: var(--c);
    flex: none;
  }
  .up-name {
    font-size: 12.5px;
    font-weight: 600;
    color: var(--primary-text-color);
    overflow: hidden;
    text-overflow: ellipsis;
    white-space: nowrap;
    min-width: 0;
  }
  .up-when {
    font-size: 12.5px;
    font-weight: 700;
    font-variant-numeric: tabular-nums;
    color: color-mix(in srgb, var(--primary-color) 78%, var(--primary-text-color));
    flex: none;
  }
  /* return-to-today — filled accent, shown only when today has scrolled off-screen */
  .return-btn {
    flex: none;
    width: 30px;
    height: 30px;
    border-radius: 50%;
    border: none;
    cursor: pointer;
    appearance: none;
    display: grid;
    place-items: center;
    color: var(--on-primary);
    background: var(--primary-color);
    box-shadow: 0 2px 6px color-mix(in srgb, var(--primary-color) 34%, transparent);
    transition:
      transform 0.15s cubic-bezier(0.2, 0.7, 0.3, 1),
      filter 0.15s ease;
    animation: return-in 0.28s cubic-bezier(0.16, 1, 0.3, 1) both;
  }
  .return-btn:hover {
    transform: translateY(-1px) scale(1.06);
    filter: brightness(1.05);
  }
  .return-btn:active {
    transform: translateY(0) scale(0.96);
  }
  .return-btn ha-icon {
    --mdc-icon-size: 19px;
  }
  @keyframes return-in {
    from {
      opacity: 0;
      transform: scale(0.8);
    }
  }
  @media (prefers-reduced-motion: reduce) {
    .return-btn {
      animation: none;
    }
  }
  .legend {
    display: flex;
    gap: 8px;
    flex-wrap: wrap;
  }
  .legend .cal {
    display: inline-flex;
    align-items: center;
    gap: 7px;
    font-size: 12.5px;
    font-weight: 500;
    color: var(--primary-text-color);
    cursor: pointer;
    background: var(--neutral-tile);
    padding: 6px 12px;
    border-radius: 999px;
    border: 1px solid var(--divider-color);
  }
  .legend .cal::before {
    content: '';
    width: 9px;
    height: 9px;
    border-radius: 50%;
    background: var(--c);
  }
  .legend .cal.off {
    opacity: 0.45;
  }

  /* calendar-view expand toggle — part of the header's right group */
  .expand-btn {
    flex: none;
    width: 34px;
    height: 34px;
    border-radius: 999px;
    border: 1px solid var(--divider-color);
    background: var(--neutral-tile);
    color: var(--secondary-text-color);
    cursor: pointer;
    display: grid;
    place-items: center;
    transition:
      background 0.15s ease,
      color 0.15s ease,
      border-color 0.15s ease;
  }
  .expand-btn:hover {
    background: var(--hover-tint);
    color: var(--primary-text-color);
  }
  .expand-btn.on {
    background: color-mix(in srgb, var(--primary-color) 16%, var(--card-background-color));
    border-color: color-mix(in srgb, var(--primary-color) 40%, var(--divider-color));
    color: var(--primary-color);
  }
  .expand-btn ha-icon {
    --mdc-icon-size: 20px;
  }

  /* custom header buttons — pill chips at the far right, icon plus optional label */
  .header-actions {
    display: flex;
    align-items: center;
    flex-wrap: wrap;
    gap: 8px;
  }
  .hbtn {
    flex: none;
    display: inline-flex;
    align-items: center;
    gap: 7px;
    height: 34px;
    padding: 0 10px;
    border-radius: 999px;
    border: 1px solid var(--divider-color);
    background: var(--neutral-tile);
    color: var(--c, var(--secondary-text-color));
    cursor: pointer;
    font: inherit;
    transition:
      background 0.15s ease,
      color 0.15s ease,
      border-color 0.15s ease;
  }
  .hbtn.labeled {
    padding: 0 14px 0 12px;
  }
  .hbtn:hover {
    background: var(--hover-tint);
    color: var(--c, var(--primary-text-color));
    border-color: color-mix(in srgb, var(--c, var(--primary-color)) 40%, var(--divider-color));
  }
  .hbtn ha-icon {
    --mdc-icon-size: 20px;
    flex: none;
  }
  .hbtn-label {
    font-size: 12.5px;
    font-weight: 600;
    color: var(--primary-text-color);
    white-space: nowrap;
  }

  /* carousel — a side gutter holds the arrows inside the card, each half over
     the edge day column and half over the gutter (never past the card edge). */
  .carousel {
    position: relative;
    flex: 1;
    min-height: 0;
    display: flex;
    align-items: stretch;
    padding: 0 22px;
  }
  /* vertical layout pages up/down, so the arrow gutter moves to top/bottom */
  .carousel.vert {
    padding: 22px 0;
  }
  /* no navigation shown — reclaim the arrow gutter for the strip */
  .carousel.nonav {
    padding: 0;
  }
  .car-arrow {
    position: absolute;
    top: 50%;
    /* above the calendar-view hour gutter (z-index 5), so paging stays clickable */
    z-index: 6;
    width: 36px;
    height: 36px;
    border-radius: 50%;
    border: 1px solid var(--divider-color);
    background: var(--card-background-color);
    color: var(--primary-text-color);
    cursor: pointer;
    display: grid;
    place-items: center;
    box-shadow: 0 2px 8px rgba(0, 0, 0, 0.18);
    transition:
      background 0.15s ease,
      transform 0.15s ease,
      border-color 0.15s ease;
  }
  .car-arrow.left {
    left: 2px;
    transform: translateY(-50%);
  }
  .car-arrow.right {
    right: 2px;
    transform: translateY(-50%);
  }
  .car-arrow:hover {
    background: var(--hover-tint);
    border-color: color-mix(in srgb, var(--primary-color) 40%, var(--divider-color));
  }
  .car-arrow.left:hover,
  .car-arrow.right:hover {
    transform: translateY(-50%) scale(1.07);
  }
  .car-arrow.left:active,
  .car-arrow.right:active {
    transform: translateY(-50%) scale(0.97);
  }
  /* vertical paging arrows — centered on the top and bottom edges */
  .car-arrow.up,
  .car-arrow.down {
    top: auto;
    left: 50%;
    transform: translateX(-50%);
  }
  .car-arrow.up {
    top: 2px;
  }
  .car-arrow.down {
    bottom: 2px;
  }
  .car-arrow.up:hover,
  .car-arrow.down:hover {
    transform: translateX(-50%) scale(1.07);
  }
  .car-arrow.up:active,
  .car-arrow.down:active {
    transform: translateX(-50%) scale(0.97);
  }
  .car-arrow ha-icon {
    --mdc-icon-size: 22px;
  }

  /* week — horizontal scroll strip, ~visibleDays columns visible, snaps.
     Fills the card height; columns stretch to fill. Scrollbar hidden — the
     arrows and swipe drive navigation. */
  .week {
    position: relative;
    flex: 1;
    min-height: 0;
    display: flex;
    gap: 10px;
    align-items: stretch;
    overflow-x: auto;
    padding: 6px 2px;
    scroll-snap-type: x proximity;
    scrollbar-width: none;
    -ms-overflow-style: none;
  }
  .week::-webkit-scrollbar {
    display: none;
  }

  /* vertical (agenda) layout — days stacked full-width, each at its natural
     content height with no inner scroll, so the whole list grows and the card
     grows with it (see ha-card.vagenda). visibleDays sets how many days, from
     today, the list shows. */
  .week.vert {
    flex-direction: column;
    overflow: visible;
    /* let the column shrink to the card width so a long title wraps instead of
       widening the row and spilling off the right edge */
    min-width: 0;
  }
  .week.vert .day {
    flex: 0 0 auto;
    width: 100%;
  }
  .week.vert .events {
    flex: 0 0 auto;
    overflow: visible;
  }
  /* full-width vertical rows have room to wrap; break long names onto new lines */
  .week.vert .ev .title {
    white-space: normal;
    overflow: visible;
    overflow-wrap: anywhere;
  }
  .day {
    position: relative;
    flex: 0 0 calc((100% - (var(--cwv-visible, 3) - 1) * 10px) / var(--cwv-visible, 3));
    scroll-snap-align: start;
    display: flex;
    flex-direction: column;
    min-width: 0;
    background: var(--neutral-tile);
    border-radius: 14px;
    overflow: hidden;
  }
  .day.today {
    background: var(--today-tint);
    border-radius: 16px;
    border: 1.5px solid color-mix(in srgb, var(--primary-color) 42%, var(--divider-color));
    z-index: 1;
  }
  /* highlightToday off — drop today's background fill, keep the border + accent number */
  ha-card.nohighlight .day.today {
    background: var(--neutral-tile);
  }
  ha-card.nohighlight .day.cal.today .cal-head {
    background: var(--card-background-color);
  }
  ha-card.nohighlight .day.cal.today .grid {
    background-color: transparent;
  }
  /* todayBorder off — drop today's accent outline, keeping its geometry */
  ha-card.notodayborder .day.today {
    border-color: transparent;
  }
  /* todayText off — today's date reads like any other day (no accent color or size bump) */
  ha-card.notodaytext .day.today .dmeta,
  ha-card.notodaytext .day.cal.today .cd-name {
    color: var(--secondary-text-color);
  }
  ha-card.notodaytext .day.today .dnum,
  ha-card.notodaytext .day.cal.today .cd-num {
    color: var(--primary-text-color);
  }
  ha-card.notodaytext .day.today .dnum {
    font-size: 26px;
  }

  .day-head {
    display: flex;
    align-items: baseline;
    gap: 8px;
    padding: 12px 12px 8px;
  }
  .dstack {
    display: flex;
    flex-direction: column;
    line-height: 1;
    gap: 5px;
  }
  .dmeta {
    font-size: 11px;
    font-weight: 600;
    letter-spacing: 0.02em;
    line-height: 1.3;
    color: var(--secondary-text-color);
  }
  .dnum {
    font-size: 26px;
    font-weight: 700;
    letter-spacing: -0.02em;
    font-variant-numeric: tabular-nums;
  }
  .day.today .dmeta,
  .day.today .dnum {
    color: var(--primary-color);
  }
  .day.today .dnum {
    font-size: 31px;
  }
  .day.today .day-head {
    padding-top: 16px;
  }

  /* all-day pills */
  .allday {
    padding: 0 10px 4px;
    display: flex;
    flex-direction: column;
    gap: 5px;
  }
  .allday:empty {
    display: none;
  }
  .pill {
    display: flex;
    align-items: center;
    gap: 6px;
    font-size: 12px;
    font-weight: 600;
    line-height: 1.2;
    padding: 5px 9px;
    border-radius: 999px;
    min-width: 0;
    cursor: pointer;
    background: color-mix(in srgb, var(--c) 20%, var(--card-background-color));
    color: var(--primary-text-color);
  }
  .pill .txt {
    overflow: hidden;
    text-overflow: ellipsis;
    white-space: nowrap;
  }
  .pill .chev {
    color: var(--c);
    font-weight: 800;
    flex: none;
  }
  .pill.contL {
    border-top-left-radius: 0;
    border-bottom-left-radius: 0;
    margin-left: -10px;
    padding-left: 12px;
  }
  .pill.contR {
    border-top-right-radius: 0;
    border-bottom-right-radius: 0;
    margin-right: -10px;
    padding-right: 12px;
  }

  /* timed events — flat rows, calendar color as a dot */
  .events {
    flex: 1;
    min-height: 0;
    overflow-y: auto;
    padding: 4px 8px 10px;
    display: flex;
    flex-direction: column;
    gap: 1px;
    scrollbar-width: thin;
  }
  .events::-webkit-scrollbar {
    width: 8px;
  }
  .events::-webkit-scrollbar-thumb {
    background: color-mix(in srgb, var(--primary-text-color) 16%, transparent);
    border-radius: 8px;
    border: 2px solid transparent;
    background-clip: padding-box;
  }
  .ev {
    display: flex;
    flex-direction: column;
    gap: 1px;
    padding: 6px 8px;
    border-radius: 8px;
    cursor: pointer;
    transition: background 0.12s ease;
  }
  .ev:hover {
    background: var(--hover-tint);
  }
  .ev .time {
    display: flex;
    align-items: center;
    gap: 7px;
    font-size: 11px;
    font-weight: 600;
    color: var(--secondary-text-color);
    font-variant-numeric: tabular-nums;
  }
  .ev .time::before {
    content: '';
    width: 7px;
    height: 7px;
    border-radius: 50%;
    background: var(--c);
    flex: none;
  }
  .ev .time .wx {
    margin-left: auto;
    display: inline-flex;
    align-items: center;
    gap: 3px;
  }
  .ev .time .wx ha-icon {
    --mdc-icon-size: 15px;
    opacity: 0.9;
  }
  .ev .title {
    font-size: 13px;
    font-weight: 500;
    line-height: 1.3;
    min-width: 0;
    overflow: hidden;
    text-overflow: ellipsis;
    white-space: nowrap;
    padding-left: 14px;
  }
  .empty {
    padding: 14px 10px;
    color: var(--disabled-text-color);
    font-size: 12.5px;
    text-align: center;
  }
  .day.past .ev {
    opacity: 0.7;
  }

  /* calendar (time-grid) view — the strip scrolls both axes; the hour gutter
     pins to the left and the day heads pin to the top, so every column shares
     one vertical hour scale. */
  .week.cal {
    overflow: auto;
    gap: 0;
    align-items: flex-start;
    padding: 0;
    scroll-snap-type: none;
    scroll-padding-left: var(--cwv-gutter-w);
  }
  .week.cal::-webkit-scrollbar {
    width: 8px;
    height: 8px;
    display: block;
  }
  .week.cal::-webkit-scrollbar-thumb {
    background: color-mix(in srgb, var(--primary-text-color) 16%, transparent);
    border-radius: 8px;
    border: 2px solid transparent;
    background-clip: padding-box;
  }

  .gutter {
    position: sticky;
    left: 0;
    z-index: 5;
    flex: 0 0 var(--cwv-gutter-w);
    background: var(--card-background-color);
  }
  .gutter-corner {
    position: sticky;
    top: 0;
    z-index: 1;
    height: calc(var(--cwv-header-h) + var(--cwv-allday-h));
    background: var(--card-background-color);
  }
  .gutter-hours {
    position: relative;
    height: var(--cwv-grid-h);
  }
  .gutter .hour {
    position: absolute;
    right: 6px;
    transform: translateY(-1px);
    font-size: 10.5px;
    font-weight: 600;
    letter-spacing: 0.02em;
    color: var(--secondary-text-color);
    font-variant-numeric: tabular-nums;
  }

  .day.cal {
    flex: 0 0 calc((100% - var(--cwv-gutter-w)) / var(--cwv-visible, 3));
    scroll-snap-align: start;
    background: transparent;
    border-radius: 0;
    border-right: 1px solid var(--divider-color);
    overflow: visible;
  }
  .day.cal .cal-head {
    position: sticky;
    top: 0;
    z-index: 4;
    height: calc(var(--cwv-header-h) + var(--cwv-allday-h));
    display: flex;
    flex-direction: column;
    background: var(--card-background-color);
    border-bottom: 1px solid var(--divider-color);
  }
  .day.cal.today .cal-head {
    background: var(--today-tint);
  }
  .cal-dayhead {
    display: flex;
    align-items: baseline;
    gap: 6px;
    height: var(--cwv-header-h);
    padding: 8px 10px 4px;
  }
  .cd-name {
    font-size: 12px;
    font-weight: 600;
    letter-spacing: 0.02em;
    color: var(--secondary-text-color);
  }
  .cd-num {
    font-size: 18px;
    font-weight: 700;
    letter-spacing: -0.02em;
    font-variant-numeric: tabular-nums;
  }
  .day.cal.today .cd-name,
  .day.cal.today .cd-num {
    color: var(--primary-color);
  }
  .day.cal .allday {
    flex: 1;
    min-height: 0;
    padding: 0 6px 4px;
    gap: 3px;
    overflow-y: auto;
    scrollbar-width: none;
  }
  .day.cal .allday::-webkit-scrollbar {
    display: none;
  }

  .grid {
    position: relative;
    height: var(--cwv-grid-h);
    background-image: repeating-linear-gradient(
      to bottom,
      var(--cwv-line) 0,
      var(--cwv-line) 1px,
      transparent 1px,
      transparent var(--cwv-hour-h)
    );
  }
  .day.cal.today .grid {
    background-color: var(--today-tint);
  }
  .day.cal.past .grid {
    opacity: 0.7;
  }

  .tev {
    position: absolute;
    z-index: 1;
    margin: 0;
    padding: 3px 8px;
    border: none;
    border-radius: 7px;
    cursor: pointer;
    text-align: left;
    overflow: hidden;
    display: flex;
    flex-direction: column;
    gap: 1px;
    font: inherit;
    color: var(--primary-text-color);
    background: color-mix(in srgb, var(--c) 24%, var(--card-background-color));
    appearance: none;
    transition: filter 0.12s ease;
  }
  /* Short events (≤30 min) read on a single line: time then title inline. */
  .tev.short {
    flex-direction: row;
    align-items: baseline;
    gap: 6px;
  }
  .tev.short .tev-time {
    flex: none;
  }
  .tev.short .tev-title {
    min-width: 0;
  }
  /* Hover reveals a clipped block: it fills the column, grows to fit its text,
     and lifts above neighbours. min-height keeps a tall block from shrinking. */
  .tev:hover {
    z-index: 6;
    filter: brightness(1.03);
    left: 2px !important;
    right: 2px !important;
    width: auto !important;
    height: auto !important;
    min-height: var(--tev-min-h, auto);
    box-shadow: 0 3px 10px color-mix(in srgb, var(--primary-text-color) 24%, transparent);
  }
  .tev:hover .tev-title {
    white-space: normal;
    overflow: visible;
  }
  .tev-time {
    display: flex;
    align-items: center;
    gap: 5px;
    font-size: 10.5px;
    font-weight: 600;
    color: var(--secondary-text-color);
    font-variant-numeric: tabular-nums;
    white-space: nowrap;
    overflow: hidden;
    text-overflow: ellipsis;
  }
  .tev-wx {
    margin-left: auto;
    display: inline-flex;
    align-items: center;
    gap: 2px;
  }
  .tev-wx ha-icon {
    --mdc-icon-size: 14px;
    opacity: 0.9;
  }
  .tev-title {
    font-size: 12px;
    font-weight: 500;
    line-height: 1.2;
    overflow: hidden;
    text-overflow: ellipsis;
  }

  .nowline {
    position: absolute;
    left: 0;
    right: 0;
    height: 0;
    border-top: 2px solid var(--cwv-now);
    z-index: 3;
    pointer-events: none;
  }
  .now-dot {
    position: absolute;
    left: -1px;
    top: -4px;
    width: 8px;
    height: 8px;
    border-radius: 50%;
    background: var(--cwv-now);
  }

  /* event-details popup — Direction D "gate time": the calendar colour bands the
     header and carries the live countdown; a calm body of when / where / description. */
  .details-dialog {
    --dialog-content-padding: 0;
    --mdc-dialog-min-width: 400px;
    --mdc-dialog-max-width: 440px;
    --ha-dialog-border-radius: 18px;
    --mdc-dialog-container-shape: 18px;
  }
  /* a roomier default: at least 500px tall, body flexes so actions stay pinned low */
  .gate {
    display: flex;
    flex-direction: column;
    min-height: 500px;
    border-radius: 18px;
    overflow: hidden;
    animation: det-in 0.32s cubic-bezier(0.16, 1, 0.3, 1) both;
  }
  @keyframes det-in {
    from {
      opacity: 0;
      transform: translateY(6px);
    }
  }
  @media (prefers-reduced-motion: reduce) {
    .gate {
      animation: none;
    }
  }

  /* colour band header — the event's calendar colour is the popup's signature */
  .gate-head {
    padding: 18px 22px 22px;
    text-align: center;
    color: #fff;
    text-shadow: 0 1px 0px rgba(0, 0, 0, 0.2);
    background: linear-gradient(
      160deg,
      color-mix(in srgb, var(--c, var(--primary-color)) 90%, #0b1a12),
      color-mix(in srgb, var(--c, var(--primary-color)) 64%, #0a1220)
    );
  }
  .gate-cal {
    display: inline-flex;
    align-items: center;
    gap: 7px;
    font-size: 11px;
    font-weight: 700;
    letter-spacing: 0.11em;
    text-transform: uppercase;
    color: rgba(255, 255, 255, 0.86);
  }
  .gate-rep {
    display: inline-flex;
    align-items: center;
    gap: 3px;
    padding-left: 8px;
    margin-left: 4px;
    border-left: 1px solid rgba(255, 255, 255, 0.32);
    letter-spacing: 0.04em;
  }
  .gate-rep ha-icon {
    --mdc-icon-size: 14px;
  }
  .gate-title {
    font-size: 20px;
    font-weight: 700;
    letter-spacing: -0.02em;
    line-height: 1.2;
    margin: 10px 0 16px;
  }
  .gate-count {
    font-variant-numeric: tabular-nums;
    line-height: 1;
  }
  .gate-big {
    font-size: 40px;
    font-weight: 800;
    letter-spacing: -0.035em;
    color: #fff;
  }
  .gate-lbl {
    display: block;
    margin-top: 9px;
    font-size: 11.5px;
    font-weight: 700;
    letter-spacing: 0.06em;
    text-transform: uppercase;
    color: rgba(255, 255, 255, 0.82);
  }
  /* elapsed bar rides the band; only rendered while the event is happening now */
  .gate-prog {
    height: 5px;
    margin: 16px 8px 0;
    border-radius: 999px;
    background: rgba(255, 255, 255, 0.24);
    overflow: hidden;
  }
  .gate-prog i {
    display: block;
    height: 100%;
    border-radius: 999px;
    background: #fff;
  }

  .gate-body {
    flex: 1 1 auto;
    padding: 8px 20px 6px;
    display: flex;
    flex-direction: column;
  }
  .gate-body ha-alert {
    display: block;
    margin-top: 10px;
  }
  .gate-row {
    display: flex;
    align-items: center;
    gap: 12px;
    padding: 9px 0;
  }
  .gate-row > ha-icon {
    --mdc-icon-size: 20px;
    color: var(--secondary-text-color);
    flex: none;
  }
  .gate-rt {
    display: flex;
    flex-direction: column;
    gap: 2px;
    min-width: 0;
  }
  .gate-rt b {
    font-size: 14.5px;
    font-weight: 600;
    letter-spacing: -0.01em;
  }
  .gate-rt small {
    font-size: 12.5px;
    color: var(--secondary-text-color);
    font-variant-numeric: tabular-nums;
  }
  .gate-rt.where {
    flex-direction: row;
    align-items: center;
    gap: 8px;
    flex-wrap: wrap;
  }
  .gate-maps {
    display: inline-flex;
    align-items: center;
    gap: 5px;
    font-size: 12px;
    font-weight: 600;
    text-decoration: none;
    color: var(--c, var(--primary-color));
    padding: 3px 9px 3px 8px;
    border-radius: 999px;
    background: color-mix(in srgb, var(--c, var(--primary-color)) 14%, transparent);
  }
  .gate-maps:hover {
    background: color-mix(in srgb, var(--c, var(--primary-color)) 22%, transparent);
  }
  .gate-maps ha-icon {
    --mdc-icon-size: 14px;
  }
  .gate-desc {
    font-size: 13.5px;
    line-height: 1.55;
    color: var(--primary-text-color);
    white-space: pre-line;
    padding-top: 14px;
    margin-top: 8px;
    border-top: 1px solid var(--divider-color);
  }

  .gate-acts,
  .gate-scope {
    display: flex;
    align-items: center;
    gap: 6px;
    padding: 12px 14px;
    border-top: 1px solid var(--divider-color);
  }
  .gate-spacer {
    margin-left: auto;
  }
  .gate-btn {
    display: inline-flex;
    align-items: center;
    gap: 6px;
    font: inherit;
    font-size: 13.5px;
    font-weight: 600;
    letter-spacing: 0.01em;
    padding: 8px 13px;
    border-radius: 10px;
    border: none;
    background: transparent;
    color: var(--primary-color);
    cursor: pointer;
    transition: background 0.14s ease;
  }
  .gate-btn ha-icon {
    --mdc-icon-size: 18px;
  }
  .gate-btn:hover {
    background: color-mix(in srgb, var(--primary-color) 12%, transparent);
  }
  .gate-btn.ghost {
    color: var(--secondary-text-color);
  }
  .gate-btn.ghost:hover {
    background: var(--hover-tint);
    color: var(--primary-text-color);
  }
  .gate-btn.danger {
    color: var(--error-color, #db4437);
  }
  .gate-btn.danger:hover {
    background: color-mix(in srgb, var(--error-color, #db4437) 13%, transparent);
  }

  .gate-confirm {
    display: flex;
    flex-direction: column;
    border-top: 1px solid var(--divider-color);
  }
  .gate-confirm-note {
    padding: 12px 16px 6px;
    font-size: 13px;
    font-weight: 600;
    line-height: 1.4;
    color: color-mix(in srgb, var(--error-color, #db4437) 90%, var(--primary-text-color));
  }
  .gate-scope {
    border-top: none;
  }
  .gate-scope.col {
    flex-direction: column;
    align-items: stretch;
    padding: 4px 14px 12px;
  }
  .gate-scope-btn {
    text-align: left;
    font: inherit;
    font-size: 13px;
    font-weight: 600;
    padding: 10px 12px;
    border-radius: 10px;
    border: 1px solid var(--divider-color);
    background: var(--neutral-tile);
    color: var(--primary-text-color);
    cursor: pointer;
    transition:
      background 0.14s ease,
      border-color 0.14s ease;
  }
  .gate-scope-btn:hover {
    border-color: color-mix(in srgb, var(--error-color, #db4437) 45%, var(--divider-color));
    background: color-mix(in srgb, var(--error-color, #db4437) 8%, transparent);
  }
  .gate-scope-btn.danger {
    color: var(--error-color, #db4437);
  }
  .gate-scope.col .gate-btn.ghost {
    justify-content: center;
    margin-top: 2px;
  }
`;
