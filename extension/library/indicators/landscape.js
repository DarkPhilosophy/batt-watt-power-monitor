import GObject from 'gi://GObject';
import St from 'gi://St';
import Cairo from 'cairo';

import { panel } from 'resource:///org/gnome/shell/ui/main.js';
import * as Logger from '../logger.js';
import { BATTERY } from '../constants.js';
import { getForegroundColor, getRingColor, applyWidgetSize } from '../utils.js';
import { loadChargingSvg, drawBatteryIconLandscape, clearCairoContext, purgeSvgCache } from '../drawing.js';
import { getBatteryWidth, getBatteryHeight, buildIndicatorStatus } from '../settings.js';

const LandscapeIndicator = GObject.registerClass(
    class LandscapeIndicator extends St.DrawingArea {
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
            if (!this._status.useColor) {
                const fg = getForegroundColor(this);
                return [fg.red / 255, fg.green / 255, fg.blue / 255];
            }
            return getRingColor(this._status.percentage);
        }

        _onRepaint(area) {
            const context = area.get_context();
            const [width, height] = area.get_surface_size();
            Logger.debug(`_onRepaint (landscape): surfW=${width}, statusBatW=${this._status.batteryWidth}`);

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

            if (this._status.isCharging || this._status.forceBolt) {
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

            drawBatteryIconLandscape(
                context,
                centerX,
                centerY,
                batteryDrawWidth,
                iconHeight,
                this._status.percentage,
                red,
                green,
                blue,
                0.8,
                0.7,
                false,
            );

            if (boltWidth > 0 && svgSurface) {
                const iconX = centerX - boltWidth / 2;
                const iconY = centerY - boltHeight / 2;

                context.save();
                context.scale(boltScale, boltScale);

                const blackSurface = loadChargingSvg(this._extensionPath, 0, 0, 0);
                if (blackSurface) {
                    const step = 1 / boltScale;
                    for (let dx = -2; dx <= 2; dx++) {
                        for (let dy = -2; dy <= 2; dy++) {
                            if (dx !== 0 || dy !== 0) {
                                context.setSourceSurface(
                                    blackSurface,
                                    iconX / boltScale + dx * step,
                                    iconY / boltScale + dy * step,
                                );
                                context.paint();
                            }
                        }
                    }
                }

                context.setSourceSurface(svgSurface, iconX / boltScale, iconY / boltScale);
                context.paint();
                context.restore();
            }

            if (this._status.showText) {
                context.selectFontFace('Sans', Cairo.FontSlant.NORMAL, Cairo.FontWeight.BOLD);
                let fontSize = Math.round(height * 0.45);
                context.setFontSize(fontSize);

                const text = String(this._status.percentage);
                const maxTextWidth = batteryDrawWidth * 0.8;
                const currentExtents = context.textExtents(text);

                if (currentExtents.width > maxTextWidth) {
                    fontSize = Math.floor(fontSize * (maxTextWidth / currentExtents.width));
                    context.setFontSize(fontSize);
                }
                const textExtents = context.textExtents(text);
                const textX = centerX - textExtents.width / 2;
                const textY = centerY + textExtents.height / 2;

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
    },
);

let landscapeIndicator = null;
let landscapeIndicatorParent = null;
let landscapeIndicatorStockIcon = null;
let landscapeIndicatorDefaultParent = null;
let landscapeIndicatorDefaultIndex = null;

/**
 * Capture the default position of the landscape indicator.
 *
 * @param {St.Widget} indicator - The indicator widget.
 */
function captureDefaultPosition(indicator) {
    if (!indicator) return;
    const parent = indicator.get_parent();
    if (!parent || !parent.get_children) return;
    if (landscapeIndicatorDefaultParent === parent && landscapeIndicatorDefaultIndex !== null) return;
    landscapeIndicatorDefaultParent = parent;
    const index = parent.get_children().indexOf(indicator);
    landscapeIndicatorDefaultIndex = index >= 0 ? index : null;
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
        landscapeIndicatorDefaultParent === parent &&
        landscapeIndicatorDefaultIndex !== null &&
        parent.get_n_children
    ) {
        parent.set_child_at_index(indicator, Math.min(landscapeIndicatorDefaultIndex, parent.get_n_children() - 1));
    }
}

/**
 * Destroy the landscape indicator and reset state.
 */
export function destroyLandscapeIndicator() {
    if (!landscapeIndicator) return;

    landscapeIndicator.destroy();
    landscapeIndicator = null;

    landscapeIndicatorParent = null;
    landscapeIndicatorStockIcon = null;
    landscapeIndicatorDefaultParent = null;
    landscapeIndicatorDefaultIndex = null;
}

/**
 * Check if the landscape indicator should be enabled.
 *
 * @param {Gio.Settings} settings - The GSettings object.
 * @returns {boolean} True if enabled.
 */
function landscapeIndicatorEnabled(settings) {
    return settings && settings.get_boolean('showicon') && !settings.get_boolean('usecircleindicator');
}

/**
 * Ensure the landscape indicator exists and is properly configured.
 *
 * @param {Gio.Settings} settings - The GSettings object.
 * @param {string} extensionPath - Path to the extension directory.
 */
export function ensureLandscapeIndicator(settings, extensionPath) {
    if (!landscapeIndicatorEnabled(settings)) {
        destroyLandscapeIndicator();
        return;
    }

    if (landscapeIndicator) {
        const desiredWidth = getBatteryWidth(settings);
        const desiredHeight = getBatteryHeight(settings);
        applyWidgetSize(landscapeIndicator, desiredWidth, desiredHeight);
        landscapeIndicator.update({
            percentage: landscapeIndicator._status?.percentage ?? 0,
            isCharging: landscapeIndicator._status?.isCharging ?? false,
            showText: landscapeIndicator._status?.showText ?? false,
            useColor: landscapeIndicator._status?.useColor ?? false,
            extensionPath: landscapeIndicator._extensionPath,
            width: desiredWidth,
            height: desiredHeight,
            batteryWidth: desiredWidth,
            settings,
        });
        captureDefaultPosition(landscapeIndicator);
        applyIndicatorPosition(landscapeIndicator, settings);
        return;
    }

    const quickSettings = panel?.statusArea?.quickSettings;
    const system = quickSettings?._system;
    if (!system) {
        Logger.debug('Landscape indicator: system indicator not available');
        return;
    }
    landscapeIndicatorStockIcon = system?._indicator ?? null;
    landscapeIndicatorParent = landscapeIndicatorStockIcon?.get_parent() ?? null;
    const batteryW = getBatteryWidth(settings);
    landscapeIndicator = new LandscapeIndicator({
        percentage: 0,
        isCharging: false,
        showText: false,
        useColor: settings.get_boolean('showcolored'),
        forceBolt: settings.get_boolean('forcebolt'),
        width: batteryW,
        batteryWidth: batteryW,
        settings,
        extensionPath,
    });

    if (landscapeIndicatorParent && landscapeIndicatorStockIcon) {
        landscapeIndicatorParent.insert_child_above(landscapeIndicator, landscapeIndicatorStockIcon);
    } else if (panel?._rightBox) {
        panel._rightBox.insert_child_at_index(landscapeIndicator, 0);
    } else {
        Logger.debug('Landscape indicator: no parent container available');
        return;
    }

    captureDefaultPosition(landscapeIndicator);
    applyIndicatorPosition(landscapeIndicator, settings);
}

/**
 * Update the landscape indicator status.
 *
 * @param {object} proxy - UPower proxy object.
 * @param {Gio.Settings} settings - The GSettings object.
 */
export function updateLandscapeIndicatorStatus(proxy, settings) {
    if (!landscapeIndicatorEnabled(settings) || !landscapeIndicator || !proxy) return;

    const { percentage, status, isCharging, showText, useColor, forceBolt } = buildIndicatorStatus(proxy, settings);
    Logger.debug(`Landscape status: state=${proxy.State} status=${status} charging=${isCharging} pct=${percentage}`);

    const batteryW = getBatteryWidth(settings);
    const height = getBatteryHeight(settings);
    const desiredWidth = batteryW;

    applyWidgetSize(landscapeIndicator, desiredWidth, height);
    landscapeIndicator.update({
        percentage,
        useColor,
        showText,
        isCharging,
        forceBolt,
        width: desiredWidth,
        height,
        batteryWidth: batteryW,
    });
    purgeSvgCache();
}
