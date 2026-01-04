import {
    Extension,
    InjectionManager
} from 'resource:///org/gnome/shell/extensions/extension.js';

import { panel } from 'resource:///org/gnome/shell/ui/main.js';
import { Indicator } from 'resource:///org/gnome/shell/ui/status/system.js';
import Gio from 'gi://Gio';
import UPower from 'gi://UPowerGlib';

const BAT0 = "/sys/class/power_supply/BAT0/";
const BAT1 = "/sys/class/power_supply/BAT1/";
const BAT2 = "/sys/class/power_supply/BAT2/";

let batteryCorrection = null;
let lastOverrideTime = 0;
let overrideCallCount = 0;
const MAX_CALLS_PER_SECOND = 100;
// Force DEBUG on for investigation
let DEBUG = false;

// Callback to trigger UI update when async read finishes
let updateUI = null;

function logDebug(msg) {
    if (DEBUG) {
        console.log(`[BatConsumptionWattmeter] ${msg}`);
    }
}

const fileCache = new Map();
const pendingReads = new Set();

/**
 * Reads file content asynchronously to comply with EGO review guidelines.
 * Note: This prevents freezing the Shell UI but may cause a slight delay 
 * in wattage updates as the UI refreshes only after the file read completes.
 */
function readFileSafely(filePath, defaultValue) {
    // Get current cached value (or default)
    const currentVal = fileCache.has(filePath) ? fileCache.get(filePath) : defaultValue;

    // Always try to refresh in background if not already reading
    if (!pendingReads.has(filePath)) {
        if (DEBUG) console.log(`[BatConsumptionWattmeter] READING ASYNC: ${filePath}`);
        pendingReads.add(filePath);
        
        const file = Gio.File.new_for_path(filePath);
        file.load_contents_async(null, (source, res) => {
            try {
                const [ok, contents] = source.load_contents_finish(res);
                if (ok) {
                    const newValue = new TextDecoder('utf-8').decode(contents).trim();
                    if (DEBUG) console.log(`[BatConsumptionWattmeter] READ SUCCESS for ${filePath}: ${newValue}`);
                    
                    const oldValue = fileCache.get(filePath);
                    fileCache.set(filePath, newValue);
                    
                    // If value changed (or first read), trigger UI update
                    if (newValue !== oldValue && updateUI) {
                        if (DEBUG) console.log(`[BatConsumptionWattmeter] Value changed, triggering UI update`);
                        updateUI();
                    }
                }
            } catch (error) {
                if (DEBUG) console.log(`[BatConsumptionWattmeter] READ ERROR for ${filePath}: ${error.message}`);
            } finally {
                pendingReads.delete(filePath);
            }
        });
    }

    return currentVal;
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
    let val;
    if (correction['isTP'] === false) {
        val = getValue(path + "current_now") * getValue(path + "voltage_now");
    } else {
        val = getValue(path + "power_now");
    }
    
    if (DEBUG) {
        const energyNow = getValue(path + "energy_now");
        console.log(`[BatConsumptionWattmeter] Raw Power: ${val} W | Energy Now: ${energyNow} Wh`);
    }
    
    return val;
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

function formatWatts(power, settings) {
    // Hide if effectively zero (charging/discharging calculation pending)
    if (power <= 0.01 && power >= -0.01) {
        return "";
    }
    
    if (settings && settings.get_boolean("showdecimals")) {
         return Math.abs(power).toFixed(2);
    }
    
    // Default behavior: Round to integer
    return Math.round(Math.abs(power)).toString();
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
         // Safety check: prevent infinite loops
         const now = Date.now();
         if (now - lastOverrideTime < 1000) {
             overrideCallCount++;
             if (overrideCallCount > MAX_CALLS_PER_SECOND) {
                 logDebug(`SAFETY: Too many calls per second (${overrideCallCount}). Stopping override.`);
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
            const power = getPower(batteryCorrection);
            let wattStr = '';
            const formattedPower = formatWatts(power, settings);
            
            if (formattedPower !== "") {
                if (status.includes('Charging')) {
                    wattStr = '+' + formattedPower + 'W';
                } else if (status.includes('Discharging')) {
                    wattStr = '-' + formattedPower + 'W';
                } else if (status.includes('Unknown')) {
                    wattStr = '?';
                } else {
                    if (state === UPower.DeviceState.FULLY_CHARGED) {
                        wattStr = '∞';
                    }
                }
            }
            
            if (wattStr) {
                displayParts.push(wattStr);
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
     };
};

export default class BatConsumptionWattmeter extends Extension {
    enable() {
        const buildDate = new Date().toISOString();
        console.log(`\n[BatConsumptionWattmeter] ===== EXTENSION ENABLED =====`);
        console.log(`[BatConsumptionWattmeter] Build date: ${buildDate}`);
        
        this._im = new InjectionManager();
        
        // Set update callback for async reads
        updateUI = () => this._syncToggle();
        
        this._settings = this.getSettings();
        DEBUG = this._settings.get_boolean('debug');
        this._debugConnection = this._settings.connect('changed::debug', () => {
            DEBUG = this._settings.get_boolean('debug');
        });


        // Override _sync to set custom title and control visibility
         this._im.overrideMethod(Indicator.prototype, '_sync', function(_sync) {
             return function() {
                  const { powerToggle } = this._systemItem;
                  const overrideFunc = _powerToggleSyncOverride(this._extension._settings);
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
         const settingKeys = ['showicon', 'percentage', 'timeremaining', 'showwatts', 'showdecimals', 'hidecharging', 'hidefull', 'hideidle'];
         
         settingKeys.forEach(key => {
             const connection = this._settings.connect(`changed::${key}`, () => {
                 logDebug(`Setting changed: ${key}`);
                 this._updateBatteryVisibility(this._settings);
                 this._syncToggle();
             });
             this._settingsConnections.push(connection);
         });


        // Watch battery for property changes
        this._getBattery((proxy) => {
            this._batteryWatching = proxy.connect('g-properties-changed', () => {
                if (DEBUG) {
                    try {
                        console.log(`[BatConsumptionWattmeter] Event: g-properties-changed. Rate=${proxy.EnergyRate}, State=${proxy.State}`);
                    } catch(e) {
                         console.log(`[BatConsumptionWattmeter] Event: g-properties-changed (Error reading proxy: ${e.message})`);
                    }
                }
                 this._updateBatteryVisibility(this._settings);

            });
        });

         this._updateBatteryVisibility(this._settings);
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
                logDebug('Hiding battery - showicon disabled or no display options');
                powerToggle.hide();
                return;
            }

            // Check hide when charging
            const hideCharging = settings.get_boolean("hidecharging");
            const status = getStatus(getAutopath());
            if (hideCharging && status.includes('Charging')) {
                logDebug('Hiding battery - charging');
                powerToggle.hide();
                return;
            }

            // Check hide when full
            const hideFull = settings.get_boolean("hidefull");
            if (hideFull && proxy.State === UPower.DeviceState.FULLY_CHARGED) {
                logDebug('Hiding battery - full');
                powerToggle.hide();
                return;
            }

            // Check hide when idle
            const hideIdle = settings.get_boolean("hideidle");
            const isIdle = proxy.State !== UPower.DeviceState.CHARGING && proxy.State !== UPower.DeviceState.DISCHARGING;
            if (hideIdle && isIdle) {
                logDebug('Hiding battery - idle');
                powerToggle.hide();
                return;
            }

            // Show battery
            logDebug('Showing battery');
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
         if (this._settingsConnections && this._settings) {
             this._settingsConnections.forEach(connection => {
                 this._settings.disconnect(connection);
             });
             this._settingsConnections = [];
         }
         if (this._debugConnection && this._settings) {
             this._settings.disconnect(this._debugConnection);
             this._debugConnection = null;
         }

        
         this._im.clear();
         this._im = null;
         updateUI = null;
         this._syncToggle();
         
         // Null out references
         this._batteryWatching = null;
         this._settingsConnections = null;
         this._settings = null;
         batteryCorrection = null;

        lastOverrideTime = 0;
        overrideCallCount = 0;
        fileCache.clear();
        pendingReads.clear();
    }

    _syncToggle() {
        panel.statusArea.quickSettings._system._systemItem?.powerToggle?._sync();
    }
}