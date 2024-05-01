export function isNumber(value) {
    return (typeof value === 'number') && (isFinite(value));
}

export function isInteger(value) {
    return (typeof value === 'number') && ((value % 1) === 0);
}

export function isString(value) {
    return typeof value === 'string';
}

export function isBoolean(value) {
    return typeof value === 'boolean';
}

export function clone(object) {
    const o = object;
    if (!o || 'object' !== typeof o) {
        return o;
    }
    let c;
    if (Array.isArray(o)) {
        c = [];
    } else {
        c = {};
    }
    let p;
    let v;
    for (p in o) {
        if (o.hasOwnProperty(p)) {
            v = o[p];
            if (v && 'object' === typeof v) {
                c[p] = clone(v);
            } else {
                c[p] = v;
            }
        }
    }
    return c;
}

export function notNull(t) {
    return t !== null;
}

export function undefinedIfNull(t) {
    return (t === null) ? undefined : t;
}

export function assert(condition, message) {
    if (!condition) {
        throw new Error('Assertion failed' + (message ? ': ' + message : ''));
    }
}

export function ensureDefined(value) {
    if (value === undefined) {
        throw new Error('Value is undefined');
    }
    return value;
}

export function ensureNotNull(value) {
    if (value === null) {
        throw new Error('Value is null');
    }
    return value;
}

export function ensure(value) {
    return ensureNotNull(ensureDefined(value));
}

export function merge(dst, ...sources) {
    for (const src of sources) {
        // eslint-disable-next-line no-restricted-syntax
        for (const i in src) {
            if (src[i] === undefined) {
                continue;
            }
            if ('object' !== typeof src[i] || dst[i] === undefined || Array.isArray(src[i])) {
                dst[i] = src[i];
            } else {
                // eslint-disable-next-line @typescript-eslint/no-unsafe-argument
                merge(dst[i], src[i]);
            }
        }
    }
    return dst;
}