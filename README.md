# ComfyUI Portable Environment Requirements

This document outlines the requirements and optimizations for the ComfyUI portable Python environment setup.

## Core Requirements

1. **Multi-platform Support**
   - Windows, macOS, and Linux compatibility
   - Architecture-specific builds (x86_64, arm64/aarch64)
   - Cross-platform cleanup process using Node.js

2. **Minimal Installation Size**
   - Use Miniforge instead of Miniconda for smaller base installation
   - Balanced cleanup approach that preserves functionality while reducing size
   - Optimized compression with standard ZIP format

3. **Version Management**
   - Version information stored in `version.yml`
   - Version number included in artifact names

4. **Package Management**
   - Helper scripts for installing additional packages
   - Preservation of core pip functionality

## Implementation Details

### Python Environment

- **Miniforge**: Using Miniforge as the base Python distribution (smaller than Miniconda)
- **Dynamic Version URLs**: Always downloading the latest version using GitHub's `/latest/download/` URLs
- **Platform Detection**: Automatic detection of OS and architecture to download the correct installer

### Cleanup Process

The following cleanup steps are performed to balance size reduction with functionality:

1. Remove unnecessary directories:
   - `__pycache__`, `tests`, `test` directories
   - Documentation (`man`, `doc`, `docs`, `examples`)

2. Preserve package metadata for critical packages:
   - Metadata for packages like `tqdm`, `transformers`, `torch`, etc. is preserved
   - This ensures proper package version detection and dependency resolution

3. Remove conda package cache:
   - `pkgs/*` and `envs/` directories are removed to save space

4. Preserve all dynamic libraries:
   - All `.dylib`, `.so`, `.dll` files are preserved
   - Dynamic libraries are copied to the appropriate locations for PIL
   - No removal of any shared libraries to ensure all dependencies are available

5. Remove only static libraries and source maps:
   - Static libraries (`.a`) and source maps (`.js.map`) are removed
   - Header files are preserved to maintain compatibility

6. Remove only non-essential Python standard library modules:
   - Only `idlelib`, `turtledemo`, and `tkinter` are removed
   - All other modules are preserved to ensure compatibility

7. Remove Git repositories:
   - All `.git` directories from cloned repositories

### Package Installation

- Platform-specific helper scripts are created:
  - `install_package.sh` for macOS/Linux
  - `install_package.bat` for Windows
- These scripts provide a simple interface to install additional packages

### Artifact Structure

- ZIP files contain the `anymatix` directory as the root
- When extracted, the `anymatix` directory contains:
  - `ComfyUI`: The ComfyUI application
  - `miniforge`: The Python environment with all dependencies
- Consistent structure across all platforms (Windows, macOS, Linux)

### CI/CD Integration

- GitHub Actions workflow for automated builds
- Separate builds for Windows, macOS, and Linux
- Version number from `version.yml` or workflow input parameter
- Artifact naming includes version and platform information

## Dependencies

The Python environment includes the following key dependencies:

- PyTorch ecosystem (torch, torchvision, torchaudio)
- Transformers and related libraries
- Image processing libraries (PIL with all required native dependencies)
- ComfyUI and custom nodes

## Known Issues and Solutions

- **macOS Security**: On macOS, you may need to remove quarantine attributes with `xattr -r -d com.apple.quarantine .` to run the Python executable.
- **First Run**: The first run may take longer as Python compiles various modules.

## Future Improvements

- Further size optimization by selective inclusion of Python packages
- Improved error handling for network issues during downloads
- More granular control over which components are included
- GUI for package management 