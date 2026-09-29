/* =====================================================================
   AccountThis — мок-данные прототипа.
   Формы объектов строго по api.yaml: UserResponse, Tool, RentalLogEntry,
   WorkerCertificate / ServerSignedToken, SyncResult.
   Все метки времени — Unix time в секундах; показываются в Europe/Moscow.
   «Сейчас» зафиксировано: вторник, 29.09.2026, 14:02 МСК.
   Люди, телефоны и история вымышлены.
   ===================================================================== */
(function () {
  'use strict';

  const MIN = 60, HOUR = 3600, DAY = 86400;
  const T0 = 1790629200;                    // 29.09.2026 00:00 МСК
  const NOW = T0 + 14 * HOUR + 2 * MIN;     // 29.09.2026 14:02 МСК

  /** Время: день относительно 29.09 (0 — сегодня, -1 — вчера) и 'ЧЧ:ММ[:СС]' по Москве */
  function at(day, hms) {
    const [h, m, s = 0] = hms.split(':').map(Number);
    return T0 + day * DAY + h * HOUR + m * MIN + s;
  }

  /* ---------- Пользователи (GET /api/users → UserResponse[]) ---------- */
  const USERS = [
    { id: 1, fullName: 'Соколова Марина Викторовна', phone: '+79000000101', role: 'Owner', isApproved: true, isActive: true },
    { id: 2, fullName: 'Громов Сергей Петрович', phone: '+79000000102', role: 'Issuer', isApproved: true, isActive: true },
    { id: 3, fullName: 'Белова Ирина Андреевна', phone: '+79000000103', role: 'Issuer', isApproved: true, isActive: true },
    { id: 4, fullName: 'Петров Алексей Сергеевич', phone: '+79000000104', role: 'Worker', isApproved: true, isActive: true },
    { id: 5, fullName: 'Кузнецов Дмитрий Игоревич', phone: '+79000000105', role: 'Worker', isApproved: true, isActive: true },
    { id: 6, fullName: 'Сидоров Николай Олегович', phone: '+79000000106', role: 'Worker', isApproved: true, isActive: true },
    { id: 7, fullName: 'Лебедев Артём Павлович', phone: '+79000000107', role: 'Worker', isApproved: true, isActive: true },
    { id: 8, fullName: 'Морозова Екатерина Юрьевна', phone: '+79000000108', role: 'Worker', isApproved: true, isActive: true },
    { id: 9, fullName: 'Смирнов Андрей Викторович', phone: '+79000000109', role: 'Worker', isApproved: true, isActive: true },
    { id: 10, fullName: 'Попова Алина Романовна', phone: '+79000000110', role: 'Worker', isApproved: true, isActive: true },
    { id: 11, fullName: 'Васильев Константин Сергеевич', phone: '+79000000111', role: 'Worker', isApproved: true, isActive: true },
    { id: 12, fullName: 'Волков Игорь Николаевич', phone: '+79000000112', role: 'Worker', isApproved: true, isActive: false },
    { id: 13, fullName: 'Фёдоров Максим Ильич', phone: '+79000000113', role: 'Issuer', isApproved: true, isActive: false },
    { id: 14, fullName: 'Егоров Тимур Ренатович', phone: '+79000000114', role: 'Worker', isApproved: false, isActive: false },
    { id: 15, fullName: 'Зайцев Роман Андреевич', phone: '+79000000115', role: 'Worker', isApproved: false, isActive: true },
    { id: 16, fullName: 'Орлова Дарья Сергеевна', phone: '+79000000116', role: 'Issuer', isApproved: false, isActive: true },
    { id: 17, fullName: 'Никитин Павел Геннадьевич', phone: '+79000000117', role: 'Owner', isApproved: false, isActive: true },
  ];

  /* ---------- Инструменты: название, состояние и комментарий в БД ----------
     holderId / holderName / heldSince ниже вычисляются из журнала так же,
     как это делает view tools_with_holders (последняя VALID-запись по qrTimestamp). */
  const TOOL_BASE = [
    [1, 'Дрель Bosch GSB 16 RE', 'Good', null, true],
    [2, 'Перфоратор Makita HR2470', 'Good', null, true],
    [3, 'Болгарка DeWalt DWE4157', 'Broken', 'Не запускается, запах гари', true],
    [4, 'Шуруповёрт Metabo BS 18 LTX', 'Good', null, true],
    [5, 'Лазерный уровень ADA Cube 360', 'Damaged', 'Треснуло стекло окна луча', true],
    [6, 'Сварочный инвертор Ресанта САИ-190', 'Good', null, true],
    [7, 'Торцовочная пила Makita LS1040', 'Good', null, true],
    [8, 'Стремянка алюминиевая, 7 ступеней', 'Good', null, true],
    [9, 'Угловая шлифмашина Интерскол УШМ-125/900', 'Broken', 'Списана 12.09: разрушен редуктор', false],
    [10, 'Лобзик Bosch PST 700 E', 'Good', null, true],
    [11, 'Строительный фен Steinel HL 1920 E', 'Good', null, true],
    [12, 'Циркулярная пила Makita HS7601', 'Good', null, true],
    [13, 'Штроборез Интерскол ПД-125/1400', 'Broken', 'Сломан защитный кожух', true],
    [14, 'Дальномер лазерный Bosch GLM 50 C', 'Good', null, true],
    [15, 'Набор ключей комбинированных, 22 шт.', 'Damaged', 'Нет ключа на 13', true],
    [16, 'Тепловая пушка Ballu BHP-P2-5', 'Good', null, true],
    [17, 'Бетономешалка Зубр БМ-200', 'Good', null, true],
    [18, 'Удлинитель на катушке, 50 м', 'Damaged', 'Повреждена изоляция у вилки', true],
    [19, 'Краскопульт Wagner W 590', 'Good', null, true],
    [20, 'Гайковёрт Makita DTW300', 'Good', null, true],
    [21, 'Рубанок Интерскол Р-82/710', 'Good', null, true],
    [22, 'Миксер строительный Зубр МР-1400-2', 'Good', null, true],
    [23, 'Пылесос строительный Kärcher WD 3', 'Good', null, true],
    [24, 'Нивелир оптический ADA Basis', 'Broken', 'Упал со штатива, сбита юстировка', true],
    [25, 'Отбойный молоток Bosch GSH 11 E', 'Damaged', 'Люфт патрона', true],
    [26, 'Перфоратор Bosch GBH 2-26 DRE', 'Good', null, true],   // добавлен сегодня в 10:15
  ];

  /* ---------- Журнал: события ----------
     w — workerId (если подпись сервера валидна), t — toolId из операции,
     i — issuerId, a — действие, c — заявленное состояние, ts — timestamp из op,
     d — задержка сканирования, с (scannedAt = ts + d), f — флаг сервера.
     wn / tn — непроверенные fio / toolName из строки QR (для записей, где id = null). */
  const EVENTS = [];
  const ev = (o) => EVENTS.push(Object.assign({ d: 4, f: 'VALID' }, o));

  // 11.09 — списанная позже шлифмашина: сломалась у Волкова (сейчас уволен); завхоз Фёдоров (уволен)
  ev({ w: 12, t: 9, i: 13, a: 'TAKE', c: 'Good', ts: at(-18, '08:20:10') });
  ev({ w: 12, t: 9, i: 13, a: 'GIVE', c: 'Broken', ts: at(-18, '17:40:31') });
  // 18.09 — штроборез сломан у Сидорова
  ev({ w: 6, t: 13, i: 2, a: 'TAKE', c: 'Good', ts: at(-11, '08:30:02') });
  ev({ w: 6, t: 13, i: 2, a: 'GIVE', c: 'Broken', ts: at(-11, '16:15:44') });
  // 20.09 — нивелир сломан у Лебедева
  ev({ w: 7, t: 24, i: 3, a: 'TAKE', c: 'Good', ts: at(-9, '09:05:17') });
  ev({ w: 7, t: 24, i: 3, a: 'GIVE', c: 'Broken', ts: at(-9, '15:50:09') });
  // 21.09 — возврат с просроченным сертификатом; на следующее утро сотрудница повторила возврат
  ev({ w: 8, t: 6, i: 3, a: 'TAKE', c: 'Good', ts: at(-8, '08:05:40') });
  ev({ w: 8, t: 6, i: 3, a: 'GIVE', c: 'Good', ts: at(-8, '20:15:40'), d: 6, f: 'EXPIRED_TOKEN' });
  ev({ w: 8, t: 6, i: 2, a: 'GIVE', c: 'Good', ts: at(-7, '08:12:03') });
  // 23.09 — удлинитель повреждён у Смирнова
  ev({ w: 9, t: 18, i: 2, a: 'TAKE', c: 'Good', ts: at(-6, '08:40:25') });
  ev({ w: 9, t: 18, i: 2, a: 'GIVE', c: 'Damaged', ts: at(-6, '17:25:51') });
  // 24.09 — наклейка с номером, которого нет в реестре
  ev({ w: 5, t: null, i: 3, a: 'TAKE', c: 'Good', ts: at(-5, '09:12:36'), f: 'UNKNOWN_TOOL', tn: 'Перфоратор Hilti TE 30-A36', claimedTool: 58 });
  // 25.09 — подпись сотрудника не сходится
  ev({ w: 6, t: null, i: 3, a: 'GIVE', c: 'Good', ts: at(-4, '17:48:12'), d: 5, f: 'INVALID_WORKER_SIG', tn: 'Перфоратор Makita HR2470', claimedTool: 2 });
  // 26.09 — перфоратор у Сидорова (на руках до сих пор); болгарка сломана у Кузнецова
  ev({ w: 6, t: 2, i: 3, a: 'TAKE', c: 'Good', ts: at(-3, '08:05:12') });
  ev({ w: 5, t: 3, i: 2, a: 'TAKE', c: 'Good', ts: at(-3, '08:14:30') });
  ev({ w: 5, t: 3, i: 2, a: 'GIVE', c: 'Broken', ts: at(-3, '17:02:03'), d: 3 });
  // 27.09 — уровень повреждён у Петрова; набор ключей — у Морозовой
  ev({ w: 4, t: 5, i: 2, a: 'TAKE', c: 'Good', ts: at(-2, '08:20:41') });
  ev({ w: 4, t: 5, i: 2, a: 'GIVE', c: 'Damaged', ts: at(-2, '16:55:09') });
  ev({ w: 8, t: 15, i: 3, a: 'TAKE', c: 'Good', ts: at(-2, '09:10:22') });
  ev({ w: 8, t: 15, i: 3, a: 'GIVE', c: 'Damaged', ts: at(-2, '17:31:40') });
  // 28.09 — дрель и стремянка у Смирнова; лобзик: TIME_DRIFT при выдаче, возврат принят дважды
  ev({ w: 9, t: 1, i: 2, a: 'TAKE', c: 'Good', ts: at(-1, '08:30:15') });
  ev({ w: 7, t: 10, i: 3, a: 'TAKE', c: 'Good', ts: at(-1, '12:10:05'), d: 95, f: 'TIME_DRIFT' });
  ev({ w: 9, t: 8, i: 3, a: 'TAKE', c: 'Good', ts: at(-1, '15:30:18') });
  ev({ w: 7, t: 10, i: 2, a: 'GIVE', c: 'Good', ts: at(-1, '16:46:30'), d: 5, sig: 'lobzik-give' });
  ev({ w: 7, t: 10, i: 3, a: 'GIVE', c: 'Good', ts: at(-1, '16:46:30'), d: 32, f: 'DUPLICATE', sig: 'lobzik-give' });
  // 29.09 — сегодня (синхронизировано: Громов в 12:40, Белова в 13:05)
  ev({ w: 8, t: 12, i: 2, a: 'TAKE', c: 'Good', ts: at(0, '07:55:20') });
  ev({ w: 4, t: 4, i: 2, a: 'TAKE', c: 'Good', ts: at(0, '08:14:02') });
  ev({ w: 5, t: 5, i: 2, a: 'TAKE', c: 'Damaged', ts: at(0, '09:02:44'), d: 5 });
  ev({ w: 11, t: 22, i: 3, a: 'TAKE', c: 'Good', ts: at(0, '09:40:10') });
  ev({ w: 7, t: 18, i: 3, a: 'TAKE', c: 'Damaged', ts: at(0, '10:30:31') });
  ev({ w: 10, t: 19, i: 2, a: 'TAKE', c: 'Good', ts: at(0, '11:20:05') });
  ev({ w: null, t: null, i: 3, a: 'TAKE', c: 'Good', ts: at(0, '11:48:26'), f: 'INVALID_SERVER_SIG', wn: 'Иванов Иван Иванович', tn: 'Дрель Bosch GSB 16 RE', claimedTool: 1, claimedWorker: 21 });
  ev({ w: 9, t: 1, i: 2, a: 'GIVE', c: 'Good', ts: at(0, '12:05:00') });

  /* Фоновая история 16.09–28.09: инструмент взяли утром и вернули вечером того же дня.
     Детерминированный генератор, чтобы данные не менялись между открытиями. */
  function mulberry32(a) {
    return function () {
      a |= 0; a = (a + 0x6D2B79F5) | 0;
      let t = Math.imul(a ^ (a >>> 15), 1 | a);
      t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t;
      return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
    };
  }
  const rnd = mulberry32(20260929);
  const pick = (arr) => arr[Math.floor(rnd() * arr.length)];
  const hms = (secOfDay) => {
    const h = Math.floor(secOfDay / HOUR), m = Math.floor((secOfDay % HOUR) / MIN), s = secOfDay % MIN;
    return [h, m, s].map((x) => String(x).padStart(2, '0')).join(':');
  };
  // Когда инструмент доступен для фоновых выдач (до поломки, до ручной пометки, без свежих событий)
  const availability = {
    1: [-13, -2], 2: [-13, -4], 3: [-13, -4], 4: [-13, -1], 5: [-13, -3], 6: [-13, -9], 7: [-13, -1],
    8: [-13, -2], 10: [-13, -2], 11: [-13, -1], 12: [-13, -1], 13: [-13, -12], 14: [-13, -1],
    15: [-13, -3], 16: [-13, -1], 17: [-13, -1], 18: [-13, -7], 19: [-13, -1], 20: [-13, -1],
    21: [-13, -1], 22: [-13, -1], 23: [-13, -1], 24: [-13, -10], 25: [-13, -8],
  };
  const busyDays = {}; // инструмент+день, занятые вручную заданными событиями
  EVENTS.forEach((e) => { if (e.t) busyDays[e.t + ':' + Math.floor((e.ts - T0) / DAY)] = true; });
  const WORKERS = [4, 5, 6, 7, 8, 9, 10, 11];
  for (let day = -13; day <= -1; day++) {
    const weekday = new Date((T0 + day * DAY + 12 * HOUR) * 1000).getUTCDay(); // 0 — вс, 6 — сб
    const n = weekday === 0 ? 1 + Math.floor(rnd() * 2) : weekday === 6 ? 3 + Math.floor(rnd() * 2) : 5 + Math.floor(rnd() * 4);
    const pool = Object.keys(availability).map(Number)
      .filter((t) => day >= availability[t][0] && day <= availability[t][1] && !busyDays[t + ':' + day]);
    const busyWorkers = {};
    for (let k = 0; k < n && pool.length; k++) {
      const t = pool.splice(Math.floor(rnd() * pool.length), 1)[0];
      let w = pick(WORKERS), guard = 0;
      while (busyWorkers[w] && guard++ < 10) w = pick(WORKERS);
      busyWorkers[w] = true;
      const takeAt = 7 * HOUR + 30 * MIN + Math.floor(rnd() * 3 * HOUR);
      const giveAt = 15 * HOUR + 30 * MIN + Math.floor(rnd() * 3 * HOUR);
      ev({ w, t, i: pick([2, 3]), a: 'TAKE', c: 'Good', ts: at(day, hms(takeAt)), d: 2 + Math.floor(rnd() * 8) });
      ev({ w, t, i: pick([2, 3]), a: 'GIVE', c: 'Good', ts: at(day, hms(giveAt)), d: 2 + Math.floor(rnd() * 8) });
    }
  }

  /* createdAt — время синхронизации: ближайший сеанс завхоза после сканирования */
  const SYNC = { 2: ['08:00', '12:40', '18:20'], 3: ['08:10', '13:05', '18:45'], 13: ['18:00'] };
  function syncTime(issuer, scannedAt) {
    const day0 = Math.floor((scannedAt - T0) / DAY);
    for (let day = day0; day <= day0 + 2; day++) {
      for (const t of SYNC[issuer]) {
        const s = at(day, t);
        if (s > scannedAt) return s;
      }
    }
    return null;
  }

  const byId = (arr) => Object.fromEntries(arr.map((x) => [x.id, x]));
  const USERS_BY_ID = byId(USERS);

  /* RentalLogEntry[] — только уже синхронизированные записи (createdAt ≤ NOW) */
  let LOGS = EVENTS.map((e) => {
    const scannedAt = e.ts + e.d;
    const createdAt = syncTime(e.i, scannedAt);
    const tool = e.t ? TOOL_BASE.find((x) => x[0] === e.t) : null;
    return {
      id: 0,
      toolId: e.t,
      toolName: tool ? tool[1] : e.tn,
      workerId: e.w,
      workerName: e.w ? USERS_BY_ID[e.w].fullName : e.wn,
      issuerId: e.i,
      action: e.a,
      toolCondition: e.c,
      qrTimestamp: e.ts,
      scannedAt,
      validationFlag: e.f,
      createdAt,
      // поля ниже в API нет — только для подсказок прототипа
      _claimedToolId: e.claimedTool || e.t || null,
      _sig: e.sig || null,
    };
  }).filter((l) => l.createdAt !== null && l.createdAt <= NOW);

  // id присваиваются в порядке сохранения на сервере
  LOGS.sort((a, b) => a.createdAt - b.createdAt || a.scannedAt - b.scannedAt);
  LOGS.forEach((l, k) => { l.id = k + 1; });
  // Порядок GET /api/logs: по убыванию qrTimestamp, затем по убыванию id
  LOGS.sort((a, b) => b.qrTimestamp - a.qrTimestamp || b.id - a.id);

  /* Tool[] — модель API, держатель по последней VALID-записи (как view tools_with_holders) */
  const TOOLS_ALL = TOOL_BASE.map(([id, name, condition, comment, isActive]) => {
    const last = LOGS.filter((l) => l.toolId === id && l.validationFlag === 'VALID')
      .sort((a, b) => b.qrTimestamp - a.qrTimestamp || b.id - a.id)[0];
    const held = last && last.action === 'TAKE';
    return {
      id, name, condition, comment, isActive,
      holderId: held ? last.workerId : null,
      holderName: held ? USERS_BY_ID[last.workerId].fullName : null,
      heldSince: held ? last.qrTimestamp : null,
    };
  });
  const TOOLS = TOOLS_ALL.filter((t) => t.isActive); // GET /api/tools отдаёт только активные

  /* ---------- Локальный журнал завхоза Громова (устройство станции выдачи) ----------
     Запись: { qr, scannedAt } + разобранные поля для показа + статус отправки. */
  const L = (hmsStr, a, t, w, c, status, flag, extra) => Object.assign({
    scannedAt: at(0, hmsStr), action: a, toolId: t, workerId: w, toolCondition: c,
    toolName: TOOL_BASE.find((x) => x[0] === t)[1], workerName: USERS_BY_ID[w].fullName,
    status, flag: flag || null,
  }, extra || {});
  const LOCAL = [
    L('14:01:15', 'TAKE', 20, 11, 'Good', 'pending'),
    L('13:58:09', 'GIVE', 19, 10, 'Good', 'pending'),
    L('13:50:44', 'TAKE', 11, 6, 'Good', 'pending'),
    L('13:41:19', 'GIVE', 4, 4, 'Good', 'pending'),
    L('13:20:06', 'TAKE', 1, 5, 'Good', 'pending'),
    L('13:05:37', 'TAKE', 14, 4, 'Good', 'pending'),
    L('12:44:14', 'GIVE', 12, 8, 'Good', 'pending'),
    L('12:05:04', 'GIVE', 1, 9, 'Good', 'sent', 'VALID'),
    L('11:20:09', 'TAKE', 19, 10, 'Good', 'sent', 'VALID'),
    L('09:02:49', 'TAKE', 5, 5, 'Damaged', 'sent', 'VALID'),
    L('08:14:06', 'TAKE', 4, 4, 'Good', 'sent', 'VALID'),
    L('07:55:24', 'TAKE', 12, 8, 'Good', 'sent', 'VALID'),
  ];
  LOCAL.forEach((r) => {
    r.qrTimestamp = r.scannedAt - 4;
    if (r.status === 'sent') {
      const log = LOGS.find((l) => l.issuerId === 2 && l.toolId === r.toolId && l.qrTimestamp === r.qrTimestamp);
      r.logId = log ? log.id : null;
    }
  });

  /* ---------- Устройства и сессии ---------- */
  const SESSION = {
    issuer: {
      userId: 2, phone: '+79000000102', role: 'Issuer',
      jwtExpiresAt: at(0, '20:03'),          // вход в 08:03 + 12 часов
      serverKeySavedAt: at(0, '08:03'),
      registryLoadedAt: at(0, '08:03'),      // до добавления № 0026 в 10:15
      registryCount: 25,
      clockOffset: 2,                         // serverTime − локальное время, с
      lastSyncAt: at(0, '12:40'),
    },
    owner: { userId: 1, phone: '+79000000101', role: 'Owner', jwtExpiresAt: at(0, '19:12') },
    worker: {
      userId: 4, phone: '+79000000104', role: 'Worker', clockOffset: 1,
      // WorkerCertificate: token = base64url(JSON ServerSignedToken); здесь — уже разобранный
      cert: {
        workerId: 4, fio: 'Петров Алексей Сергеевич',
        issuedAt: at(0, '08:10'), expiresAt: at(0, '20:10'),
        workerPublicKey: 'K3v8Qx2mJpZcN7bLr1TtYw0aH5dFgU9sEoViRk4nC6M',
      },
    },
  };

  /* ---------- Справочники: как показывать значения enum ---------- */
  const DICT = {
    role: {
      Worker: { label: 'Сотрудник', desc: 'Беру и возвращаю инструмент по QR-коду' },
      Issuer: { label: 'Завхоз', desc: 'Выдаю и принимаю инструмент, веду реестр' },
      Owner: { label: 'Владелец', desc: 'Подтверждаю заявки, управляю людьми и списанием' },
    },
    condition: {
      Good: { label: 'Исправен', tone: 'good', icon: 'check-circle', rank: 0, desc: 'Работает, дефектов нет' },
      Damaged: { label: 'Повреждён', tone: 'warn', icon: 'alert', rank: 1, desc: 'Работает, но есть дефект: трещина, люфт, нет детали' },
      Broken: { label: 'Сломан', tone: 'bad', icon: 'octagon-x', rank: 2, desc: 'Не работает или опасен в работе' },
    },
    action: {
      TAKE: { label: 'Выдача', band: 'ВЫДАЧА', verb: 'Беру', icon: 'arrow-out', confirm: 'Подтвердить выдачу', bandSub: 'Сотрудник берёт инструмент' },
      GIVE: { label: 'Возврат', band: 'ВОЗВРАТ', verb: 'Возвращаю', icon: 'arrow-in', confirm: 'Подтвердить возврат', bandSub: 'Сотрудник возвращает инструмент' },
    },
    // group: ok — подтверждена; warn — требует проверки; bad — подозрительная
    flag: {
      VALID: {
        label: 'Подтверждена', tone: 'good', group: 'ok', icon: 'check-circle',
        title: 'Операция подтверждена',
        text: 'Подписи сервера и сотрудника верны, время в допуске, инструмент есть в реестре. По этой записи сервер обновил состояние и держателя инструмента.',
        todo: null,
      },
      INVALID_SERVER_SIG: {
        label: 'Поддельный сертификат', tone: 'bad', group: 'bad', icon: 'shield-x',
        title: 'Сертификат сотрудника не подписан сервером',
        text: 'Подпись сервера на сертификате в QR не сходится: сертификат подделан или выдан до смены ключа сервера. Запись не привязана ни к сотруднику, ни к инструменту — имена взяты из QR и не проверены.',
        todo: 'Выясните у завхоза, кто предъявил этот QR. На реестр запись не влияет.',
      },
      INVALID_WORKER_SIG: {
        label: 'Подпись не сходится', tone: 'bad', group: 'bad', icon: 'shield-x',
        title: 'Подпись сотрудника не сходится',
        text: 'Сертификат настоящий, но операция подписана другим ключом или изменена после подписи. Инструмент не привязан: неизвестно, что на самом деле заявил сотрудник.',
        todo: 'Уточните операцию у сотрудника и завхоза. На реестр запись не влияет.',
      },
      EXPIRED_TOKEN: {
        label: 'Сертификат истёк', tone: 'warn', group: 'warn', icon: 'clock',
        title: 'Операция вне срока сертификата',
        text: 'Время операции не попадает в 12 часов действия сертификата сотрудника.',
        todo: 'Если инструмент действительно передан, сотрудник получает новый сертификат и формирует QR заново. Эта запись в реестре не учитывается.',
      },
      TIME_DRIFT: {
        label: 'Расхождение времени', tone: 'warn', group: 'warn', icon: 'clock',
        title: 'Время QR и сканирования расходятся',
        text: 'Между созданием QR и сканированием прошло больше 60 секунд, или время записи опережает сервер больше чем на 5 минут.',
        todo: 'Проверьте часы на телефоне завхоза: приложение сверяет их при каждом выходе в сеть. Запись в реестре не учитывается — если операция была, её нужно повторить.',
      },
      UNKNOWN_TOOL: {
        label: 'Инструмент не найден', tone: 'warn', group: 'warn', icon: 'alert',
        title: 'Инструмента с таким номером нет в реестре',
        text: 'Номера с наклейки нет на сервере. Название взято из QR и не проверено.',
        todo: 'Проверьте наклейку: она могла остаться от другого объекта или быть напечатана с ошибкой. Добавьте инструмент в реестр и перепечатайте наклейку.',
      },
      DUPLICATE: {
        label: 'Повтор QR', tone: 'bad', group: 'bad', icon: 'copy',
        title: 'Этот QR уже был принят',
        text: 'В журнале уже есть подтверждённая запись с той же подписью: один и тот же QR отсканировали повторно — другой завхоз или позже.',
        todo: 'Сверьте с завхозами, была ли вторая передача инструмента. Запись в реестре не учитывается.',
      },
    },
    flagGroup: {
      ok: { label: 'Подтверждённые', tone: 'good' },
      warn: { label: 'Требуют проверки', tone: 'warn' },
      bad: { label: 'Подозрительные', tone: 'bad' },
    },
  };
  const FLAG_ORDER = ['VALID', 'INVALID_SERVER_SIG', 'INVALID_WORKER_SIG', 'EXPIRED_TOKEN', 'TIME_DRIFT', 'UNKNOWN_TOOL', 'DUPLICATE'];

  /* ---------- Вычисления на клиенте (read-side отчёты поверх журнала) ---------- */

  /** «Кто сломал»: VALID GIVE тяжелее предыдущей VALID TAKE того же инструмента → работник этого TAKE */
  function damageIncidents(logs, sinceTs) {
    const rank = (c) => DICT.condition[c].rank;
    const valid = logs.filter((l) => l.validationFlag === 'VALID' && l.toolId)
      .slice().sort((a, b) => a.qrTimestamp - b.qrTimestamp || a.id - b.id);
    const lastTake = {};
    const out = [];
    valid.forEach((l) => {
      if (l.action === 'TAKE') { lastTake[l.toolId] = l; return; }
      const take = lastTake[l.toolId];
      if (take && rank(l.toolCondition) > rank(take.toolCondition) && l.qrTimestamp >= (sinceTs || 0)) {
        out.push({ toolId: l.toolId, toolName: l.toolName, from: take.toolCondition, to: l.toolCondition, workerId: take.workerId, workerName: take.workerName, takeAt: take.qrTimestamp, giveAt: l.qrTimestamp, giveLogId: l.id });
      }
      delete lastTake[l.toolId];
    });
    return out.sort((a, b) => b.giveAt - a.giveAt);
  }

  /** Операции по дням (МСК) с разбивкой по группам флагов — для графика */
  function opsByDay(logs, days) {
    const out = [];
    for (let d = -(days - 1); d <= 0; d++) {
      const from = T0 + d * DAY, to = from + DAY;
      const dayLogs = logs.filter((l) => l.qrTimestamp >= from && l.qrTimestamp < to);
      const g = { ok: 0, warn: 0, bad: 0 };
      dayLogs.forEach((l) => { g[DICT.flag[l.validationFlag].group]++; });
      out.push({ day: d, from, ...g, total: dayLogs.length });
    }
    return out;
  }

  window.AT_DATA = {
    MIN, HOUR, DAY, T0, NOW, at,
    USERS, USERS_BY_ID, TOOLS, TOOLS_ALL, LOGS, LOCAL, SESSION, DICT, FLAG_ORDER,
    damageIncidents, opsByDay,
  };
})();
