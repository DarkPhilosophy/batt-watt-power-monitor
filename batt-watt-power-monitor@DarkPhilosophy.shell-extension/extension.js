import {
    Extension,
    InjectionManager
} from 'resource:///org/gnome/shell/extensions/extension.js';

import { panel } from 'resource:///org/gnome/shell/ui/main.js';
import { Indicator } from 'resource:///org/gnome/shell/ui/status/system.js';
import Shell from 'gi://Shell';
import UPower from 'gi://UPowerGlib';

const BAT0 = "/sys/class/power_supply/BAT0/";
const BAT1 = "/sys/class/power_supply/BAT1/";
const BAT2 = "/sys/class/power_supply/BAT2/";

let batteryCorrection = null;

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

const createPowerToggleSyncOverride = function(settings) {
    return function() {
        console.log('[BatConsumptionWattmeter] Override called');
        // Do we have batteries or a UPS?
        this.visible = this._proxy.IsPresent;
        if (!this.visible) {
            return false;
        }

        batteryCorrection = getAutopath();
        const percentage = Math.round(this._proxy.Percentage) + '%';
        let state = this._proxy.State;
        const status = getStatus(batteryCorrection);

        // Check hide when charging
        if (settings.get_boolean("hidecharging") && status.includes('Charging')) {
            this.visible = false;
            return false;
        }

        // Check hide when full
        if (settings.get_boolean("hidefull") && state === UPower.DeviceState.FULLY_CHARGED) {
            this.visible = false;
            return false;
        }

        // Build display string
        let displayParts = [];

        // Add percentage if enabled
        if (settings.get_boolean("percentage")) {
            displayParts.push(percentage);
        }

        // Add time remaining if enabled
        if (settings.get_boolean("timeremaining")) {
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
        if (settings.get_boolean("showwatts")) {
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
            if (settings.get_boolean("percentagefull")) {
                this.title = percentage;
            } else {
                this.title = '∞';
            }
            this.visible = true;
            return true;
        }

        // Show battery always if we have content
        this.visible = true;

        // If nothing to display, show percentage at minimum
        if (displayParts.length === 0) {
            this.title = percentage;
        } else {
            this.title = displayParts.join(' ');
        }

        return true;
    };
};

export default class BatConsumptionWattmeter extends Extension {
    enable() {
        const buildDate = new Date().toISOString();
        console.log(`[BatConsumptionWattmeter] Extension enabled at ${buildDate}`);
        
        this._im = new InjectionManager();
        const settings = this.getSettings();

        this._im.overrideMethod(Indicator.prototype, '_sync', function(_sync) {
            return function() {
                const { powerToggle } = this._systemItem;
                const overrideFunc = createPowerToggleSyncOverride(settings);
                const hasOverride = overrideFunc.call(powerToggle);
                _sync.call(this);
                this._percentageLabel.visible = !hasOverride;
            };
        });

        this._syncToggle();
    }

    disable() {
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
