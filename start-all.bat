@echo off
setlocal
title Jingxin Laundry CMS - Dev

cd /d "%~dp0app"

REM ===== Step 1: Verify Node.js is installed =====
where node >nul 2>&1
if errorlevel 1 (
  echo.
  echo ERROR: Node.js not found on this machine.
  echo Install Node.js LTS (v20+) from https://nodejs.org/
  echo Then re-run this script.
  echo.
  pause
  exit /b 1
)

REM ===== Step 2: Verify Node version >= 18 (Next 16 requires 18.18+) =====
for /f "tokens=1 delims=." %%a in ('node -p "process.versions.node"') do set NODE_MAJOR=%%a
if %NODE_MAJOR% LSS 18 (
  echo.
  echo ERROR: Node.js version is too old (need 18.18+ ^| recommend 20+).
  echo Detected:
  node --version
  echo Please update Node.js: https://nodejs.org/
  echo.
  pause
  exit /b 1
)

REM ===== Step 3: Install deps if node_modules missing =====
if not exist "node_modules\" (
  echo.
  echo node_modules not found. Installing dependencies (takes 1-3 min)...
  echo.
  call npm install
  if errorlevel 1 (
    echo.
    echo ERROR: npm install failed. Press any key to close.
    pause >nul
    exit /b 1
  )
)

REM ===== Step 4: Verify .env.local exists =====
if not exist ".env.local" (
  echo.
  echo ERROR: .env.local is missing.
  echo This file holds Supabase keys and should have been pulled from git.
  echo If pulling from a fresh clone fixes it, that is preferred.
  echo Otherwise copy .env.local.example to .env.local and fill the keys.
  echo.
  pause
  exit /b 1
)

REM ===== Step 5: Banner =====
echo.
echo ============================================
echo  Jingxin Laundry CMS - Dev Server
echo ============================================
echo  URL     : http://localhost:3000
echo.
echo  Owner   : ren.studio.dev@gmail.com
echo  Manager : borenchang+manager@gmail.com
echo  Tech 1  : sf001@jingxin.tw    (Wang)
echo  Tech 2  : sf002@jingxin.tw    (Lin)
echo  Tech 3  : sf003@jingxin.tw    (Chen)
echo  Tech 4  : sf004@jingxin.tw    (Huang)
echo  Pass    : admin1234   (all accounts)
echo.
echo  Demo    : /demo/pwa   (phone-frame preview)
echo  Reviews : /reviews    (admin leaderboard)
echo.
echo  Press Ctrl+C to stop the server.
echo ============================================
echo.

REM Open browser after a short delay so dev server has time to bind the port
start "" cmd /c "timeout /t 6 /nobreak >nul && start http://localhost:3000"

call npm run dev

endlocal
