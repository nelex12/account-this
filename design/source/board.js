/* =====================================================================
   Доски с макетами: список, рамки устройств, листы «Дизайн-система»
   и «Состояния и ошибки». index.html?board=<id> — одна доска для PNG,
   index.html — все доски подряд для просмотра в браузере.
   ===================================================================== */
(function () {
  'use strict';
  const D = window.AT_DATA, U = window.AT_UI, S = window.AT_SCREENS;
  const { icon, esc } = U;

  /* ---------------- Рамки устройств ---------------- */
  function statusBar(offline) {
    const bars = [4, 6.5, 9, 12].map((h, k) => `<rect x="${k * 5}" y="${12 - h}" width="3" height="${h}" rx="1"${offline && k > 0 ? ' opacity=".3"' : ''}/>`).join('');
    const wifi = offline ? '' : '<svg width="16" height="12" viewBox="0 0 16 12"><path d="M8 11.6 5.7 9.2a3.3 3.3 0 0 1 4.6 0z"/><path d="M3.4 6.9a6.5 6.5 0 0 1 9.2 0l-1.3 1.3a4.7 4.7 0 0 0-6.6 0z"/><path d="M1.1 4.6a9.8 9.8 0 0 1 13.8 0l-1.3 1.3a8 8 0 0 0-11.2 0z"/></svg>';
    const battery = '<svg width="27" height="13" viewBox="0 0 27 13"><rect x=".5" y=".5" width="23" height="12" rx="3.5" fill="none" stroke="currentColor" opacity=".45"/><rect x="2" y="2" width="15" height="9" rx="2"/><rect x="24.5" y="4.5" width="2" height="4" rx="1" opacity=".45"/></svg>';
    return `<div class="device__status"><span>14:02</span><span class="device__sys"><svg width="18" height="12" viewBox="0 0 18 12">${bars}</svg>${wifi}${battery}</span></div>`;
  }

  function frame(item) {
    const scr = S[item.s];
    if (!scr) throw new Error('Нет экрана ' + item.s);
    const fo = scr.frame ? scr.frame(item.v) : {};
    const html = scr.render(item.v, { role: item.role });
    const tall = item.tall ? ' device--tall' : '';
    if ((item.d || 'phone') === 'phone') {
      return `<div class="device device--phone${fo.cam ? ' device--cam' : ''}${tall}"><div class="device__screen"><span class="device__island"></span>${statusBar(fo.offline)}<div class="device__viewport screen-root">${html}</div><div class="device__home"></div></div></div>`;
    }
    return `<div class="device device--desktop${item.d === 'tablet' ? ' device--tablet' : ''}${tall}"><div class="browser-bar"><span class="browser-dots"><i></i><i></i><i></i></span><span class="browser-url">${icon('lock')}accountthis.local${scr.path}</span></div><div class="device__viewport screen-root">${html}</div></div>`;
  }
  const frameWidth = (item) => ({ phone: 410, desktop: 1282, tablet: 822 })[item.d || 'phone'];

  /* ---------------- Список досок ----------------
     cap: [заголовок, пояснение]; actor — для главного сценария */
  const P = (s, v, cap, extra) => Object.assign({ s, v, d: 'phone', cap }, extra || {});
  const W = (s, v, cap, extra) => Object.assign({ s, v, d: 'desktop', cap }, extra || {});

  const BOARDS = [
    {
      id: 'flow', file: '00-main-flow', eyebrow: 'Главный сценарий', title: 'Выдача и возврат без интернета',
      lead: 'Сотрудник заранее получает сертификат, дальше сеть не нужна: он формирует подписанный QR-код, завхоз проверяет его по ключу сервера и записывает в журнал смены. Записи уходят на сервер, когда появляется интернет, и там проверяются ещё раз.',
      flow: true,
      items: [
        P('worker-home', 'ready', ['Сертификат на смену', 'Получен утром, пока была сеть. Действует 12 часов.'], { actor: 'Сотрудник' }),
        P('worker-scan', 'scan', ['Сканирует наклейку', 'Камера читает номер и название инструмента.'], { actor: 'Сотрудник' }),
        P('worker-op', 'give-damaged', ['Выбирает действие и состояние', '«Возвращаю», «Повреждён» — его подписанное заявление.'], { actor: 'Сотрудник' }),
        P('worker-qr', 'active', ['Показывает QR-код', 'Код действует минуту и не требует сети.'], { actor: 'Сотрудник' }),
        P('issuer-scan', 'camera', ['Сканирует QR сотрудника', 'Камерой телефона или 2D-сканером у стойки.'], { actor: 'Завхоз' }),
        P('issuer-verify', 'warn-condition', ['Проверяет и подтверждает', 'Подписи и время в порядке. Состояние хуже, чем в реестре, — осмотреть инструмент.'], { actor: 'Завхоз' }),
        P('issuer-records', 'sync-result', ['Отправляет записи', 'При появлении сети. Сервер проверяет каждую запись и ставит флаг.'], { actor: 'Завхоз' }),
      ],
    },
    { id: 'design-system', file: '01-design-system', doc: 'kit' },
    {
      id: 'login', file: '02-login', eyebrow: 'Вход и регистрация', title: 'Вход',
      lead: 'Телефон и пароль. Номер можно вводить в привычном виде — с 8, 7 или +7, маска приводит его к виду +7 (XXX) XXX‑XX‑XX. На компьютере слева короткое объяснение, что это за система, и пример наклейки.',
      items: [P('login', 'default', ['Телефон', 'Поля крупные, кнопка во всю ширину.']), W('login', 'default', ['Компьютер', 'Форма справа, слева — графитовая панель с перфорацией.'])],
    },
    {
      id: 'login-errors', file: '03-login-errors', eyebrow: 'Вход и регистрация', title: 'Вход: ошибки и особые случаи',
      lead: 'Заголовок ошибки — текст из поля detail ответа сервера. Чтобы оформлять «не подтверждён» и «уволен» по-разному без разбора текста, API стоит отдавать код причины (см. api-notes.md).',
      items: [
        P('login', 'wrong', ['Неверный пароль · 401', 'Поле пароля очищено, фокус в нём.']),
        P('login', 'pending', ['Не подтверждён · 403', 'Спокойный жёлтый: ошибки нет, нужно подождать.']),
        P('login', 'fired', ['Уволен · 403', 'Нейтрально, без обвинений.']),
        P('login', 'offline', ['Нет сети', 'Вход требует интернета, кнопка неактивна.']),
        P('login', 'expired', ['Сессия истекла', 'Через 12 часов. Записи смены не теряются.']),
      ],
    },
    {
      id: 'register', file: '04-register', eyebrow: 'Вход и регистрация', title: 'Регистрация',
      lead: 'ФИО до 100 символов — оно попадает в QR-код. Пароль вводится дважды: восстановления пароля нет, а занятый номер повторно не зарегистрировать. Роль выбирается карточками с пояснением.',
      items: [
        P('register', 'default', ['Заполненная форма', 'Счётчик символов у ФИО.'], { tall: true }),
        P('register', 'errors', ['Ошибки полей · 400', 'Ключи errors из ответа — у своих полей.'], { tall: true }),
        P('register', 'conflict', ['Номер занят · 409', 'Сообщение сверху и у поля телефона.'], { tall: true }),
        P('register-done', null, ['Заявка отправлена', 'Что будет дальше — по шагам.']),
      ],
    },
    {
      id: 'worker-home', file: '05-worker-home', eyebrow: 'Сотрудник · телефон', title: 'Главная: сертификат на смену',
      lead: 'Главный вопрос сотрудника — можно ли сейчас формировать QR-коды. Карточка сертификата отвечает цветом, словом и временем. Кнопка сканирования неактивна, пока действующего сертификата нет.',
      items: [
        P('worker-home', 'ready', ['Действует', 'Время до конца и полоса остатка.']),
        P('worker-home', 'expiring', ['Скоро истечёт', 'Меньше часа — просим обновить, пока есть сеть.']),
        P('worker-home', 'no-cert-online', ['Первый вход', 'Имени ещё нет — показываем номер телефона.']),
        P('worker-home', 'no-cert-offline', ['Истёк, нет сети', 'Объясняем, что нужен интернет.']),
        P('worker-home', 'denied', ['Сертификат не выдан · 403', 'Текст из ответа сервера.']),
      ],
    },
    {
      id: 'worker-scan', file: '06-worker-scan', eyebrow: 'Сотрудник · телефон', title: 'Сканирование наклейки',
      lead: 'Полноэкранная камера с рамкой, фонарик для тёмной кладовой. Если в кадр попал QR-код сотрудника вместо наклейки, приложение говорит, что не так.',
      items: [
        P('worker-scan', 'scan', ['Поиск наклейки', 'Код распознаётся сам, без кнопки.']),
        P('worker-scan', 'wrong-code', ['Не тот код', 'Подсказка поверх камеры.']),
        P('worker-scan', 'no-camera', ['Нет доступа к камере', 'Как разрешить — в два шага.']),
      ],
    },
    {
      id: 'worker-op-qr', file: '07-worker-operation-qr', eyebrow: 'Сотрудник · телефон', title: 'Операция и QR-код для завхоза',
      lead: 'Два крупных решения: «Беру / Возвращаю» и состояние. При возврате состояние не отмечено заранее. QR-код всегда чёрный на белом, даже в тёмной теме. Он действует минуту — таймер показывает остаток.',
      items: [
        P('worker-op', 'take', ['Беру · исправен', 'При выдаче «Исправен» выбран по умолчанию.']),
        P('worker-op', 'give-damaged', ['Возвращаю · повреждён', 'При возврате выбор только явный.']),
        P('worker-qr', 'active', ['QR-код действует', 'Кольцо таймера и подсказка про яркость.']),
        P('worker-qr', 'expired', ['QR-код устарел', 'Новый формируется одной кнопкой.']),
      ],
    },
    {
      id: 'issuer-shift', file: '08-issuer-shift-phone', eyebrow: 'Завхоз · станция выдачи', title: 'Смена',
      lead: 'Экран отвечает на три вопроса: готово ли устройство к работе без сети, сколько записей ждут отправки и что происходило за смену. Нет сети — не ошибка: выдача продолжается, записи копятся на устройстве.',
      items: [
        P('issuer-shift', 'online', ['Всё готово', 'Ключ, реестр, часы и вход в порядке.'], { tall: true }),
        P('issuer-shift', 'offline', ['Нет сети', 'Работа продолжается, отправка позже.'], { tall: true }),
        P('issuer-shift', 'needs-prep', ['Первый запуск', 'Без ключа и реестра сканировать нельзя.'], { tall: true }),
        P('issuer-shift', 'session', ['Вход истёк', 'Сканировать можно, для отправки — войти.'], { tall: true }),
      ],
    },
    {
      id: 'issuer-shift-desktop', file: '09-issuer-shift-desktop', eyebrow: 'Завхоз · компьютер', title: 'Смена на компьютере',
      lead: 'Та же информация в две колонки: слева отправка и последние записи, справа готовность и счётчики. Кнопка сканирования — в боковой панели.',
      items: [W('issuer-shift', 'online', ['Смена', 'Компьютер у стойки выдачи.'])],
    },
    {
      id: 'issuer-scan', file: '10-issuer-scan', eyebrow: 'Завхоз', title: 'Сканер QR-кода сотрудника',
      lead: 'На телефоне — камера. На компьютере у стойки — поле для ручного 2D-сканера, который вводит код как клавиатура. Частая проблема таких сканеров — русская раскладка, подсказка про неё рядом.',
      items: [P('issuer-scan', 'camera', ['Телефон', 'Счётчик неотправленных записей внизу.']), W('issuer-scan', 'desktop', ['Компьютер и 2D-сканер', 'Поле ждёт код, камера — запасной вариант.'])],
    },
    {
      id: 'verify-ok', file: '11-issuer-verify-ok', eyebrow: 'Завхоз · проверка QR', title: 'Проверка: всё в порядке',
      lead: 'Цветная полоса сразу говорит, что происходит: синяя — выдача, графитовая — возврат. Ниже — кто, что и в каком состоянии. Шесть проверок свёрнуты в одну зелёную строку.',
      items: [P('issuer-verify', 'ok-take', ['Выдача', 'Состояние совпадает с реестром.']), P('issuer-verify', 'ok-give', ['Возврат', 'Инструмент возвращается исправным.'])],
    },
    {
      id: 'verify-warnings', file: '12-issuer-verify-warnings', eyebrow: 'Завхоз · проверка QR', title: 'Проверка: предупреждения',
      lead: 'Подписи верны, но данные расходятся с тем, что знает устройство. Решает завхоз: подтверждение доступно после отметки об осмотре. Сервер эти предупреждения не повторяет.',
      items: [
        P('issuer-verify', 'warn-condition', ['Состояние хуже, чем в реестре', '«Исправен» → «Повреждён». Осмотреть.']),
        P('issuer-verify', 'warn-unknown', ['Нет в реестре устройства', 'Инструмент добавили после загрузки реестра.']),
        P('issuer-verify', 'warn-order', ['Уже числится на месте', 'Похоже на второй QR на тот же возврат.']),
      ],
    },
    {
      id: 'verify-rejected', file: '13-issuer-verify-rejected', eyebrow: 'Завхоз · проверка QR', title: 'Проверка: отклонено',
      lead: 'Проверки идут в том же порядке, что на сервере; первая непройденная останавливает остальные. Запись в журнал не попадает. Завхоз видит понятную причину и что делать дальше.',
      items: [
        P('issuer-verify', 'reject-format', ['Не тот код', 'Строка не в формате AT1.']),
        P('issuer-verify', 'reject-signature', ['Подпись не сходится', 'Имя из кода помечено как непроверенное.']),
        P('issuer-verify', 'reject-expired', ['Сертификат истёк', 'Сотруднику нужен новый — через сеть.']),
        P('issuer-verify', 'reject-time', ['QR-код устарел', 'Больше 60 секунд с момента создания.']),
        P('issuer-verify', 'reject-duplicate', ['Уже принят', 'Та же подпись есть в журнале смены.']),
      ],
    },
    {
      id: 'issuer-records', file: '14-issuer-records', eyebrow: 'Завхоз · станция выдачи', title: 'Записи смены и отправка',
      lead: 'Локальный журнал устройства. У каждой записи статус: не отправлена, подтверждена сервером или помечена флагом. Записи с ошибкой формата откладываются, чтобы одна строка не блокировала остальные.',
      items: [
        P('issuer-records', 'pending', ['Ждут отправки', 'Фильтры по статусу, кнопка отправки.']),
        P('issuer-records', 'sync-result', ['Итог отправки', 'Сколько подтверждено и что помечено.']),
        P('issuer-records', 'deferred', ['Отложенная запись · 400', 'Сервер не принял строку, остальные ушли.']),
      ],
    },
    {
      id: 'tools-table', file: '15-tools-table', eyebrow: 'Инструменты', title: 'Реестр: таблица',
      lead: 'Номер, название, состояние, комментарий и где сейчас инструмент. У завхоза под держателем отмечены операции, которые это устройство ещё не отправило: сервер о них пока не знает.',
      items: [W('tools', 'table', ['Завхоз', 'Строка под курсором подсвечена.'], { role: 'Issuer' })],
    },
    {
      id: 'tools-board', file: '16-tools-board', eyebrow: 'Инструменты', title: 'Реестр: стенд',
      lead: 'Вид как у инструментальной стены: взятый инструмент оставляет пунктирный силуэт с именем сотрудника, сломанный помечен сигнальной лентой. Видно, чего не хватает, не читая таблицу.',
      items: [W('tools', 'board', ['Владелец', 'Та же выборка, что в таблице.'], { role: 'Owner' })],
    },
    {
      id: 'tools-phone', file: '17-tools-phone', eyebrow: 'Инструменты', title: 'Реестр на телефоне',
      lead: 'Таблица превращается в список, фильтры — в прокручиваемую строку. Пустой реестр сразу предлагает добавить первый инструмент.',
      items: [P('tools', 'table', ['Список', 'Держатель справа.'], { role: 'Issuer' }), P('tools', 'board', ['Стенд', 'Две колонки плиток.'], { role: 'Issuer' }), P('tools', 'empty', ['Пустой реестр', 'Первое действие — добавить.'], { role: 'Issuer' })],
    },
    {
      id: 'tool-new', file: '18-tool-new', eyebrow: 'Инструменты', title: 'Новый инструмент',
      lead: 'Одно поле — название, до 100 символов. Номер присваивает сервер; сразу после добавления предлагается напечатать наклейку.',
      items: [W('tool-new', 'form', ['Форма', 'Счётчик символов и подсказка.']), W('tool-new', 'created', ['Готово', 'Наклейка с присвоенным номером.'])],
    },
    {
      id: 'tool-card', file: '19-tool-card', eyebrow: 'Инструменты', title: 'Карточка инструмента',
      lead: 'Состояние с комментарием, у кого сейчас инструмент, история операций и наклейка. Если при возврате состояние стало хуже, чем при выдаче, это видно в истории.',
      items: [W('tool-card', 'on-hands', ['Компьютер', 'Инструмент на руках.'], { role: 'Issuer', tall: true }), P('tool-card', 'on-hands', ['Телефон', 'Экран целиком.'], { role: 'Issuer', tall: true })],
    },
    {
      id: 'tool-card-owner', file: '20-tool-card-owner', eyebrow: 'Инструменты · владелец', title: 'Карточка: списание',
      lead: 'Владельцу доступна зона списания с сигнальной лентой. Списание необратимо, поэтому последствия перечислены в диалоге, а причина сохраняется в комментарии инструмента.',
      items: [W('tool-card', 'broken', ['Сломанный инструмент', 'Зона списания внизу справа.'], { role: 'Owner' }), W('tool-card', 'write-off', ['Диалог списания', 'Последствия и причина.'], { role: 'Owner' })],
    },
    {
      id: 'tool-card-states', file: '21-tool-card-states', eyebrow: 'Инструменты', title: 'Ручное изменение и списанный инструмент',
      lead: 'Ручное изменение — для ремонта и поломок вне выдачи; обычно состояние обновляется само по подтверждённым возвратам. Списанный инструмент открывается по прямой ссылке и из журнала.',
      items: [W('tool-card', 'edit', ['Изменить состояние', 'Меняются только тронутые поля.'], { role: 'Issuer' }), W('tool-card', 'written-off', ['Списанный', 'История сохранена.'], { role: 'Owner' })],
    },
    {
      id: 'stickers', file: '22-stickers', eyebrow: 'Инструменты', title: 'Печать наклеек',
      lead: 'Лист А4 на 24 наклейки 70×37 мм или термопринтер 58×40 мм. Можно начать с любой ячейки, чтобы допечатать начатый лист. На наклейке крупный номер: его читают глазами, когда QR-код затёрт.',
      items: [W('stickers', 'a4', ['Лист А4', 'Первые три ячейки уже использованы.'], { tall: true }), W('stickers', 'thermal', ['Термопринтер', 'По одной наклейке на отрыв.'], { tall: true })],
    },
    {
      id: 'journal', file: '23-journal', eyebrow: 'Журнал', title: 'Журнал операций',
      lead: 'Все синхронизированные записи, новые сверху. Проблемные отмечены полосой слева и флагом. Имена, взятые из непроверенного QR-кода, выделены курсивом со знаком «?».',
      items: [W('journal', 'all', ['Владелец', 'Видит имена завхозов, в том числе уволенных.'], { role: 'Owner' })],
    },
    {
      id: 'journal-details', file: '24-journal-details', eyebrow: 'Журнал', title: 'Разбор записи',
      lead: 'Панель объясняет флаг простыми словами и подсказывает, что делать. Завхоз видит коллег как «Завхоз № 3»: имён пользователей в доступном ему API нет.',
      items: [W('journal', 'entry-drift', ['Расхождение времени', 'Вид завхоза.'], { role: 'Issuer' }), W('journal', 'entry-forged', ['Поддельный сертификат', 'Вид владельца.'], { role: 'Owner' })],
    },
    {
      id: 'journal-phone', file: '25-journal-phone', eyebrow: 'Журнал', title: 'Журнал на телефоне',
      lead: 'Карточки вместо таблицы. У подтверждённых записей справа заявленное состояние, у проблемных — флаг.',
      items: [P('journal', 'all', ['Все записи', ''], { role: 'Owner' }), P('journal', 'problems', ['Требуют внимания', 'Фильтр по флагам.'], { role: 'Owner' })],
    },
    {
      id: 'owner-overview', file: '26-owner-overview', eyebrow: 'Владелец', title: 'Обзор',
      lead: 'Сводка на одном экране: цифры, список того, что требует решения, активность за две недели и повреждения при возврате — кто вернул инструмент в худшем состоянии, чем взял.',
      items: [W('owner-overview', null, ['Компьютер', 'Подсказка над столбцом — при наведении.'], { tall: true })],
    },
    {
      id: 'owner-overview-phone', file: '27-owner-overview-phone', eyebrow: 'Владелец', title: 'Обзор на телефоне',
      lead: 'Те же блоки одной колонкой. Плитки по две в ряд.',
      items: [P('owner-overview', null, ['Экран целиком', ''], { tall: true })],
    },
    {
      id: 'users', file: '28-users', eyebrow: 'Владелец', title: 'Пользователи',
      lead: 'Три вкладки: заявки, работают, уволены. Обычную роль подтверждают одной кнопкой, роль владельца — через диалог. Себя уволить нельзя, поэтому у своей строки действий нет.',
      items: [W('users', 'requests', ['Заявки', 'Запрос роли владельца выделен.']), W('users', 'active', ['Работают', '«Это вы» вместо кнопки.'])],
    },
    {
      id: 'users-dialogs', file: '29-users-dialogs', eyebrow: 'Владелец', title: 'Подтверждение, увольнение, отказ',
      lead: 'Каждое необратимое действие называет последствия: доступ пропадает не сразу, номер остаётся занят, вернуть человека нельзя. На телефоне диалог становится нижней шторкой.',
      items: [W('users', 'approve-owner', ['Подтвердить владельца', '']), W('users', 'dismiss', ['Уволить', 'Предупреждение об инструменте на руках.']), P('users', 'reject', ['Отклонить заявку', 'Нижняя шторка на телефоне.'])],
    },
    {
      id: 'users-phone', file: '30-users-phone', eyebrow: 'Владелец', title: 'Пользователи на телефоне',
      lead: 'Карточки людей с действиями прямо в карточке.',
      items: [P('users', 'requests', ['Заявки', '']), P('users', 'active', ['Работают', ''])],
    },
    { id: 'states', file: '31-states-and-errors', doc: 'states' },
    {
      id: 'dark-phone', file: '32-dark-phone', theme: 'dark', eyebrow: 'Тёмная тема', title: 'Тёмная тема на телефоне',
      lead: 'Для тёмных складов и экономии батареи; включается по настройке системы. QR-код и наклейки остаются чёрными на белом.',
      items: [P('worker-home', 'ready', ['Главная сотрудника', '']), P('worker-qr', 'active', ['QR-код', 'Белая подложка сохраняется.']), P('issuer-verify', 'ok-take', ['Проверка QR', '']), P('issuer-shift', 'online', ['Смена', ''])],
    },
    {
      id: 'dark-desktop', file: '33-dark-desktop', theme: 'dark', eyebrow: 'Тёмная тема', title: 'Тёмная тема на компьютере',
      lead: 'Те же токены с тёмными значениями: контраст текста не ниже 4.5:1, смысловые цвета светлее, чтобы читаться на тёмном фоне.',
      items: [W('tools', 'board', ['Стенд', ''], { role: 'Owner' }), W('journal', 'entry-forged', ['Разбор записи', ''], { role: 'Owner' })],
    },
  ];

  /* ---------------- Доска с макетами ---------------- */
  function renderBoard(b) {
    if (b.doc === 'kit') return renderKit();
    if (b.doc === 'states') return renderStates();
    const parts = [];
    b.items.forEach((item, k) => {
      if (b.flow && k > 0) {
        if (item.actor !== b.items[k - 1].actor) parts.push('<div class="lane-break"></div>');
        else parts.push(`<div class="flow-arrow">${icon('arrow-r')}</div>`);
      }
      const [title, text] = item.cap || ['', ''];
      const n = b.flow ? `<span class="shot__n">${k + 1}</span>` : '';
      parts.push(`<figure class="shot" style="width:${frameWidth(item)}px">${frame(item)}
        <figcaption>${b.flow ? `<span class="shot__actor">${esc(item.actor)}</span>` : ''}<span class="shot__title">${n}${esc(title)}</span>${text ? `<span class="shot__text">${esc(text)}</span>` : ''}</figcaption></figure>`);
    });
    return `<section class="sheet-board"${b.theme ? ` data-theme="${b.theme}"` : ''}>
      <header class="sheet-board__head">
        <div class="sheet-board__eyebrow">${U.logoMark()}<span>AccountThis · ${esc(b.eyebrow)}</span></div>
        <h1 class="sheet-board__title">${esc(b.title)}</h1>
        <p class="sheet-board__lead">${esc(b.lead)}</p>
      </header>
      <div class="shots">${parts.join('')}</div>
    </section>`;
  }

  /* ---------------- Лист «Дизайн-система» ---------------- */
  function section(title, lead, body) {
    return `<section class="doc-section"><div class="doc-section__head"><h2 class="doc-section__title">${esc(title)}</h2>${lead ? `<p class="doc-section__lead">${lead}</p>` : ''}</div>${body}</section>`;
  }
  function swatch(token, role) {
    return `<div class="swatch" data-token="${token}"><div class="swatch__chip"><span style="background:var(${token})"></span><span data-theme="dark" style="background:var(${token})"></span></div>
      <div class="swatch__name">${token}</div><div class="swatch__hex"><span data-hex="light"></span><span data-hex="dark"></span></div><div class="swatch__role">${esc(role)}</div></div>`;
  }
  function renderKit() {
    const colors = [
      ['Поверхности и линии', [['--canvas', 'Фон приложения'], ['--surface', 'Карточки, таблицы, поля'], ['--surface-2', 'Шапка таблицы, наведение'], ['--surface-3', 'Подложка переключателей'], ['--line', 'Разделители'], ['--line-strong', 'Границы полей и кнопок']]],
      ['Текст и акцент', [['--ink', 'Основной текст'], ['--ink-2', 'Вторичный текст'], ['--ink-3', 'Приглушённый, ≥ 4.5:1'], ['--accent', '«Синяя спецовка»: действия, фокус'], ['--accent-text', 'Ссылки, акцентный текст'], ['--give', 'Полоса «ВОЗВРАТ»']]],
      ['Смысловые', [['--good', 'Исправен, подтверждено'], ['--warn', 'Повреждён, требует проверки'], ['--bad', 'Сломан, отклонено, подозрительно'], ['--good-soft', 'Фон зелёных чипов'], ['--warn-soft', 'Фон жёлтых чипов'], ['--bad-soft', 'Фон красных чипов']]],
      ['Особые', [['--rail', 'Боковая панель, графит'], ['--board', 'Стенд инструментов'], ['--hazard-1', 'Сигнальная лента'], ['--cam', 'Видоискатель камеры'], ['--qr-bg', 'QR-код: всегда белый фон'], ['--chart-ok', 'График: обычные операции']]],
    ];
    const colorHtml = colors.map(([name, list]) => `<div class="stack"><span class="doc-label">${name}</span><div class="swatches">${list.map(([t, r]) => swatch(t, r)).join('')}</div></div>`).join('');

    const type = [
      ['<span class="t-display-1">ВЫДАЧА</span>', '<b>Unbounded 700</b> · 34 / 34 · слово результата проверки QR'],
      ['<span class="t-display-2">Инструменты</span>', '<b>Unbounded 600</b> · 26 / 30 · заголовок страницы на компьютере'],
      ['<span class="t-display-3">Смена</span>', '<b>Unbounded 600</b> · 19 / 23 · заголовок экрана на телефоне'],
      ['<span class="t-title">Готовность к работе без сети</span>', '<b>Golos Text 600</b> · 18 / 23 · заголовок блока'],
      ['<span style="font-size:17px">Покажите экран завхозу — он отсканирует код.</span>', '<b>Golos Text 400</b> · 17 / 25 · текст на телефоне'],
      ['<span style="font-size:15px">Подписи сервера и сотрудника верны, время в допуске.</span>', '<b>Golos Text 400</b> · 15 / 22 · текст на компьютере'],
      ['<span class="t-small">Последняя отправка сегодня в 12:40</span>', '<b>Golos Text 400</b> · 13 / 18 · подписи и пояснения'],
      ['<span class="t-label">Время операции</span>', '<b>Golos Text 600</b> · 12 · капс, разрядка 6 % · метки, шапки таблиц'],
      ['<span class="mono" style="font-size:14px">№ 0017 · 14:02:10 · +7 (900) 000-01-04</span>', '<b>JetBrains Mono 500</b> · 13–14 · номера, время, телефоны'],
      ['<span style="font-size:28px;font-weight:700">25</span>', '<b>Golos Text 700</b> · 28 · числа в плитках — не акцентным шрифтом'],
    ].map(([sample, spec]) => `<div class="type-row"><div>${sample}</div><div class="type-row__spec">${spec}</div></div>`).join('');

    const buttons = `<div class="doc-grid doc-grid--2">
      <div class="doc-cell"><span class="doc-label">Компьютер · 40 px</span><div class="row">${U.btn('Добавить инструмент', { kind: 'primary', icon: 'plus' })}${U.btn('Печать наклеек', { kind: 'secondary', icon: 'printer' })}${U.btn('Весь журнал', { kind: 'ghost', iconEnd: 'chev-r' })}</div>
        <div class="row">${U.btn('Списать', { kind: 'danger', icon: 'archive' })}${U.btn('Списать инструмент', { kind: 'danger-outline', icon: 'archive' })}${U.btn('Подтвердить возврат', { kind: 'give' })}${U.btn('Недоступно', { kind: 'primary', disabled: true })}</div>
        <div class="row">${U.btn('Подтвердить', { kind: 'primary', size: 's', icon: 'check' })}${U.btn('Отклонить', { kind: 'secondary', size: 's' })}${U.btn('Обновить', { kind: 'ghost', size: 's', icon: 'refresh' })}</div></div>
      <div class="doc-cell"><span class="doc-label">Телефон · 56 и 64 px</span><div style="max-width:380px" class="stack">${U.btn('Показать QR завхозу', { kind: 'primary', size: 'l', block: true, icon: 'qr' })}<button class="cta" type="button">${icon('scan')}Сканировать инструмент</button><div class="actions-bar--2" style="display:grid;gap:10px">${U.btn('Отказать', { kind: 'secondary', size: 'l' })}${U.btn('Подтвердить выдачу', { kind: 'primary', size: 'l' })}</div></div></div>
    </div>`;

    const fields = `<div class="doc-grid doc-grid--4">
      <div class="doc-cell doc-cell--plain">${U.field({ label: 'Телефон', value: '+7 (900) 000-01-04', hint: 'Можно начать с 8 или +7' })}</div>
      <div class="doc-cell doc-cell--plain">${U.field({ label: 'ФИО', value: 'Петров Алексей', counter: '14 / 100', focus: true })}</div>
      <div class="doc-cell doc-cell--plain">${U.field({ label: 'Телефон', value: '+7 (900) 000-01', error: 'Нужно 10 цифр после кода' })}</div>
      <div class="doc-cell doc-cell--plain">${U.field({ label: 'Код с экрана сотрудника', placeholder: 'Ожидаю код…', mono: true, lead: 'qr', disabled: true })}</div>
    </div>
    <div class="doc-grid doc-grid--3">
      <div class="doc-cell doc-cell--plain"><span class="doc-label">Выбор карточкой</span><div class="choices">${['Good', 'Damaged'].map((c, k) => { const d = D.DICT.condition[c]; return `<div class="choice choice--${d.tone}${k === 1 ? ' is-on' : ''}"><span class="choice__icon">${icon(d.icon)}</span><span><span class="choice__title">${d.label}</span><span class="choice__desc">${d.desc}</span></span><span class="choice__mark">${icon('check')}</span></div>`; }).join('')}</div></div>
      <div class="doc-cell doc-cell--plain stack"><span class="doc-label">Переключатели и фильтры</span>${U.seg([['table', 'Таблица', 'table'], ['board', 'Стенд', 'board']], 'board')}<div class="row"><span class="fchip is-on">Все <span class="fchip__n">25</span></span><span class="fchip">На руках <span class="fchip__n">8</span></span><span class="fchip fchip--select">${icon('calendar')}7 дней${icon('chev-d')}</span></div><div class="tabs"><span class="tabs__item is-on">Заявки <span class="count">3</span></span><span class="tabs__item">Работают <span class="count">11</span></span></div></div>
      <div class="doc-cell doc-cell--plain stack"><span class="doc-label">Сообщения</span>${U.alert('warn', 'alert', 'Состояние отличается от реестра', 'Осмотрите инструмент.')}${U.checkbox(true, 'Инструмент осмотрен')}<div class="toast toast--static">${icon('check-circle')}Инструмент № 0026 добавлен</div></div>
    </div>`;

    const F = D.DICT.flag;
    const dict = `<div class="doc-grid doc-grid--2">
      <div class="stack-l">
        <table class="dict"><thead><tr><th>ToolCondition</th><th>Показываем</th><th>Смысл</th></tr></thead><tbody>
          ${Object.entries(D.DICT.condition).map(([k, d]) => `<tr><td>${k}</td><td>${U.cond(k)}</td><td>${esc(d.desc)}</td></tr>`).join('')}</tbody></table>
        <table class="dict"><thead><tr><th>RentalAction</th><th>Показываем</th><th>Сотруднику / завхозу</th></tr></thead><tbody>
          ${Object.entries(D.DICT.action).map(([k, d]) => `<tr><td>${k}</td><td>${U.act(k)}</td><td>«${d.verb}» · полоса «${d.band}»</td></tr>`).join('')}</tbody></table>
        <table class="dict"><thead><tr><th>UserRole</th><th>Показываем</th><th></th></tr></thead><tbody>
          ${Object.entries(D.DICT.role).map(([k, d]) => `<tr><td>${k}</td><td>${U.roleChip(k)}</td><td>${esc(d.desc)}</td></tr>`).join('')}</tbody></table>
        <table class="dict"><thead><tr><th>isApproved / isActive</th><th>Показываем</th></tr></thead><tbody>
          <tr><td>false / true</td><td>${U.userStatus({ isApproved: false, isActive: true })}</td></tr>
          <tr><td>true / true</td><td>${U.userStatus({ isApproved: true, isActive: true })}</td></tr>
          <tr><td>true / false</td><td>${U.userStatus({ isApproved: true, isActive: false })}</td></tr>
          <tr><td>false / false</td><td>${U.userStatus({ isApproved: false, isActive: false })}</td></tr></tbody></table>
      </div>
      <table class="dict"><thead><tr><th>ValidationFlag</th><th>Показываем</th><th>Группа и смысл</th></tr></thead><tbody>
        ${D.FLAG_ORDER.map((k) => `<tr><td>${k}</td><td>${U.flag(k)}</td><td><b>${D.DICT.flagGroup[F[k].group].label}.</b> ${esc(F[k].text)}</td></tr>`).join('')}
        <tr><td>holderId</td><td>${U.place(D.TOOLS.find((t) => t.id === 4))}</td><td>На руках: ФИО держателя и с какого времени. <b>null</b> — «На месте».</td></tr>
      </tbody></table>
    </div>`;

    const icons = `<div class="icons">${Object.keys(U.ICONS).map((n) => `<div class="icons__cell">${icon(n)}<span>${n}</span></div>`).join('')}</div>`;

    const misc = `<div class="doc-grid doc-grid--3">
      <div class="doc-cell stack"><span class="doc-label">Наклейка 70×37 мм (лист А4, 3 × 8)</span>${U.sticker(D.TOOLS_ALL.find((t) => t.id === 17), { width: 360 })}</div>
      <div class="doc-cell stack"><span class="doc-label">Наклейка 58×40 мм (термопринтер)</span>${U.sticker(D.TOOLS_ALL.find((t) => t.id === 5), { width: 300, thermal: true })}</div>
      <div class="doc-cell stack"><span class="doc-label">Отступы, радиусы, касание</span>
        <div class="scale">${[4, 8, 12, 16, 24, 32, 48].map((s) => `<div class="scale__item"><div class="scale__box" style="width:${s}px;height:${s}px"></div>${s}</div>`).join('')}</div>
        <div class="scale">${[['4', 'чип'], ['6', 'плитка'], ['8', 'кнопка'], ['12', 'карточка'], ['20', 'шторка']].map(([r, n]) => `<div class="scale__item"><div class="scale__box" style="width:48px;height:36px;border-radius:${r}px"></div>${r} · ${n}</div>`).join('')}</div>
        <p class="t-small ink-2">Касание на телефоне — не меньше 48 px; главная кнопка — 56 px, «Сканировать» — 64 px. На компьютере кнопки 40 px, строки таблиц 48 px.</p></div>
    </div>`;

    return `<section class="sheet-board"><div class="doc"><div class="screen-root"><div class="app" style="display:grid;gap:28px">
      <header class="sheet-board__head" style="margin:0">
        <div class="sheet-board__eyebrow">${U.logoMark()}<span>AccountThis · Дизайн-система</span></div>
        <h1 class="sheet-board__title">Сталь и синяя спецовка</h1>
        <p class="sheet-board__lead">Спокойные стальные поверхности, один синий акцент для действий и отдельные смысловые цвета для состояний. Цвет никогда не работает один — всегда вместе с иконкой и словом. Каждый цвет — токен из tokens.css: слева на плашке светлая тема, справа тёмная.</p>
      </header>
      ${section('Цвета', null, colorHtml)}
      ${section('Типографика', 'Unbounded — только логотип, заголовки страниц и крупные слова статуса. Golos Text — весь интерфейс. JetBrains Mono — всё, что сверяют посимвольно: номера, время, телефоны.', type)}
      ${section('Кнопки', 'Одна основная кнопка на экран. Красная — только для необратимого: списание, увольнение, отказ в заявке.', buttons)}
      ${section('Поля, выбор, сообщения', null, fields)}
      ${section('Как показывать значения API', 'Сырые значения enum в интерфейс не выводятся. Цвет чипа — по смыслу, иконка и слово — всегда.', dict)}
      ${section('Иконки', 'Контур 2 px на сетке 24 × 24, скруглённые концы. Рисуются в цвете текста.', icons)}
      ${section('Наклейки и размеры', null, misc)}
    </div></div></div></section>`;
  }

  /* ---------------- Лист «Состояния и ошибки» ---------------- */
  function renderStates() {
    const cell = (label, body, note) => `<div class="doc-cell stack"><span class="doc-label">${label}</span>${body}${note ? `<p class="t-small ink-2">${note}</p>` : ''}</div>`;
    const errors = `<div class="doc-grid doc-grid--3">
      ${cell('401 · сессия истекла', U.alert('info', 'info', 'Сессия истекла', 'Вход действует 12 часов. Войдите снова — данные на устройстве сохранятся.') + '<div>' + U.btn('Войти', { kind: 'primary' }) + '</div>', 'Ответ без тела. Приложение переводит на вход и возвращает на ту же страницу. Завхоз без сети продолжает сканировать.')}
      ${cell('403 без тела · нет прав', `<div class="card"><div class="empty" style="padding:24px"><span class="empty__icon">${icon('lock')}</span><div class="empty__title">Раздел недоступен</div><p class="empty__text">Он открыт владельцу. Если нужен доступ — обратитесь к нему.</p></div></div>`, 'Роль не подходит. Пункты меню, недоступные роли, вообще не показываются.')}
      ${cell('403 с detail · бизнес-запрет', U.alert('neutral', 'lock', 'Сотрудник уволен, сертификат не выдаётся', 'Текст — из поля detail.'), 'Заголовок сообщения — detail из ProblemDetails как есть.')}
      ${cell('404 · не найдено', `<div class="card"><div class="empty" style="padding:24px"><span class="empty__icon">${icon('search')}</span><div class="empty__title">Инструмент с id 99 не найден</div><p class="empty__text">Возможно, ссылка устарела.</p>${U.btn('К реестру', { kind: 'secondary' })}</div></div>`)}
      ${cell('409 · конфликт', U.alert('bad', 'octagon-x', 'Нельзя уволить самого себя', 'Ответ сервера на попытку уволить себя. В интерфейсе кнопки для своей строки нет, сообщение — на случай гонки.'))}
      ${cell('Сбой сети или сервера', U.alert('bad', 'alert', 'Не удалось загрузить журнал', 'Проверьте интернет и повторите. Код для поддержки: <span class="mono">00-4bf92f35…-00</span>') + `<div class="row">${U.btn('Повторить', { kind: 'primary', icon: 'refresh' })}${U.btn('Скопировать код', { kind: 'secondary', icon: 'copy' })}</div>`, 'traceId из ProblemDetails показываем как «код для поддержки» с кнопкой копирования.')}
    </div>`;
    const validation = `<div class="doc-grid doc-grid--3">
      ${cell('400 · ошибки полей', U.field({ label: 'ФИО', value: 'Петров Алексей Сергеевич Петров Алексей Сергеевич Петров Алексей Сергеевич Петров…', counter: '103 / 100', error: 'Не длиннее 100 символов — ФИО попадает в QR-код' }), 'Ключ errors «fullName» → поле ФИО. Текст сервера на английском заменяем своим по имени поля; неизвестный ключ — общим сообщением над формой.')}
      ${cell('400 · записи синхронизации', U.alert('bad', 'alert', 'Запись 10:15 отложена', 'Ключ «[3].qr» — четвёртая запись пакета. Её откладываем, остальные отправляем повторно.'), 'Номер в ключе — индекс в отправленном массиве, с нуля.')}
      ${cell('Уведомления', `<div class="stack"><div class="toast toast--static">${icon('check-circle')}Инструмент № 0026 добавлен</div><div class="toast toast--static">${icon('upload')}Отправлено 7 записей</div></div>`, 'Короткий итог действия, исчезает через 4 секунды. Ошибки в уведомления не прячем.')}
    </div>`;
    const net = `<div class="doc-grid doc-grid--3">
      ${cell('Статус сети', `<div class="row">${U.net(true)}${U.net(false)}</div>`, 'Нет сети — не ошибка: серый цвет, без тревоги.')}
      ${cell('Полоса «нет сети»', `<div class="banner" style="border:1px solid var(--neutral-line);border-radius:8px">${icon('wifi-off')}<span>Нет сети. Показаны данные на 08:03.</span></div>`, 'На страницах, которым нужна сеть, оставляем последние загруженные данные и пишем, на какое они время.')}
      ${cell('Обновление без мигания', `<div class="list" style="opacity:.55">${D.TOOLS.slice(0, 2).map((t) => `<div class="list__item"><span class="list__title">${esc(t.name)}</span>${U.cond(t.condition)}</div>`).join('')}</div><span class="t-small muted row">${icon('refresh', 'i--s')}Обновляется…</span>`, 'При повторной загрузке старые данные остаются на месте, приглушёнными.')}
    </div>`;
    const empty = `<div class="doc-grid doc-grid--3">
      ${cell('Первая загрузка', `<div class="list">${[0, 1, 2, 3].map(() => '<div class="list__item"><div class="stack-s"><span class="skel" style="width:180px"></span><span class="skel" style="width:110px"></span></div><span class="skel" style="width:70px;height:22px"></span></div>').join('')}</div>`, 'Скелет повторяет форму будущего списка.')}
      ${cell('Журнал пуст', `<div class="card"><div class="empty" style="padding:24px"><span class="empty__icon">${icon('list')}</span><div class="empty__title">Записей пока нет</div><p class="empty__text">Они появятся, когда завхоз отправит первые выдачи.</p></div></div>`)}
      ${cell('Фильтр ничего не нашёл', `<div class="card"><div class="empty" style="padding:24px"><span class="empty__icon">${icon('filter')}</span><div class="empty__title">Ничего не найдено</div><p class="empty__text">Нет записей «Подозрительные» за 7 дней.</p>${U.btn('Сбросить фильтры', { kind: 'secondary' })}</div></div>`)}
    </div>`;
    return `<section class="sheet-board"><div class="doc"><div class="screen-root"><div class="app" style="display:grid;gap:28px">
      <header class="sheet-board__head" style="margin:0">
        <div class="sheet-board__eyebrow">${U.logoMark()}<span>AccountThis · Общие состояния</span></div>
        <h1 class="sheet-board__title">Ошибки, загрузка и пустые экраны</h1>
        <p class="sheet-board__lead">Как интерфейс отвечает на коды ответа из api.yaml. Для 401 и 403 без тела тексты свои; для ответов с ProblemDetails заголовок сообщения — поле detail, а traceId показываем как код для поддержки.</p>
      </header>
      ${section('Ответы сервера с ошибкой', null, errors)}
      ${section('Проверка полей и уведомления', null, validation)}
      ${section('Сеть и обновление', null, net)}
      ${section('Загрузка и пустые состояния', null, empty)}
    </div></div></div></section>`;
  }

  /** Подписывает шестнадцатеричные значения токенов на плашках дизайн-системы */
  function fillSwatches(root) {
    const probeDark = document.createElement('div');
    probeDark.setAttribute('data-theme', 'dark');
    root.appendChild(probeDark);
    const light = getComputedStyle(document.documentElement), dark = getComputedStyle(probeDark);
    root.querySelectorAll('[data-token]').forEach((el) => {
      const t = el.getAttribute('data-token');
      el.querySelector('[data-hex="light"]').textContent = light.getPropertyValue(t).trim();
      el.querySelector('[data-hex="dark"]').textContent = dark.getPropertyValue(t).trim();
    });
    probeDark.remove();
  }

  /* ---------------- Запуск ---------------- */
  function boot() {
    document.documentElement.setAttribute('data-theme', 'light');
    const params = new URLSearchParams(location.search);
    const id = params.get('board');
    const app = document.getElementById('boards');
    if (params.has('list')) return;
    if (id) {
      const b = BOARDS.find((x) => x.id === id || x.file === id);
      if (!b) { app.textContent = 'Нет доски ' + id; return; }
      app.innerHTML = renderBoard(b);
      document.title = b.file;
      if (b.theme === 'dark') document.body.setAttribute('data-theme', 'dark');
    } else {
      app.innerHTML = `<div class="gallery"><div class="gallery__intro"><h1>AccountThis — макеты интерфейса</h1><p>Все доски подряд. PNG-версии лежат в папке design/screens; пересобрать: <span class="mono">node design/source/export.mjs</span>.</p></div>
        ${BOARDS.map((b) => `<div class="gallery__item" data-board="${b.id}">${renderBoard(b)}</div>`).join('')}</div>`;
      const fit = () => app.querySelectorAll('.gallery__item').forEach((el) => {
        const board = el.firstElementChild;
        board.style.zoom = 1;
        board.style.zoom = Math.min(1, (window.innerWidth - 64) / board.scrollWidth).toFixed(3);
      });
      fit();
      window.addEventListener('resize', fit);
    }
    fillSwatches(app);
  }

  window.AT_BOARDS = BOARDS;
  window.AT_RENDER_BOARD = renderBoard;
  if (document.readyState === 'loading') document.addEventListener('DOMContentLoaded', boot); else boot();
})();
