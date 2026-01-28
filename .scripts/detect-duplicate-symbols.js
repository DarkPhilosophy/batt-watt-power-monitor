const fs = require('fs');
const path = require('path');

const PROJECT_ROOT = path.join(__dirname, '..');
const EXTENSION_DIR = path.join(PROJECT_ROOT, 'extension');
const CONFIG_PATH = path.join(__dirname, 'duplicate-symbols.json');
const EXCLUDE_DIRS = new Set(['.git', 'node_modules', 'backup']);

const DEFAULT_CONFIG = {
    uniqueNames: [],
    uniqueNamePatterns: ['^get.*Snapshot$'],
    ignoreNames: [],
};

function loadConfig() {
    if (!fs.existsSync(CONFIG_PATH)) return DEFAULT_CONFIG;
    const raw = JSON.parse(fs.readFileSync(CONFIG_PATH, 'utf8'));
    return {
        uniqueNames: Array.isArray(raw.uniqueNames) ? raw.uniqueNames : DEFAULT_CONFIG.uniqueNames,
        uniqueNamePatterns: Array.isArray(raw.uniqueNamePatterns)
            ? raw.uniqueNamePatterns
            : DEFAULT_CONFIG.uniqueNamePatterns,
        ignoreNames: Array.isArray(raw.ignoreNames) ? raw.ignoreNames : DEFAULT_CONFIG.ignoreNames,
    };
}

function walk(dir, files = []) {
    const entries = fs.readdirSync(dir);
    for (const entry of entries) {
        if (EXCLUDE_DIRS.has(entry)) continue;
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

function findFunctionNames(filePath) {
    const contents = fs.readFileSync(filePath, 'utf8');
    const matches = [];
    const patterns = [
        /(?:export\s+)?function\s+([A-Za-z_$][A-Za-z0-9_$]*)\s*\(/g,
        /(?:export\s+)?(?:const|let|var)\s+([A-Za-z_$][A-Za-z0-9_$]*)\s*=\s*(?:async\s*)?function\s*\(/g,
        /(?:export\s+)?(?:const|let|var)\s+([A-Za-z_$][A-Za-z0-9_$]*)\s*=\s*(?:async\s*)?(?:\([^)]*\)|[A-Za-z_$][A-Za-z0-9_$]*)\s*=>\s*\{/g,
    ];

    for (const regex of patterns) {
        let match;
        while ((match = regex.exec(contents)) !== null) {
            const name = match[1];
            const line = contents.slice(0, match.index).split('\n').length;
            matches.push({ name, filePath, line });
        }
    }

    return matches;
}

function main() {
    const config = loadConfig();
    const uniqueNames = new Set(config.uniqueNames);
    const ignoreNames = new Set(config.ignoreNames);
    const uniquePatterns = config.uniqueNamePatterns.map(p => new RegExp(p));

    const files = walk(EXTENSION_DIR);
    const occurrences = new Map();

    for (const file of files) {
        for (const hit of findFunctionNames(file)) {
            if (ignoreNames.has(hit.name)) continue;
            const list = occurrences.get(hit.name) || [];
            list.push(hit);
            occurrences.set(hit.name, list);
        }
    }

    const problems = [];

    for (const [name, hits] of occurrences.entries()) {
        if (hits.length < 2) continue;
        const shouldBeUnique = uniqueNames.has(name) || uniquePatterns.some(re => re.test(name));
        if (!shouldBeUnique) continue;
        problems.push({ name, hits });
    }

    if (problems.length > 0) {
        console.error('Duplicate symbols found for unique function names:');
        for (const p of problems) {
            console.error(` - ${p.name}`);
            for (const hit of p.hits) {
                const rel = path.relative(PROJECT_ROOT, hit.filePath);
                console.error(`   * ${rel}:${hit.line}`);
            }
        }
        process.exit(1);
    }
}

main();
