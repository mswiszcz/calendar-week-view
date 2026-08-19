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

  /* floating add — bottom-right, tablet touch target */
  .fab {
    position: absolute;
    right: 16px;
    bottom: 16px;
    z-index: 5;
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
  .fab:hover {
    transform: translateY(-3px) scale(1.05);
    filter: brightness(1.05);
  }
  .fab:active {
    transform: translateY(-1px) scale(0.99);
  }
  .fab ha-icon {
    --mdc-icon-size: 26px;
  }

  /* nav */
  .topbar {
    display: flex;
    align-items: center;
    gap: 16px;
    flex-wrap: wrap;
    margin-bottom: 14px;
  }
  .nav {
    display: flex;
    align-items: center;
    gap: 10px;
  }
  .today-btn {
    font: inherit;
    font-size: 13px;
    font-weight: 600;
    color: var(--on-primary);
    background: var(--primary-color);
    cursor: pointer;
    border: none;
    padding: 9px 18px;
    border-radius: 999px;
    box-shadow: 0 1px 2px color-mix(in srgb, var(--primary-color) 30%, transparent);
    transition: filter 0.15s ease;
  }
  .today-btn:hover {
    filter: brightness(1.06);
  }
  .legend {
    display: flex;
    gap: 8px;
    flex-wrap: wrap;
    margin-left: auto;
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

  /* carousel — arrows float over the strip's edges; the strip fills the width */
  .carousel {
    position: relative;
    flex: 1;
    min-height: 0;
    display: flex;
    align-items: stretch;
  }
  /* Each arrow is centered on a strip edge, so half overlaps the edge day column
     and half floats over the card gutter. */
  .car-arrow {
    position: absolute;
    top: 50%;
    z-index: 4;
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
    left: 0;
    transform: translate(-50%, -50%);
  }
  .car-arrow.right {
    right: 0;
    transform: translate(50%, -50%);
  }
  .car-arrow:hover {
    background: var(--hover-tint);
    border-color: color-mix(in srgb, var(--primary-color) 40%, var(--divider-color));
  }
  .car-arrow.left:hover {
    transform: translate(-50%, -50%) scale(1.07);
  }
  .car-arrow.right:hover {
    transform: translate(50%, -50%) scale(1.07);
  }
  .car-arrow.left:active {
    transform: translate(-50%, -50%) scale(0.97);
  }
  .car-arrow.right:active {
    transform: translate(50%, -50%) scale(0.97);
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

  .details {
    display: flex;
    flex-direction: column;
    gap: 14px;
    min-width: 300px;
    animation: det-in 0.32s cubic-bezier(0.16, 1, 0.3, 1) both;
  }
  @keyframes det-in {
    from {
      opacity: 0;
      transform: translateY(6px);
    }
  }
  @media (prefers-reduced-motion: reduce) {
    .details {
      animation: none;
    }
  }
  .details ha-alert {
    display: block;
  }

  /* calendar identity chip — the event's color is the modal's signature */
  .det-head {
    display: inline-flex;
    align-items: center;
    gap: 9px;
    align-self: flex-start;
    padding: 6px 12px 6px 10px;
    border-radius: 999px;
    background: color-mix(in srgb, var(--c, var(--primary-color)) 14%, var(--card-background-color));
  }
  .det-dot {
    width: 11px;
    height: 11px;
    border-radius: 50%;
    background: var(--c, var(--primary-color));
    flex: none;
  }
  .det-cal {
    font-size: 13px;
    font-weight: 700;
    letter-spacing: 0.01em;
    color: var(--primary-text-color);
  }
  .det-recur {
    display: inline-flex;
    align-items: center;
    gap: 4px;
    font-size: 11.5px;
    font-weight: 600;
    letter-spacing: 0.02em;
    color: color-mix(in srgb, var(--c, var(--primary-color)) 45%, var(--primary-text-color));
  }
  .det-recur ha-icon {
    --mdc-icon-size: 15px;
  }

  /* the hero: date + time carried at the same weight the day columns use */
  .det-when {
    display: flex;
    align-items: center;
    gap: 13px;
  }
  .det-when > ha-icon {
    --mdc-icon-size: 26px;
    color: var(--c, var(--primary-color));
    flex: none;
  }
  .when-text {
    display: flex;
    flex-direction: column;
    gap: 2px;
    min-width: 0;
  }
  .when-main {
    font-size: 20px;
    font-weight: 700;
    letter-spacing: -0.02em;
    line-height: 1.15;
    color: var(--primary-text-color);
  }
  .when-sub {
    font-size: 15px;
    font-weight: 600;
    font-variant-numeric: tabular-nums;
    color: var(--secondary-text-color);
  }

  .det-meta {
    display: flex;
    align-items: center;
    gap: 10px;
    font-size: 13.5px;
    color: var(--secondary-text-color);
  }
  .det-meta ha-icon {
    --mdc-icon-size: 19px;
    color: var(--secondary-text-color);
    flex: none;
  }
  .det-desc {
    font-size: 13.5px;
    line-height: 1.55;
    color: var(--primary-text-color);
    white-space: pre-line;
    padding-top: 12px;
    border-top: 1px solid var(--divider-color);
  }

  mwc-button.danger {
    --mdc-theme-primary: var(--error-color, #db4437);
  }
  mwc-button ha-icon {
    --mdc-icon-size: 18px;
  }
  .confirm-note {
    margin-top: 2px;
    padding: 10px 12px;
    border-radius: 10px;
    font-size: 13px;
    font-weight: 600;
    line-height: 1.4;
    color: color-mix(in srgb, var(--error-color, #db4437) 90%, var(--primary-text-color));
    background: color-mix(in srgb, var(--error-color, #db4437) 12%, var(--card-background-color));
  }
`;
