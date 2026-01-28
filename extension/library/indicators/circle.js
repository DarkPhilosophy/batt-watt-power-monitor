import GObject from 'gi://GObject';
import St from 'gi://St';
import Cairo from 'cairo';

import { panel } from 'resource:///org/gnome/shell/ui/main.js';
import * as Logger from '../logger.js';
import { CIRCLE } from '../constants.js';
import { getForegroundColor, getRingColor } from '../utils.js';
import { loadChargingSvg, drawBatteryIcon, clearCairoContext } from '../drawing.js';
import { getCircleSize, buildIndicatorStatus } from '../settings.js';

const CircleIndicator = GObject.registerClass(
    class CircleIndicator extends St.DrawingArea {
        _init(status, extensionPath) {
            const size = status?.size ?? CIRCLE.MIN_SIZE;
            // Remove 'system-status-icon' style class to prevent theme from forcing fixed size (e.g. 16px).
            // This fixes "Static" size issue.
            super._init({ width: size, height: size }); // No style_class

            // Explicitly force size (just in case)
            this.set_width(size);
            this.set_height(size);

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
            const svgSurface = loadChargingSvg(this._extensionPath, red, green, blue);
            if (!svgSurface) {
                return centerX - textExtents.width / 2;
            }

            const svgHeight = svgSurface.getHeight();
            const svgWidth = svgSurface.getWidth();

            const scale = (textExtents.height * CIRCLE.CHARGING_ICON_SCALE) / svgHeight;
            const scaledWidth = svgWidth * scale;
            const scaledHeight = svgHeight * scale;

            // Layout Logic: [Bolt] CENTERED (Redesign: Behind Text)
            // Center the bolt fully. No offsets.
            const iconX = centerX - scaledWidth / 2;
            const iconY = centerY - scaledHeight / 2;

            context.save();
            context.scale(scale, scale);
            context.setSourceSurface(svgSurface, iconX / scale, iconY / scale);
            context.paint();
            context.restore();
        }

        _drawBatteryIcon(context, centerX, centerY, width, height, red, green, blue) {
            drawBatteryIcon(context, centerX, centerY, width, height, this._status.percentage, red, green, blue);
        }

        _onRepaint(area) {
            const context = area.get_context();
            const [width, height] = area.get_surface_size();

            clearCairoContext(context);

            const [red, green, blue] = this._color;
            context.setSourceRGB(red, green, blue);

            const centerX = width / 2;
            const centerY = height / 2;
            const outerRadius = Math.min(width, height) / 2 - CIRCLE.RING_OUTER_PADDING;
            const innerRadius = outerRadius * CIRCLE.RING_INNER_RATIO;

            const arcEndAngle = ((270 - (100 - this._status.percentage) * CIRCLE.DEGREES_PER_PERCENT) * Math.PI) / 180;

            context.arc(centerX, centerY, outerRadius, CIRCLE.ARC_START_ANGLE, arcEndAngle);
            context.arcNegative(centerX, centerY, innerRadius, arcEndAngle, CIRCLE.ARC_START_ANGLE);
            context.closePath();
            context.fill();

            if (this._status.showText) {
                context.selectFontFace('Sans', Cairo.FontSlant.NORMAL, Cairo.FontWeight.BOLD);

                // Reduce font size if charging to make room for bolt
                // CORE FIX: Use the User's requested SIZE for scaling, not the clamped surface height (e.g. 27/32).
                // This ensures the bolt/text grow even if the panel height is restricting the widget.
                const targetSize = this._status.size || height;

                const fontSize = Math.round(targetSize * CIRCLE.FONT_SIZE_RATIO);

                // Proportional Scale Factor based on REQUESTED size
                const refSize = 24.0;
                const propScale = targetSize / refSize;

                // Removed font reduction to fix "very little" size issue.
                // if (this._status.isCharging || this._status.forceBolt) {
                //    fontSize = Math.round(fontSize * 0.75);
                // }
                context.setFontSize(fontSize);

                const text = String(this._status.percentage);
                const textExtents = context.textExtents(text);
                const textY = centerY + textExtents.height / 2;

                const textX = centerX - textExtents.width / 2;

                // LAYER 1: Draw Bolt (Background)
                if (this._status.isCharging || this._status.forceBolt) {
                    this._drawChargingIcon(context, centerX, centerY, textExtents, red, green, blue);
                }

                // LAYER 2: Draw Text (Foreground)
                // Text is always centered now.

                // Draw Text (Updated Logic: Simulated Stroke to match Bolt - Proportional)

                // Draw Stroke (Black)
                context.setSourceRGB(0, 0, 0);
                // "Reduce stroke... to half": changed multiplier from 2 to 0.8 (approx half visual weight)
                const strokeWidth = Math.max(1, Math.round(0.8 * propScale)); // Proportional stroke
                const step = 1;

                // Optimize loop?
                for (let dx = -strokeWidth; dx <= strokeWidth; dx += step) {
                    for (let dy = -strokeWidth; dy <= strokeWidth; dy += step) {
                        if (dx !== 0 || dy !== 0) {
                            if (dx * dx + dy * dy >= step * step) {
                                context.moveTo(textX + dx, textY + dy);
                                context.showText(text);
                            }
                        }
                    }
                }

                // Fill (Text Color)
                context.setSourceRGB(red, green, blue);
                context.moveTo(textX, textY);
                context.showText(text);
            } else {
                // No Text Mode (Percentage Outside)
                const iconWidth = innerRadius * 1.95;
                const iconHeight = innerRadius * 2.2;

                // Draw Battery Icon
                this._drawBatteryIcon(context, centerX, centerY, iconWidth, iconHeight, red, green, blue);

                // Overlay Bolt if Charging
                if (this._status.isCharging || this._status.forceBolt) {
                    // Load SVG
                    const svgSurface = loadChargingSvg(this._extensionPath, red, green, blue);
                    if (svgSurface) {
                        const svgH = svgSurface.getHeight();
                        const svgW = svgSurface.getWidth();

                        // Scale bolt to fit nicely over/in front of battery
                        const targetH = iconHeight * 0.85; // Original logic: boltHeight = height * 0.85
                        const bScale = targetH / svgH;
                        const bW = svgW * bScale;

                        // Center the bolt
                        const bX = centerX - bW / 2;
                        const bY = centerY - targetH / 2;

                        Logger.debug(`Drawing Bolt (No-Text Mode): h=${targetH}`);

                        context.save();
                        context.scale(bScale, bScale);

                        // Draw Simulated Stroke (Black Bolt)
                        const blackSurface = loadChargingSvg(this._extensionPath, 0, 0, 0);
                        if (blackSurface) {
                            const step = 1 / bScale;
                            for (let dx = -2; dx <= 2; dx++) {
                                for (let dy = -2; dy <= 2; dy++) {
                                    if (dx !== 0 || dy !== 0) {
                                        context.setSourceSurface(
                                            blackSurface,
                                            bX / bScale + dx * step,
                                            bY / bScale + dy * step,
                                        );
                                        context.paint();
                                    }
                                }
                            }
                        }

                        // Draw Colored Bolt
                        context.setSourceSurface(svgSurface, bX / bScale, bY / bScale);
                        context.paint();
                        context.restore();
                    }
                }
            }
        }

        update(status) {
            // Fix "Still Static" issue: Update dimensions when status changes
            if (status.size && (this.width !== status.size || this.height !== status.size)) {
                this.set_width(status.size);
                this.set_height(status.size);
            }

            // Visibility Logic
            let shouldHide = false;
            // Hide if Charging setting is ON and we are charging
            if (status.hideCharging && status.isCharging) shouldHide = true;
            // Hide if Full setting is ON and battery is full (== 100%)
            //    (Maybe check status.status === UPower.DeviceState.FULLY_CHARGED too?)
            if (status.hideFull && status.percentage >= 99) shouldHide = true;
            // Hide if Idle setting is ON and we are idle (not charging, not discharging)
            //    UPower State: 0=Unknown, 1=Charging, 2=Discharging, 3=Empty, 4=Fully Charged, 5=Pending Charge, 6=Pending Discharge
            //    We can check if generic "status" indicates idle?
            //    Actually, simpler check: if not charging and not discharging?
            //    Let's trust the 'status' enum from UPower if possible, or just use the simplified check.
            if (status.hideIdle && status.status !== 1 && status.status !== 2) shouldHide = true; // 1=Charging, 2=Discharging

            // Debug overriding visibility? No, let's respect the user's logic.
            Logger.debug(
                `Visibility Check: hideCharging=${status.hideCharging} isCharging=${status.isCharging} hideFull=${status.hideFull} pct=${status.percentage} hideIdle=${status.hideIdle} shouldHide=${shouldHide} forceBolt=${status.forceBolt}`,
            );

            this.visible = !shouldHide;

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

let circleIndicator = null;
let circleIndicatorParent = null;
let circleIndicatorStockIcon = null;
let circleIndicatorDefaultParent = null;
let circleIndicatorDefaultIndex = null;

/**
 * Capture the default position of the circle indicator.
 *
 * @param {St.Widget} indicator - The indicator widget.
 */
function captureDefaultPosition(indicator) {
    if (!indicator) return;
    const parent = indicator.get_parent();
    if (!parent || !parent.get_children) return;
    if (circleIndicatorDefaultParent === parent && circleIndicatorDefaultIndex !== null) return;
    circleIndicatorDefaultParent = parent;
    const index = parent.get_children().indexOf(indicator);
    circleIndicatorDefaultIndex = index >= 0 ? index : null;
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
        circleIndicatorDefaultParent === parent &&
        circleIndicatorDefaultIndex !== null &&
        parent.get_n_children
    ) {
        parent.set_child_at_index(indicator, Math.min(circleIndicatorDefaultIndex, parent.get_n_children() - 1));
    }
}

/**
 * Destroy circle indicator and restore stock icon.
 */
export function destroyCircleIndicator() {
    if (!circleIndicator) return;

    circleIndicator.destroy();
    circleIndicator = null;

    circleIndicator = null;

    circleIndicatorParent = null;
    circleIndicatorStockIcon = null;
    circleIndicatorDefaultParent = null;
    circleIndicatorDefaultIndex = null;
}

/**
 * Ensure circle indicator exists and is properly configured.
 *
 * @param {object} settings - GSettings object
 * @param {string} extensionPath - Path to extension directory
 */
export function ensureCircleIndicator(settings, extensionPath) {
    if (!settings.get_boolean('usecircleindicator')) {
        destroyCircleIndicator();
        return;
    }

    // New Requirement: "Show Battery Icon" acts as a master visibility switch for the icon/indicator?
    // User says: "logic for bar is there we disable 'Show battery icon' the bar icon disappear, same logic should follow for circular"
    if (!settings.get_boolean('showicon')) {
        destroyCircleIndicator();
        return;
    }

    if (circleIndicator) {
        const desiredSize = getCircleSize(settings);
        if (circleIndicator.width !== desiredSize || circleIndicator.height !== desiredSize) {
            destroyCircleIndicator();
        } else {
            captureDefaultPosition(circleIndicator);
            applyIndicatorPosition(circleIndicator, settings);
            return;
        }
    }

    destroyBatteryIndicator();

    const quickSettings = panel?.statusArea?.quickSettings;
    const system = quickSettings?._system;
    if (!system) {
        Logger.debug('Circle indicator: system indicator not available');
        return;
    }
    circleIndicatorStockIcon = system?._indicator ?? null;
    circleIndicatorParent = circleIndicatorStockIcon?.get_parent() ?? null;
    circleIndicator = new CircleIndicator(
        {
            percentage: 0,
            isCharging: false,
            showText: true,
            useColor: settings.get_boolean('showcolored'),
            forceBolt: settings.get_boolean('forcebolt'),
            size: getCircleSize(settings),
        },
        extensionPath,
    );

    if (circleIndicatorParent && circleIndicatorStockIcon) {
        circleIndicatorParent.insert_child_above(circleIndicator, circleIndicatorStockIcon);
    } else if (panel?._rightBox) {
        panel._rightBox.insert_child_at_index(circleIndicator, 0);
    } else {
        Logger.debug('Circle indicator: no parent container available');
        return;
    }

    captureDefaultPosition(circleIndicator);
    applyIndicatorPosition(circleIndicator, settings);
}

import { destroyBatteryIndicator } from './battery.js';

/**
 * Update the circle indicator status.
 *
 * @param {object} proxy - UPower proxy object with State and Percentage.
 * @param {object} settings - GSettings object.
 */
export function updateCircleIndicatorStatus(proxy, settings) {
    if (!settings.get_boolean('usecircleindicator') || !circleIndicator || !proxy) return;

    const size = getCircleSize(settings);
    const { percentage, status, isCharging, showText, useColor, forceBolt, hideCharging, hideFull, hideIdle } =
        buildIndicatorStatus(proxy, settings);
    Logger.debug(`Circle status: state=${proxy.State} status=${status} charging=${isCharging} pct=${percentage}`);
    circleIndicator.update({
        percentage,
        status, // Pass generic status enum/string if needed by update logic (e.g. for hideIdle check)
        isCharging,
        showText,
        useColor,
        forceBolt,
        hideCharging,
        hideFull,
        hideIdle,
        size,
    });
}
