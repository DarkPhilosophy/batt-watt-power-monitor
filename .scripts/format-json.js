const fs = require('fs');
const path = require('path');

const PROJECT_DIR = path.resolve(__dirname, '..');
const EXCLUDE_DIRS = new Set(['.git', 'node_modules', 'backup']);

function isJsonFile(filePath) {
    return filePath.endsWith('.json');
}

function shouldSkipDir(dirName) {
    return EXCLUDE_DIRS.has(dirName);
}

function walk(dir, files = []) {
    const entries = fs.readdirSync(dir);
    for (const entry of entries) {
        if (shouldSkipDir(entry)) continue;
        const fullPath = path.join(dir, entry);
        const stat = fs.statSync(fullPath);
        if (stat.isDirectory()) {
            walk(fullPath, files);
        } else if (isJsonFile(fullPath)) {
            files.push(fullPath);
        }
    }
    return files;
}

function sortKeysDeep(value) {
    if (Array.isArray(value)) return value.map(sortKeysDeep);
    if (!value || typeof value !== 'object') return value;

    const sorted = {};
    for (const key of Object.keys(value).sort()) {
        sorted[key] = sortKeysDeep(value[key]);
    }
    return sorted;
}

function formatInline(value) {
    if (Array.isArray(value)) {
        return `[${value.map(formatInline).join(', ')}]`;
    }

    if (value && typeof value === 'object') {
        const keys = Object.keys(value).sort();
        const pairs = keys.map(key => `"${key}": ${formatInline(value[key])}`);
        return `{${pairs.join(', ')}}`;
    }

    return JSON.stringify(value);
}

function formatValue(value, level) {
    if (Array.isArray(value)) {
        return formatInline(value);
    }

    if (!value || typeof value !== 'object') {
        return JSON.stringify(value);
    }

    const indent = '  '.repeat(level);
    const nextIndent = '  '.repeat(level + 1);
    const keys = Object.keys(value).sort();

    if (keys.length === 0) return '{}';

    const lines = keys.map(key => `${nextIndent}"${key}": ${formatValue(value[key], level + 1)}`);
    return `{\n${lines.join(',\n')}\n${indent}}`;
}

function formatJsonFile(filePath) {
    const raw = fs.readFileSync(filePath, 'utf8');
    const parsed = JSON.parse(raw);
    const sorted = sortKeysDeep(parsed);
    const formatted = `${formatValue(sorted, 0)}\n`;

    if (raw !== formatted) {
        fs.writeFileSync(filePath, formatted);
        console.log(`Formatted: ${path.relative(PROJECT_DIR, filePath)}`);
    }
}

function main() {
    const files = walk(PROJECT_DIR);
    for (const file of files) formatJsonFile(file);
}

main();
