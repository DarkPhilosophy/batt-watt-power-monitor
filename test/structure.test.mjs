import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { test } from 'node:test';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';

// Structural / regression guards for modules that cannot be imported standalone
// (they reach into resource:///org/gnome/shell/... and only load inside GNOME
// Shell), plus invariants for the build tooling. Mirrors the reference project's
// structure.test.mjs approach: read source as text and assert on it.
const HERE = dirname(fileURLToPath(import.meta.url));
const read = rel => readFileSync(join(HERE, rel), 'utf8');
const SCHEMA = '../extension/schemas/org.gnome.shell.extensions.batt-watt-power-monitor.gschema.xml';

test('schema is kebab-case only, no legacy flat keys remain', () => {
    const schema = read(SCHEMA);
    const legacy = [
        'showicon',
        'batterysize',
        'batteryheight',
        'showpercentageoutside',
        'timeremaining',
        'hidecharging',
        'usecircleindicator',
        'circlesize',
        'forcebolt',
        'fakecharging',
        'loglevel',
        'logtofile',
        'logfilepath',
    ];
    for (const key of legacy) assert.ok(!schema.includes(`name="${key}"`), `legacy flat key still in schema: ${key}`);

    const kebab = [
        'show-icon',
        'battery-size',
        'use-circle-indicator',
        'circle-size',
        'log-level',
        'log-to-file',
        'log-file-path',
        'settings-version',
    ];
    for (const key of kebab) assert.ok(schema.includes(`name="${key}"`), `missing kebab key: ${key}`);
});

test('extension migrates legacy dconf keys once, then deletes them', () => {
    const ext = read('../extension/extension.js');
    assert.match(ext, /_migrateSettings\(\)/);
    assert.match(ext, /get_int\('settings-version'\)/);
    assert.match(ext, /dconf reset/); // legacy keys removed only after a successful copy
    assert.match(ext, /set_int\('settings-version', 1\)/);
});

test('preferences read version from metadata and never hardcode build info', () => {
    const prefs = read('../extension/prefs.js');
    assert.match(prefs, /this\.metadata\['version-name'\]/);
    assert.match(prefs, /const BUILD_DATE = null;/);
    assert.match(prefs, /const BUILD_ID = 'development';/);
    // no literal extension version baked into prefs
    assert.doesNotMatch(prefs, /versionName = ['"]2[0-9]['"]/);
});

test('build.sh injects build metadata with a value-agnostic regex', () => {
    const build = read('../build.sh');
    assert.match(build, /const BUILD_DATE = \.\*;/);
    assert.match(build, /const BUILD_ID = \.\*;/);
    // must not hardcode the expected current value in the sed match
    assert.doesNotMatch(build, /BUILD_DATE = null/);
    assert.doesNotMatch(build, /BUILD_ID = 'development'/);
});

test('issue #10: power selection uses computePower, no cached isTP flag', () => {
    const upower = read('../extension/library/upower.js');
    assert.match(upower, /computePower\(/);
    assert.doesNotMatch(upower, /isTP/);
});

test('build allowlist packages every library module', () => {
    const schema = JSON.parse(read('../.build-schema.json'));
    for (const file of [
        'library/power-model.js',
        'library/logging-model.js',
        'library/sanitize.js',
        'library/upower.js',
        'library/settings.js',
    ]) {
        assert.ok(schema.allowed_files.includes(file), `not packaged: ${file}`);
    }
});

test('settings snapshot derivations remain intact', () => {
    const settings = read('../extension/library/settings.js');
    assert.match(settings, /export function getSettingsSnapshot/);
    assert.match(settings, /'use-circle-indicator'/);
    assert.match(settings, /'use-stock-icon'/);
    assert.match(settings, /showText:/);
});
