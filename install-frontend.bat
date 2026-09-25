chcp 65001 > nul
echo Установка зависимостей фронтенда...
cd frontend
call npm install
echo.
echo Установка завершена! Теперь можно запускать dev-frontend.bat
pause