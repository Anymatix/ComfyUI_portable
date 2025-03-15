# ComfyUI Portable Environment Setup

This repository contains scripts to set up a portable Python environment for ComfyUI that works across Windows, macOS, and Linux.

## Core Requirements

- **Multi-Platform Support**: Works on Windows, macOS, and Linux
- **Minimal Installation Size**: Optimized for size while maintaining functionality
- **Cross-Platform Setup**: Uses Node.js to set up a portable Python environment with all required dependencies

## How It Works

The setup script (`setup-python-env.js`) performs the following tasks:

1. Downloads and installs Miniforge (a minimal Conda distribution)
2. Installs all required Python packages from `requirements.txt`
3. Clones the ComfyUI repository and custom nodes
4. Performs a minimal cleanup to optimize size while preserving functionality

## Platform-Specific Library Handling

The script handles dynamic libraries differently based on the platform to optimize size and ensure compatibility:

- **macOS**: Copies all `.dylib` files to the PIL/.dylibs directory to ensure proper loading
- **Linux**: Only copies essential libraries for PIL to avoid excessive size (the full Linux environment was previously 12GB!)
- **Windows**: Copies all DLL files needed for proper operation

### Linux Users

On Linux, a helper script `set_library_path.sh` is created in the `anymatix` directory. This script sets the `LD_LIBRARY_PATH` environment variable to help find the necessary libraries at runtime. To use ComfyUI on Linux, run:

```bash
cd anymatix
./set_library_path.sh ./ComfyUI/main.py
```

## Cleanup Process

The cleanup process is designed to be minimal and preserve full functionality:

- Removes unnecessary directories like `__pycache__`, `man`, `doc`, `docs`, and `examples`
- Preserves all NumPy and SciPy test directories to ensure proper functionality
- Removes conda package cache and environments
- Preserves all dynamic libraries needed for operation
- Only removes static libraries (`.a` files) which are not needed at runtime

## Artifact Structure

GitHub Actions artifacts directly contain the `anymatix` directory, ensuring a consistent structure across platforms. The directory contains:

- `ComfyUI`: The ComfyUI repository with custom nodes
- `miniforge`: The Python environment with all required packages

## Known Issues and Solutions

- **macOS Security**: The first run of the Python executable might be blocked by macOS security. Right-click on the executable and select "Open" to bypass this.
- **Linux Library Path**: On Linux, use the provided `set_library_path.sh` script to ensure all libraries are found correctly.

## Development

To install additional packages, use the provided helper scripts:

- Windows: `install_package.bat package_name`
- macOS/Linux: `./install_package.sh package_name`

## License

This project is licensed under the MIT License - see the LICENSE file for details. 