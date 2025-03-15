#!/usr/bin/env node

const fs = require('fs');
const path = require('path');
const { spawn, execSync } = require('child_process');
const os = require('os');

// Configuration
const ANYMATIX_DIR = path.join(__dirname, 'anymatix');

// Function to copy the launcher script to the anymatix directory
function copyLauncherScript() {
    console.log('Copying launcher script to anymatix directory...');

    let sourceScript, destScript;

    if (os.platform() === 'win32') {
        sourceScript = path.join(__dirname, 'run_comfyui_windows.bat');
        destScript = path.join(ANYMATIX_DIR, 'run_comfyui.bat');
    } else if (os.platform() === 'darwin') {
        sourceScript = path.join(__dirname, 'run_comfyui_macos.sh');
        destScript = path.join(ANYMATIX_DIR, 'run_comfyui.sh');
    } else {
        sourceScript = path.join(__dirname, 'run_comfyui_linux.sh');
        destScript = path.join(ANYMATIX_DIR, 'run_comfyui.sh');
    }

    if (!fs.existsSync(sourceScript)) {
        console.error(`Error: Source launcher script not found at ${sourceScript}`);
        return false;
    }

    try {
        fs.copyFileSync(sourceScript, destScript);

        // Make the script executable on Unix-like systems
        if (os.platform() !== 'win32') {
            execSync(`chmod +x ${destScript}`);
        }

        console.log(`Successfully copied ${sourceScript} to ${destScript}`);
        return true;
    } catch (error) {
        console.error(`Error copying launcher script: ${error.message}`);
        return false;
    }
}

// Function to test the ComfyUI launcher
async function testComfyUILauncher() {
    console.log('Testing ComfyUI launcher...');

    // Determine the platform-specific launcher script
    let launcherScript;
    if (os.platform() === 'win32') {
        launcherScript = path.join(ANYMATIX_DIR, 'run_comfyui.bat');
    } else {
        launcherScript = path.join(ANYMATIX_DIR, 'run_comfyui.sh');
    }

    // Check if the launcher script exists
    if (!fs.existsSync(launcherScript)) {
        console.error(`Error: Launcher script not found at ${launcherScript}`);
        return false;
    }

    console.log(`Found launcher script at ${launcherScript}`);

    // Execute the launcher script
    return new Promise((resolve) => {
        console.log(`Executing: ${launcherScript}`);

        // Set up the process
        const process = os.platform() === 'win32'
            ? spawn('cmd.exe', ['/c', launcherScript])
            : spawn('bash', [launcherScript]);

        // Set a timeout to kill the process after finding the IP or after 60 seconds
        const timeout = setTimeout(() => {
            console.log('Timeout reached. Killing ComfyUI process...');
            process.kill();
            resolve(false);
        }, 60000);

        // Track if we found the IP address
        let foundIP = false;

        // Process stdout data
        process.stdout.on('data', (data) => {
            const output = data.toString();
            console.log(`ComfyUI output: ${output}`);

            // Look for IP address pattern or GUI message in the output
            if (output.match(/http:\/\/\d+\.\d+\.\d+\.\d+:\d+/) ||
                output.match(/Running on local URL:\s+http:\/\/127\.0\.0\.1:\d+/) ||
                output.includes("To see the GUI go to:")) {
                console.log('Found server URL in output. ComfyUI started successfully!');
                foundIP = true;
                clearTimeout(timeout);
                process.kill();
                resolve(true);
            }
        });

        // Process stderr data
        process.stderr.on('data', (data) => {
            const output = data.toString();
            console.error(`ComfyUI error: ${output}`);

            // Also check stderr for the GUI message
            if (output.includes("To see the GUI go to:")) {
                console.log('Found server URL in stderr. ComfyUI started successfully!');
                foundIP = true;
                clearTimeout(timeout);
                process.kill();
                resolve(true);
            }
        });

        // Handle process exit
        process.on('close', (code) => {
            if (!foundIP) {
                console.log(`ComfyUI process exited with code ${code}`);
                clearTimeout(timeout);
                resolve(false);
            }
        });
    });
}

// Main function
async function main() {
    try {
        // First, copy the launcher script
        const copySuccess = copyLauncherScript();
        if (!copySuccess) {
            console.error('Failed to copy launcher script. Aborting test.');
            return;
        }

        // Then test the launcher
        const success = await testComfyUILauncher();
        if (success) {
            console.log('Launcher test completed successfully!');
        } else {
            console.error('Launcher test failed!');
        }
    } catch (error) {
        console.error('Error during launcher test:', error.message);
    }
}

main(); 