import { describe, expect, test } from 'vitest';
import {
  buildCreateData,
  buildUpdateEvent,
  draftError,
  type EventDraft,
  formatDateLabel,
  formatWhenLine,
  nudgedEnd,
} from '@/event-payload';

const ZONE = 'utc';

/** A saveable timed draft; override per case. */
function draft(overrides: Partial<EventDraft> = {}): EventDraft {
  return {
    summary: 'Team standup',
    entity: 'calendar.work',
    allDay: false,
    date: '2026-08-22',
    endDate: '2026-08-22',
    start: '2026-08-22T09:00',
    end: '2026-08-22T09:30',
    location: '',
    description: '',
    ...overrides,
  };
}

describe('buildCreateData', () => {
  test('when timed emits start/end date_time', () => {
    const d = buildCreateData(draft(), ZONE);
    expect(d.start_date_time).toMatch(/^2026-08-22T09:00/);
    expect(d.end_date_time).toMatch(/^2026-08-22T09:30/);
    expect('start_date' in d).toBe(false);
  });

  test('when all-day emits exclusive end_date', () => {
    const d = buildCreateData(draft({ allDay: true }), ZONE);
    expect(d.start_date).toBe('2026-08-22');
    expect(d.end_date).toBe('2026-08-23');
    expect('start_date_time' in d).toBe(false);
  });

  test('when all-day spans days emits exclusive end past the last day', () => {
    const d = buildCreateData(draft({ allDay: true, date: '2026-08-19', endDate: '2026-08-21' }), ZONE);
    expect(d.start_date).toBe('2026-08-19');
    expect(d.end_date).toBe('2026-08-22');
  });

  test('with location and notes includes them', () => {
    const d = buildCreateData(draft({ location: 'Room 4', description: 'Blockers only' }), ZONE);
    expect(d.location).toBe('Room 4');
    expect(d.description).toBe('Blockers only');
  });

  test('without location and notes omits them', () => {
    const d = buildCreateData(draft(), ZONE);
    expect('location' in d).toBe(false);
    expect('description' in d).toBe(false);
  });

  test('when summary has padding trims it', () => {
    expect(buildCreateData(draft({ summary: '  Sync  ' }), ZONE).summary).toBe('Sync');
  });
});

describe('buildUpdateEvent', () => {
  test('when timed emits dtstart and dtend', () => {
    const e = buildUpdateEvent(draft(), ZONE);
    expect(e.dtstart).toMatch(/^2026-08-22T09:00/);
    expect(e.dtend).toMatch(/^2026-08-22T09:30/);
  });

  test('when all-day emits exclusive dtend', () => {
    const e = buildUpdateEvent(draft({ allDay: true }), ZONE);
    expect(e.dtstart).toBe('2026-08-22');
    expect(e.dtend).toBe('2026-08-23');
  });

  test('when all-day spans days keeps the full range', () => {
    const e = buildUpdateEvent(draft({ allDay: true, date: '2026-08-19', endDate: '2026-08-21' }), ZONE);
    expect(e.dtstart).toBe('2026-08-19');
    expect(e.dtend).toBe('2026-08-22');
  });

  test('when notes blank keeps empty keys to clear', () => {
    const e = buildUpdateEvent(draft(), ZONE);
    expect(e.location).toBe('');
    expect(e.description).toBe('');
    expect('location' in e).toBe(true);
    expect('description' in e).toBe(true);
  });
});

describe('formatWhenLine', () => {
  test('when all-day names the day', () => {
    expect(formatWhenLine(draft({ allDay: true }), ZONE, 'HH:mm')).toBe('Sat 22 Aug · All day');
  });

  test('when all-day spans days shows the range', () => {
    const line = formatWhenLine(draft({ allDay: true, date: '2026-08-19', endDate: '2026-08-21' }), ZONE, 'HH:mm');
    expect(line).toBe('Wed 19 Aug → Fri 21 Aug · All day');
  });

  test('when same day shows one date', () => {
    expect(formatWhenLine(draft(), ZONE, 'HH:mm')).toBe('Sat 22 Aug · 09:00 – 09:30');
  });

  test('when spanning days shows both dates', () => {
    const line = formatWhenLine(draft({ start: '2026-08-22T22:00', end: '2026-08-23T01:00' }), ZONE, 'HH:mm');
    expect(line).toBe('22 Aug 22:00 → 23 Aug 01:00');
  });

  test('with a 12-hour timeFormat honors it', () => {
    expect(formatWhenLine(draft(), ZONE, 'h:mm a')).toBe('Sat 22 Aug · 9:00 AM – 9:30 AM');
  });
});

describe('nudgedEnd', () => {
  test('when end precedes start bumps to start + 1h', () => {
    expect(nudgedEnd('2026-08-22T10:00', '2026-08-22T09:00', ZONE)).toBe('2026-08-22T11:00');
  });

  test('when end equals start bumps to start + 1h', () => {
    expect(nudgedEnd('2026-08-22T10:00', '2026-08-22T10:00', ZONE)).toBe('2026-08-22T11:00');
  });

  test('when end already after start keeps it', () => {
    expect(nudgedEnd('2026-08-22T10:00', '2026-08-22T12:30', ZONE)).toBe('2026-08-22T12:30');
  });

  test('when start jumps past end bumps across days', () => {
    expect(nudgedEnd('2026-08-23T10:00', '2026-08-22T12:00', ZONE)).toBe('2026-08-23T11:00');
  });
});

describe('formatDateLabel', () => {
  test('formats weekday, day, month, year', () => {
    expect(formatDateLabel('2026-08-20')).toBe('Thu 20 Aug 2026');
  });

  test('with a locale localizes', () => {
    expect(formatDateLabel('2026-08-20', 'fr')).toBe('jeu. 20 août 2026');
  });

  test('when date empty returns empty', () => {
    expect(formatDateLabel('')).toBe('');
  });
});

describe('draftError', () => {
  test('when name empty reports it', () => {
    expect(draftError(draft({ summary: '   ' }), ZONE)).toBe('Add a name');
  });

  test('when end equals start reports it', () => {
    expect(draftError(draft({ end: '2026-08-22T09:00' }), ZONE)).toBe('End must be after the start');
  });

  test('when end precedes start reports it', () => {
    expect(draftError(draft({ start: '2026-08-22T10:00', end: '2026-08-22T09:00' }), ZONE)).toBe(
      'End must be after the start',
    );
  });

  test('when timed draft valid returns null', () => {
    expect(draftError(draft(), ZONE)).toBeNull();
  });

  test('when all-day valid ignores times', () => {
    expect(draftError(draft({ allDay: true, start: '', end: '' }), ZONE)).toBeNull();
  });

  test('when all-day end precedes start reports it', () => {
    expect(draftError(draft({ allDay: true, date: '2026-08-22', endDate: '2026-08-20' }), ZONE)).toBe(
      'End must be on or after the start',
    );
  });
});
