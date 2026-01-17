import UPower from 'gi://UPowerGlib';

/**
 * Clamp a value between 0 and 1.
 *
 * @param {number} value - The value to clamp.
 * @returns {number} The clamped value.
 */
export function clamp01(value) {
    return Math.max(0, Math.min(1, value));
}

/**
 * Get the key name of an object value.
 *
 * @param {object} obj - The object to search.
 * @param {unknown} value - Value to find.
 * @returns {string|null} Key name or null if not found.
 */
export function getObjectKey(obj, value) {
    return Object.keys(obj).find(key => obj[key] === value) || null;
}

/**
 * Format time in seconds to HH:MM format.
 *
 * @param {number} seconds - Time in seconds.
 * @returns {string} Formatted string "HH:MM".
 */
export function formatTimeRemaining(seconds) {
    if (!Number.isFinite(seconds) || seconds <= 0) return '';
    if (seconds > 86400) return ''; // Hide infinity as requested by user
    // User said: "when is 100% charged I can see a infiite sign... sometime I'm seeing it weird"
    // If fully charged, time_to_empty/full might be 0 or erratic.
    // Let's stick to Safe Hours.

    const hours = Math.floor(seconds / 3600);
    const minutes = Math.floor((seconds % 3600) / 60);
    // Pad with leading zero if single digit
    const h = hours < 10 ? `0${hours}` : hours;
    const m = minutes < 10 ? `0${minutes}` : minutes;
    return `${h}:${m}`;
}

/**
 * Format watts value.
 *
 * @param {number} watts - Power in watts.
 * @param {object} settings - Extension settings object.
 * @returns {string} Formatted watts string.
 */
export function formatWatts(watts, settings) {
    const decimals = settings.get_int('watts-decimals');
    return watts.toFixed(decimals);
}

/**
 * Determine if battery state indicates charging.
 *
 * @param {object} proxy - UPower proxy object.
 * @param {string} status - String status from sysfs.
 * @returns {boolean} True if charging.
 */
export function isChargingState(proxy, status) {
    const state = proxy.state ?? proxy.State;
    return state === UPower.DeviceState.CHARGING || status === 'Charging';
}

/**
 * Convert HSL to RGB.
 *
 * @param {number} h - Hue 0-1
 * @param {number} s - Saturation 0-1
 * @param {number} l - Lightness 0-1
 * @returns {Array<number>} [r, g, b] 0-1
 */
function hslToRgb(h, s, l) {
    let r, g, b;
    if (s === 0) {
        r = g = b = l;
    } else {
        const hue2rgb = (p, q, t) => {
            if (t < 0) t += 1;
            if (t > 1) t -= 1;
            if (t < 1 / 6) return p + (q - p) * 6 * t;
            if (t < 1 / 2) return q;
            if (t < 2 / 3) return p + (q - p) * (2 / 3 - t) * 6;
            return p;
        };
        const q = l < 0.5 ? l * (1 + s) : l + s - l * s;
        const p = 2 * l - q;
        r = hue2rgb(p, q, h + 1 / 3);
        g = hue2rgb(p, q, h);
        b = hue2rgb(p, q, h - 1 / 3);
    }
    return [r, g, b];
}

/**
 * Convert RGB array (0-1) to Hex string.
 *
 * @param {Array<number>} rgb - [r, g, b]
 * @returns {string} Hex color
 */
function rgbToHex(rgb) {
    const toHex = c => {
        const hex = Math.round(c * 255).toString(16);
        return hex.length === 1 ? '0' + hex : hex;
    };
    return `#${toHex(rgb[0])}${toHex(rgb[1])}${toHex(rgb[2])}`;
}

/**
 * Get color values (0-1) for a given percentage using a Red->Green gradient.
 *
 * @param {number} percentage - Battery percentage (0-100)
 * @returns {Array<number>} [r, g, b]
 */
function getGradientRGB(percentage) {
    const p = Math.max(0, Math.min(100, percentage));
    // Map 0-100% to Hue 0-120 (Red to Green)
    // 0 -> 0 (Red)
    // 100 -> 120 (Green) / 360 = 0.333
    const hue = (p / 100) * 0.333; // 120 / 360

    // Saturation 1.0, Lightness 0.5 (standard vibrant colors)
    // Maybe adjust Lightness for better visibility on dark theme?
    // 0.6 might be safer for text.
    return hslToRgb(hue, 1.0, 0.5);
}

/**
 * Get CSS style string for label color based on percentage.
 *
 * @param {number} percentage - Battery percentage.
 * @param {boolean} useColor - Whether to apply color.
 * @returns {string|null} CSS string or null.
 */
export function getLabelStyleFromPercentage(percentage, useColor) {
    if (!useColor) return null;
    const rgb = getGradientRGB(percentage);
    return `color: ${rgbToHex(rgb)};`;
}

// ... existing exports ...

/**
 * Get foreground color of an actor.
 *
 * @param {object} actor - St widget
 * @returns {object} Color object {red, green, blue, alpha}
 */
export function getForegroundColor(actor) {
    if (!actor) return { red: 255, green: 255, blue: 255, alpha: 255 };
    const themeNode = actor.get_theme_node();
    const color = themeNode.get_foreground_color();
    // Fallback if transparent (likely not styled yet)
    if (color.alpha === 0) return { red: 255, green: 255, blue: 255, alpha: 255 };
    return color;
}

/**
 * Get ring color based on percentage.
 *
 * @param {number} percentage - Battery percentage.
 * @returns {Array<number>} [r, g, b]
 */
export function getRingColor(percentage) {
    return getGradientRGB(percentage);
}

/**
 * Apply consistent sizing rules for ST widgets.
 *
 * @param {object} widget - ST widget
 * @param {number} width - Width in pixels
 * @param {number} height - Height in pixels
 */
export function applyWidgetSize(widget, width, height) {
    widget.set_size(width, height);
    if (widget.set_width) widget.set_width(width);
    if (widget.set_height) widget.set_height(height);
    widget.set_style(`width: ${width}px; height: ${height}px; min-width: ${width}px; min-height: ${height}px;`);
    widget.queue_relayout();
}

export const TEXT_DECODER = new TextDecoder('utf-8');
