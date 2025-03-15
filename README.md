# ComfyUI Portable Environment Requirements

This document outlines the requirements and optimizations for the ComfyUI portable Python environment setup.

## Core Requirements

1. **Multi-platform Support**
   - Windows, macOS, and Linux compatibility
   - Architecture-specific builds (x86_64, arm64/aarch64)
   - Cross-platform cleanup process using Node.js

2. **Minimal Installation Size**
   - Use Miniforge instead of Miniconda for smaller base installation
   - Aggressive cleanup of unnecessary files
   - Optimized compression with 7-Zip

3. **Version Management**
   - Version information stored in `version.yml`
   - Version number included in zip filenames

4. **Package Management**
   - Helper scripts for installing additional packages
   - Preservation of core pip functionality

## Implementation Details

### Python Environment

- **Miniforge**: Using Miniforge as the base Python distribution (smaller than Miniconda)
- **Dynamic Version URLs**: Always downloading the latest version using GitHub's `/latest/download/` URLs
- **Platform Detection**: Automatic detection of OS and architecture to download the correct installer

### Cleanup Process

The following cleanup steps are performed to minimize the installation size:

1. Remove unnecessary directories:
   - `__pycache__`, `tests`, `test` directories
   - Package metadata (`.dist-info`, `.egg-info`)
   - Documentation (`man`, `doc`, `docs`, `examples`)

2. Remove conda package cache:
   - `pkgs/*`, `conda-meta/*.json`, `envs/`

3. Remove unnecessary file types:
   - `.a`, `.js.map`, `.h`, `.hpp`, `.c`, `.cpp`

4. Remove unused Python standard library modules:
   - `idlelib`, `turtledemo`, `tkinter`, `ensurepip`, `distutils`, `lib2to3`, `unittest`

5. Remove Git repositories:
   - All `.git` directories from cloned repositories

### Package Installation

- Platform-specific helper scripts are created:
  - `install_package.sh` for macOS/Linux
  - `install_package.bat` for Windows
- These scripts provide a simple interface to install additional packages

### Compression

- Using 7-Zip with optimal compression settings:
  - `-t7z -mx=9 -mfb=273 -ms -md=31 -myx=9 -mtm=- -mmt -mmtf -md=1536m -mmf=bt3 -mmc=10000 -mpb=0 -mlc=0`

### CI/CD Integration

- GitHub Actions workflow for automated builds
- Separate builds for Windows, macOS, and Linux
- Version number from `version.yml` or workflow input parameter
- Artifact naming includes version and platform information

## Dependencies

The Python environment includes the following key dependencies:

- PyTorch ecosystem (torch, torchvision, torchaudio)
- Transformers and related libraries
- Image processing libraries
- ComfyUI and custom nodes

## Future Improvements

- Further size optimization by selective inclusion of Python packages
- Improved error handling for network issues during downloads
- More granular control over which components are included
- GUI for package management 