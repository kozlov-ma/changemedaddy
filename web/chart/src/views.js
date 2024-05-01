import {assert, ensureDefined, ensureNotNull, notNull, undefinedIfNull} from "./utils";
import {
    applyAlpha,
    drawHorizontalLine,
    drawRoundRectWithInnerBorder,
    drawVerticalLine, fillRectInnerBorder,
    generateContrastColors,
    setLineStyle
} from "./paint";

class CompositeRenderer {
    constructor() {
        this._private__renderers = [];
    }

    _internal_setRenderers(renderers) {
        this._private__renderers = renderers;
    }

    _internal_draw(target, isHovered, hitTestData) {
        this._private__renderers.forEach((r) => {
            r._internal_draw(target, isHovered, hitTestData);
        });
    }
}

class BitmapCoordinatesPaneRenderer {
    _internal_draw(target, isHovered, hitTestData) {
        target.useBitmapCoordinateSpace((scope) => this._internal__drawImpl(scope, isHovered, hitTestData));
    }
}

class PaneRendererMarks extends BitmapCoordinatesPaneRenderer {
    constructor() {
        super(...arguments);
        this._internal__data = null;
    }

    _internal_setData(data) {
        this._internal__data = data;
    }

    _internal__drawImpl({context: ctx, horizontalPixelRatio, verticalPixelRatio}) {
        if (this._internal__data === null || this._internal__data._internal_visibleRange === null) {
            return;
        }
        const visibleRange = this._internal__data._internal_visibleRange;
        const data = this._internal__data;
        const tickWidth = Math.max(1, Math.floor(horizontalPixelRatio));
        const correction = (tickWidth % 2) / 2;
        const draw = (radiusMedia) => {
            ctx.beginPath();
            for (let i = visibleRange.to - 1; i >= visibleRange.from; --i) {
                const point = data._internal_items[i];
                const centerX = Math.round(point._internal_x * horizontalPixelRatio) + correction; // correct x coordinate only
                const centerY = point._internal_y * verticalPixelRatio;
                const radius = radiusMedia * verticalPixelRatio + correction;
                ctx.moveTo(centerX, centerY);
                ctx.arc(centerX, centerY, radius, 0, Math.PI * 2);
            }
            ctx.fill();
        };
        if (data._internal_lineWidth > 0) {
            ctx.fillStyle = data._internal_backColor;
            draw(data._internal_radius + data._internal_lineWidth);
        }
        ctx.fillStyle = data._internal_lineColor;
        draw(data._internal_radius);
    }
}

function createEmptyMarkerData() {
    return {
        _internal_items: [{
            _internal_x: 0,
            _internal_y: 0,
            _internal_time: 0,
            _internal_price: 0,
        }],
        _internal_lineColor: '',
        _internal_backColor: '',
        _internal_radius: 0,
        _internal_lineWidth: 0,
        _internal_visibleRange: null,
    };
}

export class CrosshairMarksPaneView {
    constructor(chartModel, crosshair) {
        this._private__compositeRenderer = new CompositeRenderer();
        this._private__markersRenderers = [];
        this._private__markersData = [];
        this._private__invalidated = true;
        this._private__chartModel = chartModel;
        this._private__crosshair = crosshair;
        this._private__compositeRenderer._internal_setRenderers(this._private__markersRenderers);
    }

    _internal_update(updateType) {
        const serieses = this._private__chartModel._internal_serieses();
        if (serieses.length !== this._private__markersRenderers.length) {
            this._private__markersData = serieses.map(createEmptyMarkerData);
            this._private__markersRenderers = this._private__markersData.map((data) => {
                const res = new PaneRendererMarks();
                res._internal_setData(data);
                return res;
            });
            this._private__compositeRenderer._internal_setRenderers(this._private__markersRenderers);
        }
        this._private__invalidated = true;
    }

    _internal_renderer() {
        if (this._private__invalidated) {
            this._private__updateImpl();
            this._private__invalidated = false;
        }
        return this._private__compositeRenderer;
    }

    _private__updateImpl() {
        const serieses = this._private__chartModel._internal_serieses();
        const timePointIndex = this._private__crosshair._internal_appliedIndex();
        const timeScale = this._private__chartModel._internal_timeScale();
        serieses.forEach((s, index) => {
            var _a;
            const data = this._private__markersData[index];
            const seriesData = s._internal_markerDataAtIndex(timePointIndex);
            if (seriesData === null || !s._internal_visible()) {
                data._internal_visibleRange = null;
                return;
            }
            const firstValue = ensureNotNull(s._internal_firstValue());
            data._internal_lineColor = seriesData._internal_backgroundColor;
            data._internal_radius = seriesData._internal_radius;
            data._internal_lineWidth = seriesData._internal_borderWidth;
            data._internal_items[0]._internal_price = seriesData._internal_price;
            data._internal_items[0]._internal_y = s._internal_priceScale()._internal_priceToCoordinate(seriesData._internal_price, firstValue._internal_value);
            data._internal_backColor = (_a = seriesData._internal_borderColor) !== null && _a !== void 0 ? _a : this._private__chartModel._internal_backgroundColorAtYPercentFromTop(data._internal_items[0]._internal_y / s._internal_priceScale()._internal_height());
            data._internal_items[0]._internal_time = timePointIndex;
            data._internal_items[0]._internal_x = timeScale._internal_indexToCoordinate(timePointIndex);
            data._internal_visibleRange = {from: 0, to: 1};
        });
    }
}

class CrosshairRenderer extends BitmapCoordinatesPaneRenderer {
    constructor(data) {
        super();
        this._private__data = data;
    }

    _internal__drawImpl({context: ctx, bitmapSize, horizontalPixelRatio, verticalPixelRatio}) {
        if (this._private__data === null) {
            return;
        }
        const vertLinesVisible = this._private__data._internal_vertLine._internal_visible;
        const horzLinesVisible = this._private__data._internal_horzLine._internal_visible;
        if (!vertLinesVisible && !horzLinesVisible) {
            return;
        }
        const x = Math.round(this._private__data._internal_x * horizontalPixelRatio);
        const y = Math.round(this._private__data._internal_y * verticalPixelRatio);
        ctx.lineCap = 'butt';
        if (vertLinesVisible && x >= 0) {
            ctx.lineWidth = Math.floor(this._private__data._internal_vertLine._internal_lineWidth * horizontalPixelRatio);
            ctx.strokeStyle = this._private__data._internal_vertLine._internal_color;
            ctx.fillStyle = this._private__data._internal_vertLine._internal_color;
            setLineStyle(ctx, this._private__data._internal_vertLine._internal_lineStyle);
            drawVerticalLine(ctx, x, 0, bitmapSize.height);
        }
        if (horzLinesVisible && y >= 0) {
            ctx.lineWidth = Math.floor(this._private__data._internal_horzLine._internal_lineWidth * verticalPixelRatio);
            ctx.strokeStyle = this._private__data._internal_horzLine._internal_color;
            ctx.fillStyle = this._private__data._internal_horzLine._internal_color;
            setLineStyle(ctx, this._private__data._internal_horzLine._internal_lineStyle);
            drawHorizontalLine(ctx, y, 0, bitmapSize.width);
        }
    }
}

export class CrosshairPaneView {
    constructor(source) {
        this._private__invalidated = true;
        this._private__rendererData = {
            _internal_vertLine: {
                _internal_lineWidth: 1,
                _internal_lineStyle: 0,
                _internal_color: '',
                _internal_visible: false,
            },
            _internal_horzLine: {
                _internal_lineWidth: 1,
                _internal_lineStyle: 0,
                _internal_color: '',
                _internal_visible: false,
            },
            _internal_x: 0,
            _internal_y: 0,
        };
        this._private__renderer = new CrosshairRenderer(this._private__rendererData);
        this._private__source = source;
    }

    _internal_update() {
        this._private__invalidated = true;
    }

    _internal_renderer() {
        if (this._private__invalidated) {
            this._private__updateImpl();
            this._private__invalidated = false;
        }
        return this._private__renderer;
    }

    _private__updateImpl() {
        const visible = this._private__source._internal_visible();
        const pane = ensureNotNull(this._private__source._internal_pane());
        const crosshairOptions = pane._internal_model()._internal_options().crosshair;
        const data = this._private__rendererData;
        data._internal_horzLine._internal_visible = visible && this._private__source._internal_horzLineVisible(pane);
        data._internal_vertLine._internal_visible = visible && this._private__source._internal_vertLineVisible();
        data._internal_horzLine._internal_lineWidth = crosshairOptions.horzLine.width;
        data._internal_horzLine._internal_lineStyle = crosshairOptions.horzLine.style;
        data._internal_horzLine._internal_color = crosshairOptions.horzLine.color;
        data._internal_vertLine._internal_lineWidth = crosshairOptions.vertLine.width;
        data._internal_vertLine._internal_lineStyle = crosshairOptions.vertLine.style;
        data._internal_vertLine._internal_color = crosshairOptions.vertLine.color;
        data._internal_x = this._private__source._internal_appliedX();
        data._internal_y = this._private__source._internal_appliedY();
    }
}

class PriceAxisViewRenderer {
    constructor(data, commonData) {
        this._internal_setData(data, commonData);
    }

    _internal_setData(data, commonData) {
        this._private__data = data;
        this._private__commonData = commonData;
    }

    _internal_height(rendererOptions, useSecondLine) {
        if (!this._private__data._internal_visible) {
            return 0;
        }
        return rendererOptions._internal_fontSize + rendererOptions._internal_paddingTop + rendererOptions._internal_paddingBottom;
    }

    _internal_draw(target, rendererOptions, textWidthCache, align) {
        if (!this._private__data._internal_visible || this._private__data._internal_text.length === 0) {
            return;
        }
        const textColor = this._private__data._internal_color;
        const backgroundColor = this._private__commonData._internal_background;
        const geometry = target.useBitmapCoordinateSpace((scope) => {
            const ctx = scope.context;
            ctx.font = rendererOptions._internal_font;
            const geom = this._private__calculateGeometry(scope, rendererOptions, textWidthCache, align);
            const gb = geom._internal_bitmap;
            const drawLabelBody = (labelBackgroundColor, labelBorderColor) => {
                if (geom._internal_alignRight) {
                    drawRoundRectWithInnerBorder(ctx, gb._internal_xOutside, gb._internal_yTop, gb._internal_totalWidth, gb._internal_totalHeight, labelBackgroundColor, gb._internal_horzBorder, [gb._internal_radius, 0, 0, gb._internal_radius], labelBorderColor);
                } else {
                    drawRoundRectWithInnerBorder(ctx, gb._internal_xInside, gb._internal_yTop, gb._internal_totalWidth, gb._internal_totalHeight, labelBackgroundColor, gb._internal_horzBorder, [0, gb._internal_radius, gb._internal_radius, 0], labelBorderColor);
                }
            };
            // draw border
            // draw label background
            drawLabelBody(backgroundColor, 'transparent');
            // draw tick
            if (this._private__data._internal_tickVisible) {
                ctx.fillStyle = textColor;
                ctx.fillRect(gb._internal_xInside, gb._internal_yMid, gb._internal_xTick - gb._internal_xInside, gb._internal_tickHeight);
            }
            // draw label border above the tick
            drawLabelBody('transparent', backgroundColor);
            // draw separator
            if (this._private__data._internal_borderVisible) {
                ctx.fillStyle = rendererOptions._internal_paneBackgroundColor;
                ctx.fillRect(geom._internal_alignRight ? gb._internal_right - gb._internal_horzBorder : 0, gb._internal_yTop, gb._internal_horzBorder, gb._internal_yBottom - gb._internal_yTop);
            }
            return geom;
        });
        target.useMediaCoordinateSpace(({context: ctx}) => {
            const gm = geometry._internal_media;
            ctx.font = rendererOptions._internal_font;
            ctx.textAlign = geometry._internal_alignRight ? 'right' : 'left';
            ctx.textBaseline = 'middle';
            ctx.fillStyle = textColor;
            ctx.fillText(this._private__data._internal_text, gm._internal_xText, (gm._internal_yTop + gm._internal_yBottom) / 2 + gm._internal_textMidCorrection);
        });
    }

    _private__calculateGeometry(scope, rendererOptions, textWidthCache, align) {
        var _a;
        const {context: ctx, bitmapSize, mediaSize, horizontalPixelRatio, verticalPixelRatio} = scope;
        const tickSize = (this._private__data._internal_tickVisible || !this._private__data._internal_moveTextToInvisibleTick) ? rendererOptions._internal_tickLength : 0;
        const horzBorder = this._private__data._internal_separatorVisible ? rendererOptions._internal_borderSize : 0;
        const paddingTop = rendererOptions._internal_paddingTop + this._private__commonData._internal_additionalPaddingTop;
        const paddingBottom = rendererOptions._internal_paddingBottom + this._private__commonData._internal_additionalPaddingBottom;
        const paddingInner = rendererOptions._internal_paddingInner;
        const paddingOuter = rendererOptions._internal_paddingOuter;
        const text = this._private__data._internal_text;
        const actualTextHeight = rendererOptions._internal_fontSize;
        const textMidCorrection = textWidthCache._internal_yMidCorrection(ctx, text);
        const textWidth = Math.ceil(textWidthCache._internal_measureText(ctx, text));
        const totalHeight = actualTextHeight + paddingTop + paddingBottom;
        const totalWidth = rendererOptions._internal_borderSize + paddingInner + paddingOuter + textWidth + tickSize;
        const tickHeightBitmap = Math.max(1, Math.floor(verticalPixelRatio));
        let totalHeightBitmap = Math.round(totalHeight * verticalPixelRatio);
        if (totalHeightBitmap % 2 !== tickHeightBitmap % 2) {
            totalHeightBitmap += 1;
        }
        const horzBorderBitmap = horzBorder > 0 ? Math.max(1, Math.floor(horzBorder * horizontalPixelRatio)) : 0;
        const totalWidthBitmap = Math.round(totalWidth * horizontalPixelRatio);
        // tick overlaps scale border
        const tickSizeBitmap = Math.round(tickSize * horizontalPixelRatio);
        const yMid = (_a = this._private__commonData._internal_fixedCoordinate) !== null && _a !== void 0 ? _a : this._private__commonData._internal_coordinate;
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
            // 2               1
            //
            //              6  5
            //
            // 3               4
            xOutsideBitmap = xInsideBitmap - totalWidthBitmap;
            xTickBitmap = xInsideBitmap - tickSizeBitmap;
            xText = xInside - tickSize - paddingInner - horzBorder;
        } else {
            // 1               2
            //
            // 6  5
            //
            // 4               3
            xOutsideBitmap = xInsideBitmap + totalWidthBitmap;
            xTickBitmap = xInsideBitmap + tickSizeBitmap;
            xText = xInside + tickSize + paddingInner;
        }
        return {
            _internal_alignRight: alignRight,
            _internal_bitmap: {
                _internal_yTop: yTopBitmap,
                _internal_yMid: yMidBitmap,
                _internal_yBottom: yBottomBitmap,
                _internal_totalWidth: totalWidthBitmap,
                _internal_totalHeight: totalHeightBitmap,
                // TODO: it is better to have different horizontal and vertical radii
                _internal_radius: 2 * horizontalPixelRatio,
                _internal_horzBorder: horzBorderBitmap,
                _internal_xOutside: xOutsideBitmap,
                _internal_xInside: xInsideBitmap,
                _internal_xTick: xTickBitmap,
                _internal_tickHeight: tickHeightBitmap,
                _internal_right: bitmapSize.width,
            },
            _internal_media: {
                _internal_yTop: yTopBitmap / verticalPixelRatio,
                _internal_yBottom: yBottomBitmap / verticalPixelRatio,
                _internal_xText: xText,
                _internal_textMidCorrection: textMidCorrection,
            },
        };
    }
}

class PriceAxisView {
    constructor(ctor) {
        this._private__commonRendererData = {
            _internal_coordinate: 0,
            _internal_background: '#000',
            _internal_additionalPaddingBottom: 0,
            _internal_additionalPaddingTop: 0,
        };
        this._private__axisRendererData = {
            _internal_text: '',
            _internal_visible: false,
            _internal_tickVisible: true,
            _internal_moveTextToInvisibleTick: false,
            _internal_borderColor: '',
            _internal_color: '#FFF',
            _internal_borderVisible: false,
            _internal_separatorVisible: false,
        };
        this._private__paneRendererData = {
            _internal_text: '',
            _internal_visible: false,
            _internal_tickVisible: false,
            _internal_moveTextToInvisibleTick: true,
            _internal_borderColor: '',
            _internal_color: '#FFF',
            _internal_borderVisible: true,
            _internal_separatorVisible: true,
        };
        this._private__invalidated = true;
        this._private__axisRenderer = new (ctor || PriceAxisViewRenderer)(this._private__axisRendererData, this._private__commonRendererData);
        this._private__paneRenderer = new (ctor || PriceAxisViewRenderer)(this._private__paneRendererData, this._private__commonRendererData);
    }

    _internal_text() {
        this._private__updateRendererDataIfNeeded();
        return this._private__axisRendererData._internal_text;
    }

    _internal_coordinate() {
        this._private__updateRendererDataIfNeeded();
        return this._private__commonRendererData._internal_coordinate;
    }

    _internal_update() {
        this._private__invalidated = true;
    }

    _internal_height(rendererOptions, useSecondLine = false) {
        return Math.max(this._private__axisRenderer._internal_height(rendererOptions, useSecondLine), this._private__paneRenderer._internal_height(rendererOptions, useSecondLine));
    }

    _internal_getFixedCoordinate() {
        return this._private__commonRendererData._internal_fixedCoordinate || 0;
    }

    _internal_setFixedCoordinate(value) {
        this._private__commonRendererData._internal_fixedCoordinate = value;
    }

    _internal_isVisible() {
        this._private__updateRendererDataIfNeeded();
        return this._private__axisRendererData._internal_visible || this._private__paneRendererData._internal_visible;
    }

    _internal_isAxisLabelVisible() {
        this._private__updateRendererDataIfNeeded();
        return this._private__axisRendererData._internal_visible;
    }

    _internal_renderer(priceScale) {
        this._private__updateRendererDataIfNeeded();
        // force update tickVisible state from price scale options
        // because we don't have and we can't have price axis in other methods
        // (like paneRenderer or any other who call _updateRendererDataIfNeeded)
        this._private__axisRendererData._internal_tickVisible = this._private__axisRendererData._internal_tickVisible && priceScale._internal_options().ticksVisible;
        this._private__paneRendererData._internal_tickVisible = this._private__paneRendererData._internal_tickVisible && priceScale._internal_options().ticksVisible;
        this._private__axisRenderer._internal_setData(this._private__axisRendererData, this._private__commonRendererData);
        this._private__paneRenderer._internal_setData(this._private__paneRendererData, this._private__commonRendererData);
        return this._private__axisRenderer;
    }

    _internal_paneRenderer() {
        this._private__updateRendererDataIfNeeded();
        this._private__axisRenderer._internal_setData(this._private__axisRendererData, this._private__commonRendererData);
        this._private__paneRenderer._internal_setData(this._private__paneRendererData, this._private__commonRendererData);
        return this._private__paneRenderer;
    }

    _private__updateRendererDataIfNeeded() {
        if (this._private__invalidated) {
            this._private__axisRendererData._internal_tickVisible = true;
            this._private__paneRendererData._internal_tickVisible = false;
            this._internal__updateRendererData(this._private__axisRendererData, this._private__paneRendererData, this._private__commonRendererData);
        }
    }
}

export class CrosshairPriceAxisView extends PriceAxisView {
    constructor(source, priceScale, valueProvider) {
        super();
        this._private__source = source;
        this._private__priceScale = priceScale;
        this._private__valueProvider = valueProvider;
    }

    _internal__updateRendererData(axisRendererData, paneRendererData, commonRendererData) {
        axisRendererData._internal_visible = false;
        const options = this._private__source._internal_options().horzLine;
        if (!options.labelVisible) {
            return;
        }
        const firstValue = this._private__priceScale._internal_firstValue();
        if (!this._private__source._internal_visible() || this._private__priceScale._internal_isEmpty() || (firstValue === null)) {
            return;
        }
        const colors = generateContrastColors(options.labelBackgroundColor);
        commonRendererData._internal_background = colors._internal_background;
        axisRendererData._internal_color = colors._internal_foreground;
        const additionalPadding = 2 / 12 * this._private__priceScale._internal_fontSize();
        commonRendererData._internal_additionalPaddingTop = additionalPadding;
        commonRendererData._internal_additionalPaddingBottom = additionalPadding;
        const value = this._private__valueProvider(this._private__priceScale);
        commonRendererData._internal_coordinate = value._internal_coordinate;
        axisRendererData._internal_text = this._private__priceScale._internal_formatPrice(value._internal_price, firstValue);
        axisRendererData._internal_visible = true;
    }
}

const optimizationReplacementRe = /[1-9]/g;
const radius$1 = 2;

class TimeAxisViewRenderer {
    constructor() {
        this._private__data = null;
    }

    _internal_setData(data) {
        this._private__data = data;
    }

    _internal_draw(target, rendererOptions) {
        if (this._private__data === null || this._private__data._internal_visible === false || this._private__data._internal_text.length === 0) {
            return;
        }
        const textWidth = target.useMediaCoordinateSpace(({context: ctx}) => {
            ctx.font = rendererOptions._internal_font;
            return Math.round(rendererOptions._internal_widthCache._internal_measureText(ctx, ensureNotNull(this._private__data)._internal_text, optimizationReplacementRe));
        });
        if (textWidth <= 0) {
            return;
        }
        const horzMargin = rendererOptions._internal_paddingHorizontal;
        const labelWidth = textWidth + 2 * horzMargin;
        const labelWidthHalf = labelWidth / 2;
        const timeScaleWidth = this._private__data._internal_width;
        let coordinate = this._private__data._internal_coordinate;
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
            rendererOptions._internal_borderSize +
            rendererOptions._internal_tickLength +
            rendererOptions._internal_paddingTop +
            rendererOptions._internal_fontSize +
            rendererOptions._internal_paddingBottom);
        target.useBitmapCoordinateSpace(({context: ctx, horizontalPixelRatio, verticalPixelRatio}) => {
            const data = ensureNotNull(this._private__data);
            ctx.fillStyle = data._internal_background;
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
            if (data._internal_tickVisible) {
                const tickX = Math.round(data._internal_coordinate * horizontalPixelRatio);
                const tickTop = y1scaled;
                const tickBottom = Math.round((tickTop + rendererOptions._internal_tickLength) * verticalPixelRatio);
                ctx.fillStyle = data._internal_color;
                const tickWidth = Math.max(1, Math.floor(horizontalPixelRatio));
                const tickOffset = Math.floor(horizontalPixelRatio * 0.5);
                ctx.fillRect(tickX - tickOffset, tickTop, tickWidth, tickBottom - tickTop);
            }
        });
        target.useMediaCoordinateSpace(({context: ctx}) => {
            const data = ensureNotNull(this._private__data);
            const yText = y1 +
                rendererOptions._internal_borderSize +
                rendererOptions._internal_tickLength +
                rendererOptions._internal_paddingTop +
                rendererOptions._internal_fontSize / 2;
            ctx.font = rendererOptions._internal_font;
            ctx.textAlign = 'left';
            ctx.textBaseline = 'middle';
            ctx.fillStyle = data._internal_color;
            const textYCorrection = rendererOptions._internal_widthCache._internal_yMidCorrection(ctx, 'Apr0');
            ctx.translate(x1 + horzMargin, yText + textYCorrection);
            ctx.fillText(data._internal_text, 0, 0);
        });
    }
}

export class CrosshairTimeAxisView {
    constructor(crosshair, model, valueProvider) {
        this._private__invalidated = true;
        this._private__renderer = new TimeAxisViewRenderer();
        this._private__rendererData = {
            _internal_visible: false,
            _internal_background: '#4c525e',
            _internal_color: 'white',
            _internal_text: '',
            _internal_width: 0,
            _internal_coordinate: NaN,
            _internal_tickVisible: true,
        };
        this._private__crosshair = crosshair;
        this._private__model = model;
        this._private__valueProvider = valueProvider;
    }

    _internal_update() {
        this._private__invalidated = true;
    }

    _internal_renderer() {
        if (this._private__invalidated) {
            this._private__updateImpl();
            this._private__invalidated = false;
        }
        this._private__renderer._internal_setData(this._private__rendererData);
        return this._private__renderer;
    }

    _private__updateImpl() {
        const data = this._private__rendererData;
        data._internal_visible = false;
        const options = this._private__crosshair._internal_options().vertLine;
        if (!options.labelVisible) {
            return;
        }
        const timeScale = this._private__model._internal_timeScale();
        if (timeScale._internal_isEmpty()) {
            return;
        }
        data._internal_width = timeScale._internal_width();
        const value = this._private__valueProvider();
        if (value === null) {
            return;
        }
        data._internal_coordinate = value._internal_coordinate;
        const currentTime = timeScale._internal_indexToTimeScalePoint(this._private__crosshair._internal_appliedIndex());
        data._internal_text = timeScale._internal_formatDateTime(ensureNotNull(currentTime));
        data._internal_visible = true;
        const colors = generateContrastColors(options.labelBackgroundColor);
        data._internal_background = colors._internal_background;
        data._internal_color = colors._internal_foreground;
        data._internal_tickVisible = timeScale._internal_options().ticksVisible;
    }
}

class DataSource {
    constructor() {
        this._internal__priceScale = null;
        this._private__zorder = 0;
    }

    _internal_zorder() {
        return this._private__zorder;
    }

    _internal_setZorder(zorder) {
        this._private__zorder = zorder;
    }

    _internal_priceScale() {
        return this._internal__priceScale;
    }

    _internal_setPriceScale(priceScale) {
        this._internal__priceScale = priceScale;
    }

    _internal_labelPaneViews(pane) {
        return [];
    }

    _internal_timeAxisViews() {
        return [];
    }

    _internal_visible() {
        return true;
    }
}

class Crosshair extends DataSource {
    constructor(model, options) {
        super();
        this._private__pane = null;
        this._private__price = NaN;
        this._private__index = 0;
        this._private__visible = true;
        this._private__priceAxisViews = new Map();
        this._private__subscribed = false;
        this._private__x = NaN;
        this._private__y = NaN;
        this._private__originX = NaN;
        this._private__originY = NaN;
        this._private__model = model;
        this._private__options = options;
        this._private__markersPaneView = new CrosshairMarksPaneView(model, this);
        const valuePriceProvider = (rawPriceProvider, rawCoordinateProvider) => {
            return (priceScale) => {
                const coordinate = rawCoordinateProvider();
                const rawPrice = rawPriceProvider();
                if (priceScale === ensureNotNull(this._private__pane)._internal_defaultPriceScale()) {
                    // price must be defined
                    return {_internal_price: rawPrice, _internal_coordinate: coordinate};
                } else {
                    // always convert from coordinate
                    const firstValue = ensureNotNull(priceScale._internal_firstValue());
                    const price = priceScale._internal_coordinateToPrice(coordinate, firstValue);
                    return {_internal_price: price, _internal_coordinate: coordinate};
                }
            };
        };
        const valueTimeProvider = (rawIndexProvider, rawCoordinateProvider) => {
            return () => {
                const time = this._private__model._internal_timeScale()._internal_indexToTime(rawIndexProvider());
                const coordinate = rawCoordinateProvider();
                if (!time || !Number.isFinite(coordinate)) {
                    return null;
                }
                return {
                    _internal_time: time,
                    _internal_coordinate: coordinate,
                };
            };
        };
        // for current position always return both price and coordinate
        this._private__currentPosPriceProvider = valuePriceProvider(() => this._private__price, () => this._private__y);
        const currentPosTimeProvider = valueTimeProvider(() => this._private__index, () => this._internal_appliedX());
        this._private__timeAxisView = new CrosshairTimeAxisView(this, model, currentPosTimeProvider);
        this._private__paneView = new CrosshairPaneView(this);
    }

    _internal_options() {
        return this._private__options;
    }

    _internal_saveOriginCoord(x, y) {
        this._private__originX = x;
        this._private__originY = y;
    }

    _internal_clearOriginCoord() {
        this._private__originX = NaN;
        this._private__originY = NaN;
    }

    _internal_originCoordX() {
        return this._private__originX;
    }

    _internal_originCoordY() {
        return this._private__originY;
    }

    _internal_setPosition(index, price, pane) {
        if (!this._private__subscribed) {
            this._private__subscribed = true;
        }
        this._private__visible = true;
        this._private__tryToUpdateViews(index, price, pane);
    }

    _internal_appliedIndex() {
        return this._private__index;
    }

    _internal_appliedX() {
        return this._private__x;
    }

    _internal_appliedY() {
        return this._private__y;
    }

    _internal_visible() {
        return this._private__visible;
    }

    _internal_clearPosition() {
        this._private__visible = false;
        this._private__setIndexToLastSeriesBarIndex();
        this._private__price = NaN;
        this._private__x = NaN;
        this._private__y = NaN;
        this._private__pane = null;
        this._internal_clearOriginCoord();
    }

    _internal_paneViews(pane) {
        return this._private__pane !== null ? [this._private__paneView, this._private__markersPaneView] : [];
    }

    _internal_horzLineVisible(pane) {
        return pane === this._private__pane && this._private__options.horzLine.visible;
    }

    _internal_vertLineVisible() {
        return this._private__options.vertLine.visible;
    }

    _internal_priceAxisViews(pane, priceScale) {
        if (!this._private__visible || this._private__pane !== pane) {
            this._private__priceAxisViews.clear();
        }
        const views = [];
        if (this._private__pane === pane) {
            views.push(this._private__createPriceAxisViewOnDemand(this._private__priceAxisViews, priceScale, this._private__currentPosPriceProvider));
        }
        return views;
    }

    _internal_timeAxisViews() {
        return this._private__visible ? [this._private__timeAxisView] : [];
    }

    _internal_pane() {
        return this._private__pane;
    }

    _internal_updateAllViews() {
        this._private__paneView._internal_update();
        this._private__priceAxisViews.forEach((value) => value._internal_update());
        this._private__timeAxisView._internal_update();
        this._private__markersPaneView._internal_update();
    }

    _private__priceScaleByPane(pane) {
        if (pane && !pane._internal_defaultPriceScale()._internal_isEmpty()) {
            return pane._internal_defaultPriceScale();
        }
        return null;
    }

    _private__tryToUpdateViews(index, price, pane) {
        if (this._private__tryToUpdateData(index, price, pane)) {
            this._internal_updateAllViews();
        }
    }

    _private__tryToUpdateData(newIndex, newPrice, newPane) {
        const oldX = this._private__x;
        const oldY = this._private__y;
        const oldPrice = this._private__price;
        const oldIndex = this._private__index;
        const oldPane = this._private__pane;
        const priceScale = this._private__priceScaleByPane(newPane);
        this._private__index = newIndex;
        this._private__x = isNaN(newIndex) ? NaN : this._private__model._internal_timeScale()._internal_indexToCoordinate(newIndex);
        this._private__pane = newPane;
        const firstValue = priceScale !== null ? priceScale._internal_firstValue() : null;
        if (priceScale !== null && firstValue !== null) {
            this._private__price = newPrice;
            this._private__y = priceScale._internal_priceToCoordinate(newPrice, firstValue);
        } else {
            this._private__price = NaN;
            this._private__y = NaN;
        }
        return (oldX !== this._private__x || oldY !== this._private__y || oldIndex !== this._private__index ||
            oldPrice !== this._private__price || oldPane !== this._private__pane);
    }

    _private__setIndexToLastSeriesBarIndex() {
        const lastIndexes = this._private__model._internal_serieses()
            .map((s) => s._internal_bars()._internal_lastIndex())
            .filter(notNull);
        const lastBarIndex = (lastIndexes.length === 0) ? null : Math.max(...lastIndexes);
        this._private__index = lastBarIndex !== null ? lastBarIndex : NaN;
    }

    _private__createPriceAxisViewOnDemand(map, priceScale, valueProvider) {
        let view = map.get(priceScale);
        if (view === undefined) {
            view = new CrosshairPriceAxisView(this, priceScale, valueProvider);
            map.set(priceScale, view);
        }
        return view;
    }
}

class PaneRendererLineBase extends BitmapCoordinatesPaneRenderer {
    constructor() {
        super(...arguments);
        this._internal__data = null;
    }

    _internal_setData(data) {
        this._internal__data = data;
    }

    _internal__drawImpl(renderingScope) {
        if (this._internal__data === null) {
            return;
        }
        const {
            _internal_items: items,
            _internal_visibleRange: visibleRange,
            _internal_barWidth: barWidth,
            _internal_lineType: lineType,
            _internal_lineWidth: lineWidth,
            _internal_lineStyle: lineStyle,
        } = this._internal__data;
        if (visibleRange === null) {
            return;
        }
        const ctx = renderingScope.context;
        ctx.lineCap = 'butt';
        ctx.lineWidth = lineWidth * renderingScope.verticalPixelRatio;
        setLineStyle(ctx, lineStyle);
        ctx.lineJoin = 'round';
        const styleGetter = this._internal__strokeStyle.bind(this);
        if (lineType !== undefined) {
            walkLine(renderingScope, items, lineType, visibleRange, barWidth, styleGetter);
        }
    }
}

class PaneRendererLine extends PaneRendererLineBase {
    _internal__strokeStyle(renderingScope, item) {
        return item._internal_lineColor;
    }
}

/**
 * Binary function that accepts two arguments (the first of the type of array elements, and the second is always val), and returns a value convertible to bool.
 * The value returned indicates whether the first argument is considered to go before the second.
 * The function shall not modify any of its arguments.
 */
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
    return item._internal_time < time;
}

function upperBoundItemsCompare(item, time) {
    return time < item._internal_time;
}

function visibleTimedValues(items, range, extendedRange) {
    const firstBar = range._internal_left();
    const lastBar = range._internal_right();
    const from = lowerBound(items, firstBar, lowerBoundItemsCompare);
    const to = upperBound(items, lastBar, upperBoundItemsCompare);
    if (!extendedRange) {
        return {from, to};
    }
    let extendedFrom = from;
    let extendedTo = to;
    if (from > 0 && from < items.length && items[from]._internal_time >= firstBar) {
        extendedFrom = from - 1;
    }
    if (to > 0 && to < items.length && items[to - 1]._internal_time <= lastBar) {
        extendedTo = to + 1;
    }
    return {from: extendedFrom, to: extendedTo};
}

class SeriesPaneViewBase {
    constructor(series, model, extendedVisibleRange) {
        this._internal__invalidated = true;
        this._internal__dataInvalidated = true;
        this._internal__optionsInvalidated = true;
        this._internal__items = [];
        this._internal__itemsVisibleRange = null;
        this._internal__series = series;
        this._internal__model = model;
        this._private__extendedVisibleRange = extendedVisibleRange;
    }

    _internal_update(updateType) {
        this._internal__invalidated = true;
        if (updateType === 'data') {
            this._internal__dataInvalidated = true;
        }
        if (updateType === 'options') {
            this._internal__optionsInvalidated = true;
        }
    }

    _internal_renderer() {
        if (!this._internal__series._internal_visible()) {
            return null;
        }
        this._private__makeValid();
        return this._internal__itemsVisibleRange === null ? null : this._internal__renderer;
    }

    _internal__updateOptions() {
        this._internal__items = this._internal__items.map((item) => (Object.assign(Object.assign({}, item), this._internal__series._internal_barColorer()._internal_barStyle(item._internal_time))));
    }

    _internal__clearVisibleRange() {
        this._internal__itemsVisibleRange = null;
    }

    _private__makeValid() {
        if (this._internal__dataInvalidated) {
            this._internal__fillRawPoints();
            this._internal__dataInvalidated = false;
        }
        if (this._internal__optionsInvalidated) {
            this._internal__updateOptions();
            this._internal__optionsInvalidated = false;
        }
        if (this._internal__invalidated) {
            this._private__makeValidImpl();
            this._internal__invalidated = false;
        }
    }

    _private__makeValidImpl() {
        const priceScale = this._internal__series._internal_priceScale();
        const timeScale = this._internal__model._internal_timeScale();
        this._internal__clearVisibleRange();
        if (timeScale._internal_isEmpty() || priceScale._internal_isEmpty()) {
            return;
        }
        const visibleBars = timeScale._internal_visibleStrictRange();
        if (visibleBars === null) {
            return;
        }
        if (this._internal__series._internal_bars()._internal_size() === 0) {
            return;
        }
        const firstValue = this._internal__series._internal_firstValue();
        if (firstValue === null) {
            return;
        }
        this._internal__itemsVisibleRange = visibleTimedValues(this._internal__items, visibleBars, this._private__extendedVisibleRange);
        this._internal__convertToCoordinates(priceScale, timeScale, firstValue._internal_value);
        this._internal__prepareRendererData();
    }
}

class LinePaneViewBase extends SeriesPaneViewBase {
    constructor(series, model) {
        super(series, model, true);
    }

    _internal__convertToCoordinates(priceScale, timeScale, firstValue) {
        timeScale._internal_indexesToCoordinates(this._internal__items, undefinedIfNull(this._internal__itemsVisibleRange));
        priceScale._internal_pointsArrayToCoordinates(this._internal__items, firstValue, undefinedIfNull(this._internal__itemsVisibleRange));
    }

    _internal__createRawItemBase(time, price) {
        return {
            _internal_time: time,
            _internal_price: price,
            _internal_x: NaN,
            _internal_y: NaN,
        };
    }

    _internal__fillRawPoints() {
        const colorer = this._internal__series._internal_barColorer();
        this._internal__items = this._internal__series._internal_bars()._internal_rows().map((row) => {
            const value = row._internal_value[3 /* PlotRowValueIndex.Close */];
            return this._internal__createRawItem(row._internal_index, value, colorer);
        });
    }
}

function optimalCandlestickWidth(barSpacing, pixelRatio) {
    const barSpacingSpecialCaseFrom = 2.5;
    const barSpacingSpecialCaseTo = 4;
    const barSpacingSpecialCaseCoeff = 3;
    if (barSpacing >= barSpacingSpecialCaseFrom && barSpacing <= barSpacingSpecialCaseTo) {
        return Math.floor(barSpacingSpecialCaseCoeff * pixelRatio);
    }
    // coeff should be 1 on small barspacing and go to 0.8 while groing bar spacing
    const barSpacingReducingCoeff = 0.2;
    const coeff = 1 - barSpacingReducingCoeff * Math.atan(Math.max(barSpacingSpecialCaseTo, barSpacing) - barSpacingSpecialCaseTo) / (Math.PI * 0.5);
    const res = Math.floor(barSpacing * coeff * pixelRatio);
    const scaledBarSpacing = Math.floor(barSpacing * pixelRatio);
    const optimal = Math.min(res, scaledBarSpacing);
    return Math.max(Math.floor(pixelRatio), optimal);
}

class BarsPaneViewBase extends SeriesPaneViewBase {
    constructor(series, model) {
        super(series, model, false);
    }

    _internal__convertToCoordinates(priceScale, timeScale, firstValue) {
        timeScale._internal_indexesToCoordinates(this._internal__items, undefinedIfNull(this._internal__itemsVisibleRange));
        priceScale._internal_barPricesToCoordinates(this._internal__items, firstValue, undefinedIfNull(this._internal__itemsVisibleRange));
    }

    _internal__createDefaultItem(time, bar, colorer) {
        return {
            _internal_time: time,
            _internal_open: bar._internal_value[0 /* PlotRowValueIndex.Open */],
            _internal_high: bar._internal_value[1 /* PlotRowValueIndex.High */],
            _internal_low: bar._internal_value[2 /* PlotRowValueIndex.Low */],
            _internal_close: bar._internal_value[3 /* PlotRowValueIndex.Close */],
            _internal_x: NaN,
            _internal_openY: NaN,
            _internal_highY: NaN,
            _internal_lowY: NaN,
            _internal_closeY: NaN,
        };
    }

    _internal__fillRawPoints() {
        const colorer = this._internal__series._internal_barColorer();
        this._internal__items = this._internal__series._internal_bars()._internal_rows().map((row) => this._internal__createRawItem(row._internal_index, row, colorer));
    }
}

class PaneRendererCandlesticks extends BitmapCoordinatesPaneRenderer {
    constructor() {
        super(...arguments);
        this._private__data = null;
        // scaled with pixelRatio
        this._private__barWidth = 0;
    }

    _internal_setData(data) {
        this._private__data = data;
    }

    _internal__drawImpl(renderingScope) {
        if (this._private__data === null || this._private__data._internal_bars.length === 0 || this._private__data._internal_visibleRange === null) {
            return;
        }
        const {horizontalPixelRatio} = renderingScope;
        // now we know pixelRatio and we could calculate barWidth effectively
        this._private__barWidth = optimalCandlestickWidth(this._private__data._internal_barSpacing, horizontalPixelRatio);
        // grid and crosshair have line width = Math.floor(pixelRatio)
        // if this value is odd, we have to make candlesticks' width odd
        // if this value is even, we have to make candlesticks' width even
        // in order of keeping crosshair-over-candlesticks drawing symmetric
        if (this._private__barWidth >= 2) {
            const wickWidth = Math.floor(horizontalPixelRatio);
            if ((wickWidth % 2) !== (this._private__barWidth % 2)) {
                this._private__barWidth--;
            }
        }
        const bars = this._private__data._internal_bars;
        if (this._private__data._internal_wickVisible) {
            this._private__drawWicks(renderingScope, bars, this._private__data._internal_visibleRange);
        }
        if (this._private__data._internal_borderVisible) {
            this._private__drawBorder(renderingScope, bars, this._private__data._internal_visibleRange);
        }
        const borderWidth = this._private__calculateBorderWidth(horizontalPixelRatio);
        if (!this._private__data._internal_borderVisible || this._private__barWidth > borderWidth * 2) {
            this._private__drawCandles(renderingScope, bars, this._private__data._internal_visibleRange);
        }
    }

    _private__drawWicks(renderingScope, bars, visibleRange) {
        if (this._private__data === null) {
            return;
        }
        const {context: ctx, horizontalPixelRatio, verticalPixelRatio} = renderingScope;
        let prevWickColor = '';
        let wickWidth = Math.min(Math.floor(horizontalPixelRatio), Math.floor(this._private__data._internal_barSpacing * horizontalPixelRatio));
        wickWidth = Math.max(Math.floor(horizontalPixelRatio), Math.min(wickWidth, this._private__barWidth));
        const wickOffset = Math.floor(wickWidth * 0.5);
        let prevEdge = null;
        for (let i = visibleRange.from; i < visibleRange.to; i++) {
            const bar = bars[i];
            if (bar._internal_barWickColor !== prevWickColor) {
                ctx.fillStyle = bar._internal_barWickColor;
                prevWickColor = bar._internal_barWickColor;
            }
            const top = Math.round(Math.min(bar._internal_openY, bar._internal_closeY) * verticalPixelRatio);
            const bottom = Math.round(Math.max(bar._internal_openY, bar._internal_closeY) * verticalPixelRatio);
            const high = Math.round(bar._internal_highY * verticalPixelRatio);
            const low = Math.round(bar._internal_lowY * verticalPixelRatio);
            const scaledX = Math.round(horizontalPixelRatio * bar._internal_x);
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

    _private__calculateBorderWidth(pixelRatio) {
        let borderWidth = Math.floor(1 /* Constants.BarBorderWidth */ * pixelRatio);
        if (this._private__barWidth <= 2 * borderWidth) {
            borderWidth = Math.floor((this._private__barWidth - 1) * 0.5);
        }
        const res = Math.max(Math.floor(pixelRatio), borderWidth);
        if (this._private__barWidth <= res * 2) {
            // do not draw bodies, restore original value
            return Math.max(Math.floor(pixelRatio), Math.floor(1 /* Constants.BarBorderWidth */ * pixelRatio));
        }
        return res;
    }

    _private__drawBorder(renderingScope, bars, visibleRange) {
        if (this._private__data === null) {
            return;
        }
        const {context: ctx, horizontalPixelRatio, verticalPixelRatio} = renderingScope;
        let prevBorderColor = '';
        const borderWidth = this._private__calculateBorderWidth(horizontalPixelRatio);
        let prevEdge = null;
        for (let i = visibleRange.from; i < visibleRange.to; i++) {
            const bar = bars[i];
            if (bar._internal_barBorderColor !== prevBorderColor) {
                ctx.fillStyle = bar._internal_barBorderColor;
                prevBorderColor = bar._internal_barBorderColor;
            }
            let left = Math.round(bar._internal_x * horizontalPixelRatio) - Math.floor(this._private__barWidth * 0.5);
            // this is important to calculate right before patching left
            const right = left + this._private__barWidth - 1;
            const top = Math.round(Math.min(bar._internal_openY, bar._internal_closeY) * verticalPixelRatio);
            const bottom = Math.round(Math.max(bar._internal_openY, bar._internal_closeY) * verticalPixelRatio);
            if (prevEdge !== null) {
                left = Math.max(prevEdge + 1, left);
                left = Math.min(left, right);
            }
            if (this._private__data._internal_barSpacing * horizontalPixelRatio > 2 * borderWidth) {
                fillRectInnerBorder(ctx, left, top, right - left + 1, bottom - top + 1, borderWidth);
            } else {
                const width = right - left + 1;
                ctx.fillRect(left, top, width, bottom - top + 1);
            }
            prevEdge = right;
        }
    }

    _private__drawCandles(renderingScope, bars, visibleRange) {
        if (this._private__data === null) {
            return;
        }
        const {context: ctx, horizontalPixelRatio, verticalPixelRatio} = renderingScope;
        let prevBarColor = '';
        for (let i = visibleRange.from; i < visibleRange.to; i++) {
            const bar = bars[i];
            let top = Math.round(Math.min(bar._internal_openY, bar._internal_closeY) * verticalPixelRatio);
            let bottom = Math.round(Math.max(bar._internal_openY, bar._internal_closeY) * verticalPixelRatio);
            let left = Math.round(bar._internal_x * horizontalPixelRatio) - Math.floor(this._private__barWidth * 0.5);
            let right = left + this._private__barWidth - 1;
            if (bar._internal_barColor !== prevBarColor) {
                const barColor = bar._internal_barColor;
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

export class SeriesCandlesticksPaneView extends BarsPaneViewBase {
    constructor() {
        super(...arguments);
        this._internal__renderer = new PaneRendererCandlesticks();
    }

    _internal__createRawItem(time, bar, colorer) {
        return Object.assign(Object.assign({}, this._internal__createDefaultItem(time, bar, colorer)), colorer._internal_barStyle(time));
    }

    _internal__prepareRendererData() {
        const candlestickStyleProps = this._internal__series._internal_options();
        this._internal__renderer._internal_setData({
            _internal_bars: this._internal__items,
            _internal_barSpacing: this._internal__model._internal_timeScale()._internal_barSpacing(),
            _internal_wickVisible: candlestickStyleProps.wickVisible,
            _internal_borderVisible: candlestickStyleProps.borderVisible,
            _internal_visibleRange: this._internal__itemsVisibleRange,
        });
    }
}

class CustomSeriesPaneRendererWrapper {
    constructor(sourceRenderer, priceScale) {
        this._private__sourceRenderer = sourceRenderer;
        this._private__priceScale = priceScale;
    }

    _internal_draw(target, isHovered, hitTestData) {
        this._private__sourceRenderer.draw(target, this._private__priceScale, isHovered, hitTestData);
    }
}

export class SeriesCustomPaneView extends SeriesPaneViewBase {
    constructor(series, model, paneView) {
        super(series, model, false);
        this._private__paneView = paneView;
        this._internal__renderer = new CustomSeriesPaneRendererWrapper(this._private__paneView.renderer(), (price) => {
            const firstValue = series._internal_firstValue();
            if (firstValue === null) {
                return null;
            }
            return series._internal_priceScale()._internal_priceToCoordinate(price, firstValue._internal_value);
        });
    }

    _internal_priceValueBuilder(plotRow) {
        return this._private__paneView.priceValueBuilder(plotRow);
    }

    _internal_isWhitespace(data) {
        return this._private__paneView.isWhitespace(data);
    }
}

export class SeriesLinePaneView extends LinePaneViewBase {
    constructor() {
        super(...arguments);
        this._internal__renderer = new PaneRendererLine();
    }

    _internal__createRawItem(time, price, colorer) {
        return Object.assign(Object.assign({}, this._internal__createRawItemBase(time, price)), colorer._internal_barStyle(time));
    }

    _internal__prepareRendererData() {
        const options = this._internal__series._internal_options();
        const data = {
            _internal_items: this._internal__items,
            _internal_lineStyle: options.lineStyle,
            _internal_lineType: options.lineVisible ? options.lineType : undefined,
            _internal_lineWidth: options.lineWidth,
            _internal_pointMarkersRadius: options.pointMarkersVisible ? (options.pointMarkersRadius || options.lineWidth / 2 + 2) : undefined,
            _internal_visibleRange: this._internal__itemsVisibleRange,
            _internal_barWidth: this._internal__model._internal_timeScale()._internal_barSpacing(),
        };
        this._internal__renderer._internal_setData(data);
    }
}

const defaultReplacementRe = /[2-9]/g;

class TextWidthCache {
    constructor(size = 50) {
        this._private__actualSize = 0;
        this._private__usageTick = 1;
        this._private__oldestTick = 1;
        this._private__tick2Labels = {};
        this._private__cache = new Map();
        this._private__maxSize = size;
    }

    _internal_reset() {
        this._private__actualSize = 0;
        this._private__cache.clear();
        this._private__usageTick = 1;
        this._private__oldestTick = 1;
        this._private__tick2Labels = {};
    }

    _internal_measureText(ctx, text, optimizationReplacementRe) {
        return this._private__getMetrics(ctx, text, optimizationReplacementRe).width;
    }

    _internal_yMidCorrection(ctx, text, optimizationReplacementRe) {
        const metrics = this._private__getMetrics(ctx, text, optimizationReplacementRe);
        // if actualBoundingBoxAscent/actualBoundingBoxDescent are not supported we use 0 as a fallback
        return ((metrics.actualBoundingBoxAscent || 0) - (metrics.actualBoundingBoxDescent || 0)) / 2;
    }

    _private__getMetrics(ctx, text, optimizationReplacementRe) {
        const re = optimizationReplacementRe || defaultReplacementRe;
        const cacheString = String(text).replace(re, '0');
        if (this._private__cache.has(cacheString)) {
            return ensureDefined(this._private__cache.get(cacheString))._internal_metrics;
        }
        if (this._private__actualSize === this._private__maxSize) {
            const oldestValue = this._private__tick2Labels[this._private__oldestTick];
            delete this._private__tick2Labels[this._private__oldestTick];
            this._private__cache.delete(oldestValue);
            this._private__oldestTick++;
            this._private__actualSize--;
        }
        ctx.save();
        ctx.textBaseline = 'middle';
        const metrics = ctx.measureText(cacheString);
        ctx.restore();
        if (metrics.width === 0 && !!text.length) {
            // measureText can return 0 in FF depending on a canvas size, don't cache it
            return metrics;
        }
        this._private__cache.set(cacheString, {
            _internal_metrics: metrics,
            _internal_tick: this._private__usageTick
        });
        this._private__tick2Labels[this._private__usageTick] = cacheString;
        this._private__actualSize++;
        this._private__usageTick++;
        return metrics;
    }
}

class PanePriceAxisViewRenderer {
    constructor(textWidthCache) {
        this._private__priceAxisViewRenderer = null;
        this._private__rendererOptions = null;
        this._private__align = 'right';
        this._private__textWidthCache = textWidthCache;
    }

    _internal_setParams(priceAxisViewRenderer, rendererOptions, align) {
        this._private__priceAxisViewRenderer = priceAxisViewRenderer;
        this._private__rendererOptions = rendererOptions;
        this._private__align = align;
    }

    _internal_draw(target) {
        if (this._private__rendererOptions === null || this._private__priceAxisViewRenderer === null) {
            return;
        }
        this._private__priceAxisViewRenderer._internal_draw(target, this._private__rendererOptions, this._private__textWidthCache, this._private__align);
    }
}

export class PanePriceAxisView {
    constructor(priceAxisView, dataSource, chartModel) {
        this._private__priceAxisView = priceAxisView;
        this._private__textWidthCache = new TextWidthCache(50); // when should we clear cache?
        this._private__dataSource = dataSource;
        this._private__chartModel = chartModel;
        this._private__fontSize = -1;
        this._private__renderer = new PanePriceAxisViewRenderer(this._private__textWidthCache);
    }

    _internal_renderer() {
        const pane = this._private__chartModel._internal_paneForSource(this._private__dataSource);
        if (pane === null) {
            return null;
        }
        // this price scale will be used to find label placement only (left, right, none)
        const priceScale = pane._internal_isOverlay(this._private__dataSource) ? pane._internal_defaultVisiblePriceScale() : this._private__dataSource._internal_priceScale();
        if (priceScale === null) {
            return null;
        }
        const position = pane._internal_priceScalePosition(priceScale);
        if (position === 'overlay') {
            return null;
        }
        const options = this._private__chartModel._internal_priceAxisRendererOptions();
        if (options._internal_fontSize !== this._private__fontSize) {
            this._private__fontSize = options._internal_fontSize;
            this._private__textWidthCache._internal_reset();
        }
        this._private__renderer._internal_setParams(this._private__priceAxisView._internal_paneRenderer(), options, position);
        return this._private__renderer;
    }
}

class HorizontalLineRenderer extends BitmapCoordinatesPaneRenderer {
    constructor() {
        super(...arguments);
        this._private__data = null;
    }

    _internal_setData(data) {
        this._private__data = data;
    }

    _internal_hitTest(x, y) {
        var _a;
        if (!((_a = this._private__data) === null || _a === void 0 ? void 0 : _a._internal_visible)) {
            return null;
        }
        const {
            _internal_y: itemY,
            _internal_lineWidth: lineWidth,
            _internal_externalId: externalId
        } = this._private__data;
        // add a fixed area threshold around line (Y + width) for hit test
        if (y >= itemY - lineWidth - 7 /* Constants.HitTestThreshold */ && y <= itemY + lineWidth + 7 /* Constants.HitTestThreshold */) {
            return {
                _internal_hitTestData: this._private__data,
                _internal_externalId: externalId,
            };
        }
        return null;
    }

    _internal__drawImpl({context: ctx, bitmapSize, horizontalPixelRatio, verticalPixelRatio}) {
        if (this._private__data === null) {
            return;
        }
        if (this._private__data._internal_visible === false) {
            return;
        }
        const y = Math.round(this._private__data._internal_y * verticalPixelRatio);
        if (y < 0 || y > bitmapSize.height) {
            return;
        }
        ctx.lineCap = 'butt';
        ctx.strokeStyle = this._private__data._internal_color;
        ctx.lineWidth = Math.floor(this._private__data._internal_lineWidth * horizontalPixelRatio);
        setLineStyle(ctx, this._private__data._internal_lineStyle);
        drawHorizontalLine(ctx, y, 0, bitmapSize.width);
    }
}

class SeriesHorizontalLinePaneView {
    constructor(series) {
        this._internal__lineRendererData = {
            _internal_y: 0,
            _internal_color: 'rgba(0, 0, 0, 0)',
            _internal_lineWidth: 1,
            _internal_lineStyle: 0 /* LineStyle.Solid */,
            _internal_visible: false,
        };
        this._internal__lineRenderer = new HorizontalLineRenderer();
        this._private__invalidated = true;
        this._internal__series = series;
        this._internal__lineRenderer._internal_setData(this._internal__lineRendererData);
    }

    _internal_update() {
        this._private__invalidated = true;
    }

    _internal_renderer() {
        if (!this._internal__series._internal_visible()) {
            return null;
        }
        if (this._private__invalidated) {
            this._internal__updateImpl();
            this._private__invalidated = false;
        }
        return this._internal__lineRenderer;
    }
}

export class SeriesHorizontalBaseLinePaneView extends SeriesHorizontalLinePaneView {
    constructor(series) {
        super(series);
    }

    _internal__updateImpl() {
        this._internal__lineRendererData._internal_visible = false;
        const priceScale = this._internal__series._internal_priceScale();
        const mode = priceScale._internal_mode()._internal_mode;
        if (mode !== 2 /* PriceScaleMode.Percentage */ && mode !== 3 /* PriceScaleMode.IndexedTo100 */) {
            return;
        }
        const seriesOptions = this._internal__series._internal_options();
        if (!seriesOptions.baseLineVisible || !this._internal__series._internal_visible()) {
            return;
        }
        const firstValue = this._internal__series._internal_firstValue();
        if (firstValue === null) {
            return;
        }
        this._internal__lineRendererData._internal_visible = true;
        this._internal__lineRendererData._internal_y = priceScale._internal_priceToCoordinate(firstValue._internal_value, firstValue._internal_value);
        this._internal__lineRendererData._internal_color = seriesOptions.baseLineColor;
        this._internal__lineRendererData._internal_lineWidth = seriesOptions.baseLineWidth;
        this._internal__lineRendererData._internal_lineStyle = seriesOptions.baseLineStyle;
    }
}

class SeriesLastPriceAnimationRenderer extends BitmapCoordinatesPaneRenderer {
    constructor() {
        super(...arguments);
        this._private__data = null;
    }

    _internal_setData(data) {
        this._private__data = data;
    }

    _internal_data() {
        return this._private__data;
    }

    _internal__drawImpl({context: ctx, horizontalPixelRatio, verticalPixelRatio}) {
        const data = this._private__data;
        if (data === null) {
            return;
        }
        const tickWidth = Math.max(1, Math.floor(horizontalPixelRatio));
        const correction = (tickWidth % 2) / 2;
        const centerX = Math.round(data._internal_center.x * horizontalPixelRatio) + correction; // correct x coordinate only
        const centerY = data._internal_center.y * verticalPixelRatio;
        ctx.fillStyle = data._internal_seriesLineColor;
        ctx.beginPath();
        // TODO: it is better to have different horizontal and vertical radii
        const centerPointRadius = Math.max(2, data._internal_seriesLineWidth * 1.5) * horizontalPixelRatio;
        ctx.arc(centerX, centerY, centerPointRadius, 0, 2 * Math.PI, false);
        ctx.fill();
        ctx.fillStyle = data._internal_fillColor;
        ctx.beginPath();
        ctx.arc(centerX, centerY, data._internal_radius * horizontalPixelRatio, 0, 2 * Math.PI, false);
        ctx.fill();
        ctx.lineWidth = tickWidth;
        ctx.strokeStyle = data._internal_strokeColor;
        ctx.beginPath();
        ctx.arc(centerX, centerY, data._internal_radius * horizontalPixelRatio + tickWidth / 2, 0, 2 * Math.PI, false);
        ctx.stroke();
    }
}

const animationStagesData = [
    {
        _internal_start: 0,
        _internal_end: 0.25 /* Constants.Stage1Period */,
        _internal_startRadius: 4 /* Constants.Stage1StartCircleRadius */,
        _internal_endRadius: 10 /* Constants.Stage1EndCircleRadius */,
        _internal_startFillAlpha: 0.25 /* Constants.Stage1StartFillAlpha */,
        _internal_endFillAlpha: 0 /* Constants.Stage1EndFillAlpha */,
        _internal_startStrokeAlpha: 0.4 /* Constants.Stage1StartStrokeAlpha */,
        _internal_endStrokeAlpha: 0.8 /* Constants.Stage1EndStrokeAlpha */,
    },
    {
        _internal_start: 0.25 /* Constants.Stage1Period */,
        _internal_end: 0.25 /* Constants.Stage1Period */ + 0.275 /* Constants.Stage2Period */,
        _internal_startRadius: 10 /* Constants.Stage2StartCircleRadius */,
        _internal_endRadius: 14 /* Constants.Stage2EndCircleRadius */,
        _internal_startFillAlpha: 0 /* Constants.Stage2StartFillAlpha */,
        _internal_endFillAlpha: 0 /* Constants.Stage2EndFillAlpha */,
        _internal_startStrokeAlpha: 0.8 /* Constants.Stage2StartStrokeAlpha */,
        _internal_endStrokeAlpha: 0 /* Constants.Stage2EndStrokeAlpha */,
    },
    {
        _internal_start: 0.25 /* Constants.Stage1Period */ + 0.275 /* Constants.Stage2Period */,
        _internal_end: 0.25 /* Constants.Stage1Period */ + 0.275 /* Constants.Stage2Period */ + 0.475 /* Constants.Stage3Period */,
        _internal_startRadius: 14 /* Constants.Stage3StartCircleRadius */,
        _internal_endRadius: 14 /* Constants.Stage3EndCircleRadius */,
        _internal_startFillAlpha: 0 /* Constants.Stage3StartFillAlpha */,
        _internal_endFillAlpha: 0 /* Constants.Stage3EndFillAlpha */,
        _internal_startStrokeAlpha: 0 /* Constants.Stage3StartStrokeAlpha */,
        _internal_endStrokeAlpha: 0 /* Constants.Stage3EndStrokeAlpha */,
    },
];

function color(seriesLineColor, stage, startAlpha, endAlpha) {
    const alpha = startAlpha + (endAlpha - startAlpha) * stage;
    return applyAlpha(seriesLineColor, alpha);
}

function radius(stage, startRadius, endRadius) {
    return startRadius + (endRadius - startRadius) * stage;
}

function animationData(durationSinceStart, lineColor) {
    const globalStage = (durationSinceStart % 2600 /* Constants.AnimationPeriod */) / 2600 /* Constants.AnimationPeriod */;
    let currentStageData;
    for (const stageData of animationStagesData) {
        if (globalStage >= stageData._internal_start && globalStage <= stageData._internal_end) {
            currentStageData = stageData;
            break;
        }
    }
    assert(currentStageData !== undefined, 'Last price animation internal logic error');
    const subStage = (globalStage - currentStageData._internal_start) / (currentStageData._internal_end - currentStageData._internal_start);
    return {
        _internal_fillColor: color(lineColor, subStage, currentStageData._internal_startFillAlpha, currentStageData._internal_endFillAlpha),
        _internal_strokeColor: color(lineColor, subStage, currentStageData._internal_startStrokeAlpha, currentStageData._internal_endStrokeAlpha),
        _internal_radius: radius(subStage, currentStageData._internal_startRadius, currentStageData._internal_endRadius),
    };
}

export class SeriesLastPriceAnimationPaneView {
    constructor(series) {
        this._private__renderer = new SeriesLastPriceAnimationRenderer();
        this._private__invalidated = true;
        this._private__stageInvalidated = true;
        this._private__startTime = performance.now();
        this._private__endTime = this._private__startTime - 1;
        this._private__series = series;
    }

    _internal_onDataCleared() {
        this._private__endTime = this._private__startTime - 1;
        this._internal_update();
    }

    _internal_onNewRealtimeDataReceived() {
        this._internal_update();
        if (this._private__series._internal_options().lastPriceAnimation === 2 /* LastPriceAnimationMode.OnDataUpdate */) {
            const now = performance.now();
            const timeToAnimationEnd = this._private__endTime - now;
            if (timeToAnimationEnd > 0) {
                if (timeToAnimationEnd < 2600 /* Constants.AnimationPeriod */ / 4) {
                    this._private__endTime += 2600 /* Constants.AnimationPeriod */;
                }
                return;
            }
            this._private__startTime = now;
            this._private__endTime = now + 2600 /* Constants.AnimationPeriod */;
        }
    }

    _internal_update() {
        this._private__invalidated = true;
    }

    _internal_invalidateStage() {
        this._private__stageInvalidated = true;
    }

    _internal_visible() {
        // center point is always visible if lastPriceAnimation is not LastPriceAnimationMode.Disabled
        return this._private__series._internal_options().lastPriceAnimation !== 0 /* LastPriceAnimationMode.Disabled */;
    }

    _internal_animationActive() {
        switch (this._private__series._internal_options().lastPriceAnimation) {
            case 0 /* LastPriceAnimationMode.Disabled */
            :
                return false;
            case 1 /* LastPriceAnimationMode.Continuous */
            :
                return true;
            case 2 /* LastPriceAnimationMode.OnDataUpdate */
            :
                return performance.now() <= this._private__endTime;
        }
    }

    _internal_renderer() {
        if (this._private__invalidated) {
            this._private__updateImpl();
            this._private__invalidated = false;
            this._private__stageInvalidated = false;
        } else if (this._private__stageInvalidated) {
            this._private__updateRendererDataStage();
            this._private__stageInvalidated = false;
        }
        return this._private__renderer;
    }

    _private__updateImpl() {
        this._private__renderer._internal_setData(null);
        const timeScale = this._private__series._internal_model()._internal_timeScale();
        const visibleRange = timeScale._internal_visibleStrictRange();
        const firstValue = this._private__series._internal_firstValue();
        if (visibleRange === null || firstValue === null) {
            return;
        }
        const lastValue = this._private__series._internal_lastValueData(true);
        if (lastValue._internal_noData || !visibleRange._internal_contains(lastValue._internal_index)) {
            return;
        }
        const lastValuePoint = {
            x: timeScale._internal_indexToCoordinate(lastValue._internal_index),
            y: this._private__series._internal_priceScale()._internal_priceToCoordinate(lastValue._internal_price, firstValue._internal_value),
        };
        const seriesLineColor = lastValue._internal_color;
        const seriesLineWidth = this._private__series._internal_options().lineWidth;
        const data = animationData(this._private__duration(), seriesLineColor);
        this._private__renderer._internal_setData({
            _internal_seriesLineColor: seriesLineColor,
            _internal_seriesLineWidth: seriesLineWidth,
            _internal_fillColor: data._internal_fillColor,
            _internal_strokeColor: data._internal_strokeColor,
            _internal_radius: data._internal_radius,
            _internal_center: lastValuePoint,
        });
    }

    _private__updateRendererDataStage() {
        const rendererData = this._private__renderer._internal_data();
        if (rendererData !== null) {
            const data = animationData(this._private__duration(), rendererData._internal_seriesLineColor);
            rendererData._internal_fillColor = data._internal_fillColor;
            rendererData._internal_strokeColor = data._internal_strokeColor;
            rendererData._internal_radius = data._internal_radius;
        }
    }

    _private__duration() {
        return this._internal_animationActive() ? performance.now() - this._private__startTime : 2600 /* Constants.AnimationPeriod */ - 1;
    }
}

class SeriesMarkersRenderer extends BitmapCoordinatesPaneRenderer {
    constructor() {
        super(...arguments);
        this._private__data = null;
        this._private__textWidthCache = new TextWidthCache();
        this._private__fontSize = -1;
        this._private__fontFamily = '';
        this._private__font = '';
    }

    _internal_setData(data) {
        this._private__data = data;
    }

    _internal_setParams(fontSize, fontFamily) {
        if (this._private__fontSize !== fontSize || this._private__fontFamily !== fontFamily) {
            this._private__fontSize = fontSize;
            this._private__fontFamily = fontFamily;
            this._private__font = makeFont(fontSize, fontFamily);
            this._private__textWidthCache._internal_reset();
        }
    }

    _internal_hitTest(x, y) {
        if (this._private__data === null || this._private__data._internal_visibleRange === null) {
            return null;
        }
        for (let i = this._private__data._internal_visibleRange.from; i < this._private__data._internal_visibleRange.to; i++) {
            const item = this._private__data._internal_items[i];
            if (hitTestItem(item, x, y)) {
                return {
                    _internal_hitTestData: item._internal_internalId,
                    _internal_externalId: item._internal_externalId,
                };
            }
        }
        return null;
    }

    _internal__drawImpl({context: ctx, horizontalPixelRatio, verticalPixelRatio}, isHovered, hitTestData) {
        if (this._private__data === null || this._private__data._internal_visibleRange === null) {
            return;
        }
        ctx.textBaseline = 'middle';
        ctx.font = this._private__font;
        for (let i = this._private__data._internal_visibleRange.from; i < this._private__data._internal_visibleRange.to; i++) {
            const item = this._private__data._internal_items[i];
            if (item._internal_text !== undefined) {
                item._internal_text._internal_width = this._private__textWidthCache._internal_measureText(ctx, item._internal_text._internal_content);
                item._internal_text._internal_height = this._private__fontSize;
                item._internal_text._internal_x = item._internal_x - item._internal_text._internal_width / 2;
            }
            drawItem(item, ctx, horizontalPixelRatio, verticalPixelRatio);
        }
    }
}

class SeriesMarkersPaneView {
    constructor(series, model) {
        this._private__invalidated = true;
        this._private__dataInvalidated = true;
        this._private__autoScaleMargins = null;
        this._private__renderer = new SeriesMarkersRenderer();
        this._private__series = series;
        this._private__model = model;
        this._private__data = {
            _internal_items: [],
            _internal_visibleRange: null,
        };
    }

    _internal_update(updateType) {
        this._private__invalidated = true;
        if (updateType === 'data') {
            this._private__dataInvalidated = true;
        }
    }

    _internal_renderer(addAnchors) {
        if (!this._private__series._internal_visible()) {
            return null;
        }
        if (this._private__invalidated) {
            this._internal__makeValid();
        }
        const layout = this._private__model._internal_options().layout;
        this._private__renderer._internal_setParams(layout.fontSize, layout.fontFamily);
        this._private__renderer._internal_setData(this._private__data);
        return this._private__renderer;
    }

    _internal_autoScaleMargins() {
        return this._private__autoScaleMargins;
    }

    _internal__makeValid() {
        const priceScale = this._private__series._internal_priceScale();
        const timeScale = this._private__model._internal_timeScale();
        const seriesMarkers = this._private__series._internal_indexedMarkers();
        if (this._private__dataInvalidated) {
            this._private__data._internal_items = seriesMarkers.map((marker) => ({
                _internal_time: marker.time,
                _internal_x: 0,
                _internal_y: 0,
                _internal_size: 0,
                _internal_color: marker.color,
                _internal_internalId: marker._internal_internalId,
                _internal_externalId: marker.id,
                _internal_text: undefined,
            }));
            this._private__dataInvalidated = false;
        }
        this._private__data._internal_visibleRange = null;
    }
}

class SeriesPriceLinePaneView extends SeriesHorizontalLinePaneView {
    // eslint-disable-next-line no-useless-constructor
    constructor(series) {
        super(series);
    }

    _internal__updateImpl() {
        const data = this._internal__lineRendererData;
        data._internal_visible = false;
        const seriesOptions = this._internal__series._internal_options();
        if (!seriesOptions.priceLineVisible || !this._internal__series._internal_visible()) {
            return;
        }
        const lastValueData = this._internal__series._internal_lastValueData(seriesOptions.priceLineSource === 0 /* PriceLineSource.LastBar */);
        if (lastValueData._internal_noData) {
            return;
        }
        data._internal_visible = true;
        data._internal_y = lastValueData._internal_coordinate;
        data._internal_color = this._internal__series._internal_priceLineColor(lastValueData._internal_color);
        data._internal_lineWidth = seriesOptions.priceLineWidth;
        data._internal_lineStyle = seriesOptions.priceLineStyle;
    }
}

class SeriesPriceAxisView extends PriceAxisView {
    constructor(source) {
        super();
        this._private__source = source;
    }

    _internal__updateRendererData(axisRendererData, paneRendererData, commonRendererData) {
        axisRendererData._internal_visible = false;
        paneRendererData._internal_visible = false;
        const source = this._private__source;
        if (!source._internal_visible()) {
            return;
        }
        const seriesOptions = source._internal_options();
        const showSeriesLastValue = seriesOptions.lastValueVisible;
        const showSymbolLabel = source._internal_title() !== '';
        const showPriceAndPercentage = seriesOptions.seriesLastValueMode === 0 /* PriceAxisLastValueMode.LastPriceAndPercentageValue */;
        const lastValueData = source._internal_lastValueData(false);
        if (lastValueData._internal_noData) {
            return;
        }
        if (showSeriesLastValue) {
            axisRendererData._internal_text = this._internal__axisText(lastValueData, showSeriesLastValue, showPriceAndPercentage);
            axisRendererData._internal_visible = axisRendererData._internal_text.length !== 0;
        }
        if (showSymbolLabel || showPriceAndPercentage) {
            paneRendererData._internal_text = this._internal__paneText(lastValueData, showSeriesLastValue, showSymbolLabel, showPriceAndPercentage);
            paneRendererData._internal_visible = paneRendererData._internal_text.length > 0;
        }
        const lastValueColor = source._internal_priceLineColor(lastValueData._internal_color);
        const colors = generateContrastColors(lastValueColor);
        commonRendererData._internal_background = colors._internal_background;
        commonRendererData._internal_coordinate = lastValueData._internal_coordinate;
        paneRendererData._internal_borderColor = source._internal_model()._internal_backgroundColorAtYPercentFromTop(lastValueData._internal_coordinate / source._internal_priceScale()._internal_height());
        axisRendererData._internal_borderColor = lastValueColor;
        axisRendererData._internal_color = colors._internal_foreground;
        paneRendererData._internal_color = colors._internal_foreground;
    }

    _internal__paneText(lastValue, showSeriesLastValue, showSymbolLabel, showPriceAndPercentage) {
        let result = '';
        const title = this._private__source._internal_title();
        if (showSymbolLabel && title.length !== 0) {
            result += `${title} `;
        }
        if (showSeriesLastValue && showPriceAndPercentage) {
            result += this._private__source._internal_priceScale()._internal_isPercentage() ?
                lastValue._internal_formattedPriceAbsolute : lastValue._internal_formattedPricePercentage;
        }
        return result.trim();
    }

    _internal__axisText(lastValueData, showSeriesLastValue, showPriceAndPercentage) {
        if (!showSeriesLastValue) {
            return '';
        }
        if (!showPriceAndPercentage) {
            return lastValueData._internal_text;
        }
        return this._private__source._internal_priceScale()._internal_isPercentage() ?
            lastValueData._internal_formattedPricePercentage : lastValueData._internal_formattedPriceAbsolute;
    }
}