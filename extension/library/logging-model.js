import { sanitizeText } from './sanitize.js';

export const DEFAULT_LOG_BASENAME = 'batt-watt-power-monitor.log';

/**
 * Resolve a log file path from a user-configured value.
 *
 * Pure helper shared by the extension logger and the preferences window (which
 * run in separate processes), so both agree on the same default location.
 *
 * @param {string} configuredPath - User-configured path (absolute, relative, dir, or empty)
 * @param {object} options - { cacheDir, homeDir, isDirectory, basename }
 * @returns {string} Absolute path to the log file
 */
export function resolveLogFilePath(configuredPath, options) {
    const basename = options.basename ?? DEFAULT_LOG_BASENAME;
    const configured = String(configuredPath ?? '').trim();
    if (!configured) return `${options.cacheDir.replace(/\/$/, '')}/${basename}`;

    const fullPath = configured.startsWith('/') ? configured : `${options.homeDir.replace(/\/$/, '')}/${configured}`;
    return options.isDirectory?.(fullPath) ? `${fullPath.replace(/\/$/, '')}/${basename}` : fullPath;
}

/**
 * Format the tail of a log file for display, redacting credentials on read.
 *
 * @param {string} contents - Raw log file contents
 * @param {number} limit - Maximum number of trailing lines
 * @returns {string} Sanitized, newline-joined recent events
 */
export function formatRecentLogEvents(contents, limit = 80) {
    return String(contents ?? '')
        .split(/\r?\n/)
        .filter(Boolean)
        .slice(-Math.max(0, limit))
        .map(line => sanitizeText(line))
        .join('\n');
}
