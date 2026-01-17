const fs = require('fs');
const path = require('path');

const PROJECT_DIR = path.resolve(__dirname, '..');
const PACKAGE_JSON_PATH = path.join(PROJECT_DIR, 'package.json');
const METADATA_PATH = path.join(PROJECT_DIR, 'extension', 'metadata.json');
const VERSION_FILE_PATH = path.join(PROJECT_DIR, 'VERSION');
const PREFS_PATH = path.join(PROJECT_DIR, 'extension', 'prefs.js');
const CHANGELOG_PATH = path.join(PROJECT_DIR, '.github', 'CHANGELOG.md');
const README_PATH = path.join(PROJECT_DIR, '.github', 'README.md');

try {
    // 1. Read source of truth: package.json
    console.log('Reading package.json...');
    const pkg = require(PACKAGE_JSON_PATH);
    const newVersion = pkg.version.split('.')[0]; // Major version as the extension version
    console.log(`Detected version: ${newVersion}`);

    // 2. Update VERSION file
    console.log('Updating VERSION file...');
    fs.writeFileSync(VERSION_FILE_PATH, `${newVersion}\n`);

    // 3. Update metadata.json
    console.log('Updating extension/metadata.json...');
    const meta = require(METADATA_PATH);
    meta.version = parseInt(newVersion, 10);
    meta['version-name'] = newVersion;
    fs.writeFileSync(METADATA_PATH, `${JSON.stringify(meta, null, 2)}\n`);

    // 4. Update prefs.js - Update BUILD_DATE constant + changelog
    console.log('Updating extension/prefs.js...');
    let prefsContent = fs.readFileSync(PREFS_PATH, 'utf8');
    const buildDate = new Date().toISOString();
    const buildDateRegex = /const BUILD_DATE = ['"][^'"]*['"];/;
    if (buildDateRegex.test(prefsContent)) {
        prefsContent = prefsContent.replace(buildDateRegex, `const BUILD_DATE = '${buildDate}';`);
        fs.writeFileSync(PREFS_PATH, prefsContent);
        console.log(`✅ Updated BUILD_DATE to ${buildDate}`);
    } else {
        console.log('ℹ️  No BUILD_DATE constant found in prefs.js, skipping');
    }

    try {
        const changelogMd = fs.readFileSync(CHANGELOG_PATH, 'utf8');
        const changelogText = extractChangelogForVersion(changelogMd, newVersion);
        if (changelogText) {
            const changelogBlock = `const CHANGELOG = \`${changelogText}\`;`;
            const changelogRegex = /const CHANGELOG = [\s\S]*?;\n/;
            if (changelogRegex.test(prefsContent)) {
                prefsContent = prefsContent.replace(changelogRegex, `${changelogBlock}\n`);
                fs.writeFileSync(PREFS_PATH, prefsContent);
                console.log('✅ Updated CHANGELOG in prefs.js');
            } else {
                console.log('ℹ️  No CHANGELOG constant found in prefs.js, skipping');
            }
        } else {
            console.log(`ℹ️  No changelog section found for v${newVersion}`);
        }
    } catch (error) {
        console.log(`ℹ️  Failed to update changelog in prefs.js: ${error.message}`);
    }

    try {
        const changelogMd = fs.readFileSync(CHANGELOG_PATH, 'utf8');
        const entries = extractChangelogEntries(changelogMd, newVersion);
        if (entries.length > 0) {
            const latestBlock = `<!-- LATEST-VERSION-START -->
<details open>
<summary><strong>Latest Update (v${newVersion})</strong></summary>

${entries.join('\n')}

</details>
<!-- LATEST-VERSION-END -->`;
            const readmeContent = fs.readFileSync(README_PATH, 'utf8');
            const regex = /<!-- LATEST-VERSION-START -->[\s\S]*<!-- LATEST-VERSION-END -->/;
            if (regex.test(readmeContent)) {
                let newContent = readmeContent.replace(regex, latestBlock);
                const badgeRegex =
                    /\[!\[Version [^\]]+\]\(https:\/\/img\.shields\.io\/badge\/Version-[^-]+-green\.svg\)\]\([^)]+\)/;
                const badge = `[![Version ${newVersion}](https://img.shields.io/badge/Version-${newVersion}-green.svg)](https://github.com/DarkPhilosophy/batt-watt-power-monitor)`;
                if (badgeRegex.test(newContent)) newContent = newContent.replace(badgeRegex, badge);
                fs.writeFileSync(README_PATH, newContent);
                console.log('✅ Updated README latest update block');
            } else {
                console.log('ℹ️  No LATEST-VERSION block found in README.md');
            }
        } else {
            console.log(`ℹ️  No changelog entries found for v${newVersion}`);
        }
    } catch (error) {
        console.log(`ℹ️  Failed to update README latest update block: ${error.message}`);
    }

    console.log('✅ Version sync complete!');
} catch (error) {
    console.error('❌ Error during version sync:', error);
    process.exit(1);
}

/**
 * Extract bullet items for a specific version from the changelog.
 *
 * @param {string} markdown - Changelog contents
 * @param {string} version - Version number (major)
 * @returns {string} Formatted changelog text
 */
function extractChangelogForVersion(markdown, version) {
    const header = `## v${version}`;
    const start = markdown.indexOf(header);
    if (start === -1) return '';

    const afterHeader = markdown.slice(start + header.length);
    const nextHeaderIndex = afterHeader.search(/\n## v\d+/);
    const section = nextHeaderIndex === -1 ? afterHeader : afterHeader.slice(0, nextHeaderIndex);
    const lines = section.split('\n');
    const entries = [];

    // Capture the header line (e.g. "SYNCHRONOUS, VISUALS & CLEANUP")
    const headerLine = markdown.slice(markdown.indexOf(header), markdown.indexOf('\n', markdown.indexOf(header)));
    const headerText = headerLine.replace(/^##\s*v\d+(\s*\(.*?\))?\s*-\s*/, '').trim();

    if (headerText) entries.push(headerText.toUpperCase());

    for (const line of lines) {
        // Allow indented bullets AND blockquotes
        if (!/^\s*[-*]/.test(line) && !/^\s*>/.test(line)) continue;

        let cleaned = line;

        // Handle blockquotes
        if (cleaned.trim().startsWith('>')) {
            cleaned = cleaned.replace(/^\s*>\s*/, '');
        }
        // Handle bullets
        else {
            cleaned = cleaned.replace(/^\s*[-*]\s*/, '');
        }

        // Remove code ticks but KEEP bolding/italics for emphasis in plain text
        cleaned = cleaned.replace(/`/g, '');
        cleaned = cleaned.replace(/\*\*/g, '');

        if (cleaned.trim()) entries.push(cleaned.trim());
    }

    if (entries.length === 0) return '';

    return `\n${entries.join('\n\n')}`;
}

/**
 * Extract raw bullet lines for a specific version.
 *
 * @param {string} markdown - Changelog contents
 * @param {string} version - Version number (major)
 * @returns {string[]} Raw bullet lines
 */

function extractChangelogEntries(markdown, version) {
    const header = `## v${version}`;
    const start = markdown.indexOf(header);
    if (start === -1) return [];

    const afterHeader = markdown.slice(start + header.length);
    const nextHeaderIndex = afterHeader.search(/\n## v\d+/);
    const section = nextHeaderIndex === -1 ? afterHeader : afterHeader.slice(0, nextHeaderIndex);
    const lines = section.split('\n');
    const entries = [];

    for (const line of lines) {
        // Allow indented bullets
        if (!/^\s*-/.test(line)) continue;
        entries.push(line);
    }

    return entries;
}
