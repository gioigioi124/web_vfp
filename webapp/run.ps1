Write-Host "===================================================================" -ForegroundColor Cyan
Write-Host "  1S SALES VOUCHER WEB APPLICATION (GIAI DOAN 1: READ-ONLY)" -ForegroundColor Cyan
Write-Host "===================================================================" -ForegroundColor Cyan
Write-Host ""

$baseDir = $PSScriptRoot

Write-Host "[1/2] Dang khoi dong Backend FastAPI..." -ForegroundColor Green
Start-Process powershell -ArgumentList "-NoExit", "-Command", "cd '$baseDir\backend'; python -m uvicorn app.main:app --host 0.0.0.0 --port 8000 --reload"

Write-Host "[2/2] Dang khoi dong Frontend React Vite..." -ForegroundColor Green
Start-Process powershell -ArgumentList "-NoExit", "-Command", "cd '$baseDir\frontend'; npm run dev"

Write-Host ""
Write-Host "Cho he thong khoi dong trong 3 giay..." -ForegroundColor Yellow
Start-Sleep -Seconds 3

Write-Host "Mo trinh duyet http://localhost:5173 ..." -ForegroundColor Cyan
Start-Process "http://localhost:5173"