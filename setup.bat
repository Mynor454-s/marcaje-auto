@echo off
echo ============================================
echo   Setup - Marcaje Automatico
echo ============================================
echo.

where node >nul 2>nul
if %errorlevel% neq 0 (
    echo ERROR: Node.js no esta instalado.
    echo Descargalo de https://nodejs.org/
    pause
    exit /b 1
)

cd /d "%~dp0"

echo Instalando dependencias de Node.js...
call npm install

echo.
echo Instalando navegador Chromium para Playwright...
call npx playwright install chromium

echo.
echo ============================================
echo   Setup completado!
echo   Ejecuta marcaje.bat para marcar
echo ============================================
pause
