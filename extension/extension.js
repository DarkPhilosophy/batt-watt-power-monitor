import {
    Extension,
    InjectionManager,
    gettext as _
} from 'resource:///org/gnome/shell/extensions/extension.js';

import { panel } from 'resource:///org/gnome/shell/ui/main.js';
import { Indicator } from 'resource:///org/gnome/shell/ui/status/system.js';
import Gio from 'gi://Gio';
import UPower from 'gi://UPowerGlib';
import GObject from 'gi://GObject';
import St from 'gi://St';
import GLib from 'gi://GLib';
import Rsvg from 'gi://Rsvg';
import Cairo from 'cairo';

const BAT0 = '/sys/class/power_supply/BAT0/';
const BAT1 = '/sys/class/power_supply/BAT1/';
const BAT2 = '/sys/class/power_supply/BAT2/';

let batteryCorrection = null;
let lastOverrideTime = 0;
let overrideCallCount = 0;
const MAX_CALLS_PER_SECOND = 100;
// Force DEBUG on for investigation
let DEBUG = false;

// Callback to trigger UI update when async read finishes
let updateUI = null;

// Circular indicator state
let circleIndicator = null;
let circleIndicatorParent = null;
let circleIndicatorStockIcon = null;
let circleIndicatorWasVisible = null;

const CIRCLE_PANEL_SIZE_RATIO = 0.75;
const CIRCLE_MIN_SIZE = 18;
const CIRCLE_RING_OUTER_PADDING = 2;
const CIRCLE_RING_INNER_RATIO = 0.9;
const CIRCLE_ARC_START_ANGLE = -Math.PI / 2;
const CIRCLE_DEGREES_PER_PERCENT = 3.6;
const CIRCLE_FONT_SIZE_RATIO = 0.33;
const CIRCLE_CHARGING_ICON_SCALE = 1.7;
const CIRCLE_CHARGING_ICON_SPACING = 1.05;
const CIRCLE_LOW_BATTERY_THRESHOLD = 50;

function logDebug(msg) {
    if (DEBUG) {
        console.log(`[BatConsumptionWattmeter] ${msg}`);
    }
}

// Based on batteryIcon by slim8916 (MIT). Adapted and integrated here.
const CircleIndicator = GObject.registerClass(
class CircleIndicator extends St.DrawingArea {
    _init(status, extensionPath) {
        const size = Math.max(
            CIRCLE_MIN_SIZE,
            Math.floor(panel.height * CIRCLE_PANEL_SIZE_RATIO)
        );
        super._init({ width: size, height: size });

        this._status = status;
        this._extensionPath = extensionPath;
        this._color = this._calculateColor();
        this._repaintId = this.connect('repaint', this._onRepaint.bind(this));
        this.visible = true;
    }

    _calculateColor() {
        const percentage = this._status.percentage;
        let red = 0;
        let green = 0;
        const blue = 0;

        if (percentage <= CIRCLE_LOW_BATTERY_THRESHOLD) {
            red = 1;
            green = Math.max(0, percentage / CIRCLE_LOW_BATTERY_THRESHOLD);
        } else {
            green = 1;
            red = 1 - (percentage - CIRCLE_LOW_BATTERY_THRESHOLD) / CIRCLE_LOW_BATTERY_THRESHOLD;
        }

        return [red, green, blue];
    }

    _loadChargingSvg(red, green, blue) {
        try {
            const svgPath = `${this._extensionPath}/charging.svg`;
            const handle = Rsvg.Handle.new_from_file(svgPath);
            if (!handle) {
                return null;
            }

            const dimensions = handle.get_dimensions();
            const svgWidth = dimensions.width;
            const svgHeight = dimensions.height;

            const surface = new Cairo.ImageSurface(Cairo.Format.ARGB32, svgWidth, svgHeight);
            const context = new Cairo.Context(surface);
            handle.render_cairo(context);

            const tintSurface = new Cairo.ImageSurface(Cairo.Format.ARGB32, svgWidth, svgHeight);
            const tintContext = new Cairo.Context(tintSurface);
            tintContext.setSourceSurface(surface, 0, 0);
            tintContext.paint();
            tintContext.setOperator(Cairo.Operator.IN);
            tintContext.setSourceRGB(red, green, blue);
            tintContext.paint();

            return tintSurface;
        } catch (error) {
            logDebug(`Failed to load charging icon: ${error.message}`);
            return null;
        }
    }

    _drawChargingIcon(context, centerX, centerY, textExtents, red, green, blue) {
        const svgSurface = this._loadChargingSvg(red, green, blue);
        if (!svgSurface) {
            return centerX - textExtents.width / 2;
        }

        const svgHeight = svgSurface.getHeight();
        const svgWidth = svgSurface.getWidth();
        const scale = (textExtents.height * CIRCLE_CHARGING_ICON_SCALE) / svgHeight;
        const scaledWidth = svgWidth * scale;
        const scaledHeight = svgHeight * scale;

        const iconX = centerX - CIRCLE_CHARGING_ICON_SPACING * (textExtents.width + scaledWidth) / 2;
        const iconY = centerY - scaledHeight / 2;
        const textX = iconX + scaledWidth - 5;

        context.save();
        context.scale(scale, scale);
        context.setSourceSurface(svgSurface, iconX / scale, iconY / scale);
        context.paint();
        context.restore();

        return textX;
    }

    _drawBatteryIcon(context, centerX, centerY, width, height, red, green, blue) {
        const bodyWidth = width * 0.38;
        const bodyHeight = height * 0.45;
        const bodyX = centerX - bodyWidth / 2;
        const bodyY = centerY - bodyHeight / 2;
        const nubWidth = bodyWidth * 0.28;
        const nubHeight = bodyHeight * 0.18;
        const nubX = centerX - nubWidth / 2;
        const nubY = bodyY - nubHeight * 0.9;

        context.save();
        context.setSourceRGB(red, green, blue);
        context.rectangle(bodyX, bodyY, bodyWidth, bodyHeight);
        context.stroke();
        context.rectangle(nubX, nubY, nubWidth, nubHeight);
        context.stroke();
        context.restore();
    }

    _onRepaint(area) {
        const context = area.get_context();
        const [width, height] = area.get_surface_size();

        context.setSourceRGBA(0, 0, 0, 0);
        context.setOperator(Cairo.Operator.CLEAR);
        context.paint();
        context.setOperator(Cairo.Operator.OVER);

        const [red, green, blue] = this._color;
        context.setSourceRGB(red, green, blue);

        const centerX = width / 2;
        const centerY = height / 2;
        const outerRadius = Math.min(width, height) / 2 - CIRCLE_RING_OUTER_PADDING;
        const innerRadius = outerRadius * CIRCLE_RING_INNER_RATIO;

        const arcEndAngle = (270 - (100 - this._status.percentage) * CIRCLE_DEGREES_PER_PERCENT) * Math.PI / 180;

        context.arc(centerX, centerY, outerRadius, CIRCLE_ARC_START_ANGLE, arcEndAngle);
        context.arcNegative(centerX, centerY, innerRadius, arcEndAngle, CIRCLE_ARC_START_ANGLE);
        context.closePath();
        context.fill();

        if (this._status.showText) {
            context.selectFontFace('Sans', Cairo.FontSlant.NORMAL, Cairo.FontWeight.BOLD);
            context.setFontSize(Math.round(height * CIRCLE_FONT_SIZE_RATIO));

            const text = String(this._status.percentage);
            const textExtents = context.textExtents(text);
            let textX = centerX - textExtents.width / 2;
            const textY = centerY + textExtents.height / 2;

            if (this._status.isCharging) {
                textX = this._drawChargingIcon(context, centerX, centerY, textExtents, red, green, blue);
            }

            context.setSourceRGB(red, green, blue);
            context.moveTo(textX, textY);
            context.showText(text);
            context.stroke();
        } else {
            this._drawBatteryIcon(context, centerX, centerY, width, height, red, green, blue);
            if (this._status.isCharging) {
                const fallbackExtents = { width: width * 0.2, height: height * 0.2 };
                this._drawChargingIcon(context, centerX, centerY, fallbackExtents, red, green, blue);
            }
        }
    }

    update(status) {
        this._status = status;
        this._color = this._calculateColor();
        this.queue_repaint();
    }

    destroy() {
        if (this._repaintId) {
            this.disconnect(this._repaintId);
            this._repaintId = 0;
        }
        super.destroy();
    }
});

function circleIndicatorEnabled(settings) {
    return settings && settings.get_boolean('usecircleindicator');
}

function ensureCircleIndicator(settings, extensionPath) {
    if (!circleIndicatorEnabled(settings)) {
        destroyCircleIndicator();
        return;
    }

    if (circleIndicator) {
        return;
    }

    const system = panel.statusArea.quickSettings?._system;
    circleIndicatorStockIcon = system?._indicator ?? null;
    circleIndicatorParent = circleIndicatorStockIcon?.get_parent() ?? null;
    circleIndicator = new CircleIndicator({ percentage: 0, isCharging: false, showText: true }, extensionPath);

    if (circleIndicatorParent && circleIndicatorStockIcon) {
        circleIndicatorParent.insert_child_above(circleIndicator, circleIndicatorStockIcon);
        circleIndicatorWasVisible = circleIndicatorStockIcon.visible;
        GLib.idle_add(GLib.PRIORITY_DEFAULT, () => {
            circleIndicatorStockIcon?.hide();
            return GLib.SOURCE_REMOVE;
        });
    } else if (panel?._rightBox) {
        panel._rightBox.insert_child_at_index(circleIndicator, 0);
    }
}

function destroyCircleIndicator() {
    if (!circleIndicator) {
        return;
    }

    circleIndicator.destroy();
    circleIndicator = null;

    if (circleIndicatorStockIcon) {
        if (circleIndicatorWasVisible === false) {
            circleIndicatorStockIcon.hide();
        } else {
            circleIndicatorStockIcon.show();
        }
    }

    circleIndicatorParent = null;
    circleIndicatorStockIcon = null;
    circleIndicatorWasVisible = null;
}

function updateCircleIndicatorStatus(proxy, settings) {
    if (!circleIndicatorEnabled(settings) || !circleIndicator || !proxy) {
        return;
    }

    const percentage = Math.round(proxy.Percentage);
    const isCharging = proxy.State === UPower.DeviceState.CHARGING;
    const showText = settings.get_boolean('percentage');
    circleIndicator.update({ percentage, isCharging, showText });
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
        if (DEBUG) logDebug(`READING ASYNC: ${filePath}`);
        pendingReads.add(filePath);
        
        const file = Gio.File.new_for_path(filePath);
        file.load_contents_async(null, (source, res) => {
            try {
                const [ok, contents] = source.load_contents_finish(res);
                if (ok) {
                    const newValue = new TextDecoder('utf-8').decode(contents).trim();
                    if (DEBUG) logDebug(`READ SUCCESS for ${filePath}: ${newValue}`);
                    
                    const oldValue = fileCache.get(filePath);
                    fileCache.set(filePath, newValue);
                    
                    // If value changed (or first read), trigger UI update
                    if (newValue !== oldValue && updateUI) {
                        if (DEBUG) logDebug('Value changed, triggering UI update');
                        updateUI();
                    }
                }
            } catch (error) {
                if (DEBUG) logDebug(`READ ERROR for ${filePath}: ${error.message}`);
            } finally {
                pendingReads.delete(filePath);
            }
        });
    }

    return currentVal;
}

function getAutopath() {
    for (const path of [BAT0, BAT1, BAT2]) {
        if (readFileSafely(path + 'status', 'none') !== 'none') {
            const isTP = readFileSafely(path + 'power_now', 'none') !== 'none';
            return {
                path,
                isTP
            };
        }
    }
    return {
        'path': -1,
        'isTP': false
    };
}

function getValue(pathToFile) {
    const value = parseFloat(readFileSafely(pathToFile, -1));
    return value === -1 ? value : value / 1000000;
}

function getPower(correction) {
    if (!correction || !correction['path']) {
        correction = getAutopath();
        if (!correction || !correction['path']) {
            return 0;
        }
    }
    const path = correction['path'];
    let val;
    if (correction['isTP'] === false) {
        val = getValue(path + 'current_now') * getValue(path + 'voltage_now');
    } else {
        val = getValue(path + 'power_now');
    }
    
    if (DEBUG) {
        const energyNow = getValue(path + 'energy_now');
        console.log(`[BatConsumptionWattmeter] Raw Power: ${val} W | Energy Now: ${energyNow} Wh`);
    }
    
    return val;
}

function getStatus(correction) {
    if (!correction || !correction['path']) {
        correction = getAutopath();
        if (!correction || !correction['path']) {
            return 'Unknown';
        }
    }
    return readFileSafely(correction['path'] + 'status', 'Unknown');
}

function formatWatts(power, settings) {
    // Hide if effectively zero (charging/discharging calculation pending)
    if (power <= 0.01 && power >= -0.01) {
        return '';
    }
    
    if (settings && settings.get_boolean('showdecimals')) {
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

         // Add percentage if enabled and circular indicator is off
         const showPercentage = settings.get_boolean('percentage');
         const showPercentageText = showPercentage && !circleIndicatorEnabled(settings);
         if (showPercentageText) {
             displayParts.push(percentage);
         }

         // Add time remaining if enabled
         const showTimeRemaining = settings.get_boolean('timeremaining');
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
        const showWatts = settings.get_boolean('showwatts');
        if (showWatts) {
            const power = getPower(batteryCorrection);
            let wattStr = '';
            const formattedPower = formatWatts(power, settings);
            
            if (formattedPower !== '') {
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

        updateCircleIndicatorStatus(this._proxy, settings);


         // Handle fully charged without custom display
         if (state === UPower.DeviceState.FULLY_CHARGED && displayParts.length === 0) {
             this.title = '∞';
             return true;
         }

         // If nothing to display, check if percentage is enabled
         if (displayParts.length === 0) {
             if (circleIndicatorEnabled(settings)) {
                 this.title = '';
                 return true;
             }
             if (showPercentageText) {
                 this.title = percentage;
                 return true;
             } else {
                 return false;
             }
         } else {
             const title = displayParts.join(' ');
             this.title = circleIndicatorEnabled(settings) ? ` ${title}` : title;
             return true;
         }
     };
};

export default class BatConsumptionWattmeter extends Extension {
    enable() {
        const buildDate = new Date().toISOString();
        console.log('\n[BatConsumptionWattmeter] ===== EXTENSION ENABLED =====');
        console.log(`[BatConsumptionWattmeter] Build date: ${buildDate}`);
        
        this._im = new InjectionManager();
        
        // Set update callback for async reads
        updateUI = () => this._syncToggle();
        
        this._settings = this.getSettings();
        const settings = this._settings;
        DEBUG = settings.get_boolean('debug');
        this._debugConnection = this._settings.connect('changed::debug', () => {
            DEBUG = this._settings.get_boolean('debug');
        });

        ensureCircleIndicator(settings, this.path);

        // Override _sync to set custom title and control visibility
        this._im.overrideMethod(Indicator.prototype, '_sync', function(_sync) {
            return function() {
                _sync.call(this);

                const powerToggle = this._systemItem?.powerToggle;
                if (!powerToggle || !settings) {
                    return;
                }
                const overrideFunc = _powerToggleSyncOverride(settings);
                const hasOverride = overrideFunc.call(powerToggle);

                const showLabelText = settings.get_boolean('percentage')
                    || settings.get_boolean('timeremaining')
                    || settings.get_boolean('showwatts');
                if (!circleIndicatorEnabled(settings) && this._icon) {
                    this._icon.icon_name = 'battery-good-symbolic';
                }
                this.visible = hasOverride;
                if (this._percentageLabel) {
                    this._percentageLabel.visible = showLabelText && hasOverride;
                }
            };
        });

        // Listen for battery changes and update visibility
         this._batteryWatching = null;
         this._settingsConnections = [];
         const settingKeys = ['showicon', 'percentage', 'timeremaining', 'showwatts', 'showdecimals', 'hidecharging', 'hidefull', 'hideidle', 'usecircleindicator'];
         
         settingKeys.forEach(key => {
             const connection = this._settings.connect(`changed::${key}`, () => {
                 logDebug(`Setting changed: ${key}`);
                 ensureCircleIndicator(this._settings, this.path);
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
                 updateCircleIndicatorStatus(proxy, this._settings);
                 this._syncToggle();

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
            const showIcon = settings.get_boolean('showicon');
            const showPercentage = settings.get_boolean('percentage');
            const showTimeRemaining = settings.get_boolean('timeremaining');
            const showWatts = settings.get_boolean('showwatts');
            const showCircle = settings.get_boolean('usecircleindicator');
            let shouldShow = true;

            // Hide if show icon is disabled or all display options are disabled
            if (!showIcon || (!showPercentage && !showTimeRemaining && !showWatts && !showCircle)) {
                logDebug('Hiding battery - showicon disabled or no display options');
                shouldShow = false;
            }

            // Check hide when charging
            const hideCharging = settings.get_boolean('hidecharging');
            const status = getStatus(getAutopath());
            if (hideCharging && status.includes('Charging')) {
                logDebug('Hiding battery - charging');
                shouldShow = false;
            }

            // Check hide when full
            const hideFull = settings.get_boolean('hidefull');
            if (hideFull && proxy.State === UPower.DeviceState.FULLY_CHARGED) {
                logDebug('Hiding battery - full');
                shouldShow = false;
            }

            // Check hide when idle
            const hideIdle = settings.get_boolean('hideidle');
            const isIdle = proxy.State !== UPower.DeviceState.CHARGING && proxy.State !== UPower.DeviceState.DISCHARGING;
            if (hideIdle && isIdle) {
                logDebug('Hiding battery - idle');
                shouldShow = false;
            }

            if (shouldShow) {
                logDebug('Showing battery');
                powerToggle.show();
            } else {
                powerToggle.hide();
            }

            if (circleIndicator) {
                circleIndicator.visible = shouldShow;
            }
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
         destroyCircleIndicator();
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
        const system = panel.statusArea.quickSettings?._system;
        if (system?._sync) {
            system._sync();
            return;
        }
        system?._systemItem?.powerToggle?._sync();
    }
}
