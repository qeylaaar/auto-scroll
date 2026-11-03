@echo off
setlocal
cd /d %~dp0

echo Membangun ulang dashboard ^(pakai ini setelah mengubah warna/logo/tampilan^)...
echo.

pushd frontend
call npm run build
popd

echo.
echo Selesai. Jalankan start-dashboard.bat seperti biasa untuk memakai dashboard.
pause
