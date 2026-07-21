import * as fs from 'node:fs';
import * as path from 'node:path';
import { fileURLToPath } from 'node:url';

import { extractChangelogEntries } from './sync-version.mjs';

const projectRoot = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
const HIGHLIGHT_LIMIT = 8;

export function renderReleaseNotes(root = projectRoot, requestedVersion = null) {
    const packageData = JSON.parse(fs.readFileSync(path.join(root, 'package.json'), 'utf8'));
    const version = requestedVersion ?? packageData.version;
    const changelog = fs.readFileSync(path.join(root, '.github', 'CHANGELOG.md'), 'utf8');
    const entries = extractChangelogEntries(changelog, version);
    if (entries.length === 0) throw new Error(`Missing changelog entries for v${version}`);

    const repository =
        typeof packageData.repository === 'string' ? packageData.repository : packageData.repository?.url;
    if (!repository) throw new Error('Missing repository URL in package.json');
    const repositoryUrl = repository.replace(/\.git$/, '');
    const highlights = entries.slice(0, HIGHLIGHT_LIMIT);
    const remaining = entries.length - highlights.length;
    const additional = remaining > 0 ? [`_Plus ${remaining} additional changes in this release._`] : [];

    return [
        `## Highlights in v${version}`,
        '',
        ...highlights,
        ...additional,
        '',
        `**Full changelog:** <${repositoryUrl}/commits/v${version}>`,
        '',
    ].join('\n');
}

if (path.resolve(process.argv[1] ?? '') === fileURLToPath(import.meta.url)) {
    process.stdout.write(renderReleaseNotes(projectRoot, process.argv[2] ?? null));
}
