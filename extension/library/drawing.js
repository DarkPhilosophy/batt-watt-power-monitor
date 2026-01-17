import Cairo from 'cairo';
import Rsvg from 'gi://Rsvg';
import Gio from 'gi://Gio';
import * as Logger from './logger.js';
import { clamp01 } from './utils.js';
import { CACHE_AGE_MS, PURGE_INTERVAL_MS, CACHE_MAX_ENTRIES, SVG_COLOR_QUANT } from './constants.js';

const SVG_CACHE = new Map();
let lastCachePurgeTime = Date.now();

/**
 * Quantize a color channel to reduce cache key variance.
 *
 * @param {number} value - Channel value (0..1)
 * @returns {number} Quantized channel value
 */
function quantizeColor(value) {
    const clamped = clamp01(value);
    return Math.round(clamped / SVG_COLOR_QUANT) * SVG_COLOR_QUANT;
}

/**
 * Format a color key for cache indexing.
 *
 * @param {number} value - Channel value (0..1)
 * @returns {string} Quantized channel key
 */
function formatColorKey(value) {
    return quantizeColor(value).toFixed(2);
}

/**
 * Finish a Cairo surface safely.
 *
 * @param {object} surface - Cairo surface.
 */
function finishSurface(surface) {
    try {
        surface?.finish?.();
    } catch (error) {
        Logger.debug(`[Memory Prevention] Surface finish error: ${error.message}`);
    }
}

/**
 * Purge old entries from SVG cache.
 */
export function purgeSvgCache() {
    const now = Date.now();
    if (now - lastCachePurgeTime < PURGE_INTERVAL_MS) return;

    let purgedCount = 0;
    for (const [key, { timestamp }] of SVG_CACHE.entries()) {
        if (now - timestamp > CACHE_AGE_MS) {
            finishSurface(SVG_CACHE.get(key)?.surface);
            SVG_CACHE.delete(key);
            purgedCount++;
        }
    }
    lastCachePurgeTime = now;
    if (purgedCount > 0) Logger.debug(`[Memory Prevention] Purged ${purgedCount} cached SVG surfaces`);
}

/**
 * Clear SVG cache and finish any retained surfaces.
 */
export function clearSvgCache() {
    for (const { surface } of SVG_CACHE.values()) finishSurface(surface);
    SVG_CACHE.clear();
}

/**
 * Get or load cached SVG.
 *
 * @param {string} cacheKey - Cache Key.
 * @param {() => object|null} loaderFunc - Function to load fresh surface.
 * @returns {object|null} Cairo Surface.
 */
function getCachedSvg(cacheKey, loaderFunc) {
    const cached = SVG_CACHE.get(cacheKey);
    if (cached) {
        cached.timestamp = Date.now();
        return cached.surface;
    }

    const surface = loaderFunc();
    if (surface) {
        SVG_CACHE.set(cacheKey, { surface, timestamp: Date.now() });
        // Manage cache size
        if (SVG_CACHE.size > CACHE_MAX_ENTRIES) {
            const oldestKey = SVG_CACHE.keys().next().value;
            finishSurface(SVG_CACHE.get(oldestKey)?.surface);
            SVG_CACHE.delete(oldestKey);
        }
        Logger.debug(`[Memory Prevention] Cached SVG: ${cacheKey}`);
    }
    return surface;
}

/**
 * Load and tint using Rsvg.
 *
 * @param {string} extensionPath - Path to extension.
 * @param {number} red - R
 * @param {number} green - G
 * @param {number} blue - B
 * @returns {object|null} Cairo Surface
 */
export function loadChargingSvg(extensionPath, red, green, blue) {
    const qRed = quantizeColor(red);
    const qGreen = quantizeColor(green);
    const qBlue = quantizeColor(blue);
    const cacheKey = `bolt_${formatColorKey(qRed)}_${formatColorKey(qGreen)}_${formatColorKey(qBlue)}`;

    return getCachedSvg(cacheKey, () => {
        try {
            const svgPath = `${extensionPath}/bolt.svg`;
            const file = Gio.File.new_for_path(svgPath);
            if (!file.query_exists(null)) {
                Logger.error(`Bolt SVG not found at: ${svgPath}`);
                return null;
            }
            const handle = Rsvg.Handle.new_from_file(svgPath);
            if (!handle) {
                Logger.debug('Failed to create SVG handle');
                return null;
            }

            const dimensions = handle.get_dimensions();
            const svgWidth = dimensions.width;
            const svgHeight = dimensions.height;

            const surface = new Cairo.ImageSurface(Cairo.Format.ARGB32, svgWidth, svgHeight);
            const context = new Cairo.Context(surface);
            handle.render_cairo(context);

            const tintSurface = new Cairo.ImageSurface(Cairo.Format.ARGB32, svgWidth, svgHeight);
            const tintContext = new Cairo.Context(tintSurface);
            tintContext.setSourceSurface(surface, 0, 0);
            tintContext.paint();
            tintContext.setOperator(Cairo.Operator.IN);
            tintContext.setSourceRGB(qRed, qGreen, qBlue);
            tintContext.paint();
            finishSurface(surface);

            return tintSurface;
        } catch (error) {
            Logger.error(`Failed to load charging icon: ${error.message}`);
            return null;
        }
    });
}

/**
 * Draw battery icon using Cairo.
 *
 * @param {object} context - Cairo context
 * @param {number} centerX - X coordinate of center
 * @param {number} centerY - Y coordinate of center
 * @param {number} width - Icon width in pixels
 * @param {number} height - Icon height in pixels
 * @param {number} percentage - Battery percentage (0-100)
 * @param {number} red - Red component (0-1)
 * @param {number} green - Green component (0-1)
 * @param {number} blue - Blue component (0-1)
 * @param {number} bodyWidthRatio - Ratio of body width to total width (default: 0.42)
 * @param {number} bodyHeightRatio - Ratio of body height to total height (default: 0.5)
 * @param {boolean} showText - Whether to show percentage text (default: false)
 */
export function drawBatteryIcon(
    context,
    centerX,
    centerY,
    width,
    height,
    percentage,
    red,
    green,
    blue,
    bodyWidthRatio = 0.42,
    bodyHeightRatio = 0.5,
    showText = false,
) {
    const bodyWidth = width * bodyWidthRatio;
    const bodyHeight = height * bodyHeightRatio;
    const bodyX = centerX - bodyWidth / 2;
    const bodyY = centerY - bodyHeight / 2;
    const nubWidth = bodyWidth * 0.28;
    const nubHeight = bodyHeight * 0.18;
    const nubX = centerX - nubWidth / 2;
    const nubY = bodyY - nubHeight * 0.9;

    context.save();
    context.setSourceRGB(red, green, blue);
    context.setLineWidth(1.2);
    context.rectangle(bodyX, bodyY, bodyWidth, bodyHeight);
    context.stroke();
    context.rectangle(nubX, nubY, nubWidth, nubHeight);
    context.stroke();

    const pct = Math.max(0, Math.min(100, Math.round(percentage)));
    const fillHeight = bodyHeight * (pct / 100);
    const fillY = bodyY + (bodyHeight - fillHeight);
    context.rectangle(bodyX + 1.5, fillY + 1.5, bodyWidth - 3, Math.max(0, fillHeight - 3));
    context.fill();

    if (showText) {
        Logger.debug(`drawBatteryIcon: rendering text, pct=${pct}, centerX=${centerX}, centerY=${centerY}`);
        context.selectFontFace('Sans', Cairo.FontSlant.NORMAL, Cairo.FontWeight.BOLD);
        context.setFontSize(Math.round(height * 0.28));
        const text = String(pct);
        const textExtents = context.textExtents(text);
        const textX = centerX - textExtents.width / 2;
        const textY = centerY + textExtents.height / 2;
        Logger.debug(
            `drawBatteryIcon: text="${text}", textX=${textX}, textY=${textY}, fontSize=${Math.round(height * 0.28)}`,
        );
        context.setSourceRGB(red, green, blue);
        context.moveTo(textX, textY);
        context.showText(text);
        context.stroke();
    }

    context.restore();
}

/**
 * Draw charging bolt icon using Cairo.
 *
 * @param {object} context - Cairo context
 * @param {string} extensionPath - Path to extension directory
 * @param {number} centerX - X coordinate of center
 * @param {number} centerY - Y coordinate of center
 * @param {number} boltHeight - Height of bolt icon in pixels
 * @param {number} red - Red component (0-1)
 * @param {number} green - Green component (0-1)
 * @param {number} blue - Blue component (0-1)
 */
export function drawBoltIcon(context, extensionPath, centerX, centerY, boltHeight, red, green, blue) {
    const svgSurface = loadChargingSvg(extensionPath, red, green, blue);
    if (!svgSurface) return;

    const svgHeight = svgSurface.getHeight();
    const svgWidth = svgSurface.getWidth();
    const scale = boltHeight / svgHeight;
    const scaledWidth = svgWidth * scale;
    const boltX = centerX - scaledWidth / 2;
    const boltY = centerY - boltHeight / 2;

    context.save();
    context.scale(scale, scale);
    context.setSourceSurface(svgSurface, boltX / scale, boltY / scale);
    context.paint();
    context.restore();
}

/**
 * Clear a Cairo context to transparent before drawing.
 *
 * @param {object} context - Cairo context
 */
export function clearCairoContext(context) {
    context.setSourceRGBA(0, 0, 0, 0);
    context.setOperator(Cairo.Operator.CLEAR);
    context.paint();
    context.setOperator(Cairo.Operator.OVER);
}
