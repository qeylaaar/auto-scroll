@echo off
setlocal enabledelayedexpansion
cd /d %~dp0

echo ============================================
echo   Google Maps Scraper Dashboard
echo ============================================
echo.

rem ---- Cek & auto-switch versi Node.js ----
rem Node v24 diketahui menyebabkan better-sqlite3 gagal install (belum ada
rem prebuilt binary). Project ini dipin ke Node 22.x lewat file .nvmrc.
rem Kalau nvm-windows sudah terpasang, alihkan otomatis. Kalau belum, beri
rem instruksi jelas lalu berhenti (lebih baik daripada lanjut dan gagal
rem dengan error yang membingungkan di tengah proses).
for /f "tokens=*" %%v in ('node -v 2^>nul') do set NODE_VER=%%v
set "NODE_VER_CLEAN=%NODE_VER:v=%"
for /f "tokens=1 delims=." %%a in ("%NODE_VER_CLEAN%") do set NODE_MAJOR=%%a

if "%NODE_MAJOR%"=="" (
  echo Node.js tidak ditemukan. Silakan install Node.js versi 22 dari https://nodejs.org/ terlebih dahulu.
  pause
  exit /b 1
)

set "NODE_OK=0"
if "%NODE_MAJOR%"=="18" set "NODE_OK=1"
if "%NODE_MAJOR%"=="20" set "NODE_OK=1"
if "%NODE_MAJOR%"=="22" set "NODE_OK=1"

if "%NODE_OK%"=="0" (
  echo Node.js Anda saat ini versi %NODE_VER% ^(kurang cocok, disarankan versi 22.x^).
  where nvm >nul 2>nul
  if !errorlevel! equ 0 (
    echo Ditemukan nvm-windows di komputer ini, beralih otomatis ke Node 22.11.0...
    call nvm install 22.11.0
    call nvm use 22.11.0
    echo.
    echo Berhasil beralih. Melanjutkan...
    echo.
  ) else (
    echo.
    echo nvm-windows belum terinstall, jadi versi Node tidak bisa dialihkan otomatis.
    echo Langkah yang perlu dilakukan sekali ini saja:
    echo   1. Install nvm-windows dari: https://github.com/coreybutler/nvm-windows/releases
    echo   2. Buka CMD baru, jalankan: nvm install 22.11.0
    echo   3. Jalankan: nvm use 22.11.0
    echo   4. Jalankan start-dashboard.bat ini lagi
    echo.
    pause
    exit /b 1
  )
) else (
  echo Node.js versi %NODE_VER% terdeteksi, kompatibel.
)
echo.

if not exist node_modules (
  echo [1/3] Menginstall dependencies backend, mohon tunggu ^(hanya sekali di awal^)...
  call npm install
  if errorlevel 1 (
    echo.
    echo Install gagal. Lihat pesan error di atas.
    pause
    exit /b 1
  )
) else (
  echo [1/3] Dependencies backend sudah terinstall, lanjut.
)

if not exist frontend\node_modules (
  echo [2/3] Menginstall dependencies frontend, mohon tunggu ^(hanya sekali di awal^)...
  pushd frontend
  call npm install
  if errorlevel 1 (
    popd
    echo.
    echo Install frontend gagal. Lihat pesan error di atas.
    pause
    exit /b 1
  )
  popd
) else (
  echo [2/3] Dependencies frontend sudah terinstall, lanjut.
)

if not exist frontend\dist (
  echo [3/3] Build dashboard ^(hanya perlu sekali, atau setelah Anda mengubah tampilan^)...
  pushd frontend
  call npm run build
  if errorlevel 1 (
    popd
    echo.
    echo Build gagal. Lihat pesan error di atas.
    pause
    exit /b 1
  )
  popd
) else (
  echo [3/3] Dashboard sudah ter-build, lanjut.
)

echo.
echo Menjalankan server...
echo Dashboard akan terbuka otomatis di browser sebentar lagi.
echo JANGAN TUTUP jendela ini selama memakai dashboard.
echo Untuk berhenti: tutup jendela ini atau tekan Ctrl+C.
echo.

start "" http://localhost:4000

node backend\server.js

pause
