'use strict';

import Gio from 'gi://Gio';
import Gtk from 'gi://Gtk';
import Adw from 'gi://Adw';

import { ExtensionPreferences, gettext as _ } from 'resource:///org/gnome/Shell/Extensions/js/extensions/prefs.js';

const BUILD_DATE = '2026-01-17T12:04:34.878Z';
const CHANGELOG = `
SYNCHRONOUS, VISUALS & CLEANUP

MAJOR REFACTOR & STABILITY RELEASE

Synchronous Core Architecture:

The Change: We completely removed the asynchronous idle_add pattern used in v17. The UI updateUI function is now fully synchronous.

Why Better (Determinism): Asynchronous updates introduced "desync" race conditions where the internal state (battery level) and visual state (icon) could drift apart during rapid changes. Sync updates ensure atomic consistency—what you see is exactly what the system reports, instantly.

Trade-off Mitigation: While synchronous drawing on the main thread carries a risk of UI lag, we mitigated this by enforcing strict SVG Caching. Since heavy rendering is cached, the synchronous update is extremely lightweight (~microsecond scale), giving us the best of both worlds: instant updates with zero performance penalty.

Global Visibility Logic Refactor:

Previous Flaw: Hiding the indicator in v17 occasionally left "phantom" spacing or failed to override GNOME's native icon fully because the override hook wasn't strictly enforced.

The Fix: The sync.js module now enforces a strict "nothing to show" contract. When "Hide when Charging" is active, the extension explicitly returns false to GNOME Shell's visibility checks, ensuring a cleaner panel layout.

Modular Library Architecture:

Refactor: We have moved away from the monolithic extension.js design. Core logic is now split into specific modules under extension/library/: drawing (Cairo/SVG), sync (GNOME overrides), indicators (Battery/Circle), system (Panel), and upower (Device).

Why: This separation of concerns allows for safer feature additions, easier debugging, and reusable components (like the new Logger and Settings modules) without risking the stability of the main extension entry point.

Memory Prevention Strategy:

Refactor: Wired the v17 SVG_CACHE logic directly into the main update loop via purgeSvgCache().

Why: Caching without cleanup is just a memory leak by another name. v18 actively prunes unused surfaces (every 60s) and forces a deep clean on disable. This makes the extension robust enough for weeks of continuous runtime without bloating the heap.

Visual Refinement:

Centered Bolt: The charging bolt icon is now perfectly centered within the battery bar.

Dynamic Text Sizing: Percentage text in the battery bar now adapts to both width and height, maximizing readability while preventing overflow on narrow configurations.

Build & Integrity System:

Schema Validation: Introduced .build-schema.json to enforce strict file inclusion rules. The build pipeline now recursively scans the extension/ directory and fails if any unknown or unexpected files are present.

EGO Compliance: This mechanism guarantees that release artifacts are clean, containing only the files explicitly required by GNOME Shell, adhering to Extension.gnome.org (EGO) review guidelines.

Cleanup:

Renamed:

scripts/ to .scripts/

screenshot/ to .screenshot/

Why: To de-clutter the root directory.

Defaults:

Updated default dimensions to 34x40 (Bar) and 36 (Circle) for better out-of-the-box aesthetics.

Why: These dimensions provide a good balance between visibility and minimalism, ensuring the extension is both functional and aesthetically pleasing.

Refactoring settings:

Added icons and vertical settings panel to use the new Settings module.

Why: This refactoring improves the maintainability and scalability of the settings panel, making it easier to add new options and features in the future.

Upgrading the ESLint config:

ESLint 9.0.0: Upgraded to the latest version of ESLint.

Why: This upgrade ensures that the codebase adheres to the latest best practices and standards, improving code quality and maintainability.

Upgrading the build pipeline:

Why: This upgrade ensures that the codebase adheres to the latest best practices and standards, improving code quality and maintainability.`;

export default class BattConsumptionPreferences extends ExtensionPreferences {
    _switchToNavigationSplitViews(window) {
        // Add dummy Adw.PreferencesPage to avoid logs spamming
        const dummyPrefsPage = new Adw.PreferencesPage();
        window.add(dummyPrefsPage);

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
        logPathEntry.connect('changed', () => settings.set_string('logfilepath', logPathEntry.get_text()));
        logPathRow.add_suffix(logPathEntry);
        loggingGroup.add(logPathRow);
        debugPage.add(loggingGroup);

        // Visibility Logic for Debug
        const updateDebugVisibility = () => {
            const isDebug = settings.get_boolean('debug');
            loggingGroup.visible = isDebug;
            logPathRow.visible = isDebug && settings.get_boolean('logtofile');
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
