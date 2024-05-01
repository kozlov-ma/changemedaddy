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