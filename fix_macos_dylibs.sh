#!/bin/bash

# This script fixes the dynamic libraries for macOS in the CI build
# It should be run after the Python environment is set up

# Get the directory where this script is located
SCRIPT_DIR="$( cd "$( dirname "${BASH_SOURCE[0]}" )" && pwd )"

# Find the PIL directory
PIL_DIR=$(find "${SCRIPT_DIR}/anymatix/miniforge/lib" -path "*/site-packages/PIL" -type d | head -n 1)

if [ -z "$PIL_DIR" ]; then
  echo "Error: Could not find PIL directory"
  exit 1
fi

# Create .dylibs directory if it doesn't exist
DYLIBS_DIR="${PIL_DIR}/.dylibs"
mkdir -p "${DYLIBS_DIR}"
echo "Created .dylibs directory at: ${DYLIBS_DIR}"

# Find all dylibs in the miniforge directory
echo "Searching for dynamic libraries..."
DYLIBS=$(find "${SCRIPT_DIR}/anymatix/miniforge/lib" -name "*.dylib" -type f)

# Copy all dylibs to PIL/.dylibs
for DYLIB in $DYLIBS; do
  FILENAME=$(basename "${DYLIB}")
  echo "Copying ${FILENAME} to ${DYLIBS_DIR}"
  cp "${DYLIB}" "${DYLIBS_DIR}/"
done

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