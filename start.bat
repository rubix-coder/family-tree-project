@echo off
title FamilyTree Social
echo.
echo   ==========================================
echo     FamilyTree Social
echo   ==========================================
echo.

:: ── Check Node.js ─────────────────────────────────────────────────────
node --version >nul 2>&1
if errorlevel 1 goto install_node

npm --version >nul 2>&1
if errorlevel 1 goto install_node

for /f "tokens=1 delims=." %%a in ('node --version 2^>nul') do set NODE_VER_RAW=%%a
if not defined NODE_VER_RAW goto install_node
set NODE_MAJOR=%NODE_VER_RAW:~1%
if not defined NODE_MAJOR goto install_node
if %NODE_MAJOR% LSS 18 goto install_node

goto deps

:: ── Install Node.js ────────────────────────────────────────────────────
:install_node
echo   Node.js not found or outdated. Installing automatically...
echo.

where winget >nul 2>&1
if errorlevel 1 goto try_ps

winget install OpenJS.NodeJS.LTS --silent --accept-package-agreements --accept-source-agreements
goto refresh_path

:try_ps
echo   Downloading Node.js installer...
powershell -ExecutionPolicy Bypass -NoProfile -Command "Invoke-WebRequest -Uri 'https://nodejs.org/dist/v20.18.1/node-v20.18.1-x64.msi' -OutFile '%TEMP%\nodejs.msi' -UseBasicParsing; Start-Process msiexec.exe -ArgumentList '/i %TEMP%\nodejs.msi /quiet /norestart ADDLOCAL=ALL' -Wait; Remove-Item '%TEMP%\nodejs.msi' -Force"
if errorlevel 1 goto install_failed
goto refresh_path

:install_failed
echo.
echo   ERROR: Automatic installation failed.
echo   Please install Node.js manually from: https://nodejs.org
echo   Then double-click start.bat again.
echo.
start https://nodejs.org
pause
exit /b 1

:refresh_path
set "PATH=C:\Program Files\nodejs\;%PATH%"
node --version >nul 2>&1
if errorlevel 1 goto needs_restart

echo.
echo   Node.js installed successfully.
echo.
goto deps

:needs_restart
echo.
echo   Installation complete. Please restart your computer
echo   and then double-click start.bat again.
echo.
pause
exit /b 0

:: ── Install app dependencies ───────────────────────────────────────────
:deps
if exist "node_modules\" goto start_server

echo   Installing app dependencies (first run only)...
call npm install --silent
if errorlevel 1 goto deps_failed

echo   Done.
echo.
goto start_server

:deps_failed
echo.
echo   ERROR: Failed to install dependencies.
echo   Check your internet connection and try again.
echo.
pause
exit /b 1

:: ── Start server ───────────────────────────────────────────────────────
:start_server
echo   Server starting at http://localhost:3000
echo   Close this window to stop the server.
echo.

start "" /b cmd /c "timeout /t 2 >nul && start http://localhost:3000"

node server.js

pause
