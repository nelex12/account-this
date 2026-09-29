@echo off
chcp 65001 > nul
echo [1/2] Остановка контейнеров Docker...
docker compose down

echo.
echo [2/2] Остановка локальных процессов проекта...
rem 5000 - backend из IDE / dotnet run; 5173-5175 - Vite dev-сервер (если 5173 занят, Vite берёт следующий порт).
rem Останавливаются только node / dotnet / AccountThis.Api на этих портах - другие программы не трогаются.
set "STOPPED="
for %%P in (5000 5173 5174 5175) do call :stop_port %%P
if not defined STOPPED echo   Локальных процессов проекта не найдено.

echo.
echo Готово!
pause
exit /b

:stop_port
for /f "tokens=5" %%I in ('netstat -ano ^| findstr /r /c:":%1 .*LISTENING"') do call :stop_pid %%I %1
exit /b

:stop_pid
set "NAME="
for /f "tokens=1 delims=," %%N in ('tasklist /FI "PID eq %1" /FO CSV /NH 2^>nul ^| findstr /i "\.exe"') do set "NAME=%%~N"
if not defined NAME exit /b
if /i "%NAME%"=="node.exe" goto kill
if /i "%NAME%"=="dotnet.exe" goto kill
if /i "%NAME%"=="AccountThis.Api.exe" goto kill
echo   Порт %2 занят программой %NAME% (PID %1) - не трогаю.
exit /b

:kill
rem /T - вместе с дочерними процессами
taskkill /PID %1 /T /F > nul 2>&1
if errorlevel 1 exit /b
echo   Остановлен %NAME% (PID %1, порт %2)
set "STOPPED=1"
exit /b
