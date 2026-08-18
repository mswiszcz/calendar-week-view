'use strict';

var intlUtils = require('@formatjs/intl-utils');

/**
 * Apply a theme to an element by setting the CSS variables on it.
 *
 * element: Element to apply theme on.
 * themes: HASS Theme information
 * localTheme: selected theme.
 * updateMeta: boolean if we should update the theme-color meta element.
 */
const applyThemesOnElement = (element, themes, localTheme, updateMeta = false) => {
    if (!element._themes) {
        element._themes = {};
    }
    let themeName = themes.default_theme;
    if (localTheme === "default" || (localTheme && themes.themes[localTheme])) {
        themeName = localTheme;
    }
    const styles = Object.assign({}, element._themes);
    if (themeName !== "default") {
        const theme = themes.themes[themeName];
        Object.keys(theme).forEach((key) => {
            const prefixedKey = "--" + key;
            element._themes[prefixedKey] = "";
            styles[prefixedKey] = theme[key];
        });
    }
    if (element.updateStyles) {
        element.updateStyles(styles);
    }
    else if (window.ShadyCSS) {
        // implement updateStyles() method of Polemer elements
        window.ShadyCSS.styleSubtree(/** @type {!HTMLElement} */ (element), styles);
    }
    if (!updateMeta) {
        return;
    }
    const meta = document.querySelector("meta[name=theme-color]");
    if (meta) {
        if (!meta.hasAttribute("default-content")) {
            meta.setAttribute("default-content", meta.getAttribute("content"));
        }
        const themeColor = styles["--primary-color"] || meta.getAttribute("default-content");
        meta.setAttribute("content", themeColor);
    }
};

const computeCardSize = (card) => {
    return typeof card.getCardSize === "function" ? card.getCardSize() : 4;
};

function computeDomain(entityId) {
    return entityId.substr(0, entityId.indexOf("."));
}

function computeEntity(entityId) {
    return entityId.substr(entityId.indexOf(".") + 1);
}

const DOMAIN_ICONS = {
    light: "mdi:lightbulb",
    switch: "mdi:toggle-switch",
    sensor: "mdi:gauge",
    binary_sensor: "mdi:checkbox-marked-circle",
    climate: "mdi:thermostat",
    cover: "mdi:window-shutter",
    fan: "mdi:fan",
    lock: "mdi:lock",
    media_player: "mdi:cast",
    vacuum: "mdi:robot-vacuum",
    camera: "mdi:camera",
    person: "mdi:account",
    device_tracker: "mdi:account-circle",
    sun: "mdi:white-balance-sunny",
    weather: "mdi:weather-cloudy",
};
const computeIcon = (stateObj, icon) => {
    if (icon) {
        return icon;
    }
    if (stateObj.attributes.icon) {
        return stateObj.attributes.icon;
    }
    const domain = stateObj.entity_id.split(".")[0];
    return DOMAIN_ICONS[domain] || "mdi:bookmark";
};

const computeName = (stateObj) => stateObj.attributes.friendly_name || stateObj.entity_id;

function computeRTL(hass) {
    var _a;
    const lang = ((_a = hass === null || hass === void 0 ? void 0 : hass.locale) === null || _a === void 0 ? void 0 : _a.language) || "en";
    if (hass.translationMetadata.translations[lang]) {
        return hass.translationMetadata.translations[lang].isRTL || false;
    }
    return false;
}
function computeRTLDirection(hass) {
    return computeRTL(hass) ? "rtl" : "ltr";
}

const CAP_STATE = [
    "on",
    "off",
    "open",
    "closed",
    "locked",
    "unlocked",
];
const computeState = (stateObj) => {
    const state = stateObj.state;
    const unit = stateObj.attributes.unit_of_measurement;
    if (unit) {
        return `${state} ${unit}`;
    }
    if (CAP_STATE.includes(state)) {
        return state.charAt(0).toUpperCase() + state.slice(1);
    }
    return state;
};

exports.NumberFormat = void 0;
(function (NumberFormat) {
    NumberFormat["language"] = "language";
    NumberFormat["system"] = "system";
    NumberFormat["comma_decimal"] = "comma_decimal";
    NumberFormat["decimal_comma"] = "decimal_comma";
    NumberFormat["space_comma"] = "space_comma";
    NumberFormat["none"] = "none";
})(exports.NumberFormat || (exports.NumberFormat = {}));
exports.TimeFormat = void 0;
(function (TimeFormat) {
    TimeFormat["language"] = "language";
    TimeFormat["system"] = "system";
    TimeFormat["am_pm"] = "12";
    TimeFormat["twenty_four"] = "24";
})(exports.TimeFormat || (exports.TimeFormat = {}));

// REF: https://github.com/home-assistant/frontend/blob/dev/src/common/datetime/use_am_pm.ts
/**
 * Checking if AM/PM time format is used within the browser.
 * @param locale Homeassistant frontend locale data
 * @returns
 */
const useAmPm = (locale) => {
    if (locale.time_format === exports.TimeFormat.language ||
        locale.time_format === exports.TimeFormat.system) {
        const testLanguage = locale.time_format === exports.TimeFormat.language ? locale.language : undefined;
        const test = new Date().toLocaleString(testLanguage);
        return test.includes("AM") || test.includes("PM");
    }
    return locale.time_format === exports.TimeFormat.am_pm;
};

//REF: https://github.com/home-assistant/frontend/blob/dev/src/common/datetime/format_date_time.ts
// August 9, 2021, 8:23 AM
/**
 * Formatting a dateObject to date with time e.g. August 9, 2021, 8:23 AM
 * @param dateObj The date to convert
 * @param locale The users's locale settings
 * @returns month and day like "August 9, 2021, 8:23 AM"
 */
const formatDateTime = (dateObj, locale) => formatDateTimeMem(locale).format(dateObj);
const formatDateTimeMem = (locale) => new Intl.DateTimeFormat(locale.language, {
    year: "numeric",
    month: "long",
    day: "numeric",
    hour: useAmPm(locale) ? "numeric" : "2-digit",
    minute: "2-digit",
    hour12: useAmPm(locale),
});
/**
 * Formatting a dateObject to date with time e.g. August 9, 2021, 8:23:15 AM
 * @param dateObj The date to convert
 * @param locale The users's locale settings
 * @returns month and day like "August 9, 2021, 8:23:15 AM"
 */
const formatDateTimeWithSeconds = (dateObj, locale) => formatDateTimeWithSecondsMem(locale).format(dateObj);
const formatDateTimeWithSecondsMem = (locale) => new Intl.DateTimeFormat(locale.language, {
    year: "numeric",
    month: "long",
    day: "numeric",
    hour: useAmPm(locale) ? "numeric" : "2-digit",
    minute: "2-digit",
    second: "2-digit",
    hour12: useAmPm(locale),
});
/**
 * Formatting a Date to just date with AM/PM time e.g. 9/8/2021, 8:23 AM
 * @param dateObj The date to convert
 * @param locale The users's locale settings
 * @returns month and day like "9/8/2021, 8:23 AM"
 */
const formatDateTimeNumeric = (dateObj, locale) => formatDateTimeNumericMem(locale).format(dateObj);
const formatDateTimeNumericMem = (locale) => new Intl.DateTimeFormat(locale.language, {
    year: "numeric",
    month: "numeric",
    day: "numeric",
    hour: "numeric",
    minute: "2-digit",
    hour12: useAmPm(locale),
});

//REF: https://github.com/home-assistant/frontend/blob/dev/src/common/datetime/format_date.ts
/**
 * Formatting a Date to the dddd, mmmm yy format e.g. Tuesday, August 10
 * @param dateObj The date to convert
 * @param locale The users's locale settings
 * @returns date string like "Tuesday, August 10"
 */
const formatDateWeekday = (dateObj, locale) => formatDateWeekdayMem(locale).format(dateObj);
const formatDateWeekdayMem = (locale) => new Intl.DateTimeFormat(locale.language, {
    weekday: "long",
    month: "long",
    day: "numeric",
});
/**
 * Formatting a Date to the mmmm dd, yyyy format e.g. August 10, 2021
 * @param dateObj The date to convert
 * @param locale The users's locale settings
 * @returns date string like "August 10, 2021"
 */
const formatDate = (dateObj, locale) => formatDateMem(locale).format(dateObj);
const formatDateMem = (locale) => new Intl.DateTimeFormat(locale.language, {
    year: "numeric",
    month: "long",
    day: "numeric",
});
/**
 * Formatting a Date to the classic date format e.g. 10/08/2021
 * @param dateObj The date to convert
 * @param locale The users's locale settings
 * @returns classic date format "10/08/2021"
 */
const formatDateNumeric = (dateObj, locale) => formatDateNumericMem(locale).format(dateObj);
const formatDateNumericMem = (locale) => new Intl.DateTimeFormat(locale.language, {
    year: "numeric",
    month: "numeric",
    day: "numeric",
});
/**
 * Formatting a Date to just a month with days e.g. Aug 10
 * @param dateObj The date to convert
 * @param locale The users's locale settings
 * @returns month and day like "Aug 10"
 */
const formatDateShort = (dateObj, locale) => formatDateShortMem(locale).format(dateObj);
const formatDateShortMem = (locale) => new Intl.DateTimeFormat(locale.language, {
    day: "numeric",
    month: "short",
});
/**
 * Formatting a Date to just a month with year e.g. August 2021
 * @param dateObj The date to convert
 * @param locale The users's locale settings
 * @returns month and year like "August 2021"
 */
const formatDateMonthYear = (dateObj, locale) => formatDateMonthYearMem(locale).format(dateObj);
const formatDateMonthYearMem = (locale) => new Intl.DateTimeFormat(locale.language, {
    month: "long",
    year: "numeric",
});
/**
 * Formatting a Date to just a month e.g. August
 * @param dateObj The date to convert
 * @param locale The users's locale settings
 * @returns the written out months of the date
 */
const formatDateMonth = (dateObj, locale) => formatDateMonthMem(locale).format(dateObj);
const formatDateMonthMem = (locale) => new Intl.DateTimeFormat(locale.language, {
    month: "long",
});
/**
 * Formatting a Date to just a year e.g. 2021
 * @param dateObj The date to convert
 * @param locale The users's locale settings
 * @returns the year of the date in yyyy
 */
const formatDateYear = (dateObj, locale) => formatDateYearMem(locale).format(dateObj);
const formatDateYearMem = (locale) => new Intl.DateTimeFormat(locale.language, {
    year: "numeric",
});

//REF: https://github.com/home-assistant/frontend/blob/dev/src/common/datetime/format_time.ts
/**
 * 9:15 PM or 21:15
 * @param dateObj The time to convert
 * @param locale  The users's locale settings
 * @returns Reformated time in hh:mm
 */
const formatTime = (dateObj, locale) => formatTimeMem(locale).format(dateObj);
const formatTimeMem = (locale) => new Intl.DateTimeFormat(locale.language, {
    hour: "numeric",
    minute: "2-digit",
    hour12: useAmPm(locale),
});
/**
* 9:15:24 PM or 21:15:24
* @param dateObj The time to convert
* @param locale The users's locale settings
* @returns Reformated time in hh:mm:ss
*/
const formatTimeWithSeconds = (dateObj, locale) => formatTimeWithSecondsMem(locale).format(dateObj);
const formatTimeWithSecondsMem = (locale) => new Intl.DateTimeFormat(locale.language, {
    hour: useAmPm(locale) ? "numeric" : "2-digit",
    minute: "2-digit",
    second: "2-digit",
    hour12: useAmPm(locale),
});
/**
* Tuesday 7:00 PM or Tuesday 19:00
* @param dateObj The datetime to convert
* @param locale The users's locale settings
* @returns Reformated weekday/time in dddd hh:mm
*/
const formatTimeWeekday = (dateObj, locale) => formatTimeWeekdayMem(locale).format(dateObj);
const formatTimeWeekdayMem = (locale) => new Intl.DateTimeFormat(locale.language, {
    hour: useAmPm(locale) ? "numeric" : "2-digit",
    minute: "2-digit",
    second: "2-digit",
    hour12: useAmPm(locale),
});

function computeStateDomain(stateObj) {
    return computeDomain(stateObj.entity_id);
}

//REF: https://github.com/home-assistant/frontend/blob/dev/src/common/number/format_number.ts
/**
 * Returns true if the entity is considered numeric based on the attributes it has
 * @param stateObj The entity state object
 */
const isNumericState = (stateObj) => !!stateObj.attributes.unit_of_measurement ||
    !!stateObj.attributes.state_class;
const numberFormatToLocale = (localeOptions) => {
    switch (localeOptions.number_format) {
        case exports.NumberFormat.comma_decimal:
            return ["en-US", "en"]; // Use United States with fallback to English formatting 1,234,567.89
        case exports.NumberFormat.decimal_comma:
            return ["de", "es", "it"]; // Use German with fallback to Spanish then Italian formatting 1.234.567,89
        case exports.NumberFormat.space_comma:
            return ["fr", "sv", "cs"]; // Use French with fallback to Swedish and Czech formatting 1 234 567,89
        case exports.NumberFormat.system:
            return undefined;
        default:
            return localeOptions.language;
    }
};
const round = (value, precision = 2) => Math.round(value * Math.pow(10, precision)) / Math.pow(10, precision);
/**
 * Formats a number based on the specified language with thousands separator(s) and decimal character for better legibility.
 * @param num The number to format
 * @param locale The user-selected language and number format, from `hass.locale`
 * @param options Intl.NumberFormatOptions to use
 */
const formatNumber = (num, localeOptions, options) => {
    const locale = localeOptions
        ? numberFormatToLocale(localeOptions)
        : undefined;
    // Polyfill for Number.isNaN, which is more reliable than the global isNaN()
    Number.isNaN =
        Number.isNaN ||
            function isNaN(input) {
                return typeof input === "number" && isNaN(input);
            };
    if ((localeOptions === null || localeOptions === void 0 ? void 0 : localeOptions.number_format) !== exports.NumberFormat.none &&
        !Number.isNaN(Number(num)) &&
        Intl) {
        try {
            return new Intl.NumberFormat(locale, getDefaultFormatOptions(num, options)).format(Number(num));
        }
        catch (err) {
            // Don't fail when using "TEST" language
            // eslint-disable-next-line no-console
            console.error(err);
            return new Intl.NumberFormat(undefined, getDefaultFormatOptions(num, options)).format(Number(num));
        }
    }
    if (typeof num === "string") {
        return num;
    }
    return `${round(num, options === null || options === void 0 ? void 0 : options.maximumFractionDigits).toString()}${(options === null || options === void 0 ? void 0 : options.style) === "currency" ? ` ${options.currency}` : ""}`;
};
/**
 * Generates default options for Intl.NumberFormat
 * @param num The number to be formatted
 * @param options The Intl.NumberFormatOptions that should be included in the returned options
 */
const getDefaultFormatOptions = (num, options) => {
    const defaultOptions = Object.assign({ maximumFractionDigits: 2 }, options);
    if (typeof num !== "string") {
        return defaultOptions;
    }
    // Keep decimal trailing zeros if they are present in a string numeric value
    if (!options ||
        (!options.minimumFractionDigits && !options.maximumFractionDigits)) {
        const digits = num.indexOf(".") > -1 ? num.split(".")[1].length : 0;
        defaultOptions.minimumFractionDigits = digits;
        defaultOptions.maximumFractionDigits = digits;
    }
    return defaultOptions;
};

const computeStateDisplay = (localize, stateObj, locale, state) => {
    const compareState = state !== undefined ? state : stateObj.state;
    if (compareState === "unknown" || compareState === "unavailable") {
        return localize(`state.default.${compareState}`);
    }
    // Entities with a `unit_of_measurement` or `state_class` are numeric values and should use `formatNumber`
    if (isNumericState(stateObj)) {
        if (stateObj.attributes.device_class === "monetary") {
            try {
                return formatNumber(compareState, locale, {
                    style: "currency",
                    currency: stateObj.attributes.unit_of_measurement,
                });
            }
            catch (_err) {
                // fallback to default
            }
        }
        return `${formatNumber(compareState, locale)}${stateObj.attributes.unit_of_measurement
            ? " " + stateObj.attributes.unit_of_measurement
            : ""}`;
    }
    const domain = computeStateDomain(stateObj);
    if (domain === "input_datetime") {
        if (state !== undefined) {
            // If trying to display an explicit state, need to parse the explict state to `Date` then format.
            // Attributes aren't available, we have to use `state`.
            try {
                const components = state.split(" ");
                if (components.length === 2) {
                    // Date and time.
                    return formatDateTime(new Date(components.join("T")), locale);
                }
                if (components.length === 1) {
                    if (state.includes("-")) {
                        // Date only.
                        return formatDate(new Date(`${state}T00:00`), locale);
                    }
                    if (state.includes(":")) {
                        // Time only.
                        const now = new Date();
                        return formatTime(new Date(`${now.toISOString().split("T")[0]}T${state}`), locale);
                    }
                }
                return state;
            }
            catch (_e) {
                // Formatting methods may throw error if date parsing doesn't go well,
                // just return the state string in that case.
                return state;
            }
        }
        else {
            // If not trying to display an explicit state, create `Date` object from `stateObj`'s attributes then format.
            let date;
            if (stateObj.attributes.has_date && stateObj.attributes.has_time) {
                date = new Date(stateObj.attributes.year, stateObj.attributes.month - 1, stateObj.attributes.day, stateObj.attributes.hour, stateObj.attributes.minute);
                return formatDateTime(date, locale);
            }
            if (stateObj.attributes.has_date) {
                date = new Date(stateObj.attributes.year, stateObj.attributes.month - 1, stateObj.attributes.day);
                return formatDate(date, locale);
            }
            if (stateObj.attributes.has_time) {
                date = new Date();
                date.setHours(stateObj.attributes.hour, stateObj.attributes.minute);
                return formatTime(date, locale);
            }
            return stateObj.state;
        }
    }
    if (domain === "humidifier") {
        if (compareState === "on" && stateObj.attributes.humidity) {
            return `${stateObj.attributes.humidity} %`;
        }
    }
    // `counter` `number` and `input_number` domains do not have a unit of measurement but should still use `formatNumber`
    if (domain === "counter" ||
        domain === "number" ||
        domain === "input_number") {
        return formatNumber(compareState, locale);
    }
    return (
    // Return device class translation
    (stateObj.attributes.device_class &&
        localize(`component.${domain}.state.${stateObj.attributes.device_class}.${compareState}`)) ||
        // Return default translation
        localize(`component.${domain}.state._.${compareState}`) ||
        // We don't know! Return the raw state.
        compareState);
};

/** Constants to be used in the frontend. */
// Constants should be alphabetically sorted by name.
// Arrays with values should be alphabetically sorted if order doesn't matter.
// Each constant should have a description what it is supposed to be used for.
/** Icon to use when no icon specified for domain. */
const DEFAULT_DOMAIN_ICON = "mdi:bookmark";
/** Panel to show when no panel is picked. */
const DEFAULT_PANEL = "lovelace";
/** Domains that have a state card. */
const DOMAINS_WITH_CARD = [
    "climate",
    "cover",
    "configurator",
    "input_select",
    "input_number",
    "input_text",
    "lock",
    "media_player",
    "scene",
    "script",
    "timer",
    "vacuum",
    "water_heater",
    "weblink"
];
/** Domains with separate more info dialog. */
const DOMAINS_WITH_MORE_INFO = [
    "alarm_control_panel",
    "automation",
    "camera",
    "climate",
    "configurator",
    "cover",
    "fan",
    "group",
    "history_graph",
    "input_datetime",
    "light",
    "lock",
    "media_player",
    "script",
    "sun",
    "updater",
    "vacuum",
    "water_heater",
    "weather"
];
/** Domains that show no more info dialog. */
const DOMAINS_HIDE_MORE_INFO = [
    "input_number",
    "input_select",
    "input_text",
    "scene",
    "weblink"
];
/** Domains that should have the history hidden in the more info dialog. */
const DOMAINS_MORE_INFO_NO_HISTORY = [
    "camera",
    "configurator",
    "history_graph",
    "scene"
];
/** States that we consider "off". */
const STATES_OFF = ["closed", "locked", "off"];
/** Domains where we allow toggle in Lovelace. */
const DOMAINS_TOGGLE = new Set([
    "fan",
    "input_boolean",
    "light",
    "switch",
    "group",
    "automation"
]);
/** Temperature units. */
const UNIT_C = "°C";
const UNIT_F = "°F";
/** Entity ID of the default view. */
const DEFAULT_VIEW_ENTITY_ID = "group.default_view";

// Polymer legacy event helpers used courtesy of the Polymer project.
//
// Copyright (c) 2017 The Polymer Authors. All rights reserved.
//
// Redistribution and use in source and binary forms, with or without
// modification, are permitted provided that the following conditions are
// met:
//
//    * Redistributions of source code must retain the above copyright
// notice, this list of conditions and the following disclaimer.
//    * Redistributions in binary form must reproduce the above
// copyright notice, this list of conditions and the following disclaimer
// in the documentation and/or other materials provided with the
// distribution.
//    * Neither the name of Google Inc. nor the names of its
// contributors may be used to endorse or promote products derived from
// this software without specific prior written permission.
//
// THIS SOFTWARE IS PROVIDED BY THE COPYRIGHT HOLDERS AND CONTRIBUTORS
// "AS IS" AND ANY EXPRESS OR IMPLIED WARRANTIES, INCLUDING, BUT NOT
// LIMITED TO, THE IMPLIED WARRANTIES OF MERCHANTABILITY AND FITNESS FOR
// A PARTICULAR PURPOSE ARE DISCLAIMED. IN NO EVENT SHALL THE COPYRIGHT
// OWNER OR CONTRIBUTORS BE LIABLE FOR ANY DIRECT, INDIRECT, INCIDENTAL,
// SPECIAL, EXEMPLARY, OR CONSEQUENTIAL DAMAGES (INCLUDING, BUT NOT
// LIMITED TO, PROCUREMENT OF SUBSTITUTE GOODS OR SERVICES; LOSS OF USE,
// DATA, OR PROFITS; OR BUSINESS INTERRUPTION) HOWEVER CAUSED AND ON ANY
// THEORY OF LIABILITY, WHETHER IN CONTRACT, STRICT LIABILITY, OR TORT
// (INCLUDING NEGLIGENCE OR OTHERWISE) ARISING IN ANY WAY OUT OF THE USE
// OF THIS SOFTWARE, EVEN IF ADVISED OF THE POSSIBILITY OF SUCH DAMAGE.
/**
 * Dispatches a custom event with an optional detail value.
 *
 * @param {string} type Name of event type.
 * @param {*=} detail Detail value containing event-specific
 *   payload.
 * @param {{ bubbles: (boolean|undefined),
 *           cancelable: (boolean|undefined),
 *           composed: (boolean|undefined) }=}
 *  options Object specifying options.  These may include:
 *  `bubbles` (boolean, defaults to `true`),
 *  `cancelable` (boolean, defaults to false), and
 *  `node` on which to fire the event (HTMLElement, defaults to `this`).
 * @return {Event} The new event that was fired.
 */
const fireEvent = (node, type, detail, options) => {
    options = options || {};
    // @ts-ignore
    detail = detail === null || detail === undefined ? {} : detail;
    const event = new Event(type, {
        bubbles: options.bubbles === undefined ? true : options.bubbles,
        cancelable: Boolean(options.cancelable),
        composed: options.composed === undefined ? true : options.composed
    });
    event.detail = detail;
    node.dispatchEvent(event);
    return event;
};

const SPECIAL_TYPES = new Set([
    "call-service",
    "divider",
    "section",
    "weblink",
    "cast",
    "select"
]);
const DOMAIN_TO_ELEMENT_TYPE = {
    alert: "toggle",
    automation: "toggle",
    climate: "climate",
    cover: "cover",
    fan: "toggle",
    group: "group",
    input_boolean: "toggle",
    input_number: "input-number",
    input_select: "input-select",
    input_text: "input-text",
    light: "toggle",
    lock: "lock",
    media_player: "media-player",
    remote: "toggle",
    scene: "scene",
    script: "script",
    sensor: "sensor",
    timer: "timer",
    switch: "toggle",
    vacuum: "toggle",
    // Temporary. Once climate is rewritten,
    // water heater should get it's own row.
    water_heater: "climate",
    input_datetime: "input-datetime"
};
const createThing = (cardConfig, isRow = false) => {
    const _createError = (error, config) => {
        return _createThing("hui-error-card", {
            type: "error",
            error,
            config
        });
    };
    const _createThing = (tag, config) => {
        const element = window.document.createElement(tag);
        try {
            // Preventing an error-card infinity loop: https://github.com/custom-cards/custom-card-helpers/issues/54
            if (!element.setConfig)
                return;
            element.setConfig(config);
        }
        catch (err) {
            console.error(tag, err);
            return _createError(err.message, config);
        }
        return element;
    };
    if (!cardConfig || typeof cardConfig !== "object" || (!isRow && !cardConfig.type))
        return _createError("No type defined", cardConfig);
    let tag = cardConfig.type;
    if (tag && tag.startsWith("custom:")) {
        tag = tag.substr("custom:".length);
    }
    else if (isRow) {
        if (SPECIAL_TYPES.has(tag)) {
            tag = `hui-${tag}-row`;
        }
        else {
            if (!cardConfig.entity) {
                return _createError("Invalid config given.", cardConfig);
            }
            const domain = cardConfig.entity.split(".", 1)[0];
            tag = `hui-${DOMAIN_TO_ELEMENT_TYPE[domain] || "text"}-entity-row`;
        }
    }
    else {
        tag = `hui-${tag}-card`;
    }
    if (customElements.get(tag))
        return _createThing(tag, cardConfig);
    // If element doesn't exist (yet) create an error
    const element = _createError(`Custom element doesn't exist: ${cardConfig.type}.`, cardConfig);
    element.style.display = "None";
    const timer = setTimeout(() => {
        element.style.display = "";
    }, 2000);
    // Remove error if element is defined later
    customElements.whenDefined(cardConfig.type).then(() => {
        clearTimeout(timer);
        fireEvent(element, "ll-rebuild", {}, element);
    });
    return element;
};

/**
 * Convert a Duration hh:mm:ss format to seconds
 * @param duration hh:mm:ss formated duration
 * @returns duration in seconds
 */
function durationToSeconds(duration) {
    const parts = duration.split(":").map(Number);
    return parts[0] * 3600 + parts[1] * 60 + parts[2];
}

//REF: https://github.com/home-assistant/frontend/blob/dev/src/common/datetime/relative_time.ts
const formatRelTimeMem = (locale) => new Intl.RelativeTimeFormat(locale.language, { numeric: "auto" });
/**
 * Calculate a string representing a date object as relative time from now.
 *
 * Example output: 5 minutes ago, in 3 days.
 */
const relativeTime = (from, locale, to, includeTense = true) => {
    const diff = intlUtils.selectUnit(from, to);
    if (includeTense) {
        return formatRelTimeMem(locale).format(diff.value, diff.unit);
    }
    return Intl.NumberFormat(locale.language, {
        style: "unit",
        unit: diff.unit,
        unitDisplay: "long",
    }).format(Math.abs(diff.value));
};

function timerTimeRemaining(stateObj) {
    let timeRemaining = durationToSeconds(stateObj.attributes.remaining);
    if (stateObj.state === "active") {
        const now = new Date().getTime();
        const madeActive = new Date(stateObj.last_changed).getTime();
        timeRemaining = Math.max(timeRemaining - (now - madeActive) / 1000, 0);
    }
    return timeRemaining;
}

/**
 * Returns a function, that, as long as it continues to be invoked, will not be triggered. It will be called after it stops being called for `wait` ms.
 * This can be usefull for ResizeObservers for example.
 * @param func The function you want to debounce
 * @param wait Period to wait in ms
 * @param immediate Triggering on the leading edge instead of the trailing
 * @returns Debounced Function
 */
// eslint-disable-next-line: ban-types
const debounce = (func, wait, immediate = false) => {
    let timeout;
    // eslint-disable-next-line @typescript-eslint/ban-ts-comment
    // @ts-ignore
    return function (...args) {
        // eslint-disable-next-line @typescript-eslint/ban-ts-comment
        // @ts-ignore
        // eslint-disable-next-line @typescript-eslint/no-this-alias
        const context = this;
        const later = () => {
            timeout = null;
            if (!immediate) {
                func.apply(context, args);
            }
        };
        const callNow = immediate && !timeout;
        clearTimeout(timeout);
        timeout = setTimeout(later, wait);
        if (callNow) {
            func.apply(context, args);
        }
    };
};

const compareArrayBufferViews = (a, b) => {
    if (a.byteLength !== b.byteLength) {
        return false;
    }
    const viewA = new Uint8Array(a.buffer, a.byteOffset, a.byteLength);
    const viewB = new Uint8Array(b.buffer, b.byteOffset, b.byteLength);
    for (let index = 0; index < viewA.length; index++) {
        if (viewA[index] !== viewB[index]) {
            return false;
        }
    }
    return true;
};
const deepEqual = (a, b) => {
    if (a === b) {
        return true;
    }
    if (a && b && typeof a === "object" && typeof b === "object") {
        if (a.constructor !== b.constructor) {
            return false;
        }
        let i;
        let length;
        if (Array.isArray(a)) {
            const bArray = b;
            length = a.length;
            if (length !== bArray.length) {
                return false;
            }
            for (i = length; i-- !== 0;) {
                if (!deepEqual(a[i], bArray[i])) {
                    return false;
                }
            }
            return true;
        }
        if (a instanceof Map && b instanceof Map) {
            if (a.size !== b.size) {
                return false;
            }
            for (i of a.entries()) {
                if (!b.has(i[0])) {
                    return false;
                }
            }
            for (i of a.entries()) {
                if (!deepEqual(i[1], b.get(i[0]))) {
                    return false;
                }
            }
            return true;
        }
        if (a instanceof Set && b instanceof Set) {
            if (a.size !== b.size) {
                return false;
            }
            for (i of a.entries()) {
                if (!b.has(i[0])) {
                    return false;
                }
            }
            return true;
        }
        if (ArrayBuffer.isView(a) && ArrayBuffer.isView(b)) {
            return compareArrayBufferViews(a, b);
        }
        if (a instanceof RegExp && b instanceof RegExp) {
            return a.source === b.source && a.flags === b.flags;
        }
        if (a.valueOf !== Object.prototype.valueOf) {
            return a.valueOf() === b.valueOf();
        }
        if (a.toString !== Object.prototype.toString) {
            return a.toString() === b.toString();
        }
        const aRecord = a;
        const bRecord = b;
        const keys = Object.keys(aRecord);
        length = keys.length;
        if (length !== Object.keys(bRecord).length) {
            return false;
        }
        for (i = length; i-- !== 0;) {
            if (!Object.prototype.hasOwnProperty.call(b, keys[i])) {
                return false;
            }
        }
        for (i = length; i-- !== 0;) {
            const key = keys[i];
            if (!deepEqual(aRecord[key], bRecord[key])) {
                return false;
            }
        }
        return true;
    }
    return a !== a && b !== b;
};

/**
 * Return the icon to be used for a domain.
 *
 * Optionally pass in a state to influence the domain icon.
 */
const fixedIcons = {
    alert: "mdi:alert",
    automation: "mdi:playlist-play",
    calendar: "mdi:calendar",
    camera: "mdi:video",
    climate: "mdi:thermostat",
    configurator: "mdi:settings",
    conversation: "mdi:text-to-speech",
    device_tracker: "mdi:account",
    fan: "mdi:fan",
    group: "mdi:google-circles-communities",
    history_graph: "mdi:chart-line",
    homeassistant: "mdi:home-assistant",
    homekit: "mdi:home-automation",
    image_processing: "mdi:image-filter-frames",
    input_boolean: "mdi:drawing",
    input_datetime: "mdi:calendar-clock",
    input_number: "mdi:ray-vertex",
    input_select: "mdi:format-list-bulleted",
    input_text: "mdi:textbox",
    light: "mdi:lightbulb",
    mailbox: "mdi:mailbox",
    notify: "mdi:comment-alert",
    person: "mdi:account",
    plant: "mdi:flower",
    proximity: "mdi:apple-safari",
    remote: "mdi:remote",
    scene: "mdi:google-pages",
    script: "mdi:file-document",
    sensor: "mdi:eye",
    simple_alarm: "mdi:bell",
    sun: "mdi:white-balance-sunny",
    switch: "mdi:flash",
    timer: "mdi:timer",
    updater: "mdi:cloud-upload",
    vacuum: "mdi:robot-vacuum",
    water_heater: "mdi:thermometer",
    weblink: "mdi:open-in-new"
};
function domainIcon(domain, state) {
    if (domain in fixedIcons) {
        return fixedIcons[domain];
    }
    switch (domain) {
        case "alarm_control_panel":
            switch (state) {
                case "armed_home":
                    return "mdi:bell-plus";
                case "armed_night":
                    return "mdi:bell-sleep";
                case "disarmed":
                    return "mdi:bell-outline";
                case "triggered":
                    return "mdi:bell-ring";
                default:
                    return "mdi:bell";
            }
        case "binary_sensor":
            return state && state === "off"
                ? "mdi:radiobox-blank"
                : "mdi:checkbox-marked-circle";
        case "cover":
            return state === "closed" ? "mdi:window-closed" : "mdi:window-open";
        case "lock":
            return state && state === "unlocked" ? "mdi:lock-open" : "mdi:lock";
        case "media_player":
            return state && state !== "off" && state !== "idle"
                ? "mdi:cast-connected"
                : "mdi:cast";
        case "zwave":
            switch (state) {
                case "dead":
                    return "mdi:emoticon-dead";
                case "sleeping":
                    return "mdi:sleep";
                case "initializing":
                    return "mdi:timer-sand";
                default:
                    return "mdi:z-wave";
            }
        default:
            // tslint:disable-next-line
            console.warn("Unable to find icon for domain " + domain + " (" + state + ")");
            return DEFAULT_DOMAIN_ICON;
    }
}

const evaluateFilter = (stateObj, filter) => {
    const operator = filter.operator || "==";
    const value = filter.value || filter;
    const state = filter.attribute
        ? stateObj.attributes[filter.attribute]
        : stateObj.state;
    switch (operator) {
        case "==":
            return state === value;
        case "<=":
            return state <= value;
        case "<":
            return state < value;
        case ">=":
            return state >= value;
        case ">":
            return state > value;
        case "!=":
            return state !== value;
        case "regex": {
            return state.match(value);
        }
        default:
            return false;
    }
};

const formatTimestamp = (timestamp) => {
    const date = new Date(timestamp);
    if (Number.isNaN(date.getTime())) {
        return timestamp;
    }
    const now = new Date();
    const diffMs = now.getTime() - date.getTime();
    const diffSec = Math.floor(diffMs / 1000);
    const diffMin = Math.floor(diffSec / 60);
    const diffHour = Math.floor(diffMin / 60);
    const diffDay = Math.floor(diffHour / 24);
    if (diffSec < 60) {
        return `${diffSec} seconds ago`;
    }
    if (diffMin < 60) {
        return `${diffMin} minutes ago`;
    }
    if (diffHour < 24) {
        return `${diffHour} hours ago`;
    }
    if (diffDay < 7) {
        return `${diffDay} days ago`;
    }
    return date.toLocaleString();
};

const getLovelace = () => {
    let root = document.querySelector('home-assistant');
    root = root && root.shadowRoot;
    root = root && root.querySelector('home-assistant-main');
    root = root && root.shadowRoot;
    root = root && root.querySelector('app-drawer-layout partial-panel-resolver');
    root = root && root.shadowRoot || root;
    root = root && root.querySelector('ha-panel-lovelace');
    root = root && root.shadowRoot;
    root = root && root.querySelector('hui-root');
    if (root) {
        const ll = root.lovelace;
        ll.current_view = root.___curView;
        return ll;
    }
    return null;
};

const forwardHaptic = (hapticType) => {
    fireEvent(window, "haptic", hapticType);
};

const navigate = (_node, path, replace = false) => {
    if (replace) {
        history.replaceState(null, "", path);
    }
    else {
        history.pushState(null, "", path);
    }
    fireEvent(window, "location-changed", {
        replace
    });
};

const turnOnOffEntity = (hass, entityId, turnOn = true) => {
    const stateDomain = computeDomain(entityId);
    const serviceDomain = stateDomain === "group" ? "homeassistant" : stateDomain;
    let service;
    switch (stateDomain) {
        case "lock":
            service = turnOn ? "unlock" : "lock";
            break;
        case "cover":
            service = turnOn ? "open_cover" : "close_cover";
            break;
        default:
            service = turnOn ? "turn_on" : "turn_off";
    }
    return hass.callService(serviceDomain, service, { entity_id: entityId });
};

const toggleEntity = (hass, entityId) => {
    const turnOn = STATES_OFF.includes(hass.states[entityId].state);
    return turnOnOffEntity(hass, entityId, turnOn);
};

const handleActionConfig = (node, hass, config, actionConfig) => {
    if (!actionConfig) {
        actionConfig = {
            action: "more-info",
        };
    }
    if (actionConfig.confirmation &&
        (!actionConfig.confirmation.exemptions ||
            !actionConfig.confirmation.exemptions.some((e) => e.user === hass.user.id))) {
        forwardHaptic("warning");
        if (!confirm(actionConfig.confirmation.text ||
            `Are you sure you want to ${actionConfig.action}?`)) {
            return;
        }
    }
    switch (actionConfig.action) {
        case "more-info":
            if (config.entity || config.camera_image) {
                fireEvent(node, "hass-more-info", {
                    entityId: config.entity ? config.entity : config.camera_image,
                });
            }
            break;
        case "navigate":
            if (actionConfig.navigation_path) {
                navigate(node, actionConfig.navigation_path);
            }
            break;
        case "url":
            if (actionConfig.url_path) {
                window.open(actionConfig.url_path);
            }
            break;
        case "toggle":
            if (config.entity) {
                toggleEntity(hass, config.entity);
                forwardHaptic("success");
            }
            break;
        case "call-service": {
            if (!actionConfig.service) {
                forwardHaptic("failure");
                return;
            }
            const [domain, service] = actionConfig.service.split(".", 2);
            hass.callService(domain, service, actionConfig.service_data, actionConfig.target);
            forwardHaptic("success");
            break;
        }
        case "fire-dom-event": {
            fireEvent(node, "ll-custom", actionConfig);
        }
    }
};
const handleAction = (node, hass, config, action) => {
    let actionConfig;
    if (action === "double_tap" && config.double_tap_action) {
        actionConfig = config.double_tap_action;
    }
    else if (action === "hold" && config.hold_action) {
        actionConfig = config.hold_action;
    }
    else if (action === "tap" && config.tap_action) {
        actionConfig = config.tap_action;
    }
    handleActionConfig(node, hass, config, actionConfig);
};

const handleClick = (node, hass, config, hold, dblClick) => {
    let actionConfig;
    if (dblClick && config.double_tap_action) {
        actionConfig = config.double_tap_action;
    }
    else if (hold && config.hold_action) {
        actionConfig = config.hold_action;
    }
    else if (!hold && config.tap_action) {
        actionConfig = config.tap_action;
    }
    if (!actionConfig) {
        actionConfig = {
            action: "more-info"
        };
    }
    if (actionConfig.confirmation &&
        (!actionConfig.confirmation.exemptions ||
            !actionConfig.confirmation.exemptions.some(e => e.user === hass.user.id))) {
        if (!confirm(actionConfig.confirmation.text ||
            `Are you sure you want to ${actionConfig.action}?`)) {
            return;
        }
    }
    switch (actionConfig.action) {
        case "more-info":
            if (actionConfig.entity || config.entity || config.camera_image) {
                fireEvent(node, "hass-more-info", {
                    entityId: actionConfig.entity
                        ? actionConfig.entity
                        : config.entity
                            ? config.entity
                            : config.camera_image
                });
                if (actionConfig.haptic)
                    forwardHaptic(actionConfig.haptic);
            }
            break;
        case "navigate":
            if (actionConfig.navigation_path) {
                navigate(node, actionConfig.navigation_path);
                if (actionConfig.haptic)
                    forwardHaptic(actionConfig.haptic);
            }
            break;
        case "url":
            actionConfig.url_path && window.open(actionConfig.url_path);
            if (actionConfig.haptic)
                forwardHaptic(actionConfig.haptic);
            break;
        case "toggle":
            if (config.entity) {
                toggleEntity(hass, config.entity);
                if (actionConfig.haptic)
                    forwardHaptic(actionConfig.haptic);
            }
            break;
        case "call-service": {
            if (!actionConfig.service) {
                return;
            }
            const [domain, service] = actionConfig.service.split(".", 2);
            const serviceData = Object.assign({}, actionConfig.service_data);
            if (serviceData.entity_id === "entity") {
                serviceData.entity_id = config.entity;
            }
            hass.callService(domain, service, serviceData, actionConfig.target);
            if (actionConfig.haptic)
                forwardHaptic(actionConfig.haptic);
            break;
        }
        case "fire-dom-event": {
            fireEvent(node, "ll-custom", actionConfig);
            if (actionConfig.haptic)
                forwardHaptic(actionConfig.haptic);
            break;
        }
    }
};

function hasAction(config) {
    return config !== undefined && config.action !== "none";
}

// Check if config or Entity changed
function hasConfigOrEntityChanged(element, changedProps, forceUpdate) {
    if (changedProps.has('config') || forceUpdate) {
        return true;
    }
    if (element.config.entity) {
        const oldHass = changedProps.get('hass');
        if (oldHass) {
            return (oldHass.states[element.config.entity]
                !== element.hass.states[element.config.entity]);
        }
        return true;
    }
    else {
        return false;
    }
}

// Check if config or Entity changed
function hasDoubleClick(config) {
    return config !== undefined && config.action !== "none";
}

/** Return an icon representing a binary sensor state. */
const binarySensorIcon = (state, stateObj) => {
    const is_off = state === "off";
    switch (stateObj === null || stateObj === void 0 ? void 0 : stateObj.attributes.device_class) {
        case "battery":
            return is_off ? "mdi:battery" : "mdi:battery-outline";
        case "battery_charging":
            return is_off ? "mdi:battery" : "mdi:battery-charging";
        case "cold":
            return is_off ? "mdi:thermometer" : "mdi:snowflake";
        case "connectivity":
            return is_off ? "mdi:server-network-off" : "mdi:server-network";
        case "door":
            return is_off ? "mdi:door-closed" : "mdi:door-open";
        case "garage_door":
            return is_off ? "mdi:garage" : "mdi:garage-open";
        case "power":
            return is_off ? "mdi:power-plug-off" : "mdi:power-plug";
        case "gas":
        case "problem":
        case "safety":
        case "tamper":
            return is_off ? "mdi:check-circle" : "mdi:alert-circle";
        case "smoke":
            return is_off ? "mdi:check-circle" : "mdi:smoke";
        case "heat":
            return is_off ? "mdi:thermometer" : "mdi:fire";
        case "light":
            return is_off ? "mdi:brightness-5" : "mdi:brightness-7";
        case "lock":
            return is_off ? "mdi:lock" : "mdi:lock-open";
        case "moisture":
            return is_off ? "mdi:water-off" : "mdi:water";
        case "motion":
            return is_off ? "mdi:walk" : "mdi:run";
        case "occupancy":
            return is_off ? "mdi:home-outline" : "mdi:home";
        case "opening":
            return is_off ? "mdi:square" : "mdi:square-outline";
        case "plug":
            return is_off ? "mdi:power-plug-off" : "mdi:power-plug";
        case "presence":
            return is_off ? "mdi:home-outline" : "mdi:home";
        case "running":
            return is_off ? "mdi:stop" : "mdi:play";
        case "sound":
            return is_off ? "mdi:music-note-off" : "mdi:music-note";
        case "update":
            return is_off ? "mdi:package" : "mdi:package-up";
        case "vibration":
            return is_off ? "mdi:crop-portrait" : "mdi:vibrate";
        case "window":
            return is_off ? "mdi:window-closed" : "mdi:window-open";
        default:
            return is_off ? "mdi:radiobox-blank" : "mdi:checkbox-marked-circle";
    }
};

const coverIcon = (state) => {
    const open = state.state !== "closed";
    switch (state.attributes.device_class) {
        case "garage":
            return open ? "mdi:garage-open" : "mdi:garage";
        case "door":
            return open ? "mdi:door-open" : "mdi:door-closed";
        case "shutter":
            return open ? "mdi:window-shutter-open" : "mdi:window-shutter";
        case "blind":
            return open ? "mdi:blinds-open" : "mdi:blinds";
        case "window":
            return open ? "mdi:window-open" : "mdi:window-closed";
        default:
            return domainIcon("cover", state.state);
    }
};

const fixedDeviceClassIcons = {
    humidity: "mdi:water-percent",
    illuminance: "mdi:brightness-5",
    temperature: "mdi:thermometer",
    pressure: "mdi:gauge",
    power: "mdi:flash",
    signal_strength: "mdi:wifi",
};
const sensorIcon = (state) => {
    const dclass = state.attributes.device_class;
    if (dclass && dclass in fixedDeviceClassIcons) {
        return fixedDeviceClassIcons[dclass];
    }
    if (dclass === "battery") {
        const battery = Number(state.state);
        if (isNaN(battery)) {
            return "mdi:battery-unknown";
        }
        const batteryRound = Math.round(battery / 10) * 10;
        if (batteryRound >= 100) {
            return "mdi:battery";
        }
        if (batteryRound <= 0) {
            return "mdi:battery-alert";
        }
        // Will return one of the following icons: (listed so extractor picks up)
        // mdi:battery-10
        // mdi:battery-20
        // mdi:battery-30
        // mdi:battery-40
        // mdi:battery-50
        // mdi:battery-60
        // mdi:battery-70
        // mdi:battery-80
        // mdi:battery-90
        // We obscure 'hass' in iconname so this name does not get picked up
        return `${"hass"}:battery-${batteryRound}`;
    }
    const unit = state.attributes.unit_of_measurement;
    if (unit === UNIT_C || unit === UNIT_F) {
        return "mdi:thermometer";
    }
    return domainIcon("sensor");
};

/** Return an icon representing an input datetime state. */
const inputDateTimeIcon = (state) => {
    if (!state.attributes.has_date) {
        return "mdi:clock";
    }
    if (!state.attributes.has_time) {
        return "mdi:calendar";
    }
    return domainIcon("input_datetime");
};

const domainIcons = {
    binary_sensor: binarySensorIcon,
    cover: coverIcon,
    sensor: sensorIcon,
    input_datetime: inputDateTimeIcon,
};
const stateIcon = (state) => {
    if (!state) {
        return DEFAULT_DOMAIN_ICON;
    }
    if (state.attributes.icon) {
        return state.attributes.icon;
    }
    const domain = computeDomain(state.entity_id);
    if (domain in domainIcons) {
        return domainIcons[domain](state);
    }
    return domainIcon(domain, state.state);
};

const turnOnOffEntities = (hass, entityIds, turnOn = true) => {
    const domainsToCall = {};
    entityIds.forEach((entityId) => {
        if (STATES_OFF.includes(hass.states[entityId].state) === turnOn) {
            const stateDomain = computeDomain(entityId);
            const serviceDomain = ["cover", "lock"].includes(stateDomain)
                ? stateDomain
                : "homeassistant";
            if (!(serviceDomain in domainsToCall)) {
                domainsToCall[serviceDomain] = [];
            }
            domainsToCall[serviceDomain].push(entityId);
        }
    });
    Object.keys(domainsToCall).forEach((domain) => {
        let service;
        switch (domain) {
            case "lock":
                service = turnOn ? "unlock" : "lock";
                break;
            case "cover":
                service = turnOn ? "open_cover" : "close_cover";
                break;
            default:
                service = turnOn ? "turn_on" : "turn_off";
        }
        const entities = domainsToCall[domain];
        hass.callService(domain, service, { entity_id: entities });
    });
};

exports.DEFAULT_DOMAIN_ICON = DEFAULT_DOMAIN_ICON;
exports.DEFAULT_PANEL = DEFAULT_PANEL;
exports.DEFAULT_VIEW_ENTITY_ID = DEFAULT_VIEW_ENTITY_ID;
exports.DOMAINS_HIDE_MORE_INFO = DOMAINS_HIDE_MORE_INFO;
exports.DOMAINS_MORE_INFO_NO_HISTORY = DOMAINS_MORE_INFO_NO_HISTORY;
exports.DOMAINS_TOGGLE = DOMAINS_TOGGLE;
exports.DOMAINS_WITH_CARD = DOMAINS_WITH_CARD;
exports.DOMAINS_WITH_MORE_INFO = DOMAINS_WITH_MORE_INFO;
exports.STATES_OFF = STATES_OFF;
exports.UNIT_C = UNIT_C;
exports.UNIT_F = UNIT_F;
exports.applyThemesOnElement = applyThemesOnElement;
exports.computeCardSize = computeCardSize;
exports.computeDomain = computeDomain;
exports.computeEntity = computeEntity;
exports.computeIcon = computeIcon;
exports.computeName = computeName;
exports.computeRTL = computeRTL;
exports.computeRTLDirection = computeRTLDirection;
exports.computeState = computeState;
exports.computeStateDisplay = computeStateDisplay;
exports.computeStateDomain = computeStateDomain;
exports.createThing = createThing;
exports.debounce = debounce;
exports.deepEqual = deepEqual;
exports.domainIcon = domainIcon;
exports.evaluateFilter = evaluateFilter;
exports.fireEvent = fireEvent;
exports.fixedIcons = fixedIcons;
exports.formatDate = formatDate;
exports.formatDateMonth = formatDateMonth;
exports.formatDateMonthYear = formatDateMonthYear;
exports.formatDateNumeric = formatDateNumeric;
exports.formatDateShort = formatDateShort;
exports.formatDateTime = formatDateTime;
exports.formatDateTimeNumeric = formatDateTimeNumeric;
exports.formatDateTimeWithSeconds = formatDateTimeWithSeconds;
exports.formatDateWeekday = formatDateWeekday;
exports.formatDateYear = formatDateYear;
exports.formatNumber = formatNumber;
exports.formatTime = formatTime;
exports.formatTimeWeekday = formatTimeWeekday;
exports.formatTimeWithSeconds = formatTimeWithSeconds;
exports.formatTimestamp = formatTimestamp;
exports.forwardHaptic = forwardHaptic;
exports.getLovelace = getLovelace;
exports.handleAction = handleAction;
exports.handleActionConfig = handleActionConfig;
exports.handleClick = handleClick;
exports.hasAction = hasAction;
exports.hasConfigOrEntityChanged = hasConfigOrEntityChanged;
exports.hasDoubleClick = hasDoubleClick;
exports.isNumericState = isNumericState;
exports.navigate = navigate;
exports.numberFormatToLocale = numberFormatToLocale;
exports.relativeTime = relativeTime;
exports.round = round;
exports.stateIcon = stateIcon;
exports.timerTimeRemaining = timerTimeRemaining;
exports.toggleEntity = toggleEntity;
exports.turnOnOffEntities = turnOnOffEntities;
exports.turnOnOffEntity = turnOnOffEntity;
//# sourceMappingURL=index.js.map
