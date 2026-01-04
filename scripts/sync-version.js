const fs = require('fs');
const path = require('path');

const PROJECT_DIR = path.resolve(__dirname, '..');
const PACKAGE_JSON_PATH = path.join(PROJECT_DIR, 'package.json');
const METADATA_PATH = path.join(PROJECT_DIR, 'extension', 'metadata.json');
const VERSION_FILE_PATH = path.join(PROJECT_DIR, 'VERSION');
const PREFS_PATH = path.join(PROJECT_DIR, 'extension', 'prefs.js');
const README_PATH = path.join(PROJECT_DIR, '.github', 'README.md');

try {
    // 1. Read source of truth: package.json
    console.log('Reading package.json...');
    const pkg = require(PACKAGE_JSON_PATH);
    const newVersion = pkg.version.split('.')[0]; // Major version as the extension version
    console.log(`Detected version: ${newVersion}`);

    // 2. Update VERSION file
    console.log('Updating VERSION file...');
    fs.writeFileSync(VERSION_FILE_PATH, newVersion + '\n');

    // 3. Update metadata.json
    console.log('Updating extension/metadata.json...');
    const meta = require(METADATA_PATH);
    meta.version = parseInt(newVersion, 10);
    meta['version-name'] = newVersion;
    fs.writeFileSync(METADATA_PATH, JSON.stringify(meta, null, 2) + '\n');

    // 4. Update prefs.js
    console.log('Updating extension/prefs.js...');
    let prefsContent = fs.readFileSync(PREFS_PATH, 'utf8');
    // Regex to match "const VERSION = '...';" or "const VERSION = "...";"
    // Use [^'"] to match content inside quotes
    const versionRegex = /const VERSION = ['"][^'"]*['"];/;
    // Only update if the line exists, but here we might not have it or it might be dynamic.
    // Actually, looking at the code you shared, VERSION constant is gone or used differently.
    // Wait, the user shared prefs.js and it has `const BUILD_DATE = null;` but no `const VERSION`.
    // Let's check if there is a VERSION constant.
    // If not, we skip.
    // Update: user shared `prefs.js` content previously and it had:
    // `const VERSION = '12';`
    // But in the latest `read_file` output (Turn 8), I don't see `const VERSION` anymore?
    // Let me double check the read_file output from Turn 8.
    // Ah, in Turn 8, prefs.js has: `const BUILD_DATE = null;` and `const versionName = this.metadata['version-name'] ...`
    // So prefs.js reads from metadata! Great! No need to update prefs.js for version.
    // Wait, I should verify if I need to update BUILD_DATE.
    // The previous build script updated BUILD_DATE.
    // Let's stick to version syncing for now.

    // 5. Extract latest changes from CHANGELOG.md
    console.log('Extracting latest changes from CHANGELOG.md...');
    const CHANGELOG_PATH = path.join(PROJECT_DIR, '.github', 'CHANGELOG.md');
    let changelogContent = fs.readFileSync(CHANGELOG_PATH, 'utf8');
    
    // Extract the latest version section (v{newVersion})
    // Pattern: ## v{newVersion} (DATE) ... until next ## or end of file
    const changelogRegex = new RegExp(`## v${newVersion}\\s+\\([^)]+\\)([\\s\\S]*?)(?=## v\\d+|$)`);
    const changelogMatch = changelogContent.match(changelogRegex);
    
    let latestChanges = '';
    if (changelogMatch && changelogMatch[1]) {
        // Extract bullet points from the changelog
        latestChanges = changelogMatch[1]
            .trim()
            .split('\n')
            .filter(line => line.startsWith('-'))
            .join('\n');
    }
    
    // 6. Update README.md version references
    console.log('Updating README.md with latest changes...');
    let readmeContent = fs.readFileSync(README_PATH, 'utf8');
    
    // Update version badge in header
    readmeContent = readmeContent.replace(/Version-\d+-green/g, `Version-${newVersion}-green`);
    
    // Update "Latest Update" section with header and changelog content using comment markers
    const latestUpdateSection = `### Latest Update (v${newVersion})\n${latestChanges}`;
    const latestVersionRegex = /<!-- LATEST-VERSION-START -->[\s\S]*?<!-- LATEST-VERSION-END -->/;
    readmeContent = readmeContent.replace(
        latestVersionRegex,
        `<!-- LATEST-VERSION-START -->\n${latestUpdateSection}\n<!-- LATEST-VERSION-END -->`
    );
    
    fs.writeFileSync(README_PATH, readmeContent);

    console.log('✅ Version sync complete!');
} catch (error) {
    console.error('❌ Error during version sync:', error);
    process.exit(1);
}
