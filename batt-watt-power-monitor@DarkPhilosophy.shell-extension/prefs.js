'use strict';

import Gio from 'gi://Gio';
import Gtk from 'gi://Gtk';
import Adw from 'gi://Adw';

import { ExtensionPreferences, gettext as _ } from 'resource:///org/gnome/Shell/Extensions/js/extensions/prefs.js';

const VERSION = '12';

function getBuildDate() {
    try {
        const buildDatePath = import.meta.url.replace('file://', '').replace('/prefs.js', '/build_date.txt');
        const content = Gio.File.new_for_path(buildDatePath).load_contents(null);
        if (content[0]) {
            return content[1].toString().trim();
        }
    } catch (e) {
        // File not found or error reading
    }
    return 'Unknown';
}

export default class BattConsumptionPreferences extends ExtensionPreferences {
    fillPreferencesWindow(window) {
        const settings = this.getSettings();

        const page = new Adw.PreferencesPage();

        const mainGroup = new Adw.PreferencesGroup({
            title: _('BATTERY CONSUMPTION WATT METER'),
            description: _('Version ') + VERSION + ' - Built: ' + getBuildDate(),
        });
        page.add(mainGroup);

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

        const settingsGroup = new Adw.PreferencesGroup({
            title: _('Display Settings'),
        });
        page.add(settingsGroup);

        const intervalRow = new Adw.ActionRow({
            title: _('Interval (seconds)'),
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

        const percentageRow = new Adw.ActionRow({
            title: _('Show percentage'),
        });
        const percentageSwitch = new Gtk.Switch({
            active: settings.get_boolean('percentage'),
            valign: Gtk.Align.CENTER,
        });
        settings.bind('percentage', percentageSwitch, 'active', Gio.SettingsBindFlags.DEFAULT);
        percentageRow.add_suffix(percentageSwitch);
        settingsGroup.add(percentageRow);

        const timeRemainingRow = new Adw.ActionRow({
            title: _('Show time remaining'),
        });
        const timeRemainingSwitch = new Gtk.Switch({
            active: (function(){ try { return settings.get_boolean('timeremaining'); } catch(e) { log('batt_consumption_wattmetter: missing key timeremaining, using default'); return false; }})(),
            valign: Gtk.Align.CENTER,
        });
        settings.bind('timeremaining', timeRemainingSwitch, 'active', Gio.SettingsBindFlags.DEFAULT);
        timeRemainingRow.add_suffix(timeRemainingSwitch);
        settingsGroup.add(timeRemainingRow);

        const percentageFullRow = new Adw.ActionRow({
            title: _('Show percentage when battery is full'),
        });
        const percentageFullSwitch = new Gtk.Switch({
            active: settings.get_boolean('percentagefull'),
            valign: Gtk.Align.CENTER,
        });
        settings.bind('percentagefull', percentageFullSwitch, 'active', Gio.SettingsBindFlags.DEFAULT);
        percentageFullRow.add_suffix(percentageFullSwitch);
        settingsGroup.add(percentageFullRow);

        const showWattsRow = new Adw.ActionRow({
            title: _('Show watts consumption'),
        });
        const showWattsSwitch = new Gtk.Switch({
            active: settings.get_boolean('showwatts'),
            valign: Gtk.Align.CENTER,
        });
        settings.bind('showwatts', showWattsSwitch, 'active', Gio.SettingsBindFlags.DEFAULT);
        showWattsRow.add_suffix(showWattsSwitch);
        settingsGroup.add(showWattsRow);

        const batteryRow = new Adw.ActionRow({
            title: _('Choose battery'),
        });
        const batteryCombo = new Gtk.DropDown({
            valign: Gtk.Align.CENTER,
            model: Gtk.StringList.new(['AUTOMATIC', 'BAT0', 'BAT1', 'BAT2']),
        });
        batteryCombo.set_selected(settings.get_int('battery'));
        batteryCombo.connect('notify::selected', (widget) => {
            settings.set_int('battery', widget.get_selected());
        });
        settings.connect('changed::battery', () => {
            batteryCombo.set_selected(settings.get_int('battery'));
        });
        batteryRow.add_suffix(batteryCombo);
        settingsGroup.add(batteryRow);

        const hideChargingRow = new Adw.ActionRow({
            title: _('Hide battery when charging'),
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
        });
        const hideFullSwitch = new Gtk.Switch({
            active: settings.get_boolean('hidefull'),
            valign: Gtk.Align.CENTER,
        });
        settings.bind('hidefull', hideFullSwitch, 'active', Gio.SettingsBindFlags.DEFAULT);
        hideFullRow.add_suffix(hideFullSwitch);
        settingsGroup.add(hideFullRow);

         window.add(page);
        }
        }
