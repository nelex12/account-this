-- ==========================================
-- Система учёта и выдачи инструментов — схема БД (PostgreSQL 13+)
-- Используется напрямую через Npgsql, без ORM.
-- Все метки времени — Unix time в секундах (BIGINT); посмотреть как дату: to_timestamp(created_at).
-- id пользователей, компаний и инструментов — UUID (gen_random_uuid(), встроен в PostgreSQL с 13): их нельзя
-- перебрать и по ним нельзя оценить число пользователей или инструментов. Защитой данных они не являются:
-- изоляцию компаний обеспечивают проверки company_id в запросах и составные внешние ключи ниже.
-- id записей журнала — обычное число: ни один эндпоинт не принимает его на вход, записи всегда выбираются
-- по company_id, а порядок сохранения (при равном qr_timestamp) даёт сам id.
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
    'UNKNOWN_WORKER', -- workerId из токена нет среди пользователей компании завхоза (чужой сотрудник неотличим от несуществующего)
    'WORKER_DEACTIVATED', -- сотрудник уволен, и qr_timestamp >= users.deactivated_at (офлайн-сертификат не отзывается)
    'UNKNOWN_TOOL',  -- toolId из операции нет в реестре компании завхоза (чужой инструмент неотличим от несуществующего)
    'DUPLICATE'
);

-- ---------- КОМПАНИИ ----------

-- Компания — только название. Все пользователи, инструменты и записи журнала принадлежат ровно одной
-- компании; данные разных компаний друг другу не видны.
-- Название не уникально: компанию находят не по названию, а по её id — Owner сообщает id сотрудникам и завхозам,
-- они указывают его при регистрации. Списка компаний нет, id неугадываемый.
-- Сколько Owner может быть у одной компании, пока не решено: схема это не ограничивает
-- (users.company_id не уникален). Если решат «один владелец на компанию» — достаточно добавить
-- CREATE UNIQUE INDEX ON users (company_id) WHERE role = 'Owner'.
-- Создаётся при регистрации Owner (POST /api/auth/register с companyName).

CREATE TABLE companies (
    id      UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    name    VARCHAR(100) NOT NULL
);

-- ---------- ПОЛЬЗОВАТЕЛИ ----------

-- Все три роли регистрируются сами (POST /api/auth/register). Owner при регистрации создаёт компанию
-- и подтверждается сразу (подтверждать некому); Worker и Issuer указывают id компании
-- и ждут подтверждения Owner этой компании.

CREATE TABLE users (
    id              UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    company_id      UUID NOT NULL REFERENCES companies(id),   -- компания не меняется
    full_name       VARCHAR(100) NOT NULL,   -- попадает в QR сотрудника (fio в token)
    -- Нормализованный номер +7XXXXXXXXXX (сервер приводит ввод к этому виду), уникален и среди уволенных
    phone           VARCHAR(12) NOT NULL UNIQUE CHECK (phone ~ '^\+7[0-9]{10}$'),
    password_hash   VARCHAR NOT NULL,
    role            user_role NOT NULL,

    is_approved     BOOLEAN NOT NULL DEFAULT FALSE,
    is_active       BOOLEAN NOT NULL DEFAULT TRUE,   -- FALSE = уволен; запись не удаляется

    -- Unix time увольнения (время сервера), выставляется вместе с is_active = FALSE и при повторном увольнении
    -- не меняется. По нему /api/sync отсекает операции после увольнения (флаг WORKER_DEACTIVATED)
    deactivated_at  BIGINT,

    created_at      BIGINT NOT NULL DEFAULT floor(extract(epoch FROM now()))::BIGINT,   -- Unix time регистрации

    -- Уволен тогда и только тогда, когда известен момент увольнения
    CHECK (is_active = (deactivated_at IS NULL)),

    -- Цель составных внешних ключей rental_logs: проверяет, что пользователь записи из той же компании
    UNIQUE (id, company_id)
);

CREATE INDEX idx_users_company ON users (company_id);

-- Сертификаты (token + serverSignature) отдельной таблицей не хранятся:
-- workerId, publicKey и срок годности зашиты в сам подписанный токен,
-- который сервер верифицирует по подписи в момент /api/sync, без обращения к БД.

-- ---------- СЕССИИ (REFRESH TOKEN) ----------

-- Одна строка — один выданный refresh token. Сессия — цепочка токенов одного входа (family_id):
-- POST /api/auth/login начинает новую цепочку, каждый /api/auth/refresh гасит предъявленный токен
-- и добавляет в цепочку новый. Действующий токен в цепочке не больше одного.
--
-- Хранится SHA-256 токена, а не сам токен: утечка таблицы не даёт войти. Медленный хеш (как у паролей)
-- не нужен: токен — 32 случайных байта, подбирать нечего, а быстрый хеш позволяет искать по индексу.
--
-- Предъявлен погашенный токен — гасится вся цепочка (UPDATE ... WHERE family_id = ... AND revoked_at IS NULL).
-- Если при этом погасился хоть один токен, сессия была жива, а старым токеном воспользовались повторно —
-- признак кражи. Если нет — сессия уже была завершена (выход, увольнение), это не кража.
-- Увольнение гасит все цепочки пользователя (DELETE /api/users/{id}).

CREATE TABLE refresh_tokens (
    id          BIGSERIAL PRIMARY KEY,
    user_id     UUID NOT NULL REFERENCES users(id),
    family_id   UUID NOT NULL,                  -- сессия: общий id всех токенов одного входа
    token_hash  BYTEA NOT NULL UNIQUE,          -- SHA-256 токена (32 байта)
    created_at  BIGINT NOT NULL,                -- Unix time выдачи
    expires_at  BIGINT NOT NULL,                -- created_at + 30 дней; токен с expires_at <= now недействителен
    revoked_at  BIGINT,                         -- NULL — не погашен; ротация, выход, увольнение или повтор

    CHECK (octet_length(token_hash) = 32),
    CHECK (expires_at > created_at)
);

CREATE INDEX idx_refresh_tokens_family ON refresh_tokens (family_id);
-- Увольнение гасит действующие токены пользователя
CREATE INDEX idx_refresh_tokens_user_active ON refresh_tokens (user_id) WHERE revoked_at IS NULL;

-- ---------- ИНСТРУМЕНТЫ ----------

CREATE TABLE tools (
    id          UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    company_id  UUID NOT NULL REFERENCES companies(id),   -- реестр инструментов у каждой компании свой
    name        VARCHAR(100) NOT NULL,        -- попадает в QR сотрудника (toolName в op)
    condition   tool_condition NOT NULL DEFAULT 'Good',
    comment     TEXT,

    -- Время операции (Unix time), которой было выставлено текущее condition:
    -- qr_timestamp VALID-записи из /api/sync или время сервера при PATCH.
    -- Запись из /api/sync обновляет condition, только если её qr_timestamp не раньше этого значения (>=),
    -- поэтому поздно синхронизированная старая операция не перезапишет более свежее состояние.
    condition_updated_at BIGINT NOT NULL DEFAULT floor(extract(epoch FROM now()))::BIGINT,

    is_active   BOOLEAN NOT NULL DEFAULT TRUE,        -- FALSE = списан, необратимо

    created_at  BIGINT NOT NULL DEFAULT floor(extract(epoch FROM now()))::BIGINT,      -- Unix time добавления в реестр

    -- Цель составного внешнего ключа rental_logs: проверяет, что инструмент записи из той же компании
    UNIQUE (id, company_id)
);

CREATE INDEX idx_tools_company ON tools (company_id);

-- ---------- ЖУРНАЛ ОПЕРАЦИЙ (неизменяемый) ----------

CREATE TABLE rental_logs (
    id                SERIAL PRIMARY KEY,

    -- Компания записи — компания завхоза, синхронизировавшего запись (из его JWT).
    -- Журнал у каждой компании свой; все ссылки ниже обязаны вести в ту же компанию (составные внешние ключи).
    company_id        UUID NOT NULL REFERENCES companies(id),

    issuer_id         UUID NOT NULL,   -- из JWT вызвавшего /api/sync

    -- Nullable намеренно, запись с любым флагом сохраняется. Привязка заполняется только тем, что проверено
    -- и принадлежит компании завхоза, иначе NULL:
    --   worker_id — id из token, если подпись сервера верна (иначе поддельный токен приписал бы операцию
    --               реальному сотруднику) и такой пользователь есть в компании завхоза;
    --   tool_id   — toolId из op, если подпись работника верна (иначе неизвестно, что он заявлял)
    --               и такой инструмент есть в реестре компании завхоза.
    -- При NULL имена для журнала берутся из непроверенных значений внутри signed_payload.
    -- Составной внешний ключ с NULL в одном из столбцов не проверяется, поэтому NULL допустим.
    tool_id           UUID,
    worker_id         UUID,

    -- Строка QR всегда разобрана по формату AT1 (иначе /api/sync отвечает 400), поэтому поля заполнены всегда
    action            rental_action NOT NULL,
    tool_condition    tool_condition NOT NULL,
    qr_timestamp      BIGINT NOT NULL,        -- timestamp из op: время операции
    worker_signature  TEXT NOT NULL,          -- последняя часть строки QR, для поиска повторного использования (DUPLICATE)

    signed_payload    TEXT NOT NULL,          -- строка QR как отсканирована (AT1....), для аудита и переверификации
    scanned_at        BIGINT NOT NULL,        -- время сканирования завхозом (не подписано, отвечает issuer)

    validation_flag   validation_flag NOT NULL,

    created_at        BIGINT NOT NULL DEFAULT floor(extract(epoch FROM now()))::BIGINT,  -- Unix time синхронизации с сервером

    FOREIGN KEY (issuer_id, company_id) REFERENCES users (id, company_id),
    FOREIGN KEY (worker_id, company_id) REFERENCES users (id, company_id),
    FOREIGN KEY (tool_id,   company_id) REFERENCES tools (id, company_id)
);

-- Идемпотентность /api/sync: повторная отправка той же записи тем же завхозом не создаёт новую строку.
-- md5 — чтобы длина signed_payload не упиралась в лимит размера btree-ключа.
CREATE UNIQUE INDEX uq_rental_logs_resend ON rental_logs (issuer_id, scanned_at, md5(signed_payload));

-- Не более одной VALID-записи на один QR, в том числе при параллельных /api/sync.
-- DUPLICATE = уже есть VALID-запись с той же worker_signature; записи с другими флагами не в счёт
-- (иначе чужая испорченная копия QR, отправленная первой, сделала бы честную запись дублем).
-- Запись дойдёт до проверки DUPLICATE только если сотрудник из компании завхоза, поэтому компании не смешиваются.
CREATE UNIQUE INDEX uq_rental_logs_valid_signature ON rental_logs (worker_signature) WHERE validation_flag = 'VALID';

CREATE INDEX idx_rental_logs_company_time ON rental_logs (company_id, qr_timestamp DESC, id DESC);
CREATE INDEX idx_rental_logs_tool_time ON rental_logs (tool_id, qr_timestamp DESC, id DESC);
CREATE INDEX idx_rental_logs_worker ON rental_logs (worker_id);
CREATE INDEX idx_rental_logs_validation_flag ON rental_logs (validation_flag);

-- ---------- ВСПОМОГАТЕЛЬНЫЙ VIEW: кто сейчас держит инструмент ----------
-- Последняя по времени операции (qr_timestamp, не времени синхронизации; при равенстве — сохранённая позже)
-- VALID-запись по каждому tool_id: если action = TAKE, инструмент на руках у worker_id;
-- если GIVE — на месте у завхоза.

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
-- company_id — для отбора инструментов своей компании (в самой модели Tool API его нет).

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

-- ---------- ЖУРНАЛ СОБЫТИЙ (RabbitMQ) ----------
-- Аудит действий в системе: кто, что и когда сделал. Контракт событий — docs/events.md.
-- API пишет события не сюда, а в RabbitMQ (exchange accountthis.events) после фиксации своей транзакции;
-- сюда их складывает потребитель очереди audit. API эту таблицу не читает.
-- Доставка «хотя бы один раз»: одно событие может прийти повторно (сбой между записью и ack),
-- поэтому event_id уникален и потребитель вставляет с ON CONFLICT (event_id) DO NOTHING.
-- Внешних ключей нет намеренно: журнал принимает событие как есть и не зависит от состояния остальных таблиц.

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
