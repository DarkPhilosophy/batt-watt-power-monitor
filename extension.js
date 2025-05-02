import GLib from 'gi://GLib';
import GObject from 'gi://GObject';
import Gio from 'gi://Gio';


import Shell from 'gi://Shell';
import St from 'gi://St';
import UPower from 'gi://UPowerGlib';
import Clutter from 'gi://Clutter';

import * as Main from 'resource:///org/gnome/shell/ui/main.js';
import * as PanelMenu from 'resource:///org/gnome/shell/ui/panelMenu.js';
import * as QuickSettings from 'resource:///org/gnome/shell/ui/quickSettings.js';
import * as SystemModule from 'resource:///org/gnome/shell/ui/status/system.js';

import { Extension } from 'resource:///org/gnome/shell/extensions/extension.js';

import { loadInterfaceXML } from 'resource:///org/gnome/shell/misc/fileUtils.js';


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
        //console.log(`Cannot read file ${filePath}`, e);
    }
    return defaultValue;
}

/**
 * Custom Battery Indicator
 */
const CustomBatteryIndicator = GObject.registerClass(
    class CustomBatteryIndicator extends QuickSettings.SystemIndicator {
        _init(extension, powerManagementProxyWrapper) {
            super._init();

            this._extension = extension;
            this.settings = extension ? extension.getSettings() : null;
            this.correction = getAutopath();
            this.bi_force_sync = null;

            // Create the percentage label for the indicator
            this._percentageLabel = extension.label

            // Initialize the proxy
            console.log('Initializing power proxy...');
            this._proxy = new powerManagementProxyWrapper(Gio.DBus.system, BUS_NAME, OBJECT_PATH,
                (proxy, error) => {
                    if (error) {
                        console.error("Failed to initialize power proxy:", error.message);
                    } else {
                        console.log('Power proxy initialized successfully');
                        this._powerManagerWatcher = this._proxy.connect('g-properties-changed', () => this._sync());
                        this._sync();
                    }
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
                return "...";
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
            // Ensure correction is defined
            if (!this.correction) {
                console.error('Correction is undefined in _sync, reinitializing');
                this.correction = getAutopath();
            }

            // Ensure percentageLabel exists
            if (!this._percentageLabel) {
                console.error('_percentageLabel is undefined in _sync');
                return false;
            }

            if (this.correction && this.correction["path"] != -1) {
                const batteryStatus = this._getBatteryStatus();
                this._percentageLabel.set_text(batteryStatus);
            } else {
                console.log(`Error - Extension BATT_CONSUMPTION_WATTMETTER can't find battery!!!`);
                this._percentageLabel.set_text("No battery found");
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

        _destroy() {
            if (this.bi_force_sync) {
                GLib.source_remove(this.bi_force_sync);
                this.bi_force_sync = null;
            }
            if (this._proxy && this._powerManagerWatcher) {
                this._proxy.disconnect(this._powerManagerWatcher);
                this._proxy = null;
                this._powerManagerWatcher = null;
            }
            super.destroy()
        }
    }
);

/**
 * Extension
 */
export default class BatConsumptionWattmeter extends Extension {
    enable() {
        console.log('Enabling battery consumption wattmeter extension...');
        this.DisplayDeviceInterface = loadInterfaceXML('org.freedesktop.UPower.Device');
        this.PowerManagerProxy = Gio.DBusProxy.makeProxyWrapper(this.DisplayDeviceInterface);

        // Find and hide the default system battery indicator
        this.label = new St.Label({
            y_expand: true,
            y_align: Clutter.ActorAlign.CENTER,

        })
        this._systemLabel = this._replaceBatteryIndicator(this.label);

        // Create our indicator with the extension passed to the constructor
        this.indicator = new CustomBatteryIndicator(this, this.PowerManagerProxy);
        this.indicator._spawn();


        console.log('Extension enabled successfully');
    }

    _replaceBatteryIndicator(label) {
        // In GNOME 45, the battery indicator is part of the system indicator
        // We need to find it and hide it

        this.originalIndicators = [];

        // First, try to access the system indicator in quick settings
        const quickSettings = Main.panel.statusArea.quickSettings;
        if (quickSettings && quickSettings._system) {
            console.log('Found system quick settings, trying to hide battery indicator');

            // The system indicator itself
            const systemIndicator = quickSettings._system;

            // In GNOME 45, we need to look at the direct children of the systemIndicator
            const children = systemIndicator.get_children();
            console.log(`System indicatoradd_actor has ${children.length} children`);

            // The battery indicator might be one of these children
            for (let i = 0; i < children.length; i++) {
                const child = children[i];
                console.log(`Checking child ${i}: ${child.constructor.name}`);

                // Try to get child elements
                if (child.get_children) {
                    const subChildren = child.get_children();
                    for (let j = 0; j < subChildren.length; j++) {
                        const subChild = subChildren[j];
                        console.log(`Checking subchild ${j}: ${subChild.constructor.name}`);
                        if (subChild.constructor.name === "Clutter_Text") {
                            console.log('Default battery label found:', subChild);

                            // Hide the prior label
                            systemIndicator.remove_child(child);
                            systemIndicator.add_child(label);
                            return child;
                        }
                    }
                }
            }

        }
    }

    disable() {
        console.log('Disabling battery consumption wattmeter extension...');
        this._replaceBatteryIndicator(this._systemLabel);

        this.DisplayDeviceInterface = null;
        this.PowerManagerProxy = null;

        if (this._systemLabel) {
            this._systemLabel = null
        }
        if (this.label) {
            this.label.destroy();
            this.label = null;
        }

        // Remove our custom indicator
        if (this.indicator) {
            this.indicator._destroy();

            this.indicator = null;
        }

        console.log('Extension disabled successfully');
    }
}