#!/bin/bash

set -e

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

# Generate build date
echo "Generating build date..."
date -u +"%Y-%m-%d %H:%M:%S UTC" > build_date.txt

# Create extension directory if it doesn't exist
mkdir -p "$EXTENSION_DIR/schemas"

# Copy files directly
echo "Installing files..."
cp extension.js prefs.js build_date.txt metadata.json "$EXTENSION_DIR/"
cp schemas/*.gschema.xml "$EXTENSION_DIR/schemas/"

# Compile schemas in the extension directory
echo "Compiling schemas..."
glib-compile-schemas "$EXTENSION_DIR/schemas/"

# Also install schemas to user's glib-2.0 directory for system-wide access
echo "Installing schemas to user glib directory..."
mkdir -p "$GLIB_SCHEMA_DIR"
cp schemas/*.gschema.xml "$GLIB_SCHEMA_DIR/"
glib-compile-schemas "$GLIB_SCHEMA_DIR/"

# Re-enable extension
echo "Enabling extension..."
gnome-extensions enable "$EXTENSION_ID" || true
sleep 2

echo "Extension built and installed successfully!"
echo "Build date: $(cat build_date.txt)"
echo ""
echo "Schema location: $GLIB_SCHEMA_DIR"
echo "Extension location: $EXTENSION_DIR"
