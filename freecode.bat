@echo off
REM FreeCode — direct launcher for Windows.
REM Place this freecode.bat somewhere on your PATH.
setlocal
set "SCRIPT_DIR=%~dp0"
if exist "%SCRIPT_DIR%bin\freecode.js" (
  node "%SCRIPT_DIR%bin\freecode.js" %*
  goto :eof
)
if exist "%USERPROFILE%\.freecode-src\bin\freecode.js" (
  node "%USERPROFILE%\.freecode-src\bin\freecode.js" %*
  goto :eof
)
where freecode >nul 2>&1
if not errorlevel 1 (
  freecode %*
  goto :eof
)
echo FreeCode not found. >&2
echo Install it first: >&2
echo   curl -fsSL https://raw.githubusercontent.com/cameleonnbss/freecode/main/install.bat -o install.bat ^&^& install.bat >&2
echo Or: >&2
echo   npm install -g freecode >&2
exit /b 1
