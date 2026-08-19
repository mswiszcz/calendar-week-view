import type { DateTime } from 'luxon';

const GROUP = /\{([^}]*)\}/g;

/**
 * Render a header template: literal text is kept verbatim, each `{...}` group is
 * formatted through Luxon `toFormat` (locale applied when given). An unmatched
 * brace has no closing `}` to pair with, so it stays literal.
 */
export function renderTemplate(dt: DateTime, template: string, locale?: string): string {
  const d = locale ? dt.setLocale(locale) : dt;
  return template.replace(GROUP, (_match, tokens: string) => d.toFormat(tokens));
}
