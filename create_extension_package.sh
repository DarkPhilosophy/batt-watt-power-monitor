#!/bin/bash

# Create extension package for GNOME Extensions website
# Usage: ./create_extension_package.sh

set -e

echo "Creating Batt-Watt Power Monitor extension package..."

# Extension details
EXTENSION_NAME="batt-watt-power-monitor"
EXTENSION_UUID="batt-watt-power-monitor@DarkPhilosophy"
PACKAGE_NAME="${EXTENSION_UUID}.zip"

# Create temporary directory
TEMP_DIR=$(mktemp -d)
echo "Using temporary directory: $TEMP_DIR"

# Copy required files
cp -r "${EXTENSION_UUID}.shell-extension" "$TEMP_DIR/"
cp metadata.json "$TEMP_DIR/"
cp README.md "$TEMP_DIR/"
cp LICENSE "$TEMP_DIR/"
cp screenshot.png "$TEMP_DIR/"

# Create zip package
echo "Creating zip package..."
cd "$TEMP_DIR"
zip -r "../${PACKAGE_NAME}" ./*

# Move package to project root
mv "../${PACKAGE_NAME}" "~/Projects/batt_consumption_wattmetter/" || {
    echo "Error moving package, trying alternative..."
    mv "../${PACKAGE_NAME}" ./
    mv "./${PACKAGE_NAME}" "~/Projects/batt_consumption_wattmetter/"
}

# Clean up
echo "Cleaning up..."
cd ~
rm -rf "$TEMP_DIR"

# Verify package
echo "Package created: ${PACKAGE_NAME}"
ls -lh "~/Projects/batt_consumption_wattmetter/${PACKAGE_NAME}"

echo ""
echo "✅ Extension package ready for upload!"
echo "📁 Package: ${PACKAGE_NAME}"
echo "📊 Size: $(du -h ~/Projects/batt_consumption_wattmetter/${PACKAGE_NAME} | cut -f1)"
echo ""
echo "Upload to: https://extensions.gnome.org/upload/"
echo ""
echo "After uploading, you'll receive an extension ID like:"
echo "https://extensions.gnome.org/extension/<ID>/batt-watt-power-monitor/"
echo ""
echo "Update the README.md with the new extension URL!"
