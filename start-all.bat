@echo off
setlocal
title Jingxin Laundry CMS - Dev

cd /d "%~dp0app"

if not exist "node_modules\" (
  echo node_modules not found. Installing dependencies...
  call npm install
  if errorlevel 1 (
    echo.
    echo npm install failed. Press any key to close.
    pause >nul
    exit /b 1
  )
)

if not exist ".env.local" (
  echo.
  echo WARNING: .env.local is missing.
  echo Copy .env.local.example to .env.local and fill in the Supabase keys.
  echo.
  pause
  exit /b 1
)

echo.
echo ============================================
echo  Jingxin Laundry CMS - Dev Server
echo ============================================
echo  URL    : http://localhost:3000
echo  Login  : ren.studio.dev@gmail.com
echo  Pass   : admin1234
echo.
echo  Press Ctrl+C to stop the server.
echo ============================================
echo.

REM Open browser after a short delay so dev server has time to bind the port
start "" cmd /c "timeout /t 6 /nobreak >nul && start http://localhost:3000"

call npm run dev

endlocal
