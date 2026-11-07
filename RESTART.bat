@echo off
chcp 65001 >nul
cd /d "%~dp0"
echo Перезапуск кабинета. Перед запуском сохраните изменения в редакторе.
node stop.mjs
if errorlevel 1 (
 pause
 exit /b 1
)
call START.bat
