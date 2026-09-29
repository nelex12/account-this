@echo off
chcp 65001 > nul
echo Запуск PostgreSQL в Docker (без backend и nginx)...
docker compose up postgres -d
echo.
echo ===================================================
echo База запущена: localhost, порт POSTGRES_PORT из .env (по умолчанию 5432).
echo Теперь запустите backend из IDE: backend\AccountThis.Api\AccountThis.Api.slnx
echo Swagger API: http://localhost:5000/swagger
echo ===================================================
pause
