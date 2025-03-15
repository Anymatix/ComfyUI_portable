#!/usr/bin/env node

const fs = require('fs');
const path = require('path');
const crypto = require('crypto');
const os = require('os');
const https = require('https');

// Get platform-specific Miniforge URL
function getPlatformInfo() {
    const platform = os.platform();
    const arch = os.arch();

    if (platform === 'darwin') {
        return `https://github.com/conda-forge/miniforge/releases/latest/download/Miniforge3-MacOSX-${arch === 'arm64' ? 'arm64' : 'x86_64'}.sh`;
    } else if (platform === 'linux') {
        const linuxArch = arch === 'arm64' || arch === 'aarch64' ? 'aarch64' : 'x86_64';
        return `https://github.com/conda-forge/miniforge/releases/latest/download/Miniforge3-Linux-${linuxArch}.sh`;
    } else if (platform === 'win32') {
        if (arch === 'x64') {
            return 'https://github.com/conda-forge/miniforge/releases/latest/download/Miniforge3-Windows-x86_64.exe';
        } else {
            throw new Error(`Unsupported architecture for Windows: ${arch}. Only x64 is supported.`);
        }
    }

    throw new Error(`Unsupported platform: ${platform} ${arch}`);
}

// Get the URL redirect for the latest Miniforge release
function getLatestMiniforgeUrl(url) {
    return new Promise((resolve, reject) => {
        const protocol = url.startsWith('https') ? https : require('http');
        const options = new URL(url);

        protocol.get(options, (response) => {
            if (response.statusCode === 301 || response.statusCode === 302 || response.statusCode === 307) {
                resolve(response.headers.location);
            } else {
                resolve(url); // No redirect, use the original URL
            }
        }).on('error', (err) => {
            reject(err);
        });
    });
}

// Calculate SHA256 hash of a file
function calculateFileHash(filePath) {
    return new Promise((resolve, reject) => {
        const hash = crypto.createHash('sha256');
        const stream = fs.createReadStream(filePath);

        stream.on('data', (data) => hash.update(data));
        stream.on('end', () => resolve(hash.digest('hex')));
        stream.on('error', (err) => reject(err));
    });
}

// Calculate SHA256 hash of a string
function calculateStringHash(content) {
    const hash = crypto.createHash('sha256');
    hash.update(content);
    return hash.digest('hex');
}

// Main function
async function main() {
    try {
        // Get the requirements.txt hash
        let requirementsHash = '';
        const requirementsPath = path.join(__dirname, 'requirements.txt');
        if (fs.existsSync(requirementsPath)) {
            requirementsHash = await calculateFileHash(requirementsPath);
            console.log(`Requirements hash: ${requirementsHash}`);
        } else {
            console.warn('requirements.txt not found');
        }

        // Get the Miniforge URL and its hash
        const miniforgeUrl = getPlatformInfo();
        const latestMiniforgeUrl = await getLatestMiniforgeUrl(miniforgeUrl);
        const miniforgeUrlHash = calculateStringHash(latestMiniforgeUrl);
        console.log(`Miniforge URL hash: ${miniforgeUrlHash}`);

        // Get the setup-python-env.js hash
        const setupScriptPath = path.join(__dirname, 'setup-python-env.js');
        let setupScriptHash = '';
        if (fs.existsSync(setupScriptPath)) {
            setupScriptHash = await calculateFileHash(setupScriptPath);
            console.log(`Setup script hash: ${setupScriptHash}`);
        } else {
            console.warn('setup-python-env.js not found');
        }

        // Generate the final cache key
        const platform = os.platform();
        const arch = os.arch();
        const cacheKey = `anymatix-${platform}-${arch}-${requirementsHash.substring(0, 8)}-${miniforgeUrlHash.substring(0, 8)}-${setupScriptHash.substring(0, 8)}`;

        console.log(`Cache key: ${cacheKey}`);

        // Output the cache key for GitHub Actions
        if (process.env.GITHUB_OUTPUT) {
            fs.appendFileSync(process.env.GITHUB_OUTPUT, `cache-key=${cacheKey}\n`);
        }

        return cacheKey;
    } catch (error) {
        console.error('Error generating cache key:', error);
        process.exit(1);
    }
}

main(); 