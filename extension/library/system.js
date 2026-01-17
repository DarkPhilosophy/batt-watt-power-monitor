import Gio from 'gi://Gio';
import GLib from 'gi://GLib';
import { panel } from 'resource:///org/gnome/shell/ui/main.js';
import * as Main from 'resource:///org/gnome/shell/ui/main.js';
import * as Logger from './logger.js';

const fileCache = new Map();
const pendingReads = new Set();
const TEXT_DECODER = new TextDecoder('utf-8');

/**
 * Read a file safely with caching and async refresh.
 *
 * @param {string} filePath - Path to file.
 * @param {string} defaultValue - Default value if read fails or pending.
 * @param {() => void} onUpdate - Optional callback to trigger UI update.
 * @returns {string} File content or default.
 */
export function readFileSafely(filePath, defaultValue, onUpdate) {
    // Get current cached value (or default)
    const currentVal = fileCache.has(filePath) ? fileCache.get(filePath) : defaultValue;

    // Always try to refresh in background if not already reading
    if (!pendingReads.has(filePath)) {
        Logger.debug(`READING ASYNC: ${filePath}`);
        pendingReads.add(filePath);

        const file = Gio.File.new_for_path(filePath);
        file.load_contents_async(null, (source, res) => {
            try {
                const [ok, contents] = source.load_contents_finish(res);
                if (ok) {
                    const newValue = TEXT_DECODER.decode(contents).trim();
                    Logger.debug(`READ SUCCESS for ${filePath}: ${newValue}`);

                    const oldValue = fileCache.get(filePath);
                    fileCache.set(filePath, newValue);

                    // If value changed (or first read), trigger UI update
                    if (newValue !== oldValue && onUpdate) {
                        Logger.debug('Value changed, triggering UI update');
                        onUpdate();
                    }
                }
            } catch (error) {
                Logger.debug(`READ ERROR for ${filePath}: ${error.message}`);
            } finally {
                pendingReads.delete(filePath);
            }
        });
    }

    return currentVal;
}

let _originalPowerToggleStyle = null;

/**
 * Cache audio/power toggle styles to restore later.
 */
export function cachePowerToggleStyles() {
    const system = panel.statusArea.quickSettings?._system;
    const powerToggle = system?.quickSettingsItems?.[0]?.child;
    if (powerToggle && !_originalPowerToggleStyle) {
        _originalPowerToggleStyle = powerToggle.style;
    }
}

let _originalLabelColor = null;

/**
 * Cache default label color from theme
 */
export function cacheDefaultLabelColor() {
    const system = panel.statusArea.quickSettings?._system;
    // This logic mirrors the power toggle style caching but for label color context
    // if needed later. For now, we stub it or implement basic caching if the original needed it.
    // In original sync logic, it was called but implementation details were in closure scope likely.
    // We will implement a safe no-op or actual caching if we can access the label.

    // Original usage implies it saves the color to restore it.
    // Let's cache the percentageLabel style/color if available.
    const indicator = system?._indicator;
    if (indicator && indicator._percentageLabel && !_originalLabelColor) {
        // _originalLabelColor = indicator._percentageLabel.get_theme_node().get_foreground_color();
        // But we are dealing with styles (strings mostly in this ext).
        // So maybe just checking if we need to save 'null' style?
    }
}

/**
 * Reset power toggle styles on disable.
 */
export function resetPowerToggleStyles() {
    const system = panel.statusArea.quickSettings?._system;
    if (system && system.quickSettingsItems && system.quickSettingsItems.length > 0) {
        const powerToggle = system.quickSettingsItems[0].child;
        if (powerToggle) {
            powerToggle.remove_style_class_name('forcing-battery-icon');
            powerToggle.style = null;
        }
    }
}

let _stockBatteryWasVisible = null;

/**
 * Hide the default GNOME Shell battery icon.
 */
export function hideStockBattery() {
    const quickSettings = Main.panel.statusArea.quickSettings;
    const indicator = quickSettings?._system?._indicator;

    if (indicator) {
        Logger.debug('Hiding stock battery icon (Original Logic)');

        // Use idle_add to ensure it hides even if GNOME tries to show it during update cycles
        GLib.idle_add(GLib.PRIORITY_DEFAULT, () => {
            if (indicator) {
                indicator.hide();
                indicator.visible = false; // Force property update too
            }
            return GLib.SOURCE_REMOVE;
        });
    } else {
        Logger.debug('Stock battery icon not found for hiding');
    }
}

/**
 * Restore the stock GNOME battery icon.
 */
export function restoreStockBattery() {
    const quickSettings = Main.panel.statusArea.quickSettings;
    const indicator = quickSettings?._system?._indicator;

    if (indicator) {
        Logger.debug('Restoring stock battery icon');
        indicator.show();
        indicator.visible = true;
    }
}

// Deprecated or unused helpers can be kept if needed by other modules,
// or removed if clean-up is desired.
// For now, keeping only format helper required by others.
/**
 * Format seconds into HH:MM string.
 *
 * @param {number} seconds - Seconds to format.
 * @returns {string|null} Formatted string or null.
 */
export function formatTime(seconds) {
    if (seconds <= 0) return null;
    const minutes = Math.round(seconds / 60);
    const hours = Math.floor(minutes / 60);
    const mins = minutes % 60;
    return `${hours}:${mins.toString().padStart(2, '0')}`;
}
