@echo off
REM ============================================================
REM  FreeCode — one-shot installer for Windows (cmd / PowerShell)
REM
REM  Usage:
REM    curl -fsSL https://raw.githubusercontent.com/cameleonnbss/freecode/main/install.bat -o install.bat && install.bat
REM
REM  Or, after cloning:
REM    install.bat
REM ============================================================
setlocal EnableDelayedExpansion
set "GREEN=[92m"
set "CYAN=[96m"
set "YELLOW=[93m"
set "RED=[91m"
set "GRAY=[90m"
set "NC=[0m"

set "REPO_URL=https://github.com/cameleonnbss/freecode.git"
set "INSTALL_DIR=%USERPROFILE%\.freecode-src"

echo %CYAN%FreeCode installer for Windows%NC%
echo.

REM ── 1. Node check ──────────────────────────────────────────
echo %CYAN%Checking Node.js...%NC%
where node >nul 2>&1
if errorlevel 1 (
  echo %RED%Node.js is required ^(>= 18^).%NC%
  echo %YELLOW%Install from: https://nodejs.org/en/download/%NC%
  echo %YELLOW%Then re-run this script.%NC%
  pause
  exit /b 1
)
for /f "tokens=*" %%v in ('node -v') do set "NODE_VER=%%v"
echo %GREEN%Node %NODE_VER% OK%NC%

REM ── 2. Clone or use current dir ────────────────────────────
if exist "%CD%\package.json" (
  findstr /C:"\"freecode\"" "%CD%\package.json" >nul 2>&1
  if not errorlevel 1 (
    set "INSTALL_DIR=%CD%"
    echo %CYAN%Running from repo: !INSTALL_DIR!%NC%
    goto :build
  )
)

echo %CYAN%Cloning FreeCode into %INSTALL_DIR%...%NC%
if exist "%INSTALL_DIR%" (
  echo %GREEN%Already cloned, pulling latest...%NC%
  git -C "%INSTALL_DIR%" pull --rebase --autostash
) else (
  git clone --depth 1 %REPO_URL% "%INSTALL_DIR%"
)

:build
cd /d "%INSTALL_DIR%"

REM ── 3. Install + build ─────────────────────────────────────
echo %CYAN%Installing dependencies ^(npm install^)...%NC%
call npm install --no-fund --no-audit
if errorlevel 1 (
  echo %RED%npm install failed.%NC%
  pause
  exit /b 1
)
echo %GREEN%Dependencies installed%NC%

echo %CYAN%Building ^(npm run build^)...%NC%
call npm run build
if errorlevel 1 (
  echo %RED%Build failed.%NC%
  pause
  exit /b 1
)
echo %GREEN%Build complete%NC%

REM ── 4. Create launcher .bat in a dir on PATH ──────────────
set "TARGET=%INSTALL_DIR%\bin\freecode.js"
set "LAUNCHER=%USERPROFILE%\freecode.cmd"

REM Write a tiny launcher .cmd that calls node on the dist entry.
> "%LAUNCHER%" echo @echo off
>> "%LAUNCHER%" echo node "%TARGET%" %%*

echo %GREEN%Linked freecode -^> %LAUNCHER%%NC%
echo.

REM Try to add %USERPROFILE% to PATH (user-level).
echo %CYAN%Ensuring %%USERPROFILE%% is on PATH...%NC%
set "PATH_OK=0"
for /f "tokens=2*" %%A in ('reg query "HKCU\Environment" /v Path 2^>nul') do set "USER_PATH=%%B"
echo !USER_PATH! | findstr /I /C:"%USERPROFILE%" >nul && set "PATH_OK=1"
if "!PATH_OK!"=="0" (
  echo %YELLOW%Adding %%USERPROFILE%% to your user PATH...%NC%
  setx PATH "%PATH%;%USERPROFILE%" >nul
  echo %YELLOW%PATH updated. Open a NEW terminal so 'freecode' is found.%NC%
) else (
  echo %GREEN%%%USERPROFILE%% already on PATH%NC%
)

REM ── 5. Done ────────────────────────────────────────────────
echo.
echo %CYAN% ▄▄▄▄▄▄▄▄                                                                    ▄▄           %NC%
echo %CYAN% ██▀▀▀▀▀▀                                                                    ██           %NC%
echo %CYAN% ██         ██▄████   ▄████▄    ▄████▄              ▄█████▄   ▄████▄    ▄███▄██   ▄████▄  %NC%
echo %CYAN% ███████    ██▀      ██▄▄▄▄██  ██▄▄▄▄██            ██▀    ▀  ██▀  ▀██  ██▀  ▀██  ██▄▄▄▄██ %NC%
echo %CYAN% ██         ██       ██▀▀▀▀▀▀  ██▀▀▀▀▀▀            ██        ██    ██  ██    ██  ██▀▀▀▀▀▀ %NC%
echo %CYAN% ██         ██       ▀██▄▄▄▄█  ▀██▄▄▄▄█            ▀██▄▄▄▄█  ▀██▄▄██▀  ▀██▄▄███  ▀██▄▄▄▄█ %NC%
echo %CYAN% ▀▀         ▀▀         ▀▀▀▀▀     ▀▀▀▀▀               ▀▀▀▀▀     ▀▀▀▀      ▀▀▀ ▀▀    ▀▀▀▀▀  %NC%
echo.
echo %GREEN%FreeCode installed!%NC%
echo   %GRAY%Run:%NC%        freecode
echo   %GRAY%Configure:%NC%  freecode config
echo   %GRAY%Docs:%NC%       https://github.com/cameleonnbss/freecode
echo.
echo %YELLOW%If 'freecode' is not found, open a NEW terminal.^%NC%
pause
endlocal
