@echo off
setlocal
cd /d "%~dp0"
title JieYaTai jieyatai-2 Desktop Dev
where npm >nul 2>nul
if errorlevel 1 (
  echo Node.js / npm was not found.
  pause
  exit /b 1
)
if not exist node_modules\ (
  call npm install
  if errorlevel 1 pause & exit /b 1
)
call npm run tauri dev
if errorlevel 1 pause
