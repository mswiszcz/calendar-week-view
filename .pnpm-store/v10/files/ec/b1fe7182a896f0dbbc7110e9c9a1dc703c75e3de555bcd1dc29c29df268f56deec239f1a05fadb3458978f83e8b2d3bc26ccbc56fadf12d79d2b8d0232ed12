import { NumberSkeletonToken } from "@formatjs/icu-skeleton-parser";
//#region packages/ecma402-abstract/types/number.d.ts
type NumberFormatNotation = "standard" | "scientific" | "engineering" | "compact";
type RoundingPriorityType = "auto" | "morePrecision" | "lessPrecision";
type RoundingModeType = "ceil" | "floor" | "expand" | "trunc" | "halfCeil" | "halfFloor" | "halfExpand" | "halfTrunc" | "halfEven";
type UseGroupingType = "min2" | "auto" | "always" | boolean;
interface NumberFormatDigitOptions {
  minimumIntegerDigits?: number;
  minimumSignificantDigits?: number;
  maximumSignificantDigits?: number;
  minimumFractionDigits?: number;
  maximumFractionDigits?: number;
  roundingPriority?: RoundingPriorityType;
  roundingIncrement?: number;
  roundingMode?: RoundingModeType;
  trailingZeroDisplay?: TrailingZeroDisplay;
}
type NumberFormatOptionsLocaleMatcher = "lookup" | "best fit";
type NumberFormatOptionsStyle = "decimal" | "percent" | "currency" | "unit";
type NumberFormatOptionsCompactDisplay = "short" | "long";
type NumberFormatOptionsCurrencyDisplay = "symbol" | "code" | "name" | "narrowSymbol";
type NumberFormatOptionsCurrencySign = "standard" | "accounting";
type NumberFormatOptionsNotation = NumberFormatNotation;
type NumberFormatOptionsSignDisplay = "auto" | "always" | "never" | "exceptZero" | "negative";
type NumberFormatOptionsUnitDisplay = "long" | "short" | "narrow";
type TrailingZeroDisplay = "auto" | "stripIfInteger";
type NumberFormatOptions = Omit<Intl.NumberFormatOptions, "signDisplay" | "useGrouping"> & NumberFormatDigitOptions & {
  localeMatcher?: NumberFormatOptionsLocaleMatcher;
  style?: NumberFormatOptionsStyle;
  compactDisplay?: NumberFormatOptionsCompactDisplay;
  currencyDisplay?: NumberFormatOptionsCurrencyDisplay;
  currencySign?: NumberFormatOptionsCurrencySign;
  notation?: NumberFormatOptionsNotation;
  signDisplay?: NumberFormatOptionsSignDisplay;
  unit?: string;
  unitDisplay?: NumberFormatOptionsUnitDisplay;
  numberingSystem?: string;
  trailingZeroDisplay?: TrailingZeroDisplay;
  roundingPriority?: RoundingPriorityType;
  roundingIncrement?: number;
  roundingMode?: RoundingModeType;
  useGrouping?: UseGroupingType;
};
//#endregion
//#region packages/icu-messageformat-parser/types.d.ts
export interface ExtendedNumberFormatOptions extends NumberFormatOptions {
  scale?: number;
}
export declare enum TYPE {
  /**
   * Raw text
   */
  literal = 0,
  /**
   * Variable w/o any format, e.g `var` in `this is a {var}`
   */
  argument = 1,
  /**
   * Variable w/ number format
   */
  number = 2,
  /**
   * Variable w/ date format
   */
  date = 3,
  /**
   * Variable w/ time format
   */
  time = 4,
  /**
   * Variable w/ select format
   */
  select = 5,
  /**
   * Variable w/ plural format
   */
  plural = 6,
  /**
   * Only possible within plural argument.
   * This is the `#` symbol that will be substituted with the count.
   */
  pound = 7,
  /**
   * XML-like tag
   */
  tag = 8
}
export declare enum SKELETON_TYPE {
  number = 0,
  dateTime = 1
}
export interface LocationDetails {
  offset: number;
  line: number;
  column: number;
}
export interface Location {
  start: LocationDetails;
  end: LocationDetails;
}
export interface BaseElement<T extends TYPE> {
  type: T;
  value: string;
  location?: Location;
}
export type LiteralElement = BaseElement<TYPE.literal>;
export type ArgumentElement = BaseElement<TYPE.argument>;
export interface TagElement extends BaseElement<TYPE.tag> {
  children: MessageFormatElement[];
}
export interface SimpleFormatElement<T extends TYPE, S extends Skeleton> extends BaseElement<T> {
  style?: string | S | null;
}
export type NumberElement = SimpleFormatElement<TYPE.number, NumberSkeleton>;
export type DateElement = SimpleFormatElement<TYPE.date, DateTimeSkeleton>;
export type TimeElement = SimpleFormatElement<TYPE.time, DateTimeSkeleton>;
export type ValidPluralRule = "zero" | "one" | "two" | "few" | "many" | "other" | string;
export interface PluralOrSelectOption {
  value: MessageFormatElement[];
  location?: Location;
}
export interface SelectElement extends BaseElement<TYPE.select> {
  options: Record<string, PluralOrSelectOption>;
}
export interface PluralElement extends BaseElement<TYPE.plural> {
  options: Record<ValidPluralRule, PluralOrSelectOption>;
  offset: number;
  pluralType: Intl.PluralRulesOptions["type"];
}
export interface PoundElement {
  type: TYPE.pound;
  location?: Location;
}
export type MessageFormatElement = ArgumentElement | DateElement | LiteralElement | NumberElement | PluralElement | PoundElement | SelectElement | TagElement | TimeElement;
export interface NumberSkeleton {
  type: SKELETON_TYPE.number;
  tokens: NumberSkeletonToken[];
  location?: Location;
  parsedOptions: ExtendedNumberFormatOptions;
}
export interface DateTimeSkeleton {
  type: SKELETON_TYPE.dateTime;
  pattern: string;
  location?: Location;
  parsedOptions: Intl.DateTimeFormatOptions;
}
export type Skeleton = NumberSkeleton | DateTimeSkeleton;
/**
 * Type Guards
 */
export declare function isLiteralElement(el: MessageFormatElement): el is LiteralElement;
export declare function isArgumentElement(el: MessageFormatElement): el is ArgumentElement;
export declare function isNumberElement(el: MessageFormatElement): el is NumberElement;
export declare function isDateElement(el: MessageFormatElement): el is DateElement;
export declare function isTimeElement(el: MessageFormatElement): el is TimeElement;
export declare function isSelectElement(el: MessageFormatElement): el is SelectElement;
export declare function isPluralElement(el: MessageFormatElement): el is PluralElement;
export declare function isPoundElement(el: MessageFormatElement): el is PoundElement;
export declare function isTagElement(el: MessageFormatElement): el is TagElement;
export declare function isNumberSkeleton(el: NumberElement["style"] | Skeleton): el is NumberSkeleton;
export declare function isDateTimeSkeleton(el?: DateElement["style"] | TimeElement["style"] | Skeleton): el is DateTimeSkeleton;
export declare function createLiteralElement(value: string): LiteralElement;
export declare function createNumberElement(value: string, style?: string | null): NumberElement;
//#endregion
//#region packages/icu-messageformat-parser/manipulator.d.ts
interface IsStructurallySameResult {
  error?: Error;
  success: boolean;
}
/**
 * Check if 2 ASTs are structurally the same. This primarily means that
 * they have the same variables with the same type
 * @param a
 * @param b
 * @returns
 */
export declare function isStructurallySame(a: MessageFormatElement[], b: MessageFormatElement[]): IsStructurallySameResult;
//#endregion
//#region packages/icu-messageformat-parser/no-parser.d.ts
export declare function parse(): void;
export declare const _Parser: undefined;
//#endregion
//# sourceMappingURL=no-parser.d.ts.map