@echo off
setlocal

rem Get the directory where this script is located
set "SCRIPT_DIR=%~dp0"
set "SCRIPT_DIR=%SCRIPT_DIR:~0,-1%"

rem Change to the script directory
cd /d "%SCRIPT_DIR%"

rem Execute ComfyUI
"%SCRIPT_DIR%\miniforge\python.exe" "%SCRIPT_DIR%\ComfyUI\main.py" %*

rem If you need to pass additional arguments to ComfyUI, they will be automatically passed through %* 