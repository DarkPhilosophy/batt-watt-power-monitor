#!/bin/bash

set -e

# Parse arguments
FIX_MODE=false
while [[ $# -gt 0 ]]; do
    case "$1" in
        -fix|--fix)
            FIX_MODE=true
            shift
            ;;
        -h|--help)
            echo "Usage: ./build.sh [OPTIONS]"
            echo ""
            echo "Options:"
            echo "  --fix          Auto-fix linting issues before build"
            echo "  -h, --help     Show this help message"
            exit 0
            ;;
        *)
            echo "Unknown option: $1" >&2
            exit 1
            ;;
    esac
done

# Lint check
echo "Checking code quality..."
PROJECT_DIR="$(cd "$(dirname "$0")" && pwd)"
LINT_OUTPUT_FILE="$PROJECT_DIR/.lint-output.txt"
LINT_PASSED_FILE="$PROJECT_DIR/.lint-passed"

run_lint() {
    local output
    output=$(npm run lint -- --format stylish 2>&1)
    local status=$?
    printf "%s\n" "$output" > "$LINT_OUTPUT_FILE"
    if [ $status -eq 0 ]; then
        echo true > "$LINT_PASSED_FILE"
    else
        echo false > "$LINT_PASSED_FILE"
    fi
    printf "%s\n" "$output"
    return $status
}

if run_lint; then
    echo "✓ Linting passed"
elif [ "$FIX_MODE" = true ]; then
    echo "⚠ Linting issues found, auto-fixing..."
    npm run lint:fix
    if run_lint; then
        echo "✓ Linting passed after auto-fix"
    else
        echo "✗ Linting still failing after auto-fix. Please review manually:" >&2
        exit 1
    fi
else
    echo "✗ Linting failed. Fix issues or run: ./build.sh --fix" >&2
    exit 1
fi

# Sync version from package.json
echo "Syncing version..."
node scripts/sync-version.js

# Update lint status in README
echo "Updating lint status..."
node scripts/update-lint-status.js

EXTENSION_ID="batt-watt-power-monitor@DarkPhilosophy"
EXTENSION_DIR="$HOME/.local/share/gnome-shell/extensions/$EXTENSION_ID"
GLIB_SCHEMA_DIR="$HOME/.local/share/glib-2.0/schemas"

echo "Building $EXTENSION_ID..."

# Check if extension is enabled
ENABLED=$(gnome-extensions list | grep -c "$EXTENSION_ID" || true)

# Disable if enabled
if [ $ENABLED -gt 0 ]; then
    echo "Disabling extension..."
    gnome-extensions disable "$EXTENSION_ID" || true
    sleep 1
fi

if [ -d "$EXTENSION_DIR" ]; then
    echo "Removing previous install directory: $EXTENSION_DIR"
    rm -rf "$EXTENSION_DIR"
else
    echo "No existing install directory found."
fi
if [ -f "$GLIB_SCHEMA_DIR/gschemas.compiled" ]; then
    echo "Removing cached schemas: $GLIB_SCHEMA_DIR/gschemas.compiled"
    rm -f "$GLIB_SCHEMA_DIR/gschemas.compiled"
else
    echo "No cached schemas found."
fi

# Create extension directory if it doesn't exist
mkdir -p "$EXTENSION_DIR/schemas"

# Copy files directly
echo "Installing files..."
cp "$PROJECT_DIR/extension/extension.js" "$PROJECT_DIR/extension/prefs.js" "$PROJECT_DIR/extension/metadata.json" "$PROJECT_DIR/extension/bolt.svg" "$EXTENSION_DIR/"
cp "$PROJECT_DIR/extension/schemas"/*.gschema.xml "$EXTENSION_DIR/schemas/"

BUILD_DATE=$(date -u +"%Y-%m-%d %H:%M:%S UTC")
echo "Build date: $BUILD_DATE"
sed -i "s|^const BUILD_DATE = null;|const BUILD_DATE = '$BUILD_DATE';|" "$EXTENSION_DIR/prefs.js"

# Compile schemas in the extension directory
echo "Compiling schemas..."
glib-compile-schemas "$EXTENSION_DIR/schemas/"

# Also install schemas to user's glib-2.0 directory for system-wide access
echo "Installing schemas to user glib directory..."
mkdir -p "$GLIB_SCHEMA_DIR"
cp "$PROJECT_DIR/extension/schemas"/*.gschema.xml "$GLIB_SCHEMA_DIR/"
glib-compile-schemas "$GLIB_SCHEMA_DIR/"

# Re-enable extension
echo "Enabling extension..."
gnome-extensions enable "$EXTENSION_ID" || true
sleep 2

echo "Extension built and installed successfully!"
echo ""
echo "Schema location: $GLIB_SCHEMA_DIR"
echo "Extension location: $EXTENSION_DIR"
