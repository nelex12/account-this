-- ==========================================
-- Система учёта и выдачи инструментов — схема БД (PostgreSQL)
-- Используется напрямую через Npgsql, без ORM.
-- ==========================================

-- ---------- ENUMS ----------

CREATE TYPE user_role AS ENUM ('Worker', 'Issuer', 'Owner');
CREATE TYPE tool_condition AS ENUM ('Good', 'Damaged', 'Broken');
CREATE TYPE rental_action AS ENUM ('TAKE', 'GIVE');
CREATE TYPE validation_flag AS ENUM (
    'VALID',
    'INVALID_SERVER_SIG',
    'INVALID_WORKER_SIG',
    'EXPIRED_TOKEN',
    'TIME_DRIFT'
);

-- ---------- ПОЛЬЗОВАТЕЛИ ----------

CREATE TABLE users (
    id              SERIAL PRIMARY KEY,
    full_name       VARCHAR NOT NULL,
    phone           VARCHAR NOT NULL UNIQUE,
    password_hash   VARCHAR NOT NULL,
    role            user_role NOT NULL,

    is_approved     BOOLEAN NOT NULL DEFAULT FALSE,
    is_active       BOOLEAN NOT NULL DEFAULT TRUE,

    created_at      TIMESTAMPTZ NOT NULL DEFAULT now()
);

-- Сертификаты (ServerSignedToken) отдельной таблицей не хранятся:
-- workerId, publicKey и срок годности зашиты в сам подписанный токен,
-- который сервер верифицирует по подписи в момент /api/sync, без обращения к БД.

-- ---------- ИНСТРУМЕНТЫ ----------

CREATE TABLE tools (
    id          SERIAL PRIMARY KEY,
    name        VARCHAR NOT NULL,
    condition   tool_condition NOT NULL DEFAULT 'Good',
    comment     TEXT,

    is_active   BOOLEAN NOT NULL DEFAULT TRUE,

    created_at  TIMESTAMPTZ NOT NULL DEFAULT now()
);

-- ---------- ЖУРНАЛ ОПЕРАЦИЙ (неизменяемый) ----------

CREATE TABLE rental_logs (
    id                SERIAL PRIMARY KEY,

    -- Nullable намеренно: если workerId/toolId из QR-payload'а не удаётся
    -- сопоставить с реальной записью (в т.ч. при поддельной подписи),
    -- запись всё равно должна быть сохранена для разбора — с NULL вместо FK.
    -- Недоверие к данным в этом случае и так видно по validation_flag.
    tool_id           INT REFERENCES tools(id),
    worker_id         INT REFERENCES users(id),

    issuer_id         INT NOT NULL REFERENCES users(id),

    action            rental_action NOT NULL,
    tool_condition    tool_condition NOT NULL,

    signed_payload    TEXT NOT NULL,   -- сырой OfflineRentalPayload, для аудита и переверификации
    qr_timestamp      BIGINT NOT NULL,

    validation_flag   validation_flag NOT NULL DEFAULT 'VALID',

    created_at        TIMESTAMPTZ NOT NULL DEFAULT now()  -- время синхронизации с сервером
);

CREATE INDEX idx_rental_logs_tool_created ON rental_logs (tool_id, created_at DESC);
CREATE INDEX idx_rental_logs_worker ON rental_logs (worker_id);
CREATE INDEX idx_rental_logs_validation_flag ON rental_logs (validation_flag);

-- ---------- ВСПОМОГАТЕЛЬНЫЙ VIEW: кто сейчас держит инструмент ----------
-- Последняя VALID-запись по каждому tool_id: если action = TAKE, инструмент
-- на руках у worker_id; если GIVE — на месте у завхоза.

CREATE VIEW tool_current_holders AS
SELECT DISTINCT ON (tool_id)
    tool_id,
    worker_id,
    action,
    created_at
FROM rental_logs
WHERE validation_flag = 'VALID'
  AND tool_id IS NOT NULL
ORDER BY tool_id, created_at DESC;