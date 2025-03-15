@echo off
setlocal

rem Get the directory where this script is located
set "SCRIPT_DIR=%~dp0"
set "SCRIPT_DIR=%SCRIPT_DIR:~0,-1%"

rem Add library directories to PATH
set "PATH=%SCRIPT_DIR%\miniforge\Library\bin;%SCRIPT_DIR%\miniforge\DLLs;%PATH%"

rem Find PIL/.dylibs directory and add to PATH
for /f "tokens=*" %%a in ('dir /b /s /a:d "%SCRIPT_DIR%\miniforge\Lib\site-packages\PIL\.dylibs" 2^>nul') do (
    set "PIL_DYLIBS_DIR=%%a"
    set "PATH=%PIL_DYLIBS_DIR%;%PATH%"
    echo Added PIL/.dylibs to PATH: %PIL_DYLIBS_DIR%
)

rem Print PATH for debugging
echo PATH: %PATH%

rem Change to the script directory
cd /d "%SCRIPT_DIR%"

rem Execute ComfyUI
"%SCRIPT_DIR%\miniforge\python.exe" "%SCRIPT_DIR%\ComfyUI\main.py" %*

rem If you need to pass additional arguments to ComfyUI, they will be automatically passed through %* 