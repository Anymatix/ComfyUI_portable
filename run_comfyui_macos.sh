#!/bin/bash

# Get the directory where this script is located
SCRIPT_DIR="$( cd "$( dirname "${BASH_SOURCE[0]}" )" && pwd )"

# Clear existing library paths to avoid conflicts
export DYLD_LIBRARY_PATH=""
export DYLD_FALLBACK_LIBRARY_PATH=""

# Add the library directory to DYLD_LIBRARY_PATH
export DYLD_LIBRARY_PATH="${SCRIPT_DIR}/miniforge/lib:$DYLD_LIBRARY_PATH"

# Find the PIL directory
PIL_DYLIBS_DIR=$(find "${SCRIPT_DIR}/miniforge/lib" -path "*/site-packages/PIL/.dylibs" -type d | head -n 1)
if [ -n "$PIL_DYLIBS_DIR" ]; then
  export DYLD_LIBRARY_PATH="${PIL_DYLIBS_DIR}:${DYLD_LIBRARY_PATH}"
  echo "Added PIL/.dylibs to DYLD_LIBRARY_PATH: ${PIL_DYLIBS_DIR}"
else
  echo "WARNING: PIL/.dylibs directory not found!"
  # Try to create it if PIL directory exists
  PIL_DIR=$(find "${SCRIPT_DIR}/miniforge/lib" -path "*/site-packages/PIL" -type d | head -n 1)
  if [ -n "$PIL_DIR" ]; then
    echo "Found PIL directory at: ${PIL_DIR}"
    PIL_DYLIBS_DIR="${PIL_DIR}/.dylibs"
    mkdir -p "${PIL_DYLIBS_DIR}"
    echo "Created .dylibs directory at: ${PIL_DYLIBS_DIR}"
    export DYLD_LIBRARY_PATH="${PIL_DYLIBS_DIR}:${DYLD_LIBRARY_PATH}"
  fi
fi

# Set DYLD_FALLBACK_LIBRARY_PATH as well
export DYLD_FALLBACK_LIBRARY_PATH="${SCRIPT_DIR}/miniforge/lib:${PIL_DYLIBS_DIR}:/usr/local/lib:/usr/lib:$DYLD_FALLBACK_LIBRARY_PATH"

# Print environment variables for debugging
echo "DYLD_LIBRARY_PATH: $DYLD_LIBRARY_PATH"
echo "DYLD_FALLBACK_LIBRARY_PATH: $DYLD_FALLBACK_LIBRARY_PATH"

# Check for libtiff.6.dylib in PIL/.dylibs
if [ -n "$PIL_DYLIBS_DIR" ]; then
  if [ -f "${PIL_DYLIBS_DIR}/libtiff.6.dylib" ]; then
    echo "libtiff.6.dylib found in PIL/.dylibs"
  else
    echo "WARNING: libtiff.6.dylib not found in PIL/.dylibs!"
    
    # Search for libtiff.6.dylib in the system
    SYSTEM_LIBTIFF=$(find /usr/local/lib /usr/lib -name "libtiff.6.dylib" 2>/dev/null | head -n 1)
    if [ -n "$SYSTEM_LIBTIFF" ]; then
      echo "Found system libtiff.6.dylib at: ${SYSTEM_LIBTIFF}"
      echo "Copying to PIL/.dylibs..."
      cp "${SYSTEM_LIBTIFF}" "${PIL_DYLIBS_DIR}/"
      echo "Creating symbolic link for libtiff.dylib..."
      ln -sf "${PIL_DYLIBS_DIR}/libtiff.6.dylib" "${PIL_DYLIBS_DIR}/libtiff.dylib"
    else
      echo "WARNING: libtiff.6.dylib not found in system libraries!"
    fi
  fi
fi

# Execute ComfyUI
cd "${SCRIPT_DIR}"
./miniforge/bin/python3 ./ComfyUI/main.py "$@"

# If you need to pass additional arguments to ComfyUI, you can do so like this:
# ./miniforge/bin/python3 ./ComfyUI/main.py --arg1 value1 --arg2 value2 