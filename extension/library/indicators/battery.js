import GObject from 'gi://GObject';
import St from 'gi://St';
import Cairo from 'cairo';

import { panel } from 'resource:///org/gnome/shell/ui/main.js';
import * as Logger from '../logger.js';
import { BATTERY } from '../constants.js';
import { getForegroundColor, getRingColor, applyWidgetSize } from '../utils.js';
import { loadChargingSvg, drawBatteryIcon, clearCairoContext, purgeSvgCache } from '../drawing.js';
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
            if (!this._status.useColor) {
                const fg = getForegroundColor(this);
                return [fg.red / 255, fg.green / 255, fg.blue / 255];
            }
            return getRingColor(this._status.percentage);
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

let batteryIndicator = null;
let batteryIndicatorParent = null;
let batteryIndicatorStockIcon = null;

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
}

/**
 * Check if battery indicator should be shown.
 *
 * @param {object} settings - GSettings object
 * @returns {boolean} True if battery indicator is enabled
 */
function batteryIndicatorEnabled(settings) {
    return settings && settings.get_boolean('showicon') && !settings.get_boolean('usecircleindicator');
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
        // If we are disabled, verify if we should unhide stock icon.
        // If circle is enabled, circle handles hiding.
        // If circle is disabled AND we are disabled (showicon=false),
        // we might need to unhide stock if we hid it previously?
        // But destroyBatteryIndicator handles unhiding if we controlled it.
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
    } else if (panel?._rightBox) {
        panel._rightBox.insert_child_at_index(batteryIndicator, 0);
    }
}

/**
 *
 * @param proxy
 * @param settings
 */
/**
 * Update the battery indicator status.
 *
 * @param {object} proxy - UPower proxy object with State and Percentage.
 * @param {object} settings - GSettings object.
 */
export function updateBatteryIndicatorStatus(proxy, settings) {
    if (!batteryIndicatorEnabled(settings) || !batteryIndicator || !proxy) return;

    const { percentage, status, isCharging, showText, useColor, forceBolt } = buildIndicatorStatus(proxy, settings);
    Logger.debug(`Bar status: state=${proxy.State} status=${status} charging=${isCharging} pct=${percentage}`);

    const batteryW = getBatteryWidth(settings);
    const height = getBatteryHeight(settings);
    const desiredWidth = batteryW;

    applyWidgetSize(batteryIndicator, desiredWidth, height);
    batteryIndicator.update({
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
