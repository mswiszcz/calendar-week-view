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
    --cwv-day-h: 416px;
    --cwv-visible: 3;
    --on-primary: var(--text-primary-color, #ffffff);
    --neutral-tile: color-mix(in srgb, var(--primary-text-color, #1a1c1e) 3%, var(--card-background-color, #ffffff));
    --hover-tint: color-mix(in srgb, var(--primary-text-color, #1a1c1e) 5%, transparent);
    --today-tint: color-mix(in srgb, var(--primary-color, #0aa2e6) 8%, var(--card-background-color, #ffffff));
  }

  ha-card {
    position: relative;
    overflow: hidden;
  }
  ha-card.nobackground {
    background: none;
    box-shadow: none;
    border: none;
  }
  ha-card.compact {
    --cwv-day-h: 340px;
  }
  .cwv {
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
    transition: transform 0.14s cubic-bezier(0.2, 0.7, 0.3, 1), filter 0.14s ease;
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
  .rbtn {
    width: 40px;
    height: 40px;
    border-radius: 50%;
    border: 1px solid var(--divider-color);
    background: var(--card-background-color);
    color: var(--primary-text-color);
    cursor: pointer;
    display: grid;
    place-items: center;
    transition: background 0.15s ease, border-color 0.15s ease;
    box-shadow: 0 1px 2px rgba(0, 0, 0, 0.05);
  }
  .rbtn:hover {
    background: var(--hover-tint);
    border-color: color-mix(in srgb, var(--primary-color) 40%, var(--divider-color));
  }
  .rbtn ha-icon {
    --mdc-icon-size: 20px;
  }
  .range {
    font-size: 20px;
    font-weight: 700;
    letter-spacing: -0.02em;
    font-variant-numeric: tabular-nums;
    min-width: 186px;
    text-align: center;
  }
  .range small {
    display: block;
    font-size: 11.5px;
    font-weight: 600;
    letter-spacing: 0.03em;
    color: var(--secondary-text-color);
    text-transform: uppercase;
    margin-top: 2px;
  }
  .today-reset {
    font: inherit;
    font-size: 13px;
    font-weight: 600;
    color: var(--on-primary);
    background: var(--primary-color);
    cursor: pointer;
    border: none;
    padding: 9px 16px;
    border-radius: 999px;
    box-shadow: 0 1px 2px color-mix(in srgb, var(--primary-color) 30%, transparent);
    transition: filter 0.15s ease;
  }
  .today-reset:hover {
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

  /* week — horizontal scroll strip, ~visibleDays columns visible, snaps */
  .week {
    position: relative;
    display: flex;
    gap: 10px;
    align-items: center;
    overflow-x: auto;
    padding: 6px 2px;
    scroll-snap-type: x proximity;
    scrollbar-width: thin;
  }
  .week::-webkit-scrollbar {
    height: 9px;
  }
  .week::-webkit-scrollbar-thumb {
    background: color-mix(in srgb, var(--primary-text-color) 16%, transparent);
    border-radius: 9px;
    border: 2px solid transparent;
    background-clip: padding-box;
  }
  .day {
    position: relative;
    flex: 0 0 calc((100% - (var(--cwv-visible, 3) - 1) * 10px) / var(--cwv-visible, 3));
    scroll-snap-align: start;
    display: flex;
    flex-direction: column;
    min-width: 0;
    height: var(--cwv-day-h, 416px);
    background: var(--neutral-tile);
    border-radius: 14px;
    overflow: hidden;
  }
  .day.today {
    height: calc(var(--cwv-day-h, 416px) + 40px);
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
  .dow {
    font-size: 11px;
    font-weight: 700;
    letter-spacing: 0.1em;
    text-transform: uppercase;
    color: var(--secondary-text-color);
  }
  .dnum {
    font-size: 26px;
    font-weight: 700;
    letter-spacing: -0.02em;
    font-variant-numeric: tabular-nums;
  }
  .day.today .dow,
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
    gap: 8px;
    font-size: 14px;
  }
  .details .muted {
    color: var(--secondary-text-color);
  }
`;
