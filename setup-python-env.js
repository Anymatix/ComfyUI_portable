#!/usr/bin/env node

const fs = require('fs');
const path = require('path');
const https = require('https');
const { execSync } = require('child_process');
const os = require('os');

// Configuration
const MINICONDA_DIR = path.join(__dirname, 'anymatix', 'miniconda');
const ANYMATIX_DIR = path.join(__dirname, 'anymatix');
const REQUIREMENTS_FILE = path.join(__dirname, 'requirements.txt');

comfy_repo = {
  "url": "https://github.com/comfyanonymous/ComfyUI.git",
  "branch": "master",
}

repos = [
  { "url": "https://github.com/Anymatix/anymatix-comfy-nodes.git" },
  { "url": "https://github.com/alessandrozonta/ComfyUI-CLIPSeg.git" },
  { "url": "https://github.com/Kosinkadink/ComfyUI-VideoHelperSuite.git" }
]


// Determine OS and architecture
function getPlatformInfo() {
  const platform = os.platform();
  const arch = os.arch();

  if (platform === 'darwin') {
    // macOS
    if (arch === 'arm64') {
      return { url: 'https://repo.anaconda.com/miniconda/Miniconda3-latest-MacOSX-arm64.sh', installer: 'miniconda.sh' };
    } else {
      return { url: 'https://repo.anaconda.com/miniconda/Miniconda3-latest-MacOSX-x86_64.sh', installer: 'miniconda.sh' };
    }
  } else if (platform === 'linux') {
    // Linux
    if (arch === 'arm64' || arch === 'aarch64') {
      return { url: 'https://repo.anaconda.com/miniconda/Miniconda3-latest-Linux-aarch64.sh', installer: 'miniconda.sh' };
    } else {
      return { url: 'https://repo.anaconda.com/miniconda/Miniconda3-latest-Linux-x86_64.sh', installer: 'miniconda.sh' };
    }
  } else if (platform === 'win32') {
    // Windows
    if (arch === 'x64') {
      return { url: 'https://repo.anaconda.com/miniconda/Miniconda3-latest-Windows-x86_64.exe', installer: 'miniconda.exe' };
    } else {
      return { url: 'https://repo.anaconda.com/miniconda/Miniconda3-latest-Windows-x86.exe', installer: 'miniconda.exe' };
    }
  }

  throw new Error(`Unsupported platform: ${platform} ${arch}`);
}

// Download file
function downloadFile(url, destination) {
  return new Promise((resolve, reject) => {
    console.log(`Downloading ${url}...`);

    const file = fs.createWriteStream(destination);
    https.get(url, (response) => {
      if (response.statusCode !== 200) {
        reject(new Error(`Failed to download: ${response.statusCode} ${response.statusMessage}`));
        return;
      }

      response.pipe(file);

      file.on('finish', () => {
        file.close();
        console.log(`Download completed: ${destination}`);
        resolve();
      });
    }).on('error', (err) => {
      fs.unlink(destination, () => { }); // Delete the file on error
      reject(err);
    });
  });
}

// Main function
async function main() {
  try {
    // Create anymatix directory if it doesn't exist
    if (!fs.existsSync(ANYMATIX_DIR)) {
      fs.mkdirSync(ANYMATIX_DIR, { recursive: true });
    }

    // Create directories if they don't exist
    if (!fs.existsSync(__dirname)) {
      fs.mkdirSync(__dirname, { recursive: true });
    }

    // Get platform-specific info
    const { url, installer } = getPlatformInfo();
    const installerPath = path.join(__dirname, installer);

    // Download Miniconda installer
    await downloadFile(url, installerPath);

    // Make installer executable (Unix only)
    if (os.platform() !== 'win32') {
      execSync(`chmod +x ${installerPath}`);
    }

    // Install Miniconda
    console.log('Installing Miniconda...');
    if (os.platform() === 'win32') {
      execSync(`start /wait "" ${installerPath} /InstallationType=JustMe /RegisterPython=0 /U /S /D=${MINICONDA_DIR}`);
    } else {
      execSync(`bash ${installerPath} -u -b -p ${MINICONDA_DIR}`);
    }

    // Install requirements directly into Miniconda's base environment
    console.log('Installing requirements...');
    const pipPath = os.platform() === 'win32'
      ? path.join(MINICONDA_DIR, 'Scripts', 'pip.exe')
      : path.join(MINICONDA_DIR, 'bin', 'pip');

    execSync(`"${pipPath}" install -r "${REQUIREMENTS_FILE}"`, { stdio: 'inherit' });

    // Clean up installer
    fs.unlinkSync(installerPath);

    // Clone comfy_repo
    console.log('Cloning ComfyUI repository...');
    execSync(`git clone -b ${comfy_repo.branch} ${comfy_repo.url} ${path.join(ANYMATIX_DIR, 'ComfyUI')}`);

    // Clone additional repos into custom_nodes
    const customNodesPath = path.join(ANYMATIX_DIR, 'ComfyUI', 'custom_nodes');
    if (!fs.existsSync(customNodesPath)) {
      fs.mkdirSync(customNodesPath, { recursive: true });
    }

    for (const repo of repos) {
      const repoName = repo.url.split('/').pop().replace('.git', '');
      console.log(`Cloning ${repoName}...`);
      execSync(`git clone ${repo.url} ${path.join(customNodesPath, repoName)}`);
    }

    console.log('\nSetup completed successfully!');
    console.log(`Python with required packages installed at: ${MINICONDA_DIR}`);

  } catch (error) {
    console.error('Error:', error.message);
    process.exit(1);
  }
}

main(); 