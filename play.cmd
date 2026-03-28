@echo off
REM Konoha — Path of the Shinobi
REM Launches the dev server and opens the game in your default browser.

cd /d "%~dp0"

IF NOT EXIST "node_modules" (
    echo Installing dependencies...
    call npm install
)

set KONOHA_PORT=5173

echo.
echo   +======================================+
echo   ^|   KONOHA — Path of the Shinobi       ^|
echo   ^|   Starting on http://localhost:%KONOHA_PORT%  ^|
echo   ^|   Press Ctrl+C to stop               ^|
echo   +======================================+
echo.

start "" "http://localhost:%KONOHA_PORT%"
npx vite --port %KONOHA_PORT%
