const MAX_LOG_LENGTH = 1000;

/**
 * Redact credentials from a string and cap its length for safe logging.
 *
 * @param {unknown} value - Any value to stringify and sanitize
 * @returns {string} Sanitized, length-bounded text
 */
export function sanitizeText(value) {
    let text = String(value ?? 'Unknown error');
    text = text.replace(/Bearer\s+[^\s,;]+/gi, 'Bearer [REDACTED]');
    text = text.replace(/[A-Za-z0-9_-]{8,}\.[A-Za-z0-9_-]{8,}\.[A-Za-z0-9_-]{3,}/g, '[REDACTED]');
    text = text.replace(
        /(["']?(?:access[_-]?token|refresh[_-]?token|access|refresh)["']?\s*[:=]\s*)["'][^"']+["']/gi,
        '$1"[REDACTED]"',
    );
    return text.length > MAX_LOG_LENGTH ? `${text.slice(0, MAX_LOG_LENGTH)}…` : text;
}

/**
 * Extract a sanitized message from an error (or any value).
 *
 * @param {unknown} error - Error instance or arbitrary value
 * @returns {string} Sanitized error message
 */
export function safeErrorMessage(error) {
    return sanitizeText(error instanceof Error ? error.message : error);
}
