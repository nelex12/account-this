AccountThis — Руководство по разработке
Стек: React (Vite, TypeScript) + ASP.NET Core 8 + PostgreSQL + Nginx + Docker.

Быстрый старт (Первичная настройка)
Клонируйте репозиторий:
git clone <URL_РЕПОЗИТОРИЯ>
cd account-this

Установите зависимости фронтенда (выполняется 1 раз):
Запустите файл install-frontend.bat (или выполните "cd frontend" и "npm install").

Сценарии работы
Вариант А: Разработка фронтенда (Dev-режим)
Используется для работы над UI. Изменения в React-коде отображаются в браузере мгновенно без пересборки Docker.

Запустите файл dev-frontend.bat (скрипт поднимет Postgres и Backend в Docker, а затем запустит локальный Vite-сервер).

Откройте в браузере: http://localhost:5173

Все запросы к /api/* автоматически проксируются на бэкенд (http://localhost:5000).

Вариант Б: Разработка бэкенда (C# / .NET)
Запустите PostgreSQL через Docker:
docker compose up postgres -d

Откройте решение backend/AccountThis.Api.sln в Visual Studio или Rider.

Запустите проект через IDE.

Swagger UI будет доступен по адресу: http://localhost:5000/swagger

Вариант В: Полная сборка и проверка всего стека
Используется для проверки интеграции перед коммитом или деплоем.

Запустите файл start-all.bat (или docker compose up -d --build).

Откройте в браузере: http://localhost (через Nginx).

Остановка сервисов
Чтобы остановить все работающие контейнеры, запустите stop-all.bat (или docker compose down).

Структура проекта
backend/ — Исходный код API на ASP.NET Core и Dapper.

frontend/ — Исходный код UI на React, Vite и TypeScript.

nginx/ — Конфигурация Nginx для продакшен-сборки.

docker-compose.yml — Описание контейнеров приложения.

*.bat — Скрипты быстрой автоматизации для Windows.