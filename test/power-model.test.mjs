import test from 'node:test';
import assert from 'node:assert/strict';

import { computePower } from '../extension/library/power-model.js';

test('prefers power_now when it is readable', () => {
    assert.equal(computePower(12.566, -1, -1), 12.566);
    // power_now wins even if current/voltage are also present
    assert.equal(computePower(11.988, 5, 16.3), 11.988);
});

test('falls back to current_now * voltage_now when power_now is unreadable', () => {
    assert.equal(computePower(-1, 2, 12), 24);
});

test('issue #10: power_now and current_now unreadable -> 0, never a bogus negative', () => {
    // The exact "-7.7 W" bug: current_now missing (-1), voltage_now valid (7.7).
    // Old logic did (-1 * 7.7) = -7.7; correct behavior is 0.
    assert.equal(computePower(-1, -1, 7.7), 0);
});

test('returns 0 when voltage_now is missing in the fallback path', () => {
    assert.equal(computePower(-1, 2, -1), 0);
});

test('cold boot with nothing cached yet reads as 0', () => {
    assert.equal(computePower(-1, -1, -1), 0);
});

test('self-corrects once power_now resolves on a later cycle', () => {
    assert.equal(computePower(-1, -1, 16.3), 0); // race cycle: power_now not cached, no bogus negative
    assert.equal(computePower(11.988, -1, 16.3), 11.988); // next cycle: power_now cached -> used
});
