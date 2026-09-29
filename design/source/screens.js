/* =====================================================================
   AccountThis — макеты экранов.
   SCREENS[id] = { title, path, render(variant, ctx) → HTML, frame(variant) → опции рамки }.
   ctx.role — 'Issuer' | 'Owner' для общих экранов.
   ===================================================================== */
(function () {
  'use strict';
  const D = window.AT_DATA, U = window.AT_UI;
  const { icon, esc } = U;
  const TOOL = (id) => D.TOOLS_ALL.find((t) => t.id === id);
  const USER = (id) => D.USERS_BY_ID[id];

  /* ---------- общие кусочки ---------- */
  function card(o) {
    return `<section class="card${o.cls ? ' ' + o.cls : ''}">
      ${o.title ? `<div class="card__head"><h2 class="card__title">${o.icon ? icon(o.icon) : ''}<span>${esc(o.title)}</span></h2>${o.aside || ''}</div>` : ''}
      <div class="card__body">${o.body}</div>
      ${o.foot ? `<div class="card__foot">${o.foot}</div>` : ''}
    </section>`;
  }
  const kv = (rows) => `<dl class="kv">${rows.map(([k, v]) => `<dt>${esc(k)}</dt><dd>${v}</dd>`).join('')}</dl>`;
  /** Инструмент в списке «ключ — значение»: название, под ним номер и пояснение */
  const toolLine = (t, extra) => `<span class="strong">${esc(t.name)}</span><span class="kv__sub">${U.inv(t.id)}${extra ? ' ' + extra : ''}</span>`;
  const workerHeader = (online) => `<header class="topbar"><div class="topbar__lead">${U.logo('logo--s')}</div><div class="topbar__actions">${U.net(online)}${U.iconBtn('more')}</div></header>`;
  const backHeader = (title, actions) => `<header class="topbar topbar--back"><div class="topbar__lead">${U.iconBtn('chev-l')}<div class="topbar__titles"><h1 class="topbar__title">${esc(title)}</h1></div></div><div class="topbar__actions">${actions || ''}</div></header>`;
  const localPending = D.LOCAL.filter((r) => r.status === 'pending');
  /** Локальные (неотправленные) операции этого устройства по инструментам — для завхоза */
  const localMarks = {};
  localPending.slice().reverse().forEach((r) => {
    localMarks[r.toolId] = (r.action === 'TAKE' ? 'Выдача ' : 'Возврат ') + U.time(r.scannedAt) + ' не отправлен' + (r.action === 'TAKE' ? 'а' : '');
  });

  /* =====================================================================
     ВХОД И РЕГИСТРАЦИЯ
     ===================================================================== */
  function authLayout(form) {
    return `<div class="app"><div class="auth">
      <aside class="auth__brand">
        ${U.logo('logo--light')}
        <div class="stack-l">
          <h2>Учёт и выдача инструмента</h2>
          <p>Сотрудник показывает QR-код с телефона, завхоз проверяет его без интернета. Каждая операция подписана и остаётся в журнале.</p>
          <ul class="auth__facts">
            <li>${icon('wifi-off')}<span>Выдача и приём работают без сети</span></li>
            <li>${icon('shield-check')}<span>Подписи защищают от подмены задним числом</span></li>
            <li>${icon('list')}<span>Журнал хранит каждую операцию</span></li>
          </ul>
        </div>
        ${U.sticker(TOOL(1), { width: 300 })}
      </aside>
      <main class="auth__main"><div class="auth__form">${form}</div></main>
    </div></div>`;
  }
  const authTop = (title, tag) => `<div class="auth__top">${U.logo()}<div><h1 class="t-display-3">${esc(title)}</h1><p class="auth__tag">${esc(tag)}</p></div></div>`;

  const SCREENS = {};

  SCREENS.login = {
    title: 'Вход', path: '/login',
    frame: (v) => ({ offline: v === 'offline' }),
    render(v) {
      const alerts = {
        wrong: U.alert('bad', 'octagon-x', 'Неверный телефон или пароль', 'Проверьте номер и пароль. Пароль чувствителен к регистру и раскладке клавиатуры.'),
        pending: U.alert('warn', 'clock', 'Аккаунт ещё не подтверждён владельцем', 'Войти можно после подтверждения. Уведомление не придёт — попробуйте позже.'),
        fired: U.alert('neutral', 'lock', 'Доступ закрыт', 'Аккаунт отключён владельцем. Войти с этим номером больше нельзя.'),
        offline: U.alert('neutral', 'wifi-off', 'Нет подключения к интернету', 'Для входа нужна сеть. Подключитесь к Wi‑Fi или мобильному интернету.'),
        expired: U.alert('info', 'info', 'Сессия истекла', 'Вход действует 12 часов. Войдите снова — записи смены сохранены на устройстве и отправятся после входа.'),
      };
      const wrong = v === 'wrong';
      return authLayout(`
        ${authTop('Вход', 'Учёт и выдача инструмента')}
        ${alerts[v] || ''}
        ${U.field({ label: 'Телефон', value: '+7 (900) 000-01-04', hint: v === 'default' ? 'Можно начать с 8 или +7 — формат подставится сам' : null })}
        ${U.field({ label: 'Пароль', value: wrong ? null : 10, password: true, placeholder: 'Введите пароль', suffix: 'eye', focus: wrong })}
        ${U.btn('Войти', { kind: 'primary', size: 'l', block: true, disabled: v === 'offline' })}
        <p class="auth__alt">Нет аккаунта? <b>Зарегистрироваться</b></p>
      `);
    },
  };

  SCREENS.register = {
    title: 'Регистрация', path: '/register',
    render(v) {
      const err = v === 'errors', conflict = v === 'conflict';
      const roles = ['Worker', 'Issuer', 'Owner'].map((r) => `
        <div class="choice${r === 'Worker' ? ' is-on' : ''}">
          <span class="choice__icon">${icon(r === 'Worker' ? 'wrench' : r === 'Issuer' ? 'clipboard' : 'shield')}</span>
          <span><span class="choice__title">${D.DICT.role[r].label}</span><span class="choice__desc">${D.DICT.role[r].desc}</span></span>
          <span class="choice__mark">${icon('check')}</span>
        </div>`).join('');
      return authLayout(`
        ${authTop('Регистрация', 'Заявку проверит владелец')}
        ${conflict ? U.alert('bad', 'octagon-x', 'Пользователь с таким телефоном уже существует', 'Если это ваш номер — войдите. Номер, который уже был в системе, повторно не регистрируется.') : ''}
        ${U.field({ label: 'ФИО', value: err ? null : 'Петров Алексей Сергеевич', placeholder: 'Фамилия Имя Отчество', counter: err ? '0 / 100' : '24 / 100', error: err ? 'Укажите ФИО' : null, hint: 'Как в документах. Попадёт в QR-код сотрудника.' })}
        ${U.field({ label: 'Телефон', value: err ? '+7 (900) 000-01' : '+7 (900) 000-01-04', error: err ? 'Нужен российский номер: +7, 7 или 8 и ещё 10 цифр' : conflict ? 'Этот номер уже зарегистрирован' : null, hint: err || conflict ? null : 'Будет логином. Один номер — один аккаунт.' })}
        ${U.field({ label: 'Пароль', value: 10, password: true, suffix: 'eye', hint: 'Восстановления пароля нет — запишите его.' })}
        ${U.field({ label: 'Повторите пароль', value: err ? 9 : 10, password: true, suffix: 'eye', error: err ? 'Пароли не совпадают' : null })}
        <div class="field"><div class="field__label"><span>Роль</span></div><div class="choices">${roles}</div></div>
        ${U.btn('Отправить заявку', { kind: 'primary', size: 'l', block: true })}
        <p class="auth__alt">Уже есть аккаунт? <b>Войти</b></p>
      `);
    },
  };

  SCREENS['register-done'] = {
    title: 'Заявка отправлена', path: '/register',
    render() {
      return authLayout(`
        <div class="auth__top">${U.logo()}</div>
        <div class="done">
          <span class="done__icon">${icon('hourglass')}</span>
          <h1 class="t-display-3">Заявка отправлена</h1>
          <p class="ink-2">Владелец проверит данные и откроет доступ. Номер для входа:<br><b class="mono">+7 (900) 000-01-04</b></p>
        </div>
        ${card({ title: 'Что дальше', body: `<ol class="steps">
          <li>Владелец подтверждает заявку. Уведомление не приходит — просто попробуйте войти позже.</li>
          <li>Вы входите по номеру телефона и паролю.</li>
          <li>Перед сменой, пока есть интернет, получаете сертификат. Без него QR-коды не формируются.</li>
        </ol>` })}
        ${U.btn('Перейти ко входу', { kind: 'primary', size: 'l', block: true })}
      `);
    },
  };

  /* =====================================================================
     СОТРУДНИК (телефон)
     ===================================================================== */
  SCREENS['worker-home'] = {
    title: 'Главная сотрудника', path: '/',
    frame: (v) => ({ offline: v === 'no-cert-offline' }),
    render(v) {
      const s = D.SESSION.worker, c = s.cert;
      const online = v !== 'no-cert-offline';
      const named = v === 'ready' || v === 'expiring';
      let cert, ctaOff = false;
      if (v === 'ready') {
        const left = c.expiresAt - D.NOW;
        cert = `<section class="cert">
          <div class="cert__head"><span class="cert__label">${icon('shield-check')}Сертификат на смену</span>${U.chip('good', 'check', 'Действует')}</div>
          <div><div class="cert__big">до ${U.time(c.expiresAt)}</div><div class="cert__sub">Осталось ${U.dur(left)} · получен сегодня в ${U.time(c.issuedAt)}</div></div>
          <div class="meter"><div class="meter__fill" style="width:${(left / 432).toFixed(1)}%"></div></div>
          <div class="row row--between"><span class="t-small muted">Действует 12 часов с момента получения</span>${U.btn('Обновить', { kind: 'ghost', size: 's', icon: 'refresh' })}</div>
        </section>`;
      } else if (v === 'expiring') {
        const exp = D.at(0, '14:31');
        cert = `<section class="cert cert--warn">
          <div class="cert__head"><span class="cert__label">${icon('shield-check')}Сертификат на смену</span>${U.chip('warn', 'clock', 'Скоро истечёт')}</div>
          <div><div class="cert__big">до ${U.time(exp)}</div><div class="cert__sub">Осталось ${U.dur(exp - D.NOW)} · получен сегодня в 02:31</div></div>
          <div class="meter meter--warn"><div class="meter__fill" style="width:${((exp - D.NOW) / 432).toFixed(1)}%"></div></div>
          <p class="cert__text">Обновите, пока есть сеть: без действующего сертификата QR-код не сформировать.</p>
          ${U.btn('Обновить сейчас', { kind: 'primary', block: true, icon: 'refresh' })}
        </section>`;
      } else if (v === 'no-cert-online') {
        ctaOff = true;
        cert = `<section class="cert">
          <div class="cert__head"><span class="cert__label">${icon('shield')}Сертификат на смену</span>${U.chip('neutral', null, 'Не получен')}</div>
          <p class="cert__text">Сертификат подтверждает, что QR-коды создаёте именно вы. Действует 12 часов. Получите его перед сменой, пока есть интернет.</p>
          ${U.btn('Получить сертификат', { kind: 'primary', size: 'l', block: true, icon: 'shield-check' })}
        </section>`;
      } else if (v === 'no-cert-offline') {
        ctaOff = true;
        cert = `<section class="cert cert--bad">
          <div class="cert__head"><span class="cert__label">${icon('shield-x')}Сертификат на смену</span>${U.chip('bad', 'clock', 'Истёк')}</div>
          <div><div class="cert__big">истёк в 06:40</div><div class="cert__sub">Получен вчера в 18:40</div></div>
          <p class="cert__text">Без сети новый сертификат не получить. Подключитесь к Wi‑Fi или мобильному интернету.</p>
          ${U.btn('Получить сертификат', { kind: 'primary', size: 'l', block: true, disabled: true, icon: 'wifi-off' })}
        </section>`;
      } else {
        ctaOff = true;
        cert = `<section class="cert cert--bad">
          <div class="cert__head"><span class="cert__label">${icon('shield-x')}Сертификат на смену</span>${U.chip('bad', 'x', 'Не выдан')}</div>
          ${U.alert('bad', 'lock', 'Сотрудник уволен, сертификат не выдаётся', 'Ответ сервера. Формировать QR-коды нельзя.')}
        </section>`;
      }
      const hello = named
        ? `<div class="hello"><span class="t-label">Сотрудник</span><span class="hello__name">${esc(c.fio)}</span></div>`
        : `<div class="hello"><span class="t-label">Сотрудник</span><span class="hello__name mono">${esc(U.phone(s.phone))}</span></div>`;
      const body = `<div class="page page--narrow">
        ${hello}
        ${cert}
        <button class="cta${ctaOff ? ' is-disabled' : ''}" type="button">${icon('scan')}Сканировать инструмент</button>
        ${ctaOff ? '<p class="foot-note">Сначала получите сертификат</p>' : ''}
        ${card({ title: 'Как взять или вернуть инструмент', body: `<ol class="steps">
          <li>Отсканируйте QR-наклейку на инструменте.</li>
          <li>Выберите «Беру» или «Возвращаю» и состояние инструмента.</li>
          <li>Покажите QR-код на экране завхозу.</li>
        </ol>` })}
        ${online ? `<p class="foot-note">${icon('clock')}Часы сверены с сервером · поправка +1 с</p>` : ''}
      </div>`;
      return `<div class="app"><div class="shell"><div class="shell__main">${workerHeader(online)}<main class="shell__body">${body}</main></div></div></div>`;
    },
  };

  function camFrameInner(subject) {
    return `<div class="cam__stage"><div class="cam__frame">
      <span class="cam__corner cam__corner--tl"></span><span class="cam__corner cam__corner--tr"></span>
      <span class="cam__corner cam__corner--bl"></span><span class="cam__corner cam__corner--br"></span>
      ${subject}<span class="cam__line"></span>
    </div></div>`;
  }
  const phoneWithQr = (seed) => `<div class="cam__phone"><div class="cam__phone-screen">${U.qr(seed, 57)}</div></div>`;

  SCREENS['worker-scan'] = {
    title: 'Сканирование наклейки', path: '/scan',
    frame: () => ({ cam: true }),
    render(v) {
      const top = `<div class="cam__top"><span class="cam__btn">${icon('x')}</span><span class="cam__title">Наклейка инструмента</span><span class="cam__btn">${icon('flash')}</span></div>`;
      if (v === 'no-camera') {
        return `<div class="app"><div class="cam"><div class="cam__feed"></div>${top}
          <div class="cam__blocked">${icon('camera-off')}<b>Нет доступа к камере</b>
          <p>Разрешите камеру для этого сайта: значок замка в адресной строке → «Камера» → «Разрешить».</p>
          ${U.btn('Попробовать снова', { kind: 'secondary', size: 'l' })}</div></div></div>`;
      }
      const wrong = v === 'wrong-code';
      const subject = wrong ? phoneWithQr('worker-qr-shown') : `<div class="cam__subject">${U.sticker(TOOL(7), { width: 214 })}</div>`;
      const bottom = wrong
        ? `<div class="cam__sheet">${U.alert('warn', 'alert', 'Это не наклейка инструмента', 'Похоже, отсканирован QR-код сотрудника. Наведите камеру на наклейку с инвентарным номером.')}${U.btn('Сканировать снова', { kind: 'primary', size: 'l', block: true })}</div>`
        : '<div class="cam__hint"><b>Наведите камеру на наклейку</b><span>Код распознаётся сам. Темно — включите фонарик справа вверху.</span></div>';
      return `<div class="app"><div class="cam"><div class="cam__feed"></div>${top}${camFrameInner(subject)}${bottom}</div></div>`;
    },
  };

  SCREENS['worker-op'] = {
    title: 'Выбор действия и состояния', path: '/scan/operation',
    render(v) {
      const give = v === 'give-damaged';
      const tool = TOOL(give ? 14 : 7);
      const action = give ? 'GIVE' : 'TAKE';
      const condOn = give ? 'Damaged' : 'Good';
      const tiles = ['TAKE', 'GIVE'].map((a) => `<div class="choice choice--tile${a === action ? ' is-on' : ''}"><span class="choice__icon">${icon(D.DICT.action[a].icon)}</span><span class="choice__title">${D.DICT.action[a].verb}</span><span class="choice__mark">${icon('check')}</span></div>`).join('');
      const conds = ['Good', 'Damaged', 'Broken'].map((c) => {
        const d = D.DICT.condition[c];
        return `<div class="choice choice--${d.tone}${c === condOn ? ' is-on' : ''}"><span class="choice__icon">${icon(d.icon)}</span><span><span class="choice__title">${d.label}</span><span class="choice__desc">${d.desc}</span></span><span class="choice__mark">${icon('check')}</span></div>`;
      }).join('');
      const body = `<div class="page page--narrow">
        <div class="toolstrip"><span class="toolstrip__icon">${icon('wrench', 'i--l')}</span><div><div class="toolstrip__name">${esc(tool.name)}</div><div class="toolstrip__meta">${U.inv(tool.id)}<span>считано с наклейки</span></div></div></div>
        <div class="stack-s"><h2 class="section-title">Что вы делаете?</h2><div class="choices choices--2">${tiles}</div></div>
        <div class="stack-s"><h2 class="section-title">Состояние инструмента</h2>
          <p class="field__hint" style="margin-top:-4px">${give ? 'При возврате выберите сами — заранее не отмечено. ' : ''}Это ваше заявление: завхоз сверит его с инструментом.</p>
          <div class="choices">${conds}</div></div>
      </div>`;
      return `<div class="app"><div class="shell"><div class="shell__main">${backHeader('Операция')}<main class="shell__body">${body}</main>
        <div class="actions-bar">${U.btn('Показать QR завхозу', { kind: 'primary', size: 'l', block: true, icon: 'qr' })}</div></div></div></div>`;
    },
  };

  SCREENS['worker-qr'] = {
    title: 'QR-код для завхоза', path: '/scan/qr',
    render(v) {
      const expired = v === 'expired';
      const tool = TOOL(14);
      const left = 47, r = 21, C = 2 * Math.PI * r;
      const plate = `<div class="qr-plate${expired ? ' qr-plate--expired' : ''}">${U.qr('AT1.worker4.give14.damaged', 93)}
        ${expired ? `<div class="qr-plate__over">${icon('clock')}<b>QR-код устарел</b><span>Прошло больше минуты — завхоз его уже не примет. Сформируйте новый: это безопасно.</span></div>` : ''}</div>`;
      const timer = expired ? '' : `<div class="countdown">
        <svg class="ring" viewBox="0 0 52 52" aria-hidden="true"><circle class="ring__track" cx="26" cy="26" r="${r}"/><circle class="ring__val" cx="26" cy="26" r="${r}" stroke-dasharray="${C.toFixed(1)}" stroke-dashoffset="${(C * (1 - left / 60)).toFixed(1)}"/></svg>
        <div><div class="countdown__big">0:${left}</div><div class="countdown__text">Код действует минуту. Покажите экран завхозу — он отсканирует код.</div></div></div>`;
      const body = `<div class="page page--narrow">
        <div class="qr-sum">${U.act('GIVE')}${U.inv(tool.id)}${U.cond('Damaged')}</div>
        <div class="strong" style="margin-top:-6px">${esc(tool.name)}</div>
        ${plate}
        ${timer}
        ${expired ? '' : `<p class="note">${icon('sun')}<span>Сканер не видит код? Прибавьте яркость экрана.</span></p>`}
      </div>`;
      const bottom = expired
        ? `<div class="actions-bar">${U.btn('Сформировать новый QR', { kind: 'primary', size: 'l', block: true, icon: 'refresh' })}</div>`
        : `<div class="actions-bar actions-bar--2">${U.btn('Изменить', { kind: 'secondary', size: 'l' })}${U.btn('Готово', { kind: 'primary', size: 'l', icon: 'check' })}</div>`;
      return `<div class="app"><div class="shell"><div class="shell__main">${backHeader('QR для завхоза')}<main class="shell__body">${body}</main>${bottom}</div></div></div>`;
    },
  };

  /* =====================================================================
     ЗАВХОЗ: СМЕНА, СКАНЕР, ПРОВЕРКА, ЗАПИСИ
     ===================================================================== */
  function recRow(r, statusHtml) {
    return `<div class="rec"><span class="rec__time">${U.time(r.scannedAt)}</span>
      <div class="rec__main"><div class="rec__title">${U.act(r.action, ' ')}<span>${esc(TOOL(r.toolId).name)}</span></div>
      <div class="rec__meta">${U.inv(r.toolId)} ${esc(U.short(r.workerName))} · ${D.DICT.condition[r.toolCondition].label.toLowerCase()}</div>
      <div>${statusHtml}</div></div></div>`;
  }
  const localStatus = (r) => r.status === 'pending' ? U.chip('neutral', 'upload', 'Не отправлена')
    : r.status === 'deferred' ? U.chip('bad', 'alert', 'Отложена')
      : U.flag(r.flag);

  SCREENS['issuer-shift'] = {
    title: 'Смена завхоза', path: '/shift',
    frame: (v) => ({ offline: v === 'offline' }),
    render(v) {
      const s = D.SESSION.issuer;
      const online = v !== 'offline';
      const prep = v === 'needs-prep', expired = v === 'session';
      const rows = prep ? [
        ['bad', 'key', 'Ключ сервера', 'Не загружен — проверить QR нельзя'],
        ['bad', 'list', 'Реестр инструментов', 'Не загружен'],
        ['warn', 'clock', 'Часы', 'Не сверены с сервером'],
        ['ok', 'lock', 'Вход', 'Действует до ' + U.time(s.jwtExpiresAt)],
      ] : [
        ['ok', 'key', 'Ключ сервера', 'Сохранён на устройстве'],
        ['ok', 'list', 'Реестр инструментов', U.nplural(s.registryCount, ['инструмент', 'инструмента', 'инструментов']) + ' · обновлён в ' + U.time(s.registryLoadedAt)],
        ['ok', 'clock', 'Часы', 'Сверены с сервером · поправка +' + s.clockOffset + ' с'],
        expired ? ['warn', 'lock', 'Вход', 'Истёк в 13:58 — войдите, чтобы отправить записи'] : ['ok', 'lock', 'Вход', 'Действует до ' + U.time(s.jwtExpiresAt)],
      ];
      const ready = card({
        title: 'Готовность к работе без сети', icon: 'shield-check',
        aside: prep ? '' : U.btn('Обновить', { kind: 'ghost', size: 's', icon: 'refresh', disabled: !online }),
        body: `<div class="ready">${rows.map(([st, ic, name, val]) => `<div class="ready__row${st === 'ok' ? '' : ' is-' + st}"><span class="ready__icon">${icon(st === 'ok' ? 'check' : st === 'bad' ? 'x' : 'alert')}</span><div><div class="ready__name">${name}</div><div class="ready__val">${val}</div></div></div>`).join('')}</div>`,
        foot: prep ? U.btn('Подготовить к работе', { kind: 'primary', block: true, icon: 'refresh' }) : null,
      });
      const n = localPending.length;
      let sync;
      if (prep) {
        sync = card({ body: `<div class="syncbox"><span class="syncbox__icon syncbox__icon--ok">${icon('check')}</span><div><div class="syncbox__big">Записей пока нет</div><div class="syncbox__sub">Появятся после первой выдачи или приёма</div></div></div>` });
      } else {
        const sub = !online ? 'Отправятся сами, когда появится интернет. Записи хранятся на этом устройстве.'
          : expired ? 'Сессия истекла. Войдите, чтобы отправить — записи сохранены.'
            : 'Последняя отправка сегодня в ' + U.time(s.lastSyncAt) + '. При появлении сети отправляются сами.';
        const b = !online ? U.btn('Ждут сети', { kind: 'secondary', block: true, disabled: true, icon: 'wifi-off' })
          : expired ? U.btn('Войти и отправить', { kind: 'primary', block: true, icon: 'lock' })
            : U.btn('Отправить сейчас', { kind: 'primary', block: true, icon: 'upload' });
        sync = card({ body: `<div class="stack"><div class="syncbox"><span class="syncbox__icon">${icon('upload')}</span><div><div class="syncbox__big">${U.nplural(n, ['запись не отправлена', 'записи не отправлены', 'записей не отправлено'])}</div><div class="syncbox__sub">${sub}</div></div></div>${b}</div>` });
      }
      const takes = D.LOCAL.filter((r) => r.action === 'TAKE').length, gives = D.LOCAL.filter((r) => r.action === 'GIVE').length;
      const stats = prep ? '' : `<div class="stats">
        <div class="stat"><span class="stat__value">${takes}</span><span class="stat__label">выдано сегодня</span></div>
        <div class="stat"><span class="stat__value">${gives}</span><span class="stat__label">принято сегодня</span></div>
        <div class="stat"><span class="stat__value">${n}</span><span class="stat__label">ждут отправки</span></div></div>`;
      const recent = prep ? '' : card({
        title: 'Последние записи', icon: 'list', cls: 'card--flush',
        aside: U.btn('Все записи', { kind: 'ghost', size: 's', iconEnd: 'chev-r' }),
        body: `<div style="margin-top:8px">${D.LOCAL.slice(0, 5).map((r) => recRow(r, localStatus(r))).join('')}</div>`,
      });
      const cta = `<button class="cta only-narrow${prep ? ' is-disabled' : ''}" type="button">${icon('scan')}Сканировать QR сотрудника</button>${prep ? '<p class="foot-note only-narrow">Без ключа сервера и реестра проверка QR невозможна</p>' : ''}`;
      const body = `<div class="page">${cta}<div class="cols"><div class="stack-l">${sync}${recent}</div><div class="stack-l">${ready}${stats}</div></div></div>`;
      const banner = !online ? `<div class="banner">${icon('wifi-off')}<span>Нет сети. Выдача и приём работают — записи сохраняются на этом устройстве.</span></div>` : '';
      return U.shell({
        role: 'Issuer', active: 'issuer-shift', online,
        topbar: U.topbar({ title: 'Смена', sub: 'вторник, 29 сентября', actions: U.net(online) }),
        banner, body,
      });
    },
  };

  SCREENS['issuer-scan'] = {
    title: 'Сканер QR сотрудника', path: '/shift/scan',
    frame: (v) => ({ cam: v !== 'desktop' }),
    render(v) {
      if (v === 'desktop') {
        const body = `<div class="page"><div class="cols"><div class="stack-l">
          <div class="scanner-input">
            <span class="scanner-input__icon">${icon('scan')}</span>
            <div><h2 class="t-title">Поднесите телефон сотрудника к сканеру</h2><p class="muted" style="margin-top:4px">Подойдёт ручной 2D-сканер в режиме клавиатуры или камера ноутбука.</p></div>
            <div style="width:100%;max-width:520px">${U.field({ label: 'Код с экрана сотрудника', value: null, placeholder: 'Ожидаю код…', focus: true, mono: true, lead: 'qr' })}</div>
            <div class="row">${U.btn('Включить камеру', { kind: 'secondary', icon: 'camera' })}</div>
          </div>
          ${U.alert('neutral', 'info', 'Вместо кода появились русские буквы?', 'Сканер «печатает» в текущей раскладке. Переключите клавиатуру на английскую и отсканируйте ещё раз.')}
        </div><div class="stack-l">
          ${card({ title: 'Последние записи', icon: 'list', cls: 'card--flush', body: `<div style="margin-top:8px">${D.LOCAL.slice(0, 4).map((r) => recRow(r, localStatus(r))).join('')}</div>` })}
        </div></div></div>`;
        return U.shell({ role: 'Issuer', active: 'issuer-shift', topbar: U.topbar({ title: 'Сканер', sub: 'Выдача и приём по QR-коду сотрудника', actions: U.net(true) }), body });
      }
      const top = `<div class="cam__top"><span class="cam__btn">${icon('x')}</span><span class="cam__title">QR сотрудника</span><span class="cam__btn">${icon('flash')}</span></div>`;
      return `<div class="app"><div class="cam"><div class="cam__feed"></div>${top}${camFrameInner(phoneWithQr('AT1.issuer-scan'))}
        <div class="cam__hint"><b>Наведите камеру на QR на телефоне сотрудника</b><span>Код распознаётся сам, затем откроется результат проверки.</span>
        <span class="cam__queue" style="margin-top:6px">${icon('upload')}Не отправлено: ${localPending.length}</span></div></div></div>`;
    },
  };

  /* Экран проверки: варианты описаны данными, разметка общая */
  const VERIFY = {
    'ok-take': { a: 'TAKE', w: 4, t: 7, c: 'Good', age: 4 },
    'ok-give': { a: 'GIVE', w: 6, t: 2, c: 'Good', age: 6 },
    'warn-condition': { a: 'GIVE', w: 4, t: 14, c: 'Damaged', age: 5, warn: 'condition' },
    'warn-unknown': { a: 'TAKE', w: 5, t: 26, c: 'Good', age: 3, warn: 'unknown' },
    'warn-order': { a: 'GIVE', w: 10, t: 19, c: 'Good', age: 7, warn: 'order' },
    'reject-time': { a: 'TAKE', w: 7, t: 16, c: 'Good', age: 134, fail: 4 },
    'reject-expired': { a: 'GIVE', w: 9, t: 8, c: 'Good', age: 5, fail: 3 },
    'reject-signature': { a: 'TAKE', w: null, t: 1, c: 'Good', age: 4, fail: 1 },
    'reject-duplicate': { a: 'GIVE', w: 4, t: 4, c: 'Good', age: 9, fail: 5 },
    'reject-format': { fail: 0 },
  };
  const CHECKS = ['Формат QR', 'Подпись сервера', 'Подпись сотрудника', 'Срок сертификата', 'Время QR', 'Не принимался раньше'];

  SCREENS['issuer-verify'] = {
    title: 'Проверка QR сотрудника', path: '/shift/scan/result',
    render(v) {
      const x = VERIFY[v];
      const header = `<header class="topbar topbar--back"><div class="topbar__lead">${U.iconBtn('x')}<div class="topbar__titles"><h1 class="topbar__title">Проверка QR</h1></div></div><div class="topbar__actions"><span class="t-small muted mono">14:02:00</span></div></header>`;
      const rejected = x.fail !== undefined;
      const tool = x.t ? TOOL(x.t) : null;
      const worker = x.w ? USER(x.w) : null;
      const certTill = x.w === 9 ? 'истёк вчера в 19:48' : 'до 20:10';

      const checks = CHECKS.map((name, k) => {
        let st = 'ok', val = '';
        if (rejected && k === x.fail) st = 'fail';
        else if (rejected && k > x.fail) st = 'skip';
        if (k === 0) val = st === 'fail' ? 'не AT1' : 'AT1';
        if (k === 3) val = st === 'fail' ? 'истёк 28.09 в 19:48' : st === 'skip' ? '' : certTill;
        if (k === 4) val = st === 'fail' ? '2 мин 14 с назад' : st === 'skip' ? '' : x.age + ' с назад';
        if (k === 5) val = st === 'fail' ? 'принят в 13:41' : '';
        if (k === 1 && st === 'fail') val = 'не сходится';
        if (st === 'skip') val = 'не проверялось';
        return `<div class="check-row${st === 'fail' ? ' is-fail' : st === 'skip' ? ' is-skip' : ''}">${icon(st === 'fail' ? 'x' : st === 'skip' ? 'more' : 'check')}<span>${name}</span><span class="check-row__val">${val}</span></div>`;
      }).join('');

      if (rejected) {
        const R = {
          0: ['Это не QR-код сотрудника', 'Код не похож на QR операции AccountThis. Возможно, отсканирована наклейка инструмента.', 'Отсканируйте QR-код с экрана телефона сотрудника.'],
          1: ['Сертификат не подписан сервером', 'Подпись сервера в QR-коде не сходится: сертификат подделан или создан не приложением AccountThis. Имя ниже взято из кода и не проверено.', 'Не выдавайте инструмент. Если ситуация повторяется — сообщите владельцу.'],
          3: ['Сертификат сотрудника истёк', 'Сертификат действует 12 часов. Этот получен вчера в 07:48 и истёк в 19:48.', 'Сотруднику нужно выйти в сеть, получить новый сертификат и сформировать QR заново.'],
          4: ['QR-код устарел', 'Код создан 2 мин 14 с назад, а принимается не дольше 60 секунд.', 'Попросите сотрудника нажать «Сформировать новый QR» и отсканируйте ещё раз.'],
          5: ['Этот QR-код уже принят', 'Вы приняли его сегодня в 13:41: возврат № 0004 «Шуруповёрт Metabo BS 18 LTX». Один код принимается один раз.', 'Если это новая операция, сотрудник формирует новый QR-код.'],
        }[x.fail];
        const details = x.fail === 0 ? '' : card({
          title: 'Что удалось прочитать', icon: 'qr', body: kv([
            ['Сотрудник', worker ? `<span class="strong">${esc(worker.fullName)}</span>` : '<span class="unverified">Иванов Иван Иванович</span>'],
            ['Операция', U.act(x.a)],
            ['Инструмент', toolLine(tool)],
            ['Состояние', U.cond(x.c)],
          ]),
        });
        const body = `<div class="verify__body">
          <div><div class="reason__title">${R[0]}</div><p class="reason__text">${R[1]}</p></div>
          <div class="todo">${icon('arrow-r')}<span>${R[2]}</span></div>
          ${card({ title: 'Проверки', icon: 'shield', body: `<div class="checks">${checks}</div>` })}
          ${details}
        </div>`;
        return `<div class="app"><div class="verify">${header}
          <section class="band band--reject"><div class="band__row"><span class="band__icon">${icon('octagon-x')}</span><div><div class="band__word band__word--s">QR ОТКЛОНЁН</div><div class="band__sub">Операция не записана в журнал</div></div></div></section>
          ${body}<div class="actions-bar">${U.btn('Сканировать снова', { kind: 'primary', size: 'l', block: true, icon: 'scan' })}</div></div></div>`;
      }

      const A = D.DICT.action[x.a];
      let warn = '', gate = '';
      if (x.warn === 'condition') {
        warn = `<div class="alert alert--warn">${icon('alert')}<div><div class="alert__title">Состояние отличается от реестра</div>
          <div class="compare">${U.cond('Good')}${icon('arrow-r')}${U.cond('Damaged')}</div>
          <div class="alert__text" style="margin-top:8px">Осмотрите инструмент. Не совпадает — откажите, сотрудник сформирует новый QR.</div></div></div>`;
        gate = U.checkbox(true, 'Инструмент осмотрен, состояние соответствует заявленному');
      } else if (x.warn === 'unknown') {
        warn = U.alert('warn', 'alert', 'Инструмента № 0026 нет в реестре на этом устройстве', 'Реестр обновлён в 08:03 — инструмент могли добавить позже. Осмотрите его и решите сами.');
        gate = U.checkbox(false, 'Инструмент осмотрен, выдачу подтверждаю');
      } else if (x.warn === 'order') {
        warn = U.alert('warn', 'alert', 'Инструмент уже числится на месте', 'Возврат № 0019 от Поповой А. Р. вы приняли в 13:58. Если это второй QR на тот же возврат — откажите.');
        gate = U.checkbox(false, 'Это отдельная операция, подтверждаю');
      }
      const regLine = x.warn === 'unknown' ? 'нет в реестре устройства'
        : x.warn === 'order' ? 'на устройстве: возвращён в 13:58'
        : `в реестре: ${D.DICT.condition[tool.condition].label.toLowerCase()}, ${tool.holderId ? 'на руках' : 'на месте'}`;
      const body = `<div class="verify__body">
        <div class="passbar">${icon('check-circle')}<span class="grow">Подписи и время верны</span><span class="t-small nowrap">${x.age} с назад</span></div>
        ${card({
          body: kv([
            ['Сотрудник', `<span class="strong">${esc(worker.fullName)}</span><span class="kv__sub">№ ${worker.id} · сертификат ${certTill}</span>`],
            ['Инструмент', toolLine(tool, regLine)],
            ['Заявлено', U.cond(x.c)],
          ]),
        })}
        ${warn}${gate}
      </div>`;
      const confirmDisabled = x.warn && x.warn !== 'condition';
      return `<div class="app"><div class="verify">${header}
        <section class="band band--${x.a}"><div class="band__row"><span class="band__icon">${icon(A.icon)}</span><div><div class="band__word">${A.band}</div><div class="band__sub">${A.bandSub}</div></div></div></section>
        ${body}
        <div class="actions-bar actions-bar--2">${U.btn('Отказать', { kind: 'secondary', size: 'l' })}${U.btn(A.confirm, { kind: x.a === 'GIVE' ? 'give' : 'primary', size: 'l', disabled: confirmDisabled })}</div>
      </div></div>`;
    },
  };

  SCREENS['issuer-records'] = {
    title: 'Записи смены', path: '/shift/records',
    render(v) {
      let recs = D.LOCAL.map((r) => Object.assign({}, r));
      let overlay = '', top = '';
      if (v === 'sync-result') {
        recs.forEach((r) => { if (r.status === 'pending') { r.status = 'sent'; r.flag = r.toolId === 19 ? 'DUPLICATE' : 'VALID'; } });
        overlay = `<div class="scrim"></div><div class="dialog"><div class="dialog__head"><h2 class="dialog__title">Отправлено 7 записей</h2><p class="dialog__lead">Сервер проверил каждую запись.</p></div>
          <div class="dialog__body">
            <div class="list">
              <div class="list__item"><span class="row">${icon('check-circle')}<span class="strong">Подтверждены</span></span><span class="strong tnum">6</span></div>
              <div class="list__item sev-bad"><div><div class="row">${U.flag('DUPLICATE')}<span class="t-small muted">13:58</span></div><div class="list__meta" style="margin-top:6px">Возврат № 0019 «Краскопульт Wagner W 590», Попова А. Р. Этот же QR-код раньше принял другой завхоз — запись не учитывается.</div></div><span class="strong tnum">1</span></div>
            </div>
          </div><div class="dialog__foot">${U.btn('Готово', { kind: 'primary' })}</div></div>`;
      }
      if (v === 'deferred') {
        recs.forEach((r) => { if (r.status === 'pending') { r.status = 'sent'; r.flag = 'VALID'; } });
        recs.splice(9, 0, Object.assign({}, recs[9], { scannedAt: D.at(0, '10:15:02'), toolId: 23, workerId: 9, workerName: USER(9).fullName, action: 'TAKE', toolCondition: 'Good', status: 'deferred', flag: null }));
        top = `<div class="alert alert--bad">${icon('alert')}<div><div class="alert__title">1 запись не принята сервером</div>
          <div class="alert__text">Строка QR не по формату: «workerSignature должна быть 64 байта». Остальные записи отправлены. Эта сохранена на устройстве — передайте её разработчику.</div>
          <div class="row" style="margin-top:10px">${U.btn('Скопировать строку', { kind: 'secondary', size: 's', icon: 'copy' })}</div></div></div>`;
      }
      const pendingN = recs.filter((r) => r.status === 'pending').length;
      const deferredN = recs.filter((r) => r.status === 'deferred').length;
      const filters = `<div class="hscroll">
        <span class="fchip is-on">Все <span class="fchip__n">${recs.length}</span></span>
        <span class="fchip">Не отправлены <span class="fchip__n">${pendingN}</span></span>
        <span class="fchip">Отправлены <span class="fchip__n">${recs.length - pendingN - deferredN}</span></span>
        ${deferredN ? `<span class="fchip">Отложены <span class="fchip__n">${deferredN}</span></span>` : ''}</div>`;
      const sync = pendingN ? card({ body: `<div class="stack"><div class="syncbox"><span class="syncbox__icon">${icon('upload')}</span><div><div class="syncbox__big">${U.nplural(pendingN, ['запись не отправлена', 'записи не отправлены', 'записей не отправлено'])}</div><div class="syncbox__sub">Последняя отправка сегодня в 12:40</div></div></div>${U.btn('Отправить сейчас', { kind: 'primary', block: true, icon: 'upload' })}</div>` })
        : card({ body: `<div class="syncbox"><span class="syncbox__icon syncbox__icon--ok">${icon('check')}</span><div><div class="syncbox__big">Всё отправлено</div><div class="syncbox__sub">Сегодня в 14:02</div></div></div>` });
      const list = `<div class="list">${recs.map((r) => `<div class="${r.flag && D.DICT.flag[r.flag].group === 'bad' || r.status === 'deferred' ? 'sev-bad' : ''}">${recRow(r, localStatus(r))}</div>`).join('')}</div>`;
      const body = `<div class="page page--narrow">${top}${sync}${filters}${list}
        <p class="foot-note">${icon('info')}Записи не редактируются и не удаляются</p></div>`;
      return U.shell({
        role: 'Issuer', active: 'issuer-shift', pending: pendingN,
        topbar: U.topbar({ back: true, title: 'Записи смены', sub: 'сегодня · ' + U.nplural(recs.length, ['запись', 'записи', 'записей']), crumb: 'Смена ' + icon('chev-r'), actions: U.net(true) }),
        body, overlay,
      });
    },
  };

  /* =====================================================================
     РЕЕСТР ИНСТРУМЕНТОВ
     ===================================================================== */
  function toolsBody(o) {
    const tools = D.TOOLS;
    const out = tools.filter((t) => t.holderId).length;
    const cnt = (c) => tools.filter((t) => t.condition === c).length;
    const local = o.role === 'Issuer' ? localMarks : {};
    const filters = `<div class="filters">
      <div class="search">${icon('search')}<div class="input"><span class="input__ph">Название или номер</span></div></div>
      <div class="hscroll">
        <span class="fchip is-on">Все <span class="fchip__n">${tools.length}</span></span>
        <span class="fchip">На месте <span class="fchip__n">${tools.length - out}</span></span>
        <span class="fchip">На руках <span class="fchip__n">${out}</span></span>
        <span class="fchip">${icon('alert')}Повреждён <span class="fchip__n">${cnt('Damaged')}</span></span>
        <span class="fchip">${icon('octagon-x')}Сломан <span class="fchip__n">${cnt('Broken')}</span></span>
      </div>
      <span class="grow only-wide"></span>
      ${U.seg([['table', 'Таблица', 'table'], ['board', 'Стенд', 'board']], o.view)}
    </div>`;
    let content;
    if (o.view === 'board') {
      content = `<div class="board">${tools.map((t) => {
        const cls = ['tile', t.holderId ? 'tile--out' : '', t.condition === 'Broken' ? 'tile--broken' : ''].join(' ');
        const foot = t.holderId
          ? `<div class="tile__foot"><span class="tile__holder">${esc(U.short(t.holderName))}</span><span class="tile__since">на руках ${U.dayIdx(t.heldSince) === 0 ? 'с ' + U.time(t.heldSince) : 'с ' + U.dm(t.heldSince)}</span>${t.condition !== 'Good' ? U.cond(t.condition) : ''}</div>`
          : `<div class="tile__foot">${U.cond(t.condition)}</div>`;
        return `<div class="${cls}"><div class="tile__top">${U.inv(t.id)}</div><div class="tile__name">${esc(t.name)}</div>${foot}</div>`;
      }).join('')}</div>
      <div class="legend"><span class="legend__item"><span class="legend__swatch"></span>На месте</span><span class="legend__item"><span class="legend__swatch legend__swatch--out"></span>На руках — пустое место на стенде</span><span class="legend__item"><span class="legend__swatch legend__swatch--broken"></span>Сломан</span></div>`;
    } else {
      const table = `<div class="tbl-wrap only-wide"><table class="tbl"><thead><tr><th class="c-min">№</th><th>Название</th><th>Состояние</th><th>Комментарий</th><th>Где сейчас</th><th class="c-min"></th></tr></thead><tbody>
        ${tools.map((t, k) => `<tr class="${k === 4 ? 'is-hover' : ''}"><td class="c-min">${U.inv(t.id)}</td><td class="c-name">${esc(t.name)}</td><td>${U.cond(t.condition)}</td><td class="c-muted c-clip">${t.comment ? esc(t.comment) : '—'}</td><td>${U.place(t, local[t.id])}</td><td class="c-min row-go">${icon('chev-r')}</td></tr>`).join('')}
      </tbody></table></div>`;
      const list = `<div class="list only-narrow">${tools.map((t) => `<div class="list__item"><div style="min-width:0"><div class="list__title">${esc(t.name)}</div><div class="row" style="margin-top:6px">${U.inv(t.id)}${U.cond(t.condition)}</div></div><div class="list__aside">${U.place(t, local[t.id])}</div></div>`).join('')}</div>`;
      content = table + list;
    }
    const note = `<p class="note">${icon('info')}<span>«Где сейчас» — по данным сервера: операции, которые завхозы ещё не отправили, здесь не видны.${o.role === 'Issuer' ? ' Неотправленные операции этого устройства отмечены отдельно.' : ''} Списанные инструменты в реестр не попадают.</span></p>`;
    return `<div class="page">${filters}${content}${note}</div>`;
  }
  function toolsShell(role, view, overlay) {
    const out = D.TOOLS.filter((t) => t.holderId).length;
    return U.shell({
      role, active: 'tools',
      topbar: U.topbar({
        title: 'Инструменты',
        sub: U.nplural(D.TOOLS.length, ['инструмент', 'инструмента', 'инструментов']) + ' в реестре · ' + out + ' на руках',
        actions: `<span class="only-wide row">${U.btn('Печать наклеек', { kind: 'secondary', icon: 'printer' })}${U.btn('Добавить инструмент', { kind: 'primary', icon: 'plus' })}</span><span class="only-narrow row">${U.iconBtn('printer')}${U.iconBtn('plus', 'icon-btn--bordered')}</span>`,
      }),
      body: view === 'empty'
        ? `<div class="page"><div class="card"><div class="empty"><span class="empty__icon">${icon('wrench')}</span><div class="empty__title">В реестре пока нет инструментов</div><p class="empty__text">Добавьте первый инструмент — система присвоит ему номер, и вы сразу напечатаете QR-наклейку.</p>${U.btn('Добавить инструмент', { kind: 'primary', icon: 'plus' })}</div></div></div>`
        : toolsBody({ role, view }),
      overlay,
    });
  }

  SCREENS.tools = {
    title: 'Реестр инструментов', path: '/tools',
    render(v, ctx) { return toolsShell(ctx.role || 'Issuer', v); },
  };

  SCREENS['tool-new'] = {
    title: 'Новый инструмент', path: '/tools/new',
    render(v, ctx) {
      const created = v === 'created';
      const t26 = TOOL(26);
      const dialog = created
        ? `<div class="scrim"></div><div class="dialog"><div class="dialog__head"><h2 class="dialog__title">Инструмент добавлен</h2><p class="dialog__lead">Номер присвоен автоматически. Напечатайте наклейку сейчас или позже из карточки инструмента.</p></div>
          <div class="dialog__body"><div class="print-preview">${U.sticker(t26, { width: 320 })}</div>
          <div class="row">${U.inv(26)}${U.cond('Good')}${U.chip('neutral', null, 'На месте')}</div></div>
          <div class="dialog__foot">${U.btn('Добавить ещё', { kind: 'secondary', icon: 'plus' })}${U.btn('Печать наклейки', { kind: 'primary', icon: 'printer' })}</div></div>`
        : `<div class="scrim"></div><div class="dialog"><div class="dialog__head"><h2 class="dialog__title">Новый инструмент</h2></div>
          <div class="dialog__body">
            ${U.field({ label: 'Название', value: t26.name, counter: '29 / 100', focus: true, hint: 'Как на корпусе: тип, марка, модель. Печатается на наклейке и попадает в QR-код сотрудника.' })}
            <p class="note">${icon('info')}<span>Номер присвоится автоматически. Новый инструмент — исправен и на месте.</span></p>
          </div><div class="dialog__foot">${U.btn('Отмена', { kind: 'secondary' })}${U.btn('Добавить', { kind: 'primary' })}</div></div>`;
      return toolsShell(ctx.role || 'Issuer', 'table', dialog);
    },
  };

  /* Карточка инструмента */
  function historyItems(toolId, limit) {
    const logs = D.LOGS.filter((l) => l.toolId === toolId).slice(0, limit || 8);
    const all = D.LOGS.filter((l) => l.toolId === toolId && l.validationFlag === 'VALID').slice().reverse();
    return logs.map((l) => {
      const fl = D.DICT.flag[l.validationFlag];
      let worse = '';
      if (l.validationFlag === 'VALID' && l.action === 'GIVE') {
        const idx = all.indexOf(l);
        const take = all.slice(0, idx).reverse().find((x) => x.action === 'TAKE');
        if (take && D.DICT.condition[l.toolCondition].rank > D.DICT.condition[take.toolCondition].rank) {
          worse = `<div class="tl__flag">${U.chip('warn', 'alert', 'Состояние ухудшилось у сотрудника')}<span class="t-small muted">было «${D.DICT.condition[take.toolCondition].label.toLowerCase()}» при выдаче</span></div>`;
        }
      }
      const dotCls = fl.group === 'ok' ? l.action : fl.group;
      return `<div class="tl"><span class="tl__dot tl__dot--${dotCls}">${icon(fl.group === 'ok' ? D.DICT.action[l.action].icon : fl.icon)}</span>
        <div><div class="tl__title">${D.DICT.action[l.action].label}<span class="muted" style="font-weight:500">· ${esc(U.short(l.workerName))}</span></div>
        <div class="tl__meta">${U.when(l.qrTimestamp)} · заявлено: ${D.DICT.condition[l.toolCondition].label.toLowerCase()}</div>
        ${fl.group !== 'ok' ? `<div class="tl__flag">${U.flag(l.validationFlag)}<span class="t-small muted">не учитывается</span></div>` : ''}${worse}</div></div>`;
    }).join('');
  }

  SCREENS['tool-card'] = {
    title: 'Карточка инструмента', path: '/tools/5',
    render(v, ctx) {
      const role = ctx.role || 'Issuer';
      const id = v === 'broken' || v === 'write-off' ? 3 : v === 'written-off' ? 9 : 5;
      const t = TOOL(id);
      const off = !t.isActive;
      const head = `<div class="tool-head"><h2 class="tool-head__name only-narrow">${esc(t.name)}</h2><div class="row">${U.inv(t.id, 'inv--l')}${U.cond(t.condition, 'chip--l')}${off ? U.chip('neutral', 'archive', 'Списан', 'chip--l') : t.holderId ? U.chip('accent', 'user', 'На руках', 'chip--l') : U.chip('neutral', 'box', 'На месте', 'chip--l')}</div></div>`;
      const offNote = off ? `<div class="written-off">${icon('archive', 'i--l')}<div><div class="strong">Инструмент списан</div><div class="t-small ink-2" style="margin-top:2px">В реестре и на стенде не показывается, история операций сохранена. Состояние и комментарий по-прежнему можно изменить.</div></div></div>` : '';
      const stateCard = card({
        title: 'Состояние', icon: 'wrench',
        aside: U.btn('Изменить', { kind: 'ghost', size: 's', icon: 'edit' }),
        body: `<div class="stack">${U.cond(t.condition, 'chip--l')}${t.comment ? `<p>«${esc(t.comment)}»</p>` : '<p class="muted">Комментария нет</p>'}
          <p class="t-small muted">Состояние обновляется само, когда завхоз принимает возврат по QR. Вручную — после ремонта или если поломку заметили вне выдачи.</p></div>`,
      });
      let where;
      if (t.holderId) {
        const take = D.LOGS.find((l) => l.toolId === t.id && l.validationFlag === 'VALID' && l.action === 'TAKE' && l.qrTimestamp === t.heldSince);
        where = card({ title: 'Где сейчас', icon: 'user', body: `<div class="row row--nowrap" style="gap:12px">${U.avatar(t.holderName)}<div><div class="strong">${esc(t.holderName)}</div><div class="t-small muted">на руках ${U.dayIdx(t.heldSince) === 0 ? 'с ' + U.time(t.heldSince) : 'с ' + U.when(t.heldSince)} · при выдаче: ${D.DICT.condition[take.toolCondition].label.toLowerCase()}</div></div></div>` });
      } else {
        const last = D.LOGS.find((l) => l.toolId === t.id && l.validationFlag === 'VALID');
        where = card({ title: 'Где сейчас', icon: 'box', body: `<div class="strong">${off ? 'Списан' : 'На месте, в кладовой'}</div>${last ? `<div class="t-small muted" style="margin-top:2px">Последний возврат ${U.when(last.qrTimestamp)} · ${esc(U.short(last.workerName))}</div>` : ''}` });
      }
      const hist = card({ title: 'История операций', icon: 'list', aside: U.btn('Весь журнал', { kind: 'ghost', size: 's', iconEnd: 'chev-r' }), body: `<div class="timeline">${historyItems(t.id, 6)}</div>` });
      const stick = card({ title: 'Наклейка', icon: 'qr', body: `<div class="stack"><div class="print-preview">${U.sticker(t, { width: 280 })}</div><p class="t-small muted">QR-код содержит номер и название. Перепечатайте, если наклейка стёрлась.</p>${U.btn('Печать наклейки', { kind: 'secondary', icon: 'printer', block: true })}</div>` });
      const danger = role === 'Owner' && !off ? `<section class="danger"><div class="danger__tape"></div><div class="danger__body"><div class="card__title">${icon('archive')}<span>Списание</span></div>
        <p class="t-small ink-2">Инструмент исчезнет из реестра и со стенда, история сохранится. Отменить списание нельзя.</p>
        <div>${U.btn('Списать инструмент', { kind: 'danger-outline', icon: 'archive' })}</div></div></section>` : '';
      const body = `<div class="page">${head}${offNote}<div class="cols"><div class="stack-l">${stateCard}${where}${hist}</div><div class="stack-l">${off ? '' : stick}${danger}</div></div></div>`;
      let overlay = '';
      if (v === 'edit') {
        overlay = `<div class="scrim"></div><div class="dialog"><div class="dialog__head"><h2 class="dialog__title">Состояние инструмента</h2><p class="dialog__lead">${U.inv(t.id)} ${esc(t.name)}</p></div>
          <div class="dialog__body">
            <div class="field"><div class="field__label"><span>Состояние</span></div>${U.seg([['Good', 'Исправен', 'check-circle'], ['Damaged', 'Повреждён', 'alert'], ['Broken', 'Сломан', 'octagon-x']], 'Good')}</div>
            <div class="field"><div class="field__label"><span>Комментарий</span><span class="field__counter" style="color:var(--accent-text)">Очистить</span></div><div class="input input--area input--focus"><span class="input__value" style="white-space:normal">Заменено стекло окна луча, откалиброван 29.09<span class="caret"></span></span></div></div>
            <p class="note">${icon('info')}<span>Ручная правка. Новое состояние действует с этого момента: более ранние операции из поздних синхронизаций его не перезапишут.</span></p>
          </div><div class="dialog__foot">${U.btn('Отмена', { kind: 'secondary' })}${U.btn('Сохранить', { kind: 'primary' })}</div></div>`;
      }
      if (v === 'write-off') {
        overlay = `<div class="scrim"></div><div class="dialog"><div class="danger__tape"></div><div class="dialog__head"><h2 class="dialog__title">Списать инструмент?</h2><p class="dialog__lead">${U.inv(t.id)} ${esc(t.name)}</p></div>
          <div class="dialog__body">
            <ul class="consequences">
              <li>${icon('archive')}<span>Исчезнет из реестра и со стенда</span></li>
              <li>${icon('list')}<span>История операций останется в журнале</span></li>
              <li>${icon('lock')}<span>Отменить списание нельзя</span></li>
            </ul>
            ${U.field({ label: 'Причина списания', value: 'Сгорел двигатель, ремонт дороже нового', area: true, hint: 'Сохранится в комментарии инструмента' })}
          </div><div class="dialog__foot">${U.btn('Отмена', { kind: 'secondary' })}${U.btn('Списать', { kind: 'danger', icon: 'archive' })}</div></div>`;
      }
      return U.shell({
        role, active: 'tools',
        topbar: U.topbar({
          back: true, crumb: 'Инструменты ' + icon('chev-r') + ' № ' + U.invNo(t.id),
          titleHtml: `<span class="only-wide">${esc(t.name)}</span><span class="only-narrow">№ ${U.invNo(t.id)}</span>`,
          actions: `<span class="only-wide row">${U.btn('Изменить состояние', { kind: 'secondary', icon: 'edit' })}${off ? '' : U.btn('Печать наклейки', { kind: 'secondary', icon: 'printer' })}</span><span class="only-narrow">${U.iconBtn('more')}</span>`,
        }),
        body, overlay,
      });
    },
  };

  SCREENS.stickers = {
    title: 'Печать наклеек', path: '/tools/print',
    render(v, ctx) {
      const thermal = v === 'thermal';
      const sel = [2, 5, 11, 14, 17, 20, 22, 23, 26].map(TOOL);
      const start = 4;
      let preview;
      if (thermal) {
        preview = `<div class="stack" style="justify-items:center">${sel.slice(0, 3).map((t) => U.sticker(t, { width: 290, thermal: true })).join('')}<span class="t-small muted">и ещё ${sel.length - 3} — по одной на отрыв</span></div>`;
      } else {
        const cells = [];
        for (let k = 1; k <= 24; k++) {
          const idx = k - start;
          if (k < start) cells.push('<div class="sheet__empty" style="background:repeating-linear-gradient(-45deg,var(--paper) 0 6px,var(--paper-line) 6px 7px)"></div>');
          else if (idx < sel.length) cells.push(U.sticker(sel[idx]));
          else cells.push('<div class="sheet__empty"></div>');
        }
        preview = `<div class="sheet">${cells.join('')}</div>`;
      }
      const opt = (on, title, desc) => `<div class="choice${on ? ' is-on' : ''}" style="min-height:0"><span class="choice__mark">${icon('check')}</span><span><span class="choice__title" style="font-size:var(--fs-body)">${title}</span><span class="choice__desc">${desc}</span></span><span></span></div>`;
      const settings = card({
        title: 'Параметры', icon: 'printer', body: `<div class="stack-l">
          <div class="field"><div class="field__label"><span>Формат</span></div><div class="choices">
            ${opt(!thermal, 'Лист А4', '24 наклейки 70×37 мм, 3 × 8')}
            ${opt(thermal, 'Термопринтер', 'Лента 58×40 мм')}</div></div>
          <div class="field"><div class="field__label"><span>Что печатать</span></div><div class="choices">
            ${opt(true, 'Выбранные в реестре', U.nplural(sel.length, ['инструмент', 'инструмента', 'инструментов']))}
            ${opt(false, 'Добавленные сегодня', '1 инструмент')}
            ${opt(false, 'Все активные', U.nplural(D.TOOLS.length, ['инструмент', 'инструмента', 'инструментов']))}</div></div>
          ${thermal ? '' : U.field({ label: 'Начать с ячейки', value: String(start), hint: 'Лист уже начат? Пропустите использованные ячейки — они заштрихованы.' })}
          ${U.btn('Печать', { kind: 'primary', block: true, icon: 'printer' })}
          <p class="t-small muted">Откроется системный диалог печати. Масштаб — 100 %, поля — «нет».</p></div>`,
      });
      return U.shell({
        role: ctx.role || 'Issuer', active: 'tools',
        topbar: U.topbar({ back: true, crumb: 'Инструменты ' + icon('chev-r'), title: 'Печать наклеек', sub: thermal ? 'Термопринтер · 58×40 мм' : 'Лист А4 · 24 наклейки 70×37 мм · лист 1 из 1' }),
        body: `<div class="page"><div class="cols"><div class="print-preview">${preview}</div>${settings}</div></div>`,
      });
    },
  };

  /* =====================================================================
     ЖУРНАЛ
     ===================================================================== */
  const issuerName = (id, role) => {
    if (role === 'Owner') {
      const u = USER(id);
      return esc(U.short(u.fullName)) + (u.isActive ? '' : ' <span class="muted">(уволен)</span>');
    }
    return id === D.SESSION.issuer.userId ? 'Вы' : 'Завхоз № ' + id;
  };
  const nameCell = (text, verified) => verified ? esc(text) : `<span class="unverified">${esc(text)}</span>`;

  function journalShell(v, role, overlay) {
    const since = D.NOW - 7 * D.DAY;
    const problems = v === 'problems';
    let logs = D.LOGS.filter((l) => l.qrTimestamp >= since);
    const all = logs;
    if (problems) logs = logs.filter((l) => l.validationFlag !== 'VALID');
    const g = { ok: 0, warn: 0, bad: 0 };
    all.forEach((l) => g[D.DICT.flag[l.validationFlag].group]++);
    const selected = v === 'entry-drift' ? all.find((l) => l.validationFlag === 'TIME_DRIFT') : v === 'entry-forged' ? all.find((l) => l.validationFlag === 'INVALID_SERVER_SIG') : null;
    const sev = (l) => ({ ok: '', warn: 'sev-warn', bad: 'sev-bad' })[D.DICT.flag[l.validationFlag].group];
    const filters = `<div class="filters"><div class="hscroll">
      <span class="fchip fchip--select">${icon('calendar')}7 дней${icon('chev-d')}</span>
      <span class="fchip fchip--select">Все действия${icon('chev-d')}</span>
      <span class="fchip fchip--select${problems ? ' is-on' : ''}">${icon('shield')}${problems ? 'Требуют внимания' : 'Любая проверка'}${icon('chev-d')}</span>
      <span class="fchip fchip--select">${icon('wrench')}Инструмент${icon('chev-d')}</span>
      <span class="fchip fchip--select">${icon('user')}Сотрудник${icon('chev-d')}</span></div></div>`;
    const summary = `<div class="summary">${U.chip('good', 'check-circle', 'Подтверждены: ' + g.ok, 'chip--l')}${U.chip('warn', 'alert', 'Требуют проверки: ' + g.warn, 'chip--l')}${U.chip('bad', 'shield-x', 'Подозрительные: ' + g.bad, 'chip--l')}</div>`;
    const table = `<div class="tbl-wrap only-wide"><table class="tbl"><thead><tr><th>Время операции</th><th>Действие</th><th>Инструмент</th><th>Сотрудник</th><th>Заявлено</th><th>Проверка</th><th>Принял</th><th class="c-right">Отправлено</th></tr></thead><tbody>
      ${logs.slice(0, 16).map((l) => `<tr class="${sev(l)}${selected && selected.id === l.id ? ' is-selected' : ''}">
        <td class="nowrap mono">${U.whenShort(l.qrTimestamp)}</td><td>${U.act(l.action)}</td>
        <td><span class="row row--nowrap" style="gap:8px">${l.toolId ? U.inv(l.toolId) : `<span class="inv">№ ${U.invNo(l._claimedToolId)}?</span>`}<span class="c-clip" style="display:inline-block;max-width:210px">${nameCell(l.toolName, !!l.toolId)}</span></span></td>
        <td class="nowrap">${nameCell(l.workerId ? U.short(l.workerName) : l.workerName, !!l.workerId)}</td>
        <td>${U.cond(l.toolCondition)}</td><td>${U.flag(l.validationFlag)}</td>
        <td class="nowrap c-muted">${issuerName(l.issuerId, role)}</td><td class="c-right c-muted nowrap">${U.whenShort(l.createdAt)}</td></tr>`).join('')}
      </tbody></table></div>`;
    const list = `<div class="list only-narrow">${logs.slice(0, 12).map((l) => `<div class="list__item ${sev(l)}"><div style="min-width:0"><div class="list__title row row--nowrap">${U.act(l.action, ' ')}<span style="overflow:hidden;text-overflow:ellipsis;white-space:nowrap">${nameCell(l.toolName, !!l.toolId)}</span></div>
      <div class="list__meta" style="margin-top:4px">${nameCell(l.workerId ? U.short(l.workerName) : l.workerName, !!l.workerId)} · ${U.whenShort(l.qrTimestamp)}</div></div>
      <div class="list__aside">${l.validationFlag === 'VALID' ? U.cond(l.toolCondition) : U.flag(l.validationFlag)}</div></div>`).join('')}</div>`;
    const foot = `<div class="tbl-foot only-wide"><span>Показаны ${Math.min(16, logs.length)} из ${logs.length} за 7 дней</span><span>Имена со знаком «?» взяты из QR-кода и не проверены</span></div>`;
    return U.shell({
      role, active: 'journal',
      topbar: U.topbar({ title: 'Журнал операций', sub: 'Синхронизированные записи, новые сверху' }),
      body: `<div class="page">${filters}${summary}${table}${list}${foot}</div>`,
      overlay: overlay || (selected ? entryDrawer(selected, role) : ''),
    });
  }

  function entryDrawer(l, role) {
    const fl = D.DICT.flag[l.validationFlag];
    const drift = l.scannedAt - l.qrTimestamp;
    const tone = { ok: 'good', warn: 'warn', bad: 'bad' }[fl.group];
    return `<div class="scrim"></div><aside class="drawer">
      <div class="drawer__head"><div class="stack-s"><span class="t-label">Запись журнала № ${l.id}</span><div class="row">${U.flag(l.validationFlag, 'chip--l')}</div></div>${U.iconBtn('x')}</div>
      <div class="drawer__body">
        <div class="alert alert--${tone}">${icon(fl.icon)}<div><div class="alert__title">${fl.title}</div><div class="alert__text">${fl.text}</div></div></div>
        ${fl.todo ? `<div class="todo">${icon('arrow-r')}<span>${fl.todo}</span></div>` : ''}
        <div class="drawer__section"><span class="t-label">Операция</span>${kv([
          ['Действие', U.act(l.action)],
          ['Инструмент', l.toolId ? toolLine(TOOL(l.toolId)) : `<span class="unverified">${esc(l.toolName)}</span><span class="kv__sub"><span class="inv">№ ${U.invNo(l._claimedToolId)}?</span> из QR-кода, не проверено</span>`],
          ['Сотрудник', l.workerId ? `<span class="strong">${esc(l.workerName)}</span><span class="kv__sub">№ ${l.workerId}</span>` : `<span class="unverified">${esc(l.workerName)}</span><span class="kv__sub">из QR-кода, не проверено</span>`],
          ['Заявлено', U.cond(l.toolCondition)],
        ])}</div>
        <div class="drawer__section"><span class="t-label">Время</span>${kv([
          ['QR создан', `<span class="mono">${U.timeS(l.qrTimestamp)}</span> <span class="muted">${U.dm(l.qrTimestamp)}</span>`],
          ['Отсканирован', `<span class="mono">${U.timeS(l.scannedAt)}</span> ${drift > 60 ? U.chip('warn', 'clock', '+' + drift + ' с') : `<span class="muted">+${drift} с</span>`}`],
          ['Отправлен', `<span class="mono">${U.timeS(l.createdAt)}</span> <span class="muted">${U.dm(l.createdAt)}</span>`],
        ])}</div>
        <div class="drawer__section"><span class="t-label">Принял</span>${kv([['Завхоз', issuerName(l.issuerId, role)]])}</div>
        <p class="t-small muted">Записи журнала не изменяются и не удаляются.</p>
      </div></aside>`;
  }

  SCREENS.journal = {
    title: 'Журнал операций', path: '/journal',
    render(v, ctx) { return journalShell(v, ctx.role || 'Issuer'); },
  };

  /* =====================================================================
     ВЛАДЕЛЕЦ: ОБЗОР И ПОЛЬЗОВАТЕЛИ
     ===================================================================== */
  function chartHtml() {
    const days = D.opsByDay(D.LOGS, 14);
    const max = Math.max(...days.map((d) => d.total));
    const top = Math.ceil(max / 5) * 5;
    const ticks = [];
    for (let k = 0; k <= top; k += 5) ticks.push(k);
    const hoverDay = days.find((d) => d.day === -5);
    const cols = days.map((d) => {
      const segs = ['ok', 'warn', 'bad'].filter((k) => d[k] > 0).map((k) => `<span class="chart__seg chart__seg--${k}" style="height:${(d[k] / top * 180 - 2).toFixed(1)}px"></span>`).join('');
      const tip = d === hoverDay ? `<div class="chart__tip"><b>${U.dayMonth(d.from + 43200)}, ${U.weekday(d.from + 43200)}</b>
        <div class="chart__tip-row"><span class="chart__key lg-ok"></span><strong>${d.ok}</strong><span>подтверждены</span></div>
        <div class="chart__tip-row"><span class="chart__key lg-warn"></span><strong>${d.warn}</strong><span>требуют проверки</span></div>
        <div class="chart__tip-row"><span class="chart__key lg-bad"></span><strong>${d.bad}</strong><span>подозрительные</span></div></div>` : '';
      return `<div class="chart__col${d === hoverDay ? ' is-hover' : ''}">${tip}<div class="chart__stack">${segs}</div></div>`;
    }).join('');
    const xs = days.map((d) => {
      const wd = new Date((d.from + 43200) * 1000).getUTCDay();
      return `<span class="${wd === 0 || wd === 6 ? 'is-we' : ''}">${U.dm(d.from + 43200).slice(0, 2)}</span>`;
    }).join('');
    return `<div class="chart">
      <div class="legend"><span class="legend__item"><span class="lg-swatch lg-ok"></span>Подтверждены</span><span class="legend__item"><span class="lg-swatch lg-warn"></span>${icon('alert', 'i--s')}Требуют проверки</span><span class="legend__item"><span class="lg-swatch lg-bad"></span>${icon('shield-x', 'i--s')}Подозрительные</span></div>
      <div class="chart__plot"><div class="chart__grid">${ticks.map((k) => `<div class="chart__gl${k === 0 ? ' chart__gl--base' : ''}" style="bottom:${(k / top * 180).toFixed(1)}px"><span>${k}</span></div>`).join('')}</div><div class="chart__cols">${cols}</div></div>
      <div class="chart__x">${xs}</div></div>`;
  }

  SCREENS['owner-overview'] = {
    title: 'Обзор владельца', path: '/overview',
    render() {
      const tools = D.TOOLS;
      const out = tools.filter((t) => t.holderId).length;
      const dmg = tools.filter((t) => t.condition === 'Damaged').length, brk = tools.filter((t) => t.condition === 'Broken').length;
      const pending = D.USERS.filter((u) => u.isActive && !u.isApproved);
      const week = D.LOGS.filter((l) => l.qrTimestamp >= D.NOW - 7 * D.DAY && l.validationFlag !== 'VALID');
      const suspicious = week.filter((l) => D.DICT.flag[l.validationFlag].group === 'bad');
      const tile = (value, label, sub) => `<div class="stat"><span class="stat__label">${label}</span><span class="stat__value">${value}</span><span class="stat__sub">${sub}</span></div>`;
      const tiles = `<div class="tiles">
        ${tile(tools.length, 'Инструментов в реестре', out + ' на руках')}
        ${tile(dmg + brk, 'Неисправны', dmg + ' повреждены · ' + brk + ' сломаны')}
        ${tile(pending.length, 'Заявки на доступ', 'одна — на роль владельца')}
        ${tile(week.length, 'Записи с проблемами', 'за 7 дней, подозрительных — ' + suspicious.length)}</div>`;
      const forged = week.find((l) => l.validationFlag === 'INVALID_SERVER_SIG');
      const dup = week.find((l) => l.validationFlag === 'DUPLICATE');
      const badSig = week.find((l) => l.validationFlag === 'INVALID_WORKER_SIG');
      const longHold = tools.filter((t) => t.holderId && D.NOW - t.heldSince > D.DAY).sort((a, b) => a.heldSince - b.heldSince)[0];
      const broken = tools.filter((t) => t.condition === 'Broken');
      const item = (sev, ic, title, meta, action) => `<div class="attn__item sev-${sev}"><span class="attn__icon">${icon(ic)}</span><div style="min-width:0"><div class="attn__title">${title}</div><div class="attn__meta">${meta}</div></div>${U.btn(action, { kind: 'secondary', size: 's' })}</div>`;
      const attention = card({
        title: 'Требует внимания', icon: 'alert', cls: 'card--flush', body: `<div style="margin-top:8px">
        ${item('info', 'user-check', U.nplural(pending.length, ['заявка', 'заявки', 'заявок']) + ' на регистрацию', 'Никитин П. Г. просит роль владельца', 'Открыть')}
        ${item('bad', 'shield-x', 'Поддельный сертификат', U.when(forged.qrTimestamp) + ' · принял завхоз ' + esc(U.short(USER(forged.issuerId).fullName)) + ' · в QR указан «' + esc(forged.workerName) + '»', 'Разобрать')}
        ${item('bad', 'copy', 'Повтор QR-кода', U.when(dup.qrTimestamp) + ' · ' + esc(U.short(dup.workerName)) + ' · № ' + U.invNo(dup.toolId) + ' ' + esc(dup.toolName), 'Разобрать')}
        ${item('bad', 'shield-x', 'Подпись сотрудника не сходится', U.when(badSig.qrTimestamp) + ' · ' + esc(U.short(badSig.workerName)), 'Разобрать')}
        ${item('warn', 'clock', 'Долго на руках: № ' + U.invNo(longHold.id) + ' ' + esc(longHold.name), esc(U.short(longHold.holderName)) + ' · с ' + U.dm(longHold.heldSince) + ', уже ' + U.dur(D.NOW - longHold.heldSince), 'Открыть')}
        ${item('warn', 'octagon-x', U.nplural(broken.length, ['инструмент сломан', 'инструмента сломаны', 'инструментов сломаны']), broken.map((t) => '№ ' + U.invNo(t.id)).join(', ') + ' — решите: ремонт или списание', 'К реестру')}
      </div>` });
      const chart = card({ title: 'Операции за 14 дней', icon: 'calendar', aside: U.seg([['chart', 'График'], ['table', 'Таблица']], 'chart'), body: chartHtml() });
      const inc = D.damageIncidents(D.LOGS, D.NOW - 30 * D.DAY);
      const incidents = card({
        title: 'Повреждения при возврате', icon: 'wrench', cls: 'card--flush',
        body: `<div style="margin-top:8px">${inc.map((x) => `<div class="attn__item"><span class="attn__icon" style="background:var(--surface-3);color:var(--ink-2)">${icon('user')}</span><div style="min-width:0">
          <div class="attn__title">${esc(x.toolName)}</div>
          <div class="row" style="margin-top:6px">${U.cond(x.from)}${icon('arrow-r', 'i--s')}${U.cond(x.to)}</div>
          <div class="attn__meta" style="margin-top:6px">У сотрудника: <b class="ink-2">${esc(U.short(x.workerName))}</b>${USER(x.workerId).isActive ? '' : ' (уволен)'} · взял ${U.when(x.takeAt)}, вернул ${U.time(x.giveAt)}</div></div></div>`).join('')}</div>`,
        foot: '<p class="t-small muted">Возврат в худшем состоянии, чем при выдаче, по подтверждённым записям за 30 дней.</p>',
      });
      return U.shell({
        role: 'Owner', active: 'owner-overview',
        topbar: U.topbar({ title: 'Обзор', sub: 'вторник, 29 сентября · данные на 14:02' }),
        body: `<div class="page">${tiles}<div class="cols"><div class="stack-l">${attention}${chart}</div><div class="stack-l">${incidents}</div></div></div>`,
      });
    },
  };

  SCREENS.users = {
    title: 'Пользователи', path: '/users',
    render(v) {
      const tab = ['active', 'dismiss'].includes(v) ? 'active' : v === 'dismissed' ? 'dismissed' : 'requests';
      const me = D.SESSION.owner.userId;
      const groups = {
        requests: D.USERS.filter((u) => u.isActive && !u.isApproved),
        active: D.USERS.filter((u) => u.isActive && u.isApproved),
        dismissed: D.USERS.filter((u) => !u.isActive),
      };
      const rows = groups[tab];
      const tabs = `<div class="tabs">
        <span class="tabs__item${tab === 'requests' ? ' is-on' : ''}">Заявки <span class="count">${groups.requests.length}</span></span>
        <span class="tabs__item${tab === 'active' ? ' is-on' : ''}">Работают <span class="count">${groups.active.length}</span></span>
        <span class="tabs__item${tab === 'dismissed' ? ' is-on' : ''}">Уволены <span class="count">${groups.dismissed.length}</span></span></div>`;
      const filters = `<div class="filters"><div class="search">${icon('search')}<div class="input"><span class="input__ph">ФИО или телефон</span></div></div>
        <div class="hscroll"><span class="fchip is-on">Все роли</span><span class="fchip">Сотрудники</span><span class="fchip">Завхозы</span><span class="fchip">Владельцы</span></div></div>`;
      const person = (u) => `<div class="row row--nowrap" style="gap:12px">${U.avatar(u.fullName, 'avatar--s')}<div style="min-width:0"><div class="strong">${esc(u.fullName)}</div>${u.id === me ? `<div style="margin-top:4px">${U.chip('accent', null, 'Это вы')}</div>` : ''}</div></div>`;
      const roleCell = (u) => `<div class="row">${U.roleChip(u.role)}${!u.isApproved && u.isActive && u.role === 'Owner' ? U.chip('warn', 'alert', 'Полные права') : ''}</div>`;
      const actions = (u) => tab === 'requests'
        ? `<div class="row" style="justify-content:flex-end">${U.btn('Отклонить', { kind: 'secondary', size: 's' })}${U.btn('Подтвердить', { kind: 'primary', size: 's', icon: 'check' })}</div>`
        : tab === 'active' ? (u.id === me ? '' : U.btn('Уволить', { kind: 'ghost', size: 's', cls: 'danger-text' })) : '';
      const table = `<div class="tbl-wrap only-wide"><table class="tbl"><thead><tr><th>ФИО</th><th>Телефон</th><th>Роль</th><th>Статус</th><th></th></tr></thead><tbody>
        ${rows.map((u) => `<tr><td>${person(u)}</td><td class="mono nowrap">${U.phone(u.phone)}</td><td>${roleCell(u)}</td><td>${U.userStatus(u)}</td><td class="c-right">${actions(u)}</td></tr>`).join('')}
      </tbody></table></div>`;
      const list = `<div class="list only-narrow">${rows.map((u) => `<div class="list__item" style="grid-template-columns:1fr">
        <div>${person(u)}<div class="list__meta mono" style="margin-top:6px">${U.phone(u.phone)}</div><div class="row" style="margin-top:8px">${roleCell(u)}${tab === 'requests' ? '' : U.userStatus(u)}</div></div>
        ${tab === 'requests' ? `<div class="row" style="display:grid;grid-template-columns:1fr 1fr">${U.btn('Отклонить', { kind: 'secondary', size: 's' })}${U.btn('Подтвердить', { kind: 'primary', size: 's' })}</div>` : ''}</div>`).join('')}</div>`;
      const notes = {
        requests: 'Без подтверждения вход закрыт. Уведомлений о новых заявках нет — заглядывайте сюда; счётчик в меню показывает, сколько ждут.',
        active: 'Увольнение не удаляет запись: журнал на неё ссылается. Себя уволить нельзя.',
        dismissed: 'Восстановить уволенного нельзя: номер остаётся занят, и зарегистрироваться с ним заново не получится.',
      };
      let overlay = '';
      const dialog = (title, lead, body, confirm) => `<div class="scrim"></div><div class="dialog">${confirm.danger ? '<div class="danger__tape"></div>' : ''}<div class="dialog__head"><h2 class="dialog__title">${title}</h2><p class="dialog__lead">${lead}</p></div><div class="dialog__body">${body}</div><div class="dialog__foot">${U.btn('Отмена', { kind: 'secondary' })}${U.btn(confirm.label, { kind: confirm.danger ? 'danger' : 'primary' })}</div></div>`;
      if (v === 'approve-owner') {
        const u = USER(17);
        overlay = dialog('Подтвердить владельца?', `${esc(u.fullName)} · <span class="mono">${U.phone(u.phone)}</span>`,
          U.alert('warn', 'alert', 'Полные права', 'Владелец подтверждает заявки, увольняет людей и списывает инструмент. Роль после подтверждения не меняется.'),
          { label: 'Подтвердить владельца' });
      }
      if (v === 'dismiss') {
        const u = USER(7);
        const held = D.TOOLS.filter((t) => t.holderId === u.id);
        overlay = dialog('Уволить сотрудника?', `${esc(u.fullName)} · Сотрудник · <span class="mono">${U.phone(u.phone)}</span>`,
          `<ul class="consequences">
            <li>${icon('lock')}<span>Не сможет войти и получить новый сертификат</span></li>
            <li>${icon('clock')}<span>Уже выданные вход и сертификат действуют до конца срока — не больше 12 часов</span></li>
            <li>${icon('list')}<span>Записи журнала сохранятся</span></li>
            <li>${icon('phone')}<span>Номер останется занят: вернуть сотрудника нельзя</span></li></ul>
          ${held.length ? U.alert('warn', 'wrench', 'На руках: ' + U.nplural(held.length, ['инструмент', 'инструмента', 'инструментов']), held.map((t) => '№ ' + U.invNo(t.id) + ' ' + esc(t.name) + ', с ' + U.time(t.heldSince)).join('<br>')) : ''}`,
          { label: 'Уволить', danger: true });
      }
      if (v === 'reject') {
        const u = USER(15);
        overlay = dialog('Отклонить заявку?', `${esc(u.fullName)} · Сотрудник · <span class="mono">${U.phone(u.phone)}</span>`,
          `<p>Заявка отключается так же, как увольнение. Зарегистрироваться повторно с номером <span class="mono">${U.phone(u.phone)}</span> будет нельзя.</p>`,
          { label: 'Отклонить заявку', danger: true });
      }
      return U.shell({
        role: 'Owner', active: 'users',
        topbar: U.topbar({ title: 'Пользователи', sub: U.nplural(D.USERS.length, ['учётная запись', 'учётные записи', 'учётных записей']) }),
        body: `<div class="page">${tabs}${filters}${table}${list}<p class="note">${icon('info')}<span>${notes[tab]}</span></p></div>`,
        overlay,
      });
    },
  };

  window.AT_SCREENS = SCREENS;
})();
