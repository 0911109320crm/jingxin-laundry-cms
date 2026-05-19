@echo off
setlocal enabledelayedexpansion
title Jingxin Laundry CMS - Stop

echo Stopping Jingxin Laundry CMS dev server...
echo.

set "FOUND="

REM Find PID listening on port 3000
for /f "tokens=5" %%a in ('netstat -ano ^| findstr ":3000" ^| findstr "LISTENING"') do (
  set "PID=%%a"
  set "FOUND=1"
  echo Killing process tree on port 3000 PID=!PID!
  taskkill /F /T /PID !PID! >nul 2>&1
  if errorlevel 1 (
    echo   Failed to kill PID !PID!.
  ) else (
    echo   Stopped PID !PID!.
  )
)

if not defined FOUND (
  echo No process listening on port 3000.
)

REM Close the dev cmd window by title as a fallback
taskkill /F /FI "WindowTitle eq Jingxin Laundry CMS - Dev*" >nul 2>&1

echo.
echo Done.
timeout /t 2 /nobreak >nul
endlocal
