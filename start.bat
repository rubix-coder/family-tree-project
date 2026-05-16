@echo off
title FamilyTree Social

:: Install dependencies if node_modules is missing
if not exist "node_modules\" (
    echo Installing dependencies...
    call npm install
    if errorlevel 1 (
        echo.
        echo ERROR: npm install failed.
        echo Make sure Node.js 18+ is installed: https://nodejs.org
        pause
        exit /b 1
    )
)

echo.
echo   FamilyTree Social
echo   Starting server on http://localhost:3000
echo   Close this window to stop the server.
echo.

:: Open the browser after a short delay
start "" /b cmd /c "timeout /t 2 >nul && start http://localhost:3000"

:: Start the server
node server.js

pause
