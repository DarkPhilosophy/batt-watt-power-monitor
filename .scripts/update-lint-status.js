const fs = require('fs');
const path = require('path');

const PROJECT_DIR = path.resolve(__dirname, '..');
const README_PATH = path.join(PROJECT_DIR, '.github', 'README.md');

console.log('Updating README with lint status...');

// Read lint output from env or CI output files (populated by lint_check.sh --ci)
const lintOutputFile = process.env.LINT_OUTPUT_FILE || path.join(PROJECT_DIR, '.lint-output.txt');
const lintPassedFile = process.env.LINT_PASSED_FILE || path.join(PROJECT_DIR, '.lint-passed');
let lintOutput = process.env.LINT_OUTPUT || '';
let statusIcon = '✅';
let statusText = 'Passing';

// Check lint result from environment or CI output files
let lintPassed = process.env.LINT_PASSED === 'true';
if (!lintOutput && fs.existsSync(lintOutputFile)) lintOutput = fs.readFileSync(lintOutputFile, 'utf8');
if (!process.env.LINT_PASSED && fs.existsSync(lintPassedFile))
    lintPassed = fs.readFileSync(lintPassedFile, 'utf8').trim() === 'true';
if (!lintPassed) {
    statusIcon = '❌';
    statusText = 'Failed';
}

// Format the output
const timestamp = `${new Date().toISOString().replace('T', ' ').substring(0, 19)} UTC`;

// Count errors and warnings (extract from lint_check.sh output)
const errorMatch = lintOutput.match(/(\d+)\s+error/);
const warningMatch = lintOutput.match(/(\d+)\s+warning/);
const errorCount = errorMatch ? errorMatch[1] : '0';
const warningCount = warningMatch ? warningMatch[1] : '0';

const markdownBlock = `<!-- LINT-RESULT-START -->
### Linting Status
> **Status**: ${statusIcon} **${statusText}**  
> **Last Updated**: ${timestamp}  
> **Summary**: ${errorCount} errors, ${warningCount} warnings

<details>
<summary>Click to view full lint output</summary>

\`\`\`
${lintOutput.trim()}
\`\`\`

</details>
<!-- LINT-RESULT-END -->`;

try {
    const readmeContent = fs.readFileSync(README_PATH, 'utf8');
    const regex = /<!-- LINT-RESULT-START -->[\s\S]*<!-- LINT-RESULT-END -->/;

    if (regex.test(readmeContent)) {
        const newContent = readmeContent.replace(regex, markdownBlock);
        fs.writeFileSync(README_PATH, newContent);
        console.log(`✅ Updated README.md with lint status (${statusText})`);
    } else {
        console.warn('⚠️ LINT-RESULT placeholders not found in README.md');
        console.log('ℹ️  Skipping README update (placeholders missing)');
    }
} catch (error) {
    console.error('❌ Error updating README:', error.message);
    process.exit(1);
}

console.log('✅ Lint status update complete');
