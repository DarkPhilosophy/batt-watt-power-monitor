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

    const uniqueVersions = [...new Set(numeric)];
    const formattedVersions = formatVersionRanges(uniqueVersions);
    const label = `GNOME ${formattedVersions}`;
    const badgeValue = encodeURIComponent(formattedVersions.replace(/, /g, ',')).replace(/-/g, '--');

    return `[![${label}](https://img.shields.io/badge/GNOME-${badgeValue}-blue.svg)](https://www.gnome.org/)`;
}

function formatVersionRanges(versions) {
    const ranges = [];
    let start = versions[0];
    let end = versions[0];

    for (let index = 1; index < versions.length; index += 1) {
        const value = versions[index];
        if (value === end + 1) {
            end = value;
            continue;
        }

        ranges.push(start === end ? `${start}` : `${start}-${end}`);
        start = value;
        end = value;
    }

    ranges.push(start === end ? `${start}` : `${start}-${end}`);
    return ranges.join(', ');
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
