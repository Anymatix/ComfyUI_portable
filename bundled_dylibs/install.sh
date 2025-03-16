#!/bin/bash

# Get the directory where this script is located
SCRIPT_DIR="$( cd "$( dirname "${BASH_SOURCE[0]}" )" && pwd )"

# Find the PIL directory
PIL_DIR=$(find "$1" -path "*/site-packages/PIL" -type d | head -n 1)

if [ -z "$PIL_DIR" ]; then
  echo "Error: Could not find PIL directory in $1"
  echo "Usage: $0 /path/to/miniforge/lib"
  exit 1
fi

# Create .dylibs directory if it doesn't exist
mkdir -p "$PIL_DIR/.dylibs"

# Copy all dylibs
echo "Copying libraries to $PIL_DIR/.dylibs/"
cp "$SCRIPT_DIR"/*.dylib "$PIL_DIR/.dylibs/"

echo "Done!"
