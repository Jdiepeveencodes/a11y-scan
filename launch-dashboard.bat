@echo off
setlocal
title a11y-scan Launcher

REM Switch to the directory this .bat file is in (your repo root)
cd /d "%~dp0"
if errorlevel 1 (
  echo ❌ Failed to cd into repo folder: "%~dp0"
  pause
  exit /b 1
)

echo ==========================================
echo a11y-scan launcher starting...
echo Repo dir: %cd%
echo ==========================================
echo.

REM Start the server and KEEP this window open
echo Starting server...
start "a11y-scan Server" cmd /k "node server.js"

REM Wait briefly for server to bind the port
timeout /t 2 >nul

REM Open launcher UI
start "" "http://localhost:5177/"

echo.
echo ✅ Launcher opened in your browser.
echo ✅ Server is running in the "a11y-scan Server" window.
echo.
pause
