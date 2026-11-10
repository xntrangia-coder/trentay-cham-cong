@echo off
chcp 65001 >nul
rem Mo TRENTAY Cham Cong tren may nay trong mot cua so rieng (pywebview), khung dien thoai.
rem May chu thu (CSDL tren may, co du lieu mau) chay o cong 8811; chua chay thi tu bat.
cd /d "%~dp0"
powershell -NoProfile -Command "try{(Invoke-WebRequest -UseBasicParsing http://127.0.0.1:8811/api/cau-hinh -TimeoutSec 2)|Out-Null;exit 0}catch{exit 1}"
if errorlevel 1 (
  echo Dang bat may chu thu...
  start "TRENTAY Cham Cong - may chu" /min cmd /c "npx wrangler pages dev --port 8811 --binding CC_THU=1"
  powershell -NoProfile -Command "for($i=0;$i -lt 60;$i++){try{(Invoke-WebRequest -UseBasicParsing http://127.0.0.1:8811/api/cau-hinh -TimeoutSec 2)|Out-Null;exit 0}catch{Start-Sleep 1}};exit 1"
)
start "" pythonw "%~dp0cua-so.py"
