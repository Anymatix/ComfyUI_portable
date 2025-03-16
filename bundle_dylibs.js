#!/usr/bin/env node

const fs = require('fs');
const path = require('path');
const { execSync } = require('child_process');

// Configuration
const SOURCE_DIR = path.join(__dirname, 'anymatix', 'miniforge', 'lib');
const OUTPUT_DIR = path.join(__dirname, 'bundled_dylibs');
const DYLIBS_TO_BUNDLE = [
    'libjpeg*.dylib',
    'libtiff*.dylib',
    'libpng*.dylib',
    'libwebp*.dylib',
    'libfreetype*.dylib',
    'liblcms*.dylib',
    'libopenjp*.dylib',
    'libiconv*.dylib',
    'libz*.dylib'
];

// Create output directory
if (!fs.existsSync(OUTPUT_DIR)) {
    fs.mkdirSync(OUTPUT_DIR, { recursive: true });
}

// Find and copy all matching dylibs
console.log('Searching for dynamic libraries...');
for (const pattern of DYLIBS_TO_BUNDLE) {
    try {
        const cmd = `find "${SOURCE_DIR}" -name "${pattern}" -type f`;
        const files = execSync(cmd).toString().trim().split('\n');

        for (const file of files) {
            if (file && fs.existsSync(file)) {
                const fileName = path.basename(file);
                const destPath = path.join(OUTPUT_DIR, fileName);

                console.log(`Copying ${fileName}...`);
                fs.copyFileSync(file, destPath);
            }
        }
    } catch (error) {
        console.error(`Error finding ${pattern}: ${error.message}`);
    }
}

// Create a README file
const readmeContent = `# Bundled Dynamic Libraries for macOS

This directory contains dynamic libraries needed for PIL and other packages to work correctly on macOS.

## Usage

Copy these files to the PIL/.dylibs directory in your Python installation:

\`\`\`bash
# Find the PIL directory
PIL_DIR=$(find "/path/to/your/miniforge/lib" -path "*/site-packages/PIL" -type d | head -n 1)

# Create .dylibs directory if it doesn't exist
mkdir -p "$PIL_DIR/.dylibs"

# Copy all dylibs
cp /path/to/these/files/* "$PIL_DIR/.dylibs/"
\`\`\`

## Libraries Included

${fs.readdirSync(OUTPUT_DIR).filter(f => f.endsWith('.dylib')).join('\n')}
`;

fs.writeFileSync(path.join(OUTPUT_DIR, 'README.md'), readmeContent);

// Create a script to install the libraries
const installScriptContent = `#!/bin/bash

# Get the directory where this script is located
SCRIPT_DIR="$( cd "$( dirname "\${BASH_SOURCE[0]}" )" && pwd )"

# Find the PIL directory
PIL_DIR=$(find "$1" -path "*/site-packages/PIL" -type d | head -n 1)

if [ -z "$PIL_DIR" ]; then
  echo "Error: Could not find PIL directory in $1"
  echo "Usage: $0 /path/to/miniforge/lib"
  exit 1
fi

# Create .dylibs directory if it doesn't exist
mkdir -p "$PIL_DIR/.dylibs"

# Copy all dylibs
echo "Copying libraries to $PIL_DIR/.dylibs/"
cp "$SCRIPT_DIR"/*.dylib "$PIL_DIR/.dylibs/"

echo "Done!"
`;

fs.writeFileSync(path.join(OUTPUT_DIR, 'install.sh'), installScriptContent);
execSync(`chmod +x ${path.join(OUTPUT_DIR, 'install.sh')}`);

console.log(`\nDone! ${fs.readdirSync(OUTPUT_DIR).filter(f => f.endsWith('.dylib')).length} libraries bundled in ${OUTPUT_DIR}`);
console.log('You can now include these files in your CI build or distribute them separately.');
console.log('Use the install.sh script to install them: ./install.sh /path/to/miniforge/lib'); 