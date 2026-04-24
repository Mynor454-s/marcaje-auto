@echo off
echo ============================================
echo   Marcaje Automatico - Portal RRHH
echo ============================================
echo.

:: Verificar que Node.js esta instalado
where node >nul 2>nul
if %errorlevel% neq 0 (
    echo ERROR: Node.js no esta instalado.
    echo Descargalo de https://nodejs.org/
    pause
    exit /b 1
)

:: Ir al directorio del script
cd /d "%~dp0"

:: Instalar dependencias si no existen
if not exist "node_modules" (
    echo Instalando dependencias...
    call npm install
    echo.
    echo Instalando navegador Chromium...
    call npx playwright install chromium
    echo.
)

:: Ejecutar marcaje
echo Ejecutando marcaje...
echo.
node index.js todo

echo.
echo ============================================
echo   Proceso finalizado
echo ============================================
pause
