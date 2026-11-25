CREATE TYPE user_role AS ENUM ('Worker', 'Issuer', 'Owner');
CREATE TYPE tool_condition AS ENUM ('Good', 'Damaged', 'Broken');
CREATE TYPE rental_action AS ENUM ('TAKE', 'GIVE');

-- Первый сбой определяет флаг.
CREATE TYPE validation_flag AS ENUM (
    'VALID',
    'INVALID_SERVER_SIG',
    'INVALID_WORKER_SIG',
    'EXPIRED_TOKEN',
    'TIME_DRIFT',
    'UNKNOWN_WORKER',  -- Сотрудник вне реестра компании
    'WORKER_DEACTIVATED',  -- Уволен к моменту операции
    'UNKNOWN_TOOL',  -- Инструмент вне реестра компании
    'DUPLICATE'
);

CREATE TABLE companies (
    id      UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    name    VARCHAR(100) NOT NULL
);

CREATE TABLE users (
    id              UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    company_id      UUID NOT NULL REFERENCES companies(id),   -- компания не меняется
    full_name       VARCHAR(100) NOT NULL,   -- попадает в QR сотрудника (fio в token)
    phone           VARCHAR(12) NOT NULL UNIQUE CHECK (phone ~ '^\+7[0-9]{10}$'),
    password_hash   VARCHAR NOT NULL,
    role            user_role NOT NULL,

    is_approved     BOOLEAN NOT NULL DEFAULT FALSE,
    is_active       BOOLEAN NOT NULL DEFAULT TRUE,   -- FALSE = уволен; запись не удаляется

    deactivated_at  BIGINT,

    created_at      BIGINT NOT NULL DEFAULT floor(extract(epoch FROM now()))::BIGINT,   -- Unix time регистрации

    -- Уволен тогда и только тогда, когда известен момент увольнения
    CHECK (is_active = (deactivated_at IS NULL)),

    -- Составной ключ исключает ссылки между компаниями.
    UNIQUE (id, company_id)
);

CREATE INDEX idx_users_company ON users (company_id);

CREATE TABLE refresh_tokens (
    id          BIGSERIAL PRIMARY KEY,
    user_id     UUID NOT NULL REFERENCES users(id),
    family_id   UUID NOT NULL,                  -- сессия: общий id всех токенов одного входа
    token_hash  BYTEA NOT NULL UNIQUE,          -- SHA-256 токена (32 байта)
    created_at  BIGINT NOT NULL,                -- Unix time выдачи
    expires_at  BIGINT NOT NULL,  -- Граница срока исключена
    revoked_at  BIGINT,  -- NULL для действующего токена

    CHECK (octet_length(token_hash) = 32),
    CHECK (expires_at > created_at)
);

CREATE INDEX idx_refresh_tokens_family ON refresh_tokens (family_id);
-- Увольнение гасит действующие токены пользователя
CREATE INDEX idx_refresh_tokens_user_active ON refresh_tokens (user_id) WHERE revoked_at IS NULL;

CREATE TABLE tools (
    id          UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    company_id  UUID NOT NULL REFERENCES companies(id),   -- реестр инструментов у каждой компании свой
    name        VARCHAR(100) NOT NULL,        -- попадает в QR сотрудника (toolName в op)
    condition   tool_condition NOT NULL DEFAULT 'Good',
    comment     TEXT,

    condition_updated_at BIGINT NOT NULL DEFAULT floor(extract(epoch FROM now()))::BIGINT,

    is_active   BOOLEAN NOT NULL DEFAULT TRUE,        -- FALSE = списан, необратимо

    created_at  BIGINT NOT NULL DEFAULT floor(extract(epoch FROM now()))::BIGINT,      -- Unix time добавления в реестр

    UNIQUE (id, company_id)
);

CREATE INDEX idx_tools_company ON tools (company_id);

CREATE TABLE rental_logs (
    id                SERIAL PRIMARY KEY,

    company_id        UUID NOT NULL REFERENCES companies(id),

    issuer_id         UUID NOT NULL,   -- из JWT вызвавшего /api/sync

    tool_id           UUID,
    worker_id         UUID,

    action            rental_action NOT NULL,
    tool_condition    tool_condition NOT NULL,
    qr_timestamp      BIGINT NOT NULL,        -- timestamp из op: время операции
    worker_signature  TEXT NOT NULL,  -- Проверка повторной подписи

    signed_payload    TEXT NOT NULL,  -- Исходный QR для аудита
    scanned_at        BIGINT NOT NULL,  -- Неподписанное время сканирования

    validation_flag   validation_flag NOT NULL,

    created_at        BIGINT NOT NULL DEFAULT floor(extract(epoch FROM now()))::BIGINT,  -- Unix time синхронизации с сервером

    FOREIGN KEY (issuer_id, company_id) REFERENCES users (id, company_id),
    FOREIGN KEY (worker_id, company_id) REFERENCES users (id, company_id),
    FOREIGN KEY (tool_id,   company_id) REFERENCES tools (id, company_id)
);

CREATE UNIQUE INDEX uq_rental_logs_resend ON rental_logs (issuer_id, scanned_at, md5(signed_payload));

CREATE UNIQUE INDEX uq_rental_logs_valid_signature ON rental_logs (worker_signature) WHERE validation_flag = 'VALID';

CREATE INDEX idx_rental_logs_company_time ON rental_logs (company_id, qr_timestamp DESC, id DESC);
CREATE INDEX idx_rental_logs_tool_time ON rental_logs (tool_id, qr_timestamp DESC, id DESC);
CREATE INDEX idx_rental_logs_worker ON rental_logs (worker_id);
CREATE INDEX idx_rental_logs_validation_flag ON rental_logs (validation_flag);

CREATE VIEW tool_current_holders AS
SELECT DISTINCT ON (tool_id)
    tool_id,
    worker_id,
    action,
    qr_timestamp,
    created_at
FROM rental_logs
WHERE validation_flag = 'VALID'
  AND tool_id IS NOT NULL
ORDER BY tool_id, qr_timestamp DESC, id DESC;

CREATE VIEW tools_with_holders AS
SELECT
    t.id,
    t.company_id,
    t.name,
    t.condition,
    t.comment,
    t.is_active,
    CASE WHEN h.action = 'TAKE' THEN h.worker_id    END AS holder_id,
    CASE WHEN h.action = 'TAKE' THEN u.full_name    END AS holder_name,
    CASE WHEN h.action = 'TAKE' THEN h.qr_timestamp END AS held_since
FROM tools t
LEFT JOIN tool_current_holders h ON h.tool_id = t.id
LEFT JOIN users u ON u.id = h.worker_id;

CREATE TABLE audit_events (
    id           BIGSERIAL PRIMARY KEY,
    event_id     UUID NOT NULL UNIQUE,        -- id события, его выдаёт публикующая сторона
    type         VARCHAR(64) NOT NULL,        -- тип = routing key: user.deactivated, rental.synced, ...
    company_id   UUID NOT NULL,               -- компания, в которой произошло событие
    actor_id     UUID NOT NULL,               -- пользователь, чьё действие породило событие
    occurred_at  BIGINT NOT NULL,             -- Unix time события (время сервера, опубликовавшего событие)
    data         JSONB NOT NULL,              -- поля события, свои у каждого типа
    received_at  BIGINT NOT NULL DEFAULT floor(extract(epoch FROM now()))::BIGINT   -- Unix time записи потребителем
);

CREATE INDEX idx_audit_events_company_time ON audit_events (company_id, occurred_at DESC);
