import test from 'node:test';
import assert from 'node:assert/strict';

import { DEFAULT_LOG_BASENAME, formatRecentLogEvents, resolveLogFilePath } from '../extension/library/logging-model.js';

const opts = { cacheDir: '/cache', homeDir: '/home/u', isDirectory: () => false };

test('resolveLogFilePath falls back to cache dir + basename when empty', () => {
    assert.equal(resolveLogFilePath('', opts), `/cache/${DEFAULT_LOG_BASENAME}`);
    assert.equal(resolveLogFilePath('   ', opts), `/cache/${DEFAULT_LOG_BASENAME}`);
    assert.equal(resolveLogFilePath(null, opts), `/cache/${DEFAULT_LOG_BASENAME}`);
});

test('resolveLogFilePath keeps an absolute file path as-is', () => {
    assert.equal(resolveLogFilePath('/var/log/x.log', opts), '/var/log/x.log');
});

test('resolveLogFilePath resolves a relative path against home', () => {
    assert.equal(resolveLogFilePath('logs/x.log', opts), '/home/u/logs/x.log');
});

test('resolveLogFilePath appends basename when the target is a directory', () => {
    const dirOpts = { ...opts, isDirectory: p => p === '/var/logs' };
    assert.equal(resolveLogFilePath('/var/logs', dirOpts), `/var/logs/${DEFAULT_LOG_BASENAME}`);
});

test('formatRecentLogEvents keeps the last N non-empty lines and sanitizes', () => {
    const contents = ['a', 'Bearer sek.ret.tok', '', 'c', 'd'].join('\n');
    assert.equal(formatRecentLogEvents(contents, 3), 'Bearer [REDACTED]\nc\nd');
});

test('formatRecentLogEvents handles empty input', () => {
    assert.equal(formatRecentLogEvents('', 80), '');
    assert.equal(formatRecentLogEvents(null, 80), '');
});
