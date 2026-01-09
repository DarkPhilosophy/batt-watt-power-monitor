import {
    Extension,
    InjectionManager,
    gettext as _
} from 'resource:///org/gnome/shell/extensions/extension.js';

import {panel} from 'resource:///org/gnome/shell/ui/main.js';
import {Indicator} from 'resource:///org/gnome/shell/ui/status/system.js';
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

// Professional logging utility
const LogLevel = {
    VERBOSE: 0,
    DEBUG: 1,
    INFO: 2,
    WARN: 3,
    ERROR: 4,
};

const LOG_LEVEL_NAMES = {
    [LogLevel.VERBOSE]: '[VERBOSE]',
    [LogLevel.DEBUG]: '[DEBUG]',
    [LogLevel.INFO]: '[INFO]',
    [LogLevel.WARN]: '[WARN]',
    [LogLevel.ERROR]: '[ERROR]',
};

let currentLogLevel = LogLevel.WARN;
let currentLogFilePath = null;
let logFileInitialized = false;
let logToFileEnabled = false;

// Circular indicator state
let circleIndicator = null;
let circleIndicatorParent = null;
let circleIndicatorStockIcon = null;
let circleIndicatorWasVisible = null;
let batteryIndicator = null;
let batteryIndicatorParent = null;
let batteryIndicatorStockIcon = null;
let batteryIndicatorWasVisible = null;
let shouldShowIndicator = true;


const CIRCLE_MIN_SIZE = 12;
const CIRCLE_RING_OUTER_PADDING = 2;
const CIRCLE_RING_INNER_RATIO = 0.9;
const CIRCLE_ARC_START_ANGLE = -Math.PI / 2;
const CIRCLE_DEGREES_PER_PERCENT = 3.6;
const CIRCLE_FONT_SIZE_RATIO = 0.33;
const CIRCLE_CHARGING_ICON_SCALE = 1.7;
const CIRCLE_CHARGING_ICON_SPACING = 1.05;
const CIRCLE_LOW_BATTERY_THRESHOLD = 50;
const CIRCLE_SIZE_SCALE = 1.48;
const BATTERY_MIN_SIZE = 12;


/**
 * Calculate ring color based on battery percentage.
 * @param {number} percentage - Battery percentage (0-100)
 * @returns {number[]} RGB values [red, green, blue] each 0-1
 */
function getRingColor(percentage) {
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

/**
 * Generate CSS style string for label based on battery percentage.
 * @param {number} percentage - Battery percentage (0-100)
 * @param {boolean} useColor - Whether to apply color styling
 * @returns {string} CSS style string
 */
function getLabelStyleFromPercentage(percentage, useColor) {
    if (!useColor || percentage === null || percentage === undefined || Number.isNaN(percentage))
        return '';


    const [red, green, blue] = getRingColor(Math.round(percentage));
    const r = Math.round(red * 255);
    const g = Math.round(green * 255);
    const b = Math.round(blue * 255);
    return `color: rgb(${r}, ${g}, ${b});`;
}

/**
 * Extract foreground color from GNOME theme component.
 * @param {Object} component - ST widget component
 * @returns {Object} Color object with red, green, blue properties
 */
function getForegroundColor(component) {
    try {
        const themeNode = component.get_theme_node();
        return themeNode.get_foreground_color();
    } catch (error) {
        return {red: 255, green: 255, blue: 255};
    }
}

/**
 * Check if device is in a charging state.
 * @param {Object} proxy - UPower proxy object
 * @param {string} status - Status string from sysfs
 * @returns {boolean} True if device is charging
 */
function isChargingState(proxy, status) {
    const state = proxy?.State;
    return state === UPower.DeviceState.CHARGING ||
        state === UPower.DeviceState.PENDING_CHARGE ||
        (status && status.includes('Charging'));
}

/**
 * Get configured circle indicator size from settings.
 * @param {Object} settings - GSettings object
 * @returns {number} Circle size in pixels
 */
function getCircleSize(settings) {
    const configured = settings?.get_int('circlesize') ?? 0;
    const raw = Math.max(CIRCLE_MIN_SIZE_USER, configured || CIRCLE_MIN_SIZE_USER);
    return Math.round(raw * CIRCLE_SIZE_SCALE);
}

/**
 * Get configured battery indicator width from settings.
 * @param {Object} settings - GSettings object
 * @returns {number} Battery width in pixels
 */
function getBatteryWidth(settings) {
    const configured = settings?.get_int('batterysize') ?? 0;
    return Math.max(BATTERY_MIN_SIZE, configured || BATTERY_MIN_SIZE);
}

/**
 * Get configured battery indicator height from settings.
 * @param {Object} settings - GSettings object
 * @returns {number} Battery height in pixels
 */
function getBatteryHeight(settings) {
    const configured = settings?.get_int('batteryheight') ?? 0;
    return Math.max(BATTERY_MIN_SIZE, configured || BATTERY_MIN_SIZE);
}

/**
 * Reset all GNOME power toggle styling to defaults.
 */
function resetPowerToggleStyles() {
    const system = panel.statusArea.quickSettings?._system;
    const powerToggle = system?._systemItem?.powerToggle;
    if (!powerToggle)
        return;


    powerToggle.set_style?.('');
    powerToggle._title?.set_style?.('');
    powerToggle._titleLabel?.set_style?.('');
    powerToggle._percentageLabel?.set_style?.('');
    powerToggle._icon?.set_style?.('');
    powerToggle._titleLabel?.set_text?.('');
    powerToggle._percentageLabel?.set_text?.('');
    if (typeof powerToggle.title !== 'undefined')
        powerToggle.title = '';

    if (powerToggle._icon)
        powerToggle._icon.visible = true;


    const indicator = system?._indicator;
    indicator?._percentageLabel?.set_style?.('');
    indicator?._percentageLabel?.set_text?.('');
    indicator?._icon?.set_style?.('');
    indicator?._percentageLabel?.set_text?.('');
    indicator?._percentageLabel?.set_style?.('');
}

/**
 * Log debug-level message.
 * @param {string} msg - Message to log
 */
function logDebug(msg) {
    logMessage(msg, LogLevel.DEBUG);
}

/**
 * Log info-level message.
 * @param {string} msg - Message to log
 */
function logInfo(msg) {
    logMessage(msg, LogLevel.INFO);
}

/**
 * Log warning-level message.
 * @param {string} msg - Message to log
 */
function logWarn(msg) {
    logMessage(msg, LogLevel.WARN);
}

/**
 * Log error-level message.
 * @param {string} msg - Message to log
 */
function logError(msg) {
    logMessage(msg, LogLevel.ERROR);
}

/**
 * Update global variables from settings.
 * @param {Object} settings - GSettings object
 */
function updateGlobalsFromSettings(settings) {
    DEBUG = settings.get_boolean('debug');
    currentLogLevel = settings.get_int('loglevel');
    logToFileEnabled = settings.get_boolean('logtofile');
    currentLogFilePath = settings.get_string('logfilepath');

    // Reset file init flag if path changed (simple approach) or just let it handle it
    if (logFileInitialized && currentLogFilePath !== settings.get_string('logfilepath'))
        logFileInitialized = false;
}

/**
 * Log message with specified level.
 * @param {string} msg - Message to log
 * @param {number} level - Log level (default: LogLevel.DEBUG)
 */
function logMessage(msg, level = LogLevel.DEBUG) {
    if (!DEBUG)
        return;

    if (level < currentLogLevel)
        return;


    const timestamp = new Date().toISOString();
    const prefix = `${timestamp} ${LOG_LEVEL_NAMES[level]} [Battery Power Monitor]`;
    const output = `${prefix} ${msg}`;

    if (level >= LogLevel.WARN)
        logError(output);
    else
        log(output);


    if (logToFileEnabled && currentLogFilePath)
        appendLogLine(currentLogFilePath, output);
}

/**
 * Resolve log file path from settings with environment variable expansion.
 * @param {Object} settings - GSettings object
 * @returns {string} Full path to log file
 */
function resolveLogFilePath(settings) {
    const configured = settings.get_string('logfilepath').trim();
    if (configured.length === 0)
        return `${GLib.get_user_cache_dir()}/batt-watt-power-monitor.log`;

    if (configured.startsWith('/'))
        return configured;

    return `${GLib.get_home_dir()}/${configured}`;
}

/**
 * Ensure log directory exists, create if needed.
 * @param {string} path - Full path to log file
 */
function ensureLogDirectory(path) {
    const file = Gio.File.new_for_path(path);
    const parent = file.get_parent();
    if (parent && !parent.query_exists(null)) {
        try {
            parent.make_directory_with_parents(null);
        } catch (error) {
            logError(`[Battery Power Monitor] Failed to create log dir: ${error.message}`);
        }
    }
}

/**
 * Rotate log file, keeping one backup.
 * @param {string} path - Full path to log file
 */
function rotateLogFile(path) {
    const file = Gio.File.new_for_path(path);
    if (!file.query_exists(null))
        return;


    const oldFile = Gio.File.new_for_path(`${path}.old`);
    if (oldFile.query_exists(null)) {
        try {
            oldFile.delete(null);
        } catch (error) {
            logError(`[Battery Power Monitor] Failed to delete old log: ${error.message}`);
        }
    }

    try {
        file.move(oldFile, Gio.FileCopyFlags.OVERWRITE, null, null);
    } catch (error) {
        logError(`[Battery Power Monitor] Failed to rotate log: ${error.message}`);
    }
}

/**
 * Initialize log file with rotation.
 * @param {string} path - Full path to log file
 */
function initLogFile(path) {
    if (logFileInitialized && path === currentLogFilePath)
        return;

    ensureLogDirectory(path);
    rotateLogFile(path);
    logFileInitialized = true;
}

/**
 * Append line to log file.
 * @param {string} path - Full path to log file
 * @param {string} line - Line to append
 */
function appendLogLine(path, line) {
    try {
        ensureLogDirectory(path);
        const file = Gio.File.new_for_path(path);
        const output = `${line}\n`;
        const stream = file.append_to(Gio.FileCreateFlags.NONE, null);
        stream.write_all(output, null);
        stream.close(null);
    } catch (error) {
        logError(`Failed to write log: ${error.message}`);
    }
}

// Shared SVG loading functions for both indicators
/**
 * Load and tint charging bolt SVG icon.
 * @param {string} extensionPath - Path to extension directory
 * @param {number} red - Red component (0-1)
 * @param {number} green - Green component (0-1)
 * @param {number} blue - Blue component (0-1)
 * @returns {Object} Cairo ImageSurface with tinted SVG or null on error
 */
function loadChargingSvg(extensionPath, red, green, blue) {
    try {
        const svgPath = `${extensionPath}/bolt.svg`;
        logDebug(`Loading bolt SVG from: ${svgPath}, color RGB(${red}, ${green}, ${blue})`);
        const handle = Rsvg.Handle.new_from_file(svgPath);
        if (!handle) {
            logDebug('Failed to create SVG handle');
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
        logError(`Failed to load charging icon: ${error.message}`);
        return null;
    }
}

/**
 * Load charging bolt stroke SVG.
 * @param {string} extensionPath - Path to extension directory
 * @returns {Object} Cairo ImageSurface or null on error
 */
function _loadChargingStrokeSvg(extensionPath) {
    try {
        const svgPath = `${extensionPath}/bolt_stroke.svg`;
        const handle = Rsvg.Handle.new_from_file(svgPath);
        if (!handle)
            return null;


        const dimensions = handle.get_dimensions();
        const svgWidth = dimensions.width;
        const svgHeight = dimensions.height;

        const surface = new Cairo.ImageSurface(Cairo.Format.ARGB32, svgWidth, svgHeight);
        const context = new Cairo.Context(surface);
        context.setSourceRGBA(0, 0, 0, 0);
        context.setOperator(Cairo.Operator.CLEAR);
        context.paint();
        context.setOperator(Cairo.Operator.OVER);
        handle.render_cairo(context);

        return surface;
    } catch (error) {
        logDebug(`Failed to load charging stroke icon: ${error.message}`);
        return null;
    }
}

// Shared function to draw battery icon
/**
 * Draw battery icon using Cairo.
 * @param {Object} context - Cairo context
 * @param {number} centerX - X coordinate of center
 * @param {number} centerY - Y coordinate of center
 * @param {number} width - Icon width in pixels
 * @param {number} height - Icon height in pixels
 * @param {number} percentage - Battery percentage (0-100)
 * @param {number} red - Red component (0-1)
 * @param {number} green - Green component (0-1)
 * @param {number} blue - Blue component (0-1)
 * @param {number} bodyWidthRatio - Ratio of body width to total width (default: 0.42)
 * @param {number} bodyHeightRatio - Ratio of body height to total height (default: 0.5)
 * @param {boolean} showText - Whether to show percentage text (default: false)
 */
function drawBatteryIcon(context, centerX, centerY, width, height, percentage, red, green, blue, bodyWidthRatio = 0.42, bodyHeightRatio = 0.5, showText = false) {
    const bodyWidth = width * bodyWidthRatio;
    const bodyHeight = height * bodyHeightRatio;
    const bodyX = centerX - bodyWidth / 2;
    const bodyY = centerY - bodyHeight / 2;
    const nubWidth = bodyWidth * 0.28;
    const nubHeight = bodyHeight * 0.18;
    const nubX = centerX - nubWidth / 2;
    const nubY = bodyY - nubHeight * 0.9;

    context.save();
    context.setSourceRGB(red, green, blue);
    context.setLineWidth(1.2);
    context.rectangle(bodyX, bodyY, bodyWidth, bodyHeight);
    context.stroke();
    context.rectangle(nubX, nubY, nubWidth, nubHeight);
    context.stroke();

    const pct = Math.max(0, Math.min(100, Math.round(percentage)));
    const fillHeight = bodyHeight * (pct / 100);
    const fillY = bodyY + (bodyHeight - fillHeight);
    context.rectangle(bodyX + 1.5, fillY + 1.5, bodyWidth - 3, Math.max(0, fillHeight - 3));
    context.fill();

    if (showText) {
        logDebug(`drawBatteryIcon: rendering text, pct=${pct}, centerX=${centerX}, centerY=${centerY}`);
        context.selectFontFace('Sans', Cairo.FontSlant.NORMAL, Cairo.FontWeight.BOLD);
        context.setFontSize(Math.round(height * 0.28));
        const text = String(pct);
        const textExtents = context.textExtents(text);
        const textX = centerX - textExtents.width / 2;
        const textY = centerY + textExtents.height / 2;
        logDebug(`drawBatteryIcon: text="${text}", textX=${textX}, textY=${textY}, fontSize=${Math.round(height * 0.28)}`);
        context.setSourceRGB(red, green, blue);
        context.moveTo(textX, textY);
        context.showText(text);
        context.stroke();
    }

    context.restore();
}

// Shared function to draw SVG bolt icon
/**
 * Draw charging bolt icon using Cairo.
 * @param {Object} context - Cairo context
 * @param {string} extensionPath - Path to extension directory
 * @param {number} centerX - X coordinate of center
 * @param {number} centerY - Y coordinate of center
 * @param {number} boltHeight - Height of bolt icon in pixels
 * @param {number} red - Red component (0-1)
 * @param {number} green - Green component (0-1)
 * @param {number} blue - Blue component (0-1)
 */
function drawBoltIcon(context, extensionPath, centerX, centerY, boltHeight, red, green, blue) {
    const svgSurface = loadChargingSvg(extensionPath, red, green, blue);
    if (!svgSurface)
        return;


    const svgHeight = svgSurface.getHeight();
    const svgWidth = svgSurface.getWidth();
    const scale = boltHeight / svgHeight;
    const scaledWidth = svgWidth * scale;
    const boltX = centerX - scaledWidth / 2;
    const boltY = centerY - boltHeight / 2;

    context.save();
    context.scale(scale, scale);
    context.setSourceSurface(svgSurface, boltX / scale, boltY / scale);
    context.paint();
    context.restore();

    const strokeSurface = _loadChargingStrokeSvg(extensionPath);
    if (strokeSurface) {
        context.save();
        context.scale(scale, scale);
        context.setSourceSurface(strokeSurface, boltX / scale, boltY / scale);
        context.paint();
        context.restore();
    }
}

// Based on batteryIcon by slim8916 (MIT). Adapted and integrated here.
const CircleIndicator = GObject.registerClass(
    class CircleIndicator extends St.DrawingArea {
        _init(status, extensionPath) {
            const size = status?.size ?? CIRCLE_MIN_SIZE;
            super._init({width: size, height: size});

            this._status = status;
            this._extensionPath = extensionPath;
            this._color = this._calculateColor();
            this._repaintId = this.connect('repaint', this._onRepaint.bind(this));
            this.visible = true;
        }

        _calculateColor() {
            if (!this._status.useColor) {
                const fg = getForegroundColor(this);
                return [fg.red / 255, fg.green / 255, fg.blue / 255];
            }
            return getRingColor(this._status.percentage);
        }



        _drawChargingIcon(context, centerX, centerY, textExtents, red, green, blue) {
            logDebug(`_drawChargingIcon called with RGB(${red}, ${green}, ${blue})`);
            const svgSurface = loadChargingSvg(this._extensionPath, red, green, blue);
            if (!svgSurface) {
                logDebug('SVG surface is null, returning');
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

            /* const strokeSurface = _loadChargingStrokeSvg(this._extensionPath);
            if (strokeSurface) {
                context.save();
                context.scale(scale, scale);
                context.setSourceSurface(strokeSurface, iconX / scale, iconY / scale);
                context.paint();
                context.restore();
            }*/

            return textX;
        }

        _drawBatteryIcon(context, centerX, centerY, width, height, red, green, blue) {
            drawBatteryIcon(context, centerX, centerY, width, height,
                this._status.percentage, red, green, blue);

            if (this._status.isCharging || this._status.forceBolt) {
                const boltHeight = height * 0.85;
                drawBoltIcon(context, this._extensionPath, centerX, centerY, boltHeight, red, green, blue);
            }
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

                if (this._status.isCharging || this._status.forceBolt)
                    textX = this._drawChargingIcon(context, centerX, centerY, textExtents, red, green, blue);


                context.setSourceRGB(red, green, blue);
                context.moveTo(textX, textY);
                context.showText(text);
                context.setLineWidth(Math.max(1, Math.round(height * 0.05)));
                context.setSourceRGB(0, 0, 0);
                context.stroke();
            } else {
                const iconWidth = innerRadius * 1.95;
                const iconHeight = innerRadius * 2.2;
                this._drawBatteryIcon(context, centerX, centerY, iconWidth, iconHeight, red, green, blue);
            }
        }

        update(status) {
            logDebug(`BatteryIndicator.update: width=${status.width}, batW=${status.batteryWidth}`);
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

const BatteryIndicator = GObject.registerClass(
    class BatteryIndicator extends St.DrawingArea {
        _init(status) {
            const width = status?.width ?? BATTERY_MIN_SIZE;
            const height = status?.height ?? BATTERY_MIN_SIZE;
            super._init({width, height});
            this.set_size(width, height);
            this.set_width(width);
            this.set_height(height);
            this.set_style(`width: ${width}px; height: ${height}px; min-width: ${width}px; min-height: ${height}px;`);
            this.queue_relayout();

            this._status = status;
            this._extensionPath = status.extensionPath;
            this._color = this._calculateColor();
            this._repaintId = this.connect('repaint', this._onRepaint.bind(this));
            this.visible = true;
        }

        vfunc_get_preferred_width(_forHeight) {
            const width = this._status?.width ?? BATTERY_MIN_SIZE;
            return [width, width];
        }

        vfunc_get_preferred_height(_forWidth) {
            const height = this._status?.height ?? BATTERY_MIN_SIZE;
            return [height, height];
        }

        _calculateColor() {
            if (!this._status.useColor) {
                const fg = getForegroundColor(this);
                return [fg.red / 255, fg.green / 255, fg.blue / 255];
            }
            return getRingColor(this._status.percentage);
        }

        _onRepaint(area) {
            const context = area.get_context();
            const [width, height] = area.get_surface_size();
            logDebug(`_onRepaint: surfW=${width}, statusBatW=${this._status.batteryWidth}`);

            const desiredHeight = this._status.height ?? height;

            const drawHeight = Math.min(height, desiredHeight);


            context.setSourceRGBA(0, 0, 0, 0);
            context.setOperator(Cairo.Operator.CLEAR);
            context.paint();
            context.setOperator(Cairo.Operator.OVER);

            const [red, green, blue] = this._color;

            const centerX = width / 2;
            const centerY = height / 2;
            // Flexible Layout Logic
            // We want to fit [Bolt] [Gap] [Battery] into drawWidth


            const iconHeight = drawHeight * 0.9;

            // Flexible Layout Logic
            // We want to fit [Bolt] [Gap] [Battery] into drawWidth
            let boltWidth = 0;
            let boltHeight = 0;
            let boltScale = 0;
            let svgSurface = null;


            // Pre-calculate Bolt dimensions if needed
            if (this._status.isCharging || this._status.forceBolt) {
                svgSurface = loadChargingSvg(this._extensionPath, red, green, blue);
                if (svgSurface) {
                    const svgHeight = svgSurface.getHeight();
                    const svgWidth = svgSurface.getWidth();
                    boltHeight = iconHeight * 0.75; // Use max available height for bolt
                    boltScale = boltHeight / svgHeight;
                    boltWidth = svgWidth * boltScale;
                }
            }

            // Calculate Battey dimensions
            // Use explicit battery width from status (passed from update/init)
            let rawBatteryW = this._status.batteryWidth;

            if (rawBatteryW === undefined)
                rawBatteryW = this._status?.width ?? width;


            // Apply 0.9 scale factor consistent with iconHeight (padding)
            const batteryDrawWidth = rawBatteryW * 0.9;

            // OVERLAY LAYOUT: No compression. Battery determines width.

            // Center the BATTERY BODY only. Bolt is an overlay on the left.
            // Center the BATTERY BODY only. Bolt is an overlay on the left.

            // Draw Battery Body (First)
            const batteryCenterX = centerX; // Battery is centered
            // Note: passing batteryDrawWidth as layout width
            drawBatteryIcon(context, batteryCenterX, centerY, batteryDrawWidth, iconHeight,
                this._status.percentage, red, green, blue, 0.7, 0.75, false);

            // Draw Bolt (Second - Overlay Badge)
            if (boltWidth > 0 && svgSurface) {
                // Align to left of battery body stroke (ratio 0.7)
                const bodyWidth = batteryDrawWidth * 0.7;
                const iconX = (centerX - bodyWidth / 2) - 2;
                const iconY = centerY - boltHeight / 2;

                context.save();
                context.scale(boltScale, boltScale);

                // 1. Draw Simulated Stroke (Black Bolt with offsets)
                // Load black bolt (using 0,0,0 RGB)
                // Note: ideally cache this interaction
                const blackSurface = loadChargingSvg(this._extensionPath, 0, 0, 0);

                if (blackSurface) {
                    // Loop -2 to 2 for stroke (matching text logic)
                    // Divide offsets by scale to ensure screen-pixel thickness
                    const step = 1 / boltScale; // 1 screen pixel
                    // User requested loop -2 to 2 (thick stroke)
                    for (let dx = -2; dx <= 2; dx++) {
                        for (let dy = -2; dy <= 2; dy++) {
                            if (dx !== 0 || dy !== 0) {
                                // Draw black surface at offset
                                context.setSourceSurface(blackSurface, (iconX / boltScale) + (dx * step), (iconY / boltScale) + (dy * step));
                                context.paint();
                            }
                        }
                    }
                }

                // 2. Draw Colored Bolt
                context.setSourceSurface(svgSurface, iconX / boltScale, iconY / boltScale);
                context.paint();

                context.restore();
            }

            // Draw Text (Centered in Battery)
            if (this._status.showText) {
                context.selectFontFace('Sans', Cairo.FontSlant.NORMAL, Cairo.FontWeight.BOLD);
                context.setFontSize(Math.round(height * 0.28));

                const text = String(this._status.percentage);
                const textExtents = context.textExtents(text);
                const textX = batteryCenterX - textExtents.width / 2;
                const textY = centerY + textExtents.height / 2;

                // Draw text with black outline
                context.setSourceRGB(0, 0, 0);
                for (let dx = -2; dx <= 2; dx++) {
                    for (let dy = -2; dy <= 2; dy++) {
                        if (dx !== 0 || dy !== 0) {
                            context.moveTo(textX + dx, textY + dy);
                            context.showText(text);
                        }
                    }
                }

                context.setSourceRGB(red, green, blue);
                context.moveTo(textX, textY);
                context.showText(text);
                context.fill();
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



/**
 * Ensure circle indicator exists and is properly configured.
 * @param {Object} settings - GSettings object
 * @param {string} extensionPath - Path to extension directory
 */
function ensureCircleIndicator(settings, extensionPath) {
    if (!settings.get_boolean('usecircleindicator')) {
        destroyCircleIndicator();
        return;
    }

    if (circleIndicator) {
        const desiredSize = getCircleSize(settings);
        if (circleIndicator.width !== desiredSize || circleIndicator.height !== desiredSize)
            destroyCircleIndicator();
        else
            return;
    }

    destroyBatteryIndicator();
    const system = panel.statusArea.quickSettings?._system;
    circleIndicatorStockIcon = system?._indicator ?? null;
    circleIndicatorParent = circleIndicatorStockIcon?.get_parent() ?? null;
    circleIndicator = new CircleIndicator({
        percentage: 0,
        isCharging: false,
        showText: true,
        useColor: settings.get_boolean('showcolored'),
        forceBolt: settings.get_boolean('forcebolt'),
        size: getCircleSize(settings),
    }, extensionPath);

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

/**
 * Destroy circle indicator and restore stock icon.
 */
function destroyCircleIndicator() {
    if (!circleIndicator)
        return;


    circleIndicator.destroy();
    circleIndicator = null;

    if (circleIndicatorStockIcon) {
        if (circleIndicatorWasVisible === false)
            circleIndicatorStockIcon.hide();
        else
            circleIndicatorStockIcon.show();
    }

    circleIndicatorParent = null;
    circleIndicatorStockIcon = null;
    circleIndicatorWasVisible = null;
}

/**
 * Update circle indicator with current battery status.
 * @param {Object} proxy - UPower proxy object
 * @param {Object} settings - GSettings object
 */
function updateCircleIndicatorStatus(proxy, settings) {
    if (!settings.get_boolean('usecircleindicator') || !circleIndicator || !proxy)
        return;


    const percentage = Math.round(proxy.Percentage);
    const status = getStatus(getAutopath());
    const isCharging = isChargingState(proxy, status) || settings.get_boolean('forcebolt');
    const showText = settings.get_boolean('percentage') && !settings.get_boolean('showpercentageoutside');
    const useColor = settings.get_boolean('showcolored');
    const forceBolt = settings.get_boolean('forcebolt');
    logDebug(`Circle status: state=${proxy.State} status=${status} charging=${isCharging} pct=${percentage}`);
    circleIndicator.update({percentage, isCharging, showText, useColor, forceBolt});
}

/**
 * Check if battery indicator should be shown.
 * @param {Object} settings - GSettings object
 * @returns {boolean} True if battery indicator is enabled
 */
function batteryIndicatorEnabled(settings) {
    return settings && settings.get_boolean('showicon') && !settings.get_boolean('usecircleindicator');
}

/**
 * Ensure battery indicator exists and is properly configured.
 * @param {Object} settings - GSettings object
 * @param {string} extensionPath - Path to extension directory
 */
function ensureBatteryIndicator(settings, extensionPath) {
    if (!batteryIndicatorEnabled(settings)) {
        destroyBatteryIndicator();
        return;
    }

    if (batteryIndicator) {
        const desiredWidth = getBatteryWidth(settings);
        const desiredHeight = getBatteryHeight(settings);
        batteryIndicator.set_style(`width: ${desiredWidth}px; height: ${desiredHeight}px; min-width: ${desiredWidth}px; min-height: ${desiredHeight}px;`);
        batteryIndicator.queue_relayout();
        batteryIndicator.update({
            percentage: batteryIndicator._status?.percentage ?? 0,
            isCharging: batteryIndicator._status?.isCharging ?? false,
            showText: batteryIndicator._status?.showText ?? false,
            useColor: batteryIndicator._status?.useColor ?? false,
            extensionPath: batteryIndicator._extensionPath,
            width: desiredWidth,
            height: desiredHeight,
            batteryWidth: desiredWidth,
            settings, // Pass settings for direct access
        });
        return;
    }

    const system = panel.statusArea.quickSettings?._system;
    batteryIndicatorStockIcon = system?._indicator ?? null;
    batteryIndicatorParent = batteryIndicatorStockIcon?.get_parent() ?? null;
    const batteryW = getBatteryWidth(settings);
    batteryIndicator = new BatteryIndicator({
        percentage: 0,
        isCharging: false,
        showText: false,
        useColor: settings.get_boolean('showcolored'),
        forceBolt: settings.get_boolean('forcebolt'),
        width: batteryW,
        batteryWidth: batteryW,
        settings, // Pass settings for direct access
        extensionPath,
    });

    if (batteryIndicatorParent && batteryIndicatorStockIcon) {
        batteryIndicatorParent.insert_child_above(batteryIndicator, batteryIndicatorStockIcon);
        batteryIndicatorWasVisible = batteryIndicatorStockIcon.visible;
        GLib.idle_add(GLib.PRIORITY_DEFAULT, () => {
            batteryIndicatorStockIcon?.hide();
            return GLib.SOURCE_REMOVE;
        });
    } else if (panel?._rightBox) {
        panel._rightBox.insert_child_at_index(batteryIndicator, 0);
    }
}

/**
 * Destroy battery indicator and restore stock icon.
 */
function destroyBatteryIndicator() {
    if (!batteryIndicator)
        return;


    batteryIndicator.destroy();
    batteryIndicator = null;

    if (batteryIndicatorStockIcon) {
        if (batteryIndicatorWasVisible === false)
            batteryIndicatorStockIcon.hide();
        else
            batteryIndicatorStockIcon.show();
    }

    batteryIndicatorParent = null;
    batteryIndicatorStockIcon = null;
    batteryIndicatorWasVisible = null;
}

/**
 * Update battery indicator with current battery status.
 * @param {Object} proxy - UPower proxy object
 * @param {Object} settings - GSettings object
 */
function updateBatteryIndicatorStatus(proxy, settings) {
    if (!batteryIndicatorEnabled(settings) || !batteryIndicator || !proxy)
        return;


    const percentage = Math.round(proxy.Percentage);
    const showText = settings.get_boolean('percentage') && !settings.get_boolean('showpercentageoutside');
    const status = getStatus(getAutopath());
    const isCharging = isChargingState(proxy, status) || settings.get_boolean('forcebolt');
    const useColor = settings.get_boolean('showcolored');
    const forceBolt = settings.get_boolean('forcebolt');
    logDebug(`Bar status: state=${proxy.State} status=${status} charging=${isCharging} pct=${percentage}`);

    const batteryW = getBatteryWidth(settings);
    const height = getBatteryHeight(settings);
    // STRICT WIDTH: No expansion. Bolt shares space or compresses battery (Sibling Layout).
    const desiredWidth = batteryW;

    batteryIndicator.set_style(`width: ${desiredWidth}px; height: ${height}px; min-width: ${desiredWidth}px; min-height: ${height}px;`);
    batteryIndicator.queue_relayout();
    batteryIndicator.update({
        percentage,
        useColor,
        showText,
        isCharging,
        forceBolt,
        width: desiredWidth,
        height,
        batteryWidth: batteryW, // Explicit width of battery body
    });
}

const fileCache = new Map();
const pendingReads = new Set();

/**
 * Reads file content asynchronously to comply with EGO review guidelines.
 * Note: This prevents freezing the Shell UI but may cause a slight delay
 * in wattage updates as the UI refreshes only after the file read completes.
 *
 * @param {string} filePath - Full path to file to read
 * @param {string} defaultValue - Default value if file cannot be read
 * @returns {string} Cached value or defaultValue
 */
function readFileSafely(filePath, defaultValue) {
    // Get current cached value (or default)
    const currentVal = fileCache.has(filePath) ? fileCache.get(filePath) : defaultValue;

    // Always try to refresh in background if not already reading
    if (!pendingReads.has(filePath)) {
        logDebug(`READING ASYNC: ${filePath}`);
        pendingReads.add(filePath);

        const file = Gio.File.new_for_path(filePath);
        file.load_contents_async(null, (source, res) => {
            try {
                const [ok, contents] = source.load_contents_finish(res);
                if (ok) {
                    const newValue = new TextDecoder('utf-8').decode(contents).trim();
                    logDebug(`READ SUCCESS for ${filePath}: ${newValue}`);

                    const oldValue = fileCache.get(filePath);
                    fileCache.set(filePath, newValue);

                    // If value changed (or first read), trigger UI update
                    if (newValue !== oldValue && updateUI) {
                        logDebug('Value changed, triggering UI update');
                        updateUI();
                    }
                }
            } catch (error) {
                logDebug(`READ ERROR for ${filePath}: ${error.message}`);
            } finally {
                pendingReads.delete(filePath);
            }
        });
    }

    return currentVal;
}

/**
 * Auto-detect battery path from available sysfs power supply entries.
 * @returns {Object} Object with path and isTP (True Power) flag
 */
function getAutopath() {
    for (const path of [BAT0, BAT1, BAT2]) {
        if (readFileSafely(`${path}status`, 'none') !== 'none') {
            const isTP = readFileSafely(`${path}power_now`, 'none') !== 'none';
            return {
                path,
                isTP,
            };
        }
    }
    return {
        'path': -1,
        'isTP': false,
    };
}

/**
 * Read numeric value from sysfs file and convert from µ to base unit.
 * @param {string} pathToFile - Full path to sysfs file
 * @returns {number} Converted value in base unit
 */
function getValue(pathToFile) {
    const value = parseFloat(readFileSafely(pathToFile, -1));
    return value === -1 ? value : value / 1000000;
}

/**
 * Find object key by value.
 * @param {Object} obj - Object to search
 * @param {*} value - Value to find
 * @returns {string} Key name or 'Unknown' if not found
 */
function getObjectKey(obj, value) {
    for (const key in obj) {
        if (obj[key] === value)
            return key;
    }
    return 'Unknown';
}

/**
 * Read power consumption from sysfs battery files.
 * @param {Object} correction - Battery path correction object from getAutopath()
 * @returns {number} Power in watts
 */
function getPower(correction) {
    if (!correction || !correction['path']) {
        correction = getAutopath();
        if (!correction || !correction['path'])
            return 0;
    }
    const path = correction['path'];
    let val;
    if (correction['isTP'] === false)
        val = getValue(`${path}current_now`) * getValue(`${path}voltage_now`);
    else
        val = getValue(`${path}power_now`);


    {
        const energyNow = getValue(`${path}energy_now`);
        logDebug(`Raw Power: ${val} W | Energy Now: ${energyNow} Wh`);
    }

    return val;
}

/**
 * Read battery status from sysfs.
 * @param {Object} correction - Battery path correction object from getAutopath()
 * @returns {string} Status string (Charging, Discharging, etc.)
 */
function getStatus(correction) {
    if (!correction || !correction['path']) {
        correction = getAutopath();
        if (!correction || !correction['path'])
            return 'Unknown';
    }
    return readFileSafely(`${correction['path']}status`, 'Unknown');
}

/**
 * Format power value as string with optional decimals.
 * @param {number} power - Power in watts
 * @param {Object} settings - GSettings object
 * @returns {string} Formatted power string or empty if near zero
 */
function formatWatts(power, settings) {
    // Hide if effectively zero (charging/discharging calculation pending)
    if (power <= 0.01 && power >= -0.01)
        return '';


    if (settings && settings.get_boolean('showdecimals'))
        return Math.abs(power).toFixed(2);


    // Default behavior: Round to integer
    return Math.round(Math.abs(power)).toString();
}

/**
 * Format remaining time as HH∶MM string.
 * @param {number} seconds - Remaining time in seconds
 * @returns {string|null} Formatted time string or null if invalid
 */
function formatTimeRemaining(seconds) {
    if (seconds <= 0)
        return null;

    const time = Math.round(seconds / 60);
    if (time <= 0)
        return null;

    const minutes = time % 60;
    const hours = Math.floor(time / 60);
    return _('%d\u2236%02d').format(hours, minutes);
}

const _powerToggleSyncOverride = function (settings) {
    return function () {
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
        if (!this._proxy.IsPresent)
            return false;


        batteryCorrection = getAutopath();
        const percentage = `${Math.round(this._proxy.Percentage)}%`;
        const state = this._proxy.State;
        const status = getStatus(batteryCorrection);

        // Build display string
        const displayParts = [];

        // Add percentage if enabled and circular indicator is off
        const showPercentage = settings.get_boolean('percentage');
        const showPercentageOutside = settings.get_boolean('showpercentageoutside') && showPercentage;
        const showPercentageText = showPercentageOutside;
        if (showPercentageText)
            displayParts.push(percentage);


        // Add time remaining if enabled
        const showTimeRemaining = settings.get_boolean('timeremaining');
        if (showTimeRemaining) {
            let seconds = 0;
            if (state === UPower.DeviceState.CHARGING)
                seconds = this._proxy.TimeToFull;
            else if (state === UPower.DeviceState.DISCHARGING)
                seconds = this._proxy.TimeToEmpty;


            const timeStr = formatTimeRemaining(seconds);
            if (timeStr)
                displayParts.push(timeStr);
        }

        // Add watts if enabled
        const showWatts = settings.get_boolean('showwatts');
        if (showWatts) {
            const power = getPower(batteryCorrection);
            let wattStr = '';
            const formattedPower = formatWatts(power, settings);

            if (formattedPower !== '') {
                if (status.includes('Charging'))
                    wattStr = `+${formattedPower}W`;
                else if (status.includes('Discharging'))
                    wattStr = `-${formattedPower}W`;
                else if (status.includes('Unknown'))
                    wattStr = '?';
                else if (state === UPower.DeviceState.FULLY_CHARGED)
                    wattStr = '∞';
            }

            if (wattStr)
                displayParts.push(wattStr);
        }

        updateCircleIndicatorStatus(this._proxy, settings);


        // Handle fully charged without custom display
        if (state === UPower.DeviceState.FULLY_CHARGED && displayParts.length === 0) {
            if (showPercentageOutside && showPercentage) {
                this.title = percentage;
                return true;
            }
            return false;
        }

        // If nothing to display, keep icon visible when enabled
        if (displayParts.length === 0) {
            if (showPercentageText) {
                this.title = percentage;
                return true;
            }

            const showIcon = settings.get_boolean('showicon');
            const showCircle = settings.get_boolean('usecircleindicator');
            if (showIcon || showCircle) {
                this.title = '';
                return true;
            }

            return false;
        } else {
            const title = displayParts.join(' ');
            this.title = settings.get_boolean('usecircleindicator') ? ` ${title}` : title;
            return true;
        }
    };
};

export default class BatteryPowerMonitor extends Extension {
    enable() {
        const buildDate = new Date().toISOString();
        this._im = new InjectionManager();

        // Set update callback for async reads
        updateUI = () => this._syncToggle();

        this._settings = this.getSettings();
        const settings = this._settings;
        const updateLogSettings = () => {
            DEBUG = settings.get_boolean('debug');
            if (!DEBUG) {
                currentLogLevel = LogLevel.WARN;
                currentLogFilePath = null;
                logFileInitialized = false;
                logToFileEnabled = false;
                return;
            }

            const selected = settings.get_int('loglevel');
            const normalized = Math.max(LogLevel.VERBOSE, Math.min(LogLevel.ERROR, selected));
            currentLogLevel = normalized;
            logToFileEnabled = settings.get_boolean('logtofile');
            if (logToFileEnabled) {
                currentLogFilePath = resolveLogFilePath(settings);
                initLogFile(currentLogFilePath);
            } else {
                currentLogFilePath = null;
                logFileInitialized = false;
            }
        };


        logInfo('\n[Battery Power Monitor] ===== EXTENSION ENABLED =====');
        logInfo(`[Battery Power Monitor] Build date: ${buildDate}`);

        updateLogSettings();
        this._debugConnection = this._settings.connect('changed::debug', updateLogSettings);
        this._logLevelConnection = this._settings.connect('changed::loglevel', updateLogSettings);
        this._logPathConnection = this._settings.connect('changed::logfilepath', updateLogSettings);
        this._logToFileConnection = this._settings.connect('changed::logtofile', updateLogSettings);

        ensureCircleIndicator(settings, this.path);
        ensureBatteryIndicator(settings, this.path);

        // Override _sync to set custom title and control visibility
        this._im.overrideMethod(Indicator.prototype, '_sync', _sync => {
            return function () {
                _sync.call(this);

                const powerToggle = this._systemItem?.powerToggle;
                if (!powerToggle || !settings)
                    return;

                const overrideFunc = _powerToggleSyncOverride(settings);
                const hasOverride = overrideFunc.call(powerToggle);

                const showLabelText = (settings.get_boolean('showpercentageoutside') && settings.get_boolean('percentage')) ||
                    settings.get_boolean('timeremaining') ||
                    settings.get_boolean('showwatts');
                const showIcon = settings.get_boolean('showicon');
                const showCircle = settings.get_boolean('usecircleindicator');
                const showStockIcon = showIcon && !showCircle && !batteryIndicator;
                const percentageValue = this._proxy?.Percentage ?? powerToggle?._proxy?.Percentage;
                const labelStyle = getLabelStyleFromPercentage(
                    percentageValue,
                    settings.get_boolean('showcolored')
                );
                if (this._icon) {
                    this._icon.visible = showStockIcon;
                    if (showStockIcon)
                        this._icon.icon_name = 'battery-good-symbolic';
                }
                if (powerToggle?.set_style)
                    powerToggle.set_style(labelStyle);

                powerToggle?._title?.set_style?.(labelStyle);
                powerToggle?._titleLabel?.set_style?.(labelStyle);
                this.visible = hasOverride && shouldShowIndicator;
                if (this._percentageLabel) {
                    this._percentageLabel.visible = showLabelText && hasOverride && shouldShowIndicator;
                    this._percentageLabel.set_style(labelStyle);
                }
            };
        });

        // Listen for battery changes and update visibility
        // Listen for battery changes and update visibility
        this._batteryWatching = null;
        this._refreshTimeoutId = null;
        this._settingsConnections = [];
        const settingKeys = [
            'showicon', 'batterysize', 'batteryheight', 'circlesize',
            'percentage', 'showpercentageoutside', 'timeremaining',
            'showwatts', 'showdecimals', 'hidecharging', 'hidefull', 'hideidle',
            'usecircleindicator', 'showcolored', 'forcebolt',
            'interval', 'debug', 'loglevel', 'logtofile', 'logfilepath',
        ];

        // Initial sync of globals
        updateGlobalsFromSettings(this._settings);
        this._updateInterval(this._settings);

        settingKeys.forEach(key => {
            const connection = this._settings.connect(`changed::${key}`, () => {
                logDebug(`Setting changed: ${key}`);

                // Update globals if debug settings changed
                if (['debug', 'loglevel', 'logtofile', 'logfilepath'].includes(key))
                    updateGlobalsFromSettings(this._settings);


                // Update interval if interval changed
                if (key === 'interval')
                    this._updateInterval(this._settings);


                ensureCircleIndicator(this._settings, this.path);
                ensureBatteryIndicator(this._settings, this.path);
                this._updateBatteryVisibility(this._settings);
                this._getBattery(proxy => {
                    updateCircleIndicatorStatus(proxy, this._settings);
                    updateBatteryIndicatorStatus(proxy, this._settings);
                });
                this._syncToggle();
            });
            this._settingsConnections.push(connection);
        });


        // Watch battery for property changes
        this._getBattery(proxy => {
            this._batteryWatching = proxy.connect('g-properties-changed', () => {
                {
                    try {
                        logDebug(`Event: g-properties-changed. Rate=${proxy.EnergyRate}, State=${proxy.State}`);
                    } catch (e) {
                        logWarn(`Event: g-properties-changed (Error reading proxy: ${e.message})`);
                    }
                }
                this._updateBatteryVisibility(this._settings);
                updateCircleIndicatorStatus(proxy, this._settings);
                updateBatteryIndicatorStatus(proxy, this._settings);
                this._syncToggle();
            });
        });

        this._updateBatteryVisibility(this._settings);
        this._getBattery(proxy => {
            updateBatteryIndicatorStatus(proxy, this._settings);
        });
        this._syncToggle();
    }

    _getBattery(callback) {
        const system = panel.statusArea.quickSettings._system;
        if (system && system._systemItem._powerToggle)
            callback(system._systemItem._powerToggle._proxy, system);
        else
            logWarn('Failed to find system power indicator proxy');
    }

    _updateBatteryVisibility(settings) {
        this._getBattery((proxy, powerToggle) => {
            const showIcon = settings.get_boolean('showicon');
            const showPercentage = settings.get_boolean('percentage');
            const showPercentageOutside = settings.get_boolean('showpercentageoutside') && showPercentage;
            const showTimeRemaining = settings.get_boolean('timeremaining');
            const showWatts = settings.get_boolean('showwatts');
            const showCircle = settings.get_boolean('usecircleindicator');
            const showLabelText = showPercentageOutside || showTimeRemaining || showWatts;
            const effectiveCircle = showCircle && showIcon;
            const effectiveIcon = showIcon && !showCircle;
            let shouldShow = true;

            // Hide if nothing would be visible
            if (!showLabelText && !effectiveCircle && !effectiveIcon) {
                logDebug('Hiding battery - no visible options');
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

            // Debug visibility logic
            if (DEBUG) 
                logDebug(`VISIBILITY CHECK: state=${proxy.State} (${getObjectKey(UPower.DeviceState, proxy.State)}) hideIdle=${hideIdle} isIdle=${isIdle} hideFull=${settings.get_boolean('hidefull')} hideCharging=${settings.get_boolean('hidecharging')}`);
             

            if (hideIdle && isIdle) {
                logDebug('Hiding battery - idle');
                shouldShow = false;
            }

            shouldShowIndicator = shouldShow;
            if (shouldShow) {
                logDebug('Showing battery');
                powerToggle.show();
            } else {
                logWarn('Hiding battery - toggle hidden');
                powerToggle.hide();
            }

            if (circleIndicator)
                circleIndicator.visible = shouldShow && effectiveCircle;

            if (batteryIndicator)
                batteryIndicator.visible = shouldShow && effectiveIcon;
        });
    }

    _updateInterval(settings) {
        if (this._refreshTimeoutId) {
            GLib.source_remove(this._refreshTimeoutId);
            this._refreshTimeoutId = null;
        }

        const interval = settings.get_int('interval');
        if (interval > 0) {
            logInfo(`Setting refresh interval to ${interval} seconds`);
            this._refreshTimeoutId = GLib.timeout_add_seconds(GLib.PRIORITY_DEFAULT, interval, () => {
                this._syncToggle();
                return GLib.SOURCE_CONTINUE;
            });
        }
    }

    disable() {
        logInfo('[Battery Power Monitor] ===== EXTENSION DISABLED =====');
        // Clear interval
        if (this._refreshTimeoutId) {
            GLib.source_remove(this._refreshTimeoutId);
            this._refreshTimeoutId = null;
        }

        // Disconnect battery watching
        if (this._batteryWatching !== null) {
            this._getBattery(proxy => {
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
        if (this._logLevelConnection && this._settings) {
            this._settings.disconnect(this._logLevelConnection);
            this._logLevelConnection = null;
        }
        if (this._logPathConnection && this._settings) {
            this._settings.disconnect(this._logPathConnection);
            this._logPathConnection = null;
        }
        if (this._logToFileConnection && this._settings) {
            this._settings.disconnect(this._logToFileConnection);
            this._logToFileConnection = null;
        }


        updateUI = null;
        this._im.clear();
        this._im = null;
        destroyCircleIndicator();
        destroyBatteryIndicator();
        resetPowerToggleStyles();
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
const CIRCLE_MIN_SIZE_USER = 12;
