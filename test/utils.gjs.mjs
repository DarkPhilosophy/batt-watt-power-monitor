// Runs under GJS (gjs -m) because utils.js imports gi://UPowerGlib.
import {
    clamp01,
    formatTimeRemaining,
    formatWatts,
    getLabelStyleFromPercentage,
    getRingColor,
} from '../extension/library/utils.js';

let failures = 0;
const eq = (name, actual, expected) => {
    const ok = JSON.stringify(actual) === JSON.stringify(expected);
    print(
        `${ok ? 'ok' : 'FAIL'} - ${name}${ok ? '' : ` (got ${JSON.stringify(actual)}, want ${JSON.stringify(expected)})`}`,
    );
    if (!ok) failures += 1;
};
const truthy = (name, cond) => {
    print(`${cond ? 'ok' : 'FAIL'} - ${name}`);
    if (!cond) failures += 1;
};

// clamp01
eq('clamp01 below 0', clamp01(-0.5), 0);
eq('clamp01 within range', clamp01(0.42), 0.42);
eq('clamp01 above 1', clamp01(2), 1);

// formatTimeRemaining
eq('time zero -> empty', formatTimeRemaining(0), '');
eq('time negative -> empty', formatTimeRemaining(-10), '');
eq('time non-finite -> empty', formatTimeRemaining(Infinity), '');
eq('time over 24h -> empty', formatTimeRemaining(86401), '');
eq('time one minute', formatTimeRemaining(60), '00:01');
eq('time 1h01m', formatTimeRemaining(3661), '01:01');
eq('time 24h boundary kept', formatTimeRemaining(86400), '24:00');

// formatWatts
eq('watts no decimals rounds', formatWatts(15.756, { get_boolean: () => false }), '16');
eq('watts two decimals', formatWatts(15.756, { get_boolean: () => true }), '15.76');

// getRingColor: red->green gradient invariants
const c0 = getRingColor(0);
const c100 = getRingColor(100);
truthy('ring color is 3 channels', Array.isArray(c0) && c0.length === 3);
truthy('ring channels within [0,1]', c0.every(x => x >= 0 && x <= 1) && c100.every(x => x >= 0 && x <= 1));
truthy('0% is red-dominant', c0[0] > c0[1] && c0[0] > c0[2]);
truthy('100% is green-dominant', c100[1] > c100[0] && c100[1] > c100[2]);

// getLabelStyleFromPercentage
eq('no color -> theme fg', getLabelStyleFromPercentage(50, false), 'color: var(--theme-fg-color);');
eq(
    'charging custom hex normalized (#ABC -> #aabbcc)',
    getLabelStyleFromPercentage(50, true, true, 'custom', '#ABC'),
    'color: #aabbcc;',
);
eq(
    'charging theme -> theme fg',
    getLabelStyleFromPercentage(50, true, true, 'theme', '#fff'),
    'color: var(--theme-fg-color);',
);
truthy('gradient path emits a hex color decl', getLabelStyleFromPercentage(50, true, false).startsWith('color: #'));

if (failures > 0) throw new Error(`${failures} utils gjs test(s) failed`);
print('utils gjs: all passed');
