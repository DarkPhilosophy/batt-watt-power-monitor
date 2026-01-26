import UPower from 'gi://UPowerGlib';
import GLib from 'gi://GLib';

import { Extension, gettext as _ } from 'resource:///org/gnome/shell/extensions/extension.js';
import * as Main from 'resource:///org/gnome/shell/ui/main.js';

import * as Logger from './library/logger.js';
import { resetBatteryCorrection } from './library/upower.js';
import {
    ensureCircleIndicator,
    destroyCircleIndicator,
    updateCircleIndicatorStatus,
} from './library/indicators/circle.js';
import {
    ensurePortraitIndicator,
    destroyPortraitIndicator,
    updatePortraitIndicatorStatus,
} from './library/indicators/portrait.js';
import {
    ensureLandscapeIndicator,
    destroyLandscapeIndicator,
    updateLandscapeIndicatorStatus,
} from './library/indicators/landscape.js';
import {
    cachePowerToggleStyles,
    resetPowerToggleStyles,
    hideStockBattery,
    restoreStockBattery,
} from './library/system.js';
import { enableSyncOverride, disableSyncOverride, forceSync } from './library/sync.js';
import { restoreLabel } from './library/label.js';
import { clearSvgCache, purgeSvgCache } from './library/drawing.js';

// Global debug flag (managed via Logger now, but might be used for other logic if needed)
// Usage of `DEBUG` var in original: passed to logging functions.
// Refactoring replaced logging with Logger.debug/warn.

let updateUI;

export default class BatteryPowerMonitor extends Extension {
    enable() {
        this._settings = this.getSettings();

        // 1. Initialize Logger
        Logger.init('Batt-Watt Power Monitor');
        Logger.updateSettings(this._settings);

        Logger.info('Enabling Batt-Watt Power Monitor...');

        // Initialize queue function (debouncer)
        updateUI = () => {
            if (!this._settings) return;
            this._updateBatteryVisibility();
        };

        this._settingsSignalId = this._settings.connect('changed', (_settings, key) => {
            Logger.debug('Settings changed');
            if (key === 'interval') {
                const refreshInterval = this._settings.get_int('interval') || 3;
                this._updateInterval(refreshInterval);
            }
            updateUI();
        });

        // Initial setup
        this._updateBatteryVisibility();

        // Refresh interval
        const refreshInterval = this._settings.get_int('interval') || 3;
        this._updateInterval(refreshInterval);

        // System theme changes (e.g. for color updates)
        const themeContext = imports.gi.St.ThemeContext.get_for_stage(global.stage);
        this._themeSignalId = themeContext.connect('changed', () => {
            Logger.debug('Theme changed, clearing SVG cache');
            clearSvgCache();
            updateUI();
        });

        // Monitor connection handling via UPower events (handled by _sync override mostly,
        // but keeping UPower client for signal safety and device info)
        this._upClient = UPower.Client.new_full(null);
        this._upSignalId = this._upClient.connect('device-added', () => {
            resetBatteryCorrection();
            updateUI();
        });
        this._upSignalId2 = this._upClient.connect('device-removed', () => {
            updateUI();
        });

        // OVERRIDE GNOME SYSTEM INDICATOR SYNC (via sync.js)
        enableSyncOverride(this._settings, this.path);

        Logger.info('Batt-Watt enabled.');
    }

    disable() {
        Logger.info('Disabling Batt-Watt...');

        disableSyncOverride();

        if (this._settingsSignalId) {
            this._settings.disconnect(this._settingsSignalId);
            this._settingsSignalId = null;
        }

        this._settings = null;
        updateUI = null;

        if (this._timeoutId) {
            GLib.source_remove(this._timeoutId);
            this._timeoutId = null;
        }

        if (this._themeSignalId) {
            const themeContext = imports.gi.St.ThemeContext.get_for_stage(global.stage);
            themeContext.disconnect(this._themeSignalId);
            this._themeSignalId = null;
        }

        if (this._upClient) {
            this._upClient.disconnect(this._upSignalId);
            this._upClient.disconnect(this._upSignalId2);
            this._upClient = null;
        }

        destroyCircleIndicator();
        destroyPortraitIndicator();
        destroyLandscapeIndicator();
        resetPowerToggleStyles(Main.panel.statusArea.quickSettings?._system, true);
        restoreStockBattery();
        restoreLabel();
        resetBatteryCorrection();
        clearSvgCache();

        Logger.info('Batt-Watt disabled.');
    }

    _updateInterval(seconds) {
        if (this._timeoutId) {
            GLib.source_remove(this._timeoutId);
            this._timeoutId = null;
        }

        if (seconds > 0) {
            this._timeoutId = GLib.timeout_add_seconds(GLib.PRIORITY_DEFAULT, seconds, () => {
                this._updateBatteryVisibility();
                return GLib.SOURCE_CONTINUE;
            });
        }
    }

    // Removed _bindBattery as it is replaced by _overrideSync which hooks into GNOME's event loop directly.

    _getBattery() {
        // Use UPower client display device if available and appropriate
        if (this._upClient) {
            // display_device is often the composite battery
            const displayDev = this._upClient.display_device;
            if (displayDev && displayDev.kind === UPower.DeviceKind.BATTERY) {
                return displayDev;
            }

            // Fallback to iterating devices
            const devices = this._upClient.get_devices();
            for (let i = 0; i < devices.length; i++) {
                const device = devices[i];
                if (device.kind === UPower.DeviceKind.BATTERY) {
                    return device;
                }
            }
        }
        return null;
    }

    _updateBatteryVisibility() {
        if (!this._settings) return;

        // Prevent memory leaks by purging old SVG cache entries periodically
        purgeSvgCache();

        const proxy = this._getBattery();

        // Cache toggle styles on first run or update
        cachePowerToggleStyles(Main.panel.statusArea.quickSettings?._system);
        hideStockBattery();

        const extPath = this.path;

        ensureCircleIndicator(this._settings, extPath);

        // If "Show Battery Icon" is disabled, destroy it if it exists and return.
        if (!this._settings.get_boolean('showicon')) {
            destroyPortraitIndicator();
            destroyLandscapeIndicator();
        } else {
            // Logic continues: if showicon is TRUE, ensure it exists.
            const barOrientation = this._settings.get_string('bar-orientation') || 'portrait';
            if (barOrientation === 'landscape') {
                destroyPortraitIndicator();
                ensureLandscapeIndicator(this._settings, extPath);
            } else {
                destroyLandscapeIndicator();
                ensurePortraitIndicator(this._settings, extPath);
            }
        }

        if (proxy) {
            updateCircleIndicatorStatus(proxy, this._settings);
            updatePortraitIndicatorStatus(proxy, this._settings);
            updateLandscapeIndicatorStatus(proxy, this._settings);

            // Force the system indicator to sync immediately to reflect setting changes
            forceSync();
        } else {
            Logger.debug('No battery device found.');
        }
    }
}
