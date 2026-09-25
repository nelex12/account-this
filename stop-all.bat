chcp 65001 > nul
echo Остановка всех контейнеров Docker...
docker compose down
echo Готово!
pause