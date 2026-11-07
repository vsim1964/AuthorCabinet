@echo off
chcp 65001 >nul
cd /d "%~dp0"
where node >nul 2>nul
if errorlevel 1 (
 echo Не найден Node.js. Установите Node.js и запустите этот файл снова.
 pause
 exit /b 1
)
node -e "if(Number(process.versions.node.split('.')[0])<22){console.error('Нужен Node.js 22 или новее. Текущая версия: '+process.version);process.exit(1)}"
if errorlevel 1 (
 pause
 exit /b 1
)
set "AUTHOR_NEED_INSTALL="
if not exist "node_modules\sql.js\dist\sql-wasm.wasm" set "AUTHOR_NEED_INSTALL=1"
node -e "try {require.resolve('docx/html');require.resolve('htmlparser2')} catch {process.exit(1)}"
if errorlevel 1 set "AUTHOR_NEED_INSTALL=1"
if defined AUTHOR_NEED_INSTALL (
 echo Восстановление зависимостей. Для этого шага нужен интернет.
 call npm ci --omit=dev --no-audit --no-fund
 if errorlevel 1 (
  echo Не удалось установить зависимости.
  pause
  exit /b 1
 )
)
node server.mjs
if errorlevel 1 pause
