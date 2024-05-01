import {isInteger, isNumber} from "./utils";

const formatterOptions = {
    _internal_decimalSign: '.',
    _internal_decimalSignFractional: '\'',
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
        this._private__priceScale = priceScale;
        this._private__minMove = minMove;
        this._private__calculateDecimal();
    }

    format(price) {
        // \u2212 is unicode's minus sign https://www.fileformat.info/info/unicode/char/2212/index.htm
        // we should use it because it has the same width as plus sign +
        const sign = price < 0 ? '\u2212' : '';
        price = Math.abs(price);
        return sign + this._private__formatAsDecimal(price);
    }

    _private__calculateDecimal() {
        // check if this._base is power of 10
        // for double fractional _fractionalLength if for the main fractional only
        this._internal__fractionalLength = 0;
        if (this._private__priceScale > 0 && this._private__minMove > 0) {
            let base = this._private__priceScale;
            while (base > 1) {
                base /= 10;
                this._internal__fractionalLength++;
            }
        }
    }

    _private__formatAsDecimal(price) {
        const base = this._private__priceScale / this._private__minMove;
        let intPart = Math.floor(price);
        let fracString = '';
        const fracLength = this._internal__fractionalLength !== undefined ? this._internal__fractionalLength : NaN;
        if (base > 1) {
            let fracPart = +(Math.round(price * base) - intPart * base).toFixed(this._internal__fractionalLength);
            if (fracPart >= base) {
                fracPart -= base;
                intPart += 1;
            }
            fracString = formatterOptions._internal_decimalSign + numberToStringWithLeadingZero(+fracPart.toFixed(this._internal__fractionalLength) * this._private__minMove, fracLength);
        } else {
            // should round int part to min move
            intPart = Math.round(intPart * base) / base;
            // if min move > 1, fractional part is always = 0
            if (fracLength > 0) {
                fracString = formatterOptions._internal_decimalSign + numberToStringWithLeadingZero(0, fracLength);
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
        this._private__precision = precision;
    }

    format(vol) {
        let sign = '';
        if (vol < 0) {
            sign = '-';
            vol = -vol;
        }
        if (vol < 995) {
            return sign + this._private__formatNumber(vol);
        } else if (vol < 999995) {
            return sign + this._private__formatNumber(vol / 1000) + 'K';
        } else if (vol < 999999995) {
            vol = 1000 * Math.round(vol / 1000);
            return sign + this._private__formatNumber(vol / 1000000) + 'M';
        } else {
            vol = 1000000 * Math.round(vol / 1000000);
            return sign + this._private__formatNumber(vol / 1000000000) + 'B';
        }
    }

    _private__formatNumber(value) {
        let res;
        const priceScale = Math.pow(10, this._private__precision);
        value = Math.round(value * priceScale) / priceScale;
        if (value >= 1e-15 && value < 1) {
            res = value.toFixed(this._private__precision).replace(/\.?0+$/, ''); // regex removes trailing zeroes
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
        this._private__dateFormat = dateFormat;
        this._private__locale = locale;
    }

    _internal_format(date) {
        return formatDate(date, this._private__dateFormat, this._private__locale);
    }
}

class TimeFormatter {
    constructor(format) {
        this._private__formatStr = format || '%h:%m:%s';
    }

    _internal_format(date) {
        return this._private__formatStr.replace('%h', numberToStringWithLeadingZero(date.getUTCHours(), 2)).replace('%m', numberToStringWithLeadingZero(date.getUTCMinutes(), 2)).replace('%s', numberToStringWithLeadingZero(date.getUTCSeconds(), 2));
    }
}

const defaultParams = {
    _internal_dateFormat: 'yyyy-MM-dd',
    _internal_timeFormat: '%h:%m:%s',
    _internal_dateTimeSeparator: ' ',
    _internal_locale: 'default',
};

export class DateTimeFormatter {
    constructor(params = {}) {
        const formatterParams = Object.assign(Object.assign({}, defaultParams), params);
        this._private__dateFormatter = new DateFormatter(formatterParams._internal_dateFormat, formatterParams._internal_locale);
        this._private__timeFormatter = new TimeFormatter(formatterParams._internal_timeFormat);
        this._private__separator = formatterParams._internal_dateTimeSeparator;
    }

    _internal_format(dateTime) {
        return `${this._private__dateFormatter._internal_format(dateTime)}${this._private__separator}${this._private__timeFormatter._internal_format(dateTime)}`;
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
    const date = timePoint._internal_businessDay === undefined
        ? new Date(timePoint._internal_timestamp * 1000)
        : new Date(Date.UTC(timePoint._internal_businessDay.year, timePoint._internal_businessDay.month - 1, timePoint._internal_businessDay.day));
    // from given date we should use only as UTC date or timestamp
    // but to format as locale date we can convert UTC date to local date
    const localDateFromUtc = new Date(date.getUTCFullYear(), date.getUTCMonth(), date.getUTCDate(), date.getUTCHours(), date.getUTCMinutes(), date.getUTCSeconds(), date.getUTCMilliseconds());
    return localDateFromUtc.toLocaleString(locale, formatOptions);
}