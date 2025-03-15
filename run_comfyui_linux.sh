#!/bin/bash

# Get the directory where this script is located
SCRIPT_DIR="$( cd "$( dirname "${BASH_SOURCE[0]}" )" && pwd )"

# Add the library directory to LD_LIBRARY_PATH
export LD_LIBRARY_PATH="${SCRIPT_DIR}/miniforge/lib:${SCRIPT_DIR}/miniforge/lib64:$LD_LIBRARY_PATH"

# Also add the PIL/.dylibs directory to LD_LIBRARY_PATH
# Find the PIL directory
PIL_DYLIBS_DIR=$(find "${SCRIPT_DIR}/miniforge/lib" -path "*/site-packages/PIL/.dylibs" -type d | head -n 1)
if [ -n "$PIL_DYLIBS_DIR" ]; then
  export LD_LIBRARY_PATH="${PIL_DYLIBS_DIR}:${LD_LIBRARY_PATH}"
  echo "Added PIL/.dylibs to LD_LIBRARY_PATH: ${PIL_DYLIBS_DIR}"
fi

# Print environment variables for debugging
echo "LD_LIBRARY_PATH: $LD_LIBRARY_PATH"

# Execute ComfyUI
cd "${SCRIPT_DIR}"
./miniforge/bin/python3 ./ComfyUI/main.py "$@"

# If you need to pass additional arguments to ComfyUI, you can do so like this:
# ./miniforge/bin/python3 ./ComfyUI/main.py --arg1 value1 --arg2 value2 