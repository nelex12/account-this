# AccountThis

Система учёта и выдачи инструментов: ASP.NET Core 8 Web API + PostgreSQL 16 (Npgsql напрямую, без ORM),
офлайн-протокол QR с подписями Ed25519, сессии access JWT (15 мин) + refresh token в HttpOnly cookie,
RabbitMQ (RabbitMQ.Client напрямую) для журнала аудита. Учебный проект, backend реализован полностью (все блоки 1–7).

## Источники истины
- `api.yaml` — контракт API (статусы, тела, ошибки, форматы). При расхождении кода и `api.yaml` прав `api.yaml`.
  Файл большой: читать нужный путь/схему по `grep -n` и диапазону строк, а не целиком.
- `backend/AccountThis.Api/Migrations/*.sql` — схема БД (миграции, применяются по порядку при старте backend) с комментариями про ограничения и изоляцию компаний. Применённый файл не меняется: изменение схемы — новый файл со следующим номером.
- `docs/events.md` — контракт событий RabbitMQ (exchange, очереди, формат сообщений, поведение издателя и потребителя).
- Комментарии в заглушках сервисов (`throw new NotImplementedException()`) описывают задуманный алгоритм.
- `frontend/` пока пуст — не читать. `.env` не читать (секреты), шаблон — `env.example`.

## Структура backend
`backend/AccountThis.Api/`: `Controllers/` (готовы, маппят статусы сервисов в HTTP) → `Services/` (бизнес-логика, SQL)
→ `Security/` (хеш паролей, JWT, Ed25519). Модели запросов/ответов — `Models/`, перечисления — `Enums.cs`.
Сервисы возвращают enum-статусы (`RegisterStatus`, `LoginStatus`...), а не бросают исключения на бизнес-ошибки.

`backend/AccountThis.Api.Tests/`: `Security/` — unit-тесты, `Api/` — интеграционные через `ApiFactory`
(всё приложение + PostgreSQL и RabbitMQ в Testcontainers, нужен запущенный Docker).
Refresh token в тестах передаётся вручную: клиент `factory.CookieClient()`, хелперы в `Infrastructure/AuthRequests.cs`.

## Команды (пользователь работает в Visual Studio — тесты через Обозреватель тестов)
```
dotnet test backend/AccountThis.Api/AccountThis.Api.slnx
dotnet test backend/AccountThis.Api/AccountThis.Api.slnx --filter "FullyQualifiedName~Security"
```

## Как работаем
- Общение только на русском. Ответы краткие, развёрнуто — только объяснения.
- Режим обучения завершён: Claude пишет реализацию backend и тесты сам. Тесты — по `api.yaml`, проверяют контракт, а не устройство кода.
- Перед изменением — прогнать тесты; после — снова. Ревью: соответствие `api.yaml`, безопасность (SQL-инъекции,
  изоляция по company_id, утечки статуса аккаунта), обработка ошибок Npgsql, async/CancellationToken, освобождение соединений.
- Не ломать контракт, на который опирается фронтенд (`frontend/src/api/*`): менять `api.yaml` только осознанно.

## Устройство backend (кратко)
- `Security/` — Argon2id-хеш паролей, JWT (HS256, 15 мин), Ed25519 (`SignatureService`).
- `Services/` — бизнес-логика на Npgsql; изоляция компаний — `company_id` из JWT в каждом WHERE.
  `QrFormat.cs` — строгий разбор строки QR AT1; `SyncService` — флаги ValidationFlag, идемпотентность, журнал.
- `Events/` — аудит через RabbitMQ: `RabbitMqEventPublisher` (очередь в памяти + фоновая отправка с publisher confirms,
  HTTP не ждёт брокера), `AuditConsumer` (очередь `audit` → `audit_events`, ack после записи, отказы → `audit.dead`).
  Сервисы вызывают `IEventPublisher.Publish` только после COMMIT и только при реальном изменении состояния.

## Исключение и разделение ролей
Если сейчас ты общаешься с разработчиком фронтенда, то текущие инструкции тебя не касаются. Старайся работать локально в папке frontend, выходя из неё только по необходимости.
Данный файл ведёт backend-разработчик.