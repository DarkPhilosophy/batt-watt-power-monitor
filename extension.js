import {
    Extension,
    InjectionManager
} from 'resource:///org/gnome/shell/extensions/extension.js';

import { panel } from 'resource:///org/gnome/shell/ui/main.js';
import { Indicator } from 'resource:///org/gnome/shell/ui/status/system.js';
import Shell from 'gi://Shell';
import UPower from 'gi://UPowerGlib';
import GLib from 'gi://GLib';

const BAT0 = "/sys/class/power_supply/BAT0/";
const BAT1 = "/sys/class/power_supply/BAT1/";
const BAT2 = "/sys/class/power_supply/BAT2/";

let batteryCorrection = null;
let lastOverrideTime = 0;
let overrideCallCount = 0;
const MAX_CALLS_PER_SECOND = 100;

function readFileSafely(filePath, defaultValue) {
    try {
        let content = Shell.get_file_contents_utf8_sync(filePath);
        return content.trim();
    } catch (e) {
        // File read error
    }
    return defaultValue;
}

function getAutopath() {
    let bat0_status = readFileSafely(BAT0 + "status", "none");
    let path = bat0_status === "none" ? readFileSafely(BAT1 + "status", "none") === "none" ? -1 : BAT1 : BAT0;
    let isTP = readFileSafely(path + "power_now", "none") === "none" ? false : true;
    return {
        'path': path,
        'isTP': isTP
    };
}

function getValue(pathToFile) {
    const value = parseFloat(readFileSafely(pathToFile, -1));
    return value === -1 ? value : value / 1000000;
}

function getPower(correction) {
    if (!correction || !correction["path"]) {
        correction = getAutopath();
        if (!correction || !correction["path"]) {
            return 0;
        }
    }
    const path = correction["path"];
    return correction['isTP'] === false ? getValue(path + "current_now") * getValue(path + "voltage_now") : getValue(path + "power_now");
}

function getStatus(correction) {
    if (!correction || !correction["path"]) {
        correction = getAutopath();
        if (!correction || !correction["path"]) {
            return "Unknown";
        }
    }
    return readFileSafely(correction["path"] + "status", "Unknown");
}

function formatWatts(power) {
    if (power < 0) {
        return "0";
    }
    let pStr = String(Math.round(power));
    return pStr.length == 1 ? "0" + pStr : pStr;
}

function formatTimeRemaining(seconds) {
    if (seconds <= 0) return null;
    
    let time = Math.round(seconds / 60);
    if (time <= 0) return null;
    
    let minutes = time % 60;
    let hours = Math.floor(time / 60);
    return _('%d\u2236%02d').format(hours, minutes);
}

const _powerToggleSyncOverride = function(settings) {
    return function() {
        try {
            // Safety check: prevent infinite loops
            const now = Date.now();
            if (now - lastOverrideTime < 1000) {
                overrideCallCount++;
                if (overrideCallCount > MAX_CALLS_PER_SECOND) {
                    console.error(`[BatConsumptionWattmeter] SAFETY: Too many calls per second (${overrideCallCount}). Stopping override.`);
                    return false;
                }
            } else {
                overrideCallCount = 0;
            }
            lastOverrideTime = now;

            // Only set title, don't touch visibility - that's handled separately
            if (!this._proxy.IsPresent) {
                return false;
            }

            batteryCorrection = getAutopath();
            const percentage = Math.round(this._proxy.Percentage) + '%';
            let state = this._proxy.State;
            const status = getStatus(batteryCorrection);

            // Build display string
            let displayParts = [];

            // Add percentage if enabled
            const showPercentage = settings.get_boolean("percentage");
            if (showPercentage) {
                displayParts.push(percentage);
            }

            // Add time remaining if enabled
            const showTimeRemaining = settings.get_boolean("timeremaining");
            if (showTimeRemaining) {
                let seconds = 0;
                if (state === UPower.DeviceState.CHARGING) {
                    seconds = this._proxy.TimeToFull;
                } else if (state === UPower.DeviceState.DISCHARGING) {
                    seconds = this._proxy.TimeToEmpty;
                }
                
                let timeStr = formatTimeRemaining(seconds);
                if (timeStr) {
                    displayParts.push(timeStr);
                }
            }

            // Add watts if enabled
            const showWatts = settings.get_boolean("showwatts");
            if (showWatts) {
                try {
                    const power = getPower(batteryCorrection);
                    let wattStr = '';
                    if (status.includes('Charging')) {
                        wattStr = '+' + formatWatts(power) + 'W';
                    } else if (status.includes('Discharging')) {
                        wattStr = '-' + formatWatts(power) + 'W';
                    } else if (status.includes('Unknown')) {
                        wattStr = '?';
                    } else {
                        if (state === UPower.DeviceState.FULLY_CHARGED) {
                            wattStr = '∞';
                        }
                    }
                    
                    if (wattStr) {
                        displayParts.push(wattStr);
                    }
                } catch (e) {
                    console.log('Error getting watts:', e.message);
                }
            }

            // Handle fully charged without custom display
            if (state === UPower.DeviceState.FULLY_CHARGED && displayParts.length === 0) {
                this.title = '∞';
                return true;
            }

            // If nothing to display, check if percentage is enabled
            if (displayParts.length === 0) {
                if (showPercentage) {
                    this.title = percentage;
                    return true;
                } else {
                    return false;
                }
            } else {
                this.title = displayParts.join(' ');
                return true;
            }
        } catch (error) {
            console.error(`[BatConsumptionWattmeter] ERROR in override: ${error.message}`);
            console.error(error.stack);
            return false;
        }
    };
};

export default class BatConsumptionWattmeter extends Extension {
    enable() {
        const buildDate = new Date().toISOString();
        console.log(`\n[BatConsumptionWattmeter] ===== EXTENSION ENABLED =====`);
        console.log(`[BatConsumptionWattmeter] Build date: ${buildDate}`);
        
        this._im = new InjectionManager();
        const settings = this.getSettings();
        
        console.log(`[BatConsumptionWattmeter] Settings loaded:`);
        console.log(`  - showicon: ${settings.get_boolean("showicon")}`);
        console.log(`  - percentage: ${settings.get_boolean("percentage")}`);
        console.log(`  - timeremaining: ${settings.get_boolean("timeremaining")}`);
        console.log(`  - showwatts: ${settings.get_boolean("showwatts")}`);
        console.log(`  - hidecharging: ${settings.get_boolean("hidecharging")}`);
        console.log(`  - hidefull: ${settings.get_boolean("hidefull")}`);
        console.log(`  - hideidle: ${settings.get_boolean("hideidle")}`);

        // Override _sync to set custom title and control visibility
        this._im.overrideMethod(Indicator.prototype, '_sync', function(_sync) {
            return function() {
                const { powerToggle } = this._systemItem;
                const overrideFunc = _powerToggleSyncOverride(settings);
                const hasOverride = overrideFunc.call(powerToggle);
                _sync.call(this);
                this._icon.icon_name = 'battery-good-symbolic';
                this.visible = hasOverride;
                this._percentageLabel.visible = hasOverride;
            };
        });

        // Listen for battery changes and update visibility
        this._batteryWatching = null;
        this._settingsConnections = [];
        const settingKeys = ['showicon', 'percentage', 'timeremaining', 'showwatts', 'hidecharging', 'hidefull', 'hideidle'];
        
        settingKeys.forEach(key => {
            const connection = settings.connect(`changed::${key}`, () => {
                console.log(`[BatConsumptionWattmeter] Setting changed: ${key}`);
                this._updateBatteryVisibility(settings);
                this._syncToggle();
            });
            this._settingsConnections.push(connection);
        });

        // Watch battery for property changes
        this._getBattery((proxy) => {
            this._batteryWatching = proxy.connect('g-properties-changed', () => {
                this._updateBatteryVisibility(settings);
            });
        });

        this._updateBatteryVisibility(settings);
        this._syncToggle();
    }

    _getBattery(callback) {
        let system = panel.statusArea.quickSettings._system;
        if (system && system._systemItem._powerToggle) {
            callback(system._systemItem._powerToggle._proxy, system);
        }
    }

    _updateBatteryVisibility(settings) {
        this._getBattery((proxy, powerToggle) => {
            const showIcon = settings.get_boolean("showicon");
            const showPercentage = settings.get_boolean("percentage");
            const showTimeRemaining = settings.get_boolean("timeremaining");
            const showWatts = settings.get_boolean("showwatts");

            // Hide if show icon is disabled or all display options are disabled
            if (!showIcon || (!showPercentage && !showTimeRemaining && !showWatts)) {
                console.log('[BatConsumptionWattmeter] Hiding battery - showicon disabled or no display options');
                powerToggle.hide();
                return;
            }

            // Check hide when charging
            const hideCharging = settings.get_boolean("hidecharging");
            const status = getStatus(getAutopath());
            if (hideCharging && status.includes('Charging')) {
                console.log('[BatConsumptionWattmeter] Hiding battery - charging');
                powerToggle.hide();
                return;
            }

            // Check hide when full
            const hideFull = settings.get_boolean("hidefull");
            if (hideFull && proxy.State === UPower.DeviceState.FULLY_CHARGED) {
                console.log('[BatConsumptionWattmeter] Hiding battery - full');
                powerToggle.hide();
                return;
            }

            // Check hide when idle
            const hideIdle = settings.get_boolean("hideidle");
            const isIdle = proxy.State !== UPower.DeviceState.CHARGING && proxy.State !== UPower.DeviceState.DISCHARGING;
            if (hideIdle && isIdle) {
                console.log('[BatConsumptionWattmeter] Hiding battery - idle');
                powerToggle.hide();
                return;
            }

            // Show battery
            console.log('[BatConsumptionWattmeter] Showing battery');
            powerToggle.show();
        });
    }

    disable() {
        // Disconnect battery watching
        if (this._batteryWatching !== null) {
            this._getBattery((proxy) => {
                proxy.disconnect(this._batteryWatching);
            });
            this._batteryWatching = null;
        }

        // Disconnect settings listeners
        if (this._settingsConnections) {
            const settings = this.getSettings();
            this._settingsConnections.forEach(connection => {
                settings.disconnect(connection);
            });
            this._settingsConnections = [];
        }
        
        this._im.clear();
        this._im = null;
        this._syncToggle();
    }

    _syncToggle() {
        try {
            if (panel.statusArea?.quickSettings?._system?._systemItem?.powerToggle) {
                panel.statusArea.quickSettings._system._systemItem.powerToggle._sync();
            }
        } catch (e) {
            console.log('Error syncing battery indicator:', e);
        }
    }
}
