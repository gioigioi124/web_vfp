@echo off
setlocal
cd /d "%~dp0"
start "" pythonw.exe "%~dp0tray_app.pyw"
exit /b 0
