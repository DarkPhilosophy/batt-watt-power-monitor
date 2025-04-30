'use strict';

import Gio from 'gi://Gio';
import Gtk from 'gi://Gtk';
import Adw from 'gi://Adw';

import { ExtensionPreferences, gettext as _ } from 'resource:///org/gnome/Shell/Extensions/js/extensions/prefs.js';

// Version constant
const VERSION = '11'; // Update this to match your actual version

export default class BattConsumptionPreferences extends ExtensionPreferences {
    fillPreferencesWindow(window) {
        const settings = this.getSettings();

        // Create a preferences page
        const page = new Adw.PreferencesPage();

        // Main settings group
        const mainGroup = new Adw.PreferencesGroup({
            title: _('BATTERY CONSUMPTION WATT METER'),
            description: _('Version ') + VERSION,
        });
        page.add(mainGroup);

        // Link to repository
        const linkRow = new Adw.ActionRow({
            title: _('Project Homepage'),
            subtitle: 'https://github.com/zachgoldberg/batt_consumption_wattmetter',
        });
        const linkButton = new Gtk.LinkButton({
            uri: 'https://github.com/zachgoldberg/batt_consumption_wattmetter',
            icon_name: 'go-next-symbolic',
            valign: Gtk.Align.CENTER,
        });
        linkRow.add_suffix(linkButton);
        mainGroup.add(linkRow);

        // Settings group
        const settingsGroup = new Adw.PreferencesGroup({
            title: _('Display Settings'),
        });
        page.add(settingsGroup);

        // Interval setting
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

        // Show percentage switch
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

        // Show time remaining switch
        const timeRemainingRow = new Adw.ActionRow({
            title: _('Show time remaining'),
        });
        const timeRemainingSwitch = new Gtk.Switch({
            active: settings.get_boolean('timeremaining'),
            valign: Gtk.Align.CENTER,
        });
        settings.bind('timeremaining', timeRemainingSwitch, 'active', Gio.SettingsBindFlags.DEFAULT);
        timeRemainingRow.add_suffix(timeRemainingSwitch);
        settingsGroup.add(timeRemainingRow);

        // Show percentage when full switch
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

        // Battery selection
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

        // Add the page to the window
        window.add(page);
    }
}
