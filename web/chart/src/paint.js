export function setLineStyle(ctx, style) {
    const dashPatterns = {
        [0 /* LineStyle.Solid */]: [],
        [1 /* LineStyle.Dotted */]: [ctx.lineWidth, ctx.lineWidth],
        [2 /* LineStyle.Dashed */]: [2 * ctx.lineWidth, 2 * ctx.lineWidth],
        [3 /* LineStyle.LargeDashed */]: [6 * ctx.lineWidth, 6 * ctx.lineWidth],
        [4 /* LineStyle.SparseDotted */]: [ctx.lineWidth, 4 * ctx.lineWidth],
    };
    const dashPattern = dashPatterns[style];
    ctx.setLineDash(dashPattern);
}

export function drawHorizontalLine(ctx, y, left, right) {
    ctx.beginPath();
    const correction = (ctx.lineWidth % 2) ? 0.5 : 0;
    ctx.moveTo(left, y + correction);
    ctx.lineTo(right, y + correction);
    ctx.stroke();
}

export function drawVerticalLine(ctx, x, top, bottom) {
    ctx.beginPath();
    const correction = (ctx.lineWidth % 2) ? 0.5 : 0;
    ctx.moveTo(x + correction, top);
    ctx.lineTo(x + correction, bottom);
    ctx.stroke();
}

export function strokeInPixel(ctx, drawFunction) {
    ctx.save();
    if (ctx.lineWidth % 2) {
        ctx.translate(0.5, 0.5);
    }
    drawFunction();
    ctx.restore();
}

function normalizeRgbComponent(component) {
    if (component < 0) {
        return 0;
    }
    if (component > 255) {
        return 255;
    }
    // NaN values are treated as 0
    return (Math.round(component) || 0);
}

function normalizeAlphaComponent(component) {
    return (!(component <= 0) && !(component > 0) ? 0 :
        component < 0 ? 0 :
            component > 1 ? 1 :
                // limit the precision of all numbers to at most 4 digits in fractional part
                Math.round(component * 10000) / 10000);
}

/**
 * @example
 * #fb0
 * @example
 * #f0f
 * @example
 * #f0fa
 */
const shortHexRe = /^#([0-9a-f])([0-9a-f])([0-9a-f])([0-9a-f])?$/i;
/**
 * @example
 * #00ff00
 * @example
 * #336699
 * @example
 * #336699FA
 */
const hexRe = /^#([0-9a-f]{2})([0-9a-f]{2})([0-9a-f]{2})([0-9a-f]{2})?$/i;
/**
 * @example
 * rgb(123, 234, 45)
 * @example
 * rgb(255,234,245)
 */
const rgbRe = /^rgb\(\s*(-?\d{1,10})\s*,\s*(-?\d{1,10})\s*,\s*(-?\d{1,10})\s*\)$/;
/**
 * @example
 * rgba(123, 234, 45, 1)
 * @example
 * rgba(255,234,245,0.1)
 */
const rgbaRe = /^rgba\(\s*(-?\d{1,10})\s*,\s*(-?\d{1,10})\s*,\s*(-?\d{1,10})\s*,\s*(-?[\d]{0,10}(?:\.\d+)?)\s*\)$/;

function colorStringToRgba(colorString) {
    colorString = colorString.toLowerCase();
    {
        const matches = rgbaRe.exec(colorString) || rgbRe.exec(colorString);
        if (matches) {
            return [
                normalizeRgbComponent(parseInt(matches[1], 10)),
                normalizeRgbComponent(parseInt(matches[2], 10)),
                normalizeRgbComponent(parseInt(matches[3], 10)),
                normalizeAlphaComponent((matches.length < 5 ? 1 : parseFloat(matches[4]))),
            ];
        }
    }
    {
        const matches = hexRe.exec(colorString);
        if (matches) {
            return [
                normalizeRgbComponent(parseInt(matches[1], 16)),
                normalizeRgbComponent(parseInt(matches[2], 16)),
                normalizeRgbComponent(parseInt(matches[3], 16)),
                1,
            ];
        }
    }
    {
        const matches = shortHexRe.exec(colorString);
        if (matches) {
            return [
                normalizeRgbComponent(parseInt(matches[1], 16) * 0x11),
                normalizeRgbComponent(parseInt(matches[2], 16) * 0x11),
                normalizeRgbComponent(parseInt(matches[3], 16) * 0x11),
                1,
            ];
        }
    }
    throw new Error(`Cannot parse color: ${colorString}`);
}

function rgbaToGrayscale(rgbValue) {
    // Originally, the NTSC RGB to YUV formula
    // perfected by @eugene-korobko's black magic
    const redComponentGrayscaleWeight = 0.199;
    const greenComponentGrayscaleWeight = 0.687;
    const blueComponentGrayscaleWeight = 0.114;
    return (redComponentGrayscaleWeight * rgbValue[0] +
        greenComponentGrayscaleWeight * rgbValue[1] +
        blueComponentGrayscaleWeight * rgbValue[2]);
}

export function applyAlpha(color, alpha) {
    // special case optimization
    if (color === 'transparent') {
        return color;
    }
    const originRgba = colorStringToRgba(color);
    const originAlpha = originRgba[3];
    return `rgba(${originRgba[0]}, ${originRgba[1]}, ${originRgba[2]}, ${alpha * originAlpha})`;
}

export function generateContrastColors(backgroundColor) {
    const rgb = colorStringToRgba(backgroundColor);
    return {
        _internal_background: `rgb(${rgb[0]}, ${rgb[1]}, ${rgb[2]})`,
        _internal_foreground: rgbaToGrayscale(rgb) > 160 ? 'black' : 'white',
    };
}

export function gradientColorAtPercent(topColor, bottomColor, percent) {
    const [topR, topG, topB, topA] = colorStringToRgba(topColor);
    const [bottomR, bottomG, bottomB, bottomA] = colorStringToRgba(bottomColor);
    const resultRgba = [
        normalizeRgbComponent(topR + percent * (bottomR - topR)),
        normalizeRgbComponent(topG + percent * (bottomG - topG)),
        normalizeRgbComponent(topB + percent * (bottomB - topB)),
        normalizeAlphaComponent(topA + percent * (bottomA - topA)),
    ];
    return `rgba(${resultRgba[0]}, ${resultRgba[1]}, ${resultRgba[2]}, ${resultRgba[3]})`;
}

export function fillRectInnerBorder(ctx, x, y, width, height, borderWidth) {
    ctx.fillRect(x + borderWidth, y, width - borderWidth * 2, borderWidth);
    ctx.fillRect(x + borderWidth, y + height - borderWidth, width - borderWidth * 2, borderWidth);
    ctx.fillRect(x, y, borderWidth, height);
    ctx.fillRect(x + width - borderWidth, y, borderWidth, height);
}

export function clearRect(ctx, x, y, w, h, clearColor) {
    ctx.save();
    ctx.globalCompositeOperation = 'copy';
    ctx.fillStyle = clearColor;
    ctx.fillRect(x, y, w, h);
    ctx.restore();
}

function changeBorderRadius(borderRadius, offset) {
    return borderRadius.map((x) => x === 0 ? x : x + offset);
}

function drawRoundRect(
    // eslint:disable-next-line:max-params
    ctx, x, y, w, h, radii) {
    /**
     * As of May 2023, all of the major browsers now support ctx.roundRect() so we should
     * be able to switch to the native version soon.
     */
    ctx.beginPath();
    ctx.lineTo(x + w - radii[1], y);
    if (radii[1] !== 0) {
        ctx.arcTo(x + w, y, x + w, y + radii[1], radii[1]);
    }
    ctx.lineTo(x + w, y + h - radii[2]);
    if (radii[2] !== 0) {
        ctx.arcTo(x + w, y + h, x + w - radii[2], y + h, radii[2]);
    }
    ctx.lineTo(x + radii[3], y + h);
    if (radii[3] !== 0) {
        ctx.arcTo(x, y + h, x, y + h - radii[3], radii[3]);
    }
    ctx.lineTo(x, y + radii[0]);
    if (radii[0] !== 0) {
        ctx.arcTo(x, y, x + radii[0], y, radii[0]);
    }
}

export function drawRoundRectWithInnerBorder(ctx, left, top, width, height, backgroundColor, borderWidth = 0, borderRadius = [0, 0, 0, 0], borderColor = '') {
    ctx.save();
    if (!borderWidth || !borderColor || borderColor === backgroundColor) {
        drawRoundRect(ctx, left, top, width, height, borderRadius);
        ctx.fillStyle = backgroundColor;
        ctx.fill();
        ctx.restore();
        return;
    }
    const halfBorderWidth = borderWidth / 2;
    // Draw body
    if (backgroundColor !== 'transparent') {
        const innerRadii = changeBorderRadius(borderRadius, -borderWidth);
        drawRoundRect(ctx, left + borderWidth, top + borderWidth, width - borderWidth * 2, height - borderWidth * 2, innerRadii);
        ctx.fillStyle = backgroundColor;
        ctx.fill();
    }
    // Draw border
    if (borderColor !== 'transparent') {
        const outerRadii = changeBorderRadius(borderRadius, -halfBorderWidth);
        drawRoundRect(ctx, left + halfBorderWidth, top + halfBorderWidth, width - borderWidth, height - borderWidth, outerRadii);
        ctx.lineWidth = borderWidth;
        ctx.strokeStyle = borderColor;
        ctx.closePath();
        ctx.stroke();
    }
    ctx.restore();
}

export function clearRectWithGradient(ctx, x, y, w, h, topColor, bottomColor) {
    ctx.save();
    ctx.globalCompositeOperation = 'copy';
    const gradient = ctx.createLinearGradient(0, 0, 0, h);
    gradient.addColorStop(0, topColor);
    gradient.addColorStop(1, bottomColor);
    ctx.fillStyle = gradient;
    ctx.fillRect(x, y, w, h);
    ctx.restore();
}