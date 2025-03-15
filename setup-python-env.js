#!/usr/bin/env node

const fs = require('fs');
const path = require('path');
const https = require('https');
const { execSync } = require('child_process');
const os = require('os');

// Read version from version.yml if it exists
let version = '1.0.0';
try {
  if (fs.existsSync(path.join(__dirname, 'version.yml'))) {
    try {
      // Try to load js-yaml
      const yaml = require('js-yaml');
      const versionData = yaml.load(fs.readFileSync(path.join(__dirname, 'version.yml'), 'utf8'));
      version = versionData.version || version;
    } catch (yamlError) {
      // Fallback to simple parsing if js-yaml is not available
      const versionFileContent = fs.readFileSync(path.join(__dirname, 'version.yml'), 'utf8');
      const versionMatch = versionFileContent.match(/version:\s*['"]?([^'"]+)['"]?/);
      if (versionMatch && versionMatch[1]) {
        version = versionMatch[1];
      }
    }
    console.log(`Using version: ${version} from version.yml`);
  }
} catch (error) {
  console.warn(`Warning: Could not read version from version.yml: ${error.message}`);
}

// Configuration
const MINIFORGE_DIR = path.join(__dirname, 'anymatix', 'miniforge');
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

  // Use the recommended approach for downloading the latest Miniforge in a CI pipeline
  // Following instructions from https://github.com/conda-forge/miniforge
  if (platform === 'darwin') {
    // macOS - use the latest version dynamically
    return {
      url: `https://github.com/conda-forge/miniforge/releases/latest/download/Miniforge3-MacOSX-${arch === 'arm64' ? 'arm64' : 'x86_64'}.sh`,
      installer: 'miniforge.sh'
    };
  } else if (platform === 'linux') {
    // Linux - use the latest version dynamically
    const linuxArch = arch === 'arm64' || arch === 'aarch64' ? 'aarch64' : 'x86_64';
    return {
      url: `https://github.com/conda-forge/miniforge/releases/latest/download/Miniforge3-Linux-${linuxArch}.sh`,
      installer: 'miniforge.sh'
    };
  } else if (platform === 'win32') {
    // Windows - use the latest version dynamically
    if (arch === 'x64') {
      return {
        url: 'https://github.com/conda-forge/miniforge/releases/latest/download/Miniforge3-Windows-x86_64.exe',
        installer: 'miniforge.exe'
      };
    } else {
      throw new Error(`Unsupported architecture for Windows: ${arch}. Only x64 is supported.`);
    }
  }

  throw new Error(`Unsupported platform: ${platform} ${arch}`);
}

// Download file
function downloadFile(url, destination) {
  return new Promise((resolve, reject) => {
    console.log(`Downloading ${url}...`);

    let fileStream = null;

    // Function to handle HTTP requests with redirect support
    const makeRequest = (url) => {
      // Close any existing file stream before creating a new one
      if (fileStream) {
        fileStream.close();
      }

      const protocol = url.startsWith('https') ? https : require('http');

      const options = new URL(url);

      // Add user agent to avoid GitHub API rate limiting
      const requestOptions = {
        hostname: options.hostname,
        path: options.pathname + options.search,
        headers: {
          'User-Agent': 'Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/91.0.4472.114 Safari/537.36'
        }
      };

      protocol.get(requestOptions, (response) => {
        // Handle redirects
        if (response.statusCode === 301 || response.statusCode === 302 || response.statusCode === 307) {
          const redirectUrl = response.headers.location;
          console.log(`Following redirect to: ${redirectUrl}`);
          makeRequest(redirectUrl);
          return;
        }

        if (response.statusCode !== 200) {
          reject(new Error(`Failed to download: ${response.statusCode} ${response.statusMessage}`));
          return;
        }

        // Create a new file stream for the final destination
        fileStream = fs.createWriteStream(destination);

        response.pipe(fileStream);

        fileStream.on('finish', () => {
          fileStream.close(() => {
            // Verify the file was downloaded correctly
            const stats = fs.statSync(destination);
            if (stats.size === 0) {
              reject(new Error(`Downloaded file is empty: ${destination}`));
              return;
            }

            console.log(`Download completed: ${destination} (${stats.size} bytes)`);
            resolve();
          });
        });

        fileStream.on('error', (err) => {
          fs.unlink(destination, () => { }); // Delete the file on error
          reject(err);
        });
      }).on('error', (err) => {
        if (fileStream) {
          fileStream.close();
        }
        fs.unlink(destination, () => { }); // Delete the file on error
        reject(err);
      });
    };

    // Start the request
    makeRequest(url);
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

    // Download Miniforge installer
    await downloadFile(url, installerPath);

    // Make installer executable (Unix only)
    if (os.platform() !== 'win32') {
      execSync(`chmod +x ${installerPath}`);
    }

    // Install Miniforge
    console.log('Installing Miniforge...');
    if (os.platform() === 'win32') {
      execSync(`start /wait "" ${installerPath} /InstallationType=JustMe /RegisterPython=0 /AddToPath=0 /NoRegistry=1 /U /S /D=${MINIFORGE_DIR}`);
    } else {
      execSync(`bash ${installerPath} -u -b -p ${MINIFORGE_DIR}`);
    }

    // Create a minimal environment configuration
    const condaPath = os.platform() === 'win32'
      ? path.join(MINIFORGE_DIR, 'Scripts', 'conda.exe')
      : path.join(MINIFORGE_DIR, 'bin', 'conda');

    // Clean conda installation to save space
    console.log('Optimizing conda installation...');
    execSync(`"${condaPath}" clean -a -y`, { stdio: 'inherit' });

    // Install requirements directly with minimal dependencies
    console.log('Installing requirements...');
    const pipPath = os.platform() === 'win32'
      ? path.join(MINIFORGE_DIR, 'Scripts', 'pip.exe')
      : path.join(MINIFORGE_DIR, 'bin', 'pip');

    execSync(`"${pipPath}" install --no-cache-dir --no-deps -r "${REQUIREMENTS_FILE}"`, { stdio: 'inherit' });

    // Install only essential dependencies
    execSync(`"${pipPath}" install --no-cache-dir --only-binary=:all: -r "${REQUIREMENTS_FILE}"`, { stdio: 'inherit' });

    // Clean up installer
    fs.unlinkSync(installerPath);

    // Clone comfy_repo with minimal depth to save space
    console.log('Cloning ComfyUI repository...');
    execSync(`git clone --depth=1 -b ${comfy_repo.branch} ${comfy_repo.url} ${path.join(ANYMATIX_DIR, 'ComfyUI')}`);

    // Clone additional repos into custom_nodes with minimal depth
    const customNodesPath = path.join(ANYMATIX_DIR, 'ComfyUI', 'custom_nodes');
    if (!fs.existsSync(customNodesPath)) {
      fs.mkdirSync(customNodesPath, { recursive: true });
    }

    for (const repo of repos) {
      const repoName = repo.url.split('/').pop().replace('.git', '');
      console.log(`Cloning ${repoName}...`);
      execSync(`git clone --depth=1 ${repo.url} ${path.join(customNodesPath, repoName)}`);
    }

    console.log('\nSetup completed successfully!');
    console.log(`Python with required packages installed at: ${MINIFORGE_DIR}`);
    console.log(`Version: ${version}`);

  } catch (error) {
    console.error('Error:', error.message);
    process.exit(1);
  }
}

main(); 