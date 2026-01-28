import * as Main from 'resource:///org/gnome/shell/ui/main.js';
import UPower from 'gi://UPowerGlib';
import { gettext as _ } from 'resource:///org/gnome/shell/extensions/extension.js';

import * as Logger from './logger.js';
import { getBatteryCorrection, getPower, getStatus } from './upower.js';
import { updateCircleIndicatorStatus } from './indicators/circle.js';
import { cachePowerToggleStyles, cacheDefaultLabelColor, hideStockBattery, restoreStockBattery } from './system.js';
import { getLabelStyleFromPercentage } from './utils.js';
import { getSettingsSnapshot } from './settings.js';

// Global tracking for cleanup
let _originalSync = null;
let lastOverrideTime = 0;
let overrideCallCount = 0;
const MAX_CALLS_PER_SECOND = 10;
let batteryCorrection = null;

/**
 * Format power value as string with optional decimals.
 *
 * @param {number} power - Power in watts
 * @param {object} settings - GSettings object
 * @returns {string} Formatted power string or empty if near zero
 */
function formatWatts(power, settings) {
    // Hide if effectively zero (charging/discharging calculation pending)
    if (power <= 0.01 && power >= -0.01) return '';

    if (settings && settings.get_boolean('showdecimals')) return Math.abs(power).toFixed(2);

    // Default behavior: Round to integer
    return Math.round(Math.abs(power)).toString();
}

/**
 * Format remaining time as HH∶MM string.
 *
 * @param {number} seconds - Remaining time in seconds
 * @returns {string|null} Formatted time string or null if invalid
 */
function formatTimeRemaining(seconds) {
    if (seconds <= 0) return null;

    const time = Math.round(seconds / 60);
    if (time <= 0) return null;

    const minutes = time % 60;
    const hours = Math.floor(time / 60);
    return _('%d\u2236%02d').format(hours, minutes);
}

/**
 * Create override function for power toggle sync.
 *
 * @param {object} settings - GSettings object
 * @returns {() => void} Sync override function
 */
function _powerToggleSyncOverride(settings) {
    return function () {
        // Safety check: prevent infinite loops
        const now = Date.now();
        if (now - lastOverrideTime < 1000) {
            overrideCallCount++;
            if (overrideCallCount > MAX_CALLS_PER_SECOND) {
                Logger.debug(`SAFETY: Too many calls per second (${overrideCallCount}). Stopping override.`);
                return false;
            }
        } else {
            overrideCallCount = 0;
        }
        lastOverrideTime = now;

        // Only set title, don't touch visibility - that's handled separately
        if (!this._proxy.IsPresent) return false;

        batteryCorrection = getBatteryCorrection();
        const percentage = `${Math.round(this._proxy.Percentage)}%`;
        const state = this._proxy.State;
        const status = getStatus(batteryCorrection);
        const snapshot = getSettingsSnapshot(settings);

        // Visibility Checks (Text Label)
        let shouldHide = false;
        const isCharging = state === UPower.DeviceState.CHARGING;
        // Fully Charged check: strict 100% or state? State is safer.
        const isFull = state === UPower.DeviceState.FULLY_CHARGED || percentage === '100%';
        // Idle check: Not Charging and Not Discharging
        // UPower: 0=Unknown, 1=Charging, 2=Discharging, 3=Empty, 4=Full, 5=Pending Charge, 6=Pending Discharge
        // We consider "Idle" as anything that isn't actively Charging (1) or Discharging (2).
        // (Full is handled by hideFull usually, but technically Full is also "Idle" in physics terms.
        //  User likely wants hideIdle to cover "unplugged but not doing anything" or "unknown"?)
        //  Let's stick to the same logic as circle.js: status!==1 && status!==2
        const isIdle = state !== UPower.DeviceState.CHARGING && state !== UPower.DeviceState.DISCHARGING;

        if (snapshot.hideCharging && isCharging) shouldHide = true;
        if (snapshot.hideFull && isFull) shouldHide = true;
        if (snapshot.hideIdle && isIdle) shouldHide = true;

        // ForceBolt overrides visibility (matches circle.js logic now? No, circle.js logic was valid: forceBolt implies showing)
        // BUT user complained about usage of forceBolt.
        // If forceBolt is meant to DEBUG the ICON, maybe it shouldn't force text?
        // Let's assume if hidden, we hide text.

        // Build display string
        const displayParts = [];

        // Add percentage if enabled and circular indicator is off
        if (snapshot.showPercentageText) displayParts.push(percentage);

        // Add time remaining if enabled
        if (snapshot.showTimeRemaining) {
            let seconds = 0;
            if (state === UPower.DeviceState.CHARGING) seconds = this._proxy.TimeToFull;
            else if (state === UPower.DeviceState.DISCHARGING) seconds = this._proxy.TimeToEmpty;

            const timeStr = formatTimeRemaining(seconds);
            if (timeStr) displayParts.push(timeStr);
        }

        // Add watts if enabled
        if (snapshot.showWatts) {
            const power = getPower(batteryCorrection);
            let wattStr = '';
            const formattedPower = formatWatts(power, settings);

            if (formattedPower !== '') {
                if (status.includes('Charging')) wattStr = `+${formattedPower}W`;
                else if (status.includes('Discharging')) wattStr = `-${formattedPower}W`;
                else if (status.includes('Unknown')) wattStr = '?';
                // else if (state === UPower.DeviceState.FULLY_CHARGED) wattStr = '∞'; // Removed as per user request to hide infinite sign
            }

            if (wattStr) displayParts.push(wattStr);
        }

        // Apply Hiding
        if (shouldHide) {
            displayParts.length = 0; // Clear all parts
            return false;
        }

        // Keep indicators optimized logic
        updateCircleIndicatorStatus(this._proxy, settings);

        // Handle fully charged without custom display
        if (state === UPower.DeviceState.FULLY_CHARGED && displayParts.length === 0) {
            if (snapshot.showPercentageText && snapshot.showPercentage) {
                this.title = percentage;
                return true;
            }
            return false;
        }

        // If nothing to display, keep icon visible when enabled
        if (displayParts.length === 0) {
            if (snapshot.showPercentageText) {
                this.title = percentage;
                return true;
            }

            if (snapshot.showIcon || snapshot.showCircle) {
                this.title = '';
                return true;
            }

            return false;
        } else {
            const title = displayParts.join(' ');
            this.title = snapshot.showCircle ? ` ${title}` : title;
            return true;
        }
    };
}

/**
 * Enable the sync override.
 *
 * @param {object} settings - Styles/settings object.
 */
export function enableSyncOverride(settings) {
    const quickSettings = Main.panel?.statusArea?.quickSettings;
    const system = quickSettings?._system;

    if (!system) {
        Logger.warn('System indicator not found, cannot override _sync');
        return;
    }

    const proto = Object.getPrototypeOf(system);
    if (!proto || typeof proto._sync !== 'function') {
        Logger.warn('System sync function not available, skipping override');
        return;
    }
    if (proto._syncOrig) {
        disableSyncOverride();
    }

    _originalSync = proto._sync;

    // The Override
    proto._sync = function () {
        // Call original
        if (_originalSync) {
            _originalSync.call(this);
        }

        // Helper Logic
        const powerToggle = this._systemItem?.powerToggle;
        if (!powerToggle || !settings) return;

        cachePowerToggleStyles(quickSettings?._system);
        cacheDefaultLabelColor();

        const overrideFunc = _powerToggleSyncOverride(settings);
        const hasOverride = overrideFunc.call(powerToggle);

        // Visibility Logic (from original extension.js override block)
        const snapshot = getSettingsSnapshot(settings); // Re-get for visibility logic

        // Logic from line 2392 of original
        const showLabelText =
            (snapshot.showPercentageOutside && snapshot.showPercentage) ||
            snapshot.showTimeRemaining ||
            snapshot.showWatts;

        // Re-implementing lines 2392-2417 of original extension.js
        const percentageValue = this._proxy?.Percentage ?? powerToggle?._proxy?.Percentage;
        const labelStyle = getLabelStyleFromPercentage(percentageValue, settings.get_boolean('showcolored'));

        // Fix: Hide stock icon if ANY custom indicator is enabled.
        const showStockIcon = !snapshot.showIcon && !snapshot.showCircle;

        if (showStockIcon) {
            // Restore stock icon if needed
            restoreStockBattery();
        } else {
            // Force hide stock battery using system.js helper
            hideStockBattery();
        }

        // Removed local targeting logic as it was flaky.
        // const stockIcon = this._icon || this._indicator?._icon;
        // if (stockIcon) { ... }

        if (powerToggle?.set_style) powerToggle.set_style(labelStyle);

        powerToggle?._title?.set_style?.(labelStyle);
        powerToggle?._titleLabel?.set_style?.(labelStyle);

        if (this._percentageLabel) {
            this._percentageLabel.visible = showLabelText && hasOverride;
            this._percentageLabel.set_style(labelStyle);
        }

        // Also ensure indicators are updated?
        // Original did: updateCircleIndicatorStatus(this._proxy, settings); inside sync?
        // Yes, in _powerToggleSyncOverride.
    };

    Logger.info('Enabled Sync Override (from sync.js)');
}

/**
 * Disable the sync override.
 */
export function disableSyncOverride() {
    const system = Main.panel.statusArea.quickSettings?._system;
    if (system && _originalSync) {
        const proto = Object.getPrototypeOf(system);
        proto._sync = _originalSync;
        _originalSync = null;
        Logger.info('Disabled Sync Override');
    }
}

/**
 * Force a sync update immediately.
 * usage: called when settings change to ensure instant UI update.
 */
export function forceSync() {
    const system = Main.panel.statusArea.quickSettings?._system;
    if (system && system._sync) {
        system._sync();
        Logger.debug('Forced synchronous update via _sync');
    }
}
