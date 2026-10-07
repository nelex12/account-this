# AccountThis

Система учёта и выдачи инструментов: ASP.NET Core 8 Web API + PostgreSQL 16 (Npgsql напрямую, без ORM),
офлайн-протокол QR с подписями Ed25519. Учебный проект: backend пишет пользователь, Claude помогает и проверяет.

## Источники истины
- `api.yaml` — контракт API (статусы, тела, ошибки, форматы). При расхождении кода и `api.yaml` прав `api.yaml`.
  Файл большой: читать нужный путь/схему по `grep -n` и диапазону строк, а не целиком.
- `database/init.sql` — схема БД с комментариями про ограничения и изоляцию компаний.
- Комментарии в заглушках сервисов (`throw new NotImplementedException()`) описывают задуманный алгоритм.
- `frontend/` пока пуст — не читать. `.env` не читать (секреты), шаблон — `env.example`.

## Структура backend
`backend/AccountThis.Api/`: `Controllers/` (готовы, маппят статусы сервисов в HTTP) → `Services/` (бизнес-логика, SQL)
→ `Security/` (хеш паролей, JWT, Ed25519). Модели запросов/ответов — `Models/`, перечисления — `Enums.cs`.
Сервисы возвращают enum-статусы (`RegisterStatus`, `LoginStatus`...), а не бросают исключения на бизнес-ошибки.

`backend/AccountThis.Api.Tests/`: `Security/` — unit-тесты, `Api/` — интеграционные через `ApiFactory`
(всё приложение + PostgreSQL в Testcontainers, нужен запущенный Docker).

## Команды (пользователь работает в Visual Studio — тесты через Обозреватель тестов)
```
dotnet test backend/AccountThis.Api/AccountThis.Api.slnx
dotnet test backend/AccountThis.Api/AccountThis.Api.slnx --filter "FullyQualifiedName~Security"
```

## Как работаем (режим обучения)
- Общение только на русском. Ответы краткие, развёрнуто — только объяснения.
- **Реализацию в `AccountThis.Api` пишет пользователь, NuGet-пакеты ставит тоже он.** Claude не пишет её за него без явной просьбы:
  объясняет, даёт направление и подсказки, показывает нужное API библиотеки, отвечает на вопросы.
- **Тесты пишет Claude** — по `api.yaml`, до реализации. Тест проверяет контракт, а не устройство кода.
  Если тест противоречит `api.yaml` или явно неудобен, это обсуждается, а не обходится.
- **Ревью**: когда пользователь просит проверить, сначала прогнать тесты, затем ревью кода:
  соответствие `api.yaml`, безопасность (SQL-инъекции, изоляция по company_id, утечки статуса аккаунта),
  обработка ошибок Npgsql, async/CancellationToken, освобождение соединений. Объяснять *почему*, а не только *что*.
- Одна сессия — один блок работы. Прогресс виден по красным тестам и оставшимся `NotImplementedException`.

## Порядок блоков
Каждый следующий зависит от предыдущих.
1. `Security/` — `PasswordHasher`, `JwtTokenService`, `SignatureService` (тесты в `Tests/Security/`).
2. Middleware в `Program.cs`: JWT Bearer, роли, 401/403 по `api.yaml` (тесты `Api/AuthenticationPipelineTests`).
3. `AuthService`: register, login, server-key, worker-cert.
4. `CompaniesService`, `UsersService`.
5. `ToolsService`.
6. `QrPayloadParser` + `SyncService` (sync, logs).
