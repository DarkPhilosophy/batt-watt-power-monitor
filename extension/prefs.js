'use strict';

import Gio from 'gi://Gio';
import Gtk from 'gi://Gtk';
import Adw from 'gi://Adw';

import {ExtensionPreferences, gettext as _} from 'resource:///org/gnome/Shell/Extensions/js/extensions/prefs.js';

const BUILD_DATE = null;

export default class BattConsumptionPreferences extends ExtensionPreferences {
    fillPreferencesWindow(window) {
        const settings = this.getSettings();
        window.default_width = 900;
        window.set_title(_('Battery Power Monitor: Watts & Time Extension'));

        const page = new Adw.PreferencesPage({
            title: _('General'),
        });
        const modePage = new Adw.PreferencesPage({
            title: _('Battery Bar'),
        });
        const debugPage = new Adw.PreferencesPage({
            title: _('Debug'),
        });

        /*
         * Version Information
         */
        const versionName = this.metadata['version-name'] ?? this.metadata.version ?? 'Unknown';
        const versionLabel = _('Version ') + versionName;
        const mainGroup = new Adw.PreferencesGroup({
            title: _('Battery Power Monitor'),
            description: _(`${versionLabel}`),
        });
        const updateDescription = () => {
            if (settings.get_boolean('debug')) {
                const buildDate = BUILD_DATE ? BUILD_DATE : _('Undefined');
                mainGroup.description = _(`${versionLabel} - ${_('Build: ')}${buildDate}`);
            } else {
                mainGroup.description = _(`${versionLabel}`);
            }
        };
        settings.connect('changed::debug', updateDescription);
        updateDescription();
        page.add(mainGroup);

        /*
         * Project Link
         */
        const linkRow = new Adw.ActionRow({
            title: _('Project Homepage'),
            subtitle: 'https://github.com/DarkPhilosophy/batt-watt-power-monitor',
        });

        const linkButton = new Gtk.LinkButton({
            uri: 'https://github.com/DarkPhilosophy/batt-watt-power-monitor',
            icon_name: 'go-next-symbolic',
            valign: Gtk.Align.CENTER,
        });
        linkRow.add_suffix(linkButton);
        mainGroup.add(linkRow);

        /*
         * Settings
         */
        const settingsGroup = new Adw.PreferencesGroup({
            title: _('Display Settings'),
        });
        page.add(settingsGroup);

        const intervalRow = new Adw.ActionRow({
            title: _('Interval (seconds)'),
            subtitle: _('Refresh rate for battery readings'),
        });
        const intervalAdjustment = new Gtk.Adjustment({
            lower: 1,
            upper: 15,
            step_increment: 1,
        });
        const intervalSpinButton = new Gtk.SpinButton({
            adjustment: intervalAdjustment,
            valign: Gtk.Align.CENTER,
        });
        settings.bind('interval', intervalSpinButton, 'value', Gio.SettingsBindFlags.DEFAULT);
        intervalRow.add_suffix(intervalSpinButton);
        settingsGroup.add(intervalRow);

        const showIconRow = new Adw.ActionRow({
            title: _('Show battery icon'),
            subtitle: _('Toggle the panel icon'),
        });
        const showIconSwitch = new Gtk.Switch({
            active: settings.get_boolean('showicon'),
            valign: Gtk.Align.CENTER,
        });
        settings.bind('showicon', showIconSwitch, 'active', Gio.SettingsBindFlags.DEFAULT);
        showIconRow.add_suffix(showIconSwitch);
        settingsGroup.add(showIconRow);

        const circleIndicatorRow = new Adw.ActionRow({
            title: _('Use circular indicator'),
            subtitle: _('Replace battery icon with a color ring meter'),
        });
        const circleIndicatorSwitch = new Gtk.Switch({
            active: settings.get_boolean('usecircleindicator'),
            valign: Gtk.Align.CENTER,
        });
        settings.bind('usecircleindicator', circleIndicatorSwitch, 'active', Gio.SettingsBindFlags.DEFAULT);
        circleIndicatorRow.add_suffix(circleIndicatorSwitch);
        settingsGroup.add(circleIndicatorRow);

        const showColoredRow = new Adw.ActionRow({
            title: _('Show colored'),
            subtitle: _('Enable colored ring/text for the circle; disable to force monochrome (wastes the color)'),
        });
        const showColoredSwitch = new Gtk.Switch({
            active: settings.get_boolean('showcolored'),
            valign: Gtk.Align.CENTER,
        });
        settings.bind('showcolored', showColoredSwitch, 'active', Gio.SettingsBindFlags.DEFAULT);
        showColoredRow.add_suffix(showColoredSwitch);
        settingsGroup.add(showColoredRow);

        const percentageRow = new Adw.ActionRow({
            title: _('Show percentage'),
            subtitle: _('Show battery percent text in the panel'),
        });
        const percentageSwitch = new Gtk.Switch({
            active: settings.get_boolean('percentage'),
            valign: Gtk.Align.CENTER,
        });
        settings.bind('percentage', percentageSwitch, 'active', Gio.SettingsBindFlags.DEFAULT);
        percentageRow.add_suffix(percentageSwitch);
        settingsGroup.add(percentageRow);

        const percentageOutsideRow = new Adw.ActionRow({
            title: _('Show percentage outside icons'),
            subtitle: _('Show percentage as text outside the icon'),
        });
        const percentageOutsideSwitch = new Gtk.Switch({
            active: settings.get_boolean('showpercentageoutside'),
            valign: Gtk.Align.CENTER,
        });
        settings.bind('showpercentageoutside', percentageOutsideSwitch, 'active', Gio.SettingsBindFlags.DEFAULT);
        percentageOutsideRow.add_suffix(percentageOutsideSwitch);
        settingsGroup.add(percentageOutsideRow);

        const timeRemainingRow = new Adw.ActionRow({
            title: _('Show time remaining'),
            subtitle: _('Show time to full or time to empty'),
        });
        const timeRemainingSwitch = new Gtk.Switch({
            active: (function () {
                try {
                    return settings.get_boolean('timeremaining');
                } catch (e) {
                    log('batt-watt-power-monitor: missing key timeremaining, using default');
                    return false;
                }
            })(),
            valign: Gtk.Align.CENTER,
        });
        settings.bind('timeremaining', timeRemainingSwitch, 'active', Gio.SettingsBindFlags.DEFAULT);
        timeRemainingRow.add_suffix(timeRemainingSwitch);
        settingsGroup.add(timeRemainingRow);

        const showWattsRow = new Adw.ActionRow({
            title: _('Show watts consumption'),
            subtitle: _('Show charge/discharge power in Watts'),
        });
        const showWattsSwitch = new Gtk.Switch({
            active: settings.get_boolean('showwatts'),
            valign: Gtk.Align.CENTER,
        });
        settings.bind('showwatts', showWattsSwitch, 'active', Gio.SettingsBindFlags.DEFAULT);
        showWattsRow.add_suffix(showWattsSwitch);
        settingsGroup.add(showWattsRow);

        const showDecimalsRow = new Adw.ActionRow({
            title: _('Enable 2-digit decimal'),
            subtitle: _('Display precise wattage (e.g. 15.75W)'),
        });
        const showDecimalsSwitch = new Gtk.Switch({
            active: settings.get_boolean('showdecimals'),
            valign: Gtk.Align.CENTER,
        });
        settings.bind('showdecimals', showDecimalsSwitch, 'active', Gio.SettingsBindFlags.DEFAULT);
        showDecimalsRow.add_suffix(showDecimalsSwitch);
        settingsGroup.add(showDecimalsRow);

        const batteryRow = new Adw.ActionRow({
            title: _('Choose battery'),
            subtitle: _('Select which battery device to read'),
        });
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
        settingsGroup.add(batteryRow);

        const modeGroup = new Adw.PreferencesGroup({
            title: _('Battery Bar Settings'),
        });
        const circleGroup = new Adw.PreferencesGroup({
            title: _('Battery Circular Settings'),
        });
        modePage.add(modeGroup);
        modePage.add(circleGroup);

        const updateModePage = () => {
            const useCircle = settings.get_boolean('usecircleindicator');
            modePage.title = useCircle ? _('Battery Circular') : _('Battery Bar');
            modeGroup.visible = !useCircle;
            circleGroup.visible = useCircle;
        };
        settings.connect('changed::usecircleindicator', updateModePage);
        updateModePage();

        const hideChargingRow = new Adw.ActionRow({
            title: _('Hide battery when charging'),
            subtitle: _('Hide indicator while charging'),
        });
        const hideChargingSwitch = new Gtk.Switch({
            active: settings.get_boolean('hidecharging'),
            valign: Gtk.Align.CENTER,
        });
        settings.bind('hidecharging', hideChargingSwitch, 'active', Gio.SettingsBindFlags.DEFAULT);
        hideChargingRow.add_suffix(hideChargingSwitch);
        settingsGroup.add(hideChargingRow);

        const hideFullRow = new Adw.ActionRow({
            title: _('Hide battery when full'),
            subtitle: _('Hide indicator when fully charged'),
        });
        const hideFullSwitch = new Gtk.Switch({
            active: settings.get_boolean('hidefull'),
            valign: Gtk.Align.CENTER,
        });
        settings.bind('hidefull', hideFullSwitch, 'active', Gio.SettingsBindFlags.DEFAULT);
        hideFullRow.add_suffix(hideFullSwitch);
        settingsGroup.add(hideFullRow);

        const hideIdleRow = new Adw.ActionRow({
            title: _('Hide battery when idle'),
            subtitle: _('Hide indicator when not charging or discharging'),
        });
        const hideIdleSwitch = new Gtk.Switch({
            active: settings.get_boolean('hideidle'),
            valign: Gtk.Align.CENTER,
        });
        settings.bind('hideidle', hideIdleSwitch, 'active', Gio.SettingsBindFlags.DEFAULT);
        hideIdleRow.add_suffix(hideIdleSwitch);
        settingsGroup.add(hideIdleRow);

        const batterySizeRow = new Adw.ActionRow({
            title: _('Battery icon width'),
            subtitle: _('Set custom width for the battery icon'),
        });
        const batterySizeAdjustment = new Gtk.Adjustment({
            lower: 12,
            upper: 40,
            step_increment: 1,
        });
        const batterySizeSpinButton = new Gtk.SpinButton({
            adjustment: batterySizeAdjustment,
            valign: Gtk.Align.CENTER,
        });
        settings.bind('batterysize', batterySizeSpinButton, 'value', Gio.SettingsBindFlags.DEFAULT);
        batterySizeRow.add_suffix(batterySizeSpinButton);
        modeGroup.add(batterySizeRow);

        const batteryHeightRow = new Adw.ActionRow({
            title: _('Battery icon height'),
            subtitle: _('Set custom height for the battery icon'),
        });
        const batteryHeightAdjustment = new Gtk.Adjustment({
            lower: 12,
            upper: 40,
            step_increment: 1,
        });
        const batteryHeightSpinButton = new Gtk.SpinButton({
            adjustment: batteryHeightAdjustment,
            valign: Gtk.Align.CENTER,
        });
        settings.bind('batteryheight', batteryHeightSpinButton, 'value', Gio.SettingsBindFlags.DEFAULT);
        batteryHeightRow.add_suffix(batteryHeightSpinButton);
        modeGroup.add(batteryHeightRow);

        const circleSizeRow = new Adw.ActionRow({
            title: _('Circular indicator size'),
            subtitle: _('Set custom size for the circular indicator'),
        });
        const circleSizeAdjustment = new Gtk.Adjustment({
            lower: 12,
            upper: 40,
            step_increment: 1,
        });
        const circleSizeSpinButton = new Gtk.SpinButton({
            adjustment: circleSizeAdjustment,
            valign: Gtk.Align.CENTER,
        });
        settings.bind('circlesize', circleSizeSpinButton, 'value', Gio.SettingsBindFlags.DEFAULT);
        circleSizeRow.add_suffix(circleSizeSpinButton);
        circleGroup.add(circleSizeRow);

        const debugGroup = new Adw.PreferencesGroup({
            title: _('Debug'),
        });
        debugPage.add(debugGroup);
        const debugRow = new Adw.ActionRow({
            title: _('Enable debug mode'),
            subtitle: _('Shows build info and enables debug logs'),
        });
        const debugSwitch = new Gtk.Switch({
            active: settings.get_boolean('debug'),
            valign: Gtk.Align.CENTER,
        });
        settings.bind('debug', debugSwitch, 'active', Gio.SettingsBindFlags.DEFAULT);
        debugRow.add_suffix(debugSwitch);
        debugGroup.add(debugRow);

        const forceBoltRow = new Adw.ActionRow({
            title: _('Persistent bolt icon'),
            subtitle: _('Always show the charging bolt for testing'),
        });
        const forceBoltSwitch = new Gtk.Switch({
            active: settings.get_boolean('forcebolt'),
            valign: Gtk.Align.CENTER,
        });
        settings.bind('forcebolt', forceBoltSwitch, 'active', Gio.SettingsBindFlags.DEFAULT);
        forceBoltRow.add_suffix(forceBoltSwitch);
        debugGroup.add(forceBoltRow);

        const logLevelRow = new Adw.ActionRow({
            title: _('Log level'),
            subtitle: _('Controls log verbosity while debug is enabled'),
        });
        const logLevelModel = Gtk.StringList.new([
            _('Verbose'),
            _('Debug'),
            _('Info'),
            _('Warn'),
            _('Error'),
        ]);
        const logLevelDropDown = new Gtk.DropDown({
            valign: Gtk.Align.CENTER,
            model: logLevelModel,
        });
        logLevelDropDown.set_selected(settings.get_int('loglevel'));
        logLevelDropDown.connect('notify::selected', widget => {
            settings.set_int('loglevel', widget.get_selected());
        });
        settings.connect('changed::loglevel', () => {
            logLevelDropDown.set_selected(settings.get_int('loglevel'));
        });
        logLevelRow.add_suffix(logLevelDropDown);
        debugGroup.add(logLevelRow);

        const logToFileRow = new Adw.ActionRow({
            title: _('Log to file'),
            subtitle: _('Write debug logs to a file'),
        });
        const logToFileSwitch = new Gtk.Switch({
            active: settings.get_boolean('logtofile'),
            valign: Gtk.Align.CENTER,
        });
        settings.bind('logtofile', logToFileSwitch, 'active', Gio.SettingsBindFlags.DEFAULT);
        logToFileRow.add_suffix(logToFileSwitch);
        debugGroup.add(logToFileRow);

        const logPathRow = new Adw.ActionRow({
            title: _('Log file path'),
            subtitle: _('Leave empty to use the default cache path'),
        });
        const logPathEntry = new Gtk.Entry({
            text: settings.get_string('logfilepath'),
            valign: Gtk.Align.CENTER,
        });
        logPathEntry.connect('changed', () => {
            settings.set_string('logfilepath', logPathEntry.get_text());
        });
        settings.connect('changed::logfilepath', () => {
            const newValue = settings.get_string('logfilepath');
            if (logPathEntry.get_text() !== newValue)
                logPathEntry.set_text(newValue);
        });
        logPathRow.add_suffix(logPathEntry);
        debugGroup.add(logPathRow);

        const updateDebugRowsVisibility = () => {
            const show = settings.get_boolean('debug');
            logLevelRow.visible = show;
            logToFileRow.visible = show;
            logPathRow.visible = show && settings.get_boolean('logtofile');
        };
        settings.connect('changed::debug', updateDebugRowsVisibility);
        settings.connect('changed::logtofile', updateDebugRowsVisibility);
        updateDebugRowsVisibility();

        window.add(page);
        window.add(modePage);
        window.add(debugPage);
    }
}
