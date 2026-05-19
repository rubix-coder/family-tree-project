@echo off
title FamilyTree Social
echo.
echo   ==========================================
echo     FamilyTree Social
echo   ==========================================
echo.

:: ── Step 1: Check for Node.js ─────────────────────────────────────────
node --version >nul 2>&1
if errorlevel 1 goto install_node

for /f "tokens=1 delims=." %%a in ('node --version 2^>nul') do set "_VR=%%a"
if not defined _VR goto check_deps
set "_VM=%_VR:~1%"
if not defined _VM goto check_deps
if %_VM% LSS 18 goto install_node

goto check_deps

:: ── Install Node.js ────────────────────────────────────────────────────
:install_node
echo   Node.js 18+ is required.
echo   Downloading installer from nodejs.org (this may take a minute)...
echo.

certutil -urlcache -split -f "https://nodejs.org/dist/v20.18.1/node-v20.18.1-x64.msi" "%TEMP%\nodejs_setup.msi"
if errorlevel 1 goto download_failed

echo.
echo   Installing Node.js...
echo   An installer window will appear — click Next, accept defaults, then Finish.
echo.
msiexec /i "%TEMP%\nodejs_setup.msi" /passive /norestart ADDLOCAL=ALL
del "%TEMP%\nodejs_setup.msi" >nul 2>&1

:: Add default install path to PATH for this session
set "PATH=C:\Program Files\nodejs\;%PATH%"

node --version >nul 2>&1
if errorlevel 1 goto needs_restart

echo.
echo   Node.js installed successfully!
echo.
goto check_deps

:download_failed
echo.
echo   Could not download Node.js automatically.
echo.
echo   Please do this manually:
echo     1. Open https://nodejs.org in your browser
echo     2. Download and install the LTS version
echo     3. Restart your computer
echo     4. Double-click start.bat again
echo.
start https://nodejs.org
pause
exit /b 1

:needs_restart
echo.
echo   Node.js was installed but needs a restart to take effect.
echo.
echo   Please:
echo     1. Close this window
echo     2. Restart your computer
echo     3. Double-click start.bat again
echo.
pause
exit /b 0

:: ── Step 2: Install app dependencies ──────────────────────────────────
:check_deps
echo   Checking app packages...
call npm install
if errorlevel 1 goto deps_failed

echo.
goto start_server

:deps_failed
echo.
echo   ERROR: Failed to install packages.
echo   Check your internet connection and try again.
echo.
pause
exit /b 1

:: ── Step 3: Start the server ───────────────────────────────────────────
:start_server
echo   ==========================================
echo     Starting server at http://localhost:3000
echo     Your browser will open automatically.
echo     Keep this window open to keep the app running.
echo     Close this window to stop the app.
echo   ==========================================
echo.

start "" /b cmd /c "timeout /t 3 >nul && start http://localhost:3000"

node server.js

echo.
echo   Server stopped.
pause
