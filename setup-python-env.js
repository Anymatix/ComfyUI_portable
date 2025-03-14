#!/usr/bin/env node

const fs = require('fs');
const path = require('path');
const https = require('https');
const { execSync, exec } = require('child_process');
const os = require('os');
const { promisify } = require('util');
const execAsync = promisify(exec);

// Parse command line arguments
const args = process.argv.slice(2);
const enableCleanup = args.some(arg =>
  arg === '--enable-cleanup=true' ||
  arg === '--enable-cleanup' ||
  arg === '-c'
);

console.log(`Cleanup ${enableCleanup ? 'enabled' : 'disabled'}`);

// Handle glob package differences between versions
const glob = require('glob');
let promisifiedGlob;

// Try different approaches to get a promisified glob function
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
  // Final fallback using fs.readdir and path filtering
  console.warn(`Warning: Error setting up glob: ${error.message}. Using fallback implementation.`);
  promisifiedGlob = async (pattern, options) => {
    // Simple pattern matching for common glob patterns
    const dir = path.dirname(pattern);
    const basename = path.basename(pattern);
    const isRecursive = pattern.includes('**');

    // Helper function to recursively list files
    const listFilesRecursively = async (directory) => {
      let results = [];
      const entries = fs.readdirSync(directory, { withFileTypes: true });

      for (const entry of entries) {
        const fullPath = path.join(directory, entry.name);

        if (entry.isDirectory() && isRecursive) {
          results = results.concat(await listFilesRecursively(fullPath));
        } else if (entry.isFile()) {
          results.push(fullPath);
        }
      }

      return results;
    };

    try {
      let files;
      if (isRecursive) {
        files = await listFilesRecursively(dir);
      } else {
        const entries = fs.readdirSync(dir, { withFileTypes: true });
        files = entries
          .filter(entry => entry.isFile())
          .map(entry => path.join(dir, entry.name));
      }

      // Simple pattern matching
      return files.filter(file => {
        const filename = path.basename(file);
        if (basename === '*') return true;
        if (basename.startsWith('*.')) {
          const ext = basename.substring(1);
          return filename.endsWith(ext);
        }
        return filename === basename;
      });
    } catch (err) {
      console.error(`Error in fallback glob implementation: ${err.message}`);
      return [];
    }
  };
}

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

// Cross-platform recursive directory deletion
function deleteFolderRecursive(folderPath) {
  if (fs.existsSync(folderPath)) {
    fs.readdirSync(folderPath).forEach((file) => {
      const curPath = path.join(folderPath, file);
      if (fs.lstatSync(curPath).isDirectory()) {
        // Recursive call
        deleteFolderRecursive(curPath);
      } else {
        // Delete file
        fs.unlinkSync(curPath);
      }
    });
    fs.rmdirSync(folderPath);
  }
}

// Function to ensure PIL can find its dynamic libraries
async function setupPILDynamicLibraries() {
  console.log('Setting up PIL dynamic libraries...');

  // Find the PIL directory
  const sitePackagesDir = path.join(MINIFORGE_DIR, 'lib', 'python*', 'site-packages');
  const sitePackagesDirs = await promisifiedGlob(sitePackagesDir);

  for (const dir of sitePackagesDirs) {
    const pilDir = path.join(dir, 'PIL');
    if (fs.existsSync(pilDir)) {
      // Create .dylibs directory if it doesn't exist
      const dylibsDir = path.join(pilDir, '.dylibs');
      if (!fs.existsSync(dylibsDir)) {
        fs.mkdirSync(dylibsDir, { recursive: true });
      }

      // Copy necessary dynamic libraries to PIL/.dylibs
      const libDir = path.join(MINIFORGE_DIR, 'lib');
      if (fs.existsSync(libDir)) {
        // Platform-specific handling
        if (os.platform() === 'darwin') {
          // On macOS, copy all dylibs as they're typically smaller
          // Enhanced to search in subdirectories as well
          const dylibPatterns = ['*.dylib', '**/*.dylib'];

          // Also specifically look for libtiff.6.dylib which is causing the error
          console.log('Specifically looking for libtiff.6.dylib...');
          const tiffLibs = await promisifiedGlob(path.join(libDir, '**', 'libtiff*.dylib'));
          if (tiffLibs.length > 0) {
            console.log(`Found ${tiffLibs.length} libtiff libraries: ${tiffLibs.join(', ')}`);
          } else {
            console.warn('Warning: libtiff.6.dylib not found in library directory!');
          }

          for (const pattern of dylibPatterns) {
            const libFiles = await promisifiedGlob(path.join(libDir, pattern));
            console.log(`Found ${libFiles.length} libraries with pattern ${pattern}`);
            for (const libFile of libFiles) {
              const destFile = path.join(dylibsDir, path.basename(libFile));
              console.log(`Copying ${libFile} to ${destFile}`);
              fs.copyFileSync(libFile, destFile);
            }
          }
        } else if (os.platform() === 'linux') {
          // On Linux, only copy essential libraries to avoid massive size
          // List of essential libraries for PIL on Linux
          const essentialLibs = [
            'libz.so*',
            'libjpeg.so*',
            'libpng.so*',
            'libtiff.so*',
            'libfreetype.so*',
            'liblcms2.so*',
            'libwebp.so*',
            'libopenjp2.so*'
          ];

          for (const pattern of essentialLibs) {
            const libFiles = await promisifiedGlob(path.join(libDir, pattern));
            for (const libFile of libFiles) {
              const destFile = path.join(dylibsDir, path.basename(libFile));
              console.log(`Copying essential library: ${libFile} to ${destFile}`);
              fs.copyFileSync(libFile, destFile);
            }
          }
        } else if (os.platform() === 'win32') {
          // On Windows, copy all DLLs
          const dllPatterns = ['*.dll'];
          for (const pattern of dllPatterns) {
            const libFiles = await promisifiedGlob(path.join(libDir, pattern));
            for (const libFile of libFiles) {
              const destFile = path.join(dylibsDir, path.basename(libFile));
              console.log(`Copying ${libFile} to ${destFile}`);
              fs.copyFileSync(libFile, destFile);
            }
          }
        }
      }
    }
  }
}

// Cross-platform cleanup function
async function cleanupEnvironment() {
  console.log('Starting minimal cleanup to preserve full functionality...');

  if (!fs.existsSync(MINIFORGE_DIR)) {
    console.warn(`Warning: ${MINIFORGE_DIR} directory not found. Looking for other directories:`);
    if (fs.existsSync(ANYMATIX_DIR)) {
      fs.readdirSync(ANYMATIX_DIR).forEach(file => {
        const filePath = path.join(ANYMATIX_DIR, file);
        if (fs.statSync(filePath).isDirectory()) {
          console.log(`- ${file}`);
        }
      });
    }
    return;
  }

  try {
    // Define patterns to find directories to remove - be very selective
    const directoryPatterns = [
      path.join(MINIFORGE_DIR, '**', '__pycache__'),
      path.join(MINIFORGE_DIR, '**', 'man'),
      path.join(MINIFORGE_DIR, '**', 'doc'),
      path.join(MINIFORGE_DIR, '**', 'docs'),
      path.join(MINIFORGE_DIR, '**', 'examples'),
      path.join(ANYMATIX_DIR, '**', '.git')
    ];

    // Explicitly ensure numpy tests are preserved
    console.log('Ensuring NumPy and SciPy test directories are preserved...');
    const numpyPath = path.join(MINIFORGE_DIR, 'lib', 'python3.12', 'site-packages', 'numpy');
    const scipyPath = path.join(MINIFORGE_DIR, 'lib', 'python3.12', 'site-packages', 'scipy');

    // Find and remove directories
    for (const pattern of directoryPatterns) {
      const matches = await promisifiedGlob(pattern, { nodir: false });
      for (const match of matches) {
        // Skip any NumPy or SciPy directories
        if (match.includes('numpy') || match.includes('scipy') || match.includes('test') || match.includes('tests')) {
          console.log(`Preserving directory: ${match}`);
          continue;
        }

        if (fs.existsSync(match) && fs.statSync(match).isDirectory()) {
          console.log(`Removing directory: ${match}`);
          deleteFolderRecursive(match);
        }
      }
    }

    // Preserve all package metadata
    console.log('Preserving all package metadata...');

    // Remove conda package cache
    const pkgsDir = path.join(MINIFORGE_DIR, 'pkgs');
    if (fs.existsSync(pkgsDir)) {
      console.log(`Removing conda package cache: ${pkgsDir}`);
      deleteFolderRecursive(pkgsDir);
    }

    const envsDir = path.join(MINIFORGE_DIR, 'envs');
    if (fs.existsSync(envsDir)) {
      console.log(`Removing conda environments: ${envsDir}`);
      deleteFolderRecursive(envsDir);
    }

    // DO NOT remove any dynamic libraries or shared objects
    console.log('Preserving all dynamic libraries...');

    // Remove only static libraries
    const fileExtensions = ['.a'];
    for (const ext of fileExtensions) {
      const matches = await promisifiedGlob(path.join(MINIFORGE_DIR, '**', `*${ext}`));
      for (const match of matches) {
        if (fs.existsSync(match) && fs.statSync(match).isFile()) {
          console.log(`Removing file: ${match}`);
          fs.unlinkSync(match);
        }
      }
    }

    // Report size after cleanup
    console.log('Size after cleanup:');
    let size;
    if (os.platform() === 'win32') {
      const { stdout } = await execAsync('powershell -Command "Get-ChildItem -Path anymatix -Recurse | Measure-Object -Property Length -Sum | Select-Object -ExpandProperty Sum"');
      size = parseInt(stdout.trim());
      console.log(`${Math.round(size / (1024 * 1024))} MB`);
    } else {
      const { stdout } = await execAsync(`du -sh ${ANYMATIX_DIR}`);
      console.log(stdout.trim());
    }

  } catch (error) {
    console.error(`Error during cleanup: ${error.message}`);
  }
}

// Helper function to create platform-specific package installation scripts
function createPackageInstallationScripts() {
  console.log('Creating package installation helper scripts...');

  if (os.platform() === 'win32') {
    // Create Windows batch file
    const batchContent = `@echo off
echo Installing package(s): %*
.\\anymatix\\miniforge\\Scripts\\pip.exe install %*
`;
    fs.writeFileSync(path.join(__dirname, 'install_package.bat'), batchContent);
    console.log('Created install_package.bat');
  } else {
    // Create Unix shell script
    const shContent = `#!/bin/bash
echo "Installing package(s): $@"
./anymatix/miniforge/bin/pip install "$@"
`;
    fs.writeFileSync(path.join(__dirname, 'install_package.sh'), shContent);
    execSync(`chmod +x ${path.join(__dirname, 'install_package.sh')}`);
    console.log('Created install_package.sh');
  }
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

    // Install with metadata to ensure proper package information
    execSync(`"${pipPath}" install --no-cache-dir -r "${REQUIREMENTS_FILE}"`, { stdio: 'inherit' });

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

    // Always set up PIL dynamic libraries, regardless of cleanup setting
    await setupPILDynamicLibraries();

    // Run the cleanup process only if enabled
    if (enableCleanup) {
      console.log('Running cleanup process...');
      await cleanupEnvironment();
    } else {
      console.log('Skipping cleanup process (disabled by default to preserve full functionality)');
    }

    // Create helper scripts for package installation
    createPackageInstallationScripts();

    // Copy platform-specific helper scripts to anymatix directory
    console.log('Copying platform-specific helper scripts...');
    if (os.platform() === 'win32') {
      fs.copyFileSync(path.join(__dirname, 'run_comfyui_windows.bat'), path.join(ANYMATIX_DIR, 'run_comfyui.bat'));
      console.log('Copied run_comfyui_windows.bat to anymatix/run_comfyui.bat');
    } else if (os.platform() === 'darwin') {
      fs.copyFileSync(path.join(__dirname, 'run_comfyui_macos.sh'), path.join(ANYMATIX_DIR, 'run_comfyui.sh'));
      execSync(`chmod +x ${path.join(ANYMATIX_DIR, 'run_comfyui.sh')}`);
      console.log('Copied run_comfyui_macos.sh to anymatix/run_comfyui.sh and made it executable');
    } else if (os.platform() === 'linux') {
      fs.copyFileSync(path.join(__dirname, 'run_comfyui_linux.sh'), path.join(ANYMATIX_DIR, 'run_comfyui.sh'));
      execSync(`chmod +x ${path.join(ANYMATIX_DIR, 'run_comfyui.sh')}`);
      console.log('Copied run_comfyui_linux.sh to anymatix/run_comfyui.sh and made it executable');
    }

    console.log('\nSetup completed successfully!');
    console.log(`Python with required packages installed at: ${MINIFORGE_DIR}`);
    console.log(`Version: ${version}`);
    console.log('\nTo install additional packages, use:');
    if (os.platform() === 'win32') {
      console.log('  install_package.bat package_name');
    } else {
      console.log('  ./install_package.sh package_name');
    }

  } catch (error) {
    console.error('Error:', error.message);
    process.exit(1);
  }
}

main(); 