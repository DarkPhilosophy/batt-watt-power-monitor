import { panel } from 'resource:///org/gnome/shell/ui/main.js';
import * as Logger from './logger.js';
import { formatTimeRemaining, formatWatts, getLabelStyleFromPercentage } from './utils.js';
import { getSettingsSnapshot } from './settings.js';
import { getPower } from './upower.js';

let _originalLabelStyle = null;
let _originalLabelVisible = null;
let _originalPowerLabelVisible = null;

/**
 * Get the system battery indicator and power toggle widgets.
 *
 * @returns {object} { indicator, powerToggle } or empty object.
 */
function getSystemWidgets() {
    const system = panel.statusArea.quickSettings?._system;
    if (!system) {
        Logger.debug('getSystemWidgets: System indicator not found.');
        return {};
    }

    const indicator = system._indicator;
    if (!indicator) Logger.debug('getSystemWidgets: system._indicator not found.');
    else if (!indicator._percentageLabel) Logger.debug('getSystemWidgets: indicator._percentageLabel not found.');

    const powerToggle = system.quickSettingsItems?.[0]?.child;

    return { indicator, powerToggle };
}

/**
 * Update the system label text (percentage/watts/time).
 * This function hijacks the GNOME Shell's default battery label.
 *
 * @param {object} proxy - UPower proxy object.
 * @param {object} settings - GSettings object.
 */
export function updateLabel(proxy, settings) {
    const { indicator, powerToggle } = getSystemWidgets();
    const snapshot = getSettingsSnapshot(settings);

    // Build the label text
    const parts = [];

    // Handle properties
    const pct = proxy.percentage ?? proxy.Percentage;
    const state = proxy.state ?? proxy.State;
    const timeEmpty = proxy.time_to_empty ?? proxy.TimeToEmpty;
    const timeFull = proxy.time_to_full ?? proxy.TimeToFull;
    const energyRate = proxy.energy_rate ?? proxy.EnergyRate; // Watts

    // 1. Percentage (if outside)
    if (snapshot.showPercentageOutside) {
        parts.push(`${Math.round(pct)}%`);
    }

    // 2. Time Remaining
    if (snapshot.showTimeRemaining) {
        let timeSeconds = 0;
        if (state === 2) {
            // Discharging
            timeSeconds = timeEmpty;
        } else if (state === 1) {
            // Charging
            timeSeconds = timeFull;
        }

        const timeStr = formatTimeRemaining(timeSeconds);
        if (timeStr) {
            parts.push(timeStr);
        }
    }

    // 3. Watts
    if (snapshot.showWatts) {
        let watts = 0;
        // Try native property first
        if (energyRate > 0) {
            watts = energyRate;
        } else {
            // Fallback to sysfs
            watts = getPower();
        }

        if (watts > 0) {
            const wattStr = formatWatts(watts, settings);
            parts.push(`${wattStr}W`);
        }
    }

    const labelText = parts.join(' ');
    const showLabel = parts.length > 0;
    const style = getLabelStyleFromPercentage(pct, snapshot.showColored);

    Logger.debug(`Label Update: text="${labelText}" visible=${showLabel}`);

    // Apply to System Indicator Label (Panel)
    if (indicator && indicator._percentageLabel) {
        // Logger.debug('updateLabel: Found indicator label, applying text.');
        if (_originalLabelVisible === null) _originalLabelVisible = indicator._percentageLabel.visible;

        indicator._percentageLabel.set_text(labelText);
        indicator._percentageLabel.visible = showLabel;

        if (style) {
            indicator._percentageLabel.set_style(style);
        } else {
            indicator._percentageLabel.set_style(null);
        }
    } else {
        Logger.debug('updateLabel: indicator._percentageLabel is MISSING');
        if (indicator) {
            // Debug introspection
            const keys = Object.keys(indicator).join(',');
            Logger.debug(`updateLabel: indicator keys: ${keys}`);
        }
    }

    // Apply to Power Toggle Label (Quick Settings Menu)
    if (powerToggle && powerToggle._percentageLabel) {
        if (_originalPowerLabelVisible === null) _originalPowerLabelVisible = powerToggle._percentageLabel.visible;

        powerToggle._percentageLabel.set_text(labelText);
        powerToggle._percentageLabel.visible = showLabel;
        if (style) powerToggle._percentageLabel.set_style(style);
    }
}

/**
 * Restore the system label to default state.
 */
export function restoreLabel() {
    const { indicator, powerToggle } = getSystemWidgets();

    if (indicator && indicator._percentageLabel) {
        indicator._percentageLabel.set_text('');
        if (_originalLabelVisible !== null) {
            indicator._percentageLabel.visible = _originalLabelVisible;
        }
        indicator._percentageLabel.set_style(null);
    }

    if (powerToggle && powerToggle._percentageLabel) {
        powerToggle._percentageLabel.set_text(''); // Or reset?
        if (_originalPowerLabelVisible !== null) {
            powerToggle._percentageLabel.visible = _originalPowerLabelVisible;
        }
        powerToggle._percentageLabel.set_style(null);
    }

    _originalLabelVisible = null;
    _originalLabelStyle = null;
    _originalPowerLabelVisible = null;
}
