import GLib from 'gi://GLib';
import GObject from 'gi://GObject';
import Shell from 'gi://Shell';
import St from 'gi://St';
import UPower from 'gi://UPowerGlib';

import * as Main from 'resource:///org/gnome/shell/ui/main.js';
import * as PanelMenu from 'resource:///org/gnome/shell/ui/panelMenu.js';

import { Extension } from 'resource:///org/gnome/shell/extensions/extension.js';

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
const BaseIndicator = Main.panel.statusArea.quickSettings._power.constructor;

const BatIndicator = GObject.registerClass({
    GTypeName: 'BatIndicator',
},
    class BatIndicator extends BaseIndicator {
        _init() {
            super._init();
            this.correction = getAutopath();
            this.bi_force_sync = null;
            this.settings = this._extension.getSettings();
        }

        // From https://github.com/mzur/gnome-shell-batime/blob/master/batime%40martin.zurowietz.de/extension.js
        _calculateTimeRemaining() {
            // Do we have batteries or a UPS?
            if (!this._proxy.IsPresent) {
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
            return readFileSafely(this.correction["path"] + "status", "Unknown");
        }

        _getPower() {
            const path = this.correction["path"];
            return this.correction['isTP'] === false ? _getValue(path + "current_now") * _getValue(path + "voltage_now") : _getValue(path + "power_now");
        }

        _getBatteryStatus() {
            const pct = this.settings.get_boolean("percentage") === true ? this._proxy.Percentage + "%" : "";
            const timeRemaining = this.settings.get_boolean("timeremaining") === true ? this._calculateTimeRemaining() : "";

            let batteryType = this.settings.get_int("battery");
            if (batteryType != 0) {
                this.correction = getManualPath(batteryType);
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
            super._sync();

            //enabling battery percentage
            if (!this._percentageLabel.visible) {
                this._percentageLabel.show();
            }

            if (this.correction["path"] != -1) {
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
            this.bi_force_sync = GLib.timeout_add(
                GLib.PRIORITY_DEFAULT,
                this.settings.get_string("interval") + "000",
                this._sync.bind(this));
        }

        _stop() {
            GLib.source_remove(this.bi_force_sync);
        }
    }
);

/**
 * Extension
 */
export default class BatConsumptionWattmeter extends Extension {
    enable() {
        this.customIndicator = new BatIndicator();
        this.customIndicator._extension = this;
        this.customIndicator._spawn();

        this.statusArea = Main.panel.statusArea.quickSettings;
        this.originalIndicator = this.statusArea._power;
        this.statusArea._indicators.replace_child(this.originalIndicator.indicators, this.customIndicator.indicators);
    }

    disable() {
        this.customIndicator._stop();
        this.statusArea._indicators.replace_child(this.customIndicator.indicators, this.originalIndicator.indicators);
        this.customIndicator = null;
    }
}