# AccountThis — руководство по разработке

Стек: React (Vite, TypeScript) + ASP.NET Core 8 + PostgreSQL 16 + RabbitMQ 4 + Nginx + Docker.

## Первичная настройка (один раз)

1. Клонируйте репозиторий:
   ```
   git clone <URL_РЕПОЗИТОРИЯ>
   cd account-this
   ```
2. Установите зависимости фронтенда: `install-frontend.bat` (или `cd frontend` и `npm install`).
3. Создайте файл `.env`: скопируйте `env.example` в `.env` и поменяйте значения на свои.
   Ключи `SERVER_SIGNING_KEY` и `JWT_SIGNING_KEY` сгенерируйте запуском `generate-keys.bat` и вставьте
   выведенные строки в `.env`. Ключи генерируются один раз на окружение.

## Настройки и секреты

Все настройки и секреты лежат в одном файле — `.env` в корне репозитория (в git не попадает):

- **Docker** (`docker compose`, все `.bat`-скрипты) читает `.env` сам и передаёт переменные в контейнеры.
- **Backend и Worker из IDE** (вариант Б) в режиме Development находят `.env` в корне репозитория и читают его сами.
  Переменные окружения, заданные явно, важнее значений из `.env`.

Строку подключения к базе backend собирает из `POSTGRES_USER`, `POSTGRES_PASSWORD`, `POSTGRES_DB`
и адреса базы: из IDE — `localhost:POSTGRES_PORT`, в Docker — `postgres:5432` (задаёт `docker-compose.yml`).
Отдельно строку подключения указывать не нужно. К RabbitMQ — так же: `RABBITMQ_USER`, `RABBITMQ_PASSWORD`
и адрес из IDE `localhost:RABBITMQ_PORT`, в Docker — `rabbitmq:5672`.

## Сценарии работы

### Вариант А: разработка фронтенда

Для работы над UI: изменения в React-коде видны в браузере сразу, без пересборки Docker.

1. Запустите `dev-frontend.bat`: он поднимет Postgres, RabbitMQ, Backend и Worker в Docker и запустит локальный Vite-сервер.
2. Откройте http://localhost:5173

Запросы к `/api/*` Vite проксирует на backend (http://localhost:5000).

### Вариант Б: разработка бэкенда (C# / .NET)

1. Запустите базу и брокер: `start-db.bat` (или `docker compose up postgres rabbitmq -d`).
   Веб-интерфейс RabbitMQ: http://localhost:15672 (логин и пароль — `RABBITMQ_USER` / `RABBITMQ_PASSWORD`).
2. Откройте решение `backend/AccountThis.Api/AccountThis.Api.slnx` в Visual Studio 2022 (17.13+) или Rider
   (либо `dotnet run --project backend/AccountThis.Api`).
3. Запустите два проекта: `AccountThis.Api` и `AccountThis.Worker` (Visual Studio: «Настроить запускаемые проекты» →
   «Несколько запускаемых проектов»). Swagger UI откроется по адресу http://localhost:5000/swagger.
   Без Worker API работает, но журнал аудита и уведомления не пополняются: события ждут в очередях RabbitMQ.

Backend из IDE слушает тот же порт 5000, что и backend в Docker, поэтому одновременно их не запускайте
(`start-db.bat` поднимает только базу и брокер). Чтобы работать с фронтендом поверх backend из IDE,
после шагов 1–3 запустите `npm run dev` в папке `frontend`.

### Вариант В: полная сборка всего стека

Для проверки интеграции перед коммитом или деплоем.

1. Запустите `start-all.bat` (или `docker compose up -d --build`).
2. Откройте http://localhost (через Nginx). Swagger: http://localhost:5000/swagger (если `ENABLE_SWAGGER=true`).

Nginx слушает только HTTP (порт 80). Браузер считает безопасным лишь `localhost`, поэтому с телефона
по `http://<IP-адрес>` не заработают вход (cookie `refresh_token` с атрибутом `Secure`), камера, WebCrypto
и service worker. Для доступа с других устройств перед nginx нужен HTTPS.

### Остановка и сброс

- `stop-all.bat` — остановить всё, что относится к проекту: контейнеры Docker (`docker compose down`),
  Vite dev-сервер (порты 5173–5175), backend, запущенный из IDE или `dotnet run` (порт 5000), и `AccountThis.Worker`.
  Завершаются только процессы `node` / `dotnet` / `AccountThis.Api` на этих портах и процесс `AccountThis.Worker`,
  другие программы не трогаются.
- `reset-db.bat` (или `docker compose down -v`) — остановить контейнеры и **удалить данные базы**.
  Следующий запуск создаст базу заново. После изменения схемы сбрасывать базу не нужно (см. «Миграции»).

### Миграции базы данных

Схема задаётся файлами `backend/AccountThis.Api/Migrations/NNNN_описание.sql`. При старте backend сам применяет
по порядку те, что ещё не применены (список применённых — в таблице `schema_migrations`), каждый в своей транзакции.
Данные при этом сохраняются.

- Изменить схему: добавить файл со следующим номером, например `0003_add_tool_serial.sql`. Уже применённые файлы
  не редактировать — у тех, кто их применил, изменение не появится.
- База, созданная до появления миграций (старым `init.sql`), не запустится с понятной ошибкой:
  её нужно один раз пересоздать через `reset-db.bat`.

### Тесты backend

Нужен запущенный Docker Desktop: интеграционные тесты сами поднимают PostgreSQL и RabbitMQ в контейнерах (Testcontainers).
В Visual Studio — «Обозреватель тестов», из консоли:

```
dotnet test backend/AccountThis.Api/AccountThis.Api.slnx
```

## Структура проекта

- `api.yaml` — спецификация API (OpenAPI); подробная логика — в документе
  «Описание проекта подробно, используемое в разработке.docx» (оба файла — в корне репозитория).
- `backend/AccountThis.Api/` — API на ASP.NET Core; к PostgreSQL обращается напрямую через Npgsql (без ORM).
- `backend/AccountThis.Api/Migrations/` — схема базы данных (миграции).
- `backend/AccountThis.Worker/` — отдельный процесс-потребитель событий RabbitMQ: журнал аудита и уведомления Owner.
- `backend/AccountThis.Shared/` — общее для API и Worker: контракт событий, топология RabbitMQ, чтение `.env`.
- `backend/AccountThis.Api.Tests/` — unit- и интеграционные тесты (см. «Тесты backend»).
- `docs/events.md` — события RabbitMQ: outbox, очереди, потребители.
- `docs/architecture/` — схемы архитектуры (C4).
- `frontend/` — UI на React, Vite и TypeScript; там же `nginx.conf` и `Dockerfile` для продакшен-сборки
  (Nginx раздаёт собранный фронтенд и проксирует `/api/` на backend).
- `docker-compose.yml` — описание контейнеров: `postgres`, `rabbitmq`, `backend`, `worker`, `nginx`.
- `env.example` — шаблон файла `.env`.
- `*.bat` — скрипты быстрой автоматизации для Windows.

### Структура frontend

Основные файлы для работы (90% времени):

- `frontend/src/` — главная рабочая директория.
  - `src/app/` — точка входа `main.tsx`, глобальные стили `index.css`, провайдеры (`providers/`: авторизация, тема)
    и роутинг (`router/`: маршруты, layout для телефона и компьютера, проверка роли).
  - `src/api/` — запросы к бэкенду (`fetch`): `http.ts` подставляет JWT и обновляет сессию при 401.
  - `src/pages/` — страницы приложения (вход и регистрация, обзор по ролям, инструменты, журнал, пользователи, сканер и операция, профиль).
  - `src/entities/` — модели данных страниц, `src/shared/` — общие UI-компоненты и навигация, `src/mock/` — временные данные.
- `frontend/public/` — статика, которая отдаётся «как есть» (иконка сайта favicon.svg, логотипы, SVG-спрайты).

Конфигурационные файлы (правятся редко):

- `frontend/package.json` — список библиотек (dependencies) и npm-скриптов (`npm run dev`, `npm run build`).
- `frontend/vite.config.ts` — конфиг сборщика Vite (проксирование API, порты dev-сервера, алиасы путей вроде `@/components`).
- `frontend/index.html` — HTML-шаблон (заголовок `<title>`, подключение внешних шрифтов).
- `frontend/tsconfig.json` (`tsconfig.app.json`, `tsconfig.node.json`) — настройки TypeScript.
