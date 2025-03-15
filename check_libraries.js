#!/usr/bin/env node

const fs = require('fs');
const path = require('path');
const { execSync } = require('child_process');
const os = require('os');
const glob = require('glob');
const { promisify } = require('util');

// Try different approaches to get a promisified glob function
let promisifiedGlob;
try {
    // For glob v8+
    if (typeof glob.glob === 'function') {
        promisifiedGlob = promisify(glob.glob);
    }
    // For glob v7 and below
    else if (typeof glob === 'function') {
        promisifiedGlob = promisify(glob);
    }
    // Fallback implementation if promisification fails
    else {
        promisifiedGlob = (pattern, options) => {
            return new Promise((resolve, reject) => {
                glob(pattern, options, (err, files) => {
                    if (err) {
                        reject(err);
                    } else {
                        resolve(files);
                    }
                });
            });
        };
    }
} catch (error) {
    console.error(`Error setting up glob: ${error.message}`);
    process.exit(1);
}

// Configuration
const ANYMATIX_DIR = path.join(__dirname, 'anymatix');
const MINIFORGE_DIR = path.join(ANYMATIX_DIR, 'miniforge');

async function checkLibraries() {
    console.log('Checking for required libraries...');
    console.log(`Platform: ${os.platform()}`);
    console.log(`Architecture: ${os.arch()}`);
    console.log(`Node version: ${process.version}`);
    console.log(`Working directory: ${__dirname}`);
    console.log(`ANYMATIX_DIR: ${ANYMATIX_DIR}`);
    console.log(`MINIFORGE_DIR: ${MINIFORGE_DIR}`);

    // Check if directories exist
    console.log(`\nChecking if directories exist:`);
    console.log(`ANYMATIX_DIR exists: ${fs.existsSync(ANYMATIX_DIR)}`);
    console.log(`MINIFORGE_DIR exists: ${fs.existsSync(MINIFORGE_DIR)}`);

    if (!fs.existsSync(MINIFORGE_DIR)) {
        console.error('Error: MINIFORGE_DIR does not exist!');
        return;
    }

    // Find all .dylib files on macOS
    if (os.platform() === 'darwin') {
        console.log('\nSearching for all .dylib files in MINIFORGE_DIR:');
        const dylibFiles = await promisifiedGlob(path.join(MINIFORGE_DIR, '**', '*.dylib'));
        console.log(`Found ${dylibFiles.length} .dylib files.`);

        // Specifically look for libtiff.6.dylib
        console.log('\nSpecifically looking for libtiff.6.dylib:');
        const tiffLibs = dylibFiles.filter(file => path.basename(file).includes('libtiff.6.dylib'));
        if (tiffLibs.length > 0) {
            console.log('Found libtiff.6.dylib at:');
            tiffLibs.forEach(file => console.log(`  ${file}`));
        } else {
            console.log('libtiff.6.dylib not found!');

            // Look for any libtiff files
            console.log('\nLooking for any libtiff files:');
            const anyTiffLibs = dylibFiles.filter(file => path.basename(file).includes('libtiff'));
            if (anyTiffLibs.length > 0) {
                console.log('Found libtiff files at:');
                anyTiffLibs.forEach(file => console.log(`  ${file}`));
            } else {
                console.log('No libtiff files found!');
            }
        }

        // Check PIL directory
        console.log('\nChecking PIL directory:');
        const sitePackagesDirs = await promisifiedGlob(path.join(MINIFORGE_DIR, 'lib', 'python*', 'site-packages'));
        for (const dir of sitePackagesDirs) {
            const pilDir = path.join(dir, 'PIL');
            console.log(`PIL directory exists: ${fs.existsSync(pilDir)}`);

            if (fs.existsSync(pilDir)) {
                const dylibsDir = path.join(pilDir, '.dylibs');
                console.log(`PIL/.dylibs directory exists: ${fs.existsSync(dylibsDir)}`);

                if (fs.existsSync(dylibsDir)) {
                    const pilDylibFiles = await promisifiedGlob(path.join(dylibsDir, '*.dylib'));
                    console.log(`Found ${pilDylibFiles.length} .dylib files in PIL/.dylibs:`);
                    pilDylibFiles.forEach(file => console.log(`  ${path.basename(file)}`));

                    // Check for libtiff.6.dylib in PIL/.dylibs
                    const pilTiffLib = pilDylibFiles.find(file => path.basename(file).includes('libtiff.6.dylib'));
                    console.log(`libtiff.6.dylib exists in PIL/.dylibs: ${!!pilTiffLib}`);
                }
            }
        }
    }

    // Find all .so files on Linux
    if (os.platform() === 'linux') {
        console.log('\nSearching for all .so files in MINIFORGE_DIR:');
        const soFiles = await promisifiedGlob(path.join(MINIFORGE_DIR, '**', '*.so*'));
        console.log(`Found ${soFiles.length} .so files.`);

        // Specifically look for libtiff.so
        console.log('\nSpecifically looking for libtiff.so:');
        const tiffLibs = soFiles.filter(file => path.basename(file).includes('libtiff.so'));
        if (tiffLibs.length > 0) {
            console.log('Found libtiff.so at:');
            tiffLibs.forEach(file => console.log(`  ${file}`));
        } else {
            console.log('libtiff.so not found!');
        }
    }

    // Find all .dll files on Windows
    if (os.platform() === 'win32') {
        console.log('\nSearching for all .dll files in MINIFORGE_DIR:');
        const dllFiles = await promisifiedGlob(path.join(MINIFORGE_DIR, '**', '*.dll'));
        console.log(`Found ${dllFiles.length} .dll files.`);

        // Specifically look for tiff dll
        console.log('\nSpecifically looking for tiff dll:');
        const tiffLibs = dllFiles.filter(file => path.basename(file).toLowerCase().includes('tiff'));
        if (tiffLibs.length > 0) {
            console.log('Found tiff dll at:');
            tiffLibs.forEach(file => console.log(`  ${file}`));
        } else {
            console.log('tiff dll not found!');
        }
    }

    // Check run_comfyui script
    console.log('\nChecking run_comfyui script:');
    if (os.platform() === 'win32') {
        const scriptPath = path.join(ANYMATIX_DIR, 'run_comfyui.bat');
        console.log(`run_comfyui.bat exists: ${fs.existsSync(scriptPath)}`);
        if (fs.existsSync(scriptPath)) {
            console.log('Content of run_comfyui.bat:');
            console.log(fs.readFileSync(scriptPath, 'utf8'));
        }
    } else {
        const scriptPath = path.join(ANYMATIX_DIR, 'run_comfyui.sh');
        console.log(`run_comfyui.sh exists: ${fs.existsSync(scriptPath)}`);
        if (fs.existsSync(scriptPath)) {
            console.log('Content of run_comfyui.sh:');
            console.log(fs.readFileSync(scriptPath, 'utf8'));
        }
    }
}

checkLibraries().catch(error => {
    console.error('Error:', error);
    process.exit(1);
}); 