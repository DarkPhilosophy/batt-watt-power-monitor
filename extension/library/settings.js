import UPower from 'gi://UPowerGlib';
import { getBatteryStatus } from './upower.js';
import { isChargingState } from './utils.js';

/**
 * Clamp percentage to 0-100 range.
 *
 * @param {number} value - The value to clamp
 * @returns {number} The clamped value
 */
function clampPercent(value) {
    return Math.max(0, Math.min(100, Math.round(value)));
}

/**
 * Get fake charge range from settings.
 *
 * @param {object} settings - GSettings object
 * @returns {[number, number]} [min, max] range
 */
function getFakeChargeRange(settings) {
    const first = clampPercent(settings.get_int('fakechargemin'));
    const second = clampPercent(settings.get_int('fakechargemax'));
    return first <= second ? [first, second] : [second, first];
}

/**
 * Get fake charge percentage (ascending).
 *
 * @param {object} settings - GSettings object
 * @returns {number} The calculated percentage
 */
function getFakeChargePercentage(settings) {
    const [min, max] = getFakeChargeRange(settings);
    if (min === max) return min;

    const span = max - min + 1;
    return min + (Math.floor(Date.now() / 1000) % span);
}

/**
 * Get fake discharge percentage (descending).
 *
 * @param {object} settings - GSettings object
 * @returns {number} The calculated percentage
 */
function getFakeDischargePercentage(settings) {
    const [min, max] = getFakeChargeRange(settings);
    if (min === max) return min;

    const span = max - min + 1;
    return max - (Math.floor(Date.now() / 1000) % span);
}

/**
 * Get effective battery values with fake overrides.
 *
 * @param {object} proxy - UPower proxy object
 * @param {object} settings - GSettings object
 * @returns {object} Effective battery values
 */
export function getEffectiveBatteryValues(proxy, settings) {
    const rawPercentage = proxy.percentage ?? proxy.Percentage ?? 0;
    const rawState = proxy.state ?? proxy.State;
    const debug = settings.get_boolean('debug');
    const fakeCharging = debug && settings.get_boolean('fakecharging');
    const fakeDischarging = debug && settings.get_boolean('fakedischarging');

    if (!fakeCharging && !fakeDischarging) {
        return {
            percentage: Math.round(rawPercentage),
            state: rawState,
            fakeCharging: false,
            fakeDischarging: false,
        };
    }

    if (fakeCharging) {
        return {
            percentage: getFakeChargePercentage(settings),
            state: UPower.DeviceState.CHARGING,
            fakeCharging: true,
            fakeDischarging: false,
        };
    }

    return {
        percentage: getFakeDischargePercentage(settings),
        state: UPower.DeviceState.DISCHARGING,
        fakeCharging: false,
        fakeDischarging: true,
    };
}

/**
 * Snapshot settings used by hot-path display logic.
 *
 * @param {object} settings - GSettings object
 * @returns {object} Snapshot of settings values
 */
export function getSettingsSnapshot(settings) {
    const useStockIcon = settings.get_boolean('use-stock-icon');
    const showPercentage = settings.get_boolean('percentage');
    const showPercentageOutside = settings.get_boolean('showpercentageoutside') && showPercentage;
    const showTimeRemaining = settings.get_boolean('timeremaining');
    const showWatts = settings.get_boolean('showwatts');
    const showIcon = settings.get_boolean('showicon');
    const showCircle = settings.get_boolean('usecircleindicator') && !useStockIcon;
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
        useStockIcon,
        showColored,
        fakeCharging: settings.get_boolean('debug') && settings.get_boolean('fakecharging'),
        fakeDischarging: settings.get_boolean('debug') && settings.get_boolean('fakedischarging'),
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
    const { percentage, state, fakeCharging, fakeDischarging } = getEffectiveBatteryValues(proxy, settings);
    const status = getBatteryStatus();
    const snapshot = getSettingsSnapshot(settings);
    const realCharging = isChargingState({ state, State: state }, status);

    return {
        percentage,
        state,
        isCharging: fakeCharging || realCharging,
        useChargingColor: fakeCharging || realCharging,
        showBolt: snapshot.forceBolt || fakeCharging || realCharging,
        fakeDischarging,
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
