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
4. Optionally performs a minimal cleanup to optimize size (disabled by default to ensure full functionality)

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

### macOS Users

On macOS, a helper script `set_dyld_path.sh` is created in the `anymatix` directory. This script sets the `DYLD_LIBRARY_PATH` environment variable to help find the necessary libraries at runtime. If you encounter library loading issues (like missing `libtiff.6.dylib`), use this script:

```bash
cd anymatix
./set_dyld_path.sh ./ComfyUI/main.py
```

## Cleanup Process (Optional)

The cleanup process is now **disabled by default** to ensure full functionality. It can be enabled with the `--enable-cleanup=true` flag when running the setup script, but this may cause issues with some libraries like PIL.

When enabled, the cleanup process:

- Removes unnecessary directories like `__pycache__`, `man`, `doc`, `docs`, and `examples`
- Preserves all NumPy and SciPy test directories to ensure proper functionality
- Removes conda package cache and environments
- Preserves all dynamic libraries needed for operation
- Only removes static libraries (`.a` files) which are not needed at runtime
- Removes Python bytecode files (.pyc, .pyo) to save space
- Cleans up unnecessary Python packages that aren't needed for ComfyUI
- Performs platform-specific cleanup to significantly reduce size:
  - On Linux: Removes unnecessary shared libraries and directories
  - On macOS: Removes unnecessary dylibs and directories
  - On Windows: Removes unnecessary DLLs and directories

The cleanup process is particularly effective for Linux, where it can reduce the size by up to 70-80%. For macOS and Windows, the size reduction is typically 40-60%.

## Size Considerations

The size of the portable environment varies by platform:

- **Windows**: ~500-700MB with cleanup enabled
- **macOS**: ~400-600MB with cleanup enabled
- **Linux**: ~300-500MB with cleanup enabled

Without cleanup, the sizes can be significantly larger, especially on Linux where it can exceed 1GB.

## CI/CD Workflow

The GitHub Actions workflow includes a comprehensive caching system to speed up builds:

- **Cache Key Generation**: SHA256 hashes of `requirements.txt` and `setup-python-env.js` are used to create unique cache keys
- **Directory Caching**: The `anymatix` directory is cached to avoid rebuilding when inputs haven't changed
- **Artifact Caching**: The final zip file is also cached for faster artifact generation
- **Force Rebuild**: You can force a rebuild by setting the `force_rebuild` input parameter to `true`
- **Optional Cleanup**: The cleanup process can be enabled with the `enable_cleanup` input parameter (default: `false`)
- **Restore Keys**: Fallback cache keys are provided to maximize cache hits even when specific versions change

This caching system significantly reduces build times when there are no changes to the core files, while ensuring that any changes to the requirements or setup script will trigger a fresh build.

## Artifact Structure

GitHub Actions artifacts directly contain the `anymatix` directory, ensuring a consistent structure across platforms. The directory contains:

- `ComfyUI`: The ComfyUI repository with custom nodes
- `miniforge`: The Python environment with all required packages
- `run_comfyui.sh` (macOS/Linux) or `run_comfyui.bat` (Windows): Platform-specific helper scripts to launch ComfyUI

## Running ComfyUI

To run ComfyUI, use the platform-specific helper script included in the `anymatix` directory:

### Windows
```
cd anymatix
run_comfyui.bat
```

### macOS
```bash
cd anymatix
./run_comfyui.sh
```

### Linux
```bash
cd anymatix
./run_comfyui.sh
```

These scripts set up the necessary environment variables and launch ComfyUI with the correct Python interpreter. They automatically:

- Set the appropriate library path environment variables (`PATH` on Windows, `LD_LIBRARY_PATH` on Linux, `DYLD_LIBRARY_PATH` on macOS)
- Add both the main library directory and the PIL/.dylibs directory to the search paths
- Change to the correct directory before launching ComfyUI
- Pass any additional arguments to ComfyUI

If you encounter any library loading issues, the helper scripts should resolve them by ensuring all libraries are found correctly.

## Known Issues and Solutions

- **macOS Security**: The first run of the Python executable might be blocked by macOS security. Right-click on the executable and select "Open" to bypass this.
- **Linux Library Path**: On Linux, use the provided `run_comfyui.sh` script to ensure all libraries are found correctly.
- **PIL Library Issues**: If you encounter errors with PIL libraries not being found (e.g., `libtiff.6.dylib`), use the platform-specific helper script (`run_comfyui.sh` on macOS/Linux or `run_comfyui.bat` on Windows) which sets the necessary environment variables.
- **General Library Issues**: Always use the provided helper scripts to run ComfyUI, as they set up the correct environment for each platform.

## Development

To install additional packages, use the provided helper scripts:

- Windows: `install_package.bat package_name`
- macOS/Linux: `./install_package.sh package_name`

### Running the Setup Script Manually

To run the setup script manually with specific options:

```bash
# Default setup (no cleanup)
node setup-python-env.js

# Enable cleanup (may cause issues with some libraries)
node setup-python-env.js --enable-cleanup=true

# Test the launcher after setup
node setup-python-env.js --test-launcher

# Enable cleanup and test the launcher
node setup-python-env.js --enable-cleanup=true --test-launcher
```

The `--test-launcher` (or `-t`) option will run ComfyUI after setup, wait for it to start and print its IP address, and then automatically terminate it. This is useful for verifying that the environment is correctly set up and the launcher script works properly.

## License

This project is licensed under the MIT License - see the LICENSE file for details. 