@echo off
setlocal enabledelayedexpansion
title Jingxin Laundry CMS - Dev

set LOGFILE=%~dp0start-all.log
echo [%date% %time%] ===== start-all.bat launched ===== > "%LOGFILE%"

cd /d "%~dp0app"
echo [%date% %time%] cd app OK >> "%LOGFILE%"

echo Stopping previous dev server (if any)...
taskkill /F /IM node.exe >nul 2>&1
timeout /t 2 /nobreak >nul
echo [%date% %time%] cleanup done >> "%LOGFILE%"

where node >nul 2>&1
if errorlevel 1 (
  echo.
  echo ERROR: Node.js not found. Install from https://nodejs.org/
  echo [%date% %time%] ERROR: node not found >> "%LOGFILE%"
  pause
  exit /b 1
)
echo [%date% %time%] node found >> "%LOGFILE%"

if not exist "node_modules\" (
  echo node_modules not found. Installing...
  echo [%date% %time%] running npm install >> "%LOGFILE%"
  call npm install
  if errorlevel 1 (
    echo ERROR: npm install failed.
    echo [%date% %time%] ERROR: npm install failed >> "%LOGFILE%"
    pause
    exit /b 1
  )
)
echo [%date% %time%] node_modules OK >> "%LOGFILE%"

if not exist ".env.local" (
  echo ERROR: .env.local is missing.
  echo [%date% %time%] ERROR: .env.local missing >> "%LOGFILE%"
  pause
  exit /b 1
)
echo [%date% %time%] .env.local OK >> "%LOGFILE%"

echo.
echo ============================================
echo  Jingxin Laundry CMS - Dev Server
echo ============================================
echo  URL     : http://localhost:3000
echo.
echo  Owner   : ren.studio.dev@gmail.com
echo  Manager : borenchang+manager@gmail.com
echo  Tech 1  : sf001@jingxin.tw
echo  Tech 2  : sf002@jingxin.tw
echo  Tech 3  : sf003@jingxin.tw
echo  Tech 4  : sf004@jingxin.tw
echo  Pass    : admin1234
echo.
echo  Press Ctrl+C to stop the server.
echo ============================================
echo.

start "" cmd /c "timeout /t 6 /nobreak >nul && start http://localhost:3000"

echo [%date% %time%] launching npm run dev >> "%LOGFILE%"
call npm run dev
echo [%date% %time%] npm run dev exited, code=%errorlevel% >> "%LOGFILE%"

echo.
echo Server stopped. Press any key to close.
pause >nul
endlocal
