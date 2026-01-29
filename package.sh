#!/bin/bash

# Create extension package for GNOME Extensions website (EGO)
# Follows EGO review guidelines - excludes unnecessary files
# Files must be at ZIP root level, NOT in a subdirectory
# Usage: ./package.sh

set -e

# Sync version from package.json
echo "Syncing version..."
node .scripts/sync-version.js
echo "Formatting JSON..."
node .scripts/format-json.js

# Lint check (for status update)
echo "Checking code quality..."
PROJECT_DIR="$(cd "$(dirname "$0")" && pwd)"
LINT_OUTPUT_FILE="$PROJECT_DIR/.lint-output.txt"
LINT_PASSED_FILE="$PROJECT_DIR/.lint-passed"
lint_output=$(npm run lint:fix 2>&1)
lint_status=$?
printf "%s\n" "$lint_output" > "$LINT_OUTPUT_FILE"
if [ $lint_status -eq 0 ]; then
    echo true > "$LINT_PASSED_FILE"
else
    echo false > "$LINT_PASSED_FILE"
    echo "$lint_output"
    echo "✗ Linting failed." >&2
    exit 1
fi

# Update lint status in README
echo "Updating lint status..."
node .scripts/update-lint-status.js

# Validate File Structure
node .scripts/validate-build.js

echo "🏗️  Building Batt-Watt Power Monitor extension package..."

# Extension details
EXTENSION_UUID="batt-watt-power-monitor@DarkPhilosophy"
PACKAGE_NAME="${EXTENSION_UUID}.zip"
PROJECT_DIR="$(cd "$(dirname "$0")" && pwd)"

# Remove old package to avoid stale contents
rm -f "$PROJECT_DIR/$PACKAGE_NAME"

# Create temporary directory for packaging
TEMP_DIR=$(mktemp -d)
trap "rm -rf $TEMP_DIR" EXIT

echo "📂 Using temporary directory: $TEMP_DIR"

# Create schemas subdirectory
mkdir -p "$TEMP_DIR/schemas"

# Copy only required files directly to temp root (following EGO guidelines)
echo "COPY: Extension files..."
cp "$PROJECT_DIR/extension/"*.js "$TEMP_DIR/"
cp "$PROJECT_DIR/extension/metadata.json" "$TEMP_DIR/"
cp "$PROJECT_DIR/extension/bolt.svg" "$TEMP_DIR/"
mkdir -p "$TEMP_DIR/library"
cp -r "$PROJECT_DIR/extension/library/"* "$TEMP_DIR/library/"
cp "$PROJECT_DIR/extension/schemas"/*.gschema.xml "$TEMP_DIR/schemas/" 2>/dev/null || true

# Create zip package - files at root level, not in subdirectory
echo "ZIP: Creating package..."
cd "$TEMP_DIR"
zip -r -q "$PROJECT_DIR/${PACKAGE_NAME}" ./*

# Validate ZIP contents against schema
ZIP_PATH="$PROJECT_DIR/${PACKAGE_NAME}"
SCHEMA_PATH="$PROJECT_DIR/.build-schema.json"
echo "🔍 Validating ZIP contents against schema..."
ZIP_PATH="$ZIP_PATH" SCHEMA_PATH="$SCHEMA_PATH" node - <<'NODE'
const fs = require('fs');
const { execSync } = require('child_process');
const zipPath = process.env.ZIP_PATH;
const schemaPath = process.env.SCHEMA_PATH;
if (!fs.existsSync(schemaPath)) {
  console.error(`❌ Schema file not found: ${schemaPath}`);
  process.exit(1);
}
const schema = JSON.parse(fs.readFileSync(schemaPath, 'utf8'));
const allowedFiles = new Set(schema.allowed_files);
const allowedDirs = new Set(schema.allowed_directories);
const list = execSync(`unzip -Z1 "${zipPath}"`).toString().trim().split('\n').filter(Boolean);
const unexpected = [];
const foundFiles = [];
for (const entry of list) {
  if (entry.endsWith('/')) {
    const dir = entry.replace(/\/$/, '');
    if (dir && !allowedDirs.has(dir)) unexpected.push(`Directory: ${dir}`);
  } else {
    if (!allowedFiles.has(entry)) unexpected.push(`File: ${entry}`);
    else foundFiles.push(entry);
  }
}
const missing = [...allowedFiles].filter(f => !foundFiles.includes(f));
if (missing.length || unexpected.length) {
  if (missing.length) {
    console.error('❌ Missing expected files:');
    missing.forEach(f => console.error(`   - ${f}`));
  }
  if (unexpected.length) {
    console.error('❌ Unexpected items in ZIP:');
    unexpected.forEach(i => console.error(`   - ${i}`));
  }
  process.exit(1);
}
console.log('✅ ZIP contents validated against schema.');
NODE

echo ""
echo "✅ Extension package ready!"
echo "📦 Package: $PACKAGE_NAME"
echo "📁 Location: $PROJECT_DIR/$PACKAGE_NAME"
echo ""

# Validation Step
echo "🔍 Validating package contents (Internal Structure):"
echo "---------------------------------------------------"
if command -v unzip >/dev/null 2>&1; then
    unzip -l "$PROJECT_DIR/$PACKAGE_NAME"
elif command -v zipinfo >/dev/null 2>&1; then
    zipinfo "$PROJECT_DIR/$PACKAGE_NAME"
else
    echo "⚠️  'unzip' or 'zipinfo' not found. Cannot list contents automatically."
fi
echo "---------------------------------------------------"
echo "Upload this file to: https://extensions.gnome.org/"
