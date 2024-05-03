import {ensureDefined, isInteger, isNumber} from "./utils";

const formatterOptions = {
    decimalSign: '.',
    decimalSignFractional: '\'',
};

function numberToStringWithLeadingZero(value, length) {
    if (!isNumber(value)) {
        return 'n/a';
    }
    if (!isInteger(length)) {
        throw new TypeError('invalid length');
    }
    if (length < 0 || length > 16) {
        throw new TypeError('invalid length');
    }
    if (length === 0) {
        return value.toString();
    }
    const dummyString = '0000000000000000';
    return (dummyString + value.toString()).slice(-length);
}

export class PriceFormatter {
    constructor(priceScale, minMove) {
        if (!minMove) {
            minMove = 1;
        }
        if (!isNumber(priceScale) || !isInteger(priceScale)) {
            priceScale = 100;
        }
        if (priceScale < 0) {
            throw new TypeError('invalid base');
        }
        this._priceScale = priceScale;
        this._minMove = minMove;
        this._calculateDecimal();
    }

    format(price) {
        // \u2212 is unicode's minus sign https://www.fileformat.info/info/unicode/char/2212/index.htm
        // we should use it because it has the same width as plus sign +
        const sign = price < 0 ? '\u2212' : '';
        price = Math.abs(price);
        return sign + this._formatAsDecimal(price);
    }

    _calculateDecimal() {
        // check if this._base is power of 10
        // for double fractional _fractionalLength if for the main fractional only
        this._fractionalLength = 0;
        if (this._priceScale > 0 && this._minMove > 0) {
            let base = this._priceScale;
            while (base > 1) {
                base /= 10;
                this._fractionalLength++;
            }
        }
    }

    _formatAsDecimal(price) {
        const base = this._priceScale / this._minMove;
        let intPart = Math.floor(price);
        let fracString = '';
        const fracLength = this._fractionalLength !== undefined ? this._fractionalLength : NaN;
        if (base > 1) {
            let fracPart = +(Math.round(price * base) - intPart * base).toFixed(this._fractionalLength);
            if (fracPart >= base) {
                fracPart -= base;
                intPart += 1;
            }
            fracString = formatterOptions.decimalSign + numberToStringWithLeadingZero(+fracPart.toFixed(this._fractionalLength) * this._minMove, fracLength);
        } else {
            // should round int part to min move
            intPart = Math.round(intPart * base) / base;
            // if min move > 1, fractional part is always = 0
            if (fracLength > 0) {
                fracString = formatterOptions.decimalSign + numberToStringWithLeadingZero(0, fracLength);
            }
        }
        return intPart.toFixed(0) + fracString;
    }
}

export class PercentageFormatter extends PriceFormatter {
    constructor(priceScale = 100) {
        super(priceScale);
    }

    format(price) {
        return `${super.format(price)}%`;
    }
}

export class VolumeFormatter {
    constructor(precision) {
        this._precision = precision;
    }

    format(vol) {
        let sign = '';
        if (vol < 0) {
            sign = '-';
            vol = -vol;
        }
        if (vol < 995) {
            return sign + this._formatNumber(vol);
        } else if (vol < 999995) {
            return sign + this._formatNumber(vol / 1000) + 'K';
        } else if (vol < 999999995) {
            vol = 1000 * Math.round(vol / 1000);
            return sign + this._formatNumber(vol / 1000000) + 'M';
        } else {
            vol = 1000000 * Math.round(vol / 1000000);
            return sign + this._formatNumber(vol / 1000000000) + 'B';
        }
    }

    _formatNumber(value) {
        let res;
        const priceScale = Math.pow(10, this._precision);
        value = Math.round(value * priceScale) / priceScale;
        if (value >= 1e-15 && value < 1) {
            res = value.toFixed(this._precision).replace(/\.?0+$/, ''); // regex removes trailing zeroes
        } else {
            res = String(value);
        }
        return res.replace(/(\.[1-9]*)0+$/, (e, p1) => p1);
    }
}

const getMonth = (date) => date.getUTCMonth() + 1;
const getDay = (date) => date.getUTCDate();
const getYear = (date) => date.getUTCFullYear();
const dd = (date) => numberToStringWithLeadingZero(getDay(date), 2);
const MMMM = (date, locale) => new Date(date.getUTCFullYear(), date.getUTCMonth(), 1)
    .toLocaleString(locale, {month: 'long'});
const MMM = (date, locale) => new Date(date.getUTCFullYear(), date.getUTCMonth(), 1)
    .toLocaleString(locale, {month: 'short'});
const MM = (date) => numberToStringWithLeadingZero(getMonth(date), 2);
const yy = (date) => numberToStringWithLeadingZero(getYear(date) % 100, 2);
const yyyy = (date) => numberToStringWithLeadingZero(getYear(date), 4);

function formatDate(date, format, locale) {
    return format
        .replace(/yyyy/g, yyyy(date))
        .replace(/yy/g, yy(date))
        .replace(/MMMM/g, MMMM(date, locale))
        .replace(/MMM/g, MMM(date, locale))
        .replace(/MM/g, MM(date))
        .replace(/dd/g, dd(date));
}

export class DateFormatter {
    constructor(dateFormat = 'yyyy-MM-dd', locale = 'default') {
        this._dateFormat = dateFormat;
        this._locale = locale;
    }

    format(date) {
        return formatDate(date, this._dateFormat, this._locale);
    }
}

class TimeFormatter {
    constructor(format) {
        this._formatStr = format || '%h:%m:%s';
    }

    format(date) {
        return this._formatStr.replace('%h', numberToStringWithLeadingZero(date.getUTCHours(), 2)).replace('%m', numberToStringWithLeadingZero(date.getUTCMinutes(), 2)).replace('%s', numberToStringWithLeadingZero(date.getUTCSeconds(), 2));
    }
}

const defaultParams = {
    dateFormat: 'yyyy-MM-dd',
    timeFormat: '%h:%m:%s',
    dateTimeSeparator: ' ',
    locale: 'default',
};

export class DateTimeFormatter {
    constructor(params = {}) {
        const formatterParams = Object.assign(Object.assign({}, defaultParams), params);
        this._dateFormatter = new DateFormatter(formatterParams.dateFormat, formatterParams.locale);
        this._timeFormatter = new TimeFormatter(formatterParams.timeFormat);
        this._separator = formatterParams.dateTimeSeparator;
    }

    format(dateTime) {
        return `${this._dateFormatter.format(dateTime)}${this._separator}${this._timeFormatter.format(dateTime)}`;
    }
}

export function defaultTickMarkFormatter(timePoint, tickMarkType, locale) {
    const formatOptions = {};
    switch (tickMarkType) {
        case 0 /* TickMarkType.Year */
        :
            formatOptions.year = 'numeric';
            break;
        case 1 /* TickMarkType.Month */
        :
            formatOptions.month = 'short';
            break;
        case 2 /* TickMarkType.DayOfMonth */
        :
            formatOptions.day = 'numeric';
            break;
        case 3 /* TickMarkType.Time */
        :
            formatOptions.hour12 = false;
            formatOptions.hour = '2-digit';
            formatOptions.minute = '2-digit';
            break;
        case 4 /* TickMarkType.TimeWithSeconds */
        :
            formatOptions.hour12 = false;
            formatOptions.hour = '2-digit';
            formatOptions.minute = '2-digit';
            formatOptions.second = '2-digit';
            break;
    }
    const date = timePoint.businessDay === undefined
        ? new Date(timePoint.timestamp * 1000)
        : new Date(Date.UTC(timePoint.businessDay.year, timePoint.businessDay.month - 1, timePoint.businessDay.day));
    const localDateFromUtc = new Date(date.getUTCFullYear(), date.getUTCMonth(), date.getUTCDate(), date.getUTCHours(), date.getUTCMinutes(), date.getUTCSeconds(), date.getUTCMilliseconds());
    return localDateFromUtc.toLocaleString(locale, formatOptions);
}

export const defaultFontFamily = `-apple-system, BlinkMacSystemFont, 'Trebuchet MS', Roboto, Ubuntu, sans-serif`;

export function makeFont(size, family, style) {
    if (style !== undefined) {
        style = `${style} `;
    } else {
        style = '';
    }
    if (family === undefined) {
        family = defaultFontFamily;
    }
    return `${style}${size}px ${family}`;
}

const defaultReplacementRe = /[2-9]/g;

export class TextWidthCache {
    constructor(size = 50) {
        this._actualSize = 0;
        this._usageTick = 1;
        this._oldestTick = 1;
        this._tick2Labels = {};
        this._cache = new Map();
        this._maxSize = size;
    }

    reset() {
        this._actualSize = 0;
        this._cache.clear();
        this._usageTick = 1;
        this._oldestTick = 1;
        this._tick2Labels = {};
    }

    measureText(ctx, text, optimizationReplacementRe) {
        return this._getMetrics(ctx, text, optimizationReplacementRe).width;
    }

    yMidCorrection(ctx, text, optimizationReplacementRe) {
        const metrics = this._getMetrics(ctx, text, optimizationReplacementRe);
        // if actualBoundingBoxAscent/actualBoundingBoxDescent are not supported we use 0 as a fallback
        return ((metrics.actualBoundingBoxAscent || 0) - (metrics.actualBoundingBoxDescent || 0)) / 2;
    }

    _getMetrics(ctx, text, optimizationReplacementRe) {
        const re = optimizationReplacementRe || defaultReplacementRe;
        const cacheString = String(text).replace(re, '0');
        if (this._cache.has(cacheString)) {
            return ensureDefined(this._cache.get(cacheString)).metrics;
        }
        if (this._actualSize === this._maxSize) {
            const oldestValue = this._tick2Labels[this._oldestTick];
            delete this._tick2Labels[this._oldestTick];
            this._cache.delete(oldestValue);
            this._oldestTick++;
            this._actualSize--;
        }
        ctx.save();
        ctx.textBaseline = 'middle';
        const metrics = ctx.measureText(cacheString);
        ctx.restore();
        if (metrics.width === 0 && !!text.length) {
            // measureText can return 0 in FF depending on a canvas size, don't cache it
            return metrics;
        }
        this._cache.set(cacheString, {
            metrics: metrics,
            tick: this._usageTick
        });
        this._tick2Labels[this._usageTick] = cacheString;
        this._actualSize++;
        this._usageTick++;
        return metrics;
    }
}
