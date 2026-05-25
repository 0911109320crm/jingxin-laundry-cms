@echo off
REM Drag-and-drop launcher for clean_orders.py
REM Drop .xls / .xlsx files onto this bat to clean them.
chcp 65001 >nul
set PYTHONIOENCODING=utf-8
cd /d "%~dp0"

if "%~1"=="" (
    echo Usage: drag .xls or .xlsx files onto this bat.
    echo Or run: clean.bat file1.xls file2.xlsx ...
    pause
    exit /b 0
)

python "%~dp0clean_orders.py" %*
pause
