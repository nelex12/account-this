chcp 65001 > nul
echo Запуск всего проекта в Docker...
docker compose up -d --build
echo.
echo ===================================================
echo Проект успешно запущен!
echo Сайт доступен по адресу: http://localhost
echo Swagger API: http://localhost:5000/swagger
echo ===================================================
pause