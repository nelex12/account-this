-- ---------- OUTBOX: надёжная отправка событий в RabbitMQ ----------
-- Событие пишется сюда в той же транзакции, что и само изменение (transactional outbox): либо сохранено и то и другое,
-- либо ничего. Отправку в RabbitMQ выполняет фоновый OutboxDispatcher в API: читает записи по порядку id,
-- отправляет с publisher confirms и удаляет отправленные. Сбой между COMMIT и отправкой событие больше не теряет:
-- запись остаётся здесь до следующей попытки. Повторная отправка возможна (сбой между подтверждением брокера и DELETE),
-- поэтому потребители обрабатывают событие с тем же event_id один раз.
-- Сервис после INSERT выполняет NOTIFY outbox_events: PostgreSQL доставляет его только после COMMIT,
-- и диспетчер (LISTEN outbox_events) отправляет событие сразу, а не по таймеру.
-- Этим уточняется комментарий к audit_events в 0001_init: API пишет события в outbox, а не в RabbitMQ напрямую.

CREATE TABLE outbox_events (
    id           BIGSERIAL PRIMARY KEY,       -- порядок отправки
    event_id     UUID NOT NULL UNIQUE,
    type         VARCHAR(64) NOT NULL,        -- тип = routing key
    company_id   UUID NOT NULL,
    actor_id     UUID NOT NULL,
    occurred_at  BIGINT NOT NULL,             -- Unix time изменения (время сервера)
    data         JSONB NOT NULL               -- поля события, свои у каждого типа (docs/events.md)
);

-- ---------- УВЕДОМЛЕНИЯ OWNER ----------
-- Заполняет потребитель очереди notifications (AccountThis.Worker) по событиям из RabbitMQ, читает API
-- (GET /api/notifications). Уведомление — то, что требует внимания Owner:
-- - EmployeeAwaitingApproval — зарегистрировался сотрудник или завхоз, ждёт подтверждения (user_id — он).
--   Подтверждение или увольнение этого пользователя помечает уведомление прочитанным;
-- - SessionReuseDetected — повторно предъявлен погашенный refresh token, возможна кража сессии (user_id — владелец сессии);
-- - SuspiciousSync — синхронизация завхоза сохранила записи с флагами, отличными от VALID (user_id — завхоз,
--   flags — число таких записей по флагам).
-- Одно событие — не более одного уведомления: event_id уникален, вставка с ON CONFLICT (event_id) DO NOTHING.
-- Внешних ключей нет, как у audit_events: потребитель принимает событие как есть. Изоляция компаний — company_id
-- в каждом запросе API; имя пользователя API берёт из users с той же компанией.

CREATE TYPE notification_type AS ENUM ('EmployeeAwaitingApproval', 'SessionReuseDetected', 'SuspiciousSync');

CREATE TABLE notifications (
    id           BIGSERIAL PRIMARY KEY,
    event_id     UUID NOT NULL UNIQUE,        -- событие, породившее уведомление
    company_id   UUID NOT NULL,
    type         notification_type NOT NULL,
    user_id      UUID NOT NULL,               -- пользователь, о котором уведомление
    flags        JSONB,                       -- только SuspiciousSync: {"INVALID_WORKER_SIG": 1, "TIME_DRIFT": 2}
    occurred_at  BIGINT NOT NULL,             -- Unix time события
    read_at      BIGINT,                      -- NULL — не прочитано
    CHECK ((type = 'SuspiciousSync') = (flags IS NOT NULL))
);

CREATE INDEX idx_notifications_company_time ON notifications (company_id, occurred_at DESC, id DESC);
