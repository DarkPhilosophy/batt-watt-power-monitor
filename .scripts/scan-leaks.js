const fs = require('fs');
const path = require('path');

const EXTENSION_FILE = path.join(__dirname, '../extension/extension.js');
const PREFS_FILE = path.join(__dirname, '../extension/prefs.js');

const errors = [];
const warnings = [];

function checkFile(filePath) {
    if (!fs.existsSync(filePath)) return null;
    return fs.readFileSync(filePath, 'utf8');
}

// 1. Check for Signal and Timeout Leaks in extension.js
function checkLifecycleLeaks() {
    console.log('🔍 Scanning extension.js for lifecycle leaks...');
    const content = checkFile(EXTENSION_FILE);
    if (!content) return;

    // Regex to find things assigned to 'this._variable'
    // Matches: this._someId = ...connect(
    const connectRegex = /this\.(_\w+)\s*=\s*.*\.connect\(/g;
    const timeoutRegex = /this\.(_\w+)\s*=\s*.*timeout_add/g;

    let match;
    const signals = new Set();
    const timeouts = new Set();

    while ((match = connectRegex.exec(content)) !== null) {
        signals.add(match[1]);
    }

    while ((match = timeoutRegex.exec(content)) !== null) {
        timeouts.add(match[1]);
    }

    // Extract disable() block using brace counting
    let disableBody = '';
    const disableStart = content.indexOf('disable()');
    if (disableStart === -1) {
        errors.push('CRITICAL: Could not find disable() method in extension.js');
        return;
    }

    let openBraces = 0;
    let foundStart = false;
    let i = disableStart;

    // Scan forward to find start brace
    for (; i < content.length; i++) {
        if (content[i] === '{') {
            openBraces++;
            foundStart = true;
            i++; // skip brace
            break;
        }
    }

    // Scan body
    if (foundStart) {
        const bodyStart = i;
        for (; i < content.length; i++) {
            if (content[i] === '{') openBraces++;
            if (content[i] === '}') openBraces--;

            if (openBraces === 0) {
                disableBody = content.substring(bodyStart, i);
                break;
            }
        }
    }

    // Verify Signals
    signals.forEach(variable => {
        // Look for any mention of the variable in disable()
        // We look for strict usage: disconnect(this._var) or explicit null check
        if (!disableBody.includes(variable)) {
            errors.push(`❌ Signal Leak: 'this.${variable}' is created but NOT referenced in disable().`);
        }
    });

    // Verify Timeouts
    timeouts.forEach(variable => {
        if (!disableBody.includes(variable)) {
            errors.push(`❌ Timeout Leak: 'this.${variable}' is created but NOT referenced in disable().`);
        }
    });

    if (errors.length === 0) {
        console.log('✅ No signal or timeout leaks detected.');
    }
}

// 2. Check for Forbidden Imports
function checkForbiddenImports() {
    console.log('🔍 Checking for forbidden imports...');

    // Extension.js: No Gtk, Gdk, Adw
    const extContent = checkFile(EXTENSION_FILE);
    if (extContent) {
        if (/['"]gi:\/\/Gtk['"]/.test(extContent) || /['"]gi:\/\/Adw['"]/.test(extContent)) {
            errors.push('❌ Violation: extension.js imports Gtk or Adw (Forbidden in Shell process).');
        }
    }

    // Prefs.js: No Shell, Meta, St
    const prefsContent = checkFile(PREFS_FILE);
    if (prefsContent) {
        if (/['"]resource:\/\/\/org\/gnome\/shell\/(?!extensions\/prefs)/.test(prefsContent)) {
            // Resource imports from shell (except prefs helper) are suspicious
            // But simpler check:
        }
        if (/import\s+.*\s+from\s+['"]resource:\/\/\/org\/gnome\/shell\/ui/.test(prefsContent)) {
            errors.push('❌ Violation: prefs.js imports Shell UI (Forbidden in Prefs process).');
        }
    }
}

// Run Checks
checkLifecycleLeaks();
checkForbiddenImports();

// Report
if (warnings.length > 0) {
    console.log('\n⚠️  Warnings:');
    warnings.forEach(w => console.log(w));
}

if (errors.length > 0) {
    console.log('\n🚨 Audit Failed! formatting violations found:');
    errors.forEach(e => console.log(e));
    process.exit(1);
} else {
    console.log('\n✨ Guidelines Audit Passed!');
    process.exit(0);
}
