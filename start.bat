@echo off
title FamilyTree Social
echo.
echo   ==========================================
echo     FamilyTree Social
echo   ==========================================
echo.

:: ── Auto-install Node.js + npm if missing ────────────────────────────
where node >nul 2>&1
if errorlevel 1 goto install_node

where npm >nul 2>&1
if errorlevel 1 goto install_node

:: Check version (need 18+)
for /f %%a in ('node -e "process.stdout.write(process.versions.node.split(\".\")[0])"') do set NODE_MAJOR=%%a
if %NODE_MAJOR% LSS 18 goto install_node

goto deps

:install_node
echo   Node.js not found or outdated — installing automatically...
echo.

:: Try winget first (available on Windows 10/11)
where winget >nul 2>&1
if not errorlevel 1 (
    winget install OpenJS.NodeJS.LTS --silent --accept-package-agreements --accept-source-agreements
    goto refresh_path
)

:: Fall back to PowerShell silent download + install
echo   Downloading Node.js installer...
powershell -ExecutionPolicy Bypass -Command ^
    "$url = 'https://nodejs.org/dist/v20.18.1/node-v20.18.1-x64.msi';" ^
    "$out = \"$env:TEMP\nodejs_installer.msi\";" ^
    "Write-Host '  Downloading...'" ^
    "[Net.ServicePointManager]::SecurityProtocol = [Net.SecurityProtocolType]::Tls12;" ^
    "Invoke-WebRequest -Uri $url -OutFile $out -UseBasicParsing;" ^
    "Write-Host '  Installing (this may take a moment)...';" ^
    "Start-Process msiexec.exe -ArgumentList '/i', $out, '/quiet', '/norestart', 'ADDLOCAL=ALL' -Wait;" ^
    "Remove-Item $out -Force"

if errorlevel 1 (
    echo.
    echo   ERROR: Automatic installation failed.
    echo   Please install Node.js manually from: https://nodejs.org
    echo   Then double-click start.bat again.
    echo.
    start https://nodejs.org
    pause
    exit /b 1
)

:refresh_path
:: Add default Node.js install location to PATH for this session
set "PATH=C:\Program Files\nodejs\;%PATH%"

:: Verify node is now available
where node >nul 2>&1
if errorlevel 1 (
    echo.
    echo   Installation complete. Please restart your computer
    echo   and then double-click start.bat again.
    echo.
    pause
    exit /b 0
)

echo.
echo   Node.js installed successfully.
echo.

:deps
:: ── Install app dependencies if needed ───────────────────────────────
if not exist "node_modules\" (
    echo   Installing app dependencies (first run only)...
    call npm install --silent
    if errorlevel 1 (
        echo.
        echo   ERROR: Failed to install dependencies.
        echo   Check your internet connection and try again.
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
