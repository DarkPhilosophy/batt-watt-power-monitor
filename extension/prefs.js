'use strict';

import Gio from 'gi://Gio';
import Gtk from 'gi://Gtk';
import Adw from 'gi://Adw';
import GLib from 'gi://GLib';

import { ExtensionPreferences, gettext as _ } from 'resource:///org/gnome/Shell/Extensions/js/extensions/prefs.js';

const BUILD_DATE = '2026-01-29T14:56:49.360Z';
const CHANGELOG = `
PREFERENCES & LOGGING REFINEMENTS

PREFERENCES & LOGGING REFINEMENTS

Attach the first real PreferencesPage to the window (avoids Adw warnings without dummy pages).

Logging UI: Open Log Folder + Clear Log File actions (shown only when debug + file logging enabled).

Log file path resolution now respects custom paths and defaults to cache directory when empty.`;

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

        // Helper to add icon to row
        const addIcon = (row, iconName) => {
            const icon = new Gtk.Image({
                icon_name: iconName,
            });
            row.add_prefix(icon);
        };

        const logBaseName = 'Batt Watt Power Monitor'.replace(/[^a-z0-9]/gi, '_').toLowerCase();
        const resolveLogPath = () => {
            const configured = (settings.get_string('logfilepath') || '').trim();
            let fullPath = '';
            if (configured.length === 0) {
                fullPath = `${GLib.get_user_cache_dir()}/${logBaseName}.log`;
            } else if (configured.startsWith('/')) {
                fullPath = configured;
            } else {
                fullPath = `${GLib.get_home_dir()}/${configured}`;
            }

            if (GLib.file_test(fullPath, GLib.FileTest.IS_DIR)) {
                const base = fullPath.replace(/\/$/, '');
                return `${base}/${logBaseName}.log`;
            }

            return fullPath;
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
                    if (folderPath) settings.set_string('logfilepath', folderPath);
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
            active: settings.get_boolean('showicon'),
            valign: Gtk.Align.CENTER,
        });
        settings.bind('showicon', showIconSwitch, 'active', Gio.SettingsBindFlags.DEFAULT);
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
            active: settings.get_boolean('showpercentageoutside'),
            valign: Gtk.Align.CENTER,
        });
        settings.bind('showpercentageoutside', percentageOutsideSwitch, 'active', Gio.SettingsBindFlags.DEFAULT);
        percentageOutsideRow.add_suffix(percentageOutsideSwitch);
        elementsGroup.add(percentageOutsideRow);

        // Time Remaining
        const timeRemainingRow = new Adw.ActionRow({
            title: _('Show Time Remaining'),
            subtitle: _('Estimated time to empty/full'),
        });
        addIcon(timeRemainingRow, 'alarm-symbolic');
        const timeRemainingSwitch = new Gtk.Switch({
            active: (function () {
                try {
                    return settings.get_boolean('timeremaining');
                } catch (_e) {
                    return false;
                }
            })(),
            valign: Gtk.Align.CENTER,
        });
        settings.bind('timeremaining', timeRemainingSwitch, 'active', Gio.SettingsBindFlags.DEFAULT);
        timeRemainingRow.add_suffix(timeRemainingSwitch);
        elementsGroup.add(timeRemainingRow);

        // Watts
        const showWattsRow = new Adw.ActionRow({
            title: _('Show Power (Watts)'),
            subtitle: _('Current power consumption/charging rate'),
        });
        addIcon(showWattsRow, 'thunderbolt-symbolic');
        const showWattsSwitch = new Gtk.Switch({
            active: settings.get_boolean('showwatts'),
            valign: Gtk.Align.CENTER,
        });
        settings.bind('showwatts', showWattsSwitch, 'active', Gio.SettingsBindFlags.DEFAULT);
        showWattsRow.add_suffix(showWattsSwitch);
        elementsGroup.add(showWattsRow);

        const showDecimalsRow = new Adw.ActionRow({
            title: _('Precision Mode'),
            subtitle: _('Show 2 decimal places (e.g., 15.42W)'),
        });
        addIcon(showDecimalsRow, 'input-dialpad-symbolic');
        const showDecimalsSwitch = new Gtk.Switch({
            active: settings.get_boolean('showdecimals'),
            valign: Gtk.Align.CENTER,
        });
        settings.bind('showdecimals', showDecimalsSwitch, 'active', Gio.SettingsBindFlags.DEFAULT);
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
            active: settings.get_boolean('usecircleindicator'),
            valign: Gtk.Align.CENTER,
        });
        settings.bind('usecircleindicator', circleIndicatorSwitch, 'active', Gio.SettingsBindFlags.DEFAULT);
        circleIndicatorRow.add_suffix(circleIndicatorSwitch);
        styleGroup.add(circleIndicatorRow);

        const showColoredRow = new Adw.ActionRow({
            title: _('Colored Ring'),
            subtitle: _('Use colors to indicate charge level'),
        });
        addIcon(showColoredRow, 'applications-graphics-symbolic');
        const showColoredSwitch = new Gtk.Switch({
            active: settings.get_boolean('showcolored'),
            valign: Gtk.Align.CENTER,
        });
        settings.bind('showcolored', showColoredSwitch, 'active', Gio.SettingsBindFlags.DEFAULT);
        showColoredRow.add_suffix(showColoredSwitch);
        styleGroup.add(showColoredRow);

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
        settings.bind('batterysize', batteryWidthSpin, 'value', Gio.SettingsBindFlags.DEFAULT);
        batteryWidthRow.add_suffix(batteryWidthSpin);
        dimensionsGroup.add(batteryWidthRow);

        const batteryHeightRow = new Adw.ActionRow({ title: _('Icon Height') });
        addIcon(batteryHeightRow, 'view-fullscreen-symbolic');
        const batteryHeightSpin = new Gtk.SpinButton({
            adjustment: new Gtk.Adjustment({ lower: 25, upper: 50, step_increment: 1 }),
            valign: Gtk.Align.CENTER,
        });
        settings.bind('batteryheight', batteryHeightSpin, 'value', Gio.SettingsBindFlags.DEFAULT);
        batteryHeightRow.add_suffix(batteryHeightSpin);
        dimensionsGroup.add(batteryHeightRow);

        // Circle Dimensions
        const circleSizeRow = new Adw.ActionRow({ title: _('Circle Diameter') });
        addIcon(circleSizeRow, 'zoom-original-symbolic');
        const circleSizeSpin = new Gtk.SpinButton({
            adjustment: new Gtk.Adjustment({ lower: 25, upper: 50, step_increment: 1 }),
            valign: Gtk.Align.CENTER,
        });
        settings.bind('circlesize', circleSizeSpin, 'value', Gio.SettingsBindFlags.DEFAULT);
        circleSizeRow.add_suffix(circleSizeSpin);
        dimensionsGroup.add(circleSizeRow);

        stylePage.add(styleGroup);
        stylePage.add(dimensionsGroup);

        // Visibility Logic for Dimensions
        const updateDimensionVisibility = () => {
            const isCircle = settings.get_boolean('usecircleindicator');
            barOrientationRow.visible = !isCircle;
            batteryWidthRow.visible = !isCircle;
            batteryHeightRow.visible = !isCircle;
            circleSizeRow.visible = isCircle;
        };
        settings.connect('changed::usecircleindicator', updateDimensionVisibility);
        updateDimensionVisibility();

        // Group: Auto-Hide Rules
        const visibilityGroup = new Adw.PreferencesGroup({
            title: _('Automatic Visibility'),
        });

        const hideChargingRow = new Adw.ActionRow({ title: _('Hide When Charging') });
        addIcon(hideChargingRow, 'battery-level-charging-symbolic'); // Fallback icon
        const hideChargingSwitch = new Gtk.Switch({
            active: settings.get_boolean('hidecharging'),
            valign: Gtk.Align.CENTER,
        });
        settings.bind('hidecharging', hideChargingSwitch, 'active', Gio.SettingsBindFlags.DEFAULT);
        hideChargingRow.add_suffix(hideChargingSwitch);
        visibilityGroup.add(hideChargingRow);

        const hideFullRow = new Adw.ActionRow({ title: _('Hide When Full') });
        addIcon(hideFullRow, 'battery-full-symbolic');
        const hideFullSwitch = new Gtk.Switch({
            active: settings.get_boolean('hidefull'),
            valign: Gtk.Align.CENTER,
        });
        settings.bind('hidefull', hideFullSwitch, 'active', Gio.SettingsBindFlags.DEFAULT);
        hideFullRow.add_suffix(hideFullSwitch);
        visibilityGroup.add(hideFullRow);

        const hideIdleRow = new Adw.ActionRow({ title: _('Hide When Idle/Not Present') });
        addIcon(hideIdleRow, 'battery-missing-symbolic');
        const hideIdleSwitch = new Gtk.Switch({
            active: settings.get_boolean('hideidle'),
            valign: Gtk.Align.CENTER,
        });
        settings.bind('hideidle', hideIdleSwitch, 'active', Gio.SettingsBindFlags.DEFAULT);
        hideIdleRow.add_suffix(hideIdleSwitch);
        visibilityGroup.add(hideIdleRow);

        stylePage.add(visibilityGroup);

        // === PAGE 4: DEBUG ===
        const debugPage = new Adw.PreferencesPage({
            title: _('Debug'),
            icon_name: 'applications-engineering-symbolic',
        });

        const debugGroup = new Adw.PreferencesGroup({ title: _('Advanced') });
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
            active: settings.get_boolean('forcebolt'),
            valign: Gtk.Align.CENTER,
        });
        settings.bind('forcebolt', forceBoltSwitch, 'active', Gio.SettingsBindFlags.DEFAULT);
        forceBoltRow.add_suffix(forceBoltSwitch);
        debugGroup.add(forceBoltRow);
        debugPage.add(debugGroup);

        // Logging Group
        const loggingGroup = new Adw.PreferencesGroup({ title: _('Logging') });

        const logLevelRow = new Adw.ActionRow({ title: _('Log Level') });
        addIcon(logLevelRow, 'view-list-symbolic');
        const logLevelModel = Gtk.StringList.new([_('Verbose'), _('Debug'), _('Info'), _('Warn'), _('Error')]);
        const logLevelDropDown = new Gtk.DropDown({
            valign: Gtk.Align.CENTER,
            model: logLevelModel,
        });
        logLevelDropDown.set_selected(settings.get_int('loglevel'));
        logLevelDropDown.connect('notify::selected', widget => {
            settings.set_int('loglevel', widget.get_selected());
        });
        logLevelRow.add_suffix(logLevelDropDown);
        loggingGroup.add(logLevelRow);

        const logToFileRow = new Adw.ActionRow({ title: _('Save Logs to File') });
        addIcon(logToFileRow, 'document-save-symbolic');
        const logToFileSwitch = new Gtk.Switch({
            active: settings.get_boolean('logtofile'),
            valign: Gtk.Align.CENTER,
        });
        settings.bind('logtofile', logToFileSwitch, 'active', Gio.SettingsBindFlags.DEFAULT);
        logToFileRow.add_suffix(logToFileSwitch);
        loggingGroup.add(logToFileRow);

        const logPathRow = new Adw.ActionRow({
            title: _('Log File Path'),
            subtitle: _('Default: Cache Directory'),
        });
        addIcon(logPathRow, 'folder-symbolic');
        const logPathEntry = new Gtk.Entry({
            text: settings.get_string('logfilepath'),
            valign: Gtk.Align.CENTER,
        });
        settings.bind('logfilepath', logPathEntry, 'text', Gio.SettingsBindFlags.DEFAULT);
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
            } catch (_e) {
                /* ignore */
            }
        });
        clearReq.add_suffix(clearBtn);
        loggingGroup.add(clearReq);

        debugPage.add(loggingGroup);

        // Visibility Logic for Debug
        const updateDebugVisibility = () => {
            const isDebug = settings.get_boolean('debug');
            const logToFile = settings.get_boolean('logtofile');
            loggingGroup.visible = isDebug;
            logPathRow.visible = isDebug && logToFile;
            browseBtn.visible = isDebug && logToFile;
            openReq.visible = isDebug && logToFile;
            clearReq.visible = isDebug && logToFile;
        };
        settings.connect('changed::debug', updateDebugVisibility);
        settings.connect('changed::logtofile', updateDebugVisibility);
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
        const versionName = this.metadata['version-name'] ?? this.metadata.version ?? 'Unknown';
        const projectGroup = new Adw.PreferencesGroup({
            title: _('Project Information'),
            description: _(`Version: ${versionName}`), // Initial value
        });

        // Dynamic update for Build Date
        const updateAboutInfo = () => {
            let descriptionText = `Version: ${versionName}`;
            if (settings.get_boolean('debug')) {
                descriptionText += `\nBuild Date: ${BUILD_DATE}`;
            }
            projectGroup.set_description(_(descriptionText));
        };
        settings.connect('changed::debug', updateAboutInfo);
        updateAboutInfo(); // Set initial state correctly

        const linkRow = new Adw.ActionRow({
            title: _('Project Homepage'),
            subtitle: 'https://github.com/DarkPhilosophy/batt-watt-power-monitor',
        });
        addIcon(linkRow, 'web-browser-symbolic');
        const linkButton = new Gtk.LinkButton({
            uri: 'https://github.com/DarkPhilosophy/batt-watt-power-monitor',
            icon_name: 'external-link-symbolic',
            valign: Gtk.Align.CENTER,
        });
        linkRow.add_suffix(linkButton);
        projectGroup.add(linkRow);

        const reportRow = new Adw.ActionRow({
            title: _('Report an Issue'),
            subtitle: _('Found a bug? Let us know!'),
        });
        addIcon(reportRow, 'tools-check-spelling-symbolic'); // Bug/Report equivalent
        const reportButton = new Gtk.LinkButton({
            uri: 'https://github.com/DarkPhilosophy/batt-watt-power-monitor/issues',
            icon_name: 'external-link-symbolic',
            valign: Gtk.Align.CENTER,
        });
        reportRow.add_suffix(reportButton);
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
