@echo off
title StyleMood AI
cd /d "%~dp0"
echo Installing (first time only, a few minutes)...
call npm install
if errorlevel 1 (
  echo.
  echo Node.js is missing. Install the LTS version from https://nodejs.org and try again.
  pause
  exit /b 1
)
call npm run local
pause
