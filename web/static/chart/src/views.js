import {ensureNotNull, undefinedIfNull} from "./utils";
import {
    drawHorizontalLine,
    drawRoundRectWithInnerBorder,
    drawVerticalLine, fillRectInnerBorder,
    generateContrastColors,
    setLineStyle, strokeInPixel, walkLine
} from "./paint";
import {
    makeFont, TextWidthCache
} from "./formatter"

export class CrosshairPaneView {
    constructor(source) {
        this._invalidated = true;
        this._rendererData = {
            vertLine: {
                lineWidth: 1,
                lineStyle: 0,
                color: '',
                visible: false,
            },
            horzLine: {
                lineWidth: 1,
                lineStyle: 0,
                color: '',
                visible: false,
            },
            x: 0,
            y: 0,
        };
        this._renderer = new CrosshairRenderer(this._rendererData);
        this._source = source;
    }

    update() {
        this._invalidated = true;
    }

    renderer() {
        if (this._invalidated) {
            this._updateImpl();
            this._invalidated = false;
        }
        return this._renderer;
    }

    _updateImpl() {
        const visible = this._source.visible();
        const pane = ensureNotNull(this._source.pane());
        const crosshairOptions = pane.model().options().crosshair;
        const data = this._rendererData;
        data.horzLine.visible = visible && this._source.horzLineVisible(pane);
        data.vertLine.visible = visible && this._source.vertLineVisible();
        data.horzLine.lineWidth = crosshairOptions.horzLine.width;
        data.horzLine.lineStyle = crosshairOptions.horzLine.style;
        data.horzLine.color = crosshairOptions.horzLine.color;
        data.vertLine.lineWidth = crosshairOptions.vertLine.width;
        data.vertLine.lineStyle = crosshairOptions.vertLine.style;
        data.vertLine.color = crosshairOptions.vertLine.color;
        data.x = this._source.appliedX();
        data.y = this._source.appliedY();
    }
}

class PriceAxisView {
    constructor(ctor) {
        this._commonRendererData = {
            coordinate: 0,
            background: '#000',
            additionalPaddingBottom: 0,
            additionalPaddingTop: 0,
        };
        this._axisRendererData = {
            text: '',
            visible: false,
            tickVisible: true,
            moveTextToInvisibleTick: false,
            borderColor: '',
            color: '#FFF',
            borderVisible: false,
            separatorVisible: false,
        };
        this._paneRendererData = {
            text: '',
            visible: false,
            tickVisible: false,
            moveTextToInvisibleTick: true,
            borderColor: '',
            color: '#FFF',
            borderVisible: true,
            separatorVisible: true,
        };
        this._invalidated = true;
        this._axisRenderer = new (ctor || PriceAxisViewRenderer)(this._axisRendererData, this._commonRendererData);
        this._paneRenderer = new (ctor || PriceAxisViewRenderer)(this._paneRendererData, this._commonRendererData);
    }

    text() {
        return this._axisRendererData.text;
    }

    coordinate() {
        return this._commonRendererData.coordinate;
    }

    update() {
    }

    height(rendererOptions, useSecondLine = false) {
        return Math.max(this._axisRenderer.height(rendererOptions, useSecondLine), this._paneRenderer.height(rendererOptions, useSecondLine));
    }

    getFixedCoordinate() {
        return this._commonRendererData.fixedCoordinate || 0;
    }

    setFixedCoordinate(value) {
        this._commonRendererData.fixedCoordinate = value;
    }

    isVisible() {
        this._updateRendererDataIfNeeded();
        return this._axisRendererData.visible || this._paneRendererData.visible;
    }

    isAxisLabelVisible() {
        this._updateRendererDataIfNeeded();
        return this._axisRendererData.visible;
    }

    renderer(priceScale) {
        this._updateRendererDataIfNeeded();
        this._axisRendererData.tickVisible = this._axisRendererData.tickVisible && priceScale.options().ticksVisible;
        this._paneRendererData.tickVisible = this._paneRendererData.tickVisible && priceScale.options().ticksVisible;
        this._axisRenderer.setData(this._axisRendererData, this._commonRendererData);
        this._paneRenderer.setData(this._paneRendererData, this._commonRendererData);
        return this._axisRenderer;
    }

    paneRenderer() {
        this._updateRendererDataIfNeeded();
        this._axisRenderer.setData(this._axisRendererData, this._commonRendererData);
        this._paneRenderer.setData(this._paneRendererData, this._commonRendererData);
        return this._paneRenderer;
    }

    _updateRendererDataIfNeeded() {
        if (this._invalidated) {
            this._axisRendererData.tickVisible = true;
            this._paneRendererData.tickVisible = false;
            this._updateRendererData(this._axisRendererData, this._paneRendererData, this._commonRendererData);
        }
    }
}

export class CrosshairPriceAxisView extends PriceAxisView {
    constructor(source, priceScale, valueProvider) {
        super();
        this._source = source;
        this._priceScale = priceScale;
        this._valueProvider = valueProvider;
    }

    _updateRendererData(axisRendererData, paneRendererData, commonRendererData) {
        axisRendererData.visible = false;
        const options = this._source.options().horzLine;
        if (!options.labelVisible) {
            return;
        }
        const firstValue = this._priceScale.firstValue();
        if (!this._source.visible() || this._priceScale.isEmpty() || (firstValue === null)) {
            return;
        }
        const colors = generateContrastColors(options.labelBackgroundColor);
        commonRendererData.background = colors.background;
        axisRendererData.color = colors.foreground;
        const additionalPadding = 2 / 12 * this._priceScale.fontSize();
        commonRendererData.additionalPaddingTop = additionalPadding;
        commonRendererData.additionalPaddingBottom = additionalPadding;
        const value = this._valueProvider(this._priceScale);
        commonRendererData.coordinate = value.coordinate;
        axisRendererData.text = this._priceScale.formatPrice(value.price, firstValue);
        axisRendererData.visible = true;
    }
}

const optimizationReplacementRe = /[1-9]/g;
const radius$1 = 2;

class PriceAxisViewRenderer {
    constructor(data, commonData) {
        this.setData(data, commonData);
    }

    setData(data, commonData) {
        this._data = data;
        this._commonData = commonData;
    }

    height(rendererOptions, useSecondLine) {
        if (!this._data.visible) {
            return 0;
        }
        return rendererOptions.fontSize + rendererOptions.paddingTop + rendererOptions.paddingBottom;
    }

    draw(target, rendererOptions, textWidthCache, align) {
        if (!this._data.visible || this._data.text.length === 0) {
            return;
        }
        const textColor = this._data.color;
        const backgroundColor = this._commonData.background;
        const geometry = target.useBitmapCoordinateSpace((scope) => {
            const ctx = scope.context;
            ctx.font = rendererOptions.font;
            const geom = this._calculateGeometry(scope, rendererOptions, textWidthCache, align);
            const gb = geom.bitmap;
            const drawLabelBody = (labelBackgroundColor, labelBorderColor) => {
                if (geom.alignRight) {
                    drawRoundRectWithInnerBorder(ctx, gb.xOutside, gb.yTop, gb.totalWidth, gb.totalHeight, labelBackgroundColor, gb.horzBorder, [gb.radius, 0, 0, gb.radius], labelBorderColor);
                } else {
                    drawRoundRectWithInnerBorder(ctx, gb.xInside, gb.yTop, gb.totalWidth, gb.totalHeight, labelBackgroundColor, gb.horzBorder, [0, gb.radius, gb.radius, 0], labelBorderColor);
                }
            };
            drawLabelBody(backgroundColor, 'transparent');

            if (this._data.tickVisible) {
                ctx.fillStyle = textColor;
                ctx.fillRect(gb.xInside, gb.yMid, gb.xTick - gb.xInside, gb.tickHeight);
            }

            drawLabelBody('transparent', backgroundColor);

            if (this._data.borderVisible) {
                ctx.fillStyle = rendererOptions.paneBackgroundColor;
                ctx.fillRect(geom.alignRight ? gb.right - gb.horzBorder : 0, gb.yTop, gb.horzBorder, gb.yBottom - gb.yTop);
            }
            return geom;
        });
        target.useMediaCoordinateSpace(({context: ctx}) => {
            const gm = geometry.media;
            ctx.font = rendererOptions.font;
            ctx.textAlign = geometry.alignRight ? 'right' : 'left';
            ctx.textBaseline = 'middle';
            ctx.fillStyle = textColor;
            ctx.fillText(this._data.text, gm.xText, (gm.yTop + gm.yBottom) / 2 + gm.textMidCorrection);
        });
    }

    _calculateGeometry(scope, rendererOptions, textWidthCache, align) {
        var _a;
        const {context: ctx, bitmapSize, mediaSize, horizontalPixelRatio, verticalPixelRatio} = scope;
        const tickSize = (this._data.tickVisible || !this._data.moveTextToInvisibleTick) ? rendererOptions.tickLength : 0;
        const horzBorder = this._data.separatorVisible ? rendererOptions.borderSize : 0;
        const paddingTop = rendererOptions.paddingTop + this._commonData.additionalPaddingTop;
        const paddingBottom = rendererOptions.paddingBottom + this._commonData.additionalPaddingBottom;
        const paddingInner = rendererOptions.paddingInner;
        const paddingOuter = rendererOptions.paddingOuter;
        const text = this._data.text;
        const actualTextHeight = rendererOptions.fontSize;
        const textMidCorrection = textWidthCache.yMidCorrection(ctx, text);
        const textWidth = Math.ceil(textWidthCache.measureText(ctx, text));
        const totalHeight = actualTextHeight + paddingTop + paddingBottom;
        const totalWidth = rendererOptions.borderSize + paddingInner + paddingOuter + textWidth + tickSize;
        const tickHeightBitmap = Math.max(1, Math.floor(verticalPixelRatio));
        let totalHeightBitmap = Math.round(totalHeight * verticalPixelRatio);
        if (totalHeightBitmap % 2 !== tickHeightBitmap % 2) {
            totalHeightBitmap += 1;
        }
        const horzBorderBitmap = horzBorder > 0 ? Math.max(1, Math.floor(horzBorder * horizontalPixelRatio)) : 0;
        const totalWidthBitmap = Math.round(totalWidth * horizontalPixelRatio);

        const tickSizeBitmap = Math.round(tickSize * horizontalPixelRatio);
        const yMid = (_a = this._commonData.fixedCoordinate) !== null && _a !== void 0 ? _a : this._commonData.coordinate;
        const yMidBitmap = Math.round(yMid * verticalPixelRatio) - Math.floor(verticalPixelRatio * 0.5);
        const yTopBitmap = Math.floor(yMidBitmap + tickHeightBitmap / 2 - totalHeightBitmap / 2);
        const yBottomBitmap = yTopBitmap + totalHeightBitmap;
        const alignRight = align === 'right';
        const xInside = alignRight ? mediaSize.width - horzBorder : horzBorder;
        const xInsideBitmap = alignRight ? bitmapSize.width - horzBorderBitmap : horzBorderBitmap;
        let xOutsideBitmap;
        let xTickBitmap;
        let xText;
        if (alignRight) {
            xOutsideBitmap = xInsideBitmap - totalWidthBitmap;
            xTickBitmap = xInsideBitmap - tickSizeBitmap;
            xText = xInside - tickSize - paddingInner - horzBorder;
        } else {
            xOutsideBitmap = xInsideBitmap + totalWidthBitmap;
            xTickBitmap = xInsideBitmap + tickSizeBitmap;
            xText = xInside + tickSize + paddingInner;
        }
        return {
            alignRight: alignRight,
            bitmap: {
                yTop: yTopBitmap,
                yMid: yMidBitmap,
                yBottom: yBottomBitmap,
                totalWidth: totalWidthBitmap,
                totalHeight: totalHeightBitmap,
                radius: 2 * horizontalPixelRatio,
                horzBorder: horzBorderBitmap,
                xOutside: xOutsideBitmap,
                xInside: xInsideBitmap,
                xTick: xTickBitmap,
                tickHeight: tickHeightBitmap,
                right: bitmapSize.width,
            },
            media: {
                yTop: yTopBitmap / verticalPixelRatio,
                yBottom: yBottomBitmap / verticalPixelRatio,
                xText: xText,
                textMidCorrection: textMidCorrection,
            },
        };
    }
}

class TimeAxisViewRenderer {
    constructor() {
        this._data = null;
    }

    setData(data) {
        this._data = data;
    }

    draw(target, rendererOptions) {
        if (this._data === null || this._data.visible === false || this._data.text.length === 0) {
            return;
        }
        const textWidth = target.useMediaCoordinateSpace(({context: ctx}) => {
            ctx.font = rendererOptions.font;
            return Math.round(rendererOptions.widthCache.measureText(ctx, ensureNotNull(this._data).text, optimizationReplacementRe));
        });
        if (textWidth <= 0) {
            return;
        }
        const horzMargin = rendererOptions.paddingHorizontal;
        const labelWidth = textWidth + 2 * horzMargin;
        const labelWidthHalf = labelWidth / 2;
        const timeScaleWidth = this._data.width;
        let coordinate = this._data.coordinate;
        let x1 = Math.floor(coordinate - labelWidthHalf) + 0.5;
        if (x1 < 0) {
            coordinate = coordinate + Math.abs(0 - x1);
            x1 = Math.floor(coordinate - labelWidthHalf) + 0.5;
        } else if (x1 + labelWidth > timeScaleWidth) {
            coordinate = coordinate - Math.abs(timeScaleWidth - (x1 + labelWidth));
            x1 = Math.floor(coordinate - labelWidthHalf) + 0.5;
        }
        const x2 = x1 + labelWidth;
        const y1 = 0;
        const y2 = Math.ceil(y1 +
            rendererOptions.borderSize +
            rendererOptions.tickLength +
            rendererOptions.paddingTop +
            rendererOptions.fontSize +
            rendererOptions.paddingBottom);
        target.useBitmapCoordinateSpace(({context: ctx, horizontalPixelRatio, verticalPixelRatio}) => {
            const data = ensureNotNull(this._data);
            ctx.fillStyle = data.background;
            const x1scaled = Math.round(x1 * horizontalPixelRatio);
            const y1scaled = Math.round(y1 * verticalPixelRatio);
            const x2scaled = Math.round(x2 * horizontalPixelRatio);
            const y2scaled = Math.round(y2 * verticalPixelRatio);
            const radiusScaled = Math.round(radius$1 * horizontalPixelRatio);
            ctx.beginPath();
            ctx.moveTo(x1scaled, y1scaled);
            ctx.lineTo(x1scaled, y2scaled - radiusScaled);
            ctx.arcTo(x1scaled, y2scaled, x1scaled + radiusScaled, y2scaled, radiusScaled);
            ctx.lineTo(x2scaled - radiusScaled, y2scaled);
            ctx.arcTo(x2scaled, y2scaled, x2scaled, y2scaled - radiusScaled, radiusScaled);
            ctx.lineTo(x2scaled, y1scaled);
            ctx.fill();
            if (data.tickVisible) {
                const tickX = Math.round(data.coordinate * horizontalPixelRatio);
                const tickTop = y1scaled;
                const tickBottom = Math.round((tickTop + rendererOptions.tickLength) * verticalPixelRatio);
                ctx.fillStyle = data.color;
                const tickWidth = Math.max(1, Math.floor(horizontalPixelRatio));
                const tickOffset = Math.floor(horizontalPixelRatio * 0.5);
                ctx.fillRect(tickX - tickOffset, tickTop, tickWidth, tickBottom - tickTop);
            }
        });
        target.useMediaCoordinateSpace(({context: ctx}) => {
            const data = ensureNotNull(this._data);
            const yText = y1 +
                rendererOptions.borderSize +
                rendererOptions.tickLength +
                rendererOptions.paddingTop +
                rendererOptions.fontSize / 2;
            ctx.font = rendererOptions.font;
            ctx.textAlign = 'left';
            ctx.textBaseline = 'middle';
            ctx.fillStyle = data.color;
            const textYCorrection = rendererOptions.widthCache.yMidCorrection(ctx, 'Apr0');
            ctx.translate(x1 + horzMargin, yText + textYCorrection);
            ctx.fillText(data.text, 0, 0);
        });
    }
}

export class CrosshairTimeAxisView {
    constructor(crosshair, model, valueProvider) {
        this._invalidated = true;
        this._renderer = new TimeAxisViewRenderer();
        this._rendererData = {
            visible: false,
            background: '#4c525e',
            color: 'white',
            text: '',
            width: 0,
            coordinate: NaN,
            tickVisible: true,
        };
        this._crosshair = crosshair;
        this._model = model;
        this._valueProvider = valueProvider;
    }

    update() {
        this._invalidated = true;
    }

    renderer() {
        if (this._invalidated) {
            this._updateImpl();
            this._invalidated = false;
        }
        this._renderer.setData(this._rendererData);
        return this._renderer;
    }

    _updateImpl() {
        const data = this._rendererData;
        data.visible = false;
        const options = this._crosshair.options().vertLine;
        if (!options.labelVisible) {
            return;
        }
        const timeScale = this._model.timeScale();
        if (timeScale.isEmpty()) {
            return;
        }
        data.width = timeScale.width();
        const value = this._valueProvider();
        if (value === null) {
            return;
        }
        data.coordinate = value.coordinate;
        const currentTime = timeScale.indexToTimeScalePoint(this._crosshair.appliedIndex());
        data.text = timeScale.formatDateTime(ensureNotNull(currentTime));
        data.visible = true;
        const colors = generateContrastColors(options.labelBackgroundColor);
        data.background = colors.background;
        data.color = colors.foreground;
        data.tickVisible = timeScale.options().ticksVisible;
    }
}

class SeriesPaneViewBase {
    constructor(series, model, extendedVisibleRange) {
        this._invalidated = true;
        this._dataInvalidated = true;
        this._optionsInvalidated = true;
        this._items = [];
        this._itemsVisibleRange = null;
        this._series = series;
        this._model = model;
        this._extendedVisibleRange = extendedVisibleRange;
    }

    update(updateType) {
        this._invalidated = true;
        if (updateType === 'data') {
            this._dataInvalidated = true;
        }
        if (updateType === 'options') {
            this._optionsInvalidated = true;
        }
    }

    renderer() {
        if (!this._series.visible()) {
            return null;
        }
        this._makeValid();
        return this._itemsVisibleRange === null ? null : this._renderer;
    }

    _updateOptions() {
    }

    _clearVisibleRange() {
        this._itemsVisibleRange = null;
    }

    _makeValid() {
        if (this._dataInvalidated) {
            this._fillRawPoints();
            this._dataInvalidated = false;
        }
        if (this._invalidated) {
            this._makeValidImpl();
            this._invalidated = false;
        }
    }

    _makeValidImpl() {
        const priceScale = this._series.priceScale();
        const timeScale = this._model.timeScale();
        this._clearVisibleRange();
        if (timeScale.isEmpty() || priceScale.isEmpty()) {
            return;
        }
        const visibleBars = timeScale.visibleStrictRange();
        if (visibleBars === null) {
            return;
        }
        if (this._series.bars().size() === 0) {
            return;
        }
        const firstValue = this._series.firstValue();
        if (firstValue === null) {
            return;
        }
        this._itemsVisibleRange = visibleTimedValues(this._items, visibleBars, this._extendedVisibleRange);
        this._convertToCoordinates(priceScale, timeScale, firstValue.value);
        this._prepareRendererData();
    }
}

class LinePaneViewBase extends SeriesPaneViewBase {
    constructor(series, model) {
        super(series, model, true);
    }

    _convertToCoordinates(priceScale, timeScale, firstValue) {
        timeScale.indexesToCoordinates(this._items, undefinedIfNull(this._itemsVisibleRange));
        priceScale.pointsArrayToCoordinates(this._items, firstValue, undefinedIfNull(this._itemsVisibleRange));
    }

    _createRawItemBase(time, price) {
        return {
            time: time,
            price: price,
            x: NaN,
            y: NaN,
        };
    }

    _fillRawPoints() {
        const colorer = this._series.barColorer();
        this._items = this._series.bars().rows().map((row) => {
            const value = row.value[3 /* PlotRowValueIndex.Close */];
            return this._createRawItem(row.index, value, colorer);
        });
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

function lowerBoundItemsCompare(item, time) {
    return item.time < time;
}

function upperBoundItemsCompare(item, time) {
    return time < item.time;
}

function visibleTimedValues(items, range, extendedRange) {
    const firstBar = range.left();
    const lastBar = range.right();
    const from = lowerBound(items, firstBar, lowerBoundItemsCompare);
    const to = upperBound(items, lastBar, upperBoundItemsCompare);
    if (!extendedRange) {
        return {from, to};
    }
    let extendedFrom = from;
    let extendedTo = to;
    if (from > 0 && from < items.length && items[from].time >= firstBar) {
        extendedFrom = from - 1;
    }
    if (to > 0 && to < items.length && items[to - 1].time <= lastBar) {
        extendedTo = to + 1;
    }
    return {from: extendedFrom, to: extendedTo};
}

class BarsPaneViewBase extends SeriesPaneViewBase {
    constructor(series, model) {
        super(series, model, false);
    }

    _convertToCoordinates(priceScale, timeScale, firstValue) {
        timeScale.indexesToCoordinates(this._items, undefinedIfNull(this._itemsVisibleRange));
        priceScale.barPricesToCoordinates(this._items, firstValue, undefinedIfNull(this._itemsVisibleRange));
    }

    _createDefaultItem(time, bar, colorer) {
        return {
            time: time,
            open: bar.value[0 /* PlotRowValueIndex.Open */],
            high: bar.value[1 /* PlotRowValueIndex.High */],
            low: bar.value[2 /* PlotRowValueIndex.Low */],
            close: bar.value[3 /* PlotRowValueIndex.Close */],
            x: NaN,
            openY: NaN,
            highY: NaN,
            lowY: NaN,
            closeY: NaN,
        };
    }

    _fillRawPoints() {
        const colorer = this._series.barColorer();
        this._items = this._series.bars().rows().map((row) => this._createRawItem(row.index, row, colorer));
    }
}

export class SeriesCandlesticksPaneView extends BarsPaneViewBase {
    constructor() {
        super(...arguments);
        this._renderer = new PaneRendererCandlesticks();
    }

    _createRawItem(time, bar, colorer) {
        return Object.assign(Object.assign({}, this._createDefaultItem(time, bar, colorer)), colorer.barStyle(time));
    }

    _prepareRendererData() {
        const candlestickStyleProps = this._series.options();
        this._renderer.setData({
            bars: this._items,
            barSpacing: this._model.timeScale().barSpacing(),
            wickVisible: candlestickStyleProps.wickVisible,
            borderVisible: candlestickStyleProps.borderVisible,
            visibleRange: this._itemsVisibleRange,
        });
    }
}

export class SeriesLinePaneView extends LinePaneViewBase {
    constructor() {
        super(...arguments);
        this._renderer = new PaneRendererLine();
    }

    _createRawItem(time, price, colorer) {
        return Object.assign(Object.assign({}, this._createRawItemBase(time, price)), colorer.barStyle(time));
    }

    _prepareRendererData() {
        const options = this._series.options();
        const data = {
            items: this._items,
            lineStyle: options.lineStyle,
            lineType: options.lineVisible ? options.lineType : undefined,
            lineWidth: options.lineWidth,
            visibleRange: this._itemsVisibleRange,
            barWidth: this._model.timeScale().barSpacing(),
        };
        this._renderer.setData(data);
    }
}

export class PanePriceAxisView {
    constructor(priceAxisView, dataSource, chartModel) {
        this._priceAxisView = priceAxisView;
        this._textWidthCache = new TextWidthCache(50);
        this._dataSource = dataSource;
        this._chartModel = chartModel;
        this._fontSize = -1;
        this._renderer = new PanePriceAxisViewRenderer(this._textWidthCache);
    }

    renderer() {
        const pane = this._chartModel.paneForSource(this._dataSource);
        if (pane === null) {
            return null;
        }
        const priceScale = pane.isOverlay(this._dataSource) ? pane.defaultVisiblePriceScale() : this._dataSource.priceScale();
        if (priceScale === null) {
            return null;
        }
        const position = pane.priceScalePosition(priceScale);
        if (position === 'overlay') {
            return null;
        }
        const options = this._chartModel.priceAxisRendererOptions();
        if (options.fontSize !== this._fontSize) {
            this._fontSize = options.fontSize;
            this._textWidthCache.reset();
        }
        this._renderer.setParams(this._priceAxisView.paneRenderer(), options, position);
        return this._renderer;
    }
}

class SeriesHorizontalLinePaneView {
    constructor(series) {
        this._lineRendererData = {
            y: 0,
            color: 'rgba(0, 0, 0, 0)',
            lineWidth: 1,
            lineStyle: 0 /* LineStyle.Solid */,
            visible: false,
        };
        this._lineRenderer = new HorizontalLineRenderer();
        this._invalidated = true;
        this._series = series;
        this._lineRenderer.setData(this._lineRendererData);
    }

    update() {
        this._invalidated = true;
    }

    renderer() {
        if (!this._series.visible()) {
            return null;
        }
        if (this._invalidated) {
            this._updateImpl();
            this._invalidated = false;
        }
        return this._lineRenderer;
    }
}

export class SeriesPriceLinePaneView extends SeriesHorizontalLinePaneView {

    constructor(series) {
        super(series);
    }

    _updateImpl() {
        const data = this._lineRendererData;
        data.visible = false;
        const seriesOptions = this._series.options();
        if (!seriesOptions.priceLineVisible || !this._series.visible()) {
            return;
        }
        const lastValueData = this._series.lastValueData(seriesOptions.priceLineSource === 0 /* PriceLineSource.LastBar */);
        if (lastValueData.noData) {
            return;
        }
        data.visible = true;
        data.y = lastValueData.coordinate;
        data.color = this._series.priceLineColor(lastValueData.color);
        data.lineWidth = seriesOptions.priceLineWidth;
        data.lineStyle = seriesOptions.priceLineStyle;
    }
}

export class SeriesPriceAxisView extends PriceAxisView {
    constructor(source) {
        super();
        this._source = source;
    }

    _updateRendererData(axisRendererData, paneRendererData, commonRendererData) {
        axisRendererData.visible = false;
        paneRendererData.visible = false;
        const source = this._source;
        if (!source.visible()) {
            return;
        }
        const seriesOptions = source.options();
        const showSeriesLastValue = seriesOptions.lastValueVisible;
        const showSymbolLabel = source.title() !== '';
        const showPriceAndPercentage = true /* PriceAxisLastValueMode.LastPriceAndPercentageValue */;
        const lastValueData = source.lastValueData(false);
        if (lastValueData.noData) {
            return;
        }
        if (showSeriesLastValue) {
            axisRendererData.text = this._axisText(lastValueData, showSeriesLastValue, showPriceAndPercentage);
            axisRendererData.visible = axisRendererData.text.length !== 0;
        }
        if (showSymbolLabel || showPriceAndPercentage) {
            paneRendererData.text = this._paneText(lastValueData, showSeriesLastValue, showSymbolLabel, showPriceAndPercentage);
            paneRendererData.visible = paneRendererData.text.length > 0;
        }
        const lastValueColor = source.priceLineColor(lastValueData.color);
        const colors = generateContrastColors(lastValueColor);
        commonRendererData.background = colors.background;
        commonRendererData.coordinate = lastValueData.coordinate;
        paneRendererData.borderColor = source.model().backgroundColorAtYPercentFromTop(lastValueData.coordinate / source.priceScale().height());
        axisRendererData.borderColor = lastValueColor;
        axisRendererData.color = colors.foreground;
        paneRendererData.color = colors.foreground;
    }

    _paneText(lastValue, showSeriesLastValue, showSymbolLabel, showPriceAndPercentage) {
        let result = '';
        const title = this._source.title();
        if (showSymbolLabel && title.length !== 0) {
            result += `${title} `;
        }
        if (showSeriesLastValue && showPriceAndPercentage) {
            result += this._source.priceScale().isPercentage() ?
                lastValue.formattedPriceAbsolute : lastValue.formattedPricePercentage;
        }
        return result.trim();
    }

    _axisText(lastValueData, showSeriesLastValue, showPriceAndPercentage) {
        if (!showSeriesLastValue) {
            return '';
        }
        if (!showPriceAndPercentage) {
            return lastValueData.text;
        }
        return this._source.priceScale().isPercentage() ?
            lastValueData.formattedPricePercentage : lastValueData.formattedPriceAbsolute;
    }
}

export class GridPaneView {
    constructor(pane) {
        this._renderer = new GridRenderer();
        this._invalidated = true;
        this._pane = pane;
    }

    update() {
        this._invalidated = true;
    }

    renderer() {
        if (this._invalidated) {
            const gridOptions = this._pane.model().options().grid;
            const data = {
                horzLinesVisible: gridOptions.horzLines.visible,
                vertLinesVisible: gridOptions.vertLines.visible,
                horzLinesColor: gridOptions.horzLines.color,
                vertLinesColor: gridOptions.vertLines.color,
                horzLineStyle: gridOptions.horzLines.style,
                vertLineStyle: gridOptions.vertLines.style,
                priceMarks: this._pane.defaultPriceScale().marks(),


                timeMarks: (this._pane.model().timeScale().marks() || []).map((tm) => {
                    return {coord: tm.coord};
                }),
            };
            this._renderer.setData(data);
            this._invalidated = false;
        }
        return this._renderer;
    }
}

class BitmapCoordinatesPaneRenderer {
    draw(target, isHovered, hitTestData) {
        target.useBitmapCoordinateSpace((scope) => this._drawImpl(scope, isHovered, hitTestData));
    }
}


class CrosshairRenderer extends BitmapCoordinatesPaneRenderer {
    constructor(data) {
        super();
        this._data = data;
    }

    _drawImpl({context: ctx, bitmapSize, horizontalPixelRatio, verticalPixelRatio}) {
        if (this._data === null) {
            return;
        }
        const vertLinesVisible = this._data.vertLine.visible;
        const horzLinesVisible = this._data.horzLine.visible;
        if (!vertLinesVisible && !horzLinesVisible) {
            return;
        }
        const x = Math.round(this._data.x * horizontalPixelRatio);
        const y = Math.round(this._data.y * verticalPixelRatio);
        ctx.lineCap = 'butt';
        if (vertLinesVisible && x >= 0) {
            ctx.lineWidth = Math.floor(this._data.vertLine.lineWidth * horizontalPixelRatio);
            ctx.strokeStyle = this._data.vertLine.color;
            ctx.fillStyle = this._data.vertLine.color;
            setLineStyle(ctx, this._data.vertLine.lineStyle);
            drawVerticalLine(ctx, x, 0, bitmapSize.height);
        }
        if (horzLinesVisible && y >= 0) {
            ctx.lineWidth = Math.floor(this._data.horzLine.lineWidth * verticalPixelRatio);
            ctx.strokeStyle = this._data.horzLine.color;
            ctx.fillStyle = this._data.horzLine.color;
            setLineStyle(ctx, this._data.horzLine.lineStyle);
            drawHorizontalLine(ctx, y, 0, bitmapSize.width);
        }
    }
}

class PaneRendererLineBase extends BitmapCoordinatesPaneRenderer {
    constructor() {
        super(...arguments);
        this._data = null;
    }

    setData(data) {
        this._data = data;
    }

    _drawImpl(renderingScope) {
        if (this._data === null) {
            return;
        }
        const {
            items: items,
            visibleRange: visibleRange,
            barWidth: barWidth,
            lineType: lineType,
            lineWidth: lineWidth,
            lineStyle: lineStyle,
        } = this._data;
        if (visibleRange === null) {
            return;
        }
        const ctx = renderingScope.context;
        ctx.lineCap = 'butt';
        ctx.lineWidth = lineWidth * renderingScope.verticalPixelRatio;
        setLineStyle(ctx, lineStyle);
        ctx.lineJoin = 'round';
        const styleGetter = this._strokeStyle.bind(this);
        if (lineType !== undefined) {
            walkLine(renderingScope, items, lineType, visibleRange, barWidth, styleGetter);
        }
    }
}

class PaneRendererLine extends PaneRendererLineBase {
    _strokeStyle(renderingScope, item) {
        return item.lineColor;
    }
}

function optimalCandlestickWidth(barSpacing, pixelRatio) {
    const barSpacingSpecialCaseFrom = 2.5;
    const barSpacingSpecialCaseTo = 4;
    const barSpacingSpecialCaseCoeff = 3;
    if (barSpacing >= barSpacingSpecialCaseFrom && barSpacing <= barSpacingSpecialCaseTo) {
        return Math.floor(barSpacingSpecialCaseCoeff * pixelRatio);
    }
    const barSpacingReducingCoeff = 0.2;
    const coeff = 1 - barSpacingReducingCoeff * Math.atan(Math.max(barSpacingSpecialCaseTo, barSpacing) - barSpacingSpecialCaseTo) / (Math.PI * 0.5);
    const res = Math.floor(barSpacing * coeff * pixelRatio);
    const scaledBarSpacing = Math.floor(barSpacing * pixelRatio);
    const optimal = Math.min(res, scaledBarSpacing);
    return Math.max(Math.floor(pixelRatio), optimal);
}

class PaneRendererCandlesticks extends BitmapCoordinatesPaneRenderer {
    constructor() {
        super(...arguments);
        this._data = null;
        this._barWidth = 0;
    }

    setData(data) {
        this._data = data;
    }

    _drawImpl(renderingScope) {
        if (this._data === null || this._data.bars.length === 0 || this._data.visibleRange === null) {
            return;
        }
        const {horizontalPixelRatio} = renderingScope;
        this._barWidth = optimalCandlestickWidth(this._data.barSpacing, horizontalPixelRatio);

        if (this._barWidth >= 2) {
            const wickWidth = Math.floor(horizontalPixelRatio);
            if ((wickWidth % 2) !== (this._barWidth % 2)) {
                this._barWidth--;
            }
        }
        const bars = this._data.bars;
        if (this._data.wickVisible) {
            this._drawWicks(renderingScope, bars, this._data.visibleRange);
        }
        if (this._data.borderVisible) {
            this._drawBorder(renderingScope, bars, this._data.visibleRange);
        }
        const borderWidth = this._calculateBorderWidth(horizontalPixelRatio);
        if (!this._data.borderVisible || this._barWidth > borderWidth * 2) {
            this._drawCandles(renderingScope, bars, this._data.visibleRange);
        }
    }

    _drawWicks(renderingScope, bars, visibleRange) {
        if (this._data === null) {
            return;
        }
        const {context: ctx, horizontalPixelRatio, verticalPixelRatio} = renderingScope;
        let prevWickColor = '';
        let wickWidth = Math.min(Math.floor(horizontalPixelRatio), Math.floor(this._data.barSpacing * horizontalPixelRatio));
        wickWidth = Math.max(Math.floor(horizontalPixelRatio), Math.min(wickWidth, this._barWidth));
        const wickOffset = Math.floor(wickWidth * 0.5);
        let prevEdge = null;
        for (let i = visibleRange.from; i < visibleRange.to; i++) {
            const bar = bars[i];
            if (bar.barWickColor !== prevWickColor) {
                ctx.fillStyle = bar.barWickColor;
                prevWickColor = bar.barWickColor;
            }
            const top = Math.round(Math.min(bar.openY, bar.closeY) * verticalPixelRatio);
            const bottom = Math.round(Math.max(bar.openY, bar.closeY) * verticalPixelRatio);
            const high = Math.round(bar.highY * verticalPixelRatio);
            const low = Math.round(bar.lowY * verticalPixelRatio);
            const scaledX = Math.round(horizontalPixelRatio * bar.x);
            let left = scaledX - wickOffset;
            const right = left + wickWidth - 1;
            if (prevEdge !== null) {
                left = Math.max(prevEdge + 1, left);
                left = Math.min(left, right);
            }
            const width = right - left + 1;
            ctx.fillRect(left, high, width, top - high);
            ctx.fillRect(left, bottom + 1, width, low - bottom);
            prevEdge = right;
        }
    }

    _calculateBorderWidth(pixelRatio) {
        let borderWidth = Math.floor(1 /* Constants.BarBorderWidth */ * pixelRatio);
        if (this._barWidth <= 2 * borderWidth) {
            borderWidth = Math.floor((this._barWidth - 1) * 0.5);
        }
        const res = Math.max(Math.floor(pixelRatio), borderWidth);
        if (this._barWidth <= res * 2) {

            return Math.max(Math.floor(pixelRatio), Math.floor(1 /* Constants.BarBorderWidth */ * pixelRatio));
        }
        return res;
    }

    _drawBorder(renderingScope, bars, visibleRange) {
        if (this._data === null) {
            return;
        }
        const {context: ctx, horizontalPixelRatio, verticalPixelRatio} = renderingScope;
        let prevBorderColor = '';
        const borderWidth = this._calculateBorderWidth(horizontalPixelRatio);
        let prevEdge = null;
        for (let i = visibleRange.from; i < visibleRange.to; i++) {
            const bar = bars[i];
            if (bar.barBorderColor !== prevBorderColor) {
                ctx.fillStyle = bar.barBorderColor;
                prevBorderColor = bar.barBorderColor;
            }
            let left = Math.round(bar.x * horizontalPixelRatio) - Math.floor(this._barWidth * 0.5);

            const right = left + this._barWidth - 1;
            const top = Math.round(Math.min(bar.openY, bar.closeY) * verticalPixelRatio);
            const bottom = Math.round(Math.max(bar.openY, bar.closeY) * verticalPixelRatio);
            if (prevEdge !== null) {
                left = Math.max(prevEdge + 1, left);
                left = Math.min(left, right);
            }
            if (this._data.barSpacing * horizontalPixelRatio > 2 * borderWidth) {
                fillRectInnerBorder(ctx, left, top, right - left + 1, bottom - top + 1, borderWidth);
            } else {
                const width = right - left + 1;
                ctx.fillRect(left, top, width, bottom - top + 1);
            }
            prevEdge = right;
        }
    }

    _drawCandles(renderingScope, bars, visibleRange) {
        if (this._data === null) {
            return;
        }
        const {context: ctx, horizontalPixelRatio, verticalPixelRatio} = renderingScope;
        let prevBarColor = '';
        for (let i = visibleRange.from; i < visibleRange.to; i++) {
            const bar = bars[i];
            let top = Math.round(Math.min(bar.openY, bar.closeY) * verticalPixelRatio);
            let bottom = Math.round(Math.max(bar.openY, bar.closeY) * verticalPixelRatio);
            let left = Math.round(bar.x * horizontalPixelRatio) - Math.floor(this._barWidth * 0.5);
            let right = left + this._barWidth - 1;
            if (bar.barColor !== prevBarColor) {
                const barColor = bar.barColor;
                ctx.fillStyle = barColor;
                prevBarColor = barColor;
            }
            if (top > bottom) {
                continue;
            }
            ctx.fillRect(left, top, right - left + 1, bottom - top + 1);
        }
    }
}

class PanePriceAxisViewRenderer {
    constructor(textWidthCache) {
        this._priceAxisViewRenderer = null;
        this._rendererOptions = null;
        this._align = 'right';
        this._textWidthCache = textWidthCache;
    }

    setParams(priceAxisViewRenderer, rendererOptions, align) {
        this._priceAxisViewRenderer = priceAxisViewRenderer;
        this._rendererOptions = rendererOptions;
        this._align = align;
    }

    draw(target) {
        if (this._rendererOptions === null || this._priceAxisViewRenderer === null) {
            return;
        }
        this._priceAxisViewRenderer.draw(target, this._rendererOptions, this._textWidthCache, this._align);
    }
}

class HorizontalLineRenderer extends BitmapCoordinatesPaneRenderer {
    constructor() {
        super(...arguments);
        this._data = null;
    }

    setData(data) {
        this._data = data;
    }

    hitTest(x, y) {
        var _a;
        if (!((_a = this._data) === null || _a === void 0 ? void 0 : _a.visible)) {
            return null;
        }
        const {
            y: itemY,
            lineWidth: lineWidth,
            externalId: externalId
        } = this._data;

        if (y >= itemY - lineWidth - 7 /* Constants.HitTestThreshold */ && y <= itemY + lineWidth + 7 /* Constants.HitTestThreshold */) {
            return {
                hitTestData: this._data,
                externalId: externalId,
            };
        }
        return null;
    }

    _drawImpl({context: ctx, bitmapSize, horizontalPixelRatio, verticalPixelRatio}) {
        if (this._data === null) {
            return;
        }
        if (this._data.visible === false) {
            return;
        }
        const y = Math.round(this._data.y * verticalPixelRatio);
        if (y < 0 || y > bitmapSize.height) {
            return;
        }
        ctx.lineCap = 'butt';
        ctx.strokeStyle = this._data.color;
        ctx.lineWidth = Math.floor(this._data.lineWidth * horizontalPixelRatio);
        setLineStyle(ctx, this._data.lineStyle);
        drawHorizontalLine(ctx, y, 0, bitmapSize.width);
    }
}

class GridRenderer extends BitmapCoordinatesPaneRenderer {
    constructor() {
        super(...arguments);
        this._data = null;
    }

    setData(data) {
        this._data = data;
    }

    _drawImpl({context: ctx, bitmapSize, horizontalPixelRatio, verticalPixelRatio}) {
        if (this._data === null) {
            return;
        }
        const lineWidth = Math.max(1, Math.floor(horizontalPixelRatio));
        ctx.lineWidth = lineWidth;
        strokeInPixel(ctx, () => {
            const data = ensureNotNull(this._data);
            if (data.vertLinesVisible) {
                ctx.strokeStyle = data.vertLinesColor;
                setLineStyle(ctx, data.vertLineStyle);
                ctx.beginPath();
                for (const timeMark of data.timeMarks) {
                    const x = Math.round(timeMark.coord * horizontalPixelRatio);
                    ctx.moveTo(x, -lineWidth);
                    ctx.lineTo(x, bitmapSize.height + lineWidth);
                }
                ctx.stroke();
            }
            if (data.horzLinesVisible) {
                ctx.strokeStyle = data.horzLinesColor;
                setLineStyle(ctx, data.horzLineStyle);
                ctx.beginPath();
                for (const priceMark of data.priceMarks) {
                    const y = Math.round(priceMark.coord * verticalPixelRatio);
                    ctx.moveTo(-lineWidth, y);
                    ctx.lineTo(bitmapSize.width + lineWidth, y);
                }
                ctx.stroke();
            }
        });
    }
}

export class PriceAxisRendererOptionsProvider {
    constructor(chartModel) {
        this._rendererOptions = {
            borderSize: 1 /* RendererConstants.BorderSize */,
            tickLength: 5 /* RendererConstants.TickLength */,
            fontSize: NaN,
            font: '',
            fontFamily: '',
            color: '',
            paneBackgroundColor: '',
            paddingBottom: 0,
            paddingInner: 0,
            paddingOuter: 0,
            paddingTop: 0,
            baselineOffset: 0,
        };
        this._chartModel = chartModel;
    }

    options() {
        const rendererOptions = this._rendererOptions;
        const currentFontSize = this._fontSize();
        const currentFontFamily = this._fontFamily();
        if (rendererOptions.fontSize !== currentFontSize || rendererOptions.fontFamily !== currentFontFamily) {
            rendererOptions.fontSize = currentFontSize;
            rendererOptions.fontFamily = currentFontFamily;
            rendererOptions.font = makeFont(currentFontSize, currentFontFamily);
            rendererOptions.paddingTop = 2.5 / 12 * currentFontSize;
            rendererOptions.paddingBottom = rendererOptions.paddingTop;
            rendererOptions.paddingInner = currentFontSize / 12 * rendererOptions.tickLength;
            rendererOptions.paddingOuter = currentFontSize / 12 * rendererOptions.tickLength;
            rendererOptions.baselineOffset = 0;
        }
        rendererOptions.color = this._textColor();
        rendererOptions.paneBackgroundColor = this._paneBackgroundColor();
        return this._rendererOptions;
    }

    _textColor() {
        return this._chartModel.options().layout.textColor;
    }

    _paneBackgroundColor() {
        return this._chartModel.backgroundTopColor();
    }

    _fontSize() {
        return this._chartModel.options().layout.fontSize;
    }

    _fontFamily() {
        return this._chartModel.options().layout.fontFamily;
    }
}
