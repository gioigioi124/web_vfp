@echo off
cd /d "%~dp0"
title 1S Backend API (FastAPI)
echo [1S Backend] Dang khoi dong FastAPI uvicorn tren cong 8000...
python -m uvicorn app.main:app --host 0.0.0.0 --port 8000 --reload
if %ERRORLEVEL% NEQ 0 (
    echo.
    echo [LOI] Backend gap su co khi khoi dong.
    pause
)