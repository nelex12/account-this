# AccountThis — руководство по разработке

Стек: React (Vite, TypeScript) + ASP.NET Core 8 + PostgreSQL 16 + Nginx + Docker.

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
- **Backend из IDE** (вариант Б) в режиме Development находит `.env` в корне репозитория и читает его сам.
  Переменные окружения, заданные явно, важнее значений из `.env`.

Строку подключения к базе backend собирает из `POSTGRES_USER`, `POSTGRES_PASSWORD`, `POSTGRES_DB`
и адреса базы: из IDE — `localhost:POSTGRES_PORT`, в Docker — `postgres:5432` (задаёт `docker-compose.yml`).
Отдельно строку подключения указывать не нужно.

## Сценарии работы

### Вариант А: разработка фронтенда

Для работы над UI: изменения в React-коде видны в браузере сразу, без пересборки Docker.

1. Запустите `dev-frontend.bat`: он поднимет Postgres и Backend в Docker и запустит локальный Vite-сервер.
2. Откройте http://localhost:5173

Запросы к `/api/*` Vite проксирует на backend (http://localhost:5000).

### Вариант Б: разработка бэкенда (C# / .NET)

1. Запустите только базу: `start-db.bat` (или `docker compose up postgres -d`).
2. Откройте решение `backend/AccountThis.Api/AccountThis.Api.slnx` в Visual Studio 2022 (17.13+) или Rider
   (либо `dotnet run --project backend/AccountThis.Api`).
3. Запустите проект профилем `AccountThis.Api`. Swagger UI откроется по адресу http://localhost:5000/swagger

Backend из IDE слушает тот же порт 5000, что и backend в Docker, поэтому одновременно их не запускайте
(`start-db.bat` поднимает только базу). Чтобы работать с фронтендом поверх backend из IDE,
после шагов 1–3 запустите `npm run dev` в папке `frontend`.

### Вариант В: полная сборка всего стека

Для проверки интеграции перед коммитом или деплоем.

1. Запустите `start-all.bat` (или `docker compose up -d --build`).
2. Откройте http://localhost (через Nginx). Swagger: http://localhost:5000/swagger (если `ENABLE_SWAGGER=true`).

### Остановка и сброс

- `stop-all.bat` — остановить всё, что относится к проекту: контейнеры Docker (`docker compose down`),
  Vite dev-сервер (порты 5173–5175) и backend, запущенный из IDE или `dotnet run` (порт 5000).
  Завершаются только процессы `node` / `dotnet` / `AccountThis.Api` на этих портах, другие программы не трогаются.
- `reset-db.bat` (или `docker compose down -v`) — остановить контейнеры и **удалить данные базы**.
  Схема `database/init.sql` применяется только при создании пустой базы, поэтому после её изменения
  базу нужно сбросить. Следующий запуск создаст базу заново.

## Структура проекта

- `backend/AccountThis.Api/` — API на ASP.NET Core; к PostgreSQL обращается напрямую через Npgsql (без ORM).
  - `api.yaml` — спецификация API (OpenAPI); подробная логика — в документе
    «Описание проекта подробно, используемое в разработке.docx» рядом.
- `database/init.sql` — схема базы данных.
- `frontend/` — UI на React, Vite и TypeScript; там же `nginx.conf` и `Dockerfile` для продакшен-сборки
  (Nginx раздаёт собранный фронтенд и проксирует `/api/` на backend).
- `docker-compose.yml` — описание контейнеров: `postgres`, `backend`, `nginx`.
- `env.example` — шаблон файла `.env`.
- `*.bat` — скрипты быстрой автоматизации для Windows.

### Структура frontend

Основные файлы для работы (90% времени):

- `frontend/src/` — главная рабочая директория.
  - `src/components/` (создаётся по ходу) — UI-компоненты (кнопки, формы, таблицы, модалки).
  - `src/pages/` или `src/views/` (создаётся по ходу) — страницы приложения (Авторизация, Дашборд, Профиль).
  - `src/api/` или `src/services/` (создаётся по ходу) — запросы к бэкенду (Axios / fetch).
  - `src/App.tsx` — главный корневой компонент приложения.
  - `src/main.tsx` — точка входа React (подключение провайдеров, роутинга, стилей).
  - `src/index.css` / `src/App.css` — глобальные CSS/Tailwind стили.
- `frontend/public/` — статика, которая отдаётся «как есть» (иконка сайта favicon.svg, логотипы, SVG-спрайты).

Конфигурационные файлы (правятся редко):

- `frontend/package.json` — список библиотек (dependencies) и npm-скриптов (`npm run dev`, `npm run build`).
- `frontend/vite.config.ts` — конфиг сборщика Vite (проксирование API, порты dev-сервера, алиасы путей вроде `@/components`).
- `frontend/index.html` — HTML-шаблон (заголовок `<title>`, подключение внешних шрифтов).
- `frontend/tsconfig.json` (`tsconfig.app.json`, `tsconfig.node.json`) — настройки TypeScript.
