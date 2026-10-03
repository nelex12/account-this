-- ==========================================
-- Система учёта и выдачи инструментов — схема БД (PostgreSQL)
-- Используется напрямую через Npgsql, без ORM.
-- Все метки времени — Unix time в секундах (BIGINT); посмотреть как дату: to_timestamp(created_at).
-- ==========================================

-- ---------- ENUMS ----------

CREATE TYPE user_role AS ENUM ('Worker', 'Issuer', 'Owner');
CREATE TYPE tool_condition AS ENUM ('Good', 'Damaged', 'Broken');
CREATE TYPE rental_action AS ENUM ('TAKE', 'GIVE');

-- Проверки выполняются в порядке объявления (после VALID), флаг — по первой непройденной.
-- Строка QR не по формату AT1 в журнал не попадает: /api/sync отклоняет такой запрос целиком (400).
CREATE TYPE validation_flag AS ENUM (
    'VALID',
    'INVALID_SERVER_SIG',
    'INVALID_WORKER_SIG',
    'EXPIRED_TOKEN',
    'TIME_DRIFT',
    'UNKNOWN_TOOL',
    'DUPLICATE'
);

-- ---------- ПОЛЬЗОВАТЕЛИ ----------

-- Первый Owner создаётся сервером при старте из переменных окружения
-- (OWNER_PHONE — нормализуется, OWNER_PASSWORD, OWNER_FULLNAME — не длиннее 100 символов),
-- если в таблице нет ни одного Owner.

CREATE TABLE users (
    id              SERIAL PRIMARY KEY,
    full_name       VARCHAR(100) NOT NULL,   -- попадает в QR сотрудника (fio в token)
    -- Нормализованный номер +7XXXXXXXXXX (сервер приводит ввод к этому виду), уникален и среди уволенных
    phone           VARCHAR(12) NOT NULL UNIQUE CHECK (phone ~ '^\+7[0-9]{10}$'),
    password_hash   VARCHAR NOT NULL,
    role            user_role NOT NULL,

    is_approved     BOOLEAN NOT NULL DEFAULT FALSE,
    is_active       BOOLEAN NOT NULL DEFAULT TRUE,   -- FALSE = уволен; запись не удаляется

    created_at      BIGINT NOT NULL DEFAULT floor(extract(epoch FROM now()))::BIGINT   -- Unix time регистрации
);

-- Сертификаты (token + serverSignature) отдельной таблицей не хранятся:
-- workerId, publicKey и срок годности зашиты в сам подписанный токен,
-- который сервер верифицирует по подписи в момент /api/sync, без обращения к БД.

-- ---------- ИНСТРУМЕНТЫ ----------

CREATE TABLE tools (
    id          SERIAL PRIMARY KEY,
    name        VARCHAR(100) NOT NULL,        -- попадает в QR сотрудника (toolName в op)
    condition   tool_condition NOT NULL DEFAULT 'Good',
    comment     TEXT,

    -- Время операции (Unix time), которой было выставлено текущее condition:
    -- qr_timestamp VALID-записи из /api/sync или время сервера при PATCH.
    -- Запись из /api/sync обновляет condition, только если её qr_timestamp не раньше этого значения (>=),
    -- поэтому поздно синхронизированная старая операция не перезапишет более свежее состояние.
    condition_updated_at BIGINT NOT NULL DEFAULT floor(extract(epoch FROM now()))::BIGINT,

    is_active   BOOLEAN NOT NULL DEFAULT TRUE,        -- FALSE = списан, необратимо

    created_at  BIGINT NOT NULL DEFAULT floor(extract(epoch FROM now()))::BIGINT       -- Unix time добавления в реестр
);

-- ---------- ЖУРНАЛ ОПЕРАЦИЙ (неизменяемый) ----------

CREATE TABLE rental_logs (
    id                SERIAL PRIMARY KEY,

    -- Nullable намеренно, запись с любым флагом сохраняется; привязка определяется флагом:
    --   worker_id — NULL при INVALID_SERVER_SIG (поддельный токен не должен приписывать операцию
    --               реальному сотруднику), иначе id из token, если он есть в users;
    --   tool_id   — NULL при INVALID_SERVER_SIG, INVALID_WORKER_SIG, UNKNOWN_TOOL, иначе toolId из op.
    -- При NULL имена для журнала берутся из непроверенных значений внутри signed_payload.
    tool_id           INT REFERENCES tools(id),
    worker_id         INT REFERENCES users(id),

    issuer_id         INT NOT NULL REFERENCES users(id),   -- из JWT вызвавшего /api/sync

    -- Строка QR всегда разобрана по формату AT1 (иначе /api/sync отвечает 400), поэтому поля заполнены всегда
    action            rental_action NOT NULL,
    tool_condition    tool_condition NOT NULL,
    qr_timestamp      BIGINT NOT NULL,        -- timestamp из op: время операции
    worker_signature  TEXT NOT NULL,          -- последняя часть строки QR, для поиска повторного использования (DUPLICATE)

    signed_payload    TEXT NOT NULL,          -- строка QR как отсканирована (AT1....), для аудита и переверификации
    scanned_at        BIGINT NOT NULL,        -- время сканирования завхозом (не подписано, отвечает issuer)

    validation_flag   validation_flag NOT NULL,

    created_at        BIGINT NOT NULL DEFAULT floor(extract(epoch FROM now()))::BIGINT  -- Unix time синхронизации с сервером
);

-- Идемпотентность /api/sync: повторная отправка той же записи тем же завхозом не создаёт новую строку.
-- md5 — чтобы длина signed_payload не упиралась в лимит размера btree-ключа.
CREATE UNIQUE INDEX uq_rental_logs_resend ON rental_logs (issuer_id, scanned_at, md5(signed_payload));

-- Не более одной VALID-записи на один QR, в том числе при параллельных /api/sync.
-- DUPLICATE = уже есть VALID-запись с той же worker_signature; записи с другими флагами не в счёт
-- (иначе чужая испорченная копия QR, отправленная первой, сделала бы честную запись дублем).
CREATE UNIQUE INDEX uq_rental_logs_valid_signature ON rental_logs (worker_signature) WHERE validation_flag = 'VALID';

CREATE INDEX idx_rental_logs_tool_time ON rental_logs (tool_id, qr_timestamp DESC, id DESC);
CREATE INDEX idx_rental_logs_worker ON rental_logs (worker_id);
CREATE INDEX idx_rental_logs_validation_flag ON rental_logs (validation_flag);

-- ---------- ВСПОМОГАТЕЛЬНЫЙ VIEW: кто сейчас держит инструмент ----------
-- Последняя по времени операции (qr_timestamp, не времени синхронизации) VALID-запись по каждому tool_id:
-- если action = TAKE, инструмент на руках у worker_id; если GIVE — на месте у завхоза.

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

-- ---------- VIEW: инструменты с текущим держателем (модель Tool в API) ----------
-- holder_* заполнены, только если последняя VALID-операция — TAKE; иначе инструмент на месте у завхоза (NULL).

CREATE VIEW tools_with_holders AS
SELECT
    t.id,
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
