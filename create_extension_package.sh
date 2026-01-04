#!/bin/bash

# Create extension package for GNOME Extensions website
# Usage: ./create_extension_package.sh

set -e

echo "Creating Batt-Watt Power Monitor extension package..."

SCRIPT_DIR="$(cd "$(dirname "$0")" && pwd)"

bash "$SCRIPT_DIR/package.sh"
