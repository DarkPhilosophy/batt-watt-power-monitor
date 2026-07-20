'use strict';

import Gio from 'gi://Gio';
import Gtk from 'gi://Gtk';
import Adw from 'gi://Adw';
import Gdk from 'gi://Gdk';
import GLib from 'gi://GLib';

import { ExtensionPreferences, gettext as _ } from 'resource:///org/gnome/Shell/Extensions/js/extensions/prefs.js';

import { formatRecentLogEvents, resolveLogFilePath } from './library/logging-model.js';
import { safeErrorMessage } from './library/sanitize.js';

Gio._promisify(Gio.File.prototype, 'load_contents_async', 'load_contents_finish');

const BUILD_DATE = null;
const BUILD_ID = 'development';
const PROJECT_URL = 'https://github.com/DarkPhilosophy/batt-watt-power-monitor';
const ISSUE_URL = `${PROJECT_URL}/issues`;
const RECENT_LOG_LINE_LIMIT = 80;
const CHANGELOG = `
SETTINGS MIGRATION, POWER FIX & TEST SUITE

RELIABILITY, IDIOMATIC CLEANUP & TEST COVERAGE

Power Reading Fix (#10): Fixed wattage getting stuck at a constant, bogus value (e.g. -7.7 W) on batteries that expose power_now but not current_now. The power source is now re-evaluated every cycle (computePower) instead of caching a one-shot detection that could be poisoned by the async file-cache race at boot. It falls back to current_now * voltage_now only when both are readable, otherwise reports 0 instead of a negative sentinel, and self-corrects once power_now resolves.

Kebab-case Settings Schema: Renamed all flat GSettings keys to idiomatic kebab-case (e.g. showicon to show-icon, loglevel to log-level). A one-time migration at first enable copies any existing user values straight from dconf into the new keys and then removes the legacy keys, so upgrades keep your configuration.

Sanitized Logging: Every log line is now redacted (Bearer tokens, JWT-like values, access/refresh tokens) and length-capped before being written to the console or a file.

Refined About Page: Dedicated rows with icons for Extension version, Build date, Build ID (debug-gated), Data source, Project Homepage, and Report an Issue.

Refined Debug Page: Added a Diagnostics group - copy sanitized configuration as JSON, and a Recent Log Events viewer showing the last 80 sanitized log lines.

Live Debug Toggle: Changing debug or logging settings now reconfigures the logger immediately instead of requiring a re-enable.

Build Tooling Modernized: Migrated all .scripts to ES modules (.mjs), made linting blocking, and switched build-metadata injection (BUILD_DATE / BUILD_ID) to value-agnostic regex so it never depends on a hardcoded placeholder value.

Test Suite: Added Node (node --test) and GJS test modules covering credential redaction, log path resolution and formatting, the #10 power selection, constants, utility formatting and colors, plus structural regression guards.`;

export default class BattConsumptionPreferences extends ExtensionPreferences {
    _switchToNavigationSplitViews(window) {
        // Attach first real PreferencesPage to avoid Adw warnings
        this._windowPageAdded = false;

        // Add AdwNavigationSplitView and componenents
        const splitView = new Adw.NavigationSplitView({
            hexpand: true,
            vexpand: true,
            sidebar_width_fraction: 0.3,
        });
        const breakpointBin = new Adw.BreakpointBin({
            width_request: 100,
            height_request: 100,
        });
        const breakpoint = new Adw.Breakpoint();
        breakpoint.set_condition(Adw.BreakpointCondition.parse('max-width: 600px'));
        breakpoint.add_setter(splitView, 'collapsed', true);
        breakpointBin.add_breakpoint(breakpoint);
        breakpointBin.set_child(splitView);
        window.set_content(breakpointBin);

        // AdwNavigationSplitView Sidebar configuration
        const splitViewSidebar = new Adw.NavigationPage({
            title: _('Settings'),
        });
        const sidebarToolbar = new Adw.ToolbarView();
        const sidebarHeader = new Adw.HeaderBar();
        const sidebarBin = new Adw.Bin();
        this._sidebarListBox = new Gtk.ListBox();
        this._sidebarListBox.add_css_class('navigation-sidebar');
        sidebarBin.set_child(this._sidebarListBox);
        sidebarToolbar.set_content(sidebarBin);
        sidebarToolbar.add_top_bar(sidebarHeader);
        splitViewSidebar.set_child(sidebarToolbar);
        splitView.set_sidebar(splitViewSidebar);

        // Content configuration
        const splitViewContent = new Adw.NavigationPage();
        this._contentToastOverlay = new Adw.ToastOverlay();
        const contentToolbar = new Adw.ToolbarView();
        const contentHeader = new Adw.HeaderBar();
        const stack = new Gtk.Stack({
            transition_type: Gtk.StackTransitionType.CROSSFADE,
        });
        contentToolbar.set_content(stack);
        contentToolbar.add_top_bar(contentHeader);
        this._contentToastOverlay.set_child(contentToolbar);
        splitViewContent.set_child(this._contentToastOverlay);
        splitView.set_content(splitViewContent);

        this._firstPageAdded = false;
        this._addPage = page => {
            const row = new Gtk.ListBoxRow();
            row._name = page.get_name ? page.get_name() : 'page';
            row._title = page.get_title();
            row._id = (row._title || 'id').toLowerCase().replace(/\s+/g, '-');
            const rowIcon = new Gtk.Image({ icon_name: page.get_icon_name() });
            const rowLabel = new Gtk.Label({ label: row._title, xalign: 0 });
            const box = new Gtk.Box({
                spacing: 12,
                margin_top: 12,
                margin_bottom: 12,
                margin_start: 12,
                margin_end: 12,
            });
            box.append(rowIcon);
            box.append(rowLabel);
            row.set_child(box);
            row.set_activatable(true);
            stack.add_named(page, row._id);
            this._sidebarListBox.append(row);

            if (!this._windowPageAdded) {
                window.add(page); // attach real page to satisfy Adw.PreferencesWindow
                this._windowPageAdded = true;
            }

            if (!this._firstPageAdded) {
                splitViewContent.set_title(row._title);
                this._firstPageAdded = true;
                // Auto-select first row logic if needed, but 'row-activated' might need manual trigger
            }
        };

        this._sidebarListBox.connect('row-activated', (listBox, row) => {
            if (!row) return;
            splitView.set_show_content(true);
            splitViewContent.set_title(row._title);
            stack.set_visible_child_name(row._id);
        });
    }

    fillPreferencesWindow(window) {
        const settings = this.getSettings();

        // Setup custom sidebar layout
        window.set_default_size(900, 700);
        this._switchToNavigationSplitViews(window);

        // Clean up window-scoped objects on close to avoid EGO-L-006 warnings
        window.connect('close-request', () => {
            if (this._sidebarListBox) {
                this._sidebarListBox.destroy();
                this._sidebarListBox = null;
            }
            if (this._contentToastOverlay) {
                this._contentToastOverlay.destroy();
                this._contentToastOverlay = null;
            }
        });

        // Helper to add icon to row
        const addIcon = (row, iconName) => {
            const icon = new Gtk.Image({
                icon_name: iconName,
            });
            row.add_prefix(icon);
        };
        const rgbaFromHex = hex => {
            const rgba = new Gdk.RGBA();
            if (!rgba.parse(hex || '#ffffff')) rgba.parse('#ffffff');
            return rgba;
        };
        const rgbaToHex = rgba => {
            const toHex = value =>
                Math.round(Math.max(0, Math.min(1, value)) * 255)
                    .toString(16)
                    .padStart(2, '0');
            return `#${toHex(rgba.red)}${toHex(rgba.green)}${toHex(rgba.blue)}`;
        };

        const resolveLogPath = () =>
            resolveLogFilePath(settings.get_string('log-file-path'), {
                cacheDir: GLib.get_user_cache_dir(),
                homeDir: GLib.get_home_dir(),
                isDirectory: candidate => GLib.file_test(candidate, GLib.FileTest.IS_DIR),
            });
        const loadRecentLogEvents = async path => {
            const [contents] = await Gio.File.new_for_path(path).load_contents_async(null);
            return formatRecentLogEvents(new TextDecoder().decode(contents), RECENT_LOG_LINE_LIMIT);
        };
        const copyText = text => {
            const clipboard = Gdk.Display.get_default()?.get_clipboard();
            if (!clipboard) throw new Error(_('Clipboard is unavailable'));
            clipboard.set(text);
        };
        const openFolderChooser = () => {
            const dialog = new Gtk.FileChooserNative({
                title: _('Select Log Folder'),
                action: Gtk.FileChooserAction.SELECT_FOLDER,
                transient_for: window,
                modal: true,
            });
            dialog.connect('response', (d, response) => {
                if (response === Gtk.ResponseType.ACCEPT) {
                    const file = d.get_file();
                    const folderPath = file ? file.get_path() : null;
                    if (folderPath) settings.set_string('log-file-path', folderPath);
                }
                d.destroy();
            });
            dialog.show();
        };

        // === PAGE 1: GENERAL ===
        const generalPage = new Adw.PreferencesPage({
            title: _('General'),
            icon_name: 'preferences-system-symbolic',
        });

        // Group: Battery Behavior
        const behaviorGroup = new Adw.PreferencesGroup({
            title: _('Behavior'),
        });

        const intervalRow = new Adw.ActionRow({
            title: _('Refresh Interval (seconds)'),
            subtitle: _('How often to poll battery status'),
        });
        addIcon(intervalRow, 'view-refresh-symbolic');
        const intervalSpin = new Gtk.SpinButton({
            adjustment: new Gtk.Adjustment({ lower: 1, upper: 60, step_increment: 1 }),
            valign: Gtk.Align.CENTER,
        });
        settings.bind('interval', intervalSpin, 'value', Gio.SettingsBindFlags.DEFAULT);
        intervalRow.add_suffix(intervalSpin);
        behaviorGroup.add(intervalRow);

        const batteryRow = new Adw.ActionRow({
            title: _('Battery Device'),
            subtitle: _('Select specific battery to monitor'),
        });
        addIcon(batteryRow, 'battery-symbolic');
        const batteryCombo = new Gtk.DropDown({
            valign: Gtk.Align.CENTER,
            model: Gtk.StringList.new(['AUTOMATIC', 'BAT0', 'BAT1', 'BAT2']),
        });
        batteryCombo.set_selected(settings.get_int('battery'));
        batteryCombo.connect('notify::selected', widget => {
            settings.set_int('battery', widget.get_selected());
        });
        settings.connect('changed::battery', () => {
            batteryCombo.set_selected(settings.get_int('battery'));
        });
        batteryRow.add_suffix(batteryCombo);
        behaviorGroup.add(batteryRow);
        generalPage.add(behaviorGroup);

        // === PAGE 2: APPEARANCE ===
        const appearancePage = new Adw.PreferencesPage({
            title: _('Appearance'),
            icon_name: 'preferences-desktop-display-symbolic',
        });

        // Group: Panel Elements
        const elementsGroup = new Adw.PreferencesGroup({
            title: _('Panel Elements'),
        });

        // Show Icon
        const showIconRow = new Adw.ActionRow({
            title: _('Show Battery Icon'),
            subtitle: _('Toggle main icon visibility'),
        });
        addIcon(showIconRow, 'image-x-generic-symbolic');
        const showIconSwitch = new Gtk.Switch({
            active: settings.get_boolean('show-icon'),
            valign: Gtk.Align.CENTER,
        });
        settings.bind('show-icon', showIconSwitch, 'active', Gio.SettingsBindFlags.DEFAULT);
        showIconRow.add_suffix(showIconSwitch);
        elementsGroup.add(showIconRow);

        const positionRow = new Adw.ActionRow({
            title: _('Indicator Position'),
            subtitle: _('Where to place the panel indicator'),
        });
        addIcon(positionRow, 'view-grid-symbolic');
        const positionModel = Gtk.StringList.new([_('left'), _('right'), _('default')]);
        const positionDropDown = new Gtk.DropDown({
            valign: Gtk.Align.CENTER,
            model: positionModel,
        });
        const currentPos = settings.get_string('indicator-position');
        const posMap = { left: 0, right: 1, default: 2 };
        positionDropDown.set_selected(posMap[currentPos] ?? 1);
        positionDropDown.connect('notify::selected', widget => {
            const idx = widget.get_selected();
            const val = ['left', 'right', 'default'][idx];
            settings.set_string('indicator-position', val);
        });
        positionRow.add_suffix(positionDropDown);
        elementsGroup.add(positionRow);

        // Percentage
        const percentageRow = new Adw.ActionRow({
            title: _('Show Percentage'),
            subtitle: _('Display battery level text'),
        });
        addIcon(percentageRow, 'font-x-generic-symbolic');
        const percentageSwitch = new Gtk.Switch({
            active: settings.get_boolean('percentage'),
            valign: Gtk.Align.CENTER,
        });
        settings.bind('percentage', percentageSwitch, 'active', Gio.SettingsBindFlags.DEFAULT);
        percentageRow.add_suffix(percentageSwitch);
        elementsGroup.add(percentageRow);

        const percentageOutsideRow = new Adw.ActionRow({
            title: _('Percentage Next to Icon'),
            subtitle: _('Move percentage text outside the icon'),
        });
        addIcon(percentageOutsideRow, 'format-justify-left-symbolic');
        const percentageOutsideSwitch = new Gtk.Switch({
            active: settings.get_boolean('show-percentage-outside'),
            valign: Gtk.Align.CENTER,
        });
        settings.bind('show-percentage-outside', percentageOutsideSwitch, 'active', Gio.SettingsBindFlags.DEFAULT);
        percentageOutsideRow.add_suffix(percentageOutsideSwitch);
        elementsGroup.add(percentageOutsideRow);

        // Time Remaining
        const timeRemainingRow = new Adw.ActionRow({
            title: _('Show Time Remaining'),
            subtitle: _('Estimated time to empty/full'),
        });
        addIcon(timeRemainingRow, 'alarm-symbolic');
        const timeRemainingSwitch = new Gtk.Switch({
            active: settings.get_boolean('time-remaining'),
            valign: Gtk.Align.CENTER,
        });
        settings.bind('time-remaining', timeRemainingSwitch, 'active', Gio.SettingsBindFlags.DEFAULT);
        timeRemainingRow.add_suffix(timeRemainingSwitch);
        elementsGroup.add(timeRemainingRow);

        // Watts
        const showWattsRow = new Adw.ActionRow({
            title: _('Show Power (Watts)'),
            subtitle: _('Current power consumption/charging rate'),
        });
        addIcon(showWattsRow, 'thunderbolt-symbolic');
        const showWattsSwitch = new Gtk.Switch({
            active: settings.get_boolean('show-watts'),
            valign: Gtk.Align.CENTER,
        });
        settings.bind('show-watts', showWattsSwitch, 'active', Gio.SettingsBindFlags.DEFAULT);
        showWattsRow.add_suffix(showWattsSwitch);
        elementsGroup.add(showWattsRow);

        const showDecimalsRow = new Adw.ActionRow({
            title: _('Precision Mode'),
            subtitle: _('Show 2 decimal places (e.g., 15.42W)'),
        });
        addIcon(showDecimalsRow, 'input-dialpad-symbolic');
        const showDecimalsSwitch = new Gtk.Switch({
            active: settings.get_boolean('show-decimals'),
            valign: Gtk.Align.CENTER,
        });
        settings.bind('show-decimals', showDecimalsSwitch, 'active', Gio.SettingsBindFlags.DEFAULT);
        showDecimalsRow.add_suffix(showDecimalsSwitch);
        elementsGroup.add(showDecimalsRow);

        appearancePage.add(elementsGroup);

        // === PAGE 3: STYLE & LAYOUT ===
        const stylePage = new Adw.PreferencesPage({
            title: _('Style & Layout'),
            icon_name: 'battery-level-100-symbolic',
        });

        // Group: Style
        const styleGroup = new Adw.PreferencesGroup({
            title: _('Icon Style'),
        });

        const circleIndicatorRow = new Adw.ActionRow({
            title: _('Use Circular Indicator'),
            subtitle: _('Replace standard battery icon with a ring'),
        });
        addIcon(circleIndicatorRow, 'media-record-symbolic');
        const circleIndicatorSwitch = new Gtk.Switch({
            active: settings.get_boolean('use-circle-indicator'),
            valign: Gtk.Align.CENTER,
        });
        settings.bind('use-circle-indicator', circleIndicatorSwitch, 'active', Gio.SettingsBindFlags.DEFAULT);
        circleIndicatorRow.add_suffix(circleIndicatorSwitch);
        styleGroup.add(circleIndicatorRow);

        const useStockIconRow = new Adw.ActionRow({
            title: _('Use GNOME Stock Icon'),
            subtitle: _('Use the native GNOME battery icon instead of the custom bar or circle'),
        });
        addIcon(useStockIconRow, 'battery-symbolic');
        const useStockIconSwitch = new Gtk.Switch({
            active: settings.get_boolean('use-stock-icon'),
            valign: Gtk.Align.CENTER,
        });
        settings.bind('use-stock-icon', useStockIconSwitch, 'active', Gio.SettingsBindFlags.DEFAULT);
        useStockIconRow.add_suffix(useStockIconSwitch);
        styleGroup.add(useStockIconRow);

        const colorModeModel = Gtk.StringList.new([_('Gradient'), _('Theme Foreground'), _('Custom Color')]);
        const colorModeMap = { gradient: 0, theme: 1, custom: 2 };
        const colorModeValues = ['gradient', 'theme', 'custom'];
        const makeColorModeDropDown = settingKey => {
            const dropDown = new Gtk.DropDown({
                valign: Gtk.Align.CENTER,
                model: colorModeModel,
            });
            dropDown.set_selected(colorModeMap[settings.get_string(settingKey)] ?? 0);
            dropDown.connect('notify::selected', widget => {
                settings.set_string(settingKey, colorModeValues[widget.get_selected()] ?? 'gradient');
            });
            settings.connect(`changed::${settingKey}`, () => {
                dropDown.set_selected(colorModeMap[settings.get_string(settingKey)] ?? 0);
            });
            return dropDown;
        };
        const makeColorButton = (settingKey, title) => {
            const dialog = new Gtk.ColorDialog({
                modal: true,
                title,
                with_alpha: false,
            });
            const button = new Gtk.ColorDialogButton({
                dialog,
                valign: Gtk.Align.CENTER,
            });
            button.set_rgba(rgbaFromHex(settings.get_string(settingKey)));
            button.connect('notify::rgba', widget => {
                settings.set_string(settingKey, rgbaToHex(widget.get_rgba()));
            });
            settings.connect(`changed::${settingKey}`, () => {
                button.set_rgba(rgbaFromHex(settings.get_string(settingKey)));
            });
            return button;
        };

        const showColoredRow = new Adw.ActionRow({
            title: _('Color Gradient Icon'),
            subtitle: _('Apply the normal red-to-green gradient to the icon'),
        });
        addIcon(showColoredRow, 'image-x-generic-symbolic');
        const showColoredSwitch = new Gtk.Switch({
            active: settings.get_boolean('show-colored'),
            valign: Gtk.Align.CENTER,
        });
        settings.bind('show-colored', showColoredSwitch, 'active', Gio.SettingsBindFlags.DEFAULT);
        showColoredRow.add_suffix(showColoredSwitch);
        styleGroup.add(showColoredRow);

        const chargingIconColorRow = new Adw.ActionRow({
            title: _('Charging Icon Color'),
            subtitle: _('Choose how the icon is colored while charging'),
        });
        addIcon(chargingIconColorRow, 'battery-full-charging-symbolic');
        const chargingIconColorDropDown = makeColorModeDropDown('charging-icon-color-source');
        chargingIconColorRow.add_suffix(chargingIconColorDropDown);
        styleGroup.add(chargingIconColorRow);

        const customIconColorRow = new Adw.ActionRow({
            title: _('Custom Charging Icon Color'),
            subtitle: _('Used only when Charging Icon Color is set to Custom'),
        });
        addIcon(customIconColorRow, 'color-select-symbolic');
        const customIconColorButton = makeColorButton('charging-icon-custom-color', _('Select Charging Icon Color'));
        customIconColorRow.add_suffix(customIconColorButton);
        styleGroup.add(customIconColorRow);

        const showColoredTextRow = new Adw.ActionRow({
            title: _('Color Gradient Text'),
            subtitle: _('Apply the normal red-to-green gradient to text'),
        });
        addIcon(showColoredTextRow, 'font-x-generic-symbolic');
        const showColoredTextSwitch = new Gtk.Switch({
            active: settings.get_boolean('show-colored-text'),
            valign: Gtk.Align.CENTER,
        });
        settings.bind('show-colored-text', showColoredTextSwitch, 'active', Gio.SettingsBindFlags.DEFAULT);
        showColoredTextRow.add_suffix(showColoredTextSwitch);
        styleGroup.add(showColoredTextRow);

        const textColorSourceRow = new Adw.ActionRow({
            title: _('Charging Text Color'),
            subtitle: _('Choose the color used by text while the battery is charging'),
        });
        addIcon(textColorSourceRow, 'battery-full-charging-symbolic');
        const textColorSourceDropDown = makeColorModeDropDown('charging-text-color-source');
        textColorSourceRow.add_suffix(textColorSourceDropDown);
        styleGroup.add(textColorSourceRow);

        const customTextColorRow = new Adw.ActionRow({
            title: _('Custom Charging Text Color'),
            subtitle: _('Used only when Charging Text Color is set to Custom'),
        });
        addIcon(customTextColorRow, 'color-select-symbolic');
        const customTextColorButton = makeColorButton('charging-text-custom-color', _('Select Charging Text Color'));
        customTextColorRow.add_suffix(customTextColorButton);
        styleGroup.add(customTextColorRow);

        const textStrokeRow = new Adw.ActionRow({
            title: _('Text Stroke'),
            subtitle: _('Draw dark outline around text for better visibility'),
        });
        addIcon(textStrokeRow, 'format-text-strikethrough-symbolic');
        const textStrokeSwitch = new Gtk.Switch({
            active: settings.get_boolean('text-stroke'),
            valign: Gtk.Align.CENTER,
        });
        settings.bind('text-stroke', textStrokeSwitch, 'active', Gio.SettingsBindFlags.DEFAULT);
        textStrokeRow.add_suffix(textStrokeSwitch);
        styleGroup.add(textStrokeRow);

        // Group: Dimensions (Dynamic visibility)
        const dimensionsGroup = new Adw.PreferencesGroup({
            title: _('Dimensions'),
        });

        // Bar Dimensions
        const barOrientationRow = new Adw.ActionRow({ title: _('Bar Orientation') });
        addIcon(barOrientationRow, 'object-rotate-right-symbolic');
        const barOrientationModel = Gtk.StringList.new([_('portrait'), _('landscape')]);
        const barOrientationDropDown = new Gtk.DropDown({
            valign: Gtk.Align.CENTER,
            model: barOrientationModel,
        });
        const barOrientationMap = { portrait: 0, landscape: 1 };
        const barOrientationCurrent = settings.get_string('bar-orientation');
        barOrientationDropDown.set_selected(barOrientationMap[barOrientationCurrent] ?? 0);
        barOrientationDropDown.connect('notify::selected', widget => {
            const idx = widget.get_selected();
            const val = ['portrait', 'landscape'][idx];
            settings.set_string('bar-orientation', val);
        });
        barOrientationRow.add_suffix(barOrientationDropDown);
        dimensionsGroup.add(barOrientationRow);

        const batteryWidthRow = new Adw.ActionRow({ title: _('Icon Width') });
        addIcon(batteryWidthRow, 'zoom-fit-best-symbolic');
        const batteryWidthSpin = new Gtk.SpinButton({
            adjustment: new Gtk.Adjustment({ lower: 25, upper: 50, step_increment: 1 }),
            valign: Gtk.Align.CENTER,
        });
        settings.bind('battery-size', batteryWidthSpin, 'value', Gio.SettingsBindFlags.DEFAULT);
        batteryWidthRow.add_suffix(batteryWidthSpin);
        dimensionsGroup.add(batteryWidthRow);

        const batteryHeightRow = new Adw.ActionRow({ title: _('Icon Height') });
        addIcon(batteryHeightRow, 'view-fullscreen-symbolic');
        const batteryHeightSpin = new Gtk.SpinButton({
            adjustment: new Gtk.Adjustment({ lower: 25, upper: 50, step_increment: 1 }),
            valign: Gtk.Align.CENTER,
        });
        settings.bind('battery-height', batteryHeightSpin, 'value', Gio.SettingsBindFlags.DEFAULT);
        batteryHeightRow.add_suffix(batteryHeightSpin);
        dimensionsGroup.add(batteryHeightRow);

        // Circle Dimensions
        const circleSizeRow = new Adw.ActionRow({ title: _('Circle Diameter') });
        addIcon(circleSizeRow, 'zoom-original-symbolic');
        const circleSizeSpin = new Gtk.SpinButton({
            adjustment: new Gtk.Adjustment({ lower: 25, upper: 50, step_increment: 1 }),
            valign: Gtk.Align.CENTER,
        });
        settings.bind('circle-size', circleSizeSpin, 'value', Gio.SettingsBindFlags.DEFAULT);
        circleSizeRow.add_suffix(circleSizeSpin);
        dimensionsGroup.add(circleSizeRow);

        stylePage.add(styleGroup);
        stylePage.add(dimensionsGroup);

        // Visibility Logic for Dimensions
        const updateDimensionVisibility = () => {
            const isCircle = settings.get_boolean('use-circle-indicator');
            const isStock = settings.get_boolean('use-stock-icon');
            const iconGradientEnabled = settings.get_boolean('show-colored');
            const textGradientEnabled = settings.get_boolean('show-colored-text');
            const useCustomIconColor = settings.get_string('charging-icon-color-source') === 'custom';
            const useCustomTextColor = settings.get_string('charging-text-color-source') === 'custom';
            barOrientationRow.visible = !isCircle && !isStock;
            batteryWidthRow.visible = !isCircle && !isStock;
            batteryHeightRow.visible = !isCircle && !isStock;
            circleSizeRow.visible = isCircle && !isStock;
            circleIndicatorRow.sensitive = !isStock;
            chargingIconColorRow.visible = iconGradientEnabled;
            customIconColorRow.visible = iconGradientEnabled;
            textColorSourceRow.visible = textGradientEnabled;
            customTextColorRow.visible = textGradientEnabled;
            customIconColorButton.set_sensitive(iconGradientEnabled && useCustomIconColor);
            customTextColorButton.set_sensitive(textGradientEnabled && useCustomTextColor);
            const iconDisabledTooltip = !iconGradientEnabled
                ? _('Disabled while Color Gradient Icon is off.')
                : _('Disabled while Charging Icon Color is not set to Custom.');
            const textDisabledTooltip = !textGradientEnabled
                ? _('Disabled while Color Gradient Text is off.')
                : _('Disabled while Charging Text Color is not set to Custom.');
            customIconColorRow.set_tooltip_text(useCustomIconColor && iconGradientEnabled ? null : iconDisabledTooltip);
            customIconColorButton.set_tooltip_text(
                useCustomIconColor && iconGradientEnabled ? null : iconDisabledTooltip,
            );
            customTextColorRow.set_tooltip_text(useCustomTextColor && textGradientEnabled ? null : textDisabledTooltip);
            customTextColorButton.set_tooltip_text(
                useCustomTextColor && textGradientEnabled ? null : textDisabledTooltip,
            );
        };
        settings.connect('changed::usecircleindicator', updateDimensionVisibility);
        settings.connect('changed::use-stock-icon', updateDimensionVisibility);
        settings.connect('changed::showcolored', updateDimensionVisibility);
        settings.connect('changed::showcoloredtext', updateDimensionVisibility);
        settings.connect('changed::charging-icon-color-source', updateDimensionVisibility);
        settings.connect('changed::charging-text-color-source', updateDimensionVisibility);
        updateDimensionVisibility();

        // Group: Auto-Hide Rules
        const visibilityGroup = new Adw.PreferencesGroup({
            title: _('Automatic Visibility'),
        });

        const hideChargingRow = new Adw.ActionRow({ title: _('Hide When Charging') });
        addIcon(hideChargingRow, 'battery-full-charging-symbolic');
        const hideChargingSwitch = new Gtk.Switch({
            active: settings.get_boolean('hide-charging'),
            valign: Gtk.Align.CENTER,
        });
        settings.bind('hide-charging', hideChargingSwitch, 'active', Gio.SettingsBindFlags.DEFAULT);
        hideChargingRow.add_suffix(hideChargingSwitch);
        visibilityGroup.add(hideChargingRow);

        const hideFullRow = new Adw.ActionRow({ title: _('Hide When Full') });
        addIcon(hideFullRow, 'battery-full-symbolic');
        const hideFullSwitch = new Gtk.Switch({
            active: settings.get_boolean('hide-full'),
            valign: Gtk.Align.CENTER,
        });
        settings.bind('hide-full', hideFullSwitch, 'active', Gio.SettingsBindFlags.DEFAULT);
        hideFullRow.add_suffix(hideFullSwitch);
        visibilityGroup.add(hideFullRow);

        const hideIdleRow = new Adw.ActionRow({ title: _('Hide When Idle/Not Present') });
        addIcon(hideIdleRow, 'battery-missing-symbolic');
        const hideIdleSwitch = new Gtk.Switch({
            active: settings.get_boolean('hide-idle'),
            valign: Gtk.Align.CENTER,
        });
        settings.bind('hide-idle', hideIdleSwitch, 'active', Gio.SettingsBindFlags.DEFAULT);
        hideIdleRow.add_suffix(hideIdleSwitch);
        visibilityGroup.add(hideIdleRow);

        stylePage.add(visibilityGroup);

        // === PAGE 4: DEBUG ===
        const debugPage = new Adw.PreferencesPage({
            title: _('Debug'),
            icon_name: 'applications-engineering-symbolic',
        });

        const debugGroup = new Adw.PreferencesGroup({
            title: _('Advanced'),
            description: _('Structured diagnostics with credential redaction.'),
        });
        const debugRow = new Adw.ActionRow({
            title: _('Enable Debug Mode'),
            subtitle: _('Verbose logging and build info'),
        });
        addIcon(debugRow, 'utilities-terminal-symbolic');
        const debugSwitch = new Gtk.Switch({
            active: settings.get_boolean('debug'),
            valign: Gtk.Align.CENTER,
        });
        settings.bind('debug', debugSwitch, 'active', Gio.SettingsBindFlags.DEFAULT);
        debugRow.add_suffix(debugSwitch);
        debugGroup.add(debugRow);

        const forceBoltRow = new Adw.ActionRow({
            title: _('Force Bolt Icon'),
            subtitle: _('Always show charging indicator (Test)'),
        });
        addIcon(forceBoltRow, 'emblem-important-symbolic');
        const forceBoltSwitch = new Gtk.Switch({
            active: settings.get_boolean('force-bolt'),
            valign: Gtk.Align.CENTER,
        });
        settings.bind('force-bolt', forceBoltSwitch, 'active', Gio.SettingsBindFlags.DEFAULT);
        forceBoltRow.add_suffix(forceBoltSwitch);
        debugGroup.add(forceBoltRow);

        const fakeChargingRow = new Adw.ActionRow({
            title: _('Fake Charging'),
            subtitle: _('Force charging state and animate a synthetic battery percentage for testing'),
        });
        addIcon(fakeChargingRow, 'battery-full-charging-symbolic');
        const fakeChargingSwitch = new Gtk.Switch({
            active: settings.get_boolean('fake-charging'),
            valign: Gtk.Align.CENTER,
        });
        settings.bind('fake-charging', fakeChargingSwitch, 'active', Gio.SettingsBindFlags.DEFAULT);
        fakeChargingRow.add_suffix(fakeChargingSwitch);
        fakeChargingSwitch.connect('notify::active', widget => {
            if (widget.active) settings.set_boolean('fake-discharging', false);
        });
        debugGroup.add(fakeChargingRow);

        const fakeDischargingRow = new Adw.ActionRow({
            title: _('Fake Discharging'),
            subtitle: _('Force discharging state and animate a synthetic battery percentage for testing'),
        });
        addIcon(fakeDischargingRow, 'battery-level-40-symbolic');
        const fakeDischargingSwitch = new Gtk.Switch({
            active: settings.get_boolean('fake-discharging'),
            valign: Gtk.Align.CENTER,
        });
        settings.bind('fake-discharging', fakeDischargingSwitch, 'active', Gio.SettingsBindFlags.DEFAULT);
        fakeDischargingRow.add_suffix(fakeDischargingSwitch);
        fakeDischargingSwitch.connect('notify::active', widget => {
            if (widget.active) settings.set_boolean('fake-charging', false);
        });
        debugGroup.add(fakeDischargingRow);

        const fakeChargeMinRow = new Adw.ActionRow({
            title: _('Fake Charge Min'),
            subtitle: _('Lower bound for the synthetic charging percentage'),
        });
        addIcon(fakeChargeMinRow, 'go-bottom-symbolic');
        const fakeChargeMinSpin = new Gtk.SpinButton({
            adjustment: new Gtk.Adjustment({ lower: 0, upper: 100, step_increment: 1 }),
            valign: Gtk.Align.CENTER,
        });
        settings.bind('fake-charge-min', fakeChargeMinSpin, 'value', Gio.SettingsBindFlags.DEFAULT);
        fakeChargeMinRow.add_suffix(fakeChargeMinSpin);
        debugGroup.add(fakeChargeMinRow);

        const fakeChargeMaxRow = new Adw.ActionRow({
            title: _('Fake Charge Max'),
            subtitle: _('Upper bound for the synthetic charging percentage'),
        });
        addIcon(fakeChargeMaxRow, 'go-top-symbolic');
        const fakeChargeMaxSpin = new Gtk.SpinButton({
            adjustment: new Gtk.Adjustment({ lower: 0, upper: 100, step_increment: 1 }),
            valign: Gtk.Align.CENTER,
        });
        settings.bind('fake-charge-max', fakeChargeMaxSpin, 'value', Gio.SettingsBindFlags.DEFAULT);
        fakeChargeMaxRow.add_suffix(fakeChargeMaxSpin);
        debugGroup.add(fakeChargeMaxRow);

        debugPage.add(debugGroup);

        // Logging Group
        const loggingGroup = new Adw.PreferencesGroup({ title: _('Logging') });

        const logLevelRow = new Adw.ActionRow({
            title: _('Log Level'),
            subtitle: _('Credentials and bearer values are always redacted'),
        });
        addIcon(logLevelRow, 'view-list-symbolic');
        const logLevelModel = Gtk.StringList.new([_('Verbose'), _('Debug'), _('Info'), _('Warn'), _('Error')]);
        const logLevelDropDown = new Gtk.DropDown({
            valign: Gtk.Align.CENTER,
            model: logLevelModel,
        });
        logLevelDropDown.set_selected(settings.get_int('log-level'));
        logLevelDropDown.connect('notify::selected', widget => {
            settings.set_int('log-level', widget.get_selected());
        });
        logLevelRow.add_suffix(logLevelDropDown);
        loggingGroup.add(logLevelRow);

        const logToFileRow = new Adw.ActionRow({
            title: _('Save Logs to File'),
            subtitle: _('Credentials and bearer values are always redacted'),
        });
        addIcon(logToFileRow, 'document-save-symbolic');
        const logToFileSwitch = new Gtk.Switch({
            active: settings.get_boolean('log-to-file'),
            valign: Gtk.Align.CENTER,
        });
        settings.bind('log-to-file', logToFileSwitch, 'active', Gio.SettingsBindFlags.DEFAULT);
        logToFileRow.add_suffix(logToFileSwitch);
        loggingGroup.add(logToFileRow);

        const logPathRow = new Adw.ActionRow({
            title: _('Log File Path'),
            subtitle: _('Default: Cache Directory'),
        });
        addIcon(logPathRow, 'text-x-generic-symbolic');
        const logPathEntry = new Gtk.Entry({
            text: settings.get_string('log-file-path'),
            valign: Gtk.Align.CENTER,
        });
        settings.bind('log-file-path', logPathEntry, 'text', Gio.SettingsBindFlags.DEFAULT);
        logPathRow.add_suffix(logPathEntry);
        const browseBtn = new Gtk.Button({
            label: _('Browse'),
            valign: Gtk.Align.CENTER,
            icon_name: 'folder-open-symbolic',
        });
        browseBtn.connect('clicked', openFolderChooser);
        logPathRow.add_suffix(browseBtn);
        loggingGroup.add(logPathRow);

        const openReq = new Adw.ActionRow({ title: _('Open Log Folder') });
        addIcon(openReq, 'folder-open-symbolic');
        const openBtn = new Gtk.Button({
            label: _('Open'),
            valign: Gtk.Align.CENTER,
            icon_name: 'folder-open-symbolic',
        });
        openBtn.connect('clicked', () => {
            const path = resolveLogPath();
            const folder = Gio.File.new_for_path(path).get_parent();
            if (folder) Gio.AppInfo.launch_default_for_uri(folder.get_uri(), null);
        });
        openReq.add_suffix(openBtn);
        loggingGroup.add(openReq);

        const clearReq = new Adw.ActionRow({ title: _('Clear Log File') });
        addIcon(clearReq, 'edit-delete-symbolic');
        const clearBtn = new Gtk.Button({
            label: _('Clear'),
            valign: Gtk.Align.CENTER,
            icon_name: 'user-trash-symbolic',
        });
        clearBtn.connect('clicked', () => {
            try {
                Gio.File.new_for_path(resolveLogPath()).delete(null);
                this._contentToastOverlay?.add_toast(new Adw.Toast({ title: _('Log file cleared') }));
            } catch (error) {
                const message = error.matches?.(Gio.IOErrorEnum, Gio.IOErrorEnum.NOT_FOUND)
                    ? _('The log file is already empty')
                    : safeErrorMessage(error);
                this._contentToastOverlay?.add_toast(new Adw.Toast({ title: message }));
            }
        });
        clearReq.add_suffix(clearBtn);
        loggingGroup.add(clearReq);

        debugPage.add(loggingGroup);

        // Diagnostics
        const diagnosticsGroup = new Adw.PreferencesGroup({ title: _('Diagnostics') });

        const diagnosticsRow = new Adw.ActionRow({
            title: _('Sanitized diagnostics'),
            subtitle: _('Copy configuration only; no file paths or personal data'),
        });
        addIcon(diagnosticsRow, 'edit-copy-symbolic');
        const copyDiagnosticsButton = new Gtk.Button({
            label: _('Copy'),
            icon_name: 'edit-copy-symbolic',
            valign: Gtk.Align.CENTER,
        });
        copyDiagnosticsButton.connect('clicked', () => {
            const diagnostics = {
                version: this.metadata['version-name'] ?? this.metadata.version ?? 'unknown',
                interval: settings.get_int('interval'),
                indicator: {
                    circular: settings.get_boolean('use-circle-indicator'),
                    stockIcon: settings.get_boolean('use-stock-icon'),
                    barOrientation: settings.get_string('bar-orientation'),
                    position: settings.get_string('indicator-position'),
                },
                display: {
                    percentage: settings.get_boolean('percentage'),
                    timeRemaining: settings.get_boolean('time-remaining'),
                    watts: settings.get_boolean('show-watts'),
                    decimals: settings.get_boolean('show-decimals'),
                },
                debug: {
                    enabled: settings.get_boolean('debug'),
                    level: settings.get_int('log-level'),
                    logToFile: settings.get_boolean('log-to-file'),
                },
            };
            try {
                copyText(JSON.stringify(diagnostics, null, 2));
                this._contentToastOverlay?.add_toast(new Adw.Toast({ title: _('Sanitized diagnostics copied') }));
            } catch (error) {
                this._contentToastOverlay?.add_toast(new Adw.Toast({ title: safeErrorMessage(error) }));
            }
        });
        diagnosticsRow.add_suffix(copyDiagnosticsButton);
        diagnosticsGroup.add(diagnosticsRow);

        const recentLogsRow = new Adw.ActionRow({
            title: _('Recent Log Events'),
            subtitle: _('View the last 80 sanitized file-log lines'),
        });
        addIcon(recentLogsRow, 'utilities-terminal-symbolic');
        const viewRecentLogsButton = new Gtk.Button({
            label: _('View'),
            icon_name: 'view-list-symbolic',
            valign: Gtk.Align.CENTER,
        });
        viewRecentLogsButton.connect('clicked', () => {
            const logWindow = new Adw.Window({
                title: _('Recent Log Events'),
                transient_for: window,
                modal: true,
                default_width: 760,
                default_height: 480,
            });
            const toolbarView = new Adw.ToolbarView();
            const headerBar = new Adw.HeaderBar();
            const refreshLogsButton = new Gtk.Button({
                label: _('Refresh'),
                icon_name: 'view-refresh-symbolic',
                tooltip_text: _('Reload recent sanitized log events'),
            });
            headerBar.pack_end(refreshLogsButton);
            toolbarView.add_top_bar(headerBar);
            const logView = new Gtk.TextView({
                editable: false,
                cursor_visible: false,
                monospace: true,
                wrap_mode: Gtk.WrapMode.WORD_CHAR,
                left_margin: 16,
                right_margin: 16,
                top_margin: 16,
                bottom_margin: 16,
            });
            const logBuffer = logView.get_buffer();
            const scrolled = new Gtk.ScrolledWindow({
                hexpand: true,
                vexpand: true,
                hscrollbar_policy: Gtk.PolicyType.NEVER,
            });
            scrolled.set_child(logView);
            toolbarView.set_content(scrolled);
            logWindow.set_content(toolbarView);

            const refreshRecentLogs = async () => {
                refreshLogsButton.sensitive = false;
                logBuffer.set_text(_('Loading recent sanitized log events…'), -1);
                try {
                    let message;
                    if (!settings.get_boolean('debug')) message = _('Enable Debug Mode to record diagnostic events.');
                    else if (!settings.get_boolean('log-to-file'))
                        message = _('Enable Save Logs to File to view recent events.');
                    else
                        message =
                            (await loadRecentLogEvents(resolveLogPath())) ||
                            _('No diagnostic events have been recorded yet.');
                    logBuffer.set_text(message, -1);
                } catch (error) {
                    logBuffer.set_text(`${_('Unable to read the sanitized log')}: ${safeErrorMessage(error)}`, -1);
                } finally {
                    refreshLogsButton.sensitive = true;
                }
            };
            refreshLogsButton.connect('clicked', () => void refreshRecentLogs());
            logWindow.present();
            void refreshRecentLogs();
        });
        recentLogsRow.add_suffix(viewRecentLogsButton);
        diagnosticsGroup.add(recentLogsRow);
        debugPage.add(diagnosticsGroup);

        // Visibility Logic for Debug
        const updateDebugVisibility = () => {
            const isDebug = settings.get_boolean('debug');
            const logToFile = settings.get_boolean('log-to-file');
            const fakeCharging = settings.get_boolean('fake-charging') || settings.get_boolean('fake-discharging');
            loggingGroup.visible = isDebug;
            fakeChargingRow.visible = isDebug;
            fakeDischargingRow.visible = isDebug;
            fakeChargeMinRow.visible = isDebug && fakeCharging;
            fakeChargeMaxRow.visible = isDebug && fakeCharging;
            logPathRow.visible = isDebug && logToFile;
            browseBtn.visible = isDebug && logToFile;
            openReq.visible = isDebug && logToFile;
            clearReq.visible = isDebug && logToFile;
        };
        settings.connect('changed::debug', updateDebugVisibility);
        settings.connect('changed::fake-charging', updateDebugVisibility);
        settings.connect('changed::fake-discharging', updateDebugVisibility);
        settings.connect('changed::log-to-file', updateDebugVisibility);
        updateDebugVisibility();

        // === PAGE 5: CHANGELOG ===
        const changelogPage = new Adw.PreferencesPage({
            title: _('Changelog'),
            icon_name: 'x-office-document-symbolic',
        });
        const changelogGroup = new Adw.PreferencesGroup({
            title: _(`Latest Changes`),
        });
        const changelogLabel = new Gtk.Label({
            label: CHANGELOG,
            wrap: true,
            xalign: 0,
            selectable: true,
            margin_top: 24,
            margin_bottom: 24,
            margin_start: 12,
            margin_end: 12,
        });
        changelogGroup.add(changelogLabel);
        changelogPage.add(changelogGroup);

        // === PAGE 6: ABOUT ===
        const aboutPage = new Adw.PreferencesPage({
            title: _('About'),
            icon_name: 'help-about-symbolic',
        });
        const versionName = this.metadata['version-name'] ?? this.metadata.version ?? _('Unknown');
        const projectGroup = new Adw.PreferencesGroup({
            title: _('Project Information'),
        });

        const versionRow = new Adw.ActionRow({
            title: _('Extension version'),
            subtitle: String(versionName),
        });
        addIcon(versionRow, 'application-x-addon-symbolic');
        projectGroup.add(versionRow);

        const buildDateRow = new Adw.ActionRow({
            title: _('Build date'),
            subtitle: BUILD_DATE ?? _('Development source'),
        });
        addIcon(buildDateRow, 'x-office-calendar-symbolic');
        projectGroup.add(buildDateRow);

        const buildIdRow = new Adw.ActionRow({
            title: _('Build ID'),
            subtitle: BUILD_ID,
        });
        addIcon(buildIdRow, 'emblem-system-symbolic');
        projectGroup.add(buildIdRow);

        const updateAboutInfo = () => {
            const isDebug = settings.get_boolean('debug');
            buildDateRow.visible = isDebug;
            buildIdRow.visible = isDebug;
        };
        settings.connect('changed::debug', updateAboutInfo);
        updateAboutInfo();

        const dataSourceRow = new Adw.ActionRow({
            title: _('Data source'),
            subtitle: _('Battery status is read from UPower and /sys/class/power_supply.'),
        });
        addIcon(dataSourceRow, 'security-high-symbolic');
        projectGroup.add(dataSourceRow);

        const descriptionRow = new Adw.ActionRow({
            title: _('About this extension'),
            subtitle: _('Battery percentage, time remaining, and real-time power draw in the GNOME panel.'),
        });
        addIcon(descriptionRow, 'application-x-addon-symbolic');
        projectGroup.add(descriptionRow);

        const linkRow = new Adw.ActionRow({
            title: _('Project Homepage'),
            subtitle: PROJECT_URL,
        });
        addIcon(linkRow, 'web-browser-symbolic');
        linkRow.add_suffix(
            new Gtk.LinkButton({
                uri: PROJECT_URL,
                icon_name: 'external-link-symbolic',
                valign: Gtk.Align.CENTER,
            }),
        );
        projectGroup.add(linkRow);

        const reportRow = new Adw.ActionRow({
            title: _('Report an Issue'),
            subtitle: _('Found a bug? Let us know.'),
        });
        addIcon(reportRow, 'tools-check-spelling-symbolic');
        reportRow.add_suffix(
            new Gtk.LinkButton({
                uri: ISSUE_URL,
                icon_name: 'external-link-symbolic',
                valign: Gtk.Align.CENTER,
            }),
        );
        projectGroup.add(reportRow);

        aboutPage.add(projectGroup);

        // Add pages to window
        this._addPage(generalPage);
        this._addPage(appearancePage);
        this._addPage(stylePage);
        this._addPage(debugPage);
        this._addPage(changelogPage);
        this._addPage(aboutPage);
    }
}
