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

            // Ensure libtiff.6.dylib is copied to PIL/.dylibs
            for (const tiffLib of tiffLibs) {
              const destFile = path.join(dylibsDir, path.basename(tiffLib));
              console.log(`Copying ${tiffLib} to ${destFile}`);
              fs.copyFileSync(tiffLib, destFile);
            }
          } else {
            console.warn('Warning: libtiff.6.dylib not found in library directory!');

            // Try to find libtiff in other locations
            console.log('Searching for libtiff in other locations...');

            // Check if libtiff is available in the system
            try {
              const { stdout } = await execAsync('find /usr/local/lib /usr/lib -name "libtiff*.dylib" 2>/dev/null || true');
              const systemTiffLibs = stdout.trim().split('\n').filter(Boolean);

              if (systemTiffLibs.length > 0) {
                console.log(`Found system libtiff libraries: ${systemTiffLibs.join(', ')}`);

                // Copy system libtiff libraries to PIL/.dylibs
                for (const tiffLib of systemTiffLibs) {
                  const destFile = path.join(dylibsDir, path.basename(tiffLib));
                  console.log(`Copying system ${tiffLib} to ${destFile}`);
                  fs.copyFileSync(tiffLib, destFile);
                }
              } else {
                console.warn('Warning: No system libtiff libraries found!');
              }
            } catch (error) {
              console.warn(`Warning: Error searching for system libtiff libraries: ${error.message}`);
            }
          }

          // Copy all dylibs to ensure all dependencies are available
          for (const pattern of dylibPatterns) {
            const libFiles = await promisifiedGlob(path.join(libDir, pattern));
            console.log(`Found ${libFiles.length} libraries with pattern ${pattern}`);
            for (const libFile of libFiles) {
              const destFile = path.join(dylibsDir, path.basename(libFile));
              console.log(`Copying ${libFile} to ${destFile}`);
              fs.copyFileSync(libFile, destFile);
            }
          }

          // Create symbolic links for common library names if they don't exist
          // This helps with library versioning issues
          const commonLibs = [
            { from: 'libtiff.6.dylib', to: 'libtiff.dylib' },
            { from: 'libjpeg.62.4.0.dylib', to: 'libjpeg.dylib' },
            { from: 'libpng16.16.dylib', to: 'libpng.dylib' },
            { from: 'libwebp.7.dylib', to: 'libwebp.dylib' }
          ];

          for (const lib of commonLibs) {
            const fromPath = path.join(dylibsDir, lib.from);
            const toPath = path.join(dylibsDir, lib.to);

            if (fs.existsSync(fromPath) && !fs.existsSync(toPath)) {
              try {
                fs.symlinkSync(lib.from, toPath);
                console.log(`Created symbolic link from ${lib.from} to ${lib.to}`);
              } catch (error) {
                console.warn(`Warning: Could not create symbolic link: ${error.message}`);
                // If symlink fails, try to copy the file instead
                try {
                  fs.copyFileSync(fromPath, toPath);
                  console.log(`Copied ${lib.from} to ${lib.to} (symlink failed)`);
                } catch (copyError) {
                  console.warn(`Warning: Could not copy file: ${copyError.message}`);
                }
              }
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
  console.log('Starting aggressive cleanup to reduce size while maintaining functionality...');

  if (!fs.existsSync(MINIFORGE_DIR)) {
    console.warn(`Warning: ${MINIFORGE_DIR} directory not found. Skipping cleanup.`);
    return;
  }

  try {
    // Report size before cleanup
    console.log('Size before cleanup:');
    if (os.platform() === 'win32') {
      const { stdout } = await execAsync('powershell -Command "Get-ChildItem -Path anymatix -Recurse | Measure-Object -Property Length -Sum | Select-Object -ExpandProperty Sum"');
      const size = parseInt(stdout.trim());
      console.log(`${Math.round(size / (1024 * 1024))} MB`);
    } else {
      const { stdout } = await execAsync(`du -sh ${ANYMATIX_DIR}`);
      console.log(stdout.trim());
    }

    // Step 1: Remove conda package cache - this is safe and saves a lot of space
    const pkgsDir = path.join(MINIFORGE_DIR, 'pkgs');
    if (fs.existsSync(pkgsDir)) {
      console.log(`Removing conda package cache: ${pkgsDir}`);
      deleteFolderRecursive(pkgsDir);
    }

    // Step 2: Remove conda environments (except base)
    const envsDir = path.join(MINIFORGE_DIR, 'envs');
    if (fs.existsSync(envsDir)) {
      console.log(`Removing conda environments: ${envsDir}`);
      deleteFolderRecursive(envsDir);
    }

    // Step 3: Remove all __pycache__ directories
    console.log('Removing __pycache__ directories...');
    const pycacheDirs = await promisifiedGlob(path.join(MINIFORGE_DIR, '**', '__pycache__'));
    for (const dir of pycacheDirs) {
      if (fs.existsSync(dir) && fs.statSync(dir).isDirectory()) {
        console.log(`Removing: ${dir}`);
        deleteFolderRecursive(dir);
      }
    }

    // Step 4: Remove documentation, tests, examples, etc.
    const dirsToRemove = [
      'man', 'share/man', 'share/doc', 'share/gtk-doc', 'doc', 'docs', 'documentation',
      'examples', 'demo', 'samples', 'tests', 'testing', 'test', 'benchmarks',
      'share/info', 'info', 'locale', 'share/locale', 'include',
      'share/terminfo', 'share/applications', 'share/icons', 'share/jupyter',
      'compiler_compat', 'conda-meta', 'share/fonts', 'share/terminfo',
      'share/readline', 'share/zoneinfo', 'share/X11', 'share/aclocal',
      'share/cmake', 'share/gettext', 'share/glib-2.0', 'share/pkgconfig',
      'share/texinfo', 'share/xml', 'share/bash-completion', 'share/ca-certificates',
      'share/emacs', 'share/gnupg', 'share/licenses', 'share/pixmaps',
      'share/tabset', 'share/themes', 'share/vala', 'share/zsh'
    ];

    for (const dirPattern of dirsToRemove) {
      const dirs = await promisifiedGlob(path.join(MINIFORGE_DIR, '**', dirPattern));
      for (const dir of dirs) {
        // Skip critical directories
        if (dir.includes('site-packages/numpy/core/include') ||
          dir.includes('site-packages/torch/include')) {
          console.log(`Preserving critical directory: ${dir}`);
          continue;
        }

        if (fs.existsSync(dir) && fs.statSync(dir).isDirectory()) {
          console.log(`Removing: ${dir}`);
          deleteFolderRecursive(dir);
        }
      }
    }

    // Step 5: Remove static libraries (.a files) and object files (.o files)
    console.log('Removing static libraries and object files...');
    const staticLibPatterns = ['**/*.a', '**/*.o', '**/*.la', '**/*.lib', '**/*.pdb', '**/*.exp'];
    for (const pattern of staticLibPatterns) {
      const files = await promisifiedGlob(path.join(MINIFORGE_DIR, pattern));
      for (const file of files) {
        if (fs.existsSync(file) && fs.statSync(file).isFile()) {
          console.log(`Removing: ${file}`);
          fs.unlinkSync(file);
        }
      }
    }

    // Step 6: Remove Python bytecode files (.pyc, .pyo)
    console.log('Removing Python bytecode files...');
    const bytecodePatterns = ['**/*.pyc', '**/*.pyo'];
    for (const pattern of bytecodePatterns) {
      const files = await promisifiedGlob(path.join(MINIFORGE_DIR, pattern));
      for (const file of files) {
        if (fs.existsSync(file) && fs.statSync(file).isFile()) {
          console.log(`Removing: ${file}`);
          fs.unlinkSync(file);
        }
      }
    }

    // Step 7: Remove unnecessary executables and tools
    console.log('Removing unnecessary executables and tools...');
    const toolsToRemove = [
      'bin/2to3*', 'bin/activate*', 'bin/conda*', 'bin/wheel*', 'bin/easy_install*',
      'bin/f2py*', 'bin/idle*', 'bin/pydoc*', 'bin/python*-config', 'bin/sqlite3*',
      'bin/openssl*', 'bin/chardetect*', 'bin/normalizer*', 'bin/pygmentize*',
      'bin/tqdm*', 'bin/torchrun*', 'bin/convert-caffe2-to-onnx*', 'bin/convert-onnx-to-caffe2*',
      'bin/flask*', 'bin/futurize*', 'bin/pasteurize*', 'bin/markdown_py*',
      'bin/jp.py*', 'bin/jsonschema*', 'bin/pyrsa*', 'bin/tabulate*',
      'bin/tiffcomment*', 'bin/tiffcp*', 'bin/tiffcrop*', 'bin/tiffdither*',
      'bin/tiffdump*', 'bin/tiffinfo*', 'bin/tiffmedian*', 'bin/tiffset*',
      'bin/tiffsplit*', 'bin/ttx*', 'bin/xslt*', 'bin/xml*', 'bin/c_rehash*',
      'bin/ncursesw6-config*', 'bin/pcre*', 'bin/libpng*', 'bin/freetype*',
      'bin/curl*', 'bin/curl-config*', 'bin/pkg-config*', 'bin/x86_64-conda*',
      'bin/gif*', 'bin/lz*', 'bin/xz*', 'bin/bz*', 'bin/zipinfo*', 'bin/unzip*',
      'bin/zip*', 'bin/iconv*', 'bin/gettext*', 'bin/msgfmt*', 'bin/msgmerge*',
      'bin/xgettext*', 'bin/envsubst*', 'bin/ngettext*', 'bin/gettextize*'
    ];

    // Keep python and pip executables
    const toolsToKeep = ['bin/python*', 'bin/pip'];

    for (const pattern of toolsToRemove) {
      const files = await promisifiedGlob(path.join(MINIFORGE_DIR, pattern));
      for (const file of files) {
        // Skip files that match patterns in toolsToKeep
        let shouldKeep = false;
        for (const keepPattern of toolsToKeep) {
          const keepRegex = new RegExp(keepPattern.replace('*', '.*'));
          if (keepRegex.test(file)) {
            shouldKeep = true;
            break;
          }
        }

        if (shouldKeep) {
          console.log(`Keeping: ${file}`);
          continue;
        }

        if (fs.existsSync(file) && fs.statSync(file).isFile()) {
          console.log(`Removing: ${file}`);
          fs.unlinkSync(file);
        }
      }
    }

    // Step 8: Clean up Python packages that aren't needed for ComfyUI
    console.log('Cleaning up unnecessary Python packages...');
    const pythonPackagesToClean = [
      'pip', 'setuptools', 'wheel', 'conda', 'conda-package-handling',
      'ipython', 'ipykernel', 'jupyter', 'notebook', 'nbconvert',
      'nbformat', 'ipywidgets', 'widgetsnbextension', 'jupyter_client',
      'jupyter_console', 'jupyter_core', 'qtconsole', 'traitlets',
      'sphinx', 'sphinx_rtd_theme', 'numpydoc', 'pytest', 'nose',
      'coverage', 'flake8', 'pylint', 'black', 'mypy', 'isort',
      'autopep8', 'yapf', 'pycodestyle', 'pydocstyle', 'pyflakes',
      'mccabe', 'rope', 'jedi', 'parso', 'pyls', 'pyls-black',
      'pyls-isort', 'pyls-mypy', 'python-lsp-server', 'python-lsp-black',
      'python-lsp-jsonrpc', 'python-lsp-server', 'pywinpty', 'ptyprocess',
      'terminado', 'send2trash', 'prometheus_client', 'pandocfilters',
      'mistune', 'entrypoints', 'defusedxml', 'bleach', 'webencodings',
      'testpath', 'pyzmq', 'pywin32', 'pywinpty', 'pyrsistent',
      'pyparsing', 'pycparser', 'ptyprocess', 'prompt_toolkit',
      'pickleshare', 'pexpect', 'parso', 'pandocfilters', 'packaging',
      'nest_asyncio', 'mistune', 'markupsafe', 'jupyterlab_pygments',
      'jsonschema', 'jinja2', 'jedi', 'ipython_genutils', 'importlib_metadata',
      'entrypoints', 'decorator', 'defusedxml', 'debugpy', 'backcall',
      'attrs', 'argon2-cffi', 'async_generator', 'bleach', 'cffi',
      'colorama', 'cycler', 'cython', 'dask', 'distributed', 'h5py',
      'imageio', 'joblib', 'kiwisolver', 'llvmlite', 'lxml', 'matplotlib',
      'networkx', 'numba', 'numexpr', 'pandas', 'patsy', 'pywavelets',
      'scikit-image', 'scikit-learn', 'scipy', 'seaborn', 'statsmodels',
      'sympy', 'tables', 'theano', 'xlrd', 'xlsxwriter', 'xlwt'
    ];

    // Get all site-packages directories
    const sitePackagesDirs = await promisifiedGlob(path.join(MINIFORGE_DIR, 'lib', 'python*', 'site-packages'));

    for (const sitePackagesDir of sitePackagesDirs) {
      for (const packageName of pythonPackagesToClean) {
        // Check for package directory
        const packageDir = path.join(sitePackagesDir, packageName);
        if (fs.existsSync(packageDir) && fs.statSync(packageDir).isDirectory()) {
          // Keep pip and setuptools but remove unnecessary files
          if (packageName === 'pip' || packageName === 'setuptools') {
            // For pip and setuptools, only remove tests and docs
            const subdirsToRemove = ['pip/tests', 'pip/_vendor/*/tests', 'setuptools/tests', 'setuptools/command/tests'];
            for (const subdir of subdirsToRemove) {
              const subdirPattern = path.join(packageDir, subdir.replace('*', '**'));
              const subdirs = await promisifiedGlob(subdirPattern);
              for (const dir of subdirs) {
                if (fs.existsSync(dir) && fs.statSync(dir).isDirectory()) {
                  console.log(`Removing: ${dir}`);
                  deleteFolderRecursive(dir);
                }
              }
            }
          } else {
            // For other packages, remove the entire directory
            console.log(`Removing package: ${packageDir}`);
            deleteFolderRecursive(packageDir);
          }
        }

        // Check for egg-info directory
        const eggInfoDir = path.join(sitePackagesDir, `${packageName}*.egg-info`);
        const eggInfoDirs = await promisifiedGlob(eggInfoDir);
        for (const dir of eggInfoDirs) {
          if (fs.existsSync(dir) && fs.statSync(dir).isDirectory()) {
            console.log(`Removing egg-info: ${dir}`);
            deleteFolderRecursive(dir);
          }
        }

        // Check for dist-info directory
        const distInfoDir = path.join(sitePackagesDir, `${packageName}*.dist-info`);
        const distInfoDirs = await promisifiedGlob(distInfoDir);
        for (const dir of distInfoDirs) {
          if (fs.existsSync(dir) && fs.statSync(dir).isDirectory()) {
            console.log(`Removing dist-info: ${dir}`);
            deleteFolderRecursive(dir);
          }
        }
      }
    }

    // Step 9: Platform-specific cleanup
    if (os.platform() === 'linux') {
      // Linux-specific cleanup
      console.log('Performing Linux-specific cleanup...');

      // Remove unnecessary shared libraries (keep only those needed by PIL and other critical packages)
      const essentialLibPrefixes = [
        'libpython', 'libz.', 'libjpeg', 'libpng', 'libtiff', 'libfreetype',
        'liblcms', 'libwebp', 'libopenjp2', 'libblas', 'liblapack', 'libgfortran',
        'libquadmath', 'libstdc++', 'libgcc', 'libffi', 'libcrypto', 'libssl',
        'libsqlite', 'libtorch', 'libcudnn', 'libcuda', 'libnvrtc', 'libnvToolsExt',
        'libcublas', 'libcufft', 'libcurand', 'libcusolver', 'libcusparse',
        'libnccl', 'libcudart', 'libc10', 'libtorch_cpu', 'libtorch_cuda',
        // Additional critical libraries
        'libm.', 'libc.', 'libdl.', 'librt.', 'libpthread.', 'libresolv.',
        'libnsl.', 'libutil.', 'libncurses', 'libtinfo', 'libreadline',
        'libgomp', 'libopenblas'
      ];

      // More aggressive Linux library cleanup
      const libDirs = [
        path.join(MINIFORGE_DIR, 'lib'),
        path.join(MINIFORGE_DIR, 'lib64')
      ];

      for (const libDir of libDirs) {
        if (fs.existsSync(libDir)) {
          const libFiles = await promisifiedGlob(path.join(libDir, '*.so*'));
          for (const file of libFiles) {
            const filename = path.basename(file);
            let isEssential = false;

            for (const prefix of essentialLibPrefixes) {
              if (filename.startsWith(prefix)) {
                isEssential = true;
                break;
              }
            }

            if (!isEssential) {
              console.log(`Removing non-essential library: ${file}`);
              fs.unlinkSync(file);
            }
          }
        }
      }

      // Remove unnecessary directories in lib
      const linuxDirsToRemove = [
        'pkgconfig', 'cmake', 'engines', 'engines-1.1', 'gconv',
        'gettext', 'gio', 'glib-2.0', 'gtk-2.0', 'gtk-3.0',
        'libffi', 'libthai', 'openmpi', 'perl', 'python*/__pycache__',
        'python*/config-*', 'python*/ensurepip', 'python*/idlelib',
        'python*/lib2to3', 'python*/tkinter', 'python*/turtledemo',
        'python*/venv', 'python*/wsgiref', 'terminfo', 'xml'
      ];

      for (const dirPattern of linuxDirsToRemove) {
        for (const libDir of libDirs) {
          const dirs = await promisifiedGlob(path.join(libDir, dirPattern));
          for (const dir of dirs) {
            if (fs.existsSync(dir) && fs.statSync(dir).isDirectory()) {
              console.log(`Removing: ${dir}`);
              deleteFolderRecursive(dir);
            }
          }
        }
      }

    } else if (os.platform() === 'darwin') {
      // macOS-specific cleanup
      console.log('Performing macOS-specific cleanup...');

      // Similar to Linux, but with .dylib extension
      const essentialLibPrefixes = [
        'libpython', 'libz.', 'libjpeg', 'libpng', 'libtiff', 'libfreetype',
        'liblcms', 'libwebp', 'libopenjp2', 'libblas', 'liblapack', 'libgfortran',
        'libquadmath', 'libstdc++', 'libgcc', 'libffi', 'libcrypto', 'libssl',
        'libsqlite', 'libtorch', 'libcudnn', 'libcuda', 'libnvrtc', 'libnvToolsExt',
        'libcublas', 'libcufft', 'libcurand', 'libcusolver', 'libcusparse',
        'libnccl', 'libcudart', 'libc10', 'libtorch_cpu', 'libtorch_cuda',
        // Additional critical libraries for macOS
        'libSystem', 'libncurses', 'libobjc', 'libopenblas'
      ];

      const libDir = path.join(MINIFORGE_DIR, 'lib');
      if (fs.existsSync(libDir)) {
        const libFiles = await promisifiedGlob(path.join(libDir, '*.dylib'));
        for (const file of libFiles) {
          const filename = path.basename(file);
          let isEssential = false;

          for (const prefix of essentialLibPrefixes) {
            if (filename.startsWith(prefix)) {
              isEssential = true;
              break;
            }
          }

          if (!isEssential) {
            console.log(`Removing non-essential library: ${file}`);
            fs.unlinkSync(file);
          }
        }
      }

      // Remove unnecessary directories in lib
      const macosDirsToRemove = [
        'pkgconfig', 'cmake', 'engines', 'engines-1.1',
        'gettext', 'gio', 'glib-2.0', 'gtk-2.0', 'gtk-3.0',
        'libffi', 'openmpi', 'perl', 'python*/__pycache__',
        'python*/config-*', 'python*/ensurepip', 'python*/idlelib',
        'python*/lib2to3', 'python*/tkinter', 'python*/turtledemo',
        'python*/venv', 'python*/wsgiref', 'terminfo', 'xml'
      ];

      for (const dirPattern of macosDirsToRemove) {
        const dirs = await promisifiedGlob(path.join(libDir, dirPattern));
        for (const dir of dirs) {
          if (fs.existsSync(dir) && fs.statSync(dir).isDirectory()) {
            console.log(`Removing: ${dir}`);
            deleteFolderRecursive(dir);
          }
        }
      }

    } else if (os.platform() === 'win32') {
      // Windows-specific cleanup
      console.log('Performing Windows-specific cleanup...');

      // Similar approach for Windows DLLs
      const essentialLibPrefixes = [
        'python', 'z.', 'jpeg', 'png', 'tiff', 'freetype',
        'lcms', 'webp', 'openjp2', 'blas', 'lapack', 'gfortran',
        'quadmath', 'stdc++', 'gcc', 'ffi', 'crypto', 'ssl',
        'sqlite', 'torch', 'cudnn', 'cuda', 'nvrtc', 'nvToolsExt',
        'cublas', 'cufft', 'curand', 'cusolver', 'cusparse',
        'nccl', 'cudart', 'c10', 'torch_cpu', 'torch_cuda',
        // Additional critical DLLs for Windows
        'vcruntime', 'msvcp', 'concrt', 'api-ms-win', 'ucrtbase',
        'openblas'
      ];

      const libDirs = [
        path.join(MINIFORGE_DIR, 'Library', 'bin'),
        path.join(MINIFORGE_DIR, 'DLLs')
      ];

      for (const libDir of libDirs) {
        if (fs.existsSync(libDir)) {
          const libFiles = await promisifiedGlob(path.join(libDir, '*.dll'));
          for (const file of libFiles) {
            const filename = path.basename(file).toLowerCase();
            let isEssential = false;

            for (const prefix of essentialLibPrefixes) {
              if (filename.startsWith(prefix.toLowerCase())) {
                isEssential = true;
                break;
              }
            }

            if (!isEssential) {
              console.log(`Removing non-essential library: ${file}`);
              fs.unlinkSync(file);
            }
          }
        }
      }

      // Remove unnecessary directories in Library
      const windowsDirsToRemove = [
        'Library/share', 'Library/mingw-w64', 'Library/cmake',
        'Library/pkgs', 'Library/etc', 'Library/include',
        'Library/man', 'Library/doc', 'Library/info',
        'Lib/__pycache__', 'Lib/ensurepip', 'Lib/idlelib',
        'Lib/lib2to3', 'Lib/tkinter', 'Lib/turtledemo',
        'Lib/venv', 'Lib/wsgiref', 'Lib/test'
      ];

      for (const dirPattern of windowsDirsToRemove) {
        const dirs = await promisifiedGlob(path.join(MINIFORGE_DIR, dirPattern));
        for (const dir of dirs) {
          if (fs.existsSync(dir) && fs.statSync(dir).isDirectory()) {
            console.log(`Removing: ${dir}`);
            deleteFolderRecursive(dir);
          }
        }
      }
    }

    // Step 10: Remove .git directories to save space
    console.log('Removing .git directories...');
    const gitDirs = await promisifiedGlob(path.join(ANYMATIX_DIR, '**', '.git'));
    for (const dir of gitDirs) {
      if (fs.existsSync(dir) && fs.statSync(dir).isDirectory()) {
        console.log(`Removing: ${dir}`);
        deleteFolderRecursive(dir);
      }
    }

    // Step 11: Report size after cleanup
    console.log('Size after cleanup:');
    if (os.platform() === 'win32') {
      const { stdout } = await execAsync('powershell -Command "Get-ChildItem -Path anymatix -Recurse | Measure-Object -Property Length -Sum | Select-Object -ExpandProperty Sum"');
      const size = parseInt(stdout.trim());
      console.log(`${Math.round(size / (1024 * 1024))} MB`);
    } else {
      const { stdout } = await execAsync(`du -sh ${ANYMATIX_DIR}`);
      console.log(stdout.trim());
    }

  } catch (error) {
    console.error(`Error during cleanup: ${error.message}`);
    console.error(error.stack);
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
      const scriptPath = path.join(ANYMATIX_DIR, 'run_comfyui.bat');
      fs.copyFileSync(path.join(__dirname, 'run_comfyui_windows.bat'), scriptPath);
      console.log(`Copied run_comfyui_windows.bat to ${scriptPath}`);
    } else if (os.platform() === 'darwin') {
      const scriptPath = path.join(ANYMATIX_DIR, 'run_comfyui.sh');
      fs.copyFileSync(path.join(__dirname, 'run_comfyui_macos.sh'), scriptPath);
      execSync(`chmod +x ${scriptPath}`);
      console.log(`Copied run_comfyui_macos.sh to ${scriptPath} and made it executable`);
    } else if (os.platform() === 'linux') {
      const scriptPath = path.join(ANYMATIX_DIR, 'run_comfyui.sh');
      fs.copyFileSync(path.join(__dirname, 'run_comfyui_linux.sh'), scriptPath);
      execSync(`chmod +x ${scriptPath}`);
      console.log(`Copied run_comfyui_linux.sh to ${scriptPath} and made it executable`);
    }

    // Verify that the script was copied correctly
    if (os.platform() === 'win32') {
      const scriptPath = path.join(ANYMATIX_DIR, 'run_comfyui.bat');
      if (fs.existsSync(scriptPath)) {
        console.log(`Verified that ${scriptPath} exists`);
      } else {
        console.error(`Error: ${scriptPath} does not exist!`);
      }
    } else {
      const scriptPath = path.join(ANYMATIX_DIR, 'run_comfyui.sh');
      if (fs.existsSync(scriptPath)) {
        console.log(`Verified that ${scriptPath} exists`);
      } else {
        console.error(`Error: ${scriptPath} does not exist!`);
      }
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