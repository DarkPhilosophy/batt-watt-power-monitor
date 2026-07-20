import test from 'node:test';
import assert from 'node:assert/strict';

import { sanitizeText, safeErrorMessage } from '../extension/library/sanitize.js';

test('sanitizeText redacts Bearer tokens', () => {
    assert.equal(sanitizeText('Authorization: Bearer abc123def'), 'Authorization: Bearer [REDACTED]');
});

test('sanitizeText redacts JWT-like triples', () => {
    assert.equal(sanitizeText('token=aaaaaaaa.bbbbbbbb.ccc'), 'token=[REDACTED]');
});

test('sanitizeText redacts access/refresh token assignments', () => {
    assert.equal(sanitizeText('"access_token":"secretvalue"'), '"access_token":"[REDACTED]"');
});

test('sanitizeText truncates content over the length cap', () => {
    const out = sanitizeText('x'.repeat(1500));
    assert.equal(out.length, 1001);
    assert.ok(out.endsWith('…'));
});

test('sanitizeText handles null and undefined', () => {
    assert.equal(sanitizeText(null), 'Unknown error');
    assert.equal(sanitizeText(undefined), 'Unknown error');
});

test('safeErrorMessage extracts and sanitizes Error.message', () => {
    assert.equal(safeErrorMessage(new Error('Bearer tok.tok.tok')), 'Bearer [REDACTED]');
    assert.equal(safeErrorMessage('plain message'), 'plain message');
});
