@echo off
chcp 65001 > nul
echo Запуск PostgreSQL и RabbitMQ в Docker (без backend и nginx)...
docker compose up postgres rabbitmq -d
echo.
echo ===================================================
echo База запущена: localhost, порт POSTGRES_PORT из .env (по умолчанию 5432).
echo RabbitMQ: localhost, порт RABBITMQ_PORT (по умолчанию 5672), веб-интерфейс http://localhost:15672
echo Теперь запустите из IDE backend\AccountThis.Api\AccountThis.Api.slnx два проекта: AccountThis.Api и AccountThis.Worker
echo (Visual Studio: Настроить запускаемые проекты - Несколько запускаемых проектов)
echo Swagger API: http://localhost:5000/swagger
echo ===================================================
pause
