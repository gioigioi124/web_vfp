@echo off
cd /d "%~dp0"
title 1S Frontend SPA (Vite)
echo [1S Frontend] Dang khoi dong Vite dev server tren cong 5173...
call npm.cmd run dev
if %ERRORLEVEL% NEQ 0 (
    echo.
    echo [LOI] Frontend gap su co khi khoi dong.
    pause
)