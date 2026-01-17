const fs = require('fs');
const path = require('path');

const SCHEMA_PATH = path.join(__dirname, '../.build-schema.json');
const EXTENSION_DIR = path.join(__dirname, '../extension');

// ANSI colors
const RED = '\x1b[31m';
const GREEN = '\x1b[32m';
const RESET = '\x1b[0m';

function validateBuild() {
    console.log('🔍 Validating extension structure against schema...');

    if (!fs.existsSync(SCHEMA_PATH)) {
        console.error(`${RED}❌ Error: Schema file not found at ${SCHEMA_PATH}${RESET}`);
        process.exit(1);
    }

    const schema = JSON.parse(fs.readFileSync(SCHEMA_PATH, 'utf8'));
    const allowedFiles = new Set(schema.allowed_files);
    const allowedDirs = new Set(schema.allowed_directories);

    const foundFiles = [];
    const unexpectedItems = [];

    function scanDirectory(dir, relativePath = '') {
        const items = fs.readdirSync(dir);

        for (const item of items) {
            const fullPath = path.join(dir, item);
            const relativeItemPath = relativePath ? `${relativePath}/${item}` : item;
            const stats = fs.statSync(fullPath);

            if (stats.isDirectory()) {
                if (!allowedDirs.has(relativeItemPath)) {
                    unexpectedItems.push(`Directory: ${relativeItemPath}`);
                }
                scanDirectory(fullPath, relativeItemPath);
            } else {
                if (!allowedFiles.has(relativeItemPath)) {
                    unexpectedItems.push(`File: ${relativeItemPath}`);
                } else {
                    foundFiles.push(relativeItemPath);
                }
            }
        }
    }

    scanDirectory(EXTENSION_DIR);

    // Check for missing files
    const missingFiles = [...allowedFiles].filter(f => !foundFiles.includes(f));

    let hasError = false;

    if (missingFiles.length > 0) {
        console.error(`${RED}❌ Missing expected files:${RESET}`);
        missingFiles.forEach(f => console.error(`   - ${f}`));
        hasError = true;
    }

    if (unexpectedItems.length > 0) {
        console.error(`${RED}❌ Unexpected items found (not in schema):${RESET}`);
        unexpectedItems.forEach(i => console.error(`   - ${i}`));
        hasError = true;
    }

    if (hasError) {
        console.error(`${RED}Validation FAILED! Please update .build-schema.json or remove unexpected files.${RESET}`);
        process.exit(1);
    } else {
        console.log(`${GREEN}✅ Extension structure validated successfully.${RESET}`);
    }
}

validateBuild();
