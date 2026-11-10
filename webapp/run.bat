@echo off
setlocal
cd /d "%~dp0"
title 1S Sales Voucher Web App

python start.py
if %ERRORLEVEL% NEQ 0 (
    echo.
    echo [LOI] Khong the khoi chay start.py! Vui long kiem tra Python.
    pause
)