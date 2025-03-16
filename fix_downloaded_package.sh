#!/bin/bash

# This script fixes the dynamic libraries for macOS in a downloaded package
# Usage: ./fix_downloaded_package.sh /path/to/extracted/package

if [ -z "$1" ]; then
  echo "Usage: $0 /path/to/extracted/package"
  exit 1
fi

PACKAGE_DIR="$1"

# Find the PIL directory
PIL_DIR=$(find "${PACKAGE_DIR}" -path "*/site-packages/PIL" -type d | head -n 1)

if [ -z "$PIL_DIR" ]; then
  echo "Error: Could not find PIL directory in ${PACKAGE_DIR}"
  exit 1
fi

echo "Found PIL directory at: ${PIL_DIR}"

# Create .dylibs directory if it doesn't exist
DYLIBS_DIR="${PIL_DIR}/.dylibs"
mkdir -p "${DYLIBS_DIR}"
echo "Created .dylibs directory at: ${DYLIBS_DIR}"

# Copy bundled dylibs if available
SCRIPT_DIR="$( cd "$( dirname "${BASH_SOURCE[0]}" )" && pwd )"
BUNDLED_DYLIBS_DIR="${SCRIPT_DIR}/bundled_dylibs"

if [ -d "${BUNDLED_DYLIBS_DIR}" ]; then
  echo "Found bundled dylibs at: ${BUNDLED_DYLIBS_DIR}"
  echo "Copying bundled dylibs to ${DYLIBS_DIR}"
  cp "${BUNDLED_DYLIBS_DIR}"/*.dylib "${DYLIBS_DIR}/"
else
  echo "No bundled dylibs found at: ${BUNDLED_DYLIBS_DIR}"
  
  # Find all dylibs in the package
  echo "Searching for dynamic libraries in the package..."
  DYLIBS=$(find "${PACKAGE_DIR}" -name "*.dylib" -type f)
  
  # Copy all dylibs to PIL/.dylibs
  for DYLIB in $DYLIBS; do
    FILENAME=$(basename "${DYLIB}")
    echo "Copying ${FILENAME} to ${DYLIBS_DIR}"
    cp "${DYLIB}" "${DYLIBS_DIR}/"
  done
  
  # Try to find system libraries if needed
  if [ ! -f "${DYLIBS_DIR}/libtiff.6.dylib" ]; then
    echo "Searching for libtiff.6.dylib in system libraries..."
    SYSTEM_LIBTIFF=$(find /usr/local/lib /usr/lib -name "libtiff.6.dylib" 2>/dev/null | head -n 1)
    if [ -n "${SYSTEM_LIBTIFF}" ]; then
      echo "Found system libtiff.6.dylib at: ${SYSTEM_LIBTIFF}"
      echo "Copying to ${DYLIBS_DIR}"
      cp "${SYSTEM_LIBTIFF}" "${DYLIBS_DIR}/"
    fi
  fi
  
  if [ ! -f "${DYLIBS_DIR}/libjpeg.62.4.0.dylib" ]; then
    echo "Searching for libjpeg.62.4.0.dylib in system libraries..."
    SYSTEM_LIBJPEG=$(find /usr/local/lib /usr/lib -name "libjpeg.62*.dylib" 2>/dev/null | head -n 1)
    if [ -n "${SYSTEM_LIBJPEG}" ]; then
      echo "Found system libjpeg at: ${SYSTEM_LIBJPEG}"
      echo "Copying to ${DYLIBS_DIR} as libjpeg.62.4.0.dylib"
      cp "${SYSTEM_LIBJPEG}" "${DYLIBS_DIR}/libjpeg.62.4.0.dylib"
    fi
  fi
fi

# Create symbolic links for common library names
echo "Creating symbolic links for common library names..."
COMMON_LIBS=(
  "libtiff.6.dylib:libtiff.dylib"
  "libjpeg.62.4.0.dylib:libjpeg.dylib"
  "libpng16.16.dylib:libpng.dylib"
  "libwebp.7.dylib:libwebp.dylib"
)

for LINK in "${COMMON_LIBS[@]}"; do
  FROM=$(echo "${LINK}" | cut -d':' -f1)
  TO=$(echo "${LINK}" | cut -d':' -f2)
  
  if [ -f "${DYLIBS_DIR}/${FROM}" ]; then
    echo "Creating symbolic link from ${FROM} to ${TO}"
    ln -sf "${FROM}" "${DYLIBS_DIR}/${TO}" || {
      echo "Failed to create symbolic link, copying instead"
      cp "${DYLIBS_DIR}/${FROM}" "${DYLIBS_DIR}/${TO}"
    }
  else
    echo "Warning: ${FROM} not found, cannot create symbolic link to ${TO}"
  fi
done

# Print the contents of the .dylibs directory
echo "Contents of ${DYLIBS_DIR}:"
ls -la "${DYLIBS_DIR}"

echo "Done!"
echo "Now try running the package with: ${PACKAGE_DIR}/run_comfyui.sh" 