const fs = require('fs');
const path = require('path');

const PROJECT_ROOT = path.join(__dirname, '..');
const BACKUP_DIR = path.join(PROJECT_ROOT, 'backup');
const EXCLUDE_DIRS = new Set(['.git', 'node_modules', 'backup']);

function ensureBackupDir() {
    if (!fs.existsSync(BACKUP_DIR)) fs.mkdirSync(BACKUP_DIR, { recursive: true });
}

function isBackupFile(name) {
    return name.includes('.backup-');
}

function walk(dir, relativeBase = '') {
    const entries = fs.readdirSync(dir);
    for (const entry of entries) {
        const fullPath = path.join(dir, entry);
        const relPath = path.join(relativeBase, entry);
        const stat = fs.statSync(fullPath);

        if (stat.isDirectory()) {
            if (EXCLUDE_DIRS.has(entry)) continue;
            walk(fullPath, relPath);
        } else if (isBackupFile(entry)) {
            moveBackup(fullPath, relPath);
        }
    }
}

function uniqueTargetPath(targetPath) {
    if (!fs.existsSync(targetPath)) return targetPath;
    const ext = path.extname(targetPath);
    const base = targetPath.slice(0, -ext.length);
    let counter = 1;
    let candidate = `${base}-${counter}${ext}`;
    while (fs.existsSync(candidate)) {
        counter += 1;
        candidate = `${base}-${counter}${ext}`;
    }
    return candidate;
}

function moveBackup(src, relPath) {
    const targetPath = path.join(BACKUP_DIR, relPath);
    const targetDir = path.dirname(targetPath);
    fs.mkdirSync(targetDir, { recursive: true });
    const finalTarget = uniqueTargetPath(targetPath);
    fs.renameSync(src, finalTarget);
    console.log(`Moved: ${relPath} -> ${path.relative(PROJECT_ROOT, finalTarget)}`);
}

function main() {
    ensureBackupDir();
    walk(PROJECT_ROOT);
}

main();
