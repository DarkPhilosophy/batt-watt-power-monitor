#!/bin/bash

# Simple script to create extension package
set -e

echo "Creating Batt-Watt Power Monitor package..."

cd ~/Projects/batt_consumption_wattmetter

# Create the zip package
zip -r batt-watt-power-monitor@DarkPhilosophy.zip \
    batt-watt-power-monitor@DarkPhilosophy.shell-extension/ \
    metadata.json \
    README.md \
    LICENSE \
    screenshot.png

echo ""
echo "✅ Package created: batt-watt-power-monitor@DarkPhilosophy.zip"
ls -lh batt-watt-power-monitor@DarkPhilosophy.zip

echo ""
echo "Upload to: https://extensions.gnome.org/upload/"
echo ""
echo "After uploading, update README.md with the new extension URL!"
