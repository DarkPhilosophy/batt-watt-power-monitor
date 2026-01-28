const https = require('https');
const fs = require('fs');
const path = require('path');

const PROJECT_DIR = path.resolve(__dirname, '..');
const README_PATH = path.join(PROJECT_DIR, '.github', 'README.md');
const PACKAGE_JSON_PATH = path.join(PROJECT_DIR, 'package.json');
const EGO_URL = 'https://extensions.gnome.org/extension/9023/batt-watt-power-monitor/';
const EGO_INFO_URL = 'https://extensions.gnome.org/extension-info/';

console.log('Fetching published version from GNOME Extensions...');

// Read GitHub version from package.json
let githubVersion;
try {
    const pkg = require(PACKAGE_JSON_PATH);
    githubVersion = parseInt(pkg.version.split('.')[0], 10); // Get major version
    console.log(`📦 GitHub version: ${githubVersion}`);
} catch (error) {
    console.error('❌ Error reading package.json:', error.message);
    process.exit(1);
}

function request(url, onSuccess) {
    https
        .get(
            url,
            {
                headers: {
                    'User-Agent': 'Mozilla/5.0 (X11; Linux x86_64) VersionFetcher/1.0',
                    'Accept': 'text/html,application/json',
                },
            },
            res => {
                if ([301, 302, 303, 307, 308].includes(res.statusCode) && res.headers.location) {
                    request(res.headers.location, onSuccess);
                    return;
                }

                let body = '';
                res.on('data', chunk => {
                    body += chunk;
                });
                res.on('end', () => onSuccess(body));
            },
        )
        .on('error', error => {
            console.error('❌ Error fetching GNOME Extensions page:', error.message);
            console.warn('⚠️  Continuing without updating published version badge');
            updateReadme(githubVersion, null);
            process.exit(0);
        });
}

function fetchHtml(url, onSuccess) {
    request(url, onSuccess);
}

function fetchExtensionInfo(extensionId, onSuccess) {
    const url = `${EGO_INFO_URL}?pk=${extensionId}`;
    request(url, data => {
        try {
            const json = JSON.parse(data);
            const publishedVersion = parseInt(json.version, 10);
            if (Number.isNaN(publishedVersion)) throw new Error('Invalid version in API response');
            onSuccess(publishedVersion);
        } catch (error) {
            console.error('❌ Error parsing extension-info response:', error.message);
            console.warn('⚠️  Continuing without updating published version badge');
            updateReadme(githubVersion, null);
            process.exit(0);
        }
    });
}

function extractExtensionId(url) {
    const match = url.match(/extensions\.gnome\.org\/extension\/(\d+)\//);
    return match ? match[1] : null;
}

// Fetch HTML from GNOME Extensions (fallback to extension-info JSON)
fetchHtml(EGO_URL, html => {
    try {
        // Extract version from data-versions attribute
        // Format: data-versions="{&quot;45&quot;: {&quot;67659&quot;: {&quot;pk&quot;: 67659, &quot;version&quot;: &quot;14&quot;}}, ...}"
        const versionMatch = html.match(/data-versions="([^"]+)"/);

        if (!versionMatch) {
            console.warn('⚠️  Could not find version data on GNOME Extensions page, falling back to API');
            const extensionId = extractExtensionId(EGO_URL);
            if (!extensionId) {
                console.warn('⚠️  Could not extract extension ID from URL');
                updateReadme(githubVersion, null);
                process.exit(0);
            }
            fetchExtensionInfo(extensionId, publishedVersion => {
                console.log(`✅ Found published version on GNOME Extensions: ${publishedVersion}`);
                updateReadme(githubVersion, publishedVersion);
            });
            return;
        }

        // Decode HTML entities
        const versionData = versionMatch[1]
            .replace(/&quot;/g, '"')
            .replace(/&amp;/g, '&')
            .replace(/&lt;/g, '<')
            .replace(/&gt;/g, '>');

        // Parse JSON
        const versions = JSON.parse(versionData);

        // Get the first shell version's data (they should all have the same extension version)
        const firstShellVersion = Object.keys(versions)[0];
        const versionInfo = versions[firstShellVersion];
        const firstVersionKey = Object.keys(versionInfo)[0];
        const publishedVersion = parseInt(versionInfo[firstVersionKey].version, 10);

        console.log(`✅ Found published version on GNOME Extensions: ${publishedVersion}`);

        // Update README.md with version badges
        updateReadme(githubVersion, publishedVersion);
    } catch (error) {
        console.error('❌ Error parsing version data:', error.message);
        console.warn('⚠️  Continuing without updating published version badge');
        updateReadme(githubVersion, null);
        process.exit(0);
    }
});

/**
 * Update README badges for GitHub vs GNOME version status.
 *
 * @param {number} githubVersionValue - Version from package.json
 * @param {number|null} publishedVersion - Version from GNOME Extensions
 */
function updateReadme(githubVersionValue, publishedVersion) {
    try {
        const readmeContent = fs.readFileSync(README_PATH, 'utf8');

        // Determine status color and message
        const hasPublished = Number.isFinite(publishedVersion);
        const isSynced = hasPublished && githubVersionValue === publishedVersion;
        const statusColor = isSynced ? 'brightgreen' : 'yellow';
        const statusLabel = isSynced ? 'Synced' : 'Pending';

        // Create the version status badges
        // shields.io format: /badge/<left_text>-<right_text>-<color>
        const statusBadge = `[![Status: ${statusLabel}](https://img.shields.io/badge/Status-${statusLabel}-${statusColor})](${EGO_URL})`;
        const githubBadge = `![GitHub](https://img.shields.io/badge/GitHub-v${githubVersionValue}-blue)`;
        const gnomeBadge = hasPublished
            ? `![GNOME](https://img.shields.io/badge/GNOME-v${publishedVersion}-green)`
            : '![GNOME](https://img.shields.io/badge/GNOME-N%2FA-gray)';
        const markdownBlock = `<!-- EGO-VERSION-START -->\n${statusBadge} ${githubBadge} ${gnomeBadge}\n<!-- EGO-VERSION-END -->`;

        const regex = /<!-- EGO-VERSION-START -->.*?<!-- EGO-VERSION-END -->/s;

        if (regex.test(readmeContent)) {
            // Update existing badges
            const newContent = readmeContent.replace(regex, markdownBlock);
            fs.writeFileSync(README_PATH, newContent);
            console.log('✅ Updated version status and published badges in README.md');
            const displayText = isSynced
                ? `Synced v${publishedVersion}`
                : `Pending (GitHub v${githubVersionValue}, GNOME ${hasPublished ? `v${publishedVersion}` : 'N/A'})`;
            console.log(`   Status: ${displayText}`);
        } else {
            // Add badges after the "Status: Live" line
            const statusLineRegex = /(\*\*Status\*\*: \*\*Live\*\* on GNOME Extensions \(ID: 9023\)\.\s*)/;

            if (statusLineRegex.test(readmeContent)) {
                const newContent = readmeContent.replace(statusLineRegex, `$1\n${markdownBlock}\n`);
                fs.writeFileSync(README_PATH, newContent);
                console.log('✅ Added version badges to README.md');
                const displayText = isSynced
                    ? `Synced v${publishedVersion}`
                    : `Pending (GitHub v${githubVersionValue}, GNOME ${hasPublished ? `v${publishedVersion}` : 'N/A'})`;
                console.log(`   Status: ${displayText}`);
            } else {
                console.warn("⚠️  Could not find 'Status: Live' line in README.md");
                console.warn('⚠️  Please add the badges manually or update the script');
            }
        }
    } catch (error) {
        console.error('❌ Error updating README:', error.message);
        process.exit(1);
    }
}
