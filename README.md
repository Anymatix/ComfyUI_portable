# ComfyUI Portable Environment Requirements

This document outlines the requirements and optimizations for the ComfyUI portable Python environment setup.

## Core Requirements

1. **Multi-platform Support**
   - Windows, macOS, and Linux compatibility
   - Architecture-specific builds (x86_64, arm64/aarch64)
   - Cross-platform cleanup process using Node.js

2. **Minimal Installation Size**
   - Use Miniforge instead of Miniconda for smaller base installation
   - Smart cleanup of unnecessary files while preserving required dependencies
   - Optimized compression with GitHub Actions artifact compression

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

The following cleanup steps are performed to minimize the installation size while ensuring functionality:

1. Remove unnecessary directories:
   - `__pycache__`, `tests`, `test` directories
   - Documentation (`man`, `doc`, `docs`, `examples`)

2. Preserve package metadata for critical packages:
   - Metadata for packages like `tqdm`, `transformers`, `torch`, etc. is preserved
   - This ensures proper package version detection and dependency resolution

3. Remove conda package cache:
   - `pkgs/*`, `conda-meta/*.json`, `envs/`

4. Selectively remove unnecessary file types:
   - Static libraries (`.a`) and source maps (`.js.map`)
   - Selectively remove header files (`.h`, `.hpp`) while preserving essential ones
   - Preserve all dynamic libraries needed by packages

5. Preserve dynamic library dependencies:
   - Copy required `.dylibs` files to the appropriate locations
   - Ensure PIL and other packages can find their native dependencies
   - Maintain proper library paths for cross-platform compatibility

6. Remove unused Python standard library modules:
   - `idlelib`, `turtledemo`, `tkinter`, `ensurepip`, `distutils`, `lib2to3`
   - Preserve `unittest` and other modules required by PyTorch

7. Remove Git repositories:
   - All `.git` directories from cloned repositories

### Package Installation

- Platform-specific helper scripts are created:
  - `install_package.sh` for macOS/Linux
  - `install_package.bat` for Windows
- These scripts provide a simple interface to install additional packages

### Artifact Structure

- GitHub Actions artifacts directly contain the `anymatix` directory
- When downloaded and extracted, the `anymatix` directory is immediately available
- No nested zip files or additional extraction steps required
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

- **Dynamic Library Dependencies**: The portable environment preserves all necessary dynamic libraries to ensure packages like PIL work correctly across platforms.
- **Module Dependencies**: Some Python modules (like `unittest`) are preserved even during aggressive cleanup because they're required by packages like PyTorch.
- **Package Metadata**: Metadata for critical packages is preserved to ensure proper version detection and dependency resolution.
- **macOS Security**: On macOS, you may need to remove quarantine attributes with `xattr -r -d com.apple.quarantine .` to run the Python executable.

## Future Improvements

- Further size optimization by selective inclusion of Python packages
- Improved error handling for network issues during downloads
- More granular control over which components are included
- GUI for package management 