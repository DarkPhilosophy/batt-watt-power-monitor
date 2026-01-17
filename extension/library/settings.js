import { getBatteryStatus } from './upower.js';
import { isChargingState } from './utils.js';

/**
 * Snapshot settings used by hot-path display logic.
 *
 * @param {object} settings - GSettings object
 * @returns {object} Snapshot of settings values
 */
export function getSettingsSnapshot(settings) {
    const showPercentage = settings.get_boolean('percentage');
    const showPercentageOutside = settings.get_boolean('showpercentageoutside') && showPercentage;
    const showTimeRemaining = settings.get_boolean('timeremaining');
    const showWatts = settings.get_boolean('showwatts');
    const showIcon = settings.get_boolean('showicon');
    const showCircle = settings.get_boolean('usecircleindicator');
    const showColored = settings.get_boolean('showcolored');
    const forceBolt = settings.get_boolean('forcebolt');
    const hideCharging = settings.get_boolean('hidecharging');
    const hideFull = settings.get_boolean('hidefull');
    const hideIdle = settings.get_boolean('hideidle');
    return {
        showPercentage,
        showPercentageOutside,
        showPercentageText: showPercentageOutside,
        showTimeRemaining,
        showWatts,
        showIcon,
        showCircle,
        showColored,
        forceBolt,
        hideCharging,
        hideFull,
        hideIdle,
        showText: showPercentage && !showPercentageOutside,
    };
}

/**
 * Build indicator status used by drawing routines.
 *
 * @param {object} proxy - UPower proxy object
 * @param {object} settings - GSettings object
 * @returns {object} Status data for indicators
 */
export function buildIndicatorStatus(proxy, settings) {
    // Handle both GObject (snake_case) and DBus Proxy (PascalCase) properties
    const rawPercentage = proxy.percentage ?? proxy.Percentage;
    const percentage = Math.round(rawPercentage);
    const status = getBatteryStatus();
    const snapshot = getSettingsSnapshot(settings);

    // proxy.state is a UPower.DeviceState enum
    return {
        percentage,
        status,
        isCharging: isChargingState(proxy, status) || snapshot.forceBolt,
        showText: snapshot.showText,
        useColor: snapshot.showColored,
        forceBolt: snapshot.forceBolt,
        hideCharging: snapshot.hideCharging,
        hideFull: snapshot.hideFull,
        hideIdle: snapshot.hideIdle,
    };
}

// Default sizes
const BATTERY_MIN_SIZE = 24;

/**
 * Get circle size from settings.
 *
 * @param {object} settings - GSettings object
 * @returns {number} Size in pixels
 */
export function getCircleSize(settings) {
    const rawSize = settings.get_int('circlesize');
    // User requested "sweet spot" limit: 25 to 50.
    // < 25 is too small, > 50 doesn't grow (panel constraint) but adds width.
    return Math.max(25, Math.min(rawSize, 50));
}

/**
 * Get battery width from settings.
 *
 * @param {object} settings - GSettings object
 * @returns {number} Width in pixels
 */
export function getBatteryWidth(settings) {
    return settings.get_int('batterysize') || BATTERY_MIN_SIZE;
}

/**
 * Get battery height from settings.
 *
 * @param {object} settings - GSettings object
 * @returns {number} Height in pixels
 */
export function getBatteryHeight(settings) {
    return settings.get_int('batteryheight') || BATTERY_MIN_SIZE;
}
