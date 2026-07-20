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
    const first = clampPercent(settings.get_int('fake-charge-min'));
    const second = clampPercent(settings.get_int('fake-charge-max'));
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
    const fakeCharging = debug && settings.get_boolean('fake-charging');
    const fakeDischarging = debug && settings.get_boolean('fake-discharging');

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
    const showPercentageOutside = settings.get_boolean('show-percentage-outside') && showPercentage;
    const showTimeRemaining = settings.get_boolean('time-remaining');
    const showWatts = settings.get_boolean('show-watts');
    const showIcon = settings.get_boolean('show-icon');
    const showCircle = settings.get_boolean('use-circle-indicator') && !useStockIcon;
    const showColoredIcon = settings.get_boolean('show-colored');
    const showColoredText = settings.get_boolean('show-colored-text');
    const chargingIconColorSource = settings.get_string('charging-icon-color-source');
    const textColorSource = settings.get_string('charging-text-color-source');
    const textStroke = settings.get_boolean('text-stroke');
    const forceBolt = settings.get_boolean('force-bolt');
    const hideCharging = settings.get_boolean('hide-charging');
    const hideFull = settings.get_boolean('hide-full');
    const hideIdle = settings.get_boolean('hide-idle');
    return {
        showPercentage,
        showPercentageOutside,
        showPercentageText: showPercentageOutside,
        showTimeRemaining,
        showWatts,
        showIcon,
        showCircle,
        useStockIcon,
        showColoredIcon,
        showColoredText,
        chargingIconColorSource,
        chargingCustomColor: settings.get_string('charging-icon-custom-color'),
        textColorSource,
        textCustomColor: settings.get_string('charging-text-custom-color'),
        textStroke,
        fakeCharging: settings.get_boolean('debug') && settings.get_boolean('fake-charging'),
        fakeDischarging: settings.get_boolean('debug') && settings.get_boolean('fake-discharging'),
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
        showBolt: snapshot.forceBolt || fakeCharging || realCharging,
        fakeDischarging,
        showText: snapshot.showText,
        useColor: snapshot.showColoredIcon,
        chargingColorSource: snapshot.chargingIconColorSource,
        chargingCustomColor: snapshot.chargingCustomColor,
        textStroke: snapshot.textStroke,
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
    const rawSize = settings.get_int('circle-size');
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
    return settings.get_int('battery-size') || BATTERY_MIN_SIZE;
}

/**
 * Get battery height from settings.
 *
 * @param {object} settings - GSettings object
 * @returns {number} Height in pixels
 */
export function getBatteryHeight(settings) {
    return settings.get_int('battery-height') || BATTERY_MIN_SIZE;
}
