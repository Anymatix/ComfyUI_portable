#!/bin/bash

# Get the directory where this script is located
SCRIPT_DIR="$( cd "$( dirname "${BASH_SOURCE[0]}" )" && pwd )"

# Add the library directory to LD_LIBRARY_PATH
export LD_LIBRARY_PATH="${SCRIPT_DIR}/miniforge/lib:$LD_LIBRARY_PATH"

# Execute ComfyUI
cd "${SCRIPT_DIR}"
./miniforge/bin/python3 ./ComfyUI/main.py "$@"

# If you need to pass additional arguments to ComfyUI, you can do so like this:
# ./miniforge/bin/python3 ./ComfyUI/main.py --arg1 value1 --arg2 value2 