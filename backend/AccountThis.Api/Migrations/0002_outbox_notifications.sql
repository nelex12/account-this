CREATE TABLE outbox_events (
    id           BIGSERIAL PRIMARY KEY,       -- порядок отправки
    event_id     UUID NOT NULL UNIQUE,
    type         VARCHAR(64) NOT NULL,        -- тип = routing key
    company_id   UUID NOT NULL,
    actor_id     UUID NOT NULL,
    occurred_at  BIGINT NOT NULL,             -- Unix time изменения (время сервера)
    data         JSONB NOT NULL               -- поля события, свои у каждого типа (docs/events.md)
);

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
