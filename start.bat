@echo off
title FamilyTree Social
echo.
echo   ==========================================
echo     FamilyTree Social
echo   ==========================================
echo.

:: ── Check Node.js is installed ────────────────────────────────────────
where node >nul 2>&1
if errorlevel 1 (
    echo   ERROR: Node.js is not installed.
    echo.
    echo   Please install it, then double-click this file again.
    echo.
    echo   Steps:
    echo     1. Open your browser and go to: https://nodejs.org
    echo     2. Click "Download Node.js (LTS)"
    echo     3. Run the installer - keep all default options
    echo     4. IMPORTANT: restart your computer after installing
    echo     5. Then double-click start.bat again
    echo.
    echo   Opening the download page now...
    start https://nodejs.org
    echo.
    pause
    exit /b 1
)

:: ── Check npm is installed ────────────────────────────────────────────
where npm >nul 2>&1
if errorlevel 1 (
    echo   ERROR: npm is not installed.
    echo   npm normally comes bundled with Node.js.
    echo.
    echo   Please reinstall Node.js from https://nodejs.org
    echo   Make sure to restart your computer after reinstalling.
    echo.
    echo   Opening the download page now...
    start https://nodejs.org
    echo.
    pause
    exit /b 1
)

:: ── Check minimum Node version (18+) ─────────────────────────────────
for /f "tokens=1 delims=." %%a in ('node -e "process.stdout.write(process.versions.node)"') do set NODE_MAJOR=%%a
if %NODE_MAJOR% LSS 18 (
    echo   ERROR: Node.js version 18 or higher is required.
    for /f %%v in ('node --version') do echo   You have: %%v
    echo.
    echo   Please download the latest LTS version from: https://nodejs.org
    echo   Opening the download page now...
    start https://nodejs.org
    echo.
    pause
    exit /b 1
)

:: ── Install dependencies if needed ───────────────────────────────────
if not exist "node_modules\" (
    echo   Installing dependencies (first run only)...
    echo.
    call npm install --silent
    if errorlevel 1 (
        echo.
        echo   ERROR: Failed to install dependencies.
        echo   Make sure you are connected to the internet and try again.
        echo.
        pause
        exit /b 1
    )
    echo   Done.
    echo.
)

:: ── Start server and open browser ────────────────────────────────────
echo   Server starting at http://localhost:3000
echo   Close this window to stop the server.
echo.

start "" /b cmd /c "timeout /t 2 >nul && start http://localhost:3000"

node server.js

pause
