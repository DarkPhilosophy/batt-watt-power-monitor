import GObject from 'gi://GObject';
import St from 'gi://St';
import Cairo from 'cairo';

import { panel } from 'resource:///org/gnome/shell/ui/main.js';
import * as Logger from '../logger.js';
import { BATTERY } from '../constants.js';
import { getIndicatorRgb, applyWidgetSize } from '../utils.js';
import {
    loadChargingSvg,
    drawBatteryIcon,
    clearCairoContext,
    purgeSvgCache,
    drawTextStroke,
    drawBoltStroke,
} from '../drawing.js';
import { getBatteryWidth, getBatteryHeight, buildIndicatorStatus } from '../settings.js';

const BatteryIndicator = GObject.registerClass(
    class BatteryIndicator extends St.DrawingArea {
        _init(status) {
            const width = status?.width ?? BATTERY.MIN_SIZE;
            const height = status?.height ?? BATTERY.MIN_SIZE;
            super._init({ width, height, style_class: 'system-status-icon' });
            applyWidgetSize(this, width, height);

            this._status = status;
            this._extensionPath = status.extensionPath;
            this._color = this._calculateColor();
            this._repaintId = this.connect('repaint', this._onRepaint.bind(this));
            this.visible = true;
        }

        vfunc_get_preferred_width(_forHeight) {
            const width = this._status?.width ?? BATTERY.MIN_SIZE;
            return [width, width];
        }

        vfunc_get_preferred_height(_forWidth) {
            const height = this._status?.height ?? BATTERY.MIN_SIZE;
            return [height, height];
        }

        _calculateColor() {
            return getIndicatorRgb(this, this._status.percentage, this._status.useColor, this._status.useChargingColor);
        }

        _onRepaint(area) {
            const context = area.get_context();
            const [width, height] = area.get_surface_size();
            Logger.debug(`_onRepaint: surfW=${width}, statusBatW=${this._status.batteryWidth}`);

            const desiredHeight = this._status.height ?? height;
            const drawHeight = Math.min(height, desiredHeight);

            clearCairoContext(context);

            const [red, green, blue] = this._color;

            const centerX = width / 2;
            const centerY = height / 2;
            const iconHeight = drawHeight * 0.9;

            let boltWidth = 0;
            let boltHeight = 0;
            let boltScale = 0;
            let svgSurface = null;

            if (this._status.showBolt) {
                svgSurface = loadChargingSvg(this._extensionPath, red, green, blue);
                if (svgSurface) {
                    const svgHeight = svgSurface.getHeight();
                    const svgWidth = svgSurface.getWidth();
                    boltHeight = iconHeight * 0.75;
                    boltScale = boltHeight / svgHeight;
                    boltWidth = svgWidth * boltScale;
                }
            }

            let rawBatteryW = this._status.batteryWidth;
            if (rawBatteryW === undefined) rawBatteryW = this._status?.width ?? width;
            const batteryDrawWidth = rawBatteryW * 0.9;

            const batteryCenterX = centerX;
            drawBatteryIcon(
                context,
                batteryCenterX,
                centerY,
                batteryDrawWidth,
                iconHeight,
                this._status.percentage,
                red,
                green,
                blue,
                0.7,
                0.75,
                false,
            );

            if (boltWidth > 0 && svgSurface) {
                // Center the bolt icon in the middle of the battery
                const iconX = centerX - boltWidth / 2;
                const iconY = centerY - boltHeight / 2;

                context.save();
                context.scale(boltScale, boltScale);

                // Bolt stroke (if textStroke enabled)
                if (this._status.textStroke) {
                    drawBoltStroke(context, this._extensionPath, iconX, iconY, boltScale);
                }

                context.setSourceSurface(svgSurface, iconX / boltScale, iconY / boltScale);
                context.paint();
                context.restore();
            }

            if (this._status.showText) {
                context.selectFontFace('Sans', Cairo.FontSlant.NORMAL, Cairo.FontWeight.BOLD);
                // Dynamic font size logic (height & width aware)
                // Start with a generous height-based size (45%, up from 28%)
                let fontSize = Math.round(height * 0.45);
                context.setFontSize(fontSize);

                const text = String(this._status.percentage);
                const maxTextWidth = batteryDrawWidth * 0.8; // Max 80% of battery width
                const currentExtents = context.textExtents(text);

                if (currentExtents.width > maxTextWidth) {
                    fontSize = Math.floor(fontSize * (maxTextWidth / currentExtents.width));
                    context.setFontSize(fontSize);
                }
                const textExtents = context.textExtents(text);
                const textX = batteryCenterX - textExtents.width / 2;
                const textY = centerY + textExtents.height / 2;

                // Text stroke (if enabled)
                if (this._status.textStroke) {
                    drawTextStroke(context, text, textX, textY, 2);
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
    },
);

let batteryIndicator = null;
let batteryIndicatorParent = null;
let batteryIndicatorStockIcon = null;
let batteryIndicatorDefaultParent = null;
let batteryIndicatorDefaultIndex = null;

/**
 * Capture the default position of the battery indicator.
 *
 * @param {St.Widget} indicator - The indicator widget.
 */
function captureDefaultPosition(indicator) {
    if (!indicator) return;
    const parent = indicator.get_parent();
    if (!parent || !parent.get_children) return;
    if (batteryIndicatorDefaultParent === parent && batteryIndicatorDefaultIndex !== null) return;
    batteryIndicatorDefaultParent = parent;
    const index = parent.get_children().indexOf(indicator);
    batteryIndicatorDefaultIndex = index >= 0 ? index : null;
}

/**
 * Apply the configured indicator position.
 *
 * @param {St.Widget} indicator - The indicator widget.
 * @param {Gio.Settings} settings - The GSettings object.
 */
function applyIndicatorPosition(indicator, settings) {
    if (!indicator || !settings) return;
    const parent = indicator.get_parent();
    if (!parent) return;
    const pos = settings.get_string('indicator-position');

    if (pos === 'left') {
        if (parent.set_child_above_sibling) {
            parent.set_child_above_sibling(indicator, null);
        } else if (parent.set_child_at_index) {
            parent.set_child_at_index(indicator, 0);
        }
    } else if (pos === 'right') {
        if (parent.set_child_below_sibling) {
            parent.set_child_below_sibling(indicator, null);
        } else if (parent.get_n_children) {
            parent.set_child_at_index(indicator, Math.max(parent.get_n_children() - 1, 0));
        }
    } else if (
        batteryIndicatorDefaultParent === parent &&
        batteryIndicatorDefaultIndex !== null &&
        parent.get_n_children
    ) {
        parent.set_child_at_index(indicator, Math.min(batteryIndicatorDefaultIndex, parent.get_n_children() - 1));
    }
}

/**
 * Destroy battery indicator and restore stock icon.
 */
export function destroyBatteryIndicator() {
    if (!batteryIndicator) return;

    batteryIndicator.destroy();
    batteryIndicator = null;

    batteryIndicator = null;

    batteryIndicatorParent = null;
    batteryIndicatorStockIcon = null;
    batteryIndicatorDefaultParent = null;
    batteryIndicatorDefaultIndex = null;
}

/**
 * Check if battery indicator should be shown.
 *
 * @param {object} settings - GSettings object
 * @returns {boolean} True if battery indicator is enabled
 */
function batteryIndicatorEnabled(settings) {
    return (
        settings &&
        settings.get_boolean('showicon') &&
        !settings.get_boolean('usecircleindicator') &&
        !settings.get_boolean('use-stock-icon')
    );
}

/**
 * Ensure battery indicator exists and is properly configured.
 *
 * @param {object} settings - GSettings object
 * @param {string} extensionPath - Path to extension directory
 */
export function ensureBatteryIndicator(settings, extensionPath) {
    if (!batteryIndicatorEnabled(settings)) {
        destroyBatteryIndicator();
        // If we are disabled, destroyBatteryIndicator handles unhiding stock icon if necessary.
        return;
    }

    if (batteryIndicator) {
        const desiredWidth = getBatteryWidth(settings);
        const desiredHeight = getBatteryHeight(settings);
        applyWidgetSize(batteryIndicator, desiredWidth, desiredHeight);
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
        captureDefaultPosition(batteryIndicator);
        applyIndicatorPosition(batteryIndicator, settings);
        return;
    }

    const quickSettings = panel?.statusArea?.quickSettings;
    const system = quickSettings?._system;
    if (!system) {
        Logger.debug('Battery indicator: system indicator not available');
        return;
    }
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
    } else if (panel?._rightBox) {
        panel._rightBox.insert_child_at_index(batteryIndicator, 0);
    } else {
        Logger.debug('Battery indicator: no parent container available');
        return;
    }

    captureDefaultPosition(batteryIndicator);
    applyIndicatorPosition(batteryIndicator, settings);
}

/**
 * Update the battery indicator status.
 *
 * @param {object} proxy - UPower proxy object with State and Percentage.
 * @param {object} settings - GSettings object.
 */
export function updateBatteryIndicatorStatus(proxy, settings) {
    if (!batteryIndicatorEnabled(settings) || !batteryIndicator || !proxy) return;

    const { percentage, state, isCharging, useChargingColor, showBolt, showText, useColor, textStroke, forceBolt } =
        buildIndicatorStatus(proxy, settings);
    Logger.debug(`Bar status: state=${proxy.State} status=${state} charging=${isCharging} pct=${percentage}`);

    const batteryW = getBatteryWidth(settings);
    const height = getBatteryHeight(settings);
    const desiredWidth = batteryW;

    applyWidgetSize(batteryIndicator, desiredWidth, height);
    batteryIndicator.update({
        percentage,
        useColor,
        showText,
        textStroke,
        isCharging,
        useChargingColor,
        showBolt,
        forceBolt,
        width: desiredWidth,
        height,
        batteryWidth: batteryW,
    });
    purgeSvgCache();
}
