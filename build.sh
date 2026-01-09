#!/bin/bash

set -e

# Sync version from package.json
echo "Syncing version..."
node scripts/sync-version.js

# Update lint status in README
echo "Updating lint status..."
node scripts/update-lint-status.js

EXTENSION_ID="batt-watt-power-monitor@DarkPhilosophy"
EXTENSION_DIR="$HOME/.local/share/gnome-shell/extensions/$EXTENSION_ID"
GLIB_SCHEMA_DIR="$HOME/.local/share/glib-2.0/schemas"
PROJECT_DIR="$(cd "$(dirname "$0")" && pwd)"

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
cp "$PROJECT_DIR/extension/extension.js" "$PROJECT_DIR/extension/prefs.js" "$PROJECT_DIR/extension/metadata.json" "$PROJECT_DIR/extension/bolt.svg" "$PROJECT_DIR/extension/bolt_stroke.svg" "$EXTENSION_DIR/"
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
