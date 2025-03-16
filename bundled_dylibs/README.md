# Bundled Dynamic Libraries for macOS

This directory contains dynamic libraries needed for PIL and other packages to work correctly on macOS.

## Usage

Copy these files to the PIL/.dylibs directory in your Python installation:

```bash
# Find the PIL directory
PIL_DIR=$(find "/path/to/your/miniforge/lib" -path "*/site-packages/PIL" -type d | head -n 1)

# Create .dylibs directory if it doesn't exist
mkdir -p "$PIL_DIR/.dylibs"

# Copy all dylibs
cp /path/to/these/files/* "$PIL_DIR/.dylibs/"
```

## Libraries Included

libfreetype.6.dylib
libiconv.2.dylib
libiconv.dylib
libjpeg.62.4.0.dylib
libjpeg.8.2.2.dylib
liblcms2.2.dylib
libopenjp2.2.5.2.dylib
libopenjp2.2.5.3.dylib
libpng16.16.dylib
libtiff.6.dylib
libwebp.7.1.10.dylib
libwebp.7.1.8.dylib
libwebp.7.1.9.dylib
libwebp.7.dylib
libwebpdemux.2.dylib
libwebpmux.3.1.0.dylib
libwebpmux.3.1.1.dylib
libwebpmux.3.dylib
libz.1.2.13.dylib
libz.1.3.1.dylib
libz.1.3.1.zlib-ng.dylib
libz.1.dylib
libzmq.5.dylib
libzstd.1.5.6.dylib
libzstd.1.dylib
libzstd.dylib
