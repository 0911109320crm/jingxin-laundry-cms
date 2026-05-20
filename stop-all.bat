@echo off
setlocal
title Jingxin Laundry CMS - Stop

echo Stopping Jingxin Laundry CMS dev server...
echo.

REM Kill any process listening on Next.js dev ports (3000 + fallback range)
REM AND any node.exe whose command line contains "next" (catches orphans)
powershell -NoProfile -ExecutionPolicy Bypass -Command "& { $killed = 0; Get-NetTCPConnection -LocalPort 3000,3001,3002,3003,3004,3005 -State Listen -ErrorAction SilentlyContinue | ForEach-Object { Write-Host ('  Killing PID ' + $_.OwningProcess + ' on port ' + $_.LocalPort); try { Stop-Process -Id $_.OwningProcess -Force -ErrorAction Stop; $script:killed++ } catch {} }; Get-CimInstance Win32_Process | Where-Object { $_.Name -eq 'node.exe' -and $_.CommandLine -match 'next' } | ForEach-Object { Write-Host ('  Killing orphan node PID ' + $_.ProcessId); try { Stop-Process -Id $_.ProcessId -Force -ErrorAction Stop; $script:killed++ } catch {} }; if ($killed -eq 0) { Write-Host '  No dev server found running.' } else { Write-Host ('  Stopped ' + $killed + ' process(es).') } }"

REM Close any leftover dev cmd window by title as a final fallback
taskkill /F /FI "WindowTitle eq Jingxin Laundry CMS - Dev*" >nul 2>&1

echo.
echo Done.
timeout /t 2 /nobreak >nul
endlocal
