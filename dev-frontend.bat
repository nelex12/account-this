chcp 65001 > nul
echo [1/2] Запуск Postgres, RabbitMQ, Backend и Worker в Docker...
docker compose up postgres backend worker -d --build

echo.
echo [2/2] Запуск Vite dev-сервера для фронтенда...
cd frontend
npm run dev