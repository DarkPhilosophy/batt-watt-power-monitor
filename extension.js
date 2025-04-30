import GLib from 'gi://GLib';
import GObject from 'gi://GObject';
import Gio from 'gi://Gio';


import Shell from 'gi://Shell';
import St from 'gi://St';
import UPower from 'gi://UPowerGlib';

import * as Main from 'resource:///org/gnome/shell/ui/main.js';
import * as PanelMenu from 'resource:///org/gnome/shell/ui/panelMenu.js';
import * as QuickSettings from 'resource:///org/gnome/shell/ui/quickSettings.js';
import * as SystemModule from 'resource:///org/gnome/shell/ui/status/system.js';

import { Extension } from 'resource:///org/gnome/shell/extensions/extension.js';

import { loadInterfaceXML } from 'resource:///org/gnome/shell/misc/fileUtils.js';

const DisplayDeviceInterface = loadInterfaceXML('org.freedesktop.UPower.Device');
const PowerManagerProxy = Gio.DBusProxy.makeProxyWrapper(DisplayDeviceInterface);

const BUS_NAME = 'org.freedesktop.UPower';
const OBJECT_PATH = '/org/freedesktop/UPower/devices/DisplayDevice';

const BAT0 = "/sys/class/power_supply/BAT0/";
const BAT1 = "/sys/class/power_supply/BAT1/";
const BAT2 = "/sys/class/power_supply/BAT2/";

function getAutopath() {
    let path = readFileSafely(BAT0 + "status", "none") === "none" ? readFileSafely(BAT1 + "status", "none") === "none" ? -1 : BAT1 : BAT0;
    let isTP = readFileSafely(path + "power_now", "none") === "none" ? false : true;
    return {
        'path': path,
        'isTP': isTP
    };
}

function getManualPath(batteryType) {
    console.log('GET MANUAL! ' + batteryType);
    let path = batteryType === 1 ? BAT0 : batteryType === 2 ? BAT1 : batteryType === 3 ? BAT2 : BAT0;
    let finalpath = readFileSafely(path + "status", "none") === "none" ? -1 : path;
    console.log('GET MANUAL! ' + finalpath);
    let isTP = readFileSafely(path + "power_now", "none") === "none" ? false : true;
    return {
        'path': finalpath,
        'isTP': isTP
    };
}

function _getValue(pathToFile) {
    const value = parseFloat(readFileSafely(pathToFile, -1));
    return value === -1 ? value : value / 1000000;
}

function readFileSafely(filePath, defaultValue) {
    try {
        return Shell.get_file_contents_utf8_sync(filePath);
    } catch (e) {
        console.log(`Cannot read file ${filePath}`, e);
    }
    return defaultValue;
}

/**
 * Indicator
 */
// In GNOME 45, the power indicator is part of the system indicator
const BaseIndicator = SystemModule.Indicator;

const BatIndicator = GObject.registerClass({
    GTypeName: 'BatIndicator',
},
    class BatIndicator extends BaseIndicator {
        _init(extension) {
            // Initialize correction before calling super to ensure it's available
            this.correction = getAutopath();
            this.bi_force_sync = null;
            this._extension = extension;
            this.settings = extension ? extension.getSettings() : null;

            // Call super after our initialization
            super._init();

            // Ensure correction is still defined after super._init()
            if (!this.correction) {
                console.error('Correction was undefined after super._init(), reinitializing');
                this.correction = getAutopath();
            }

            this._proxy = new PowerManagerProxy(Gio.DBus.system, BUS_NAME, OBJECT_PATH,
                (proxy, error) => {
                    if (error)
                        console.error(error.message);
                    else
                        this._proxy.connect('g-properties-changed', () => this._sync());
                    this._sync();
                });
        }

        // From https://github.com/mzur/gnome-shell-batime/blob/master/batime%40martin.zurowietz.de/extension.js
        _calculateTimeRemaining() {
            // Do we have batteries or a UPS?
            if (!this._proxy || !this._proxy.IsPresent) {
                return "";
            }

            let seconds = 0;

            if (this._proxy.State === UPower.DeviceState.CHARGING) {
                seconds = this._proxy.TimeToFull;
            } else if (this._proxy.State === UPower.DeviceState.DISCHARGING) {
                seconds = this._proxy.TimeToEmpty;
            }

            // This can happen in various cases.
            if (seconds === 0) {
                return "";
            }

            let time = Math.round(seconds / 60);
            let minutes = time % 60;
            let hours = Math.floor(time / 60);

            return _('%d\u2236%02d').format(hours, minutes);
        }

        _getStatus() {
            // Ensure correction is defined
            if (!this.correction || !this.correction["path"]) {
                console.error('Correction is undefined in _getStatus, reinitializing');
                this.correction = getAutopath();
                if (!this.correction || !this.correction["path"]) {
                    return "Unknown";
                }
            }
            return readFileSafely(this.correction["path"] + "status", "Unknown");
        }

        _getPower() {
            // Ensure correction is defined
            if (!this.correction || !this.correction["path"]) {
                console.error('Correction is undefined in _getPower, reinitializing');
                this.correction = getAutopath();
                if (!this.correction || !this.correction["path"]) {
                    return 0;
                }
            }

            const path = this.correction["path"];
            return this.correction['isTP'] === false ? _getValue(path + "current_now") * _getValue(path + "voltage_now") : _getValue(path + "power_now");
        }

        _getBatteryStatus() {
            // Ensure settings is defined
            if (!this.settings) {
                console.error('Settings is undefined in _getBatteryStatus');
                // Try to get settings if extension is available
                if (this._extension) {
                    this.settings = this._extension.getSettings();
                }
                // If still undefined, use default values
                if (!this.settings) {
                    const pct = this._proxy && this._proxy.Percentage ? this._proxy.Percentage + "%" : "";
                    return pct;
                }
            }

            // Ensure proxy is defined
            if (!this._proxy) {
                console.error('Proxy is undefined in _getBatteryStatus');
                return "";
            }

            const pct = this.settings.get_boolean("percentage") === true ? this._proxy.Percentage + "%" : "";
            const timeRemaining = this.settings.get_boolean("timeremaining") === true ? this._calculateTimeRemaining() : "";

            let batteryType = this.settings.get_int("battery");
            if (batteryType != 0) {
                this.correction = getManualPath(batteryType);
            }

            // Ensure correction is defined after potential manual update
            if (!this.correction) {
                console.error('Correction is undefined after batteryType check, reinitializing');
                this.correction = getAutopath();
                if (!this.correction) {
                    return "";
                }
            }

            const status = this._getStatus();

            const pctTimeRemainingStr = [pct, timeRemaining].filter(val => val !== "").join(' ');

            if (status.includes('Charging')) {
                return _("%s %s%sW").format(pctTimeRemainingStr, "+", this._meas());
            }
            if (status.includes('Discharging')) {
                return _("%s %s%sW").format(pctTimeRemainingStr, "-", this._meas());
            }
            if (status.includes('Unknown')) {
                return _("%s %s%s").format(pctTimeRemainingStr, "", "?");
            }

            return _("%s").format(this.settings.get_boolean("percentagefull") === true ? pct : "");
        }

        _sync() {
            // Ensure correction is defined before calling super
            if (!this.correction) {
                console.error('Correction is undefined in _sync, reinitializing');
                this.correction = getAutopath();
            }

            super._sync();

            // Ensure percentageLabel exists
            if (!this._percentageLabel) {
                console.error('_percentageLabel is undefined in _sync');
                return false;
            }

            //enabling battery percentage
            if (!this._percentageLabel.visible) {
                this._percentageLabel.show();
            }

            if (this.correction && this.correction["path"] != -1) {
                this._percentageLabel.clutter_text.set_text(this._getBatteryStatus());
            } else {
                console.log(`Error - Extension BATT_CONSUMPTION_WATTMETTER can't find battery!!!`);
                return false;
            }

            return true;
        }

        _meas() {
            const power = this._getPower();
            if (power < 0) {
                return 0;
            } else {
                let pStr = String(Math.round(power));
                return pStr.length == 1 ? "0" + pStr : pStr;
            }
        }

        _spawn() {
            // Ensure settings is defined
            if (!this.settings) {
                console.error('Settings is undefined in _spawn');
                // Try to get settings if extension is available
                if (this._extension) {
                    this.settings = this._extension.getSettings();
                }
                // If still undefined, use default value
                if (!this.settings) {
                    return;
                }
            }

            this.bi_force_sync = GLib.timeout_add(
                GLib.PRIORITY_DEFAULT,
                this.settings.get_string("interval") + "000",
                this._sync.bind(this));
        }

        _stop() {
            if (this.bi_force_sync) {
                GLib.source_remove(this.bi_force_sync);
                this.bi_force_sync = null;
            }
        }
    }
);

/**
 * Extension
 */
export default class BatConsumptionWattmeter extends Extension {
    enable() {
        // Create our indicator with the extension passed to the constructor
        this.customIndicator = new BatIndicator(this);
        this.customIndicator._spawn();

        // Find the power indicator in the quick settings
        this.statusArea = Main.panel.statusArea.quickSettings;

        // In GNOME 45, the system indicator contains the power functionality
        // We need to find the power indicator in the system indicator
        const systemIndicator = this.statusArea._system;

        if (systemIndicator) {
            // Store the original indicators container for later restoration
            this.originalParent = systemIndicator;

            // Create our indicator container
            this.indicators = this.customIndicator.indicators;

            // Add our indicator to the panel
            this.statusArea._indicators.add_child(this.indicators);

            // Hide the original power indicator
            systemIndicator.hide();
        } else {
            console.error('Could not find the system indicator in GNOME 45');
        }
    }

    disable() {
        if (this.customIndicator) {
            this.customIndicator._stop();

            // Remove our indicator
            if (this.indicators && this.indicators.get_parent()) {
                this.indicators.get_parent().remove_child(this.indicators);
            }

            // Show the original system indicator
            if (this.originalParent) {
                this.originalParent.show();
            }

            this.customIndicator = null;
            this.indicators = null;
            this.originalParent = null;
        }
    }
}