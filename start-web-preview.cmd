@echo off
setlocal
cd /d "%~dp0"
title JieYaTai jieyatai-2 Web Preview
where npm >nul 2>nul
if errorlevel 1 (
  echo [jieyatai-2] Node.js / npm was not found.
  echo Install Node.js 20.19+ or 22.12+ first, then run this file again.
  pause
  exit /b 1
)
if not exist node_modules\ (
  echo [jieyatai-2] Installing frontend dependencies for the first run...
  call npm install
  if errorlevel 1 (
    echo Dependency installation failed. Check your network or npm configuration.
    pause
    exit /b 1
  )
)
echo [jieyatai-2] Starting browser preview at http://127.0.0.1:5173 ...
call npm run preview:browser
if errorlevel 1 pause
