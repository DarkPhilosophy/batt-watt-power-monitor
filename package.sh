#!/bin/bash

# Create extension package for GNOME Extensions website (EGO)
# Follows EGO review guidelines - excludes unnecessary files
# Files must be at ZIP root level, NOT in a subdirectory
# Usage: ./package.sh

set -e

# Sync version from package.json
echo "Syncing version..."
node scripts/sync-version.js

# Lint check (for status update)
echo "Checking code quality..."
PROJECT_DIR="$(cd "$(dirname "$0")" && pwd)"
LINT_OUTPUT_FILE="$PROJECT_DIR/.lint-output.txt"
LINT_PASSED_FILE="$PROJECT_DIR/.lint-passed"
lint_output=$(npm run lint -- --format stylish 2>&1)
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
node scripts/update-lint-status.js

echo "🏗️  Building Batt-Watt Power Monitor extension package..."

# Extension details
EXTENSION_UUID="batt-watt-power-monitor@DarkPhilosophy"
PACKAGE_NAME="${EXTENSION_UUID}.zip"
PROJECT_DIR="$(cd "$(dirname "$0")" && pwd)"

# Create temporary directory for packaging
TEMP_DIR=$(mktemp -d)
trap "rm -rf $TEMP_DIR" EXIT

echo "📂 Using temporary directory: $TEMP_DIR"

# Create schemas subdirectory
mkdir -p "$TEMP_DIR/schemas"

# Copy only required files directly to temp root (following EGO guidelines)
echo "COPY: Extension files..."
cp "$PROJECT_DIR/extension/extension.js" "$TEMP_DIR/"
cp "$PROJECT_DIR/extension/prefs.js" "$TEMP_DIR/"
cp "$PROJECT_DIR/extension/metadata.json" "$TEMP_DIR/"
cp "$PROJECT_DIR/extension/bolt.svg" "$TEMP_DIR/"
cp "$PROJECT_DIR/extension/schemas"/*.gschema.xml "$TEMP_DIR/schemas/" 2>/dev/null || true

# Create zip package - files at root level, not in subdirectory
echo "ZIP: Creating package..."
cd "$TEMP_DIR"
zip -r -q "$PROJECT_DIR/${PACKAGE_NAME}" ./*

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
