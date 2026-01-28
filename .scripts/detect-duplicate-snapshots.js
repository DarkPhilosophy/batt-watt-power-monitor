const fs = require('fs');
const path = require('path');

const PROJECT_ROOT = path.join(__dirname, '..');
const EXTENSION_DIR = path.join(PROJECT_ROOT, 'extension');

function walk(dir, files = []) {
    const entries = fs.readdirSync(dir);
    for (const entry of entries) {
        const fullPath = path.join(dir, entry);
        const stat = fs.statSync(fullPath);
        if (stat.isDirectory()) {
            walk(fullPath, files);
        } else if (entry.endsWith('.js')) {
            files.push(fullPath);
        }
    }
    return files;
}

function findSnapshotDefinitions(filePath) {
    const contents = fs.readFileSync(filePath, 'utf8');
    const matches = [];
    const regex = /function\s+getSettingsSnapshot\s*\(/g;
    let match;
    while ((match = regex.exec(contents)) !== null) {
        const line = contents.slice(0, match.index).split('\n').length;
        matches.push({ filePath, line });
    }
    return matches;
}

function main() {
    const files = walk(EXTENSION_DIR);
    const matches = files.flatMap(findSnapshotDefinitions);

    if (matches.length > 1) {
        console.error('Duplicate getSettingsSnapshot definitions found:');
        for (const m of matches) {
            const rel = path.relative(PROJECT_ROOT, m.filePath);
            console.error(` - ${rel}:${m.line}`);
        }
        process.exit(1);
    }
}

main();
