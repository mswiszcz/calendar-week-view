import { DateTime } from 'luxon';
import { describe, expect, test } from 'vitest';
import { renderTemplate } from '@/format';

const dt = DateTime.fromISO('2026-08-19T10:00:00', { zone: 'utc' }); // Wed

describe('renderTemplate', () => {
  test('when literal text wraps a token interpolates the token', () => {
    expect(renderTemplate(dt, 'Day {d}')).toBe('Day 19');
  });

  test('when a group holds internal literals formats the whole group', () => {
    expect(renderTemplate(dt, '{yyyy · LLLL · cccc}')).toBe('2026 · August · Wednesday');
  });

  test('when several groups appear formats each and keeps separators', () => {
    expect(renderTemplate(dt, '{ccc} {d}')).toBe('Wed 19');
  });

  test('when day token is used renders without zero padding', () => {
    expect(renderTemplate(dt, '{d}')).toBe('19');
  });

  test('when template is empty returns empty string', () => {
    expect(renderTemplate(dt, '')).toBe('');
  });

  test('with a locale formats tokens in that locale', () => {
    expect(renderTemplate(dt, '{cccc}', 'fr')).toBe('mercredi');
  });

  test('when a brace is unmatched leaves it literal', () => {
    expect(renderTemplate(dt, 'a { b')).toBe('a { b');
  });

  test('when there are no braces returns the text unchanged', () => {
    expect(renderTemplate(dt, 'plain text')).toBe('plain text');
  });
});
