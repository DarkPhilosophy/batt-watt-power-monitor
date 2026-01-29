/* eslint-disable no-console */
import GLib from 'gi://GLib';
import Gio from 'gi://Gio';

export const LogLevel = {
    VERBOSE: 0,
    DEBUG: 1,
    INFO: 2,
    WARN: 3,
    ERROR: 4,
};

const LOG_LEVEL_NAMES = {
    [LogLevel.VERBOSE]: '[VERBOSE]',
    [LogLevel.DEBUG]: '[DEBUG]',
    [LogLevel.INFO]: '[INFO]',
    [LogLevel.WARN]: '[WARN]',
    [LogLevel.ERROR]: '[ERROR]',
};

let _debug = false;
let _logLevel = LogLevel.WARN;
let _logToFile = false;
let _logPath = null;
let _logInitialized = false;
let _prefix = '[Extension]';

/**
 * Initialize the logger.
 *
 * @param {string} prefix - Log prefix (e.g. '[MyExtension]')
 */
export function init(prefix) {
    _prefix = prefix;
}

/**
 * Update logger state from settings.
 *
 * @param {object} settings - Gio.Settings object
 */
export function updateSettings(settings) {
    if (!settings) return;
    _debug = settings.get_boolean('debug');
    _logLevel = settings.get_int('loglevel');
    _logToFile = settings.get_boolean('logtofile');
    const newPath = settings.get_string('logfilepath');

    // Reset initialization if path changes
    if (_logInitialized && _logPath !== newPath) {
        _logInitialized = false;
    }
    _logPath = newPath;
}

/**
 * Resolve log file path.
 *
 * @returns {string} Absolute path to log file
 */
function resolveLogFilePath() {
    const configured = (_logPath || '').trim();
    const baseName = _prefix.replace(/[^a-z0-9]/gi, '_').toLowerCase();
    let fullPath = '';
    if (configured.length === 0) {
        fullPath = `${GLib.get_user_cache_dir()}/${baseName}.log`;
    } else if (configured.startsWith('/')) {
        fullPath = configured;
    } else {
        fullPath = `${GLib.get_home_dir()}/${configured}`;
    }

    if (GLib.file_test(fullPath, GLib.FileTest.IS_DIR)) {
        const base = fullPath.replace(/\/$/, '');
        return `${base}/${baseName}.log`;
    }

    return fullPath;
}

/**
 * Ensure log directory exists.
 *
 * @param {string} path - Absolute path
 */
function ensureLogDirectory(path) {
    const file = Gio.File.new_for_path(path);
    const parent = file.get_parent();
    if (parent && !parent.query_exists(null)) {
        try {
            parent.make_directory_with_parents(null);
        } catch (e) {
            console.error(`${_prefix} Failed to create log dir: ${e.message}`);
        }
    }
}

/**
 * Rotate log file (keep 1 backup).
 *
 * @param {string} path - Absolute path
 */
function rotateLogFile(path) {
    const file = Gio.File.new_for_path(path);
    if (!file.query_exists(null)) return;

    const oldFile = Gio.File.new_for_path(`${path}.old`);
    try {
        if (oldFile.query_exists(null)) oldFile.delete(null);
        file.move(oldFile, Gio.FileCopyFlags.OVERWRITE, null, null);
    } catch (e) {
        console.error(`${_prefix} Failed to rotate log: ${e.message}`);
    }
}

/**
 * Initialize log file system (rotate + ensure dir).
 *
 * @param {string} path - Absolute path
 */
function initLogFile(path) {
    ensureLogDirectory(path);
    rotateLogFile(path);
}

/**
 * Append line to log file.
 *
 * @param {string} path - Absolute path
 * @param {string} line - Text to append
 */
function appendLogLine(path, line) {
    try {
        ensureLogDirectory(path);
        const file = Gio.File.new_for_path(path);
        const stream = file.append_to(Gio.FileCreateFlags.NONE, null);
        stream.write_all(`${line}\n`, null);
        stream.close(null);
    } catch (e) {
        console.error(`${_prefix} Failed to write log: ${e.message}`);
    }
}

/**
 * Internal log message handler.
 *
 * @param {string} msg - Message
 * @param {number} level - LogLevel
 */
function logMessage(msg, level) {
    // If not debug mode, strictly silence everything unless
    // Debug is enabled, then log based on loglevel
    if (!_debug) return;

    if (level < _logLevel) return;

    const timestamp = new Date().toISOString();
    const levelName = LOG_LEVEL_NAMES[level] || '[UNKNOWN]';
    const output = `${timestamp} ${levelName} ${_prefix} ${msg}`;

    if (level >= LogLevel.WARN) console.error(output);
    else console.log(output);

    if (_logToFile) {
        const path = resolveLogFilePath();
        if (!_logInitialized) {
            initLogFile(path);
            _logInitialized = true;
        }
        appendLogLine(path, output);
    }
}

/**
 *
 * @param {string} msg - Message
 */
export function debug(msg) {
    logMessage(msg, LogLevel.DEBUG);
}
/**
 *
 * @param {string} msg - Message
 */
export function info(msg) {
    logMessage(msg, LogLevel.INFO);
}
/**
 *
 * @param {string} msg - Message
 */
export function warn(msg) {
    logMessage(msg, LogLevel.WARN);
}
/**
 *
 * @param {string} msg - Message
 */
export function error(msg) {
    logMessage(msg, LogLevel.ERROR);
}
