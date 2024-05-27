import {
    areRangesEqual,
    assert,
    clamp,
    clone,
    ensure,
    ensureDefined,
    ensureNotNull,
    equal,
    greaterOrEqual,
    isBaseDecimal,
    isBoolean,
    isInteger,
    isNumber,
    isString,
    merge,
    min,
    notNull,
} from './utils'
import {
    clearRect, clearRectWithGradient, gradientColorAtPercent,
} from './paint'
import {
    DateFormatter,
    DateTimeFormatter,
    defaultTickMarkFormatter,
    PercentageFormatter,
    PriceFormatter,
    VolumeFormatter,
    makeFont,
    TextWidthCache,
    defaultFontFamily
} from './formatter.js'
import {
    CrosshairPaneView,
    CrosshairPriceAxisView,
    CrosshairTimeAxisView,
    PriceAxisRendererOptionsProvider,
    SeriesCandlesticksPaneView,
    PanePriceAxisView,
    SeriesPriceLinePaneView,
    SeriesPriceAxisView,
    GridPaneView,
    SeriesLinePaneView
} from './views'

'use strict';

class DataSource {
    constructor() {
        this._priceScale = null;
        this._zorder = 0;
    }

    zorder() {
        return this._zorder;
    }

    setZorder(zorder) {
        this._zorder = zorder;
    }

    priceScale() {
        return this._priceScale;
    }

    setPriceScale(priceScale) {
        this._priceScale = priceScale;
    }

    labelPaneViews(pane) {
        return [];
    }

    timeAxisViews() {
        return [];
    }

    visible() {
        return true;
    }
}

class Crosshair extends DataSource {
    constructor(model, options) {
        super();
        this._pane = null;
        this._price = NaN;
        this._index = 0;
        this._visible = true;
        this._priceAxisViews = new Map();
        this._subscribed = false;
        this._x = NaN;
        this._y = NaN;
        this._originX = NaN;
        this._originY = NaN;
        this._model = model;
        this._options = options;
        const valuePriceProvider = (rawPriceProvider, rawCoordinateProvider) => {
            return (priceScale) => {
                const coordinate = rawCoordinateProvider();
                const rawPrice = rawPriceProvider();
                if (priceScale === ensureNotNull(this._pane).defaultPriceScale()) {
                    return {price: rawPrice, coordinate: coordinate};
                } else {
                    const firstValue = ensureNotNull(priceScale.firstValue());
                    const price = priceScale.coordinateToPrice(coordinate, firstValue);
                    return {price: price, coordinate: coordinate};
                }
            };
        };
        const valueTimeProvider = (rawIndexProvider, rawCoordinateProvider) => {
            return () => {
                const time = this._model.timeScale().indexToTime(rawIndexProvider());
                const coordinate = rawCoordinateProvider();
                if (!time || !Number.isFinite(coordinate)) {
                    return null;
                }
                return {
                    time: time, coordinate: coordinate,
                };
            };
        };
        this._currentPosPriceProvider = valuePriceProvider(() => this._price, () => this._y);
        const currentPosTimeProvider = valueTimeProvider(() => this._index, () => this.appliedX());
        this._timeAxisView = new CrosshairTimeAxisView(this, model, currentPosTimeProvider);
        this._paneView = new CrosshairPaneView(this);
    }

    options() {
        return this._options;
    }

    saveOriginCoord(x, y) {
        this._originX = x;
        this._originY = y;
    }

    clearOriginCoord() {
        this._originX = NaN;
        this._originY = NaN;
    }

    originCoordX() {
        return this._originX;
    }

    originCoordY() {
        return this._originY;
    }

    setPosition(index, price, pane) {
        if (!this._subscribed) {
            this._subscribed = true;
        }
        this._visible = true;
        this._tryToUpdateViews(index, price, pane);
    }

    appliedIndex() {
        return this._index;
    }

    appliedX() {
        return this._x;
    }

    appliedY() {
        return this._y;
    }

    visible() {
        return this._visible;
    }

    clearPosition() {
        this._visible = false;
        this._setIndexToLastSeriesBarIndex();
        this._price = NaN;
        this._x = NaN;
        this._y = NaN;
        this._pane = null;
        this.clearOriginCoord();
    }

    paneViews(pane) {
        return this._pane !== null ? [this._paneView] : [];
    }

    horzLineVisible(pane) {
        return pane === this._pane && this._options.horzLine.visible;
    }

    vertLineVisible() {
        return this._options.vertLine.visible;
    }

    priceAxisViews(pane, priceScale) {
        if (!this._visible || this._pane !== pane) {
            this._priceAxisViews.clear();
        }
        const views = [];
        if (this._pane === pane) {
            views.push(this._createPriceAxisViewOnDemand(this._priceAxisViews, priceScale, this._currentPosPriceProvider));
        }
        return views;
    }

    timeAxisViews() {
        return this._visible ? [this._timeAxisView] : [];
    }

    pane() {
        return this._pane;
    }

    updateAllViews() {
        this._paneView.update();
        this._priceAxisViews.forEach((value) => value.update());
        this._timeAxisView.update();
    }

    _priceScaleByPane(pane) {
        if (pane && !pane.defaultPriceScale().isEmpty()) {
            return pane.defaultPriceScale();
        }
        return null;
    }

    _tryToUpdateViews(index, price, pane) {
        if (this._tryToUpdateData(index, price, pane)) {
            this.updateAllViews();
        }
    }

    _tryToUpdateData(newIndex, newPrice, newPane) {
        const oldX = this._x;
        const oldY = this._y;
        const oldPrice = this._price;
        const oldIndex = this._index;
        const oldPane = this._pane;
        const priceScale = this._priceScaleByPane(newPane);
        this._index = newIndex;
        this._x = isNaN(newIndex) ? NaN : this._model.timeScale().indexToCoordinate(newIndex);
        this._pane = newPane;
        const firstValue = priceScale !== null ? priceScale.firstValue() : null;
        if (priceScale !== null && firstValue !== null) {
            this._price = newPrice;
            this._y = priceScale.priceToCoordinate(newPrice, firstValue);
        } else {
            this._price = NaN;
            this._y = NaN;
        }
        return (oldX !== this._x || oldY !== this._y || oldIndex !== this._index || oldPrice !== this._price || oldPane !== this._pane);
    }

    _setIndexToLastSeriesBarIndex() {
        const lastIndexes = this._model.serieses()
            .map((s) => s.bars().lastIndex())
            .filter(notNull);
        const lastBarIndex = (lastIndexes.length === 0) ? null : Math.max(...lastIndexes);
        this._index = lastBarIndex !== null ? lastBarIndex : NaN;
    }

    _createPriceAxisViewOnDemand(map, priceScale, valueProvider) {
        let view = map.get(priceScale);
        if (view === undefined) {
            view = new CrosshairPriceAxisView(this, priceScale, valueProvider);
            map.set(priceScale, view);
        }
        return view;
    }
}

function boundCompare(lower, arr, value, compare, start = 0, to = arr.length) {
    let count = to - start;
    while (0 < count) {
        const count2 = (count >> 1);
        const mid = start + count2;
        if (compare(arr[mid], value) === lower) {
            start = mid + 1;
            count -= count2 + 1;
        } else {
            count = count2;
        }
    }
    return start;
}

const lowerBound = boundCompare.bind(null, true);
const upperBound = boundCompare.bind(null, false);

class Delegate {
    constructor() {
        this._listeners = [];
    }

    subscribe(callback, linkedObject, singleshot) {
        const listener = {
            callback: callback, linkedObject: linkedObject, singleshot: singleshot === true,
        };
        this._listeners.push(listener);
    }

    unsubscribeAll(linkedObject) {
        this._listeners = this._listeners.filter((listener) => listener.linkedObject !== linkedObject);
    }

    fire(param1, param2, param3) {
        const listenersSnapshot = [...this._listeners];
        this._listeners = this._listeners.filter((listener) => !listener.singleshot);
        listenersSnapshot.forEach((listener) => listener.callback(param1, param2, param3));
    }

    hasListeners() {
        return this._listeners.length > 0;
    }

    destroy() {
        this._listeners = [];
    }
}

function isDefaultPriceScale(priceScaleId) {
    return priceScaleId === "left" /* DefaultPriceScaleId.Left */ || priceScaleId === "right" /* DefaultPriceScaleId.Right */;
}

function mergePaneInvalidation(beforeValue, newValue) {
    if (beforeValue === undefined) {
        return newValue;
    }
    const level = Math.max(beforeValue.level, newValue.level);
    const autoScale = beforeValue.autoScale || newValue.autoScale;
    return {level: level, autoScale: autoScale};
}

class InvalidateMask {
    constructor(globalLevel) {
        this._invalidatedPanes = new Map();
        this._timeScaleInvalidations = [];
        this._globalLevel = globalLevel;
    }

    invalidatePane(paneIndex, invalidation) {
        const prevValue = this._invalidatedPanes.get(paneIndex);
        const newValue = mergePaneInvalidation(prevValue, invalidation);
        this._invalidatedPanes.set(paneIndex, newValue);
    }

    fullInvalidation() {
        return this._globalLevel;
    }

    invalidateForPane(paneIndex) {
        const paneInvalidation = this._invalidatedPanes.get(paneIndex);
        if (paneInvalidation === undefined) {
            return {
                level: this._globalLevel,
            };
        }
        return {
            level: Math.max(this._globalLevel, paneInvalidation.level), autoScale: paneInvalidation.autoScale,
        };
    }

    setFitContent() {
        this.stopTimeScaleAnimation();
        this._timeScaleInvalidations = [{type: 0 /* TimeScaleInvalidationType.FitContent */}];
    }

    applyRange(range) {
        this.stopTimeScaleAnimation();
        this._timeScaleInvalidations = [{
            type: 1 /* TimeScaleInvalidationType.ApplyRange */, value: range
        }];
    }

    setTimeScaleAnimation(animation) {
        this._removeTimeScaleAnimation();
        this._timeScaleInvalidations.push({
            type: 5 /* TimeScaleInvalidationType.Animation */, value: animation
        });
    }

    stopTimeScaleAnimation() {
        this._removeTimeScaleAnimation();
        this._timeScaleInvalidations.push({type: 6 /* TimeScaleInvalidationType.StopAnimation */});
    }

    resetTimeScale() {
        this.stopTimeScaleAnimation();
        this._timeScaleInvalidations = [{type: 4 /* TimeScaleInvalidationType.Reset */}];
    }

    setBarSpacing(barSpacing) {
        this.stopTimeScaleAnimation();
        this._timeScaleInvalidations.push({
            type: 2 /* TimeScaleInvalidationType.ApplyBarSpacing */, value: barSpacing
        });
    }

    setRightOffset(offset) {
        this.stopTimeScaleAnimation();
        this._timeScaleInvalidations.push({
            type: 3 /* TimeScaleInvalidationType.ApplyRightOffset */, value: offset
        });
    }

    timeScaleInvalidations() {
        return this._timeScaleInvalidations;
    }

    merge(other) {
        for (const tsInvalidation of other._timeScaleInvalidations) {
            this._applyTimeScaleInvalidation(tsInvalidation);
        }
        this._globalLevel = Math.max(this._globalLevel, other._globalLevel);
        other._invalidatedPanes.forEach((invalidation, index) => {
            this.invalidatePane(index, invalidation);
        });
    }

    static light() {
        return new InvalidateMask(2 /* InvalidationLevel.Light */);
    }

    static full() {
        return new InvalidateMask(3 /* InvalidationLevel.Full */);
    }

    _applyTimeScaleInvalidation(invalidation) {
        switch (invalidation.type) {
            case 0 /* TimeScaleInvalidationType.FitContent */
            :
                this.setFitContent();
                break;
            case 1 /* TimeScaleInvalidationType.ApplyRange */
            :
                this.applyRange(invalidation.value);
                break;
            case 2 /* TimeScaleInvalidationType.ApplyBarSpacing */
            :
                this.setBarSpacing(invalidation.value);
                break;
            case 3 /* TimeScaleInvalidationType.ApplyRightOffset */
            :
                this.setRightOffset(invalidation.value);
                break;
            case 4 /* TimeScaleInvalidationType.Reset */
            :
                this.resetTimeScale();
                break;
            case 5 /* TimeScaleInvalidationType.Animation */
            :
                this.setTimeScaleAnimation(invalidation.value);
                break;
            case 6 /* TimeScaleInvalidationType.StopAnimation */
            :
                this._removeTimeScaleAnimation();
        }
    }

    _removeTimeScaleAnimation() {
        const index = this._timeScaleInvalidations.findIndex((inv) => inv.type === 5 /* TimeScaleInvalidationType.Animation */);
        if (index !== -1) {
            this._timeScaleInvalidations.splice(index, 1);
        }
    }
}

class PriceRangeImpl {
    constructor(minValue, maxValue) {
        this._minValue = minValue;
        this._maxValue = maxValue;
    }

    equals(pr) {
        if (pr === null) {
            return false;
        }
        return this._minValue === pr._minValue && this._maxValue === pr._maxValue;
    }

    clone() {
        return new PriceRangeImpl(this._minValue, this._maxValue);
    }

    minValue() {
        return this._minValue;
    }

    maxValue() {
        return this._maxValue;
    }

    length() {
        return this._maxValue - this._minValue;
    }

    isEmpty() {
        return this._maxValue === this._minValue || Number.isNaN(this._maxValue) || Number.isNaN(this._minValue);
    }

    merge(anotherRange) {
        function computeFiniteResult(method, valueOne, valueTwo, fallback) {
            const firstFinite = Number.isFinite(valueOne);
            const secondFinite = Number.isFinite(valueTwo);
            if (firstFinite && secondFinite) {
                return method(valueOne, valueTwo);
            }
            return !firstFinite && !secondFinite ? fallback : (firstFinite ? valueOne : valueTwo);
        }

        if (anotherRange === null) {
            return this;
        }
        return new PriceRangeImpl(computeFiniteResult(Math.min, this.minValue(), anotherRange.minValue(), -Infinity), computeFiniteResult(Math.max, this.maxValue(), anotherRange.maxValue(), Infinity));
    }

    scaleAroundCenter(coeff) {
        if (!isNumber(coeff)) {
            return;
        }
        const delta = this._maxValue - this._minValue;
        if (delta === 0) {
            return;
        }
        const center = (this._maxValue + this._minValue) * 0.5;
        let maxDelta = this._maxValue - center;
        let minDelta = this._minValue - center;
        maxDelta *= coeff;
        minDelta *= coeff;
        this._maxValue = center + maxDelta;
        this._minValue = center + minDelta;
    }

    shift(delta) {
        if (!isNumber(delta)) {
            return;
        }
        this._maxValue += delta;
        this._minValue += delta;
    }

    toRaw() {
        return {
            minValue: this._minValue, maxValue: this._maxValue,
        };
    }

    static fromRaw(raw) {
        return (raw === null) ? null : new PriceRangeImpl(raw.minValue, raw.maxValue);
    }
}

class AutoscaleInfoImpl {
    constructor(priceRange, margins) {
        this._priceRange = priceRange;
        this._margins = margins || null;
    }

    priceRange() {
        return this._priceRange;
    }

    margins() {
        return this._margins;
    }

    toRaw() {
        if (this._priceRange === null) {
            return null;
        }
        return {
            priceRange: this._priceRange.toRaw(), margins: this._margins || undefined,
        };
    }

    static fromRaw(raw) {
        return (raw === null) ? null : new AutoscaleInfoImpl(PriceRangeImpl.fromRaw(raw.priceRange), raw.margins);
    }
}

class PriceDataSource extends DataSource {
    constructor(model) {
        super();
        this._model = model;
    }

    model() {
        return this._model;
    }
}

const barStyleFnMap = {
    Candlestick: (findBar, candlestickStyle, barIndex, precomputedBars) => {
        var _a, _b, _c;
        const upColor = candlestickStyle.upColor;
        const downColor = candlestickStyle.downColor;
        const borderUpColor = candlestickStyle.borderUpColor;
        const borderDownColor = candlestickStyle.borderDownColor;
        const wickUpColor = candlestickStyle.wickUpColor;
        const wickDownColor = candlestickStyle.wickDownColor;
        const currentBar = ensureNotNull(findBar(barIndex, precomputedBars));
        const isUp = ensure(currentBar.value[0 /* PlotRowValueIndex.Open */]) <= ensure(currentBar.value[3 /* PlotRowValueIndex.Close */]);
        return {
            barColor: (_a = currentBar.color) !== null && _a !== void 0 ? _a : (isUp ? upColor : downColor),
            barBorderColor: (_b = currentBar.borderColor) !== null && _b !== void 0 ? _b : (isUp ? borderUpColor : borderDownColor),
            barWickColor: (_c = currentBar.wickColor) !== null && _c !== void 0 ? _c : (isUp ? wickUpColor : wickDownColor),
        };
    }, Line: (findBar, lineStyle, barIndex, precomputedBars) => {
        var _a, _b;
        const currentBar = ensureNotNull(findBar(barIndex, precomputedBars));
        return {
            barColor: (_a = currentBar.color) !== null && _a !== void 0 ? _a : lineStyle.color,
            lineColor: (_b = currentBar.color) !== null && _b !== void 0 ? _b : lineStyle.color,
        };
    },
};

class SeriesBarColorer {
    constructor(series) {
        this._findBar = (barIndex, precomputedBars) => {
            if (precomputedBars !== undefined) {
                return precomputedBars.value;
            }
            return this._series.bars().valueAt(barIndex);
        };
        this._series = series;
        this._styleGetter = barStyleFnMap[series.seriesType()];
    }

    barStyle(barIndex, precomputedBars) {
        return this._styleGetter(this._findBar, this._series.options(), barIndex, precomputedBars);
    }
}

const CHUNK_SIZE = 30;

class PlotList {
    constructor() {
        this._items = [];
        this._minMaxCache = new Map();
        this._rowSearchCache = new Map();
    }

    last() {
        return this.size() > 0 ? this._items[this._items.length - 1] : null;
    }

    firstIndex() {
        return this.size() > 0 ? this._indexAt(0) : null;
    }

    lastIndex() {
        return this.size() > 0 ? this._indexAt((this._items.length - 1)) : null;
    }

    size() {
        return this._items.length;
    }

    isEmpty() {
        return this.size() === 0;
    }

    contains(index) {
        return this._search(index, 0 /* MismatchDirection.None */) !== null;
    }

    valueAt(index) {
        return this.search(index);
    }

    search(index, searchMode = 0 /* MismatchDirection.None */) {
        const pos = this._search(index, searchMode);
        if (pos === null) {
            return null;
        }
        return Object.assign(Object.assign({}, this._valueAt(pos)), {index: this._indexAt(pos)});
    }

    rows() {
        return this._items;
    }

    minMaxOnRangeCached(start, end, plots) {
        if (this.isEmpty()) {
            return null;
        }
        let result = null;
        for (const plot of plots) {
            const plotMinMax = this._minMaxOnRangeCachedImpl(start, end, plot);
            result = mergeMinMax(result, plotMinMax);
        }
        return result;
    }

    setData(plotRows) {
        this._rowSearchCache.clear();
        this._minMaxCache.clear();
        this._items = plotRows;
    }

    _indexAt(offset) {
        return this._items[offset].index;
    }

    _valueAt(offset) {
        return this._items[offset];
    }

    _search(index, searchMode) {
        const exactPos = this._bsearch(index);
        if (exactPos === null && searchMode !== 0 /* MismatchDirection.None */) {
            switch (searchMode) {
                case -1 /* MismatchDirection.NearestLeft */
                :
                    return this._searchNearestLeft(index);
                case 1 /* MismatchDirection.NearestRight */
                :
                    return this._searchNearestRight(index);
                default:
                    throw new TypeError('Unknown search mode');
            }
        }
        return exactPos;
    }

    _searchNearestLeft(index) {
        let nearestLeftPos = this._lowerbound(index);
        if (nearestLeftPos > 0) {
            nearestLeftPos = nearestLeftPos - 1;
        }
        return (nearestLeftPos !== this._items.length && this._indexAt(nearestLeftPos) < index) ? nearestLeftPos : null;
    }

    _searchNearestRight(index) {
        const nearestRightPos = this._upperbound(index);
        return (nearestRightPos !== this._items.length && index < this._indexAt(nearestRightPos)) ? nearestRightPos : null;
    }

    _bsearch(index) {
        const start = this._lowerbound(index);
        if (start !== this._items.length && !(index < this._items[start].index)) {
            return start;
        }
        return null;
    }

    _lowerbound(index) {
        return lowerBound(this._items, index, (a, b) => a.index < b);
    }

    _upperbound(index) {
        return upperBound(this._items, index, (a, b) => a.index > b);
    }

    _plotMinMax(startIndex, endIndexExclusive, plotIndex) {
        let result = null;
        for (let i = startIndex; i < endIndexExclusive; i++) {
            const values = this._items[i].value;
            const v = values[plotIndex];
            if (Number.isNaN(v)) {
                continue;
            }
            if (result === null) {
                result = {min: v, max: v};
            } else {
                if (v < result.min) {
                    result.min = v;
                }
                if (v > result.max) {
                    result.max = v;
                }
            }
        }
        return result;
    }

    _minMaxOnRangeCachedImpl(start, end, plotIndex) {
        if (this.isEmpty()) {
            return null;
        }
        let result = null;

        const firstIndex = ensureNotNull(this.firstIndex());
        const lastIndex = ensureNotNull(this.lastIndex());
        const s = Math.max(start, firstIndex);
        const e = Math.min(end, lastIndex);
        const cachedLow = Math.ceil(s / CHUNK_SIZE) * CHUNK_SIZE;
        const cachedHigh = Math.max(cachedLow, Math.floor(e / CHUNK_SIZE) * CHUNK_SIZE);
        {
            const startIndex = this._lowerbound(s);
            const endIndex = this._upperbound(Math.min(e, cachedLow, end));
            const plotMinMax = this._plotMinMax(startIndex, endIndex, plotIndex);
            result = mergeMinMax(result, plotMinMax);
        }
        let minMaxCache = this._minMaxCache.get(plotIndex);
        if (minMaxCache === undefined) {
            minMaxCache = new Map();
            this._minMaxCache.set(plotIndex, minMaxCache);
        }
        for (let c = Math.max(cachedLow + 1, s); c < cachedHigh; c += CHUNK_SIZE) {
            const chunkIndex = Math.floor(c / CHUNK_SIZE);
            let chunkMinMax = minMaxCache.get(chunkIndex);
            if (chunkMinMax === undefined) {
                const chunkStart = this._lowerbound(chunkIndex * CHUNK_SIZE);
                const chunkEnd = this._upperbound((chunkIndex + 1) * CHUNK_SIZE - 1);
                chunkMinMax = this._plotMinMax(chunkStart, chunkEnd, plotIndex);
                minMaxCache.set(chunkIndex, chunkMinMax);
            }
            result = mergeMinMax(result, chunkMinMax);
        }
        const startIndex = this._lowerbound(cachedHigh);
        const endIndex = this._upperbound(e);
        const plotMinMax = this._plotMinMax(startIndex, endIndex, plotIndex);
        result = mergeMinMax(result, plotMinMax);
        return result;
    }
}

function mergeMinMax(first, second) {
    if (first === null) {
        return second;
    } else {
        if (second === null) {
            return first;
        } else {

            const min = Math.min(first.min, second.min);
            const max = Math.max(first.max, second.max);
            return {min: min, max: max};
        }
    }
}

function createSeriesPlotList() {
    return new PlotList();
}

function primitivePaneViewsExtractor(wrapper) {
    return wrapper.paneViews();
}

function primitivePricePaneViewsExtractor(wrapper) {
    return wrapper.priceAxisPaneViews();
}

function primitiveTimePaneViewsExtractor(wrapper) {
    return wrapper.timeAxisPaneViews();
}

class Series extends PriceDataSource {
    constructor(model, options, seriesType) {
        super(model);
        this._data = createSeriesPlotList();
        this._priceLineView = new SeriesPriceLinePaneView(this);
        this._customPriceLines = [];
        this._barColorerCache = null;
        this._animationTimeoutId = null;
        this._primitives = [];
        this._options = options;
        this._seriesType = seriesType;
        const priceAxisView = new SeriesPriceAxisView(this);
        this._priceAxisViews = [priceAxisView];
        this._panePriceAxisView = new PanePriceAxisView(priceAxisView, this, model);
        this._recreateFormatter();
        this._recreatePaneViews();
    }

    destroy() {
        if (this._animationTimeoutId !== null) {
            clearTimeout(this._animationTimeoutId);
        }
    }

    priceLineColor(lastBarColor) {
        return this._options.priceLineColor || lastBarColor;
    }

    lastValueData(globalLast) {
        const noDataRes = {noData: true};
        const priceScale = this.priceScale();
        if (this.model().timeScale().isEmpty() || priceScale.isEmpty() || this._data.isEmpty()) {
            return noDataRes;
        }
        const visibleBars = this.model().timeScale().visibleStrictRange();
        const firstValue = this.firstValue();
        if (visibleBars === null || firstValue === null) {
            return noDataRes;
        }


        let bar;
        let lastIndex;
        if (globalLast) {
            const lastBar = this._data.last();
            if (lastBar === null) {
                return noDataRes;
            }
            bar = lastBar;
            lastIndex = lastBar.index;
        } else {
            const endBar = this._data.search(visibleBars.right(), -1 /* MismatchDirection.NearestLeft */);
            if (endBar === null) {
                return noDataRes;
            }
            bar = this._data.valueAt(endBar.index);
            if (bar === null) {
                return noDataRes;
            }
            lastIndex = endBar.index;
        }
        const price = bar.value[3 /* PlotRowValueIndex.Close */];
        const barColorer = this.barColorer();
        const style = barColorer.barStyle(lastIndex, {value: bar});
        const coordinate = priceScale.priceToCoordinate(price, firstValue.value);
        return {
            noData: false,
            price: price,
            text: priceScale.formatPrice(price, firstValue.value),
            formattedPriceAbsolute: priceScale.formatPriceAbsolute(price),
            formattedPricePercentage: priceScale.formatPricePercentage(price, firstValue.value),
            color: style.barColor,
            coordinate: coordinate,
            index: lastIndex,
        };
    }

    barColorer() {
        if (this._barColorerCache !== null) {
            return this._barColorerCache;
        }
        this._barColorerCache = new SeriesBarColorer(this);
        return this._barColorerCache;
    }

    options() {
        return this._options;
    }

    applyOptions(options) {
        const targetPriceScaleId = options.priceScaleId;
        if (targetPriceScaleId !== undefined && targetPriceScaleId !== this._options.priceScaleId) {

            this.model().moveSeriesToScale(this, targetPriceScaleId);
        }
        merge(this._options, options);
        if (options.priceFormat !== undefined) {
            this._recreateFormatter();
            this.model().fullUpdate();
        }
        this.model().updateSource(this);

        this.model().updateCrosshair();
        this._paneView.update('options');
    }

    setData(data, updateInfo) {
        this._data.setData(data);
        this._paneView.update('data');
        const sourcePane = this.model().paneForSource(this);
        this.model().recalculatePane(sourcePane);
        this.model().updateSource(this);
        this.model().updateCrosshair();
        this.model().lightUpdate();
    }

    seriesType() {
        return this._seriesType;
    }

    firstValue() {
        const bar = this.firstBar();
        if (bar === null) {
            return null;
        }
        return {
            value: bar.value[3 /* PlotRowValueIndex.Close */], timePoint: bar.time,
        };
    }

    firstBar() {
        const visibleBars = this.model().timeScale().visibleStrictRange();
        if (visibleBars === null) {
            return null;
        }
        const startTimePoint = visibleBars.left();
        return this._data.search(startTimePoint, 1 /* MismatchDirection.NearestRight */);
    }

    bars() {
        return this._data;
    }

    topPaneViews(pane) {
        return [];
    }

    paneViews() {
        const res = [];
        res.push(this._paneView, this._priceLineView);
        const priceLineViews = this._customPriceLines.map((line) => line.paneView());
        res.push(...priceLineViews);
        return res;
    }

    bottomPaneViews() {
        return this._extractPaneViews(primitivePaneViewsExtractor, 'bottom');
    }

    pricePaneViews(zOrder) {
        return this._extractPaneViews(primitivePricePaneViewsExtractor, zOrder);
    }

    timePaneViews(zOrder) {
        return this._extractPaneViews(primitiveTimePaneViewsExtractor, zOrder);
    }

    primitiveHitTest(x, y) {
        return this._primitives
            .map((primitive) => primitive.hitTest(x, y))
            .filter((result) => result !== null);
    }

    labelPaneViews(pane) {
        return [this._panePriceAxisView, ...this._customPriceLines.map((line) => line.labelPaneView()),];
    }

    priceAxisViews(pane, priceScale) {
        if (priceScale !== this._priceScale && !this._isOverlay()) {
            return [];
        }
        const result = [...this._priceAxisViews];
        for (const customPriceLine of this._customPriceLines) {
            result.push(customPriceLine.priceAxisView());
        }
        this._primitives.forEach((wrapper) => {
            result.push(...wrapper.priceAxisViews());
        });
        return result;
    }

    timeAxisViews() {
        const res = [];
        this._primitives.forEach((wrapper) => {
            res.push(...wrapper.timeAxisViews());
        });
        return res;
    }

    autoscaleInfo(startTimePoint, endTimePoint) {
        if (this._options.autoscaleInfoProvider !== undefined) {
            const autoscaleInfo = this._options.autoscaleInfoProvider(() => {
                const res = this._autoscaleInfoImpl(startTimePoint, endTimePoint);
                return (res === null) ? null : res.toRaw();
            });
            return AutoscaleInfoImpl.fromRaw(autoscaleInfo);
        }
        return this._autoscaleInfoImpl(startTimePoint, endTimePoint);
    }

    minMove() {
        return this._options.priceFormat.minMove;
    }

    formatter() {
        return this._formatter;
    }

    updateAllViews() {
        var _a;
        this._paneView.update();
        for (const priceAxisView of this._priceAxisViews) {
            priceAxisView.update();
        }
        for (const customPriceLine of this._customPriceLines) {
            customPriceLine.update();
        }
        this._priceLineView.update();
        (_a = null) === null || _a === void 0 ? void 0 : _a.update();
        this._primitives.forEach((wrapper) => wrapper.updateAllViews());
    }

    priceScale() {
        return ensureNotNull(super.priceScale());
    }

    title() {
        return this._options.title;
    }

    visible() {
        return this._options.visible;
    }

    _isOverlay() {
        const priceScale = this.priceScale();
        return !isDefaultPriceScale(priceScale.id());
    }

    _autoscaleInfoImpl(startTimePoint, endTimePoint) {
        if (!isInteger(startTimePoint) || !isInteger(endTimePoint) || this._data.isEmpty()) {
            return null;
        }
        const plots = this._seriesType === 'Line' ? [3 /* PlotRowValueIndex.Close */] : [2 /* PlotRowValueIndex.Low */, 1 /* PlotRowValueIndex.High */];
        const barsMinMax = this._data.minMaxOnRangeCached(startTimePoint, endTimePoint, plots);
        let range = barsMinMax !== null ? new PriceRangeImpl(barsMinMax.min, barsMinMax.max) : null;
        this._primitives.forEach((primitive) => {
            const primitiveAutoscale = primitive.autoscaleInfo(startTimePoint, endTimePoint);
            if (primitiveAutoscale === null || primitiveAutoscale === void 0 ? void 0 : primitiveAutoscale.priceRange) {
                const primitiveRange = new PriceRangeImpl(primitiveAutoscale.priceRange.minValue, primitiveAutoscale.priceRange.maxValue);
                range = range !== null ? range.merge(primitiveRange) : primitiveRange;
            }
        });
        return new AutoscaleInfoImpl(range, null);
    }

    _recreateFormatter() {
        switch (this._options.priceFormat.type) {
            case 'custom': {
                this._formatter = {format: this._options.priceFormat.formatter};
                break;
            }
            case 'volume': {
                this._formatter = new VolumeFormatter(this._options.priceFormat.precision);
                break;
            }
            case 'percent': {
                this._formatter = new PercentageFormatter(this._options.priceFormat.precision);
                break;
            }
            default: {
                const priceScale = Math.pow(10, this._options.priceFormat.precision);
                this._formatter = new PriceFormatter(priceScale, this._options.priceFormat.minMove * priceScale);
            }
        }
        if (this._priceScale !== null) {
            this._priceScale.updateFormatter();
        }
    }

    _recreatePaneViews() {
        switch (this._seriesType) {
            case 'Candlestick': {
                this._paneView = new SeriesCandlesticksPaneView(this, this.model());
                break;
            }
            case 'Line': {
                this._paneView = new SeriesLinePaneView(this, this.model());
                break;
            }
            default:
                throw Error('Unknown chart style assigned: ' + this._seriesType);
        }
    }

    _extractPaneViews(extractor, zOrder) {
        return [];
    }
}

class Grid {
    constructor(pane) {
        this._paneView = new GridPaneView(pane);
    }

    paneView() {
        return this._paneView;
    }
}

const defLogFormula = {
    logicalOffset: 4, coordOffset: 0.0001,
};

function fromPercent(value, baseValue) {
    if (baseValue < 0) {
        value = -value;
    }
    return (value / 100) * baseValue + baseValue;
}

function toPercent(value, baseValue) {
    const result = 100 * (value - baseValue) / baseValue;
    return (baseValue < 0 ? -result : result);
}

function toPercentRange(priceRange, baseValue) {
    const minPercent = toPercent(priceRange.minValue(), baseValue);
    const maxPercent = toPercent(priceRange.maxValue(), baseValue);
    return new PriceRangeImpl(minPercent, maxPercent);
}

function fromIndexedTo100(value, baseValue) {
    value -= 100;
    if (baseValue < 0) {
        value = -value;
    }
    return (value / 100) * baseValue + baseValue;
}

function toIndexedTo100(value, baseValue) {
    const result = 100 * (value - baseValue) / baseValue + 100;
    return (baseValue < 0 ? -result : result);
}

function toIndexedTo100Range(priceRange, baseValue) {
    const minPercent = toIndexedTo100(priceRange.minValue(), baseValue);
    const maxPercent = toIndexedTo100(priceRange.maxValue(), baseValue);
    return new PriceRangeImpl(minPercent, maxPercent);
}

function toLog(price, logFormula) {
    const m = Math.abs(price);
    if (m < 1e-15) {
        return 0;
    }
    const res = Math.log10(m + logFormula.coordOffset) + logFormula.logicalOffset;
    return ((price < 0) ? -res : res);
}

function fromLog(logical, logFormula) {
    const m = Math.abs(logical);
    if (m < 1e-15) {
        return 0;
    }
    const res = Math.pow(10, m - logFormula.logicalOffset) - logFormula.coordOffset;
    return (logical < 0) ? -res : res;
}

function convertPriceRangeToLog(priceRange, logFormula) {
    if (priceRange === null) {
        return null;
    }
    const min = toLog(priceRange.minValue(), logFormula);
    const max = toLog(priceRange.maxValue(), logFormula);
    return new PriceRangeImpl(min, max);
}

function canConvertPriceRangeFromLog(priceRange, logFormula) {
    if (priceRange === null) {
        return false;
    }
    const min = fromLog(priceRange.minValue(), logFormula);
    const max = fromLog(priceRange.maxValue(), logFormula);
    return isFinite(min) && isFinite(max);
}

function convertPriceRangeFromLog(priceRange, logFormula) {
    if (priceRange === null) {
        return null;
    }
    const min = fromLog(priceRange.minValue(), logFormula);
    const max = fromLog(priceRange.maxValue(), logFormula);
    return new PriceRangeImpl(min, max);
}

function logFormulaForPriceRange(range) {
    if (range === null) {
        return defLogFormula;
    }
    const diff = Math.abs(range.maxValue() - range.minValue());
    if (diff >= 1 || diff < 1e-15) {
        return defLogFormula;
    }
    const digits = Math.ceil(Math.abs(Math.log10(diff)));
    const logicalOffset = defLogFormula.logicalOffset + digits;
    const coordOffset = 1 / Math.pow(10, logicalOffset);
    return {
        logicalOffset: logicalOffset, coordOffset: coordOffset,
    };
}

function logFormulasAreSame(f1, f2) {
    return f1.logicalOffset === f2.logicalOffset && f1.coordOffset === f2.coordOffset;
}

class PriceTickSpanCalculator {
    constructor(base, integralDividers) {
        this._base = base;
        this._integralDividers = integralDividers;
        if (isBaseDecimal(this._base)) {
            this._fractionalDividers = [2, 2.5, 2];
        } else {
            this._fractionalDividers = [];
            for (let baseRest = this._base; baseRest !== 1;) {
                if ((baseRest % 2) === 0) {
                    this._fractionalDividers.push(2);
                    baseRest /= 2;
                } else if ((baseRest % 5) === 0) {
                    this._fractionalDividers.push(2, 2.5);
                    baseRest /= 5;
                } else {
                    throw new Error('unexpected base');
                }
                if (this._fractionalDividers.length > 100) {
                    throw new Error('something wrong with base');
                }
            }
        }
    }

    tickSpan(high, low, maxTickSpan) {
        const minMovement = (this._base === 0) ? (0) : (1 / this._base);
        let resultTickSpan = Math.pow(10, Math.max(0, Math.ceil(Math.log10(high - low))));
        let index = 0;
        let c = this._integralDividers[0];

        while (true) {


            const resultTickSpanLargerMinMovement = greaterOrEqual(resultTickSpan, minMovement, 1e-14 /* Constants.TickSpanEpsilon */) && resultTickSpan > (minMovement + 1e-14 /* Constants.TickSpanEpsilon */);
            const resultTickSpanLargerMaxTickSpan = greaterOrEqual(resultTickSpan, maxTickSpan * c, 1e-14 /* Constants.TickSpanEpsilon */);
            const resultTickSpanLarger1 = greaterOrEqual(resultTickSpan, 1, 1e-14 /* Constants.TickSpanEpsilon */);
            const haveToContinue = resultTickSpanLargerMinMovement && resultTickSpanLargerMaxTickSpan && resultTickSpanLarger1;
            if (!haveToContinue) {
                break;
            }
            resultTickSpan /= c;
            c = this._integralDividers[++index % this._integralDividers.length];
        }
        if (resultTickSpan <= (minMovement + 1e-14 /* Constants.TickSpanEpsilon */)) {
            resultTickSpan = minMovement;
        }
        resultTickSpan = Math.max(1, resultTickSpan);
        if ((this._fractionalDividers.length > 0) && equal(resultTickSpan, 1, 1e-14 /* Constants.TickSpanEpsilon */)) {
            index = 0;
            c = this._fractionalDividers[0];
            while (greaterOrEqual(resultTickSpan, maxTickSpan * c, 1e-14 /* Constants.TickSpanEpsilon */) && resultTickSpan > (minMovement + 1e-14 /* Constants.TickSpanEpsilon */)) {
                resultTickSpan /= c;
                c = this._fractionalDividers[++index % this._fractionalDividers.length];
            }
        }
        return resultTickSpan;
    }
}

const TICK_DENSITY = 2.5;

class PriceTickMarkBuilder {
    constructor(priceScale, base, coordinateToLogicalFunc, logicalToCoordinateFunc) {
        this._marks = [];
        this._priceScale = priceScale;
        this._base = base;
        this._coordinateToLogicalFunc = coordinateToLogicalFunc;
        this._logicalToCoordinateFunc = logicalToCoordinateFunc;
    }

    tickSpan(high, low) {
        if (high < low) {
            throw new Error('high < low');
        }
        const scaleHeight = this._priceScale.height();
        const markHeight = this._tickMarkHeight();
        const maxTickSpan = (high - low) * markHeight / scaleHeight;
        const spanCalculator1 = new PriceTickSpanCalculator(this._base, [2, 2.5, 2]);
        const spanCalculator2 = new PriceTickSpanCalculator(this._base, [2, 2, 2.5]);
        const spanCalculator3 = new PriceTickSpanCalculator(this._base, [2.5, 2, 2]);
        const spans = [];
        spans.push(spanCalculator1.tickSpan(high, low, maxTickSpan), spanCalculator2.tickSpan(high, low, maxTickSpan), spanCalculator3.tickSpan(high, low, maxTickSpan));
        return min(spans);
    }

    rebuildTickMarks() {
        const priceScale = this._priceScale;
        const firstValue = priceScale.firstValue();
        if (firstValue === null) {
            this._marks = [];
            return;
        }
        const scaleHeight = priceScale.height();
        const bottom = this._coordinateToLogicalFunc(scaleHeight - 1, firstValue);
        const top = this._coordinateToLogicalFunc(0, firstValue);
        const extraTopBottomMargin = this._priceScale.options().entireTextOnly ? this._fontHeight() / 2 : 0;
        const minCoord = extraTopBottomMargin;
        const maxCoord = scaleHeight - 1 - extraTopBottomMargin;
        const high = Math.max(bottom, top);
        const low = Math.min(bottom, top);
        if (high === low) {
            this._marks = [];
            return;
        }
        let span = this.tickSpan(high, low);
        let mod = high % span;
        mod += mod < 0 ? span : 0;
        const sign = (high >= low) ? 1 : -1;
        let prevCoord = null;
        let targetIndex = 0;
        for (let logical = high - mod; logical > low; logical -= span) {
            const coord = this._logicalToCoordinateFunc(logical, firstValue, true);


            if (prevCoord !== null && Math.abs(coord - prevCoord) < this._tickMarkHeight()) {
                continue;
            }

            if (coord < minCoord || coord > maxCoord) {
                continue;
            }
            if (targetIndex < this._marks.length) {
                this._marks[targetIndex].coord = coord;
                this._marks[targetIndex].label = priceScale.formatLogical(logical);
            } else {
                this._marks.push({
                    coord: coord, label: priceScale.formatLogical(logical),
                });
            }
            targetIndex++;
            prevCoord = coord;
            if (priceScale.isLog()) {

                span = this.tickSpan(logical * sign, low);
            }
        }
        this._marks.length = targetIndex;
    }

    marks() {
        return this._marks;
    }

    _fontHeight() {
        return this._priceScale.fontSize();
    }

    _tickMarkHeight() {
        return Math.ceil(this._fontHeight() * TICK_DENSITY);
    }
}

function sortSources(sources) {
    return sources.slice().sort((s1, s2) => {
        return (ensureNotNull(s1.zorder()) - ensureNotNull(s2.zorder()));
    });
}

const percentageFormatter = new PercentageFormatter();
const defaultPriceFormatter = new PriceFormatter(100, 1);

class PriceScale {
    constructor(id, options, layoutOptions, localizationOptions) {
        this._height = 0;
        this._internalHeightCache = null;
        this._priceRange = null;
        this._priceRangeSnapshot = null;
        this._invalidatedForRange = {isValid: false, visibleBars: null};
        this._marginAbove = 0;
        this._marginBelow = 0;
        this._onMarksChanged = new Delegate();
        this._modeChanged = new Delegate();
        this._dataSources = [];
        this._cachedOrderedSources = null;
        this._marksCache = null;
        this._scaleStartPoint = null;
        this._scrollStartPoint = null;
        this._formatter = defaultPriceFormatter;
        this._logFormula = logFormulaForPriceRange(null);
        this._id = id;
        this._options = options;
        this._layoutOptions = layoutOptions;
        this._localizationOptions = localizationOptions;
        this._markBuilder = new PriceTickMarkBuilder(this, 100, this._coordinateToLogical.bind(this), this._logicalToCoordinate.bind(this));
    }

    id() {
        return this._id;
    }

    options() {
        return this._options;
    }

    applyOptions(options) {
        merge(this._options, options);
        this.updateFormatter();
        if (options.mode !== undefined) {
            this.setMode({mode: options.mode});
        }
        if (options.scaleMargins !== undefined) {
            const top = ensureDefined(options.scaleMargins.top);
            const bottom = ensureDefined(options.scaleMargins.bottom);
            if (top < 0 || top > 1) {
                throw new Error(`Invalid top margin - expect value between 0 and 1, given=${top}`);
            }
            if (bottom < 0 || bottom > 1) {
                throw new Error(`Invalid bottom margin - expect value between 0 and 1, given=${bottom}`);
            }
            if (top + bottom > 1) {
                throw new Error(`Invalid margins - sum of margins must be less than 1, given=${top + bottom}`);
            }
            this._invalidateInternalHeightCache();
            this._marksCache = null;
        }
    }

    isAutoScale() {
        return this._options.autoScale;
    }

    isLog() {
        return this._options.mode === 1 /* PriceScaleMode.Logarithmic */;
    }

    isPercentage() {
        return this._options.mode === 2 /* PriceScaleMode.Percentage */;
    }

    isIndexedTo100() {
        return this._options.mode === 3 /* PriceScaleMode.IndexedTo100 */;
    }

    mode() {
        return {
            autoScale: this._options.autoScale, isInverted: this._options.invertScale, mode: this._options.mode,
        };
    }


    setMode(newMode) {
        const oldMode = this.mode();
        let priceRange = null;
        if (newMode.autoScale !== undefined) {
            this._options.autoScale = newMode.autoScale;
        }
        if (newMode.mode !== undefined) {
            this._options.mode = newMode.mode;
            if (newMode.mode === 2 /* PriceScaleMode.Percentage */ || newMode.mode === 3 /* PriceScaleMode.IndexedTo100 */) {
                this._options.autoScale = true;
            }

            this._invalidatedForRange.isValid = false;
        }

        if (oldMode.mode === 1 /* PriceScaleMode.Logarithmic */ && newMode.mode !== oldMode.mode) {
            if (canConvertPriceRangeFromLog(this._priceRange, this._logFormula)) {
                priceRange = convertPriceRangeFromLog(this._priceRange, this._logFormula);
                if (priceRange !== null) {
                    this.setPriceRange(priceRange);
                }
            } else {
                this._options.autoScale = true;
            }
        }

        if (newMode.mode === 1 /* PriceScaleMode.Logarithmic */ && newMode.mode !== oldMode.mode) {
            priceRange = convertPriceRangeToLog(this._priceRange, this._logFormula);
            if (priceRange !== null) {
                this.setPriceRange(priceRange);
            }
        }
        const modeChanged = oldMode.mode !== this._options.mode;
        if (modeChanged && (oldMode.mode === 2 /* PriceScaleMode.Percentage */ || this.isPercentage())) {
            this.updateFormatter();
        }
        if (modeChanged && (oldMode.mode === 3 /* PriceScaleMode.IndexedTo100 */ || this.isIndexedTo100())) {
            this.updateFormatter();
        }
        if (newMode.isInverted !== undefined && oldMode.isInverted !== newMode.isInverted) {
            this._options.invertScale = newMode.isInverted;
            this._onIsInvertedChanged();
        }
        this._modeChanged.fire(oldMode, this.mode());
    }

    modeChanged() {
        return this._modeChanged;
    }

    fontSize() {
        return this._layoutOptions.fontSize;
    }

    height() {
        return this._height;
    }

    setHeight(value) {
        if (this._height === value) {
            return;
        }
        this._height = value;
        this._invalidateInternalHeightCache();
        this._marksCache = null;
    }

    internalHeight() {
        if (this._internalHeightCache) {
            return this._internalHeightCache;
        }
        const res = this.height() - this._topMarginPx() - this._bottomMarginPx();
        this._internalHeightCache = res;
        return res;
    }

    priceRange() {
        this._makeSureItIsValid();
        return this._priceRange;
    }

    setPriceRange(newPriceRange, isForceSetValue) {
        const oldPriceRange = this._priceRange;
        if (!isForceSetValue && !(oldPriceRange === null && newPriceRange !== null) && (oldPriceRange === null || oldPriceRange.equals(newPriceRange))) {
            return;
        }
        this._marksCache = null;
        this._priceRange = newPriceRange;
    }

    isEmpty() {
        this._makeSureItIsValid();
        return this._height === 0 || !this._priceRange || this._priceRange.isEmpty();
    }

    invertedCoordinate(coordinate) {
        return this.isInverted() ? coordinate : this.height() - 1 - coordinate;
    }

    priceToCoordinate(price, baseValue) {
        if (this.isPercentage()) {
            price = toPercent(price, baseValue);
        } else if (this.isIndexedTo100()) {
            price = toIndexedTo100(price, baseValue);
        }
        return this._logicalToCoordinate(price, baseValue);
    }

    pointsArrayToCoordinates(points, baseValue, visibleRange) {
        this._makeSureItIsValid();
        const bh = this._bottomMarginPx();
        const range = ensureNotNull(this.priceRange());
        const min = range.minValue();
        const max = range.maxValue();
        const ih = (this.internalHeight() - 1);
        const isInverted = this.isInverted();
        const hmm = ih / (max - min);
        const fromIndex = (visibleRange === undefined) ? 0 : visibleRange.from;
        const toIndex = (visibleRange === undefined) ? points.length : visibleRange.to;
        const transformFn = this._getCoordinateTransformer();
        for (let i = fromIndex; i < toIndex; i++) {
            const point = points[i];
            const price = point.price;
            if (isNaN(price)) {
                continue;
            }
            let logical = price;
            if (transformFn !== null) {
                logical = transformFn(point.price, baseValue);
            }
            const invCoordinate = bh + hmm * (logical - min);
            point.y = isInverted ? invCoordinate : this._height - 1 - invCoordinate;
        }
    }

    barPricesToCoordinates(pricesList, baseValue, visibleRange) {
        this._makeSureItIsValid();
        const bh = this._bottomMarginPx();
        const range = ensureNotNull(this.priceRange());
        const min = range.minValue();
        const max = range.maxValue();
        const ih = (this.internalHeight() - 1);
        const isInverted = this.isInverted();
        const hmm = ih / (max - min);
        const fromIndex = (visibleRange === undefined) ? 0 : visibleRange.from;
        const toIndex = (visibleRange === undefined) ? pricesList.length : visibleRange.to;
        const transformFn = this._getCoordinateTransformer();
        for (let i = fromIndex; i < toIndex; i++) {
            const bar = pricesList[i];
            let openLogical = bar.open;
            let highLogical = bar.high;
            let lowLogical = bar.low;
            let closeLogical = bar.close;
            if (transformFn !== null) {
                openLogical = transformFn(bar.open, baseValue);
                highLogical = transformFn(bar.high, baseValue);
                lowLogical = transformFn(bar.low, baseValue);
                closeLogical = transformFn(bar.close, baseValue);
            }
            let invCoordinate = bh + hmm * (openLogical - min);
            let coordinate = isInverted ? invCoordinate : this._height - 1 - invCoordinate;
            bar.openY = coordinate;
            invCoordinate = bh + hmm * (highLogical - min);
            coordinate = isInverted ? invCoordinate : this._height - 1 - invCoordinate;
            bar.highY = coordinate;
            invCoordinate = bh + hmm * (lowLogical - min);
            coordinate = isInverted ? invCoordinate : this._height - 1 - invCoordinate;
            bar.lowY = coordinate;
            invCoordinate = bh + hmm * (closeLogical - min);
            coordinate = isInverted ? invCoordinate : this._height - 1 - invCoordinate;
            bar.closeY = coordinate;
        }
    }

    coordinateToPrice(coordinate, baseValue) {
        const logical = this._coordinateToLogical(coordinate, baseValue);
        return this.logicalToPrice(logical, baseValue);
    }

    logicalToPrice(logical, baseValue) {
        let value = logical;
        if (this.isPercentage()) {
            value = fromPercent(value, baseValue);
        } else if (this.isIndexedTo100()) {
            value = fromIndexedTo100(value, baseValue);
        }
        return value;
    }

    dataSources() {
        return this._dataSources;
    }

    orderedSources() {
        if (this._cachedOrderedSources) {
            return this._cachedOrderedSources;
        }
        let sources = [];
        for (let i = 0; i < this._dataSources.length; i++) {
            const ds = this._dataSources[i];
            if (ds.zorder() === null) {
                ds.setZorder(i + 1);
            }
            sources.push(ds);
        }
        sources = sortSources(sources);
        this._cachedOrderedSources = sources;
        return this._cachedOrderedSources;
    }

    addDataSource(source) {
        if (this._dataSources.indexOf(source) !== -1) {
            return;
        }
        this._dataSources.push(source);
        this.updateFormatter();
        this.invalidateSourcesCache();
    }

    removeDataSource(source) {
        const index = this._dataSources.indexOf(source);
        if (index === -1) {
            throw new Error('source is not attached to scale');
        }
        this._dataSources.splice(index, 1);
        if (this._dataSources.length === 0) {
            this.setMode({
                autoScale: true,
            });

            this.setPriceRange(null);
        }
        this.updateFormatter();
        this.invalidateSourcesCache();
    }

    firstValue() {
        let result = null;
        for (const source of this._dataSources) {
            const firstValue = source.firstValue();
            if (firstValue === null) {
                continue;
            }
            if (result === null || firstValue.timePoint < result.timePoint) {
                result = firstValue;
            }
        }
        return result === null ? null : result.value;
    }

    isInverted() {
        return this._options.invertScale;
    }

    marks() {
        const firstValueIsNull = this.firstValue() === null;


        if (this._marksCache !== null && (firstValueIsNull || this._marksCache.firstValueIsNull === firstValueIsNull)) {
            return this._marksCache.marks;
        }
        this._markBuilder.rebuildTickMarks();
        const marks = this._markBuilder.marks();
        this._marksCache = {marks: marks, firstValueIsNull: firstValueIsNull};
        this._onMarksChanged.fire();
        return marks;
    }

    onMarksChanged() {
        return this._onMarksChanged;
    }

    startScale(x) {
        if (this.isPercentage() || this.isIndexedTo100()) {
            return;
        }
        if (this._scaleStartPoint !== null || this._priceRangeSnapshot !== null) {
            return;
        }
        if (this.isEmpty()) {
            return;
        }

        this._scaleStartPoint = this._height - x;
        this._priceRangeSnapshot = ensureNotNull(this.priceRange()).clone();
    }

    scaleTo(x) {
        if (this.isPercentage() || this.isIndexedTo100()) {
            return;
        }
        if (this._scaleStartPoint === null) {
            return;
        }
        this.setMode({
            autoScale: false,
        });

        x = this._height - x;
        if (x < 0) {
            x = 0;
        }
        let scaleCoeff = (this._scaleStartPoint + (this._height - 1) * 0.2) / (x + (this._height - 1) * 0.2);
        const newPriceRange = ensureNotNull(this._priceRangeSnapshot).clone();
        scaleCoeff = Math.max(scaleCoeff, 0.1);
        newPriceRange.scaleAroundCenter(scaleCoeff);
        this.setPriceRange(newPriceRange);
    }

    endScale() {
        if (this.isPercentage() || this.isIndexedTo100()) {
            return;
        }
        this._scaleStartPoint = null;
        this._priceRangeSnapshot = null;
    }

    startScroll(x) {
        if (this.isAutoScale()) {
            return;
        }
        if (this._scrollStartPoint !== null || this._priceRangeSnapshot !== null) {
            return;
        }
        if (this.isEmpty()) {
            return;
        }
        this._scrollStartPoint = x;
        this._priceRangeSnapshot = ensureNotNull(this.priceRange()).clone();
    }

    scrollTo(x) {
        if (this.isAutoScale()) {
            return;
        }
        if (this._scrollStartPoint === null) {
            return;
        }
        const priceUnitsPerPixel = ensureNotNull(this.priceRange()).length() / (this.internalHeight() - 1);
        let pixelDelta = x - this._scrollStartPoint;
        if (this.isInverted()) {
            pixelDelta *= -1;
        }
        const priceDelta = pixelDelta * priceUnitsPerPixel;
        const newPriceRange = ensureNotNull(this._priceRangeSnapshot).clone();
        newPriceRange.shift(priceDelta);
        this.setPriceRange(newPriceRange, true);
        this._marksCache = null;
    }

    endScroll() {
        if (this.isAutoScale()) {
            return;
        }
        if (this._scrollStartPoint === null) {
            return;
        }
        this._scrollStartPoint = null;
        this._priceRangeSnapshot = null;
    }

    formatter() {
        if (!this._formatter) {
            this.updateFormatter();
        }
        return this._formatter;
    }

    formatPrice(price, firstValue) {
        switch (this._options.mode) {
            case 2 /* PriceScaleMode.Percentage */
            :
                return this._formatPercentage(toPercent(price, firstValue));
            case 3 /* PriceScaleMode.IndexedTo100 */
            :
                return this.formatter().format(toIndexedTo100(price, firstValue));
            default:
                return this._formatPrice(price);
        }
    }

    formatLogical(logical) {
        switch (this._options.mode) {
            case 2 /* PriceScaleMode.Percentage */
            :
                return this._formatPercentage(logical);
            case 3 /* PriceScaleMode.IndexedTo100 */
            :
                return this.formatter().format(logical);
            default:
                return this._formatPrice(logical);
        }
    }

    formatPriceAbsolute(price) {
        return this._formatPrice(price, ensureNotNull(this._formatterSource()).formatter());
    }

    formatPricePercentage(price, baseValue) {
        price = toPercent(price, baseValue);
        return this._formatPercentage(price, percentageFormatter);
    }

    sourcesForAutoScale() {
        return this._dataSources;
    }

    recalculatePriceRange(visibleBars) {
        this._invalidatedForRange = {
            visibleBars: visibleBars, isValid: false,
        };
    }

    updateAllViews() {
        this._dataSources.forEach((s) => s.updateAllViews());
    }

    updateFormatter() {
        this._marksCache = null;
        const formatterSource = this._formatterSource();
        let base = 100;
        if (formatterSource !== null) {
            base = Math.round(1 / formatterSource.minMove());
        }
        this._formatter = defaultPriceFormatter;
        if (this.isPercentage()) {
            this._formatter = percentageFormatter;
            base = 100;
        } else if (this.isIndexedTo100()) {
            this._formatter = new PriceFormatter(100, 1);
            base = 100;
        } else {
            if (formatterSource !== null) {

                this._formatter = formatterSource.formatter();
            }
        }
        this._markBuilder = new PriceTickMarkBuilder(this, base, this._coordinateToLogical.bind(this), this._logicalToCoordinate.bind(this));
        this._markBuilder.rebuildTickMarks();
    }

    invalidateSourcesCache() {
        this._cachedOrderedSources = null;
    }

    /**
     * @returns The {@link IPriceDataSource} that will be used as the "formatter source" (take minMove for formatter).
     */
    _formatterSource() {
        return this._dataSources[0] || null;
    }

    _topMarginPx() {
        return this.isInverted() ? this._options.scaleMargins.bottom * this.height() + this._marginBelow : this._options.scaleMargins.top * this.height() + this._marginAbove;
    }

    _bottomMarginPx() {
        return this.isInverted() ? this._options.scaleMargins.top * this.height() + this._marginAbove : this._options.scaleMargins.bottom * this.height() + this._marginBelow;
    }

    _makeSureItIsValid() {
        if (!this._invalidatedForRange.isValid) {
            this._invalidatedForRange.isValid = true;
            this._recalculatePriceRangeImpl();
        }
    }

    _invalidateInternalHeightCache() {
        this._internalHeightCache = null;
    }

    _logicalToCoordinate(logical, baseValue) {
        this._makeSureItIsValid();
        if (this.isEmpty()) {
            return 0;
        }
        logical = this.isLog() && logical ? toLog(logical, this._logFormula) : logical;
        const range = ensureNotNull(this.priceRange());
        const invCoordinate = this._bottomMarginPx() + (this.internalHeight() - 1) * (logical - range.minValue()) / range.length();
        return this.invertedCoordinate(invCoordinate);
    }

    _coordinateToLogical(coordinate, baseValue) {
        this._makeSureItIsValid();
        if (this.isEmpty()) {
            return 0;
        }
        const invCoordinate = this.invertedCoordinate(coordinate);
        const range = ensureNotNull(this.priceRange());
        const logical = range.minValue() + range.length() * ((invCoordinate - this._bottomMarginPx()) / (this.internalHeight() - 1));
        return this.isLog() ? fromLog(logical, this._logFormula) : logical;
    }

    _onIsInvertedChanged() {
        this._marksCache = null;
        this._markBuilder.rebuildTickMarks();
    }


    _recalculatePriceRangeImpl() {
        const visibleBars = this._invalidatedForRange.visibleBars;
        if (visibleBars === null) {
            return;
        }
        let priceRange = null;
        const sources = this.sourcesForAutoScale();
        let marginAbove = 0;
        let marginBelow = 0;
        for (const source of sources) {
            if (!source.visible()) {
                continue;
            }
            const firstValue = source.firstValue();
            if (firstValue === null) {
                continue;
            }
            const autoScaleInfo = source.autoscaleInfo(visibleBars.left(), visibleBars.right());
            let sourceRange = autoScaleInfo && autoScaleInfo.priceRange();
            if (sourceRange !== null) {
                switch (this._options.mode) {
                    case 1 /* PriceScaleMode.Logarithmic */
                    :
                        sourceRange = convertPriceRangeToLog(sourceRange, this._logFormula);
                        break;
                    case 2 /* PriceScaleMode.Percentage */
                    :
                        sourceRange = toPercentRange(sourceRange, firstValue.value);
                        break;
                    case 3 /* PriceScaleMode.IndexedTo100 */
                    :
                        sourceRange = toIndexedTo100Range(sourceRange, firstValue.value);
                        break;
                }
                if (priceRange === null) {
                    priceRange = sourceRange;
                } else {
                    priceRange = priceRange.merge(ensureNotNull(sourceRange));
                }
                if (autoScaleInfo !== null) {
                    const margins = autoScaleInfo.margins();
                    if (margins !== null) {
                        marginAbove = Math.max(marginAbove, margins.above);
                        marginBelow = Math.max(marginAbove, margins.below);
                    }
                }
            }
        }
        if (marginAbove !== this._marginAbove || marginBelow !== this._marginBelow) {
            this._marginAbove = marginAbove;
            this._marginBelow = marginBelow;
            this._marksCache = null;
            this._invalidateInternalHeightCache();
        }
        if (priceRange !== null) {

            if (priceRange.minValue() === priceRange.maxValue()) {
                const formatterSource = this._formatterSource();
                const minMove = formatterSource === null || this.isPercentage() || this.isIndexedTo100() ? 1 : formatterSource.minMove();


                const extendValue = 5 * minMove;
                if (this.isLog()) {
                    priceRange = convertPriceRangeFromLog(priceRange, this._logFormula);
                }
                priceRange = new PriceRangeImpl(priceRange.minValue() - extendValue, priceRange.maxValue() + extendValue);
                if (this.isLog()) {
                    priceRange = convertPriceRangeToLog(priceRange, this._logFormula);
                }
            }
            if (this.isLog()) {
                const rawRange = convertPriceRangeFromLog(priceRange, this._logFormula);
                const newLogFormula = logFormulaForPriceRange(rawRange);
                if (!logFormulasAreSame(newLogFormula, this._logFormula)) {
                    const rawSnapshot = this._priceRangeSnapshot !== null ? convertPriceRangeFromLog(this._priceRangeSnapshot, this._logFormula) : null;
                    this._logFormula = newLogFormula;
                    priceRange = convertPriceRangeToLog(rawRange, newLogFormula);
                    if (rawSnapshot !== null) {
                        this._priceRangeSnapshot = convertPriceRangeToLog(rawSnapshot, newLogFormula);
                    }
                }
            }
            this.setPriceRange(priceRange);
        } else {

            if (this._priceRange === null) {
                this.setPriceRange(new PriceRangeImpl(-0.5, 0.5));
                this._logFormula = logFormulaForPriceRange(null);
            }
        }
        this._invalidatedForRange.isValid = true;
    }

    _getCoordinateTransformer() {
        if (this.isPercentage()) {
            return toPercent;
        } else if (this.isIndexedTo100()) {
            return toIndexedTo100;
        } else if (this.isLog()) {
            return (price) => toLog(price, this._logFormula);
        }
        return null;
    }

    _formatValue(value, formatter, fallbackFormatter) {
        if (formatter === undefined) {
            if (fallbackFormatter === undefined) {
                fallbackFormatter = this.formatter();
            }
            return fallbackFormatter.format(value);
        }
        return formatter(value);
    }

    _formatPrice(price, fallbackFormatter) {
        return this._formatValue(price, this._localizationOptions.priceFormatter, fallbackFormatter);
    }

    _formatPercentage(percentage, fallbackFormatter) {
        return this._formatValue(percentage, this._localizationOptions.percentageFormatter, fallbackFormatter);
    }
}

const DEFAULT_STRETCH_FACTOR = 1000;

class Pane {
    constructor(timeScale, model) {
        this._dataSources = [];
        this._overlaySourcesByScaleId = new Map();
        this._height = 0;
        this._width = 0;
        this._stretchFactor = DEFAULT_STRETCH_FACTOR;
        this._cachedOrderedSources = null;
        this._destroyed = new Delegate();
        this._timeScale = timeScale;
        this._model = model;
        this._grid = new Grid(this);
        const options = model.options();
        this._leftPriceScale = this._createPriceScale("left" /* DefaultPriceScaleId.Left */, options.leftPriceScale);
        this._rightPriceScale = this._createPriceScale("right" /* DefaultPriceScaleId.Right */, options.rightPriceScale);
        this._leftPriceScale.modeChanged().subscribe(this._onPriceScaleModeChanged.bind(this, this._leftPriceScale), this);
        this._rightPriceScale.modeChanged().subscribe(this._onPriceScaleModeChanged.bind(this, this._rightPriceScale), this);
        this.applyScaleOptions(options);
    }

    applyScaleOptions(options) {
        if (options.leftPriceScale) {
            this._leftPriceScale.applyOptions(options.leftPriceScale);
        }
        if (options.rightPriceScale) {
            this._rightPriceScale.applyOptions(options.rightPriceScale);
        }
        if (options.localization) {
            this._leftPriceScale.updateFormatter();
            this._rightPriceScale.updateFormatter();
        }
        if (options.overlayPriceScales) {
            const sourceArrays = Array.from(this._overlaySourcesByScaleId.values());
            for (const arr of sourceArrays) {
                const priceScale = ensureNotNull(arr[0].priceScale());
                priceScale.applyOptions(options.overlayPriceScales);
                if (options.localization) {
                    priceScale.updateFormatter();
                }
            }
        }
    }

    priceScaleById(id) {
        switch (id) {
            case "left" /* DefaultPriceScaleId.Left */
            : {
                return this._leftPriceScale;
            }
            case "right" /* DefaultPriceScaleId.Right */
            : {
                return this._rightPriceScale;
            }
        }
        if (this._overlaySourcesByScaleId.has(id)) {
            return ensureDefined(this._overlaySourcesByScaleId.get(id))[0].priceScale();
        }
        return null;
    }

    destroy() {
        this.model().priceScalesOptionsChanged().unsubscribeAll(this);
        this._leftPriceScale.modeChanged().unsubscribeAll(this);
        this._rightPriceScale.modeChanged().unsubscribeAll(this);
        this._dataSources.forEach((source) => {
            if (source.destroy) {
                source.destroy();
            }
        });
        this._destroyed.fire();
    }

    stretchFactor() {
        return this._stretchFactor;
    }

    setStretchFactor(factor) {
        this._stretchFactor = factor;
    }

    model() {
        return this._model;
    }

    width() {
        return this._width;
    }

    height() {
        return this._height;
    }

    setWidth(width) {
        this._width = width;
        this.updateAllSources();
    }

    setHeight(height) {
        this._height = height;
        this._leftPriceScale.setHeight(height);
        this._rightPriceScale.setHeight(height);

        this._dataSources.forEach((ds) => {
            if (this.isOverlay(ds)) {
                const priceScale = ds.priceScale();
                if (priceScale !== null) {
                    priceScale.setHeight(height);
                }
            }
        });
        this.updateAllSources();
    }

    dataSources() {
        return this._dataSources;
    }

    isOverlay(source) {
        const priceScale = source.priceScale();
        if (priceScale === null) {
            return true;
        }
        return this._leftPriceScale !== priceScale && this._rightPriceScale !== priceScale;
    }

    addDataSource(source, targetScaleId, zOrder) {
        const targetZOrder = (zOrder !== undefined) ? zOrder : this._getZOrderMinMax().maxZOrder + 1;
        this._insertDataSource(source, targetScaleId, targetZOrder);
    }

    removeDataSource(source) {
        const index = this._dataSources.indexOf(source);
        assert(index !== -1, 'removeDataSource: invalid data source');
        this._dataSources.splice(index, 1);
        const priceScaleId = ensureNotNull(source.priceScale()).id();
        if (this._overlaySourcesByScaleId.has(priceScaleId)) {
            const overlaySources = ensureDefined(this._overlaySourcesByScaleId.get(priceScaleId));
            const overlayIndex = overlaySources.indexOf(source);
            if (overlayIndex !== -1) {
                overlaySources.splice(overlayIndex, 1);
                if (overlaySources.length === 0) {
                    this._overlaySourcesByScaleId.delete(priceScaleId);
                }
            }
        }
        const priceScale = source.priceScale();


        if (priceScale && priceScale.dataSources().indexOf(source) >= 0) {
            priceScale.removeDataSource(source);
        }
        if (priceScale !== null) {
            priceScale.invalidateSourcesCache();
            this.recalculatePriceScale(priceScale);
        }
        this._cachedOrderedSources = null;
    }

    priceScalePosition(priceScale) {
        if (priceScale === this._leftPriceScale) {
            return 'left';
        }
        if (priceScale === this._rightPriceScale) {
            return 'right';
        }
        return 'overlay';
    }

    leftPriceScale() {
        return this._leftPriceScale;
    }

    rightPriceScale() {
        return this._rightPriceScale;
    }

    startScalePrice(priceScale, x) {
        priceScale.startScale(x);
    }

    scalePriceTo(priceScale, x) {
        priceScale.scaleTo(x);
        this.updateAllSources();
    }

    endScalePrice(priceScale) {
        priceScale.endScale();
    }

    startScrollPrice(priceScale, x) {
        priceScale.startScroll(x);
    }

    scrollPriceTo(priceScale, x) {
        priceScale.scrollTo(x);
        this.updateAllSources();
    }

    endScrollPrice(priceScale) {
        priceScale.endScroll();
    }

    updateAllSources() {
        this._dataSources.forEach((source) => {
            source.updateAllViews();
        });
    }

    defaultPriceScale() {
        let priceScale = null;
        if (this._model.options().rightPriceScale.visible && this._rightPriceScale.dataSources().length !== 0) {
            priceScale = this._rightPriceScale;
        } else if (this._model.options().leftPriceScale.visible && this._leftPriceScale.dataSources().length !== 0) {
            priceScale = this._leftPriceScale;
        } else if (this._dataSources.length !== 0) {
            priceScale = this._dataSources[0].priceScale();
        }
        if (priceScale === null) {
            priceScale = this._rightPriceScale;
        }
        return priceScale;
    }

    defaultVisiblePriceScale() {
        let priceScale = null;
        if (this._model.options().rightPriceScale.visible) {
            priceScale = this._rightPriceScale;
        } else if (this._model.options().leftPriceScale.visible) {
            priceScale = this._leftPriceScale;
        }
        return priceScale;
    }

    recalculatePriceScale(priceScale) {
        if (priceScale === null || !priceScale.isAutoScale()) {
            return;
        }
        this._recalculatePriceScaleImpl(priceScale);
    }

    resetPriceScale(priceScale) {
        const visibleBars = this._timeScale.visibleStrictRange();
        priceScale.setMode({autoScale: true});
        if (visibleBars !== null) {
            priceScale.recalculatePriceRange(visibleBars);
        }
        this.updateAllSources();
    }

    momentaryAutoScale() {
        this._recalculatePriceScaleImpl(this._leftPriceScale);
        this._recalculatePriceScaleImpl(this._rightPriceScale);
    }

    recalculate() {
        this.recalculatePriceScale(this._leftPriceScale);
        this.recalculatePriceScale(this._rightPriceScale);
        this._dataSources.forEach((ds) => {
            if (this.isOverlay(ds)) {
                this.recalculatePriceScale(ds.priceScale());
            }
        });
        this.updateAllSources();
        this._model.lightUpdate();
    }

    orderedSources() {
        if (this._cachedOrderedSources === null) {
            this._cachedOrderedSources = sortSources(this._dataSources);
        }
        return this._cachedOrderedSources;
    }

    onDestroyed() {
        return this._destroyed;
    }

    grid() {
        return this._grid;
    }

    _recalculatePriceScaleImpl(priceScale) {

        const sourceForAutoScale = priceScale.sourcesForAutoScale();
        if (sourceForAutoScale && sourceForAutoScale.length > 0 && !this._timeScale.isEmpty()) {
            const visibleBars = this._timeScale.visibleStrictRange();
            if (visibleBars !== null) {
                priceScale.recalculatePriceRange(visibleBars);
            }
        }
        priceScale.updateAllViews();
    }

    _getZOrderMinMax() {
        const sources = this.orderedSources();
        if (sources.length === 0) {
            return {minZOrder: 0, maxZOrder: 0};
        }
        let minZOrder = 0;
        let maxZOrder = 0;
        for (let j = 0; j < sources.length; j++) {
            const ds = sources[j];
            const zOrder = ds.zorder();
            if (zOrder !== null) {
                if (zOrder < minZOrder) {
                    minZOrder = zOrder;
                }
                if (zOrder > maxZOrder) {
                    maxZOrder = zOrder;
                }
            }
        }
        return {minZOrder: minZOrder, maxZOrder: maxZOrder};
    }

    _insertDataSource(source, priceScaleId, zOrder) {
        let priceScale = this.priceScaleById(priceScaleId);
        if (priceScale === null) {
            priceScale = this._createPriceScale(priceScaleId, this._model.options().overlayPriceScales);
        }
        this._dataSources.push(source);
        if (!isDefaultPriceScale(priceScaleId)) {
            const overlaySources = this._overlaySourcesByScaleId.get(priceScaleId) || [];
            overlaySources.push(source);
            this._overlaySourcesByScaleId.set(priceScaleId, overlaySources);
        }
        priceScale.addDataSource(source);
        source.setPriceScale(priceScale);
        source.setZorder(zOrder);
        this.recalculatePriceScale(priceScale);
        this._cachedOrderedSources = null;
    }

    _onPriceScaleModeChanged(priceScale, oldMode, newMode) {
        if (oldMode.mode === newMode.mode) {
            return;
        }

        this._recalculatePriceScaleImpl(priceScale);
    }

    _createPriceScale(id, options) {
        const actualOptions = Object.assign({visible: true, autoScale: true}, clone(options));
        const priceScale = new PriceScale(id, actualOptions, this._model.options().layout, this._model.options().localization);
        priceScale.setHeight(this.height());
        return priceScale;
    }
}

class RangeImpl {
    constructor(left, right) {
        assert(left <= right, 'right should be >= left');
        this._left = left;
        this._right = right;
    }

    left() {
        return this._left;
    }

    right() {
        return this._right;
    }

    count() {
        return this._right - this._left + 1;
    }

    contains(index) {
        return this._left <= index && index <= this._right;
    }

    equals(other) {
        return this._left === other.left() && this._right === other.right();
    }
}

class TickMarks {
    constructor() {
        this._marksByWeight = new Map();
        this._cache = null;
        this._uniformDistribution = false;
    }

    setUniformDistribution(val) {
        this._uniformDistribution = val;
        this._cache = null;
    }

    setTimeScalePoints(newPoints, firstChangedPointIndex) {
        this._removeMarksSinceIndex(firstChangedPointIndex);
        this._cache = null;
        for (let index = firstChangedPointIndex; index < newPoints.length; ++index) {
            const point = newPoints[index];
            let marksForWeight = this._marksByWeight.get(point.timeWeight);
            if (marksForWeight === undefined) {
                marksForWeight = [];
                this._marksByWeight.set(point.timeWeight, marksForWeight);
            }
            marksForWeight.push({
                index: index, time: point.time, weight: point.timeWeight, originalTime: point.originalTime,
            });
        }
    }

    build(spacing, maxWidth) {
        const maxIndexesPerMark = Math.ceil(maxWidth / spacing);
        if (this._cache === null || this._cache.maxIndexesPerMark !== maxIndexesPerMark) {
            this._cache = {
                marks: this._buildMarksImpl(maxIndexesPerMark), maxIndexesPerMark: maxIndexesPerMark,
            };
        }
        return this._cache.marks;
    }

    _removeMarksSinceIndex(sinceIndex) {
        if (sinceIndex === 0) {
            this._marksByWeight.clear();
            return;
        }
        const weightsToClear = [];
        this._marksByWeight.forEach((marks, timeWeight) => {
            if (sinceIndex <= marks[0].index) {
                weightsToClear.push(timeWeight);
            } else {
                marks.splice(lowerBound(marks, sinceIndex, (tm) => tm.index < sinceIndex), Infinity);
            }
        });
        for (const weight of weightsToClear) {
            this._marksByWeight.delete(weight);
        }
    }

    _buildMarksImpl(maxIndexesPerMark) {
        let marks = [];
        for (const weight of Array.from(this._marksByWeight.keys()).sort((a, b) => b - a)) {
            if (!this._marksByWeight.get(weight)) {
                continue;
            }

            const prevMarks = marks;
            marks = [];
            const prevMarksLength = prevMarks.length;
            let prevMarksPointer = 0;
            const currentWeight = ensureDefined(this._marksByWeight.get(weight));
            const currentWeightLength = currentWeight.length;
            let rightIndex = Infinity;
            let leftIndex = -Infinity;
            for (let i = 0; i < currentWeightLength; i++) {
                const mark = currentWeight[i];
                const currentIndex = mark.index;


                while (prevMarksPointer < prevMarksLength) {
                    const lastMark = prevMarks[prevMarksPointer];
                    const lastIndex = lastMark.index;
                    if (lastIndex < currentIndex) {
                        prevMarksPointer++;
                        marks.push(lastMark);
                        leftIndex = lastIndex;
                        rightIndex = Infinity;
                    } else {
                        rightIndex = lastIndex;
                        break;
                    }
                }
                if (rightIndex - currentIndex >= maxIndexesPerMark && currentIndex - leftIndex >= maxIndexesPerMark) {

                    marks.push(mark);
                    leftIndex = currentIndex;
                } else {
                    if (this._uniformDistribution) {
                        return prevMarks;
                    }
                }
            }

            for (; prevMarksPointer < prevMarksLength; prevMarksPointer++) {
                marks.push(prevMarks[prevMarksPointer]);
            }
        }
        return marks;
    }
}

class TimeScaleVisibleRange {
    constructor(logicalRange) {
        this._logicalRange = logicalRange;
    }

    strictRange() {
        if (this._logicalRange === null) {
            return null;
        }
        return new RangeImpl(Math.floor(this._logicalRange.left()), Math.ceil(this._logicalRange.right()));
    }

    logicalRange() {
        return this._logicalRange;
    }

    static invalid() {
        return new TimeScaleVisibleRange(null);
    }
}

const defaultTickMarkMaxCharacterLength = 8;

function markWithGreaterWeight(a, b) {
    return a.weight > b.weight ? a : b;
}

class TimeScale {
    constructor(model, options, localizationOptions, horzScaleBehavior) {
        this._width = 0;
        this._baseIndexOrNull = null;
        this._points = [];
        this._scrollStartPoint = null;
        this._scaleStartPoint = null;
        this._tickMarks = new TickMarks();
        this._visibleRange = TimeScaleVisibleRange.invalid();
        this._visibleRangeInvalidated = true;
        this._visibleBarsChanged = new Delegate();
        this._logicalRangeChanged = new Delegate();
        this._optionsApplied = new Delegate();
        this._commonTransitionStartState = null;
        this._timeMarksCache = null;
        this._labels = [];
        this._options = options;
        this._localizationOptions = localizationOptions;
        this._rightOffset = options.rightOffset;
        this._barSpacing = options.barSpacing;
        this._model = model;
        this._horzScaleBehavior = horzScaleBehavior;
        this._updateDateTimeFormatter();
        this._tickMarks.setUniformDistribution(options.uniformDistribution);
    }

    options() {
        return this._options;
    }

    applyLocalizationOptions(localizationOptions) {
        merge(this._localizationOptions, localizationOptions);
        this._invalidateTickMarks();
        this._updateDateTimeFormatter();
    }

    applyOptions(options, localizationOptions) {
        var _a;
        merge(this._options, options);
        if (this._options.fixLeftEdge) {
            this._doFixLeftEdge();
        }
        if (this._options.fixRightEdge) {
            this._doFixRightEdge();
        }


        if (options.barSpacing !== undefined) {
            this._model.setBarSpacing(options.barSpacing);
        }
        if (options.rightOffset !== undefined) {
            this._model.setRightOffset(options.rightOffset);
        }
        if (options.minBarSpacing !== undefined) {
            this._model.setBarSpacing((_a = options.barSpacing) !== null && _a !== void 0 ? _a : this._barSpacing);
        }
        this._invalidateTickMarks();
        this._updateDateTimeFormatter();
        this._optionsApplied.fire();
    }

    indexToTime(index) {
        var _a, _b;
        return (_b = (_a = this._points[index]) === null || _a === void 0 ? void 0 : _a.time) !== null && _b !== void 0 ? _b : null;
    }

    indexToTimeScalePoint(index) {
        var _a;
        return (_a = this._points[index]) !== null && _a !== void 0 ? _a : null;
    }

    timeToIndex(time, findNearest) {
        if (this._points.length < 1) {

            return null;
        }
        if (this._horzScaleBehavior.key(time) > this._horzScaleBehavior.key(this._points[this._points.length - 1].time)) {

            return findNearest ? this._points.length - 1 : null;
        }
        const index = lowerBound(this._points, this._horzScaleBehavior.key(time), (a, b) => this._horzScaleBehavior.key(a.time) < b);
        if (this._horzScaleBehavior.key(time) < this._horzScaleBehavior.key(this._points[index].time)) {
            return findNearest ? index : null;
        }
        return index;
    }

    isEmpty() {
        return this._width === 0 || this._points.length === 0 || this._baseIndexOrNull === null;
    }

    visibleStrictRange() {
        this._updateVisibleRange();
        return this._visibleRange.strictRange();
    }

    visibleLogicalRange() {
        this._updateVisibleRange();
        return this._visibleRange.logicalRange();
    }

    logicalRangeForTimeRange(range) {
        return {
            from: ensureNotNull(this.timeToIndex(range.from, true)),
            to: ensureNotNull(this.timeToIndex(range.to, true)),
        };
    }

    width() {
        return this._width;
    }

    setWidth(newWidth) {
        if (!isFinite(newWidth) || newWidth <= 0) {
            return;
        }
        if (this._width === newWidth) {
            return;
        }
        const previousVisibleRange = this.visibleLogicalRange();
        const oldWidth = this._width;
        this._width = newWidth;
        this._visibleRangeInvalidated = true;
        if (this._options.lockVisibleTimeRangeOnResize && oldWidth !== 0) {
            this._barSpacing = this._barSpacing * newWidth / oldWidth;
        }
        if (this._options.fixLeftEdge) {
            if (previousVisibleRange !== null && previousVisibleRange.left() <= 0) {
                const delta = oldWidth - newWidth;
                this._rightOffset -= Math.round(delta / this._barSpacing) + 1;
                this._visibleRangeInvalidated = true;
            }
        }
        this._correctBarSpacing();
        this._correctOffset();
    }

    indexToCoordinate(index) {
        if (this.isEmpty() || !isInteger(index)) {
            return 0;
        }
        const baseIndex = this.baseIndex();
        const deltaFromRight = baseIndex + this._rightOffset - index;
        return this._width - (deltaFromRight + 0.5) * this._barSpacing - 1;
    }

    indexesToCoordinates(points, visibleRange) {
        const baseIndex = this.baseIndex();
        const indexFrom = (visibleRange === undefined) ? 0 : visibleRange.from;
        const indexTo = (visibleRange === undefined) ? points.length : visibleRange.to;
        for (let i = indexFrom; i < indexTo; i++) {
            const index = points[i].time;
            const deltaFromRight = baseIndex + this._rightOffset - index;
            points[i].x = this._width - (deltaFromRight + 0.5) * this._barSpacing - 1;
        }
    }

    coordinateToIndex(x) {
        return Math.ceil(this._coordinateToFloatIndex(x));
    }

    setRightOffset(offset) {
        this._visibleRangeInvalidated = true;
        this._rightOffset = offset;
        this._correctOffset();
        this._model.recalculateAllPanes();
        this._model.lightUpdate();
    }

    barSpacing() {
        return this._barSpacing;
    }

    setBarSpacing(newBarSpacing) {
        this._setBarSpacing(newBarSpacing);
        this._correctOffset();
        this._model.recalculateAllPanes();
        this._model.lightUpdate();
    }

    rightOffset() {
        return this._rightOffset;
    }

    marks() {
        if (this.isEmpty()) {
            return null;
        }
        if (this._timeMarksCache !== null) {
            return this._timeMarksCache;
        }
        const spacing = this._barSpacing;
        const fontSize = this._model.options().layout.fontSize;
        const pixelsPer8Characters = (fontSize + 4) * 5;
        const pixelsPerCharacter = pixelsPer8Characters / defaultTickMarkMaxCharacterLength;
        const maxLabelWidth = pixelsPerCharacter * (this._options.tickMarkMaxCharacterLength || defaultTickMarkMaxCharacterLength);
        const indexPerLabel = Math.round(maxLabelWidth / spacing);
        const visibleBars = ensureNotNull(this.visibleStrictRange());
        const firstBar = Math.max(visibleBars.left(), visibleBars.left() - indexPerLabel);
        const lastBar = Math.max(visibleBars.right(), visibleBars.right() - indexPerLabel);
        const items = this._tickMarks.build(spacing, maxLabelWidth);

        const earliestIndexOfSecondLabel = this._firstIndex() + indexPerLabel;

        const indexOfSecondLastLabel = this._lastIndex() - indexPerLabel;
        const isAllScalingAndScrollingDisabled = this._isAllScalingAndScrollingDisabled();
        const isLeftEdgeFixed = this._options.fixLeftEdge || isAllScalingAndScrollingDisabled;
        const isRightEdgeFixed = this._options.fixRightEdge || isAllScalingAndScrollingDisabled;
        let targetIndex = 0;
        for (const tm of items) {
            if (!(firstBar <= tm.index && tm.index <= lastBar)) {
                continue;
            }
            let label;
            if (targetIndex < this._labels.length) {
                label = this._labels[targetIndex];
                label.coord = this.indexToCoordinate(tm.index);
                label.label = this._formatLabel(tm);
                label.weight = tm.weight;
            } else {
                label = {
                    needAlignCoordinate: false,
                    coord: this.indexToCoordinate(tm.index),
                    label: this._formatLabel(tm),
                    weight: tm.weight,
                };
                this._labels.push(label);
            }
            if (this._barSpacing > (maxLabelWidth / 2) && !isAllScalingAndScrollingDisabled) {

                label.needAlignCoordinate = false;
            } else {


                label.needAlignCoordinate = (isLeftEdgeFixed && tm.index <= earliestIndexOfSecondLabel) || (isRightEdgeFixed && tm.index >= indexOfSecondLastLabel);
            }
            targetIndex++;
        }
        this._labels.length = targetIndex;
        this._timeMarksCache = this._labels;
        return this._labels;
    }

    restoreDefault() {
        this._visibleRangeInvalidated = true;
        this.setBarSpacing(this._options.barSpacing);
        this.setRightOffset(this._options.rightOffset);
    }

    setBaseIndex(baseIndex) {
        this._visibleRangeInvalidated = true;
        this._baseIndexOrNull = baseIndex;
        this._correctOffset();
        this._doFixLeftEdge();
    }

    /**
     * Zoom in/out the scale around a `zoomPoint` on `scale` value.
     *
     * @param zoomPoint - X coordinate of the point to apply the zoom.
     * If `rightBarStaysOnScroll` option is disabled, then will be used to restore right offset.
     * @param scale - Zoom value (in 1/10 parts of current bar spacing).
     * Negative value means zoom out, positive - zoom in.
     */
    zoom(zoomPoint, scale) {
        const floatIndexAtZoomPoint = this._coordinateToFloatIndex(zoomPoint);
        const barSpacing = this.barSpacing();
        const newBarSpacing = barSpacing + scale * (barSpacing / 10);

        this.setBarSpacing(newBarSpacing);
        if (!this._options.rightBarStaysOnScroll) {

            this.setRightOffset(this.rightOffset() + (floatIndexAtZoomPoint - this._coordinateToFloatIndex(zoomPoint)));
        }
    }

    startScale(x) {
        if (this._scrollStartPoint) {
            this.endScroll();
        }
        if (this._scaleStartPoint !== null || this._commonTransitionStartState !== null) {
            return;
        }
        if (this.isEmpty()) {
            return;
        }
        this._scaleStartPoint = x;
        this._saveCommonTransitionsStartState();
    }

    scaleTo(x) {
        if (this._commonTransitionStartState === null) {
            return;
        }
        const startLengthFromRight = clamp(this._width - x, 0, this._width);
        const currentLengthFromRight = clamp(this._width - ensureNotNull(this._scaleStartPoint), 0, this._width);
        if (startLengthFromRight === 0 || currentLengthFromRight === 0) {
            return;
        }
        this.setBarSpacing(this._commonTransitionStartState.barSpacing * startLengthFromRight / currentLengthFromRight);
    }

    endScale() {
        if (this._scaleStartPoint === null) {
            return;
        }
        this._scaleStartPoint = null;
        this._clearCommonTransitionsStartState();
    }

    startScroll(x) {
        if (this._scrollStartPoint !== null || this._commonTransitionStartState !== null) {
            return;
        }
        if (this.isEmpty()) {
            return;
        }
        this._scrollStartPoint = x;
        this._saveCommonTransitionsStartState();
    }

    scrollTo(x) {
        if (this._scrollStartPoint === null) {
            return;
        }
        const shiftInLogical = (this._scrollStartPoint - x) / this.barSpacing();
        this._rightOffset = ensureNotNull(this._commonTransitionStartState).rightOffset + shiftInLogical;
        this._visibleRangeInvalidated = true;

        this._correctOffset();
    }

    endScroll() {
        if (this._scrollStartPoint === null) {
            return;
        }
        this._scrollStartPoint = null;
        this._clearCommonTransitionsStartState();
    }

    scrollToRealTime() {
        this.scrollToOffsetAnimated(this._options.rightOffset);
    }

    scrollToOffsetAnimated(offset, animationDuration = 400 /* Constants.DefaultAnimationDuration */) {
        if (!isFinite(offset)) {
            throw new RangeError('offset is required and must be finite number');
        }
        if (!isFinite(animationDuration) || animationDuration <= 0) {
            throw new RangeError('animationDuration (optional) must be finite positive number');
        }
        const source = this._rightOffset;
        const animationStart = performance.now();
        this._model.setTimeScaleAnimation({
            finished: (time) => (time - animationStart) / animationDuration >= 1, getPosition: (time) => {
                const animationProgress = (time - animationStart) / animationDuration;
                const finishAnimation = animationProgress >= 1;
                return finishAnimation ? offset : source + (offset - source) * animationProgress;
            },
        });
    }

    update(newPoints, firstChangedPointIndex) {
        this._visibleRangeInvalidated = true;
        this._points = newPoints;
        this._tickMarks.setTimeScalePoints(newPoints, firstChangedPointIndex);
        this._correctOffset();
    }

    optionsApplied() {
        return this._optionsApplied;
    }

    baseIndex() {
        return this._baseIndexOrNull || 0;
    }

    setVisibleRange(range) {
        const length = range.count();
        this._setBarSpacing(this._width / length);
        this._rightOffset = range.right() - this.baseIndex();
        this._correctOffset();
        this._visibleRangeInvalidated = true;
        this._model.recalculateAllPanes();
        this._model.lightUpdate();
    }

    fitContent() {
        const first = this._firstIndex();
        const last = this._lastIndex();
        if (first === null || last === null) {
            return;
        }
        this.setVisibleRange(new RangeImpl(first, last + this._options.rightOffset));
    }

    setLogicalRange(range) {
        const barRange = new RangeImpl(range.from, range.to);
        this.setVisibleRange(barRange);
    }

    formatDateTime(timeScalePoint) {
        if (this._localizationOptions.timeFormatter !== undefined) {
            return this._localizationOptions.timeFormatter(timeScalePoint.originalTime);
        }
        return this._horzScaleBehavior.formatHorzItem(timeScalePoint.time);
    }

    _isAllScalingAndScrollingDisabled() {
        const {handleScroll, handleScale} = this._model.options();
        return !handleScroll.horzTouchDrag && !handleScroll.mouseWheel && !handleScroll.pressedMouseMove && !handleScroll.vertTouchDrag && !handleScale.axisPressedMouseMove.time && !handleScale.mouseWheel && !handleScale.pinch;
    }

    _firstIndex() {
        return this._points.length === 0 ? null : 0;
    }

    _lastIndex() {
        return this._points.length === 0 ? null : (this._points.length - 1);
    }

    _rightOffsetForCoordinate(x) {
        return (this._width - 1 - x) / this._barSpacing;
    }

    _coordinateToFloatIndex(x) {
        const deltaFromRight = this._rightOffsetForCoordinate(x);
        const baseIndex = this.baseIndex();
        const index = baseIndex + this._rightOffset - deltaFromRight;


        return Math.round(index * 1000000) / 1000000;
    }

    _setBarSpacing(newBarSpacing) {
        const oldBarSpacing = this._barSpacing;
        this._barSpacing = newBarSpacing;
        this._correctBarSpacing();

        if (oldBarSpacing !== this._barSpacing) {
            this._visibleRangeInvalidated = true;
            this._resetTimeMarksCache();
        }
    }

    _updateVisibleRange() {
        if (!this._visibleRangeInvalidated) {
            return;
        }
        this._visibleRangeInvalidated = false;
        if (this.isEmpty()) {
            this._setVisibleRange(TimeScaleVisibleRange.invalid());
            return;
        }
        const baseIndex = this.baseIndex();
        const newBarsLength = this._width / this._barSpacing;
        const rightBorder = this._rightOffset + baseIndex;
        const leftBorder = rightBorder - newBarsLength + 1;
        const logicalRange = new RangeImpl(leftBorder, rightBorder);
        this._setVisibleRange(new TimeScaleVisibleRange(logicalRange));
    }

    _correctBarSpacing() {
        const minBarSpacing = this._minBarSpacing();
        if (this._barSpacing < minBarSpacing) {
            this._barSpacing = minBarSpacing;
            this._visibleRangeInvalidated = true;
        }
        if (this._width !== 0) {

            const maxBarSpacing = this._width * 0.5;
            if (this._barSpacing > maxBarSpacing) {
                this._barSpacing = maxBarSpacing;
                this._visibleRangeInvalidated = true;
            }
        }
    }

    _minBarSpacing() {
        if (this._options.fixLeftEdge && this._options.fixRightEdge && this._points.length !== 0) {
            return this._width / this._points.length;
        }
        return this._options.minBarSpacing;
    }

    _correctOffset() {
        const maxRightOffset = this._maxRightOffset();
        if (this._rightOffset > maxRightOffset) {
            this._rightOffset = maxRightOffset;
            this._visibleRangeInvalidated = true;
        }
        const minRightOffset = this._minRightOffset();
        if (minRightOffset !== null && this._rightOffset < minRightOffset) {
            this._rightOffset = minRightOffset;
            this._visibleRangeInvalidated = true;
        }
    }

    _minRightOffset() {
        const firstIndex = this._firstIndex();
        const baseIndex = this._baseIndexOrNull;
        if (firstIndex === null || baseIndex === null) {
            return null;
        }
        const barsEstimation = this._options.fixLeftEdge ? this._width / this._barSpacing : Math.min(2 /* Constants.MinVisibleBarsCount */, this._points.length);
        return firstIndex - baseIndex - 1 + barsEstimation;
    }

    _maxRightOffset() {
        return this._options.fixRightEdge ? 0 : (this._width / this._barSpacing) - Math.min(2 /* Constants.MinVisibleBarsCount */, this._points.length);
    }

    _saveCommonTransitionsStartState() {
        this._commonTransitionStartState = {
            barSpacing: this.barSpacing(), rightOffset: this.rightOffset(),
        };
    }

    _clearCommonTransitionsStartState() {
        this._commonTransitionStartState = null;
    }

    _formatLabel(tickMark) {
        return this._formatLabelImpl(tickMark);
    }

    _formatLabelImpl(tickMark) {
        return this._horzScaleBehavior.formatTickmark(tickMark, this._localizationOptions);
    }

    _setVisibleRange(newVisibleRange) {
        const oldVisibleRange = this._visibleRange;
        this._visibleRange = newVisibleRange;
        if (!areRangesEqual(oldVisibleRange.strictRange(), this._visibleRange.strictRange())) {
            this._visibleBarsChanged.fire();
        }
        if (!areRangesEqual(oldVisibleRange.logicalRange(), this._visibleRange.logicalRange())) {
            this._logicalRangeChanged.fire();
        }
        this._resetTimeMarksCache();
    }

    _resetTimeMarksCache() {
        this._timeMarksCache = null;
    }

    _invalidateTickMarks() {
        this._resetTimeMarksCache();
    }

    _updateDateTimeFormatter() {
        this._horzScaleBehavior.updateFormatter(this._localizationOptions);
    }

    _doFixLeftEdge() {
        if (!this._options.fixLeftEdge) {
            return;
        }
        const firstIndex = this._firstIndex();
        if (firstIndex === null) {
            return;
        }
        const visibleRange = this.visibleStrictRange();
        if (visibleRange === null) {
            return;
        }
        const delta = visibleRange.left() - firstIndex;
        if (delta < 0) {
            const leftEdgeOffset = this._rightOffset - delta - 1;
            this.setRightOffset(leftEdgeOffset);
        }
        this._correctBarSpacing();
    }

    _doFixRightEdge() {
        this._correctOffset();
        this._correctBarSpacing();
    }
}

class ChartModel {
    constructor(invalidateHandler, options, horzScaleBehavior) {
        this._panes = [];
        this._serieses = [];
        this._width = 0;
        this._hoveredSource = null;
        this._priceScalesOptionsChanged = new Delegate();
        this._crosshairMoved = new Delegate();
        this._gradientColorsCache = null;
        this._invalidateHandler = invalidateHandler;
        this._options = options;
        this._horzScaleBehavior = horzScaleBehavior;
        this._rendererOptionsProvider = new PriceAxisRendererOptionsProvider(this);
        this._timeScale = new TimeScale(this, options.timeScale, this._options.localization, horzScaleBehavior);
        this._crosshair = new Crosshair(this, options.crosshair);
        this.createPane();
        this._panes[0].setStretchFactor(DEFAULT_STRETCH_FACTOR * 2);
        this._backgroundTopColor = this._getBackgroundColor(0 /* BackgroundColorSide.Top */);
        this._backgroundBottomColor = this._getBackgroundColor(1 /* BackgroundColorSide.Bottom */);
    }

    fullUpdate() {
        this._invalidate(InvalidateMask.full());
    }

    lightUpdate() {
        this._invalidate(InvalidateMask.light());
    }

    cursorUpdate() {
        this._invalidate(new InvalidateMask(1 /* InvalidationLevel.Cursor */));
    }

    updateSource(source) {
        const inv = this._invalidationMaskForSource(source);
        this._invalidate(inv);
    }

    hoveredSource() {
        return this._hoveredSource;
    }

    setHoveredSource(source) {
        const prevSource = this._hoveredSource;
        this._hoveredSource = source;
        if (prevSource !== null) {
            this.updateSource(prevSource.source);
        }
        if (source !== null) {
            this.updateSource(source.source);
        }
    }

    options() {
        return this._options;
    }

    applyOptions(options) {
        merge(this._options, options);
        this._panes.forEach((p) => p.applyScaleOptions(options));
        if (options.timeScale !== undefined) {
            this._timeScale.applyOptions(options.timeScale);
        }
        if (options.localization !== undefined) {
            this._timeScale.applyLocalizationOptions(options.localization);
        }
        if (options.leftPriceScale || options.rightPriceScale) {
            this._priceScalesOptionsChanged.fire();
        }
        this._backgroundTopColor = this._getBackgroundColor(0 /* BackgroundColorSide.Top */);
        this._backgroundBottomColor = this._getBackgroundColor(1 /* BackgroundColorSide.Bottom */);
        this.fullUpdate();
    }

    applyPriceScaleOptions(priceScaleId, options) {
        if (priceScaleId === "left" /* DefaultPriceScaleId.Left */) {
            this.applyOptions({
                leftPriceScale: options,
            });
            return;
        } else if (priceScaleId === "right" /* DefaultPriceScaleId.Right */) {
            this.applyOptions({
                rightPriceScale: options,
            });
            return;
        }
        const res = this.findPriceScale(priceScaleId);
        if (res === null) {
            {
                throw new Error(`Trying to apply price scale options with incorrect ID: ${priceScaleId}`);
            }
        }
        res.priceScale.applyOptions(options);
        this._priceScalesOptionsChanged.fire();
    }

    findPriceScale(priceScaleId) {
        for (const pane of this._panes) {
            const priceScale = pane.priceScaleById(priceScaleId);
            if (priceScale !== null) {
                return {
                    pane: pane, priceScale: priceScale,
                };
            }
        }
        return null;
    }

    timeScale() {
        return this._timeScale;
    }

    panes() {
        return this._panes;
    }

    crosshairSource() {
        return this._crosshair;
    }

    crosshairMoved() {
        return this._crosshairMoved;
    }

    setPaneHeight(pane, height) {
        pane.setHeight(height);
        this.recalculateAllPanes();
    }

    setWidth(width) {
        this._width = width;
        this._timeScale.setWidth(this._width);
        this._panes.forEach((pane) => pane.setWidth(width));
        this.recalculateAllPanes();
    }

    createPane(index) {
        const pane = new Pane(this._timeScale, this);
        if (index !== undefined) {
            this._panes.splice(index, 0, pane);
        } else {

            this._panes.push(pane);
        }
        const actualIndex = (index === undefined) ? this._panes.length - 1 : index;


        const mask = InvalidateMask.full();
        mask.invalidatePane(actualIndex, {
            level: 0 /* InvalidationLevel.None */, autoScale: true,
        });
        this._invalidate(mask);
        return pane;
    }

    startScalePrice(pane, priceScale, x) {
        pane.startScalePrice(priceScale, x);
    }

    scalePriceTo(pane, priceScale, x) {
        pane.scalePriceTo(priceScale, x);
        this.updateCrosshair();
        this._invalidate(this._paneInvalidationMask(pane, 2 /* InvalidationLevel.Light */));
    }

    endScalePrice(pane, priceScale) {
        pane.endScalePrice(priceScale);
        this._invalidate(this._paneInvalidationMask(pane, 2 /* InvalidationLevel.Light */));
    }

    startScrollPrice(pane, priceScale, x) {
        if (priceScale.isAutoScale()) {
            return;
        }
        pane.startScrollPrice(priceScale, x);
    }

    scrollPriceTo(pane, priceScale, x) {
        if (priceScale.isAutoScale()) {
            return;
        }
        pane.scrollPriceTo(priceScale, x);
        this.updateCrosshair();
        this._invalidate(this._paneInvalidationMask(pane, 2 /* InvalidationLevel.Light */));
    }

    endScrollPrice(pane, priceScale) {
        if (priceScale.isAutoScale()) {
            return;
        }
        pane.endScrollPrice(priceScale);
        this._invalidate(this._paneInvalidationMask(pane, 2 /* InvalidationLevel.Light */));
    }

    resetPriceScale(pane, priceScale) {
        pane.resetPriceScale(priceScale);
        this._invalidate(this._paneInvalidationMask(pane, 2 /* InvalidationLevel.Light */));
    }

    startScaleTime(position) {
        this._timeScale.startScale(position);
    }

    /**
     * Zoom in/out the chart (depends on scale value).
     *
     * @param pointX - X coordinate of the point to apply the zoom (the point which should stay on its place)
     * @param scale - Zoom value. Negative value means zoom out, positive - zoom in.
     */
    zoomTime(pointX, scale) {
        const timeScale = this.timeScale();
        if (timeScale.isEmpty() || scale === 0) {
            return;
        }
        const timeScaleWidth = timeScale.width();
        pointX = Math.max(1, Math.min(pointX, timeScaleWidth));
        timeScale.zoom(pointX, scale);
        this.recalculateAllPanes();
    }

    scrollChart(x) {
        this.startScrollTime(0);
        this.scrollTimeTo(x);
        this.endScrollTime();
    }

    scaleTimeTo(x) {
        this._timeScale.scaleTo(x);
        this.recalculateAllPanes();
    }

    endScaleTime() {
        this._timeScale.endScale();
        this.lightUpdate();
    }

    startScrollTime(x) {
        this._timeScale.startScroll(x);
    }

    scrollTimeTo(x) {
        this._timeScale.scrollTo(x);
        this.recalculateAllPanes();
    }

    endScrollTime() {
        this._timeScale.endScroll();
        this.lightUpdate();
    }

    serieses() {
        return this._serieses;
    }

    setAndSaveCurrentPosition(x, y, event, pane, skipEvent) {
        this._crosshair.saveOriginCoord(x, y);
        let price = NaN;
        let index = this._timeScale.coordinateToIndex(x);
        const visibleBars = this._timeScale.visibleStrictRange();
        if (visibleBars !== null) {
            index = Math.min(Math.max(visibleBars.left(), index), visibleBars.right());
        }
        const priceScale = pane.defaultPriceScale();
        const firstValue = priceScale.firstValue();
        if (firstValue !== null) {
            price = priceScale.coordinateToPrice(y, firstValue);
        }
        this._crosshair.setPosition(index, price, pane);
        this.cursorUpdate();
        if (!skipEvent) {
            this._crosshairMoved.fire(this._crosshair.appliedIndex(), {
                x, y
            }, event);
        }
    }

    clearCurrentPosition(skipEvent) {
        const crosshair = this.crosshairSource();
        crosshair.clearPosition();
        this.cursorUpdate();
        if (!skipEvent) {
            this._crosshairMoved.fire(null, null, null);
        }
    }

    updateCrosshair() {

        const pane = this._crosshair.pane();
        if (pane !== null) {
            const x = this._crosshair.originCoordX();
            const y = this._crosshair.originCoordY();
            this.setAndSaveCurrentPosition(x, y, null, pane);
        }
        this._crosshair.updateAllViews();
    }

    updateTimeScale(newBaseIndex, newPoints, firstChangedPointIndex) {
        const oldFirstTime = this._timeScale.indexToTime(0);
        if (newPoints !== undefined && firstChangedPointIndex !== undefined) {
            this._timeScale.update(newPoints, firstChangedPointIndex);
        }
        const newFirstTime = this._timeScale.indexToTime(0);
        const currentBaseIndex = this._timeScale.baseIndex();
        const visibleBars = this._timeScale.visibleStrictRange();
        if (visibleBars !== null && oldFirstTime !== null && newFirstTime !== null) {
            const isLastSeriesBarVisible = visibleBars.contains(currentBaseIndex);
            const isLeftBarShiftToLeft = this._horzScaleBehavior.key(oldFirstTime) > this._horzScaleBehavior.key(newFirstTime);
            const isSeriesPointsAdded = newBaseIndex !== null && newBaseIndex > currentBaseIndex;
            const isSeriesPointsAddedToRight = isSeriesPointsAdded && !isLeftBarShiftToLeft;
            const allowShiftWhenReplacingWhitespace = this._timeScale.options().allowShiftVisibleRangeOnWhitespaceReplacement;
            const replacedExistingWhitespace = firstChangedPointIndex === undefined;
            const needShiftVisibleRangeOnNewBar = isLastSeriesBarVisible && (!replacedExistingWhitespace || allowShiftWhenReplacingWhitespace) && this._timeScale.options().shiftVisibleRangeOnNewBar;
            if (isSeriesPointsAddedToRight && !needShiftVisibleRangeOnNewBar) {
                const compensationShift = newBaseIndex - currentBaseIndex;
                this._timeScale.setRightOffset(this._timeScale.rightOffset() - compensationShift);
            }
        }
        this._timeScale.setBaseIndex(newBaseIndex);
    }

    recalculatePane(pane) {
        if (pane !== null) {
            pane.recalculate();
        }
    }

    paneForSource(source) {
        const pane = this._panes.find((p) => p.orderedSources().includes(source));
        return pane === undefined ? null : pane;
    }

    recalculateAllPanes() {
        this._panes.forEach((p) => p.recalculate());
        this.updateCrosshair();
    }

    destroy() {
        this._panes.forEach((p) => p.destroy());
        this._panes.length = 0;
        this._options.localization.priceFormatter = undefined;
        this._options.localization.percentageFormatter = undefined;
        this._options.localization.timeFormatter = undefined;
    }

    rendererOptionsProvider() {
        return this._rendererOptionsProvider;
    }

    priceAxisRendererOptions() {
        return this._rendererOptionsProvider.options();
    }

    priceScalesOptionsChanged() {
        return this._priceScalesOptionsChanged;
    }

    createSeries(seriesType, options) {
        const pane = this._panes[0];
        const series = this._createSeries(options, seriesType, pane);
        this._serieses.push(series);
        if (this._serieses.length === 1) {
            this.fullUpdate();
        } else {
            this.lightUpdate();
        }
        return series;
    }

    moveSeriesToScale(series, targetScaleId) {
        const pane = ensureNotNull(this.paneForSource(series));
        pane.removeDataSource(series);
        const target = this.findPriceScale(targetScaleId);
        if (target === null) {
            const zOrder = series.zorder();
            pane.addDataSource(series, targetScaleId, zOrder);
        } else {
            const zOrder = (target.pane === pane) ? series.zorder() : undefined;
            target.pane.addDataSource(series, targetScaleId, zOrder);
        }
    }

    fitContent() {
        const mask = InvalidateMask.light();
        mask.setFitContent();
        this._invalidate(mask);
    }

    setTargetLogicalRange(range) {
        const mask = InvalidateMask.light();
        mask.applyRange(range);
        this._invalidate(mask);
    }

    setBarSpacing(spacing) {
        const mask = InvalidateMask.light();
        mask.setBarSpacing(spacing);
        this._invalidate(mask);
    }

    setRightOffset(offset) {
        const mask = InvalidateMask.light();
        mask.setRightOffset(offset);
        this._invalidate(mask);
    }

    setTimeScaleAnimation(animation) {
        const mask = InvalidateMask.light();
        mask.setTimeScaleAnimation(animation);
        this._invalidate(mask);
    }

    stopTimeScaleAnimation() {
        const mask = InvalidateMask.light();
        mask.stopTimeScaleAnimation();
        this._invalidate(mask);
    }

    defaultVisiblePriceScaleId() {
        return this._options.rightPriceScale.visible ? "right" /* DefaultPriceScaleId.Right */ : "left" /* DefaultPriceScaleId.Left */;
    }

    backgroundBottomColor() {
        return this._backgroundBottomColor;
    }

    backgroundTopColor() {
        return this._backgroundTopColor;
    }

    backgroundColorAtYPercentFromTop(percent) {
        const bottomColor = this._backgroundBottomColor;
        const topColor = this._backgroundTopColor;
        if (bottomColor === topColor) {

            return bottomColor;
        }


        percent = Math.max(0, Math.min(100, Math.round(percent * 100)));
        if (this._gradientColorsCache === null || this._gradientColorsCache.topColor !== topColor || this._gradientColorsCache.bottomColor !== bottomColor) {
            this._gradientColorsCache = {
                topColor: topColor, bottomColor: bottomColor, colors: new Map(),
            };
        } else {
            const cachedValue = this._gradientColorsCache.colors.get(percent);
            if (cachedValue !== undefined) {
                return cachedValue;
            }
        }
        const result = gradientColorAtPercent(topColor, bottomColor, percent / 100);
        this._gradientColorsCache.colors.set(percent, result);
        return result;
    }

    _paneInvalidationMask(pane, level) {
        const inv = new InvalidateMask(level);
        if (pane !== null) {
            const index = this._panes.indexOf(pane);
            inv.invalidatePane(index, {
                level: level,
            });
        }
        return inv;
    }

    _invalidationMaskForSource(source, invalidateType) {
        if (invalidateType === undefined) {
            invalidateType = 2 /* InvalidationLevel.Light */;
        }
        return this._paneInvalidationMask(this.paneForSource(source), invalidateType);
    }

    _invalidate(mask) {
        if (this._invalidateHandler) {
            this._invalidateHandler(mask);
        }
        this._panes.forEach((pane) => pane.grid().paneView().update());
    }

    _createSeries(options, seriesType, pane) {
        const series = new Series(this, options, seriesType);
        const targetScaleId = this.defaultVisiblePriceScaleId();
        pane.addDataSource(series, targetScaleId);
        if (!isDefaultPriceScale(targetScaleId)) {

            series.applyOptions(options);
        }
        return series;
    }

    _getBackgroundColor(side) {
        const layoutOptions = this._options.layout;
        if (layoutOptions.background.type === "gradient" /* ColorType.VerticalGradient */) {
            return side === 0 /* BackgroundColorSide.Top */ ? layoutOptions.background.topColor : layoutOptions.background.bottomColor;
        }
        return layoutOptions.background.color;
    }
}

function fillUpDownCandlesticksColors(options) {
    if (options.borderColor !== undefined) {
        options.borderUpColor = options.borderColor;
        options.borderDownColor = options.borderColor;
    }
    if (options.wickColor !== undefined) {
        options.wickUpColor = options.wickColor;
        options.wickDownColor = options.wickColor;
    }
}

function precisionByMinMove(minMove) {
    if (minMove >= 1) {
        return 0;
    }
    let i = 0;
    for (; i < 8; i++) {
        const intPart = Math.round(minMove);
        const fractPart = Math.abs(intPart - minMove);
        if (fractPart < 1e-8) {
            return i;
        }
        minMove = minMove * 10;
    }
    return i;
}

function isBusinessDay(time) {
    return !isNumber(time) && !isString(time);
}

function isUTCTimestamp(time) {
    return isNumber(time);
}

function hours(count) {
    return count * 60 * 60 * 1000;
}

function minutes(count) {
    return count * 60 * 1000;
}

function seconds(count) {
    return count * 1000;
}

const intradayWeightDivisors = [{divisor: seconds(1), weight: 10 /* TickMarkWeight.Second */}, {
    divisor: minutes(1),
    weight: 20 /* TickMarkWeight.Minute1 */
}, {divisor: minutes(5), weight: 21 /* TickMarkWeight.Minute5 */}, {
    divisor: minutes(30),
    weight: 22 /* TickMarkWeight.Minute30 */
}, {divisor: hours(1), weight: 30 /* TickMarkWeight.Hour1 */}, {
    divisor: hours(3),
    weight: 31 /* TickMarkWeight.Hour3 */
}, {divisor: hours(6), weight: 32 /* TickMarkWeight.Hour6 */}, {
    divisor: hours(12),
    weight: 33 /* TickMarkWeight.Hour12 */
},];

function weightByTime(currentDate, prevDate) {
    if (currentDate.getUTCFullYear() !== prevDate.getUTCFullYear()) {
        return 70 /* TickMarkWeight.Year */;
    } else if (currentDate.getUTCMonth() !== prevDate.getUTCMonth()) {
        return 60 /* TickMarkWeight.Month */;
    } else if (currentDate.getUTCDate() !== prevDate.getUTCDate()) {
        return 50 /* TickMarkWeight.Day */;
    }
    for (let i = intradayWeightDivisors.length - 1; i >= 0; --i) {
        if (Math.floor(prevDate.getTime() / intradayWeightDivisors[i].divisor) !== Math.floor(currentDate.getTime() / intradayWeightDivisors[i].divisor)) {
            return intradayWeightDivisors[i].weight;
        }
    }
    return 0 /* TickMarkWeight.LessThanSecond */;
}

function cast(t) {
    return t;
}

function fillWeightsForPoints(sortedTimePoints, startIndex = 0) {
    if (sortedTimePoints.length === 0) {
        return;
    }
    let prevTime = startIndex === 0 ? null : cast(sortedTimePoints[startIndex - 1].time).timestamp;
    let prevDate = prevTime !== null ? new Date(prevTime * 1000) : null;
    let totalTimeDiff = 0;
    for (let index = startIndex; index < sortedTimePoints.length; ++index) {
        const currentPoint = sortedTimePoints[index];
        const currentDate = new Date(cast(currentPoint.time).timestamp * 1000);
        if (prevDate !== null) {
            currentPoint.timeWeight = weightByTime(currentDate, prevDate);
        }
        totalTimeDiff += cast(currentPoint.time).timestamp - (prevTime || cast(currentPoint.time).timestamp);
        prevTime = cast(currentPoint.time).timestamp;
        prevDate = currentDate;
    }
    if (startIndex === 0 && sortedTimePoints.length > 1) {


        const averageTimeDiff = Math.ceil(totalTimeDiff / (sortedTimePoints.length - 1));
        const approxPrevDate = new Date((cast(sortedTimePoints[0].time).timestamp - averageTimeDiff) * 1000);
        sortedTimePoints[0].timeWeight = weightByTime(new Date(cast(sortedTimePoints[0].time).timestamp * 1000), approxPrevDate);
    }
}

function businessDayConverter(time) {
    let businessDay = time;
    if (isString(time)) {
        businessDay = stringToBusinessDay(time);
    }
    if (!isBusinessDay(businessDay)) {
        throw new Error('time must be of type BusinessDay');
    }
    const date = new Date(Date.UTC(businessDay.year, businessDay.month - 1, businessDay.day, 0, 0, 0, 0));
    return {
        timestamp: Math.round(date.getTime() / 1000), businessDay: businessDay,
    };
}

function timestampConverter(time) {
    if (!isUTCTimestamp(time)) {
        throw new Error('time must be of type isUTCTimestamp');
    }
    return {
        timestamp: time,
    };
}

function selectTimeConverter(data) {
    if (data.length === 0) {
        return null;
    }
    if (isBusinessDay(data[0].time) || isString(data[0].time)) {
        return businessDayConverter;
    }
    return timestampConverter;
}

const validDateRegex = /^\d\d\d\d-\d\d-\d\d$/;

function convertTime(time) {
    if (isUTCTimestamp(time)) {
        return timestampConverter(time);
    }
    if (!isBusinessDay(time)) {
        return businessDayConverter(stringToBusinessDay(time));
    }
    return businessDayConverter(time);
}

function stringToBusinessDay(value) {
    {


        if (!validDateRegex.test(value)) {
            throw new Error(`Invalid date string=${value}, expected format=yyyy-mm-dd`);
        }
    }
    const d = new Date(value);
    if (isNaN(d.getTime())) {
        throw new Error(`Invalid date string=${value}, expected format=yyyy-mm-dd`);
    }
    return {
        day: d.getUTCDate(), month: d.getUTCMonth() + 1, year: d.getUTCFullYear(),
    };
}

function weightToTickMarkType(weight, timeVisible, secondsVisible) {
    switch (weight) {
        case 0 /* TickMarkWeight.LessThanSecond */
        :
        case 10 /* TickMarkWeight.Second */
        :
            return timeVisible ? (secondsVisible ? 4 /* TickMarkType.TimeWithSeconds */ : 3 /* TickMarkType.Time */) : 2 /* TickMarkType.DayOfMonth */;
        case 20 /* TickMarkWeight.Minute1 */
        :
        case 21 /* TickMarkWeight.Minute5 */
        :
        case 22 /* TickMarkWeight.Minute30 */
        :
        case 30 /* TickMarkWeight.Hour1 */
        :
        case 31 /* TickMarkWeight.Hour3 */
        :
        case 32 /* TickMarkWeight.Hour6 */
        :
        case 33 /* TickMarkWeight.Hour12 */
        :
            return timeVisible ? 3 /* TickMarkType.Time */ : 2 /* TickMarkType.DayOfMonth */;
        case 50 /* TickMarkWeight.Day */
        :
            return 2 /* TickMarkType.DayOfMonth */;
        case 60 /* TickMarkWeight.Month */
        :
            return 1 /* TickMarkType.Month */;
        case 70 /* TickMarkWeight.Year */
        :
            return 0 /* TickMarkType.Year */;
    }
}

class HorzScaleBehaviorTime {
    options() {
        return this._options;
    }

    setOptions(options) {
        this._options = options;
        this.updateFormatter(options.localization);
    }

    createConverterToInternalObj(data) {
        return ensureNotNull(selectTimeConverter(data));
    }

    key(item) {

        if (typeof item === 'object' && "timestamp" in item) {
            return item.timestamp;
        } else {
            return this.key(this.convertHorzItemToInternal(item));
        }
    }

    convertHorzItemToInternal(item) {
        return convertTime(item);
    }

    updateFormatter(options) {
        if (!this._options) {
            return;
        }
        const dateFormat = options.dateFormat;
        if (this._options.timeScale.timeVisible) {
            this._dateTimeFormatter = new DateTimeFormatter({
                dateFormat: dateFormat,
                timeFormat: this._options.timeScale.secondsVisible ? '%h:%m:%s' : '%h:%m',
                dateTimeSeparator: '   ',
                locale: options.locale,
            });
        } else {
            this._dateTimeFormatter = new DateFormatter(dateFormat, options.locale);
        }
    }

    formatHorzItem(item) {
        return this._dateTimeFormatter.format(new Date(item.timestamp * 1000));
    }

    formatTickmark(tickMark, localizationOptions) {
        const tickMarkType = weightToTickMarkType(tickMark.weight, this._options.timeScale.timeVisible, this._options.timeScale.secondsVisible);
        return defaultTickMarkFormatter(tickMark.time, tickMarkType, localizationOptions.locale);
    }

    maxTickMarkWeight(tickMarks) {
        let maxWeight = tickMarks.reduce(markWithGreaterWeight, tickMarks[0]).weight;


        if (maxWeight > 30 /* TickMarkWeight.Hour1 */ && maxWeight < 50 /* TickMarkWeight.Day */) {
            maxWeight = 30 /* TickMarkWeight.Hour1 */;
        }
        return maxWeight;
    }

    fillWeightsForPoints(sortedTimePoints, startIndex) {
        fillWeightsForPoints(sortedTimePoints, startIndex);
    }

    static applyDefaults(options) {
        const currentLocale = window.navigator.languages[0];
        const priceFormatter = Intl.NumberFormat(currentLocale, {
            style: 'currency', currency: 'RUB',
        }).format;
        return merge({localization: {dateFormat: 'dd MMM \'yy', priceFormatter: priceFormatter}}, options);
    }
}

function size(_a) {
    var width = _a.width, height = _a.height;
    if (width < 0) {
        throw new Error('Negative width is not allowed for Size');
    }
    if (height < 0) {
        throw new Error('Negative height is not allowed for Size');
    }
    return {
        width: width, height: height,
    };
}

function equalSizes(first, second) {
    return (first.width === second.width) && (first.height === second.height);
}

const Observable = (function () {
    function Observable(win) {
        this._resolutionMediaQueryList = null;
        this._observers = [];
        this._window = win;
        this._installResolutionListener();
    }

    Object.defineProperty(Observable.prototype, "value", {
        get: function () {
            return this._window.devicePixelRatio;
        }, enumerable: false, configurable: true
    });
    Observable.prototype.subscribe = function (next) {
        var _this = this;
        var observer = {next: next};
        this._observers.push(observer);
        return {
            unsubscribe: function () {
                _this._observers = _this._observers.filter(function (o) {
                    return o !== observer;
                });
            },
        };
    };
    Observable.prototype._installResolutionListener = function () {
        if (this._resolutionMediaQueryList !== null) {
            throw new Error('Resolution listener is already installed');
        }
        var dppx = this._window.devicePixelRatio;
        this._resolutionMediaQueryList = this._window.matchMedia("all and (resolution: ".concat(dppx, "dppx)"));
        this._resolutionMediaQueryList.addListener(this._resolutionListener);
    };
    return Observable;
}());

function createObservable(win) {
    return new Observable(win);
}

const DevicePixelContentBoxBinding = (function () {
    function DevicePixelContentBoxBinding(canvasElement, transformBitmapSize, options) {
        var _a;
        this._canvasElement = null;
        this._bitmapSizeChangedListeners = [];
        this._suggestedBitmapSize = null;
        this._suggestedBitmapSizeChangedListeners = [];
        this._devicePixelRatioObservable = null;
        this._canvasElementResizeObserver = null;
        this._canvasElement = canvasElement;
        this._canvasElementClientSize = size({
            width: this._canvasElement.clientWidth, height: this._canvasElement.clientHeight,
        });
        this._transformBitmapSize = transformBitmapSize !== null && transformBitmapSize !== void 0 ? transformBitmapSize : (function (size) {
            return size;
        });
        this._allowResizeObserver = (_a = options === null || options === void 0 ? void 0 : options.allowResizeObserver) !== null && _a !== void 0 ? _a : true;
        this._chooseAndInitObserver();

    }

    DevicePixelContentBoxBinding.prototype.dispose = function () {
        var _a, _b;
        if (this._canvasElement === null) {
            throw new Error('Object is disposed');
        }
        (_a = this._canvasElementResizeObserver) === null || _a === void 0 ? void 0 : _a.disconnect();
        this._canvasElementResizeObserver = null;
        (_b = this._devicePixelRatioObservable) === null || _b === void 0 ? void 0 : _b.dispose();
        this._devicePixelRatioObservable = null;
        this._suggestedBitmapSizeChangedListeners.length = 0;
        this._bitmapSizeChangedListeners.length = 0;
        this._canvasElement = null;
    };
    Object.defineProperty(DevicePixelContentBoxBinding.prototype, "canvasElement", {
        get: function () {
            if (this._canvasElement === null) {
                throw new Error('Object is disposed');
            }
            return this._canvasElement;
        }, enumerable: false, configurable: true
    });
    Object.defineProperty(DevicePixelContentBoxBinding.prototype, "canvasElementClientSize", {
        get: function () {
            return this._canvasElementClientSize;
        }, enumerable: false, configurable: true
    });
    Object.defineProperty(DevicePixelContentBoxBinding.prototype, "bitmapSize", {
        get: function () {
            return size({
                width: this.canvasElement.width, height: this.canvasElement.height,
            });
        }, enumerable: false, configurable: true
    });

    DevicePixelContentBoxBinding.prototype.resizeCanvasElement = function (clientSize) {
        this._canvasElementClientSize = size(clientSize);
        this.canvasElement.style.width = "".concat(this._canvasElementClientSize.width, "px");
        this.canvasElement.style.height = "".concat(this._canvasElementClientSize.height, "px");
        this._invalidateBitmapSize();
    };
    Object.defineProperty(DevicePixelContentBoxBinding.prototype, "suggestedBitmapSize", {
        get: function () {
            return this._suggestedBitmapSize;
        }, enumerable: false, configurable: true
    });
    DevicePixelContentBoxBinding.prototype.subscribeSuggestedBitmapSizeChanged = function (listener) {
        this._suggestedBitmapSizeChangedListeners.push(listener);
    };
    DevicePixelContentBoxBinding.prototype.unsubscribeSuggestedBitmapSizeChanged = function (listener) {
        this._suggestedBitmapSizeChangedListeners = this._suggestedBitmapSizeChangedListeners.filter(function (l) {
            return l !== listener;
        });
    };
    DevicePixelContentBoxBinding.prototype.applySuggestedBitmapSize = function () {
        if (this._suggestedBitmapSize === null) {

            return;
        }
        var oldSuggestedSize = this._suggestedBitmapSize;
        this._suggestedBitmapSize = null;
        this._resizeBitmap(oldSuggestedSize);
        this._emitSuggestedBitmapSizeChanged(oldSuggestedSize, this._suggestedBitmapSize);
    };
    DevicePixelContentBoxBinding.prototype._resizeBitmap = function (newSize) {
        var oldSize = this.bitmapSize;
        if (equalSizes(oldSize, newSize)) {
            return;
        }
        this.canvasElement.width = newSize.width;
        this.canvasElement.height = newSize.height;
        this._emitBitmapSizeChanged(oldSize, newSize);
    };
    DevicePixelContentBoxBinding.prototype._emitBitmapSizeChanged = function (oldSize, newSize) {
        var _this = this;
        this._bitmapSizeChangedListeners.forEach(function (listener) {
            return listener.call(_this, oldSize, newSize);
        });
    };
    DevicePixelContentBoxBinding.prototype._suggestNewBitmapSize = function (newSize) {
        var oldSuggestedSize = this._suggestedBitmapSize;
        var finalNewSize = size(this._transformBitmapSize(newSize, this._canvasElementClientSize));
        var newSuggestedSize = equalSizes(this.bitmapSize, finalNewSize) ? null : finalNewSize;
        if (oldSuggestedSize === null && newSuggestedSize === null) {
            return;
        }
        if (oldSuggestedSize !== null && newSuggestedSize !== null && equalSizes(oldSuggestedSize, newSuggestedSize)) {
            return;
        }
        this._suggestedBitmapSize = newSuggestedSize;
        this._emitSuggestedBitmapSizeChanged(oldSuggestedSize, newSuggestedSize);
    };
    DevicePixelContentBoxBinding.prototype._emitSuggestedBitmapSizeChanged = function (oldSize, newSize) {
        var _this = this;
        this._suggestedBitmapSizeChangedListeners.forEach(function (listener) {
            return listener.call(_this, oldSize, newSize);
        });
    };
    DevicePixelContentBoxBinding.prototype._chooseAndInitObserver = function () {
        var _this = this;
        if (!this._allowResizeObserver) {
            this._initDevicePixelRatioObservable();
            return;
        }
        isDevicePixelContentBoxSupported()
            .then(function (isSupported) {
                return isSupported ? _this._initResizeObserver() : _this._initDevicePixelRatioObservable();
            });
    };

    DevicePixelContentBoxBinding.prototype._initDevicePixelRatioObservable = function () {
        var _this = this;
        if (this._canvasElement === null) {

            return;
        }
        var win = canvasElementWindow(this._canvasElement);
        if (win === null) {
            throw new Error('No window is associated with the canvas');
        }
        this._devicePixelRatioObservable = createObservable(win);
        this._devicePixelRatioObservable.subscribe(function () {
            return _this._invalidateBitmapSize();
        });
        this._invalidateBitmapSize();
    };
    DevicePixelContentBoxBinding.prototype._invalidateBitmapSize = function () {
        var _a, _b;
        if (this._canvasElement === null) {

            return;
        }
        var win = canvasElementWindow(this._canvasElement);
        if (win === null) {
            return;
        }
        var ratio = (_b = (_a = this._devicePixelRatioObservable) === null || _a === void 0 ? void 0 : _a.value) !== null && _b !== void 0 ? _b : win.devicePixelRatio;
        var canvasRects = this._canvasElement.getClientRects();
        var newSize =

            canvasRects[0] !== undefined ? predictedBitmapSize(canvasRects[0], ratio) : size({
                width: this._canvasElementClientSize.width * ratio,
                height: this._canvasElementClientSize.height * ratio,
            });
        this._suggestNewBitmapSize(newSize);
    };

    DevicePixelContentBoxBinding.prototype._initResizeObserver = function () {
        var _this = this;
        if (this._canvasElement === null) {

            return;
        }
        this._canvasElementResizeObserver = new ResizeObserver(function (entries) {
            var entry = entries.find(function (entry) {
                return entry.target === _this._canvasElement;
            });
            if (!entry || !entry.devicePixelContentBoxSize || !entry.devicePixelContentBoxSize[0]) {
                return;
            }
            var entrySize = entry.devicePixelContentBoxSize[0];
            var newSize = size({
                width: entrySize.inlineSize, height: entrySize.blockSize,
            });
            _this._suggestNewBitmapSize(newSize);
        });
        this._canvasElementResizeObserver.observe(this._canvasElement, {box: 'device-pixel-content-box'});
    };
    return DevicePixelContentBoxBinding;
}());

function bindTo(canvasElement, target) {
    if (target.type === 'device-pixel-content-box') {
        return new DevicePixelContentBoxBinding(canvasElement, target.transform, target.options);
    }
    throw new Error('Unsupported binding target');
}

function canvasElementWindow(canvasElement) {
    return canvasElement.ownerDocument.defaultView;
}

function isDevicePixelContentBoxSupported() {
    return new Promise(function (resolve) {
        var ro = new ResizeObserver(function (entries) {
            resolve(entries.every(function (entry) {
                return 'devicePixelContentBoxSize' in entry;
            }));
            ro.disconnect();
        });
        ro.observe(document.body, {box: 'device-pixel-content-box'});
    })
        .catch(function () {
            return false;
        });
}

function predictedBitmapSize(canvasRect, ratio) {
    return size({
        width: Math.round(canvasRect.left * ratio + canvasRect.width * ratio) - Math.round(canvasRect.left * ratio),
        height: Math.round(canvasRect.top * ratio + canvasRect.height * ratio) - Math.round(canvasRect.top * ratio),
    });
}

/**
 * @experimental
 */
var CanvasRenderingTarget2D = /** @class */ (function () {
    function CanvasRenderingTarget2D(context, mediaSize, bitmapSize) {
        if (mediaSize.width === 0 || mediaSize.height === 0) {
            throw new TypeError('Rendering target could only be created on a media with positive width and height');
        }
        this._mediaSize = mediaSize;

        if (bitmapSize.width === 0 || bitmapSize.height === 0) {
            throw new TypeError('Rendering target could only be created using a bitmap with positive integer width and height');
        }
        this._bitmapSize = bitmapSize;
        this._context = context;
    }

    CanvasRenderingTarget2D.prototype.useMediaCoordinateSpace = function (f) {
        try {
            this._context.save();

            this._context.setTransform(1, 0, 0, 1, 0, 0);
            this._context.scale(this._horizontalPixelRatio, this._verticalPixelRatio);
            return f({
                context: this._context, mediaSize: this._mediaSize,
            });
        } finally {
            this._context.restore();
        }
    };
    CanvasRenderingTarget2D.prototype.useBitmapCoordinateSpace = function (f) {
        try {
            this._context.save();

            this._context.setTransform(1, 0, 0, 1, 0, 0);
            return f({
                context: this._context,
                mediaSize: this._mediaSize,
                bitmapSize: this._bitmapSize,
                horizontalPixelRatio: this._horizontalPixelRatio,
                verticalPixelRatio: this._verticalPixelRatio,
            });
        } finally {
            this._context.restore();
        }
    };
    Object.defineProperty(CanvasRenderingTarget2D.prototype, "_horizontalPixelRatio", {
        get: function () {
            return this._bitmapSize.width / this._mediaSize.width;
        }, enumerable: false, configurable: true
    });
    Object.defineProperty(CanvasRenderingTarget2D.prototype, "_verticalPixelRatio", {
        get: function () {
            return this._bitmapSize.height / this._mediaSize.height;
        }, enumerable: false, configurable: true
    });
    return CanvasRenderingTarget2D;
}());

/**
 * @experimental
 */
function tryCreateCanvasRenderingTarget2D(binding, contextOptions) {
    var mediaSize = binding.canvasElementClientSize;
    if (mediaSize.width === 0 || mediaSize.height === 0) {
        return null;
    }
    var bitmapSize = binding.bitmapSize;
    if (bitmapSize.width === 0 || bitmapSize.height === 0) {
        return null;
    }
    var context = binding.canvasElement.getContext('2d', contextOptions);
    if (context === null) {
        return null;
    }
    return new CanvasRenderingTarget2D(context, mediaSize, bitmapSize);
}

const isRunningOnClientSide = typeof window !== 'undefined';

function isFF() {
    if (!isRunningOnClientSide) {
        return false;
    }
    return window.navigator.userAgent.toLowerCase().indexOf('firefox') > -1;
}

function isIOS() {
    if (!isRunningOnClientSide) {
        return false;
    }

    return /iPhone|iPad|iPod/.test(window.navigator.platform);
}

function isChrome() {
    if (!isRunningOnClientSide) {
        return false;
    }
    return window.chrome !== undefined;
}

function isWindows() {
    var _a;
    if (!isRunningOnClientSide) {
        return false;
    }
    if ((_a = navigator === null || navigator === void 0 ? void 0 : navigator.userAgentData) === null || _a === void 0 ? void 0 : _a.platform) {
        return navigator.userAgentData.platform === 'Windows';
    }
    return navigator.userAgent.toLowerCase().indexOf('win') >= 0;
}

function isChromiumBased() {
    if (!isRunningOnClientSide) {
        return false;
    }
    if (!navigator.userAgentData) {
        return false;
    }
    return navigator.userAgentData.brands.some((brand) => {
        return brand.brand.includes('Chromium');
    });
}

function suggestChartSize(originalSize) {
    const integerWidth = Math.floor(originalSize.width);
    const integerHeight = Math.floor(originalSize.height);
    const width = integerWidth - (integerWidth % 2);
    const height = integerHeight - (integerHeight % 2);
    return size({width, height});
}

function suggestTimeScaleHeight(originalHeight) {
    return originalHeight + (originalHeight % 2);
}

function suggestPriceScaleWidth(originalWidth) {
    return originalWidth + (originalWidth % 2);
}

function distanceBetweenPoints(pos1, pos2) {
    return pos1.position - pos2.position;
}

function speedPxPerMSec(pos1, pos2, maxSpeed) {
    const speed = (pos1.position - pos2.position) / (pos1.time - pos2.time);
    return Math.sign(speed) * Math.min(Math.abs(speed), maxSpeed);
}

function durationMSec(speed, dumpingCoeff) {
    const lnDumpingCoeff = Math.log(dumpingCoeff);
    return Math.log(-speed / (lnDumpingCoeff)) / (lnDumpingCoeff);
}

class KineticAnimation {
    constructor(minSpeed, maxSpeed, dumpingCoeff, minMove) {
        this._position1 = null;
        this._position2 = null;
        this._position3 = null;
        this._position4 = null;
        this._animationStartPosition = null;
        this._durationMsecs = 0;
        this._speedPxPerMsec = 0;
        this._minSpeed = minSpeed;
        this._maxSpeed = maxSpeed;
        this._dumpingCoeff = dumpingCoeff;
        this._minMove = minMove;
    }

    addPosition(position, time) {
        if (this._position1 !== null) {
            if (this._position1.time === time) {
                this._position1.position = position;
                return;
            }
            if (Math.abs(this._position1.position - position) < this._minMove) {
                return;
            }
        }
        this._position4 = this._position3;
        this._position3 = this._position2;
        this._position2 = this._position1;
        this._position1 = {time: time, position: position};
    }

    start(position, time) {
        if (this._position1 === null || this._position2 === null) {
            return;
        }
        if (time - this._position1.time > 50 /* Constants.MaxStartDelay */) {
            return;
        }
        let totalDistance = 0;
        const speed1 = speedPxPerMSec(this._position1, this._position2, this._maxSpeed);
        const distance1 = distanceBetweenPoints(this._position1, this._position2);
        const speedItems = [speed1];
        const distanceItems = [distance1];
        totalDistance += distance1;
        if (this._position3 !== null) {
            const speed2 = speedPxPerMSec(this._position2, this._position3, this._maxSpeed);
            if (Math.sign(speed2) === Math.sign(speed1)) {
                const distance2 = distanceBetweenPoints(this._position2, this._position3);
                speedItems.push(speed2);
                distanceItems.push(distance2);
                totalDistance += distance2;
                if (this._position4 !== null) {
                    const speed3 = speedPxPerMSec(this._position3, this._position4, this._maxSpeed);
                    if (Math.sign(speed3) === Math.sign(speed1)) {
                        const distance3 = distanceBetweenPoints(this._position3, this._position4);
                        speedItems.push(speed3);
                        distanceItems.push(distance3);
                        totalDistance += distance3;
                    }
                }
            }
        }
        let resultSpeed = 0;
        for (let i = 0; i < speedItems.length; ++i) {
            resultSpeed += distanceItems[i] / totalDistance * speedItems[i];
        }
        if (Math.abs(resultSpeed) < this._minSpeed) {
            return;
        }
        this._animationStartPosition = {position: position, time: time};
        this._speedPxPerMsec = resultSpeed;
        this._durationMsecs = durationMSec(Math.abs(resultSpeed), this._dumpingCoeff);
    }

    getPosition(time) {
        const startPosition = ensureNotNull(this._animationStartPosition);
        const durationMsecs = time - startPosition.time;
        return startPosition.position + this._speedPxPerMsec * (Math.pow(this._dumpingCoeff, durationMsecs) - 1) / (Math.log(this._dumpingCoeff));
    }

    finished(time) {
        return this._animationStartPosition === null || this._progressDuration(time) === this._durationMsecs;
    }

    _progressDuration(time) {
        const startPosition = ensureNotNull(this._animationStartPosition);
        const progress = time - startPosition.time;
        return Math.min(progress, this._durationMsecs);
    }
}

function createBoundCanvas(parentElement, size) {
    const doc = ensureNotNull(parentElement.ownerDocument);
    const canvas = doc.createElement('canvas');
    parentElement.appendChild(canvas);
    const binding = bindTo(canvas, {
        type: 'device-pixel-content-box', options: {
            allowResizeObserver: false,
        }, transform: (bitmapSize, canvasElementClientSize) => ({
            width: Math.max(bitmapSize.width, canvasElementClientSize.width),
            height: Math.max(bitmapSize.height, canvasElementClientSize.height),
        }),
    });
    binding.resizeCanvasElement(size);
    return binding;
}

function releaseCanvas(canvas) {
    var _a;


    canvas.width = 1;
    canvas.height = 1;
    (_a = canvas.getContext('2d')) === null || _a === void 0 ? void 0 : _a.clearRect(0, 0, 1, 1);
}

function drawBackground(renderer, target, isHovered, hitTestData) {
    if (renderer.drawBackground) {
        renderer.drawBackground(target, isHovered, hitTestData);
    }
}

function drawForeground(renderer, target, isHovered, hitTestData) {
    renderer.draw(target, isHovered, hitTestData);
}

function drawSourcePaneViews(paneViewsGetter, drawRendererFn, source, pane) {
    const paneViews = paneViewsGetter(source, pane);
    for (const paneView of paneViews) {
        const renderer = paneView.renderer();
        if (renderer !== null) {
            drawRendererFn(renderer);
        }
    }
}

function preventScrollByWheelClick(el) {
    if (!isChrome()) {
        return;
    }
    el.addEventListener('mousedown', (e) => {
        if (e.button === 1 /* MouseEventButton.Middle */) {

            e.preventDefault();
            return false;
        }
        return undefined;
    });
}


class MouseEventHandler {
    constructor(target, handler, options) {
        this._clickCount = 0;
        this._clickTimeoutId = null;
        this._clickPosition = {
            x: Number.NEGATIVE_INFINITY, y: Number.POSITIVE_INFINITY
        };
        this._tapCount = 0;
        this._tapTimeoutId = null;
        this._tapPosition = {x: Number.NEGATIVE_INFINITY, y: Number.POSITIVE_INFINITY};
        this._longTapTimeoutId = null;
        this._longTapActive = false;
        this._mouseMoveStartPosition = null;
        this._touchMoveStartPosition = null;
        this._touchMoveExceededManhattanDistance = false;
        this._cancelClick = false;
        this._cancelTap = false;
        this._unsubscribeOutsideMouseEvents = null;
        this._unsubscribeOutsideTouchEvents = null;
        this._unsubscribeMobileSafariEvents = null;
        this._unsubscribeMousemove = null;
        this._unsubscribeRootMouseEvents = null;
        this._unsubscribeRootTouchEvents = null;
        this._startPinchMiddlePoint = null;
        this._startPinchDistance = 0;
        this._pinchPrevented = false;
        this._preventTouchDragProcess = false;
        this._mousePressed = false;
        this._lastTouchEventTimeStamp = 0;


        this._activeTouchId = null;
        this._acceptMouseLeave = !isIOS();

        this._onFirefoxOutsideMouseUp = (mouseUpEvent) => {
            this._mouseUpHandler(mouseUpEvent);
        };

        this._target = target;
        this._handler = handler;
        this._options = options;
        this._init();
    }

    destroy() {
        if (this._unsubscribeOutsideMouseEvents !== null) {
            this._unsubscribeOutsideMouseEvents();
            this._unsubscribeOutsideMouseEvents = null;
        }
        if (this._unsubscribeOutsideTouchEvents !== null) {
            this._unsubscribeOutsideTouchEvents();
            this._unsubscribeOutsideTouchEvents = null;
        }
        if (this._unsubscribeMousemove !== null) {
            this._unsubscribeMousemove();
            this._unsubscribeMousemove = null;
        }
        if (this._unsubscribeRootMouseEvents !== null) {
            this._unsubscribeRootMouseEvents();
            this._unsubscribeRootMouseEvents = null;
        }
        if (this._unsubscribeRootTouchEvents !== null) {
            this._unsubscribeRootTouchEvents();
            this._unsubscribeRootTouchEvents = null;
        }
        if (this._unsubscribeMobileSafariEvents !== null) {
            this._unsubscribeMobileSafariEvents();
            this._unsubscribeMobileSafariEvents = null;
        }
        this._clearLongTapTimeout();
        this._resetClickTimeout();
    }

    _mouseEnterHandler(enterEvent) {
        if (this._unsubscribeMousemove) {
            this._unsubscribeMousemove();
        }
        const boundMouseMoveHandler = this._mouseMoveHandler.bind(this);
        this._unsubscribeMousemove = () => {
            this._target.removeEventListener('mousemove', boundMouseMoveHandler);
        };
        this._target.addEventListener('mousemove', boundMouseMoveHandler);
        if (this._firesTouchEvents(enterEvent)) {
            return;
        }
        const compatEvent = this._makeCompatEvent(enterEvent);
        this._processMouseEvent(compatEvent, this._handler.mouseEnterEvent);
        this._acceptMouseLeave = true;
    }

    _resetClickTimeout() {
        if (this._clickTimeoutId !== null) {
            clearTimeout(this._clickTimeoutId);
        }
        this._clickCount = 0;
        this._clickTimeoutId = null;
        this._clickPosition = {
            x: Number.NEGATIVE_INFINITY, y: Number.POSITIVE_INFINITY
        };
    }

    _resetTapTimeout() {
        if (this._tapTimeoutId !== null) {
            clearTimeout(this._tapTimeoutId);
        }
        this._tapCount = 0;
        this._tapTimeoutId = null;
        this._tapPosition = {x: Number.NEGATIVE_INFINITY, y: Number.POSITIVE_INFINITY};
    }

    _mouseMoveHandler(moveEvent) {
        if (this._mousePressed || this._touchMoveStartPosition !== null) {
            return;
        }
        if (this._firesTouchEvents(moveEvent)) {
            return;
        }
        const compatEvent = this._makeCompatEvent(moveEvent);
        this._processMouseEvent(compatEvent, this._handler.mouseMoveEvent);
        this._acceptMouseLeave = true;
    }

    _touchMoveHandler(moveEvent) {
        const touch = touchWithId(moveEvent.changedTouches, ensureNotNull(this._activeTouchId));
        if (touch === null) {
            return;
        }
        this._lastTouchEventTimeStamp = eventTimeStamp(moveEvent);
        if (this._startPinchMiddlePoint !== null) {
            return;
        }
        if (this._preventTouchDragProcess) {
            return;
        }

        this._pinchPrevented = true;
        const moveInfo = this._touchMouseMoveWithDownInfo(getPosition(touch), ensureNotNull(this._touchMoveStartPosition));
        const {
            xOffset: xOffset, yOffset: yOffset, manhattanDistance: manhattanDistance
        } = moveInfo;
        if (!this._touchMoveExceededManhattanDistance && manhattanDistance < 5 /* Constants.CancelTapManhattanDistance */) {
            return;
        }
        if (!this._touchMoveExceededManhattanDistance) {


            const correctedXOffset = xOffset * 0.5;

            const isVertDrag = yOffset >= correctedXOffset && !this._options.treatVertTouchDragAsPageScroll();
            const isHorzDrag = correctedXOffset > yOffset && !this._options.treatHorzTouchDragAsPageScroll();


            if (!isVertDrag && !isHorzDrag) {
                this._preventTouchDragProcess = true;
            }
            this._touchMoveExceededManhattanDistance = true;

            this._cancelTap = true;
            this._clearLongTapTimeout();
            this._resetTapTimeout();
        }
        if (!this._preventTouchDragProcess) {
            const compatEvent = this._makeCompatEvent(moveEvent, touch);
            this._processTouchEvent(compatEvent, this._handler.touchMoveEvent);


            preventDefault(moveEvent);
        }
    }

    _mouseMoveWithDownHandler(moveEvent) {
        if (moveEvent.button !== 0 /* MouseEventButton.Left */) {
            return;
        }
        const moveInfo = this._touchMouseMoveWithDownInfo(getPosition(moveEvent), ensureNotNull(this._mouseMoveStartPosition));
        const {manhattanDistance: manhattanDistance} = moveInfo;
        if (manhattanDistance >= 5 /* Constants.CancelClickManhattanDistance */) {

            this._cancelClick = true;
            this._resetClickTimeout();
        }
        if (this._cancelClick) {

            const compatEvent = this._makeCompatEvent(moveEvent);
            this._processMouseEvent(compatEvent, this._handler.pressedMouseMoveEvent);
        }
    }

    _touchMouseMoveWithDownInfo(currentPosition, startPosition) {
        const xOffset = Math.abs(startPosition.x - currentPosition.x);
        const yOffset = Math.abs(startPosition.y - currentPosition.y);
        const manhattanDistance = xOffset + yOffset;
        return {
            xOffset: xOffset, yOffset: yOffset, manhattanDistance: manhattanDistance,
        };
    }

    _touchEndHandler(touchEndEvent) {
        let touch = touchWithId(touchEndEvent.changedTouches, ensureNotNull(this._activeTouchId));
        if (touch === null && touchEndEvent.touches.length === 0) {


            touch = touchEndEvent.changedTouches[0];
        }
        if (touch === null) {
            return;
        }
        this._activeTouchId = null;
        this._lastTouchEventTimeStamp = eventTimeStamp(touchEndEvent);
        this._clearLongTapTimeout();
        this._touchMoveStartPosition = null;
        if (this._unsubscribeRootTouchEvents) {
            this._unsubscribeRootTouchEvents();
            this._unsubscribeRootTouchEvents = null;
        }
        const compatEvent = this._makeCompatEvent(touchEndEvent, touch);
        this._processTouchEvent(compatEvent, this._handler.touchEndEvent);
        ++this._tapCount;
        if (this._tapTimeoutId && this._tapCount > 1) {

            const {manhattanDistance: manhattanDistance} = this._touchMouseMoveWithDownInfo(getPosition(touch), this._tapPosition);
            this._resetTapTimeout();
        } else {
            if (!this._cancelTap) {
                this._processTouchEvent(compatEvent, this._handler.tapEvent);


                if (this._handler.tapEvent) {
                    preventDefault(touchEndEvent);
                }
            }
        }
        if (this._tapCount === 0) {
            preventDefault(touchEndEvent);
        }
        if (touchEndEvent.touches.length === 0) {
            if (this._longTapActive) {
                this._longTapActive = false;

                preventDefault(touchEndEvent);
            }
        }
    }

    _mouseUpHandler(mouseUpEvent) {
        if (mouseUpEvent.button !== 0 /* MouseEventButton.Left */) {
            return;
        }
        const compatEvent = this._makeCompatEvent(mouseUpEvent);
        this._mouseMoveStartPosition = null;
        this._mousePressed = false;
        if (this._unsubscribeRootMouseEvents) {
            this._unsubscribeRootMouseEvents();
            this._unsubscribeRootMouseEvents = null;
        }
        if (isFF()) {
            const rootElement = this._target.ownerDocument.documentElement;
            rootElement.removeEventListener('mouseleave', this._onFirefoxOutsideMouseUp);
        }
        if (this._firesTouchEvents(mouseUpEvent)) {
            return;
        }
        this._processMouseEvent(compatEvent, this._handler.mouseUpEvent);
        ++this._clickCount;
        if (this._clickTimeoutId && this._clickCount > 1) {
            const {manhattanDistance: manhattanDistance} = this._touchMouseMoveWithDownInfo(getPosition(mouseUpEvent), this._clickPosition);
            this._resetClickTimeout();
        } else {
            if (!this._cancelClick) {
                this._processMouseEvent(compatEvent, this._handler.mouseClickEvent);
            }
        }
    }

    _clearLongTapTimeout() {
        if (this._longTapTimeoutId === null) {
            return;
        }
        clearTimeout(this._longTapTimeoutId);
        this._longTapTimeoutId = null;
    }

    _touchStartHandler(downEvent) {
        if (this._activeTouchId !== null) {
            return;
        }
        const touch = downEvent.changedTouches[0];
        this._activeTouchId = touch.identifier;
        this._lastTouchEventTimeStamp = eventTimeStamp(downEvent);
        const rootElement = this._target.ownerDocument.documentElement;
        this._cancelTap = false;
        this._touchMoveExceededManhattanDistance = false;
        this._preventTouchDragProcess = false;
        this._touchMoveStartPosition = getPosition(touch);
        if (this._unsubscribeRootTouchEvents) {
            this._unsubscribeRootTouchEvents();
            this._unsubscribeRootTouchEvents = null;
        }
        {
            const boundTouchMoveWithDownHandler = this._touchMoveHandler.bind(this);
            const boundTouchEndHandler = this._touchEndHandler.bind(this);
            this._unsubscribeRootTouchEvents = () => {
                rootElement.removeEventListener('touchmove', boundTouchMoveWithDownHandler);
                rootElement.removeEventListener('touchend', boundTouchEndHandler);
            };
            rootElement.addEventListener('touchmove', boundTouchMoveWithDownHandler, {passive: false});
            rootElement.addEventListener('touchend', boundTouchEndHandler, {passive: false});
            this._clearLongTapTimeout();
            this._longTapTimeoutId = setTimeout(this._longTapHandler.bind(this, downEvent), 240 /* Delay.LongTap */);
        }
        const compatEvent = this._makeCompatEvent(downEvent, touch);
        this._processTouchEvent(compatEvent, this._handler.touchStartEvent);
        if (!this._tapTimeoutId) {
            this._tapCount = 0;
            this._tapTimeoutId = setTimeout(this._resetTapTimeout.bind(this), 500 /* Delay.ResetClick */);
            this._tapPosition = getPosition(touch);
        }
    }

    _mouseDownHandler(downEvent) {
        if (downEvent.button !== 0 /* MouseEventButton.Left */) {
            return;
        }
        const rootElement = this._target.ownerDocument.documentElement;
        if (isFF()) {
            rootElement.addEventListener('mouseleave', this._onFirefoxOutsideMouseUp);
        }
        this._cancelClick = false;
        this._mouseMoveStartPosition = getPosition(downEvent);
        if (this._unsubscribeRootMouseEvents) {
            this._unsubscribeRootMouseEvents();
            this._unsubscribeRootMouseEvents = null;
        }
        {
            const boundMouseMoveWithDownHandler = this._mouseMoveWithDownHandler.bind(this);
            const boundMouseUpHandler = this._mouseUpHandler.bind(this);
            this._unsubscribeRootMouseEvents = () => {
                rootElement.removeEventListener('mousemove', boundMouseMoveWithDownHandler);
                rootElement.removeEventListener('mouseup', boundMouseUpHandler);
            };
            rootElement.addEventListener('mousemove', boundMouseMoveWithDownHandler);
            rootElement.addEventListener('mouseup', boundMouseUpHandler);
        }
        this._mousePressed = true;
        if (this._firesTouchEvents(downEvent)) {
            return;
        }
        const compatEvent = this._makeCompatEvent(downEvent);
        this._processMouseEvent(compatEvent, this._handler.mouseDownEvent);
        if (!this._clickTimeoutId) {
            this._clickCount = 0;
            this._clickTimeoutId = setTimeout(this._resetClickTimeout.bind(this), 500 /* Delay.ResetClick */);
            this._clickPosition = getPosition(downEvent);
        }
    }

    _init() {
        this._target.addEventListener('mouseenter', this._mouseEnterHandler.bind(this));
        this._target.addEventListener('touchcancel', this._clearLongTapTimeout.bind(this));
        {
            const doc = this._target.ownerDocument;
            const outsideHandler = (event) => {
                if (!this._handler.mouseDownOutsideEvent) {
                    return;
                }
                if (event.composed && this._target.contains(event.composedPath()[0])) {
                    return;
                }
                if (event.target && this._target.contains(event.target)) {
                    return;
                }
                this._handler.mouseDownOutsideEvent();
            };
            this._unsubscribeOutsideTouchEvents = () => {
                doc.removeEventListener('touchstart', outsideHandler);
            };
            this._unsubscribeOutsideMouseEvents = () => {
                doc.removeEventListener('mousedown', outsideHandler);
            };
            doc.addEventListener('mousedown', outsideHandler);
            doc.addEventListener('touchstart', outsideHandler, {passive: true});
        }

        this._target.addEventListener('mouseleave', this._mouseLeaveHandler.bind(this));
        this._target.addEventListener('touchstart', this._touchStartHandler.bind(this), {passive: true});
        preventScrollByWheelClick(this._target);
        this._target.addEventListener('mousedown', this._mouseDownHandler.bind(this));
        this._initPinch();

        this._target.addEventListener('touchmove', () => {
        }, {passive: false});
    }

    _initPinch() {
        if (this._handler.pinchStartEvent === undefined && this._handler.pinchEvent === undefined && this._handler.pinchEndEvent === undefined) {
            return;
        }
        this._target.addEventListener('touchstart', (event) => this._checkPinchState(event.touches), {passive: true});
        this._target.addEventListener('touchmove', (event) => {
            if (event.touches.length !== 2 || this._startPinchMiddlePoint === null) {
                return;
            }
            if (this._handler.pinchEvent !== undefined) {
                const currentDistance = getDistance(event.touches[0], event.touches[1]);
                const scale = currentDistance / this._startPinchDistance;
                this._handler.pinchEvent(this._startPinchMiddlePoint, scale);
                preventDefault(event);
            }
        }, {passive: false});
        this._target.addEventListener('touchend', (event) => {
            this._checkPinchState(event.touches);
        });
    }

    _checkPinchState(touches) {
        if (touches.length === 1) {
            this._pinchPrevented = false;
        }
        if (touches.length !== 2 || this._pinchPrevented || this._longTapActive) {
            this._stopPinch();
        } else {
            this._startPinch(touches);
        }
    }

    _startPinch(touches) {
        const box = getBoundingClientRect(this._target);
        this._startPinchMiddlePoint = {
            x: ((touches[0].clientX - box.left) + (touches[1].clientX - box.left)) / 2,
            y: ((touches[0].clientY - box.top) + (touches[1].clientY - box.top)) / 2,
        };
        this._startPinchDistance = getDistance(touches[0], touches[1]);
        if (this._handler.pinchStartEvent !== undefined) {
            this._handler.pinchStartEvent();
        }
        this._clearLongTapTimeout();
    }

    _stopPinch() {
        if (this._startPinchMiddlePoint === null) {
            return;
        }
        this._startPinchMiddlePoint = null;
        if (this._handler.pinchEndEvent !== undefined) {
            this._handler.pinchEndEvent();
        }
    }

    _mouseLeaveHandler(event) {
        if (this._unsubscribeMousemove) {
            this._unsubscribeMousemove();
        }
        if (this._firesTouchEvents(event)) {
            return;
        }
        if (!this._acceptMouseLeave) {


            return;
        }
        const compatEvent = this._makeCompatEvent(event);
        this._processMouseEvent(compatEvent, this._handler.mouseLeaveEvent);

        this._acceptMouseLeave = !isIOS();
    }

    _longTapHandler(event) {
        const touch = touchWithId(event.touches, ensureNotNull(this._activeTouchId));
        if (touch === null) {
            return;
        }
        const compatEvent = this._makeCompatEvent(event, touch);
        this._processTouchEvent(compatEvent, this._handler.longTapEvent);
        this._cancelTap = true;

        this._longTapActive = true;
    }

    _firesTouchEvents(e) {
        if (e.sourceCapabilities && e.sourceCapabilities.firesTouchEvents !== undefined) {
            return e.sourceCapabilities.firesTouchEvents;
        }
        return eventTimeStamp(e) < this._lastTouchEventTimeStamp + 500 /* Delay.PreventFiresTouchEvents */;
    }

    _processTouchEvent(event, callback) {
        if (callback) {
            callback.call(this._handler, event);
        }
    }

    _processMouseEvent(event, callback) {
        if (!callback) {
            return;
        }
        callback.call(this._handler, event);
    }

    _makeCompatEvent(event, touch) {
        const eventLike = touch || event;
        const box = this._target.getBoundingClientRect() || {left: 0, top: 0};
        return {
            clientX: eventLike.clientX,
            clientY: eventLike.clientY,
            pageX: eventLike.pageX,
            pageY: eventLike.pageY,
            screenX: eventLike.screenX,
            screenY: eventLike.screenY,
            localX: (eventLike.clientX - box.left),
            localY: (eventLike.clientY - box.top),
            ctrlKey: event.ctrlKey,
            altKey: event.altKey,
            shiftKey: event.shiftKey,
            metaKey: event.metaKey,
            isTouch: !event.type.startsWith('mouse') && event.type !== 'contextmenu' && event.type !== 'click',
            srcType: event.type,
            target: eventLike.target,
            view: event.view,
            preventDefault: () => {
                if (event.type !== 'touchstart') {
                    preventDefault(event);
                }
            },
        };
    }
}

function getBoundingClientRect(element) {
    return element.getBoundingClientRect() || {left: 0, top: 0};
}

function getDistance(p1, p2) {
    const xDiff = p1.clientX - p2.clientX;
    const yDiff = p1.clientY - p2.clientY;
    return Math.sqrt(xDiff * xDiff + yDiff * yDiff);
}

function preventDefault(event) {
    if (event.cancelable) {
        event.preventDefault();
    }
}

function getPosition(eventLike) {
    return {
        x: eventLike.pageX, y: eventLike.pageY,
    };
}

function eventTimeStamp(e) {

    return e.timeStamp || performance.now();
}

function touchWithId(touches, id) {
    for (let i = 0; i < touches.length; ++i) {
        if (touches[i].identifier === id) {
            return touches[i];
        }
    }
    return null;
}


function comparePrimitiveZOrder(item, reference) {
    return (!reference || (item === 'top' && reference !== 'top') || (item === 'normal' && reference === 'bottom'));
}

function findBestPrimitiveHitTest(sources, x, y) {
    var _a, _b;
    let bestPrimitiveHit;
    let bestHitSource;
    for (const source of sources) {
        const primitiveHitResults = (_b = (_a = source.primitiveHitTest) === null || _a === void 0 ? void 0 : _a.call(source, x, y)) !== null && _b !== void 0 ? _b : [];
        for (const hitResult of primitiveHitResults) {
            if (comparePrimitiveZOrder(hitResult.zOrder, bestPrimitiveHit === null || bestPrimitiveHit === void 0 ? void 0 : bestPrimitiveHit.zOrder)) {
                bestPrimitiveHit = hitResult;
                bestHitSource = source;
            }
        }
    }
    if (!bestPrimitiveHit || !bestHitSource) {
        return null;
    }
    return {
        hit: bestPrimitiveHit, source: bestHitSource,
    };
}

function convertPrimitiveHitResult(primitiveHit) {
    return {
        source: primitiveHit.source, object: {
            externalId: primitiveHit.hit.externalId,
        }, cursorStyle: primitiveHit.hit.cursorStyle,
    };
}

/**
 * Performs a hit test on a collection of pane views to determine which view and object
 * is located at a given coordinate (x, y) and returns the matching pane view and
 * hit-tested result object, or null if no match is found.
 */
function hitTestPaneView(paneViews, x, y) {
    for (const paneView of paneViews) {
        const renderer = paneView.renderer();
        if (renderer !== null && renderer.hitTest) {
            const result = renderer.hitTest(x, y);
            if (result !== null) {
                return {
                    view: paneView, object: result,
                };
            }
        }
    }
    return null;
}

function hitTestPane(pane, x, y) {
    const sources = pane.orderedSources();
    const bestPrimitiveHit = findBestPrimitiveHitTest(sources, x, y);
    if ((bestPrimitiveHit === null || bestPrimitiveHit === void 0 ? void 0 : bestPrimitiveHit.hit.zOrder) === 'top') {


        return convertPrimitiveHitResult(bestPrimitiveHit);
    }
    for (const source of sources) {
        if (bestPrimitiveHit && bestPrimitiveHit.source === source && bestPrimitiveHit.hit.zOrder !== 'bottom' && !bestPrimitiveHit.hit.isBackground) {


            return convertPrimitiveHitResult(bestPrimitiveHit);
        }
        const sourceResult = hitTestPaneView(source.paneViews(pane), x, y);
        if (sourceResult !== null) {
            return {
                source: source, view: sourceResult.view, object: sourceResult.object,
            };
        }
        if (bestPrimitiveHit && bestPrimitiveHit.source === source && bestPrimitiveHit.hit.zOrder !== 'bottom' && bestPrimitiveHit.hit.isBackground) {
            return convertPrimitiveHitResult(bestPrimitiveHit);
        }
    }
    if (bestPrimitiveHit === null || bestPrimitiveHit === void 0 ? void 0 : bestPrimitiveHit.hit) {

        return convertPrimitiveHitResult(bestPrimitiveHit);
    }
    return null;
}

function buildPriceAxisViewsGetter(zOrder, priceScaleId) {
    return (source) => {
        var _a, _b, _c, _d;
        const psId = (_b = (_a = source.priceScale()) === null || _a === void 0 ? void 0 : _a.id()) !== null && _b !== void 0 ? _b : '';
        if (psId !== priceScaleId) {

            return [];
        }
        return (_d = (_c = source.pricePaneViews) === null || _c === void 0 ? void 0 : _c.call(source, zOrder)) !== null && _d !== void 0 ? _d : [];
    };
}

class PriceAxisWidget {
    constructor(pane, options, rendererOptionsProvider, side) {
        this._priceScale = null;
        this._size = null;
        this._mousedown = false;
        this._widthCache = new TextWidthCache(200);
        this._font = null;
        this._prevOptimalWidth = 0;
        this._isSettingSize = false;
        this._canvasSuggestedBitmapSizeChangedHandler = () => {
            if (this._isSettingSize) {
                return;
            }
            this._pane.chart().model().lightUpdate();
        };
        this._topCanvasSuggestedBitmapSizeChangedHandler = () => {
            if (this._isSettingSize) {
                return;
            }
            this._pane.chart().model().lightUpdate();
        };
        this._pane = pane;
        this._options = options;
        this._layoutOptions = options.layout;
        this._rendererOptionsProvider = rendererOptionsProvider;
        this._isLeft = side === 'left';
        this._sourcePaneViews = buildPriceAxisViewsGetter('normal', side);
        this._sourceTopPaneViews = buildPriceAxisViewsGetter('top', side);
        this._sourceBottomPaneViews = buildPriceAxisViewsGetter('bottom', side);
        this._cell = document.createElement('div');
        this._cell.style.height = '100%';
        this._cell.style.overflow = 'hidden';
        this._cell.style.width = '25px';
        this._cell.style.left = '0';
        this._cell.style.position = 'relative';
        this._canvasBinding = createBoundCanvas(this._cell, size({width: 16, height: 16}));
        this._canvasBinding.subscribeSuggestedBitmapSizeChanged(this._canvasSuggestedBitmapSizeChangedHandler);
        const canvas = this._canvasBinding.canvasElement;
        canvas.style.position = 'absolute';
        canvas.style.zIndex = '1';
        canvas.style.left = '0';
        canvas.style.top = '0';
        this._topCanvasBinding = createBoundCanvas(this._cell, size({width: 16, height: 16}));
        this._topCanvasBinding.subscribeSuggestedBitmapSizeChanged(this._topCanvasSuggestedBitmapSizeChangedHandler);
        const topCanvas = this._topCanvasBinding.canvasElement;
        topCanvas.style.position = 'absolute';
        topCanvas.style.zIndex = '2';
        topCanvas.style.left = '0';
        topCanvas.style.top = '0';
        const handler = {
            mouseDownEvent: this._mouseDownEvent.bind(this),
            touchStartEvent: this._mouseDownEvent.bind(this),
            pressedMouseMoveEvent: this._pressedMouseMoveEvent.bind(this),
            touchMoveEvent: this._pressedMouseMoveEvent.bind(this),
            mouseDownOutsideEvent: this._mouseDownOutsideEvent.bind(this),
            mouseUpEvent: this._mouseUpEvent.bind(this),
            touchEndEvent: this._mouseUpEvent.bind(this),
            mouseEnterEvent: this._mouseEnterEvent.bind(this),
            mouseLeaveEvent: this._mouseLeaveEvent.bind(this),
        };
        this._mouseEventHandler = new MouseEventHandler(this._topCanvasBinding.canvasElement, handler, {
            treatVertTouchDragAsPageScroll: () => !this._options.handleScroll.vertTouchDrag,
            treatHorzTouchDragAsPageScroll: () => true,
        });
    }

    destroy() {
        this._mouseEventHandler.destroy();
        this._topCanvasBinding.unsubscribeSuggestedBitmapSizeChanged(this._topCanvasSuggestedBitmapSizeChangedHandler);
        releaseCanvas(this._topCanvasBinding.canvasElement);
        this._topCanvasBinding.dispose();
        this._canvasBinding.unsubscribeSuggestedBitmapSizeChanged(this._canvasSuggestedBitmapSizeChangedHandler);
        releaseCanvas(this._canvasBinding.canvasElement);
        this._canvasBinding.dispose();
        if (this._priceScale !== null) {
            this._priceScale.onMarksChanged().unsubscribeAll(this);
        }
        this._priceScale = null;
    }

    getElement() {
        return this._cell;
    }

    fontSize() {
        return this._layoutOptions.fontSize;
    }

    rendererOptions() {
        const options = this._rendererOptionsProvider.options();
        const isFontChanged = this._font !== options.font;
        if (isFontChanged) {
            this._widthCache.reset();
            this._font = options.font;
        }
        return options;
    }

    optimalWidth() {
        if (this._priceScale === null) {
            return 0;
        }
        let tickMarkMaxWidth = 0;
        const rendererOptions = this.rendererOptions();
        const ctx = ensureNotNull(this._canvasBinding.canvasElement.getContext('2d'));
        ctx.save();
        const tickMarks = this._priceScale.marks();
        ctx.font = this._baseFont();
        if (tickMarks.length > 0) {
            tickMarkMaxWidth = Math.max(this._widthCache.measureText(ctx, tickMarks[0].label), this._widthCache.measureText(ctx, tickMarks[tickMarks.length - 1].label));
        }
        const views = this._backLabels();
        for (let j = views.length; j--;) {
            const width = this._widthCache.measureText(ctx, views[j].text());
            if (width > tickMarkMaxWidth) {
                tickMarkMaxWidth = width;
            }
        }
        const firstValue = this._priceScale.firstValue();
        if (firstValue !== null && this._size !== null) {
            const topValue = this._priceScale.coordinateToPrice(1, firstValue);
            const bottomValue = this._priceScale.coordinateToPrice(this._size.height - 2, firstValue);
            tickMarkMaxWidth = Math.max(tickMarkMaxWidth, this._widthCache.measureText(ctx, this._priceScale.formatPrice(Math.floor(Math.min(topValue, bottomValue)) + 0.11111111111111, firstValue)), this._widthCache.measureText(ctx, this._priceScale.formatPrice(Math.ceil(Math.max(topValue, bottomValue)) - 0.11111111111111, firstValue)));
        }
        ctx.restore();
        const resultTickMarksMaxWidth = tickMarkMaxWidth || 34 /* Constants.DefaultOptimalWidth */;
        const res = Math.ceil(rendererOptions.borderSize + rendererOptions.tickLength + rendererOptions.paddingInner + rendererOptions.paddingOuter + 5 /* Constants.LabelOffset */ + resultTickMarksMaxWidth);

        return suggestPriceScaleWidth(res);
    }

    setSize(newSize) {
        if (this._size === null || !equalSizes(this._size, newSize)) {
            this._size = newSize;
            this._isSettingSize = true;
            this._canvasBinding.resizeCanvasElement(newSize);
            this._topCanvasBinding.resizeCanvasElement(newSize);
            this._isSettingSize = false;
            this._cell.style.width = `${newSize.width}px`;
            this._cell.style.height = `${newSize.height}px`;
        }
    }

    getWidth() {
        return ensureNotNull(this._size).width;
    }

    setPriceScale(priceScale) {
        if (this._priceScale === priceScale) {
            return;
        }
        if (this._priceScale !== null) {
            this._priceScale.onMarksChanged().unsubscribeAll(this);
        }
        this._priceScale = priceScale;
        priceScale.onMarksChanged().subscribe(this._onMarksChanged.bind(this), this);
    }

    priceScale() {
        return this._priceScale;
    }

    reset() {
        const pane = this._pane.state();
        const model = this._pane.chart().model();
        model.resetPriceScale(pane, ensureNotNull(this.priceScale()));
    }

    paint(type) {
        if (this._size === null) {
            return;
        }
        if (type !== 1 /* InvalidationLevel.Cursor */) {
            this._alignLabels();
            this._canvasBinding.applySuggestedBitmapSize();
            const target = tryCreateCanvasRenderingTarget2D(this._canvasBinding);
            if (target !== null) {
                target.useBitmapCoordinateSpace((scope) => {
                    this._drawBackground(scope);
                    this._drawBorder(scope);
                });
                this._pane.drawAdditionalSources(target, this._sourceBottomPaneViews);
                this._drawTickMarks(target);
                this._pane.drawAdditionalSources(target, this._sourcePaneViews);
                this._drawBackLabels(target);
            }
        }
        this._topCanvasBinding.applySuggestedBitmapSize();
        const topTarget = tryCreateCanvasRenderingTarget2D(this._topCanvasBinding);
        if (topTarget !== null) {
            topTarget.useBitmapCoordinateSpace(({context: ctx, bitmapSize}) => {
                ctx.clearRect(0, 0, bitmapSize.width, bitmapSize.height);
            });
            this._drawCrosshairLabel(topTarget);
            this._pane.drawAdditionalSources(topTarget, this._sourceTopPaneViews);
        }
    }

    update() {
        var _a;
        (_a = this._priceScale) === null || _a === void 0 ? void 0 : _a.marks();
    }

    _mouseDownEvent(e) {
        if (this._priceScale === null || this._priceScale.isEmpty() || !this._options.handleScale.axisPressedMouseMove.price) {
            return;
        }
        const model = this._pane.chart().model();
        const pane = this._pane.state();
        this._mousedown = true;
        model.startScalePrice(pane, this._priceScale, e.localY);
    }

    _pressedMouseMoveEvent(e) {
        if (this._priceScale === null || !this._options.handleScale.axisPressedMouseMove.price) {
            return;
        }
        const model = this._pane.chart().model();
        const pane = this._pane.state();
        const priceScale = this._priceScale;
        model.scalePriceTo(pane, priceScale, e.localY);
    }

    _mouseDownOutsideEvent() {
        if (this._priceScale === null || !this._options.handleScale.axisPressedMouseMove.price) {
            return;
        }
        const model = this._pane.chart().model();
        const pane = this._pane.state();
        const priceScale = this._priceScale;
        if (this._mousedown) {
            this._mousedown = false;
            model.endScalePrice(pane, priceScale);
        }
    }

    _mouseUpEvent(e) {
        if (this._priceScale === null || !this._options.handleScale.axisPressedMouseMove.price) {
            return;
        }
        const model = this._pane.chart().model();
        const pane = this._pane.state();
        this._mousedown = false;
        model.endScalePrice(pane, this._priceScale);
    }

    _mouseEnterEvent(e) {
        if (this._priceScale === null) {
            return;
        }
        const model = this._pane.chart().model();
        if (model.options().handleScale.axisPressedMouseMove.price && !this._priceScale.isPercentage() && !this._priceScale.isIndexedTo100()) {
            this._setCursor(1 /* CursorType.NsResize */);
        }
    }

    _mouseLeaveEvent(e) {
        this._setCursor(0 /* CursorType.Default */);
    }

    _backLabels() {
        const res = [];
        const priceScale = (this._priceScale === null) ? undefined : this._priceScale;
        const addViewsForSources = (sources) => {
            for (let i = 0; i < sources.length; ++i) {
                const source = sources[i];
                const views = source.priceAxisViews(this._pane.state(), priceScale);
                for (let j = 0; j < views.length; j++) {
                    res.push(views[j]);
                }
            }
        };


        addViewsForSources(this._pane.state().orderedSources());
        return res;
    }

    _drawBackground({context: ctx, bitmapSize}) {
        const {width, height} = bitmapSize;
        const model = this._pane.state().model();
        const topColor = model.backgroundTopColor();
        const bottomColor = model.backgroundBottomColor();
        if (topColor === bottomColor) {
            clearRect(ctx, 0, 0, width, height, topColor);
        } else {
            clearRectWithGradient(ctx, 0, 0, width, height, topColor, bottomColor);
        }
    }

    _drawBorder({context: ctx, bitmapSize, horizontalPixelRatio}) {
        if (this._size === null || this._priceScale === null || !this._priceScale.options().borderVisible) {
            return;
        }
        ctx.fillStyle = this._priceScale.options().borderColor;
        const borderSize = Math.max(1, Math.floor(this.rendererOptions().borderSize * horizontalPixelRatio));
        let left;
        if (this._isLeft) {
            left = bitmapSize.width - borderSize;
        } else {
            left = 0;
        }
        ctx.fillRect(left, 0, borderSize, bitmapSize.height);
    }

    _drawTickMarks(target) {
        if (this._size === null || this._priceScale === null) {
            return;
        }
        const tickMarks = this._priceScale.marks();
        const priceScaleOptions = this._priceScale.options();
        const rendererOptions = this.rendererOptions();
        const tickMarkLeftX = this._isLeft ? (this._size.width - rendererOptions.tickLength) : 0;
        if (priceScaleOptions.borderVisible && priceScaleOptions.ticksVisible) {
            target.useBitmapCoordinateSpace(({context: ctx, horizontalPixelRatio, verticalPixelRatio}) => {
                ctx.fillStyle = priceScaleOptions.borderColor;
                const tickHeight = Math.max(1, Math.floor(verticalPixelRatio));
                const tickOffset = Math.floor(verticalPixelRatio * 0.5);
                const tickLength = Math.round(rendererOptions.tickLength * horizontalPixelRatio);
                ctx.beginPath();
                for (const tickMark of tickMarks) {
                    ctx.rect(Math.floor(tickMarkLeftX * horizontalPixelRatio), Math.round(tickMark.coord * verticalPixelRatio) - tickOffset, tickLength, tickHeight);
                }
                ctx.fill();
            });
        }
        target.useMediaCoordinateSpace(({context: ctx}) => {
            var _a;
            ctx.font = this._baseFont();
            ctx.fillStyle = (_a = priceScaleOptions.textColor) !== null && _a !== void 0 ? _a : this._layoutOptions.textColor;
            ctx.textAlign = this._isLeft ? 'right' : 'left';
            const textLeftX = this._isLeft ? Math.round(tickMarkLeftX - rendererOptions.paddingInner) : Math.round(tickMarkLeftX + rendererOptions.tickLength + rendererOptions.paddingInner);
            const yMidCorrections = tickMarks.map((mark) => this._widthCache.yMidCorrection(ctx, mark.label));
            for (let i = tickMarks.length; i--;) {
                const tickMark = tickMarks[i];
                ctx.fillText(tickMark.label, textLeftX, tickMark.coord + yMidCorrections[i]);
            }
        });
    }

    _alignLabels() {
        if (this._size === null || this._priceScale === null) {
            return;
        }
        let center = this._size.height / 2;
        const views = [];
        const orderedSources = this._priceScale.orderedSources().slice();
        const pane = this._pane;
        const paneState = pane.state();
        const rendererOptions = this.rendererOptions();

        const isDefault = this._priceScale === paneState.defaultVisiblePriceScale();
        if (isDefault) {
            this._pane.state().orderedSources().forEach((source) => {
                if (paneState.isOverlay(source)) {
                    orderedSources.push(source);
                }
            });
        }
        const centerSource = this._priceScale.dataSources()[0];
        const priceScale = this._priceScale;
        const updateForSources = (sources) => {
            sources.forEach((source) => {
                const sourceViews = source.priceAxisViews(paneState, priceScale);

                sourceViews.forEach((view) => {
                    view.setFixedCoordinate(null);
                    if (view.isVisible()) {
                        views.push(view);
                    }
                });
                if (centerSource === source && sourceViews.length > 0) {
                    center = sourceViews[0].coordinate();
                }
            });
        };
        updateForSources(orderedSources);
        views.forEach((view) => view.setFixedCoordinate(view.coordinate()));
        const options = this._priceScale.options();
        if (!options.alignLabels) {
            return;
        }
        this._fixLabelOverlap(views, rendererOptions, center);
    }

    _fixLabelOverlap(views, rendererOptions, center) {
        if (this._size === null) {
            return;
        }

        const top = views.filter((view) => view.coordinate() <= center);
        const bottom = views.filter((view) => view.coordinate() > center);

        top.sort((l, r) => r.coordinate() - l.coordinate());

        if (top.length && bottom.length) {
            bottom.push(top[0]);
        }
        bottom.sort((l, r) => l.coordinate() - r.coordinate());
        for (const view of views) {
            const halfHeight = Math.floor(view.height(rendererOptions) / 2);
            const coordinate = view.coordinate();
            if (coordinate > -halfHeight && coordinate < halfHeight) {
                view.setFixedCoordinate(halfHeight);
            }
            if (coordinate > (this._size.height - halfHeight) && coordinate < this._size.height + halfHeight) {
                view.setFixedCoordinate(this._size.height - halfHeight);
            }
        }
        for (let i = 1; i < top.length; i++) {
            const view = top[i];
            const prev = top[i - 1];
            const height = prev.height(rendererOptions, false);
            const coordinate = view.coordinate();
            const prevFixedCoordinate = prev.getFixedCoordinate();
            if (coordinate > prevFixedCoordinate - height) {
                view.setFixedCoordinate(prevFixedCoordinate - height);
            }
        }
        for (let j = 1; j < bottom.length; j++) {
            const view = bottom[j];
            const prev = bottom[j - 1];
            const height = prev.height(rendererOptions, true);
            const coordinate = view.coordinate();
            const prevFixedCoordinate = prev.getFixedCoordinate();
            if (coordinate < prevFixedCoordinate + height) {
                view.setFixedCoordinate(prevFixedCoordinate + height);
            }
        }
    }

    _drawBackLabels(target) {
        if (this._size === null) {
            return;
        }
        const views = this._backLabels();
        const rendererOptions = this.rendererOptions();
        const align = this._isLeft ? 'right' : 'left';
        views.forEach((view) => {
            if (view.isAxisLabelVisible()) {
                const renderer = view.renderer(ensureNotNull(this._priceScale));
                renderer.draw(target, rendererOptions, this._widthCache, align);
            }
        });
    }

    _drawCrosshairLabel(target) {
        if (this._size === null || this._priceScale === null) {
            return;
        }
        const model = this._pane.chart().model();
        const views = [];
        const pane = this._pane.state();
        const v = model.crosshairSource().priceAxisViews(pane, this._priceScale);
        if (v.length) {
            views.push(v);
        }
        const ro = this.rendererOptions();
        const align = this._isLeft ? 'right' : 'left';
        views.forEach((arr) => {
            arr.forEach((view) => {
                view.renderer(ensureNotNull(this._priceScale)).draw(target, ro, this._widthCache, align);
            });
        });
    }

    _setCursor(type) {
        this._cell.style.cursor = type === 1 /* CursorType.NsResize */ ? 'ns-resize' : 'default';
    }

    _onMarksChanged() {
        const width = this.optimalWidth();
        if (this._prevOptimalWidth < width) {
            this._pane.chart().model().fullUpdate();
        }
        this._prevOptimalWidth = width;
    }

    _baseFont() {
        return makeFont(this._layoutOptions.fontSize, this._layoutOptions.fontFamily);
    }
}

function sourceBottomPaneViews$1(source, pane) {
    var _a, _b;
    return (_b = (_a = source.bottomPaneViews) === null || _a === void 0 ? void 0 : _a.call(source, pane)) !== null && _b !== void 0 ? _b : [];
}

function sourcePaneViews$1(source, pane) {
    var _a, _b;
    return (_b = (_a = source.paneViews) === null || _a === void 0 ? void 0 : _a.call(source, pane)) !== null && _b !== void 0 ? _b : [];
}

function sourceLabelPaneViews(source, pane) {
    var _a, _b;
    return (_b = (_a = source.labelPaneViews) === null || _a === void 0 ? void 0 : _a.call(source, pane)) !== null && _b !== void 0 ? _b : [];
}

function sourceTopPaneViews$1(source, pane) {
    var _a, _b;
    return (_b = (_a = source.topPaneViews) === null || _a === void 0 ? void 0 : _a.call(source, pane)) !== null && _b !== void 0 ? _b : [];
}

class PaneWidget {
    constructor(chart, state) {
        this._size = size({width: 0, height: 0});
        this._leftPriceAxisWidget = null;
        this._rightPriceAxisWidget = null;
        this._startScrollingPos = null;
        this._isScrolling = false;
        this._clicked = new Delegate();
        this._prevPinchScale = 0;
        this._longTap = false;
        this._startTrackPoint = null;
        this._exitTrackingModeOnNextTry = false;
        this._initCrosshairPosition = null;
        this._scrollXAnimation = null;
        this._isSettingSize = false;
        this._canvasSuggestedBitmapSizeChangedHandler = () => {
            if (this._isSettingSize || this._state === null) {
                return;
            }
            this._model().lightUpdate();
        };
        this._topCanvasSuggestedBitmapSizeChangedHandler = () => {
            if (this._isSettingSize || this._state === null) {
                return;
            }
            this._model().lightUpdate();
        };
        this._chart = chart;
        this._state = state;
        this._state.onDestroyed().subscribe(this._onStateDestroyed.bind(this), this, true);
        this._paneCell = document.createElement('td');
        this._paneCell.style.padding = '0';
        this._paneCell.style.position = 'relative';
        const paneWrapper = document.createElement('div');
        paneWrapper.style.width = '100%';
        paneWrapper.style.height = '100%';
        paneWrapper.style.position = 'relative';
        paneWrapper.style.overflow = 'hidden';
        this._leftAxisCell = document.createElement('td');
        this._leftAxisCell.style.padding = '0';
        this._rightAxisCell = document.createElement('td');
        this._rightAxisCell.style.padding = '0';
        this._paneCell.appendChild(paneWrapper);
        this._canvasBinding = createBoundCanvas(paneWrapper, size({width: 16, height: 16}));
        this._canvasBinding.subscribeSuggestedBitmapSizeChanged(this._canvasSuggestedBitmapSizeChangedHandler);
        const canvas = this._canvasBinding.canvasElement;
        canvas.style.position = 'absolute';
        canvas.style.zIndex = '1';
        canvas.style.left = '0';
        canvas.style.top = '0';
        this._topCanvasBinding = createBoundCanvas(paneWrapper, size({width: 16, height: 16}));
        this._topCanvasBinding.subscribeSuggestedBitmapSizeChanged(this._topCanvasSuggestedBitmapSizeChangedHandler);
        const topCanvas = this._topCanvasBinding.canvasElement;
        topCanvas.style.position = 'absolute';
        topCanvas.style.zIndex = '2';
        topCanvas.style.left = '0';
        topCanvas.style.top = '0';
        this._rowElement = document.createElement('tr');
        this._rowElement.appendChild(this._leftAxisCell);
        this._rowElement.appendChild(this._paneCell);
        this._rowElement.appendChild(this._rightAxisCell);
        this.updatePriceAxisWidgetsStates();
        this._mouseEventHandler = new MouseEventHandler(this._topCanvasBinding.canvasElement, this, {
            treatVertTouchDragAsPageScroll: () => this._startTrackPoint === null && !this._chart.options().handleScroll.vertTouchDrag,
            treatHorzTouchDragAsPageScroll: () => this._startTrackPoint === null && !this._chart.options().handleScroll.horzTouchDrag,
        });
    }

    destroy() {
        if (this._leftPriceAxisWidget !== null) {
            this._leftPriceAxisWidget.destroy();
        }
        if (this._rightPriceAxisWidget !== null) {
            this._rightPriceAxisWidget.destroy();
        }
        this._topCanvasBinding.unsubscribeSuggestedBitmapSizeChanged(this._topCanvasSuggestedBitmapSizeChangedHandler);
        releaseCanvas(this._topCanvasBinding.canvasElement);
        this._topCanvasBinding.dispose();
        this._canvasBinding.unsubscribeSuggestedBitmapSizeChanged(this._canvasSuggestedBitmapSizeChangedHandler);
        releaseCanvas(this._canvasBinding.canvasElement);
        this._canvasBinding.dispose();
        if (this._state !== null) {
            this._state.onDestroyed().unsubscribeAll(this);
        }
        this._mouseEventHandler.destroy();
    }

    state() {
        return ensureNotNull(this._state);
    }

    setState(pane) {
        if (this._state !== null) {
            this._state.onDestroyed().unsubscribeAll(this);
        }
        this._state = pane;
        if (this._state !== null) {
            this._state.onDestroyed().subscribe(PaneWidget.prototype._onStateDestroyed.bind(this), this, true);
        }
        this.updatePriceAxisWidgetsStates();
    }

    chart() {
        return this._chart;
    }

    getElement() {
        return this._rowElement;
    }

    updatePriceAxisWidgetsStates() {
        if (this._state === null) {
            return;
        }
        this._recreatePriceAxisWidgets();
        if (this._model().serieses().length === 0) {
            return;
        }
        if (this._leftPriceAxisWidget !== null) {
            const leftPriceScale = this._state.leftPriceScale();
            this._leftPriceAxisWidget.setPriceScale(ensureNotNull(leftPriceScale));
        }
        if (this._rightPriceAxisWidget !== null) {
            const rightPriceScale = this._state.rightPriceScale();
            this._rightPriceAxisWidget.setPriceScale(ensureNotNull(rightPriceScale));
        }
    }

    updatePriceAxisWidgets() {
        if (this._leftPriceAxisWidget !== null) {
            this._leftPriceAxisWidget.update();
        }
        if (this._rightPriceAxisWidget !== null) {
            this._rightPriceAxisWidget.update();
        }
    }

    stretchFactor() {
        return this._state !== null ? this._state.stretchFactor() : 0;
    }

    setStretchFactor(stretchFactor) {
        if (this._state) {
            this._state.setStretchFactor(stretchFactor);
        }
    }

    mouseEnterEvent(event) {
        if (!this._state) {
            return;
        }
        this._onMouseEvent();
        const x = event.localX;
        const y = event.localY;
        this._setCrosshairPosition(x, y, event);
    }

    mouseDownEvent(event) {
        this._onMouseEvent();
        this._mouseTouchDownEvent();
        this._setCrosshairPosition(event.localX, event.localY, event);
    }

    mouseMoveEvent(event) {
        var _a;
        if (!this._state) {
            return;
        }
        this._onMouseEvent();
        const x = event.localX;
        const y = event.localY;
        this._setCrosshairPosition(x, y, event);
        const hitTest = this.hitTest(x, y);
        this._chart.setCursorStyle((_a = hitTest === null || hitTest === void 0 ? void 0 : hitTest.cursorStyle) !== null && _a !== void 0 ? _a : null);
        this._model().setHoveredSource(hitTest && {
            source: hitTest.source, object: hitTest.object
        });
    }

    mouseClickEvent(event) {
        if (this._state === null) {
            return;
        }
        this._onMouseEvent();
        this._fireClickedDelegate(event);
    }

    pressedMouseMoveEvent(event) {
        this._onMouseEvent();
        this._pressedMouseTouchMoveEvent(event);
        this._setCrosshairPosition(event.localX, event.localY, event);
    }

    mouseUpEvent(event) {
        if (this._state === null) {
            return;
        }
        this._onMouseEvent();
        this._longTap = false;
        this._endScroll(event);
    }

    tapEvent(event) {
        if (this._state === null) {
            return;
        }
        this._fireClickedDelegate(event);
    }

    longTapEvent(event) {
        this._longTap = true;
        if (this._startTrackPoint === null) {
            const point = {x: event.localX, y: event.localY};
            this._startTrackingMode(point, point, event);
        }
    }

    mouseLeaveEvent(event) {
        if (this._state === null) {
            return;
        }
        this._onMouseEvent();
        this._state.model().setHoveredSource(null);
        this._clearCrosshairPosition();
    }

    clicked() {
        return this._clicked;
    }

    pinchStartEvent() {
        this._prevPinchScale = 1;
        this._model().stopTimeScaleAnimation();
    }

    pinchEvent(middlePoint, scale) {
        if (!this._chart.options().handleScale.pinch) {
            return;
        }
        const zoomScale = (scale - this._prevPinchScale) * 5;
        this._prevPinchScale = scale;
        this._model().zoomTime(middlePoint.x, zoomScale);
    }

    touchStartEvent(event) {
        this._longTap = false;
        this._exitTrackingModeOnNextTry = this._startTrackPoint !== null;
        this._mouseTouchDownEvent();
        const crosshair = this._model().crosshairSource();
        if (this._startTrackPoint !== null && crosshair.visible()) {
            this._initCrosshairPosition = {
                x: crosshair.appliedX(), y: crosshair.appliedY()
            };
            this._startTrackPoint = {x: event.localX, y: event.localY};
        }
    }

    touchMoveEvent(event) {
        if (this._state === null) {
            return;
        }
        const x = event.localX;
        const y = event.localY;
        if (this._startTrackPoint !== null) {

            this._exitTrackingModeOnNextTry = false;
            const origPoint = ensureNotNull(this._initCrosshairPosition);
            const newX = origPoint.x + (x - this._startTrackPoint.x);
            const newY = origPoint.y + (y - this._startTrackPoint.y);
            this._setCrosshairPosition(newX, newY, event);
            return;
        }
        this._pressedMouseTouchMoveEvent(event);
    }

    touchEndEvent(event) {
        if (this.chart().options().trackingMode.exitMode === 0 /* TrackingModeExitMode.OnTouchEnd */) {
            this._exitTrackingModeOnNextTry = true;
        }
        this._tryExitTrackingMode();
        this._endScroll(event);
    }

    hitTest(x, y) {
        const state = this._state;
        if (state === null) {
            return null;
        }
        return hitTestPane(state, x, y);
    }

    setPriceAxisSize(width, position) {
        const priceAxisWidget = position === 'left' ? this._leftPriceAxisWidget : this._rightPriceAxisWidget;
        ensureNotNull(priceAxisWidget).setSize(size({width, height: this._size.height}));
    }

    getSize() {
        return this._size;
    }

    setSize(newSize) {
        if (equalSizes(this._size, newSize)) {
            return;
        }
        this._size = newSize;
        this._isSettingSize = true;
        this._canvasBinding.resizeCanvasElement(newSize);
        this._topCanvasBinding.resizeCanvasElement(newSize);
        this._isSettingSize = false;
        this._paneCell.style.width = newSize.width + 'px';
        this._paneCell.style.height = newSize.height + 'px';
    }

    recalculatePriceScales() {
        const pane = ensureNotNull(this._state);
        pane.recalculatePriceScale(pane.leftPriceScale());
        pane.recalculatePriceScale(pane.rightPriceScale());
        for (const source of pane.dataSources()) {
            if (pane.isOverlay(source)) {
                const priceScale = source.priceScale();
                if (priceScale !== null) {
                    pane.recalculatePriceScale(priceScale);
                }


                source.updateAllViews();
            }
        }
    }

    paint(type) {
        if (type === 0 /* InvalidationLevel.None */) {
            return;
        }
        if (this._state === null) {
            return;
        }
        if (type > 1 /* InvalidationLevel.Cursor */) {
            this.recalculatePriceScales();
        }
        if (this._leftPriceAxisWidget !== null) {
            this._leftPriceAxisWidget.paint(type);
        }
        if (this._rightPriceAxisWidget !== null) {
            this._rightPriceAxisWidget.paint(type);
        }
        if (type !== 1 /* InvalidationLevel.Cursor */) {
            this._canvasBinding.applySuggestedBitmapSize();
            const target = tryCreateCanvasRenderingTarget2D(this._canvasBinding);
            if (target !== null) {
                target.useBitmapCoordinateSpace((scope) => {
                    this._drawBackground(scope);
                });
                if (this._state) {
                    this._drawSources(target, sourceBottomPaneViews$1);
                    this._drawGrid(target);
                    this._drawSources(target, sourcePaneViews$1);
                    this._drawSources(target, sourceLabelPaneViews);
                }
            }
        }
        this._topCanvasBinding.applySuggestedBitmapSize();
        const topTarget = tryCreateCanvasRenderingTarget2D(this._topCanvasBinding);
        if (topTarget !== null) {
            topTarget.useBitmapCoordinateSpace(({context: ctx, bitmapSize}) => {
                ctx.clearRect(0, 0, bitmapSize.width, bitmapSize.height);
            });
            this._drawCrosshair(topTarget);
            this._drawSources(topTarget, sourceTopPaneViews$1);
        }
    }

    leftPriceAxisWidget() {
        return this._leftPriceAxisWidget;
    }

    rightPriceAxisWidget() {
        return this._rightPriceAxisWidget;
    }

    drawAdditionalSources(target, paneViewsGetter) {
        this._drawSources(target, paneViewsGetter);
    }

    _onStateDestroyed() {
        if (this._state !== null) {
            this._state.onDestroyed().unsubscribeAll(this);
        }
        this._state = null;
    }

    _fireClickedDelegate(event) {
        this._fireMouseClickDelegate(this._clicked, event);
    }

    _fireMouseClickDelegate(delegate, event) {
        const x = event.localX;
        const y = event.localY;
        if (delegate.hasListeners()) {
            delegate.fire(this._model().timeScale().coordinateToIndex(x), {
                x, y
            }, event);
        }
    }

    _drawBackground({context: ctx, bitmapSize}) {
        const {width, height} = bitmapSize;
        const model = this._model();
        const topColor = model.backgroundTopColor();
        const bottomColor = model.backgroundBottomColor();
        if (topColor === bottomColor) {
            clearRect(ctx, 0, 0, width, height, bottomColor);
        } else {
            clearRectWithGradient(ctx, 0, 0, width, height, topColor, bottomColor);
        }
    }

    _drawGrid(target) {
        const state = ensureNotNull(this._state);
        const paneView = state.grid().paneView();
        const renderer = paneView.renderer();
        if (renderer !== null) {
            renderer.draw(target, false);
        }
    }

    _drawCrosshair(target) {
        this._drawSourceImpl(target, sourcePaneViews$1, drawForeground, this._model().crosshairSource());
    }

    _drawSources(target, paneViewsGetter) {
        const state = ensureNotNull(this._state);
        const sources = state.orderedSources();
        for (const source of sources) {
            this._drawSourceImpl(target, paneViewsGetter, drawBackground, source);
        }
        for (const source of sources) {
            this._drawSourceImpl(target, paneViewsGetter, drawForeground, source);
        }
    }

    _drawSourceImpl(target, paneViewsGetter, drawFn, source) {
        const state = ensureNotNull(this._state);
        const hoveredSource = state.model().hoveredSource();
        const isHovered = hoveredSource !== null && hoveredSource.source === source;
        const objecId = hoveredSource !== null && isHovered && hoveredSource.object !== undefined ? hoveredSource.object.hitTestData : undefined;
        const drawRendererFn = (renderer) => drawFn(renderer, target, isHovered, objecId);
        drawSourcePaneViews(paneViewsGetter, drawRendererFn, source, state);
    }

    _recreatePriceAxisWidgets() {
        if (this._state === null) {
            return;
        }
        const chart = this._chart;
        const leftAxisVisible = this._state.leftPriceScale().options().visible;
        const rightAxisVisible = this._state.rightPriceScale().options().visible;
        if (!leftAxisVisible && this._leftPriceAxisWidget !== null) {
            this._leftAxisCell.removeChild(this._leftPriceAxisWidget.getElement());
            this._leftPriceAxisWidget.destroy();
            this._leftPriceAxisWidget = null;
        }
        if (!rightAxisVisible && this._rightPriceAxisWidget !== null) {
            this._rightAxisCell.removeChild(this._rightPriceAxisWidget.getElement());
            this._rightPriceAxisWidget.destroy();
            this._rightPriceAxisWidget = null;
        }
        const rendererOptionsProvider = chart.model().rendererOptionsProvider();
        if (leftAxisVisible && this._leftPriceAxisWidget === null) {
            this._leftPriceAxisWidget = new PriceAxisWidget(this, chart.options(), rendererOptionsProvider, 'left');
            this._leftAxisCell.appendChild(this._leftPriceAxisWidget.getElement());
        }
        if (rightAxisVisible && this._rightPriceAxisWidget === null) {
            this._rightPriceAxisWidget = new PriceAxisWidget(this, chart.options(), rendererOptionsProvider, 'right');
            this._rightAxisCell.appendChild(this._rightPriceAxisWidget.getElement());
        }
    }

    _preventScroll(event) {
        return event.isTouch && this._longTap || this._startTrackPoint !== null;
    }

    _correctXCoord(x) {
        return Math.max(0, Math.min(x, this._size.width - 1));
    }

    _correctYCoord(y) {
        return Math.max(0, Math.min(y, this._size.height - 1));
    }

    _setCrosshairPosition(x, y, event) {
        this._model().setAndSaveCurrentPosition(this._correctXCoord(x), this._correctYCoord(y), event, ensureNotNull(this._state));
    }

    _clearCrosshairPosition() {
        this._model().clearCurrentPosition();
    }

    _tryExitTrackingMode() {
        if (this._exitTrackingModeOnNextTry) {
            this._startTrackPoint = null;
            this._clearCrosshairPosition();
        }
    }

    _startTrackingMode(startTrackPoint, crossHairPosition, event) {
        this._startTrackPoint = startTrackPoint;
        this._exitTrackingModeOnNextTry = false;
        this._setCrosshairPosition(crossHairPosition.x, crossHairPosition.y, event);
        const crosshair = this._model().crosshairSource();
        this._initCrosshairPosition = {
            x: crosshair.appliedX(), y: crosshair.appliedY()
        };
    }

    _model() {
        return this._chart.model();
    }

    _endScroll(event) {
        if (!this._isScrolling) {
            return;
        }
        const model = this._model();
        const state = this.state();
        model.endScrollPrice(state, state.defaultPriceScale());
        this._startScrollingPos = null;
        this._isScrolling = false;
        model.endScrollTime();
        if (this._scrollXAnimation !== null) {
            const startAnimationTime = performance.now();
            const timeScale = model.timeScale();
            this._scrollXAnimation.start(timeScale.rightOffset(), startAnimationTime);
            if (!this._scrollXAnimation.finished(startAnimationTime)) {
                model.setTimeScaleAnimation(this._scrollXAnimation);
            }
        }
    }

    _onMouseEvent() {
        this._startTrackPoint = null;
    }

    _mouseTouchDownEvent() {
        if (!this._state) {
            return;
        }
        this._model().stopTimeScaleAnimation();
        if (document.activeElement !== document.body && document.activeElement !== document.documentElement) {

            ensureNotNull(document.activeElement).blur();
        } else {

            const selection = document.getSelection();
            if (selection !== null) {
                selection.removeAllRanges();
            }
        }
        const priceScale = this._state.defaultPriceScale();
        if (priceScale.isEmpty() || this._model().timeScale().isEmpty()) {

        }
    }

    _pressedMouseTouchMoveEvent(event) {
        if (this._state === null) {
            return;
        }
        const model = this._model();
        const timeScale = model.timeScale();
        if (timeScale.isEmpty()) {
            return;
        }
        const chartOptions = this._chart.options();
        const scrollOptions = chartOptions.handleScroll;
        const kineticScrollOptions = chartOptions.kineticScroll;
        if ((!scrollOptions.pressedMouseMove || event.isTouch) && (!scrollOptions.horzTouchDrag && !scrollOptions.vertTouchDrag || !event.isTouch)) {
            return;
        }
        const priceScale = this._state.defaultPriceScale();
        const now = performance.now();
        if (this._startScrollingPos === null && !this._preventScroll(event)) {
            this._startScrollingPos = {
                x: event.clientX, y: event.clientY, timestamp: now, localX: event.localX, localY: event.localY,
            };
        }
        if (this._startScrollingPos !== null && !this._isScrolling && (this._startScrollingPos.x !== event.clientX || this._startScrollingPos.y !== event.clientY)) {
            if (event.isTouch && kineticScrollOptions.touch || !event.isTouch && kineticScrollOptions.mouse) {
                const barSpacing = timeScale.barSpacing();
                this._scrollXAnimation = new KineticAnimation(0.2 /* KineticScrollConstants.MinScrollSpeed */ / barSpacing, 7 /* KineticScrollConstants.MaxScrollSpeed */ / barSpacing, 0.997 /* KineticScrollConstants.DumpingCoeff */, 15 /* KineticScrollConstants.ScrollMinMove */ / barSpacing);
                this._scrollXAnimation.addPosition(timeScale.rightOffset(), this._startScrollingPos.timestamp);
            } else {
                this._scrollXAnimation = null;
            }
            if (!priceScale.isEmpty()) {
                model.startScrollPrice(this._state, priceScale, event.localY);
            }
            model.startScrollTime(event.localX);
            this._isScrolling = true;
        }
        if (this._isScrolling) {

            if (!priceScale.isEmpty()) {
                model.scrollPriceTo(this._state, priceScale, event.localY);
            }
            model.scrollTimeTo(event.localX);
            if (this._scrollXAnimation !== null) {
                this._scrollXAnimation.addPosition(timeScale.rightOffset(), now);
            }
        }
    }
}

class PriceAxisStub {
    constructor(side, options, params, borderVisible, bottomColor) {
        this._invalidated = true;
        this._size = size({width: 0, height: 0});
        this._canvasSuggestedBitmapSizeChangedHandler = () => this.paint(3 /* InvalidationLevel.Full */);
        this._isLeft = side === 'left';
        this._rendererOptionsProvider = params.rendererOptionsProvider;
        this._options = options;
        this._borderVisible = borderVisible;
        this._bottomColor = bottomColor;
        this._cell = document.createElement('div');
        this._cell.style.width = '25px';
        this._cell.style.height = '100%';
        this._cell.style.overflow = 'hidden';
        this._canvasBinding = createBoundCanvas(this._cell, size({width: 16, height: 16}));
        this._canvasBinding.subscribeSuggestedBitmapSizeChanged(this._canvasSuggestedBitmapSizeChangedHandler);
    }

    destroy() {
        this._canvasBinding.unsubscribeSuggestedBitmapSizeChanged(this._canvasSuggestedBitmapSizeChangedHandler);
        releaseCanvas(this._canvasBinding.canvasElement);
        this._canvasBinding.dispose();
    }

    getElement() {
        return this._cell;
    }

    getSize() {
        return this._size;
    }

    setSize(newSize) {
        if (!equalSizes(this._size, newSize)) {
            this._size = newSize;
            this._canvasBinding.resizeCanvasElement(newSize);
            this._cell.style.width = `${newSize.width}px`;
            this._cell.style.height = `${newSize.height}px`;
            this._invalidated = true;
        }
    }

    paint(type) {
        if (type < 3 /* InvalidationLevel.Full */ && !this._invalidated) {
            return;
        }
        if (this._size.width === 0 || this._size.height === 0) {
            return;
        }
        this._invalidated = false;
        this._canvasBinding.applySuggestedBitmapSize();
        const target = tryCreateCanvasRenderingTarget2D(this._canvasBinding);
        if (target !== null) {
            target.useBitmapCoordinateSpace((scope) => {
                this._drawBackground(scope);
                this._drawBorder(scope);
            });
        }
    }

    _drawBorder({context: ctx, bitmapSize, horizontalPixelRatio, verticalPixelRatio}) {
        if (!this._borderVisible()) {
            return;
        }
        ctx.fillStyle = this._options.timeScale.borderColor;
        const horzBorderSize = Math.floor(this._rendererOptionsProvider.options().borderSize * horizontalPixelRatio);
        const vertBorderSize = Math.floor(this._rendererOptionsProvider.options().borderSize * verticalPixelRatio);
        const left = (this._isLeft) ? bitmapSize.width - horzBorderSize : 0;
        ctx.fillRect(left, 0, horzBorderSize, vertBorderSize);
    }

    _drawBackground({context: ctx, bitmapSize}) {
        clearRect(ctx, 0, 0, bitmapSize.width, bitmapSize.height, this._bottomColor());
    }
}

function buildTimeAxisViewsGetter(zOrder) {
    return (source) => {
        var _a, _b;
        return (_b = (_a = source.timePaneViews) === null || _a === void 0 ? void 0 : _a.call(source, zOrder)) !== null && _b !== void 0 ? _b : [];
    };
}

const sourcePaneViews = buildTimeAxisViewsGetter('normal');
const sourceTopPaneViews = buildTimeAxisViewsGetter('top');
const sourceBottomPaneViews = buildTimeAxisViewsGetter('bottom');

class TimeAxisWidget {
    constructor(chartWidget, horzScaleBehavior) {
        this._leftStub = null;
        this._rightStub = null;
        this._rendererOptions = null;
        this._mouseDown = false;
        this._size = size({width: 0, height: 0});
        this._sizeChanged = new Delegate();
        this._widthCache = new TextWidthCache(5);
        this._isSettingSize = false;
        this._canvasSuggestedBitmapSizeChangedHandler = () => {
            if (!this._isSettingSize) {
                this._chart.model().lightUpdate();
            }
        };
        this._topCanvasSuggestedBitmapSizeChangedHandler = () => {
            if (!this._isSettingSize) {
                this._chart.model().lightUpdate();
            }
        };
        this._chart = chartWidget;
        this._horzScaleBehavior = horzScaleBehavior;
        this._options = chartWidget.options().layout;
        this._element = document.createElement('tr');
        this._leftStubCell = document.createElement('td');
        this._leftStubCell.style.padding = '0';
        this._rightStubCell = document.createElement('td');
        this._rightStubCell.style.padding = '0';
        this._cell = document.createElement('td');
        this._cell.style.height = '25px';
        this._cell.style.padding = '0';
        this._dv = document.createElement('div');
        this._dv.style.width = '100%';
        this._dv.style.height = '100%';
        this._dv.style.position = 'relative';
        this._dv.style.overflow = 'hidden';
        this._cell.appendChild(this._dv);
        this._canvasBinding = createBoundCanvas(this._dv, size({width: 16, height: 16}));
        this._canvasBinding.subscribeSuggestedBitmapSizeChanged(this._canvasSuggestedBitmapSizeChangedHandler);
        const canvas = this._canvasBinding.canvasElement;
        canvas.style.position = 'absolute';
        canvas.style.zIndex = '1';
        canvas.style.left = '0';
        canvas.style.top = '0';
        this._topCanvasBinding = createBoundCanvas(this._dv, size({width: 16, height: 16}));
        this._topCanvasBinding.subscribeSuggestedBitmapSizeChanged(this._topCanvasSuggestedBitmapSizeChangedHandler);
        const topCanvas = this._topCanvasBinding.canvasElement;
        topCanvas.style.position = 'absolute';
        topCanvas.style.zIndex = '2';
        topCanvas.style.left = '0';
        topCanvas.style.top = '0';
        this._element.appendChild(this._leftStubCell);
        this._element.appendChild(this._cell);
        this._element.appendChild(this._rightStubCell);
        this._recreateStubs();
        this._chart.model().priceScalesOptionsChanged().subscribe(this._recreateStubs.bind(this), this);
        this._mouseEventHandler = new MouseEventHandler(this._topCanvasBinding.canvasElement, this, {
            treatVertTouchDragAsPageScroll: () => true,
            treatHorzTouchDragAsPageScroll: () => !this._chart.options().handleScroll.horzTouchDrag,
        });
    }

    destroy() {
        this._mouseEventHandler.destroy();
        if (this._leftStub !== null) {
            this._leftStub.destroy();
        }
        if (this._rightStub !== null) {
            this._rightStub.destroy();
        }
        this._topCanvasBinding.unsubscribeSuggestedBitmapSizeChanged(this._topCanvasSuggestedBitmapSizeChangedHandler);
        releaseCanvas(this._topCanvasBinding.canvasElement);
        this._topCanvasBinding.dispose();
        this._canvasBinding.unsubscribeSuggestedBitmapSizeChanged(this._canvasSuggestedBitmapSizeChangedHandler);
        releaseCanvas(this._canvasBinding.canvasElement);
        this._canvasBinding.dispose();
    }

    getElement() {
        return this._element;
    }

    mouseDownEvent(event) {
        if (this._mouseDown) {
            return;
        }
        this._mouseDown = true;
        const model = this._chart.model();
        if (model.timeScale().isEmpty() || !this._chart.options().handleScale.axisPressedMouseMove.time) {
            return;
        }
        model.startScaleTime(event.localX);
    }

    touchStartEvent(event) {
        this.mouseDownEvent(event);
    }

    mouseDownOutsideEvent() {
        const model = this._chart.model();
        if (!model.timeScale().isEmpty() && this._mouseDown) {
            this._mouseDown = false;
            if (this._chart.options().handleScale.axisPressedMouseMove.time) {
                model.endScaleTime();
            }
        }
    }

    pressedMouseMoveEvent(event) {
        const model = this._chart.model();
        if (model.timeScale().isEmpty() || !this._chart.options().handleScale.axisPressedMouseMove.time) {
            return;
        }
        model.scaleTimeTo(event.localX);
    }

    touchMoveEvent(event) {
        this.pressedMouseMoveEvent(event);
    }

    mouseUpEvent() {
        this._mouseDown = false;
        const model = this._chart.model();
        if (model.timeScale().isEmpty() && !this._chart.options().handleScale.axisPressedMouseMove.time) {
            return;
        }
        model.endScaleTime();
    }

    touchEndEvent() {
        this.mouseUpEvent();
    }

    mouseEnterEvent() {
        if (this._chart.model().options().handleScale.axisPressedMouseMove.time) {
            this._setCursor(1 /* CursorType.EwResize */);
        }
    }

    mouseLeaveEvent() {
        this._setCursor(0 /* CursorType.Default */);
    }

    getSize() {
        return this._size;
    }

    setSizes(timeAxisSize, leftStubWidth, rightStubWidth) {
        if (!equalSizes(this._size, timeAxisSize)) {
            this._size = timeAxisSize;
            this._isSettingSize = true;
            this._canvasBinding.resizeCanvasElement(timeAxisSize);
            this._topCanvasBinding.resizeCanvasElement(timeAxisSize);
            this._isSettingSize = false;
            this._cell.style.width = `${timeAxisSize.width}px`;
            this._cell.style.height = `${timeAxisSize.height}px`;
            this._sizeChanged.fire(timeAxisSize);
        }
        if (this._leftStub !== null) {
            this._leftStub.setSize(size({width: leftStubWidth, height: timeAxisSize.height}));
        }
        if (this._rightStub !== null) {
            this._rightStub.setSize(size({width: rightStubWidth, height: timeAxisSize.height}));
        }
    }

    optimalHeight() {
        const rendererOptions = this._getRendererOptions();
        return Math.ceil(rendererOptions.borderSize + rendererOptions.tickLength + rendererOptions.fontSize + rendererOptions.paddingTop + rendererOptions.paddingBottom + rendererOptions.labelBottomOffset);
    }

    update() {
        this._chart.model().timeScale().marks();
    }

    paint(type) {
        if (type === 0 /* InvalidationLevel.None */) {
            return;
        }
        if (type !== 1 /* InvalidationLevel.Cursor */) {
            this._canvasBinding.applySuggestedBitmapSize();
            const target = tryCreateCanvasRenderingTarget2D(this._canvasBinding);
            if (target !== null) {
                target.useBitmapCoordinateSpace((scope) => {
                    this._drawBackground(scope);
                    this._drawBorder(scope);
                    this._drawAdditionalSources(target, sourceBottomPaneViews);
                });
                this._drawTickMarks(target);
                this._drawAdditionalSources(target, sourcePaneViews);
            }
            if (this._leftStub !== null) {
                this._leftStub.paint(type);
            }
            if (this._rightStub !== null) {
                this._rightStub.paint(type);
            }
        }
        this._topCanvasBinding.applySuggestedBitmapSize();
        const topTarget = tryCreateCanvasRenderingTarget2D(this._topCanvasBinding);
        if (topTarget !== null) {
            topTarget.useBitmapCoordinateSpace(({context: ctx, bitmapSize}) => {
                ctx.clearRect(0, 0, bitmapSize.width, bitmapSize.height);
            });
            this._drawLabels([...this._chart.model().serieses(), this._chart.model().crosshairSource()], topTarget);
            this._drawAdditionalSources(topTarget, sourceTopPaneViews);
        }
    }

    _drawAdditionalSources(target, axisViewsGetter) {
        const sources = this._chart.model().serieses();
        for (const source of sources) {
            drawSourcePaneViews(axisViewsGetter, (renderer) => drawBackground(renderer, target, false, undefined), source, undefined);
        }
        for (const source of sources) {
            drawSourcePaneViews(axisViewsGetter, (renderer) => drawForeground(renderer, target, false, undefined), source, undefined);
        }
    }

    _drawBackground({context: ctx, bitmapSize}) {
        clearRect(ctx, 0, 0, bitmapSize.width, bitmapSize.height, this._chart.model().backgroundBottomColor());
    }

    _drawBorder({context: ctx, bitmapSize, verticalPixelRatio}) {
        if (this._chart.options().timeScale.borderVisible) {
            ctx.fillStyle = this._lineColor();
            const borderSize = Math.max(1, Math.floor(this._getRendererOptions().borderSize * verticalPixelRatio));
            ctx.fillRect(0, 0, bitmapSize.width, borderSize);
        }
    }

    _drawTickMarks(target) {
        const timeScale = this._chart.model().timeScale();
        const tickMarks = timeScale.marks();
        if (!tickMarks || tickMarks.length === 0) {
            return;
        }
        const maxWeight = this._horzScaleBehavior.maxTickMarkWeight(tickMarks);
        const rendererOptions = this._getRendererOptions();
        const options = timeScale.options();
        if (options.borderVisible && options.ticksVisible) {
            target.useBitmapCoordinateSpace(({context: ctx, horizontalPixelRatio, verticalPixelRatio}) => {
                ctx.strokeStyle = this._lineColor();
                ctx.fillStyle = this._lineColor();
                const tickWidth = Math.max(1, Math.floor(horizontalPixelRatio));
                const tickOffset = Math.floor(horizontalPixelRatio * 0.5);
                ctx.beginPath();
                const tickLen = Math.round(rendererOptions.tickLength * verticalPixelRatio);
                for (let index = tickMarks.length; index--;) {
                    const x = Math.round(tickMarks[index].coord * horizontalPixelRatio);
                    ctx.rect(x - tickOffset, 0, tickWidth, tickLen);
                }
                ctx.fill();
            });
        }
        target.useMediaCoordinateSpace(({context: ctx}) => {
            const yText = (rendererOptions.borderSize + rendererOptions.tickLength + rendererOptions.paddingTop + rendererOptions.fontSize / 2);
            ctx.textAlign = 'center';
            ctx.fillStyle = this._textColor();

            ctx.font = this._baseFont();
            for (const tickMark of tickMarks) {
                if (tickMark.weight < maxWeight) {
                    const coordinate = tickMark.needAlignCoordinate ? this._alignTickMarkLabelCoordinate(ctx, tickMark.coord, tickMark.label) : tickMark.coord;
                    ctx.fillText(tickMark.label, coordinate, yText);
                }
            }
            if (this._chart.options().timeScale.allowBoldLabels) {
                ctx.font = this._baseBoldFont();
            }
            for (const tickMark of tickMarks) {
                if (tickMark.weight >= maxWeight) {
                    const coordinate = tickMark.needAlignCoordinate ? this._alignTickMarkLabelCoordinate(ctx, tickMark.coord, tickMark.label) : tickMark.coord;
                    ctx.fillText(tickMark.label, coordinate, yText);
                }
            }
        });
    }

    _alignTickMarkLabelCoordinate(ctx, coordinate, labelText) {
        const labelWidth = this._widthCache.measureText(ctx, labelText);
        const labelWidthHalf = labelWidth / 2;
        const leftTextCoordinate = Math.floor(coordinate - labelWidthHalf) + 0.5;
        if (leftTextCoordinate < 0) {
            coordinate = coordinate + Math.abs(0 - leftTextCoordinate);
        } else if (leftTextCoordinate + labelWidth > this._size.width) {
            coordinate = coordinate - Math.abs(this._size.width - (leftTextCoordinate + labelWidth));
        }
        return coordinate;
    }

    _drawLabels(sources, target) {
        const rendererOptions = this._getRendererOptions();
        for (const source of sources) {
            for (const view of source.timeAxisViews()) {
                view.renderer().draw(target, rendererOptions);
            }
        }
    }

    _lineColor() {
        return this._chart.options().timeScale.borderColor;
    }

    _textColor() {
        return this._options.textColor;
    }

    _fontSize() {
        return this._options.fontSize;
    }

    _baseFont() {
        return makeFont(this._fontSize(), this._options.fontFamily);
    }

    _baseBoldFont() {
        return makeFont(this._fontSize(), this._options.fontFamily, 'bold');
    }

    _getRendererOptions() {
        if (this._rendererOptions === null) {
            this._rendererOptions = {
                borderSize: 1 /* Constants.BorderSize */,
                paddingTop: NaN,
                paddingBottom: NaN,
                paddingHorizontal: NaN,
                tickLength: 5 /* Constants.TickLength */,
                fontSize: NaN,
                font: '',
                widthCache: new TextWidthCache(),
                labelBottomOffset: 0,
            };
        }
        const rendererOptions = this._rendererOptions;
        const newFont = this._baseFont();
        if (rendererOptions.font !== newFont) {
            const fontSize = this._fontSize();
            rendererOptions.fontSize = fontSize;
            rendererOptions.font = newFont;
            rendererOptions.paddingTop = 3 * fontSize / 12;
            rendererOptions.paddingBottom = 3 * fontSize / 12;
            rendererOptions.paddingHorizontal = 9 * fontSize / 12;
            rendererOptions.labelBottomOffset = 4 * fontSize / 12;
            rendererOptions.widthCache.reset();
        }
        return this._rendererOptions;
    }

    _setCursor(type) {
        this._cell.style.cursor = type === 1 /* CursorType.EwResize */ ? 'ew-resize' : 'default';
    }

    _recreateStubs() {
        const model = this._chart.model();
        const options = model.options();
        if (!options.leftPriceScale.visible && this._leftStub !== null) {
            this._leftStubCell.removeChild(this._leftStub.getElement());
            this._leftStub.destroy();
            this._leftStub = null;
        }
        if (!options.rightPriceScale.visible && this._rightStub !== null) {
            this._rightStubCell.removeChild(this._rightStub.getElement());
            this._rightStub.destroy();
            this._rightStub = null;
        }
        const rendererOptionsProvider = this._chart.model().rendererOptionsProvider();
        const params = {
            rendererOptionsProvider: rendererOptionsProvider,
        };
        const borderVisibleGetter = () => {
            return options.leftPriceScale.borderVisible && model.timeScale().options().borderVisible;
        };
        const bottomColorGetter = () => model.backgroundBottomColor();
        if (options.leftPriceScale.visible && this._leftStub === null) {
            this._leftStub = new PriceAxisStub('left', options, params, borderVisibleGetter, bottomColorGetter);
            this._leftStubCell.appendChild(this._leftStub.getElement());
        }
        if (options.rightPriceScale.visible && this._rightStub === null) {
            this._rightStub = new PriceAxisStub('right', options, params, borderVisibleGetter, bottomColorGetter);
            this._rightStubCell.appendChild(this._rightStub.getElement());
        }
    }
}

const windowsChrome = isChromiumBased() && isWindows();

class ChartWidget {
    constructor(container, options, horzScaleBehavior) {
        this._paneWidgets = [];
        this._drawRafId = 0;
        this._height = 0;
        this._width = 0;
        this._leftPriceAxisWidth = 0;
        this._rightPriceAxisWidth = 0;
        this._invalidateMask = null;
        this._drawPlanned = false;
        this._clicked = new Delegate();
        this._crosshairMoved = new Delegate();
        this._observer = null;
        this._cursorStyleOverride = null;
        this._options = options;
        this._horzScaleBehavior = horzScaleBehavior;
        this._element = document.createElement('div');
        this._element.classList.add('tv-lightweight-charts');
        this._element.style.overflow = 'hidden';
        this._element.style.direction = 'ltr';
        this._element.style.width = '100%';
        this._element.style.height = '100%';
        this._tableElement = document.createElement('table');
        this._tableElement.setAttribute('cellspacing', '0');
        this._element.appendChild(this._tableElement);
        this._onWheelBound = this._onMousewheel.bind(this);
        if (shouldSubscribeMouseWheel(this._options)) {
            this._setMouseWheelEventListener(true);
        }
        this._model = new ChartModel(this._invalidateHandler.bind(this), this._options, horzScaleBehavior);
        this.model().crosshairMoved().subscribe(this._onPaneWidgetCrosshairMoved.bind(this), this);
        this._timeAxisWidget = new TimeAxisWidget(this, this._horzScaleBehavior);
        this._tableElement.appendChild(this._timeAxisWidget.getElement());
        const usedObserver = options.autoSize && this._installObserver();


        let width = this._options.width;
        let height = this._options.height;


        if (usedObserver || width === 0 || height === 0) {
            const containerRect = container.getBoundingClientRect();
            width = width || containerRect.width;
            height = height || containerRect.height;
        }
        this.resize(width, height);
        this._syncGuiWithModel();
        container.appendChild(this._element);
        this._updateTimeAxisVisibility();
        this._model.timeScale().optionsApplied().subscribe(this._model.fullUpdate.bind(this._model), this);
        this._model.priceScalesOptionsChanged().subscribe(this._model.fullUpdate.bind(this._model), this);
    }

    model() {
        return this._model;
    }

    options() {
        return this._options;
    }

    timeAxisWidget() {
        return this._timeAxisWidget;
    }

    destroy() {
        this._setMouseWheelEventListener(false);
        if (this._drawRafId !== 0) {
            window.cancelAnimationFrame(this._drawRafId);
        }
        this._model.crosshairMoved().unsubscribeAll(this);
        this._model.timeScale().optionsApplied().unsubscribeAll(this);
        this._model.priceScalesOptionsChanged().unsubscribeAll(this);
        this._model.destroy();
        for (const paneWidget of this._paneWidgets) {
            this._tableElement.removeChild(paneWidget.getElement());
            paneWidget.clicked().unsubscribeAll(this);
            paneWidget.destroy();
        }
        this._paneWidgets = [];


        ensureNotNull(this._timeAxisWidget).destroy();
        if (this._element.parentElement !== null) {
            this._element.parentElement.removeChild(this._element);
        }
        this._crosshairMoved.destroy();
        this._clicked.destroy();
    }

    resize(width, height, forceRepaint = false) {
        if (this._height === height && this._width === width) {
            return;
        }
        const sizeHint = suggestChartSize(size({width, height}));
        this._height = sizeHint.height;
        this._width = sizeHint.width;
        const heightStr = this._height + 'px';
        const widthStr = this._width + 'px';
        ensureNotNull(this._element).style.height = heightStr;
        ensureNotNull(this._element).style.width = widthStr;
        this._tableElement.style.height = heightStr;
        this._tableElement.style.width = widthStr;
        if (forceRepaint) {
            this._drawImpl(InvalidateMask.full(), performance.now());
        } else {
            this._model.fullUpdate();
        }
    }

    paint(invalidateMask) {
        if (invalidateMask === undefined) {
            invalidateMask = InvalidateMask.full();
        }
        for (let i = 0; i < this._paneWidgets.length; i++) {
            this._paneWidgets[i].paint(invalidateMask.invalidateForPane(i).level);
        }
        if (this._options.timeScale.visible) {
            this._timeAxisWidget.paint(invalidateMask.fullInvalidation());
        }
    }

    applyOptions(options) {
        const currentlyHasMouseWheelListener = shouldSubscribeMouseWheel(this._options);
        this._model.applyOptions(options);
        const shouldHaveMouseWheelListener = shouldSubscribeMouseWheel(this._options);
        if (shouldHaveMouseWheelListener !== currentlyHasMouseWheelListener) {
            this._setMouseWheelEventListener(shouldHaveMouseWheelListener);
        }
        this._updateTimeAxisVisibility();
        this._applyAutoSizeOptions(options);
    }

    clicked() {
        return this._clicked;
    }

    crosshairMoved() {
        return this._crosshairMoved;
    }

    getPriceAxisWidth(position) {
        if (position === 'left' && !this._isLeftAxisVisible()) {
            return 0;
        }
        if (position === 'right' && !this._isRightAxisVisible()) {
            return 0;
        }
        if (this._paneWidgets.length === 0) {
            return 0;
        }


        const priceAxisWidget = position === 'left' ? this._paneWidgets[0].leftPriceAxisWidget() : this._paneWidgets[0].rightPriceAxisWidget();
        return ensureNotNull(priceAxisWidget).getWidth();
    }

    element() {
        return this._element;
    }

    setCursorStyle(style) {
        this._cursorStyleOverride = style;
        if (this._cursorStyleOverride) {
            this.element().style.setProperty('cursor', style);
        } else {
            this.element().style.removeProperty('cursor');
        }
    }

    _applyAutoSizeOptions(options) {
        if (options.autoSize && !this._observer) {

            this._installObserver();
        }
        if (!options.autoSize && (options.width !== undefined || options.height !== undefined)) {
            this.resize(options.width || this._width, options.height || this._height);
        }
    }

    _adjustSizeImpl() {
        let totalStretch = 0;
        let leftPriceAxisWidth = 0;
        let rightPriceAxisWidth = 0;
        for (const paneWidget of this._paneWidgets) {
            if (this._isLeftAxisVisible()) {
                leftPriceAxisWidth = Math.max(leftPriceAxisWidth, ensureNotNull(paneWidget.leftPriceAxisWidget()).optimalWidth(), this._options.leftPriceScale.minimumWidth);
            }
            if (this._isRightAxisVisible()) {
                rightPriceAxisWidth = Math.max(rightPriceAxisWidth, ensureNotNull(paneWidget.rightPriceAxisWidget()).optimalWidth(), this._options.rightPriceScale.minimumWidth);
            }
            totalStretch += paneWidget.stretchFactor();
        }
        leftPriceAxisWidth = suggestPriceScaleWidth(leftPriceAxisWidth);
        rightPriceAxisWidth = suggestPriceScaleWidth(rightPriceAxisWidth);
        const width = this._width;
        const height = this._height;
        const paneWidth = Math.max(width - leftPriceAxisWidth - rightPriceAxisWidth, 0);


        const separatorsHeight = 0;
        const timeAxisVisible = this._options.timeScale.visible;
        let timeAxisHeight = timeAxisVisible ? Math.max(this._timeAxisWidget.optimalHeight(), this._options.timeScale.minimumHeight) : 0;
        timeAxisHeight = suggestTimeScaleHeight(timeAxisHeight);
        const otherWidgetHeight = separatorsHeight + timeAxisHeight;
        const totalPaneHeight = height < otherWidgetHeight ? 0 : height - otherWidgetHeight;
        const stretchPixels = totalPaneHeight / totalStretch;
        let accumulatedHeight = 0;
        for (let paneIndex = 0; paneIndex < this._paneWidgets.length; ++paneIndex) {
            const paneWidget = this._paneWidgets[paneIndex];
            paneWidget.setState(this._model.panes()[paneIndex]);
            let paneHeight = 0;
            let calculatePaneHeight = 0;
            if (paneIndex === this._paneWidgets.length - 1) {
                calculatePaneHeight = totalPaneHeight - accumulatedHeight;
            } else {
                calculatePaneHeight = Math.round(paneWidget.stretchFactor() * stretchPixels);
            }
            paneHeight = Math.max(calculatePaneHeight, 2);
            accumulatedHeight += paneHeight;
            paneWidget.setSize(size({width: paneWidth, height: paneHeight}));
            if (this._isLeftAxisVisible()) {
                paneWidget.setPriceAxisSize(leftPriceAxisWidth, 'left');
            }
            if (this._isRightAxisVisible()) {
                paneWidget.setPriceAxisSize(rightPriceAxisWidth, 'right');
            }
            if (paneWidget.state()) {
                this._model.setPaneHeight(paneWidget.state(), paneHeight);
            }
        }
        this._timeAxisWidget.setSizes(size({
            width: timeAxisVisible ? paneWidth : 0, height: timeAxisHeight
        }), timeAxisVisible ? leftPriceAxisWidth : 0, timeAxisVisible ? rightPriceAxisWidth : 0);
        this._model.setWidth(paneWidth);
        if (this._leftPriceAxisWidth !== leftPriceAxisWidth) {
            this._leftPriceAxisWidth = leftPriceAxisWidth;
        }
        if (this._rightPriceAxisWidth !== rightPriceAxisWidth) {
            this._rightPriceAxisWidth = rightPriceAxisWidth;
        }
    }

    _setMouseWheelEventListener(add) {
        if (add) {
            this._element.addEventListener('wheel', this._onWheelBound, {passive: false});
            return;
        }
        this._element.removeEventListener('wheel', this._onWheelBound);
    }

    _determineWheelSpeedAdjustment(event) {
        switch (event.deltaMode) {
            case event.DOM_DELTA_PAGE:

                return 120;
            case event.DOM_DELTA_LINE:

                return 32;
        }
        if (!windowsChrome) {
            return 1;
        }


        return (1 / window.devicePixelRatio);
    }

    _onMousewheel(event) {
        if ((event.deltaX === 0 || !this._options.handleScroll.mouseWheel) && (event.deltaY === 0 || !this._options.handleScale.mouseWheel)) {
            return;
        }
        const scrollSpeedAdjustment = this._determineWheelSpeedAdjustment(event);
        const deltaX = scrollSpeedAdjustment * event.deltaX / 100;
        const deltaY = -(scrollSpeedAdjustment * event.deltaY / 100);
        if (event.cancelable) {
            event.preventDefault();
        }
        if (deltaY !== 0 && this._options.handleScale.mouseWheel) {
            const zoomScale = Math.sign(deltaY) * Math.min(1, Math.abs(deltaY));
            const scrollPosition = event.clientX - this._element.getBoundingClientRect().left;
            this.model().zoomTime(scrollPosition, zoomScale);
        }
        if (deltaX !== 0 && this._options.handleScroll.mouseWheel) {
            this.model().scrollChart(deltaX * -80);
        }
    }

    _drawImpl(invalidateMask, time) {
        var _a;
        const invalidationType = invalidateMask.fullInvalidation();

        if (invalidationType === 3 /* InvalidationLevel.Full */) {
            this._updateGui();
        }

        if (invalidationType === 3 /* InvalidationLevel.Full */ || invalidationType === 2 /* InvalidationLevel.Light */) {
            this._applyMomentaryAutoScale(invalidateMask);
            this._applyTimeScaleInvalidations(invalidateMask, time);
            this._timeAxisWidget.update();
            this._paneWidgets.forEach((pane) => {
                pane.updatePriceAxisWidgets();
            });


            if (((_a = this._invalidateMask) === null || _a === void 0 ? void 0 : _a.fullInvalidation()) === 3 /* InvalidationLevel.Full */) {
                this._invalidateMask.merge(invalidateMask);
                this._updateGui();
                this._applyMomentaryAutoScale(this._invalidateMask);
                this._applyTimeScaleInvalidations(this._invalidateMask, time);
                invalidateMask = this._invalidateMask;
                this._invalidateMask = null;
            }
        }
        this.paint(invalidateMask);
    }

    _applyTimeScaleInvalidations(invalidateMask, time) {
        for (const tsInvalidation of invalidateMask.timeScaleInvalidations()) {
            this._applyTimeScaleInvalidation(tsInvalidation, time);
        }
    }

    _applyMomentaryAutoScale(invalidateMask) {
        const panes = this._model.panes();
        for (let i = 0; i < panes.length; i++) {
            if (invalidateMask.invalidateForPane(i).autoScale) {
                panes[i].momentaryAutoScale();
            }
        }
    }

    _applyTimeScaleInvalidation(invalidation, time) {
        const timeScale = this._model.timeScale();
        switch (invalidation.type) {
            case 0 /* TimeScaleInvalidationType.FitContent */
            :
                timeScale.fitContent();
                break;
            case 1 /* TimeScaleInvalidationType.ApplyRange */
            :
                timeScale.setLogicalRange(invalidation.value);
                break;
            case 2 /* TimeScaleInvalidationType.ApplyBarSpacing */
            :
                timeScale.setBarSpacing(invalidation.value);
                break;
            case 3 /* TimeScaleInvalidationType.ApplyRightOffset */
            :
                timeScale.setRightOffset(invalidation.value);
                break;
            case 4 /* TimeScaleInvalidationType.Reset */
            :
                timeScale.restoreDefault();
                break;
            case 5 /* TimeScaleInvalidationType.Animation */
            :
                if (!invalidation.value.finished(time)) {
                    timeScale.setRightOffset(invalidation.value.getPosition(time));
                }
                break;
        }
    }

    _invalidateHandler(invalidateMask) {
        if (this._invalidateMask !== null) {
            this._invalidateMask.merge(invalidateMask);
        } else {
            this._invalidateMask = invalidateMask;
        }
        if (!this._drawPlanned) {
            this._drawPlanned = true;
            this._drawRafId = window.requestAnimationFrame((time) => {
                this._drawPlanned = false;
                this._drawRafId = 0;
                if (this._invalidateMask !== null) {
                    const mask = this._invalidateMask;
                    this._invalidateMask = null;
                    this._drawImpl(mask, time);
                    for (const tsInvalidation of mask.timeScaleInvalidations()) {
                        if (tsInvalidation.type === 5 /* TimeScaleInvalidationType.Animation */ && !tsInvalidation.value.finished(time)) {
                            this.model().setTimeScaleAnimation(tsInvalidation.value);
                            break;
                        }
                    }
                }
            });
        }
    }

    _updateGui() {
        this._syncGuiWithModel();
    }


    _syncGuiWithModel() {
        const panes = this._model.panes();
        const targetPaneWidgetsCount = panes.length;
        const actualPaneWidgetsCount = this._paneWidgets.length;
        for (let i = targetPaneWidgetsCount; i < actualPaneWidgetsCount; i++) {
            const paneWidget = ensureDefined(this._paneWidgets.pop());
            this._tableElement.removeChild(paneWidget.getElement());
            paneWidget.clicked().unsubscribeAll(this);
            paneWidget.destroy();
        }
        for (let i = actualPaneWidgetsCount; i < targetPaneWidgetsCount; i++) {
            const paneWidget = new PaneWidget(this, panes[i]);
            paneWidget.clicked().subscribe(this._onPaneWidgetClicked.bind(this), this);
            this._paneWidgets.push(paneWidget);
            this._tableElement.insertBefore(paneWidget.getElement(), this._timeAxisWidget.getElement());
        }
        for (let i = 0; i < targetPaneWidgetsCount; i++) {
            const state = panes[i];
            const paneWidget = this._paneWidgets[i];
            if (paneWidget.state() !== state) {
                paneWidget.setState(state);
            } else {
                paneWidget.updatePriceAxisWidgetsStates();
            }
        }
        this._updateTimeAxisVisibility();
        this._adjustSizeImpl();
    }

    _getMouseEventParamsImpl(index, point, event) {
        var _a;
        const seriesData = new Map();
        if (index !== null) {
            const serieses = this._model.serieses();
            serieses.forEach((s) => {

                const data = s.bars().search(index);
                if (data !== null) {
                    seriesData.set(s, data);
                }
            });
        }
        let clientTime;
        if (index !== null) {
            const timePoint = (_a = this._model.timeScale().indexToTimeScalePoint(index)) === null || _a === void 0 ? void 0 : _a.originalTime;
            if (timePoint !== undefined) {
                clientTime = timePoint;
            }
        }
        const hoveredSource = this.model().hoveredSource();
        const hoveredSeries = hoveredSource !== null && hoveredSource.source instanceof Series ? hoveredSource.source : undefined;
        const hoveredObject = hoveredSource !== null && hoveredSource.object !== undefined ? hoveredSource.object.externalId : undefined;
        return {
            originalTime: clientTime,
            index: index !== null && index !== void 0 ? index : undefined,
            point: point !== null && point !== void 0 ? point : undefined,
            hoveredSeries: hoveredSeries,
            seriesData: seriesData,
            hoveredObject: hoveredObject,
            touchMouseEventData: event !== null && event !== void 0 ? event : undefined,
        };
    }

    _onPaneWidgetClicked(time, point, event) {
        this._clicked.fire(() => this._getMouseEventParamsImpl(time, point, event));
    }

    _onPaneWidgetCrosshairMoved(time, point, event) {
        this._crosshairMoved.fire(() => this._getMouseEventParamsImpl(time, point, event));
    }

    _updateTimeAxisVisibility() {
        this._timeAxisWidget.getElement().style.display = this._options.timeScale.visible ? '' : 'none';
    }

    _isLeftAxisVisible() {
        return this._paneWidgets[0].state().leftPriceScale().options().visible;
    }

    _isRightAxisVisible() {
        return this._paneWidgets[0].state().rightPriceScale().options().visible;
    }
}

function shouldSubscribeMouseWheel(options) {
    return Boolean(options.handleScroll.mouseWheel || options.handleScale.mouseWheel);
}

function isWhitespaceData(data) {
    return data.open === undefined && data.value === undefined;
}

function isFulfilledData(data) {
    return (data.open !== undefined || data.value !== undefined);
}

function __rest(s, e) {
    let i;
    let p;
    const t = {};
    for (p in s) if (Object.prototype.hasOwnProperty.call(s, p) && e.indexOf(p) < 0) t[p] = s[p];
    if (s != null && typeof Object.getOwnPropertySymbols === "function") {
        i = 0;
    }
    {
        p = Object.getOwnPropertySymbols(s);
        for (; i < p.length; i++) {
            if (e.indexOf(p[i]) < 0 && Object.prototype.propertyIsEnumerable.call(s, p[i])) t[p[i]] = s[p[i]];
        }
    }
    return t;
}

function getColoredLineBasedSeriesPlotRow(time, index, item, originalTime) {
    const val = item.value;
    const res = {
        index: index, time: time, value: [val, val, val, val], originalTime: originalTime
    };
    if (item.color !== undefined) {
        res.color = item.color;
    }
    return res;
}

function getBarSeriesPlotRow(time, index, item, originalTime) {
    const res = {
        index: index, time: time, value: [item.open, item.high, item.low, item.close], originalTime: originalTime
    };
    if (item.color !== undefined) {
        res.color = item.color;
    }
    return res;
}

function getCandlestickSeriesPlotRow(time, index, item, originalTime) {
    const res = {
        index: index, time: time, value: [item.open, item.high, item.low, item.close], originalTime: originalTime
    };
    if (item.color !== undefined) {
        res.color = item.color;
    }
    if (item.borderColor !== undefined) {
        res.borderColor = item.borderColor;
    }
    if (item.wickColor !== undefined) {
        res.wickColor = item.wickColor;
    }
    return res;
}

function getCustomSeriesPlotRow(time, index, item, originalTime, dataToPlotRow) {
    const values = ensureDefined(dataToPlotRow)(item);
    const max = Math.max(...values);
    const min = Math.min(...values);
    const last = values[values.length - 1];
    const value = [last, max, min, last];
    const _a = item, {color} = _a, data = __rest(_a, ["time", "color"]);
    return {
        index: index, time: time, value: value, originalTime: originalTime, data: data, color: color
    };
}

function isSeriesPlotRow(row) {
    return row.value !== undefined;
}

function wrapCustomValues(plotRow, bar) {
    if (bar.customValues !== undefined) {
        plotRow.customValues = bar.customValues;
    }
    return plotRow;
}

function isWhitespaceDataWithCustomCheck(bar, customIsWhitespace) {
    if (customIsWhitespace) {
        return customIsWhitespace(bar);
    }
    return isWhitespaceData(bar);
}

function wrapWhitespaceData(createPlotRowFn) {
    return (time, index, bar, originalTime, dataToPlotRow, customIsWhitespace) => {
        if (isWhitespaceDataWithCustomCheck(bar, customIsWhitespace)) {
            return wrapCustomValues({
                time: time, index: index, originalTime: originalTime
            }, bar);
        }
        return wrapCustomValues(createPlotRowFn(time, index, bar, originalTime, dataToPlotRow), bar);
    };
}

function getSeriesPlotRowCreator(seriesType) {
    const seriesPlotRowFnMap = {
        Candlestick: wrapWhitespaceData(getCandlestickSeriesPlotRow),
        Bar: wrapWhitespaceData(getBarSeriesPlotRow),
        Line: wrapWhitespaceData(getColoredLineBasedSeriesPlotRow),
        Custom: wrapWhitespaceData(getCustomSeriesPlotRow),
    };
    return seriesPlotRowFnMap[seriesType];
}


function createEmptyTimePointData(timePoint) {
    return {index: 0, mapping: new Map(), timePoint: timePoint};
}

function seriesRowsFirstAndLastTime(seriesRows, bh) {
    if (seriesRows === undefined || seriesRows.length === 0) {
        return undefined;
    }
    return {
        firstTime: bh.key(seriesRows[0].time), lastTime: bh.key(seriesRows[seriesRows.length - 1].time),
    };
}

function seriesUpdateInfo(seriesRows, prevSeriesRows, bh) {
    const firstAndLastTime = seriesRowsFirstAndLastTime(seriesRows, bh);
    const prevFirstAndLastTime = seriesRowsFirstAndLastTime(prevSeriesRows, bh);
    if (firstAndLastTime !== undefined && prevFirstAndLastTime !== undefined) {
        return {
            lastBarUpdatedOrNewBarsAddedToTheRight: firstAndLastTime.lastTime >= prevFirstAndLastTime.lastTime && firstAndLastTime.firstTime >= prevFirstAndLastTime.firstTime,
        };
    }
    return undefined;
}

function timeScalePointTime(mergedPointData) {
    let result;
    mergedPointData.forEach((v) => {
        if (result === undefined) {
            result = v.originalTime;
        }
    });
    return ensureDefined(result);
}

class DataLayer {
    constructor(horzScaleBehavior) {


        this._pointDataByTimePoint = new Map();
        this._seriesRowsBySeries = new Map();
        this._seriesLastTimePoint = new Map();

        this._sortedTimePoints = [];
        this._horzScaleBehavior = horzScaleBehavior;
    }

    destroy() {
        this._pointDataByTimePoint.clear();
        this._seriesRowsBySeries.clear();
        this._seriesLastTimePoint.clear();
        this._sortedTimePoints = [];
    }

    setSeriesData(series, data) {
        let needCleanupPoints = this._pointDataByTimePoint.size !== 0;
        let isTimeScaleAffected = false;

        const prevSeriesRows = this._seriesRowsBySeries.get(series);
        if (prevSeriesRows !== undefined) {
            if (this._seriesRowsBySeries.size === 1) {
                needCleanupPoints = false;
                isTimeScaleAffected = true;

                this._pointDataByTimePoint.clear();
            } else {


                for (const point of this._sortedTimePoints) {
                    if (point.pointData.mapping.delete(series)) {
                        isTimeScaleAffected = true;
                    }
                }
            }
        }
        let seriesRows = [];
        if (data.length !== 0) {
            const originalTimes = data.map((d) => d.time);
            const timeConverter = this._horzScaleBehavior.createConverterToInternalObj(data);
            const createPlotRow = getSeriesPlotRowCreator(series.seriesType());
            const dataToPlotRow = undefined;
            const customWhitespaceChecker = undefined;
            seriesRows = data.map((item, index) => {
                const time = timeConverter(item.time);
                const horzItemKey = this._horzScaleBehavior.key(time);
                let timePointData = this._pointDataByTimePoint.get(horzItemKey);
                if (timePointData === undefined) {

                    timePointData = createEmptyTimePointData(time);
                    this._pointDataByTimePoint.set(horzItemKey, timePointData);
                    isTimeScaleAffected = true;
                }
                const row = createPlotRow(time, timePointData.index, item, originalTimes[index], dataToPlotRow, customWhitespaceChecker);
                timePointData.mapping.set(series, row);
                return row;
            });
        }
        if (needCleanupPoints) {


            this._cleanupPointsData();
        }
        this._setRowsToSeries(series, seriesRows);
        let firstChangedPointIndex = -1;
        if (isTimeScaleAffected) {


            const newTimeScalePoints = [];
            this._pointDataByTimePoint.forEach((pointData) => {
                newTimeScalePoints.push({
                    timeWeight: 0,
                    time: pointData.timePoint,
                    pointData,
                    originalTime: timeScalePointTime(pointData.mapping),
                });
            });
            newTimeScalePoints.sort((t1, t2) => this._horzScaleBehavior.key(t1.time) - this._horzScaleBehavior.key(t2.time));
            firstChangedPointIndex = this._replaceTimeScalePoints(newTimeScalePoints);
        }
        return this._getUpdateResponse(series, firstChangedPointIndex, seriesUpdateInfo(this._seriesRowsBySeries.get(series), prevSeriesRows, this._horzScaleBehavior));
    }

    _setRowsToSeries(series, seriesRows) {
        if (seriesRows.length !== 0) {
            this._seriesRowsBySeries.set(series, seriesRows.filter(isSeriesPlotRow));
            this._seriesLastTimePoint.set(series, seriesRows[seriesRows.length - 1].time);
        } else {
            this._seriesRowsBySeries.delete(series);
            this._seriesLastTimePoint.delete(series);
        }
    }

    _cleanupPointsData() {


        for (const point of this._sortedTimePoints) {
            if (point.pointData.mapping.size === 0) {
                this._pointDataByTimePoint.delete(this._horzScaleBehavior.key(point.time));
            }
        }
    }

    /**
     * Sets new time scale and make indexes valid for all series
     *
     * @returns The index of the first changed point or `-1` if there is no change.
     */
    _replaceTimeScalePoints(newTimePoints) {
        let firstChangedPointIndex = -1;

        for (let index = 0; index < this._sortedTimePoints.length && index < newTimePoints.length; ++index) {
            const oldPoint = this._sortedTimePoints[index];
            const newPoint = newTimePoints[index];
            if (this._horzScaleBehavior.key(oldPoint.time) !== this._horzScaleBehavior.key(newPoint.time)) {
                firstChangedPointIndex = index;
                break;
            }

            newPoint.timeWeight = oldPoint.timeWeight;
            assignIndexToPointData(newPoint.pointData, index);
        }
        if (firstChangedPointIndex === -1 && this._sortedTimePoints.length !== newTimePoints.length) {


            firstChangedPointIndex = Math.min(this._sortedTimePoints.length, newTimePoints.length);
        }
        if (firstChangedPointIndex === -1) {

            return -1;
        }


        for (let index = firstChangedPointIndex; index < newTimePoints.length; ++index) {
            assignIndexToPointData(newTimePoints[index].pointData, index);
        }

        this._horzScaleBehavior.fillWeightsForPoints(newTimePoints, firstChangedPointIndex);
        this._sortedTimePoints = newTimePoints;
        return firstChangedPointIndex;
    }

    _getBaseIndex() {
        if (this._seriesRowsBySeries.size === 0) {

            return null;
        }
        let baseIndex = 0;
        this._seriesRowsBySeries.forEach((data) => {
            if (data.length !== 0) {
                baseIndex = Math.max(baseIndex, data[data.length - 1].index);
            }
        });
        return baseIndex;
    }

    _getUpdateResponse(updatedSeries, firstChangedPointIndex, info) {
        const dataUpdateResponse = {
            series: new Map(), timeScale: {
                baseIndex: this._getBaseIndex(),
            },
        };
        if (firstChangedPointIndex !== -1) {


            this._seriesRowsBySeries.forEach((data, s) => {
                dataUpdateResponse.series.set(s, {
                    data: data, info: s === updatedSeries ? info : undefined,
                });
            });


            if (!this._seriesRowsBySeries.has(updatedSeries)) {
                dataUpdateResponse.series.set(updatedSeries, {data: [], info: info});
            }
            dataUpdateResponse.timeScale.points = this._sortedTimePoints;
            dataUpdateResponse.timeScale.firstChangedPointIndex = firstChangedPointIndex;
        } else {
            const seriesData = this._seriesRowsBySeries.get(updatedSeries);

            dataUpdateResponse.series.set(updatedSeries, {
                data: seriesData || [], info: info
            });
        }
        return dataUpdateResponse;
    }
}

function assignIndexToPointData(pointData, index) {

    pointData.index = index;

    pointData.mapping.forEach((seriesRow) => {
        seriesRow.index = index;
    });
}

function singleValueData(plotRow) {
    const data = {
        value: plotRow.value[3 /* PlotRowValueIndex.Close */], time: plotRow.originalTime,
    };
    if (plotRow.customValues !== undefined) {
        data.customValues = plotRow.customValues;
    }
    return data;
}

function lineData(plotRow) {
    const result = singleValueData(plotRow);
    if (plotRow.color !== undefined) {
        result.color = plotRow.color;
    }
    return result;
}

function ohlcData(plotRow) {
    const data = {
        open: plotRow.value[0 /* PlotRowValueIndex.Open */],
        high: plotRow.value[1 /* PlotRowValueIndex.High */],
        low: plotRow.value[2 /* PlotRowValueIndex.Low */],
        close: plotRow.value[3 /* PlotRowValueIndex.Close */],
        time: plotRow.originalTime,
    };
    if (plotRow.customValues !== undefined) {
        data.customValues = plotRow.customValues;
    }
    return data;
}

function barData(plotRow) {
    const result = ohlcData(plotRow);
    if (plotRow.color !== undefined) {
        result.color = plotRow.color;
    }
    return result;
}

function candlestickData(plotRow) {
    const result = ohlcData(plotRow);
    const {color: color, borderColor: borderColor, wickColor: wickColor} = plotRow;
    if (color !== undefined) {
        result.color = color;
    }
    if (borderColor !== undefined) {
        result.borderColor = borderColor;
    }
    if (wickColor !== undefined) {
        result.wickColor = wickColor;
    }
    return result;
}

function getSeriesDataCreator(seriesType) {
    const seriesPlotRowToDataMap = {
        Line: (lineData), Bar: (barData), Candlestick: (candlestickData), Custom: (customData),
    };
    return seriesPlotRowToDataMap[seriesType];
}

function customData(plotRow) {
    const time = plotRow.originalTime;
    return Object.assign(Object.assign({}, plotRow.data), {time});
}

const crosshairOptionsDefaults = {
    vertLine: {
        color: '#9598A1',
        width: 1,
        style: 3 /* LineStyle.LargeDashed */,
        visible: true,
        labelVisible: true,
        labelBackgroundColor: '#131722',
    }, horzLine: {
        color: '#9598A1',
        width: 1,
        style: 3 /* LineStyle.LargeDashed */,
        visible: true,
        labelVisible: true,
        labelBackgroundColor: '#131722',
    }, mode: 0 /* CrosshairMode.Normal */,
};

const gridOptionsDefaults = {
    vertLines: {
        color: '#D6DCDE', style: 0 /* LineStyle.Solid */, visible: true,
    }, horzLines: {
        color: '#D6DCDE', style: 0 /* LineStyle.Solid */, visible: true,
    },
};

const layoutOptionsDefaults = {
    background: {
        type: "solid" /* ColorType.Solid */, color: '#FFFFFF',
    }, textColor: '#191919', fontSize: 12, fontFamily: defaultFontFamily,
};

const priceScaleOptionsDefaults = {
    autoScale: true,
    mode: 0 /* PriceScaleMode.Normal */,
    invertScale: false,
    alignLabels: true,
    borderVisible: true,
    borderColor: '#2B2B43',
    entireTextOnly: false,
    visible: false,
    ticksVisible: false,
    scaleMargins: {
        bottom: 0.1, top: 0.2,
    },
    minimumWidth: 0,
};

const timeScaleOptionsDefaults = {
    rightOffset: 0,
    barSpacing: 6,
    minBarSpacing: 0.5,
    fixLeftEdge: false,
    fixRightEdge: false,
    lockVisibleTimeRangeOnResize: false,
    rightBarStaysOnScroll: false,
    borderVisible: true,
    borderColor: '#2B2B43',
    visible: true,
    timeVisible: false,
    secondsVisible: true,
    shiftVisibleRangeOnNewBar: true,
    allowShiftVisibleRangeOnWhitespaceReplacement: false,
    ticksVisible: false,
    uniformDistribution: false,
    minimumHeight: 0,
    allowBoldLabels: true,
};

function chartOptionsDefaults() {
    return {
        width: 0,
        height: 0,
        autoSize: false,
        layout: layoutOptionsDefaults,
        crosshair: crosshairOptionsDefaults,
        grid: gridOptionsDefaults,
        overlayPriceScales: Object.assign({}, priceScaleOptionsDefaults),
        leftPriceScale: Object.assign(Object.assign({}, priceScaleOptionsDefaults), {visible: false}),
        rightPriceScale: Object.assign(Object.assign({}, priceScaleOptionsDefaults), {visible: true}),
        timeScale: timeScaleOptionsDefaults,
        localization: {
            locale: isRunningOnClientSide ? navigator.language : '', dateFormat: 'dd MMM \'yy',
        },
        handleScroll: {
            mouseWheel: true, pressedMouseMove: true, horzTouchDrag: true, vertTouchDrag: true,
        },
        handleScale: {
            axisPressedMouseMove: {
                time: true, price: true,
            }, mouseWheel: true, pinch: true,
        },
        kineticScroll: {
            mouse: false, touch: true,
        },
        trackingMode: {
            exitMode: 1 /* TrackingModeExitMode.OnNextTap */,
        },
    };
}

class PriceScaleApi {
    constructor(chartWidget, priceScaleId) {
        this._chartWidget = chartWidget;
        this._priceScaleId = priceScaleId;
    }

    applyOptions(options) {
        this._chartWidget.model().applyPriceScaleOptions(this._priceScaleId, options);
    }

    options() {
        return this._priceScale().options();
    }

    width() {
        if (!isDefaultPriceScale(this._priceScaleId)) {
            return 0;
        }
        return this._chartWidget.getPriceAxisWidth(this._priceScaleId);
    }

    _priceScale() {
        return ensureNotNull(this._chartWidget.model().findPriceScale(this._priceScaleId)).priceScale;
    }
}

function checkItemsAreOrdered(data, bh, allowDuplicates = false) {
    if (data.length === 0) {
        return;
    }
    let prevTime = bh.key(data[0].time);
    for (let i = 1; i < data.length; ++i) {
        const currentTime = bh.key(data[i].time);
        const checkResult = allowDuplicates ? prevTime <= currentTime : prevTime < currentTime;
        assert(checkResult, `data must be asc ordered by time, index=${i}, time=${currentTime}, prev time=${prevTime}`);
        prevTime = currentTime;
    }
}

function checkSeriesValuesType(type, data) {
    data.forEach(getChecker(type));
}

function getChecker(type) {
    switch (type) {
        case 'Candlestick':
            return checkBarItem.bind(null, type);
        case 'Line':
            return checkLineItem.bind(null, type);
    }
}

function checkBarItem(type, barItem) {
    if (!isFulfilledData(barItem)) {
        return;
    }
    assert(typeof barItem.open === 'number', `${type} series item data value of open must be a number, got=${typeof barItem.open}, value=${barItem.open}`);
    assert(typeof barItem.high === 'number', `${type} series item data value of high must be a number, got=${typeof barItem.high}, value=${barItem.high}`);
    assert(typeof barItem.low === 'number', `${type} series item data value of low must be a number, got=${typeof barItem.low}, value=${barItem.low}`);
    assert(typeof barItem.close === 'number', `${type} series item data value of close must be a number, got=${typeof barItem.close}, value=${barItem.close}`);
}

function checkLineItem(type, lineItem) {
    if (!isFulfilledData(lineItem)) {
        return;
    }
    assert(typeof lineItem.value === 'number', `${type} series item data value must be a number, got=${typeof lineItem.value}, value=${lineItem.value}`);
}

class SeriesApi {
    constructor(series, dataUpdatesConsumer, priceScaleApiProvider, chartApi, horzScaleBehavior) {
        this._dataChangedDelegate = new Delegate();
        this._series = series;
        this._dataUpdatesConsumer = dataUpdatesConsumer;
        this._horzScaleBehavior = horzScaleBehavior;
    }

    destroy() {
        this._dataChangedDelegate.destroy();
    }

    priceFormatter() {
        return this._series.formatter();
    }

    setData(data) {
        checkItemsAreOrdered(data, this._horzScaleBehavior);
        checkSeriesValuesType(this._series.seriesType(), data);
        this._dataUpdatesConsumer.applyNewData(this._series, data);
        this._onDataChanged('full');
    }

    applyOptions(options) {
        this._series.applyOptions(options);
    }

    options() {
        return clone(this._series.options());
    }

    _onDataChanged(scope) {
        if (this._dataChangedDelegate.hasListeners()) {
            this._dataChangedDelegate.fire(scope);
        }
    }
}

class TimeScaleApi {
    constructor(model, timeAxisWidget, horzScaleBehavior) {
        this._timeRangeChanged = new Delegate();
        this._logicalRangeChanged = new Delegate();
        this._sizeChanged = new Delegate();
        this._model = model;
        this._timeScale = model.timeScale();
        this._timeAxisWidget = timeAxisWidget;
        this._horzScaleBehavior = horzScaleBehavior;
    }

    destroy() {
        this._timeRangeChanged.destroy();
        this._logicalRangeChanged.destroy();
        this._sizeChanged.destroy();
    }

    scrollToRealTime() {
        this._timeScale.scrollToRealTime();
    }

    setVisibleRange(range) {
        const convertedRange = {
            from: this._horzScaleBehavior.convertHorzItemToInternal(range.from),
            to: this._horzScaleBehavior.convertHorzItemToInternal(range.to),
        };
        const logicalRange = this._timeScale.logicalRangeForTimeRange(convertedRange);
        this._model.setTargetLogicalRange(logicalRange);
    }

    width() {
        return this._timeAxisWidget.getSize().width;
    }

    height() {
        return this._timeAxisWidget.getSize().height;
    }

    applyOptions(options) {
        this._timeScale.applyOptions(options);
    }

    options() {
        return Object.assign(Object.assign({}, clone(this._timeScale.options())), {barSpacing: this._timeScale.barSpacing()});
    }
}

function patchPriceFormat(priceFormat) {
    if (priceFormat === undefined || priceFormat.type === 'custom') {
        return;
    }
    const priceFormatBuiltIn = priceFormat;
    if (priceFormatBuiltIn.minMove !== undefined && priceFormatBuiltIn.precision === undefined) {
        priceFormatBuiltIn.precision = precisionByMinMove(priceFormatBuiltIn.minMove);
    }
}

function migrateHandleScaleScrollOptions(options) {
    if (isBoolean(options.handleScale)) {
        const handleScale = options.handleScale;
        options.handleScale = {
            axisPressedMouseMove: {
                time: handleScale, price: handleScale,
            }, mouseWheel: handleScale, pinch: handleScale,
        };
    } else if (options.handleScale !== undefined) {
        const {axisPressedMouseMove, _} = options.handleScale;
        if (isBoolean(axisPressedMouseMove)) {
            options.handleScale.axisPressedMouseMove = {
                time: axisPressedMouseMove, price: axisPressedMouseMove,
            };
        }
    }
    const handleScroll = options.handleScroll;
    if (isBoolean(handleScroll)) {
        options.handleScroll = {
            horzTouchDrag: handleScroll,
            vertTouchDrag: handleScroll,
            mouseWheel: handleScroll,
            pressedMouseMove: handleScroll,
        };
    }
}

function toInternalOptions(options) {
    migrateHandleScaleScrollOptions(options);
    return options;
}

class ChartApi {
    constructor(container, horzScaleBehavior, options) {
        this._seriesMap = new Map();
        this._seriesMapReversed = new Map();
        this._clickedDelegate = new Delegate();
        this._crosshairMovedDelegate = new Delegate();
        this._dataLayer = new DataLayer(horzScaleBehavior);
        const internalOptions = (options === undefined) ? clone(chartOptionsDefaults()) : merge(clone(chartOptionsDefaults()), toInternalOptions(options));
        this._horzScaleBehavior = horzScaleBehavior;
        this._chartWidget = new ChartWidget(container, internalOptions, horzScaleBehavior);
        this._chartWidget.clicked().subscribe((paramSupplier) => {
            if (this._clickedDelegate.hasListeners()) {
                this._clickedDelegate.fire(this._convertMouseParams(paramSupplier()));
            }
        }, this);
        this._chartWidget.crosshairMoved().subscribe((paramSupplier) => {
            if (this._crosshairMovedDelegate.hasListeners()) {
                this._crosshairMovedDelegate.fire(this._convertMouseParams(paramSupplier()));
            }
        }, this);
        const model = this._chartWidget.model();
        this._timeScaleApi = new TimeScaleApi(model, this._chartWidget.timeAxisWidget(), this._horzScaleBehavior);
    }

    resize(width, height, forceRepaint) {
        this._chartWidget.resize(width, height, forceRepaint);
    }

    addCandlestickSeries(options = {}) {
        fillUpDownCandlesticksColors(options);
        return this._addSeriesImpl('Candlestick', {
            upColor: '#26a69a',
            downColor: '#ef5350',
            wickVisible: true,
            borderVisible: true,
            borderColor: '#378658',
            borderUpColor: '#26a69a',
            borderDownColor: '#ef5350',
            wickColor: '#737375',
            wickUpColor: '#26a69a',
            wickDownColor: '#ef5350',
        });
    }

    addLineSeries(options) {
        return this._addSeriesImpl('Line', {
            color: '#2196f3',
            lineStyle: 0 /* LineStyle.Solid */,
            lineWidth: 3,
            lineType: 0 /* LineType.Simple */,
            lineVisible: true,
            crosshairMarkerVisible: true,
            crosshairMarkerRadius: 4,
            crosshairMarkerBorderColor: '',
            crosshairMarkerBorderWidth: 2,
            crosshairMarkerBackgroundColor: '',
        }, options);
    }

    applyNewData(series, data) {
        this._sendUpdateToChart(this._dataLayer.setSeriesData(series, data));
    }

    priceScale(priceScaleId) {
        return new PriceScaleApi(this._chartWidget, priceScaleId);
    }

    timeScale() {
        return this._timeScaleApi;
    }

    applyOptions(options) {
        this._chartWidget.applyOptions(toInternalOptions(options));
    }

    options() {
        return this._chartWidget.options();
    }

    _addSeriesImpl(type, styleDefaults, options = {}) {
        patchPriceFormat(options.priceFormat);
        const strictOptions = merge({
            title: '',
            visible: true,
            lastValueVisible: true,
            priceLineVisible: true,
            priceLineSource: 0 /* PriceLineSource.LastBar */,
            priceLineWidth: 1,
            priceLineColor: '',
            priceLineStyle: 2 /* LineStyle.Dashed */,
            priceFormat: {
                type: 'price', precision: 2, minMove: 0.01,
            },
        }, styleDefaults, options);
        const series = this._chartWidget.model().createSeries(type, strictOptions);
        const res = new SeriesApi(series, this, this, this, this._horzScaleBehavior);
        this._seriesMap.set(res, series);
        this._seriesMapReversed.set(series, res);
        return res;
    }

    _sendUpdateToChart(update) {
        const model = this._chartWidget.model();
        model.updateTimeScale(update.timeScale.baseIndex, update.timeScale.points, update.timeScale.firstChangedPointIndex);
        update.series.forEach((value, series) => series.setData(value.data, value.info));
        model.recalculateAllPanes();
    }

    _mapSeriesToApi(series) {
        return ensureDefined(this._seriesMapReversed.get(series));
    }

    _convertMouseParams(param) {
        const seriesData = new Map();
        param.seriesData.forEach((plotRow, series) => {
            const seriesType = series.seriesType();
            const data = getSeriesDataCreator(seriesType)(plotRow);
            if (seriesType !== 'Custom') {
                assert(isFulfilledData(data));
            }
            seriesData.set(this._mapSeriesToApi(series), data);
        });
        const hoveredSeries = param.hoveredSeries === undefined ? undefined : this._mapSeriesToApi(param.hoveredSeries);
        return {
            time: param.originalTime,
            logical: param.index,
            point: param.point,
            hoveredSeries,
            hoveredObjectId: param.hoveredObject,
            seriesData,
            sourceEvent: param.touchMouseEventData,
        };
    }
}

function createChart(container, userOptions) {
    let horzScaleBehavior = new HorzScaleBehaviorTime()
    let options = HorzScaleBehaviorTime.applyDefaults(userOptions)
    const res = new ChartApi(container, horzScaleBehavior, options);
    horzScaleBehavior.setOptions(res.options());
    return res;
}

export let Charts = Object.freeze({
    __proto__: null, createChart: createChart, isBusinessDay: isBusinessDay, isUTCTimestamp: isUTCTimestamp,
});
