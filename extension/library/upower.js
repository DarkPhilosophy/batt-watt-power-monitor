import { BATTERIES } from './constants.js';
import * as Logger from './logger.js';
import { readFileSafely } from './system.js';
import { computePower } from './power-model.js';

let batteryCorrection = null;

/**
 * Auto-detect battery path from available sysfs power supply entries.
 *
 * Only resolves WHICH battery path to use. Whether power_now or
 * current_now/voltage_now is readable is re-checked on every getPower() call
 * (see computePower), because system.js's async file cache may not have
 * resolved power_now yet on the first probe. Caching that decision here would
 * lock in a wrong value permanently (issue #10).
 *
 * @returns {object} Object with the resolved sysfs path (path: -1 if none found)
 */
function getAutopath() {
    for (const path of [BATTERIES.BAT0, BATTERIES.BAT1, BATTERIES.BAT2]) {
        if (readFileSafely(`${path}status`, 'none') !== 'none') {
            return { path };
        }
    }
    return { path: -1 };
}

/**
 * Get cached battery correction or re-detect if missing.
 *
 * @returns {object} Battery correction
 */
export function getBatteryCorrection() {
    if (!batteryCorrection || !batteryCorrection.path || batteryCorrection.path === -1)
        batteryCorrection = getAutopath();
    return batteryCorrection;
}

/**
 * Get current status from battery sysfs.
 *
 * @param {object|null} correction - Battery correction object.
 * @returns {string} Status string (e.g., "Charging", "Discharging").
 */
export function getStatus(correction) {
    if (!correction || !correction['path']) {
        correction = getBatteryCorrection();
        if (!correction || !correction['path']) return 'Unknown';
    }
    return readFileSafely(`${correction['path']}status`, 'Unknown');
}

/**
 * Get current battery status using cached correction.
 *Wrapper for getStatus that handles correction automatically.
 *
 * @returns {string} Status string
 */
export function getBatteryStatus() {
    const correction = getBatteryCorrection();
    return getStatus(correction);
}

/**
 * Read numeric value from sysfs file and convert from µ to base unit.
 *
 * @param {string} pathToFile - Full path to sysfs file
 * @returns {number} Converted value in base unit
 */
function getValue(pathToFile) {
    const value = parseFloat(readFileSafely(pathToFile, -1));
    return value === -1 ? value : value / 1000000;
}

/**
 * Get current power usage in Watts.
 *
 * @param {object} correction - Correction object.
 * @returns {number} Power in Watts.
 */
export function getPower(correction) {
    if (!correction || !correction['path']) {
        correction = getBatteryCorrection();
        if (!correction || !correction['path']) return 0;
    }
    const path = correction['path'];
    const val = computePower(
        getValue(`${path}power_now`),
        getValue(`${path}current_now`),
        getValue(`${path}voltage_now`),
    );

    const energyNow = getValue(`${path}energy_now`);
    Logger.debug(`Raw Power: ${val} W | Energy Now: ${energyNow} Wh`);

    return val;
}

/**
 * Reset gathered battery info (e.g. on disable).
 */
export function resetBatteryCorrection() {
    batteryCorrection = null;
}
