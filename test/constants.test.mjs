import test from 'node:test';
import assert from 'node:assert/strict';

import {
    BATTERIES,
    BATTERY,
    CACHE_AGE_MS,
    CACHE_MAX_ENTRIES,
    CIRCLE,
    MAX_CALLS_PER_SECOND,
    PURGE_INTERVAL_MS,
} from '../extension/library/constants.js';

test('battery sysfs paths are absolute and well-formed', () => {
    const paths = Object.values(BATTERIES);
    assert.equal(paths.length, 3);
    for (const p of paths) assert.match(p, /^\/sys\/class\/power_supply\/BAT\d\/$/);
});

test('circle geometry constants are sane', () => {
    assert.ok(CIRCLE.MIN_SIZE >= 1);
    assert.ok(CIRCLE.RING_INNER_RATIO > 0 && CIRCLE.RING_INNER_RATIO <= 1);
    assert.ok(CIRCLE.FONT_SIZE_RATIO > 0 && CIRCLE.FONT_SIZE_RATIO <= 1);
    assert.equal(CIRCLE.DEGREES_PER_PERCENT, 3.6); // 360 degrees / 100 percent
    assert.equal(CIRCLE.ARC_START_ANGLE, -Math.PI / 2); // starts at 12 o'clock
});

test('rate and cache limits are positive', () => {
    assert.ok(MAX_CALLS_PER_SECOND > 0);
    assert.ok(CACHE_AGE_MS > 0);
    assert.ok(PURGE_INTERVAL_MS > 0);
    assert.ok(CACHE_MAX_ENTRIES > 0);
    assert.ok(BATTERY.MIN_SIZE >= 1);
});
