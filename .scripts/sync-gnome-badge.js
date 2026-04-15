const fs = require('fs');
const path = require('path');

const PROJECT_DIR = path.resolve(__dirname, '..');
const METADATA_PATH = path.join(PROJECT_DIR, 'extension', 'metadata.json');
const README_PATH = path.join(PROJECT_DIR, '.github', 'README.md');
const START_MARKER = '<!-- GNOME-SHELL-VERSIONS-START -->';
const END_MARKER = '<!-- GNOME-SHELL-VERSIONS-END -->';

function getBadgeMarkdown(versions) {
    if (!Array.isArray(versions) || versions.length === 0) {
        throw new Error('metadata.json shell-version must be a non-empty array');
    }

    const numeric = versions
        .map(version => Number.parseInt(version, 10))
        .filter(version => Number.isFinite(version))
        .sort((a, b) => a - b);

    if (numeric.length === 0) {
        throw new Error('metadata.json shell-version does not contain valid numeric versions');
    }

    const min = numeric[0];
    const max = numeric[numeric.length - 1];
    const label = min === max ? `GNOME ${min}` : `GNOME ${min}-${max}`;
    const badgeValue = min === max ? `${min}` : `${min}--${max}`;

    return `[![${label}](https://img.shields.io/badge/GNOME-${badgeValue}-blue.svg)](https://www.gnome.org/)`;
}

function syncGnomeBadge() {
    const metadata = JSON.parse(fs.readFileSync(METADATA_PATH, 'utf8'));
    const readme = fs.readFileSync(README_PATH, 'utf8');

    if (!readme.includes(START_MARKER) || !readme.includes(END_MARKER)) {
        throw new Error('README.md is missing GNOME shell version markers');
    }

    const replacement = `${START_MARKER}\n${getBadgeMarkdown(metadata['shell-version'])}\n${END_MARKER}`;
    const updated = readme.replace(new RegExp(`${START_MARKER}[\\s\\S]*?${END_MARKER}`), replacement);

    fs.writeFileSync(README_PATH, updated);
    console.log('✅ Updated GNOME badge in README.md');
}

module.exports = syncGnomeBadge;

if (require.main === module) {
    try {
        syncGnomeBadge();
    } catch (error) {
        console.error(`❌ ${error.message}`);
        process.exit(1);
    }
}
