/* =====================================================================
   AccountThis — компоненты макетов: иконки, форматирование, разметка.
   Каждая функция возвращает строку HTML. Логики приложения здесь нет.
   ===================================================================== */
(function () {
  'use strict';
  const D = window.AT_DATA;

  /* ---------------- Иконки: контур 2px на сетке 24×24 ---------------- */
  const ICONS = {
    scan: 'M4 8V6a2 2 0 0 1 2-2h2M16 4h2a2 2 0 0 1 2 2v2M20 16v2a2 2 0 0 1-2 2h-2M8 20H6a2 2 0 0 1-2-2v-2M4 12h16',
    qr: 'M4 4h6v6H4zM14 4h6v6h-6zM4 14h6v6H4zM14 14h2.5v2.5H14zM17.5 17.5H20V20h-2.5zM14 20h.01M20 14h.01',
    wrench: 'M15.5 3.5a4.5 4.5 0 0 0-4.3 5.8L3.8 16.7a2 2 0 0 0 2.8 2.8l7.4-7.4a4.5 4.5 0 0 0 5.8-4.3l-2.6 2.6-2.8-.7-.7-2.8z',
    users: 'M16 20v-1.5a3.5 3.5 0 0 0-3.5-3.5h-5A3.5 3.5 0 0 0 4 18.5V20M10 11.5a3.5 3.5 0 1 0 0-7 3.5 3.5 0 0 0 0 7zM20 20v-1.5a3.5 3.5 0 0 0-2.6-3.4M15.5 4.6a3.5 3.5 0 0 1 0 6.8',
    user: 'M19 20v-1.5a3.5 3.5 0 0 0-3.5-3.5h-7A3.5 3.5 0 0 0 5 18.5V20M12 11.5a3.5 3.5 0 1 0 0-7 3.5 3.5 0 0 0 0 7z',
    list: 'M9 6h11M9 12h11M9 18h11M4.5 6h.01M4.5 12h.01M4.5 18h.01',
    grid: 'M4 4h6.5v6.5H4zM13.5 4H20v6.5h-6.5zM4 13.5h6.5V20H4zM13.5 13.5H20V20h-6.5z',
    clipboard: 'M9 3.5h6v3H9zM7 5H5.5A1.5 1.5 0 0 0 4 6.5v13A1.5 1.5 0 0 0 5.5 21h13a1.5 1.5 0 0 0 1.5-1.5v-13A1.5 1.5 0 0 0 18.5 5H17M8 12h8M8 16h5',
    sync: 'M20 12a8 8 0 0 1-14 5.3M4 12a8 8 0 0 1 14-5.3M18 3v4h-4M6 21v-4h4',
    upload: 'M12 15V4M7.5 8.5 12 4l4.5 4.5M4 15v3.5A1.5 1.5 0 0 0 5.5 20h13a1.5 1.5 0 0 0 1.5-1.5V15',
    wifi: 'M2.5 9a14 14 0 0 1 19 0M5.5 12.5a9.5 9.5 0 0 1 13 0M8.8 16a5 5 0 0 1 6.4 0M12 19.5h.01',
    'wifi-off': 'M3 3l18 18M8.8 16a5 5 0 0 1 6.4 0M12 19.5h.01M5.5 12.5a9.5 9.5 0 0 1 4.2-2.4M2.5 9a14 14 0 0 1 4.4-2.8M13.6 7.1A14 14 0 0 1 21.5 9M16.6 10.6a9.5 9.5 0 0 1 1.9 1.9',
    check: 'M5 12.5l4.5 4.5L19 7.5',
    'check-circle': 'M12 21a9 9 0 1 0 0-18 9 9 0 0 0 0 18zM8.2 12.3l2.6 2.6 5-5.2',
    alert: 'M10.3 4.2 2.6 17.5A2 2 0 0 0 4.3 20.5h15.4a2 2 0 0 0 1.7-3L13.7 4.2a2 2 0 0 0-3.4 0zM12 9.5v4M12 17h.01',
    'octagon-x': 'M8.2 3h7.6L21 8.2v7.6L15.8 21H8.2L3 15.8V8.2zM9.5 9.5l5 5M14.5 9.5l-5 5',
    clock: 'M12 21a9 9 0 1 0 0-18 9 9 0 0 0 0 18zM12 7.5V12l3 2',
    key: 'M15.5 14a5 5 0 1 0-4.6-3.1L3 18.8V21h3v-2h2v-2h2l1.8-1.8A5 5 0 0 0 15.5 14zM16.5 8.5h.01',
    shield: 'M12 3l7.5 3v5.6c0 4.4-3.1 8.2-7.5 9.4-4.4-1.2-7.5-5-7.5-9.4V6z',
    'shield-check': 'M12 3l7.5 3v5.6c0 4.4-3.1 8.2-7.5 9.4-4.4-1.2-7.5-5-7.5-9.4V6zM8.8 12.2l2.2 2.2 4.3-4.4',
    'shield-x': 'M12 3l7.5 3v5.6c0 4.4-3.1 8.2-7.5 9.4-4.4-1.2-7.5-5-7.5-9.4V6zM9.7 9.7l4.6 4.6M14.3 9.7l-4.6 4.6',
    printer: 'M7 9V3.5h10V9M7 17.5H5A1.5 1.5 0 0 1 3.5 16v-5.5A1.5 1.5 0 0 1 5 9h14a1.5 1.5 0 0 1 1.5 1.5V16a1.5 1.5 0 0 1-1.5 1.5h-2M7 14h10v6.5H7z',
    plus: 'M12 5v14M5 12h14',
    search: 'M10.5 17.5a7 7 0 1 0 0-14 7 7 0 0 0 0 14zM20 20l-4.5-4.5',
    'chev-r': 'M9 5l7 7-7 7',
    'chev-l': 'M15 5l-7 7 7 7',
    'chev-d': 'M5 9l7 7 7-7',
    'arrow-out': 'M7 17 17 7M9 7h8v8',
    'arrow-in': 'M17 7 7 17M15 17H7V9',
    'arrow-r': 'M5 12h14M13 6l6 6-6 6',
    x: 'M6 6l12 12M18 6 6 18',
    logout: 'M9 20H5.5A1.5 1.5 0 0 1 4 18.5v-13A1.5 1.5 0 0 1 5.5 4H9M15 16l4-4-4-4M19 12H9',
    camera: 'M4.5 7.5h3l1.8-2.5h5.4l1.8 2.5h3A1.5 1.5 0 0 1 21 9v9.5a1.5 1.5 0 0 1-1.5 1.5h-15A1.5 1.5 0 0 1 3 18.5V9a1.5 1.5 0 0 1 1.5-1.5zM12 17a3.5 3.5 0 1 0 0-7 3.5 3.5 0 0 0 0 7z',
    'camera-off': 'M3 3l18 18M9.3 5h5.4l1.8 2.5h3A1.5 1.5 0 0 1 21 9v8.5M17.5 20h-13A1.5 1.5 0 0 1 3 18.5V9a1.5 1.5 0 0 1 1.5-1.5H6M9.6 11a3.5 3.5 0 0 0 4.9 4.9',
    flash: 'M13.5 3 5 13.5h6L10 21l9-11h-6.5z',
    sun: 'M12 16.5a4.5 4.5 0 1 0 0-9 4.5 4.5 0 0 0 0 9zM12 2.5v2M12 19.5v2M4.6 4.6 6 6M18 18l1.4 1.4M2.5 12h2M19.5 12h2M4.6 19.4 6 18M18 6l1.4-1.4',
    moon: 'M20 14.5A8 8 0 0 1 9.5 4a8 8 0 1 0 10.5 10.5z',
    eye: 'M2.5 12S6 5.5 12 5.5 21.5 12 21.5 12 18 18.5 12 18.5 2.5 12 2.5 12zM12 15a3 3 0 1 0 0-6 3 3 0 0 0 0 6z',
    'eye-off': 'M3 3l18 18M10.6 5.6A9.6 9.6 0 0 1 12 5.5c6 0 9.5 6.5 9.5 6.5a17 17 0 0 1-2.9 3.6M6.4 6.9C3.9 8.6 2.5 12 2.5 12S6 18.5 12 18.5c1.6 0 3-.4 4.2-1M9.9 9.9a3 3 0 0 0 4.2 4.2',
    more: 'M5 12h.01M12 12h.01M19 12h.01',
    phone: 'M8 2.5h8A1.5 1.5 0 0 1 17.5 4v16a1.5 1.5 0 0 1-1.5 1.5H8A1.5 1.5 0 0 1 6.5 20V4A1.5 1.5 0 0 1 8 2.5zM11 18.5h2',
    monitor: 'M3.5 4.5h17a1 1 0 0 1 1 1v10a1 1 0 0 1-1 1h-17a1 1 0 0 1-1-1v-10a1 1 0 0 1 1-1zM8 20.5h8M12 16.5v4',
    box: 'M3.5 7.5 12 3l8.5 4.5v9L12 21l-8.5-4.5zM3.5 7.5 12 12l8.5-4.5M12 12v9',
    archive: 'M3 4.5h18v4H3zM4.5 8.5v10A1.5 1.5 0 0 0 6 20h12a1.5 1.5 0 0 0 1.5-1.5v-10M10 12.5h4',
    edit: 'M4 20h4L19 9l-4-4L4 16zM13.5 6.5l4 4',
    copy: 'M9 9h10.5v10.5H9zM5 15h-.5V4.5H15V5',
    info: 'M12 21a9 9 0 1 0 0-18 9 9 0 0 0 0 18zM12 11v5.5M12 8h.01',
    lock: 'M6.5 10.5h11A1.5 1.5 0 0 1 19 12v7.5A1.5 1.5 0 0 1 17.5 21h-11A1.5 1.5 0 0 1 5 19.5V12a1.5 1.5 0 0 1 1.5-1.5zM8.5 10.5V7.5a3.5 3.5 0 0 1 7 0v3',
    filter: 'M4 5h16l-6 7.5V19l-4 1.5v-8z',
    board: 'M4 4h16v16H4zM8 8h.01M12 8h.01M16 8h.01M8 12h.01M12 12h.01M16 12h.01M8 16h.01M12 16h.01M16 16h.01',
    table: 'M4 5h16v14H4zM4 10h16M4 14.5h16M10 10v9',
    calendar: 'M4.5 5.5h15A1.5 1.5 0 0 1 21 7v12a1.5 1.5 0 0 1-1.5 1.5h-15A1.5 1.5 0 0 1 3 19V7a1.5 1.5 0 0 1 1.5-1.5zM3 10h18M8 3v4M16 3v4',
    refresh: 'M20 12a8 8 0 1 1-2.3-5.6M20 4v5h-5',
    hourglass: 'M7 3h10M7 21h10M8 3c0 4.5 8 5 8 9s-8 4.5-8 9M16 3c0 4.5-8 5-8 9s8 4.5 8 9',
    home: 'M4 10.5 12 4l8 6.5V20h-5v-6H9v6H4z',
    'user-check': 'M15 20v-1.5a3.5 3.5 0 0 0-3.5-3.5h-5A3.5 3.5 0 0 0 3 18.5V20M9 11.5a3.5 3.5 0 1 0 0-7 3.5 3.5 0 0 0 0 7zM15.5 11.5l2 2 4-4',
    'user-x': 'M15 20v-1.5a3.5 3.5 0 0 0-3.5-3.5h-5A3.5 3.5 0 0 0 3 18.5V20M9 11.5a3.5 3.5 0 1 0 0-7 3.5 3.5 0 0 0 0 7zM16.5 8.5l4 4M20.5 8.5l-4 4',
    link: 'M10 14a4 4 0 0 0 5.7 0l3-3a4 4 0 0 0-5.7-5.7l-1 1M14 10a4 4 0 0 0-5.7 0l-3 3a4 4 0 0 0 5.7 5.7l1-1',
    type: 'M4 7V5h16v2M9 19h6M12 5v14',
    palette: 'M12 3a9 9 0 0 0 0 18c1 0 1.5-.7 1.5-1.5 0-.4-.2-.8-.4-1.1-.3-.3-.4-.7-.4-1.1 0-.8.7-1.5 1.5-1.5H16a5 5 0 0 0 5-5c0-4.3-4-7.8-9-7.8zM7.5 12h.01M9.5 7.5h.01M14.5 7.5h.01',
  };

  function icon(name, cls) {
    const p = ICONS[name];
    if (!p) throw new Error('Нет иконки: ' + name);
    return `<svg class="i${cls ? ' ' + cls : ''}" viewBox="0 0 24 24" aria-hidden="true"><path d="${p}"/></svg>`;
  }

  function esc(s) {
    return String(s == null ? '' : s).replace(/[&<>"']/g, (c) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c]));
  }

  /* ---------------- Форматирование ---------------- */
  const TZ = 'Europe/Moscow';
  const fmt = (o) => new Intl.DateTimeFormat('ru-RU', Object.assign({ timeZone: TZ }, o));
  const F = {
    time: fmt({ hour: '2-digit', minute: '2-digit' }),
    timeS: fmt({ hour: '2-digit', minute: '2-digit', second: '2-digit' }),
    dayMonth: fmt({ day: 'numeric', month: 'long' }),
    dm: fmt({ day: '2-digit', month: '2-digit' }),
    weekday: fmt({ weekday: 'short' }),
  };
  const time = (u) => F.time.format(u * 1000);
  const timeS = (u) => F.timeS.format(u * 1000);
  const dayIdx = (u) => Math.floor((u - D.T0) / D.DAY);
  const dm = (u) => F.dm.format(u * 1000);
  const dayMonth = (u) => F.dayMonth.format(u * 1000);
  const weekday = (u) => F.weekday.format(u * 1000);
  /** «сегодня, 14:02» / «вчера, 16:47» / «26.09, 17:02» */
  function when(u) {
    const d = dayIdx(u);
    if (d === 0) return 'сегодня, ' + time(u);
    if (d === -1) return 'вчера, ' + time(u);
    return dm(u) + ', ' + time(u);
  }
  /** Короткая форма для таблиц: «14:02» / «вчера 16:47» / «26.09 17:02» */
  function whenShort(u) {
    const d = dayIdx(u);
    if (d === 0) return time(u);
    if (d === -1) return 'вчера ' + time(u);
    return dm(u) + ' ' + time(u);
  }
  function dur(sec) {
    sec = Math.max(0, Math.round(sec));
    const d = Math.floor(sec / D.DAY), h = Math.floor((sec % D.DAY) / D.HOUR), m = Math.floor((sec % D.HOUR) / D.MIN), s = sec % D.MIN;
    if (d > 0) return d + ' дн.' + (h ? ' ' + h + ' ч' : '');
    if (h > 0) return h + ' ч' + (m ? ' ' + m + ' мин' : '');
    if (m > 0) return m + ' мин' + (s && m < 5 ? ' ' + s + ' с' : '');
    return s + ' с';
  }
  const ago = (u) => dur(D.NOW - u) + ' назад';
  /** +79000000104 → +7 (900) 000-01-04 */
  function phone(p) {
    const m = /^\+7(\d{3})(\d{3})(\d{2})(\d{2})$/.exec(p);
    return m ? `+7 (${m[1]}) ${m[2]}-${m[3]}-${m[4]}` : p;
  }
  /** «Петров Алексей Сергеевич» → «Петров А. С.» (ФИО не склоняем — см. дизайн-систему) */
  function short(name) {
    if (!name) return '';
    const [last, first, middle] = name.split(/\s+/);
    return [last, first ? first[0] + '.' : '', middle ? middle[0] + '.' : ''].filter(Boolean).join(' ');
  }
  function initials(name) {
    const [last, first] = (name || '').split(/\s+/);
    return ((last || '')[0] || '') + ((first || '')[0] || '');
  }
  const invNo = (id) => String(id).padStart(4, '0');
  const PR = new Intl.PluralRules('ru-RU');
  /** plural(3, ['инструмент', 'инструмента', 'инструментов']) → «инструмента» */
  function plural(n, forms) {
    const k = PR.select(n);
    return k === 'one' ? forms[0] : k === 'few' ? forms[1] : forms[2];
  }
  const nplural = (n, forms) => n + ' ' + plural(n, forms);

  /* ---------------- Базовые элементы ---------------- */
  function logoMark() {
    return '<svg class="logo__mark" viewBox="0 0 28 28" aria-hidden="true"><rect class="logo__ring" x="2" y="2" width="24" height="24" rx="6.5"/><rect class="logo__core" x="9" y="9" width="10" height="10" rx="2.5"/></svg>';
  }
  function logo(mod) {
    return `<span class="logo${mod ? ' ' + mod : ''}">${logoMark()}<span>AccountThis</span></span>`;
  }

  function chip(tone, ic, text, mod) {
    return `<span class="chip chip--${tone}${ic ? '' : ' chip--noicon'}${mod ? ' ' + mod : ''}">${ic ? icon(ic) : ''}<span>${esc(text)}</span></span>`;
  }
  function cond(c, mod) {
    const d = D.DICT.condition[c];
    return chip(d.tone, d.icon, d.label, mod);
  }
  function flag(f, mod) {
    const d = D.DICT.flag[f];
    return chip(d.tone, d.icon, d.label, mod);
  }
  function act(a, label) {
    const d = D.DICT.action[a];
    return `<span class="act act--${a}">${icon(d.icon)}<span>${esc(label || d.label)}</span></span>`;
  }
  function roleChip(r) {
    return chip('outline', null, D.DICT.role[r].label);
  }
  function userStatus(u) {
    if (!u.isActive && !u.isApproved) return chip('neutral', 'x', 'Заявка отклонена');
    if (!u.isActive) return chip('neutral', 'lock', 'Уволен');
    if (!u.isApproved) return chip('warn', 'clock', 'Ждёт подтверждения');
    return chip('good', 'check', 'Работает');
  }
  function inv(id, mod) {
    return `<span class="inv${mod ? ' ' + mod : ''}">№ ${invNo(id)}</span>`;
  }
  /** Где сейчас: «На месте» или «На руках · Фамилия И. О.» + с какого времени */
  function place(tool, local) {
    const localLine = local ? `<span class="place__local">${icon('upload')}${esc(local)}</span>` : '';
    if (!tool.holderId) {
      return `<div class="place place--in"><span class="place__main"><span class="dot"></span>На месте</span>${localLine}</div>`;
    }
    const since = dayIdx(tool.heldSince) === 0 ? 'с ' + time(tool.heldSince) : 'с ' + dm(tool.heldSince) + ' · ' + dur(D.NOW - tool.heldSince);
    return `<div class="place place--out"><span class="place__main"><span class="dot"></span>${esc(short(tool.holderName))}</span><span class="place__sub">${since}</span>${localLine}</div>`;
  }
  function net(online) {
    return online
      ? '<span class="net"><span class="net__dot"></span>В сети</span>'
      : `<span class="net net--off">${icon('wifi-off')}Нет сети</span>`;
  }
  /** Кнопка: kind — primary | secondary | ghost | danger | danger-outline | give */
  function btn(label, o) {
    o = o || {};
    const cls = ['btn', 'btn--' + (o.kind || 'secondary')];
    if (o.size) cls.push('btn--' + o.size);
    if (o.block) cls.push('btn--block');
    if (o.disabled) cls.push('is-disabled');
    if (o.cls) cls.push(o.cls);
    return `<button class="${cls.join(' ')}" type="button">${o.icon ? icon(o.icon) : ''}${label ? '<span>' + esc(label) + '</span>' : ''}${o.iconEnd ? icon(o.iconEnd) : ''}</button>`;
  }
  function iconBtn(name, mod) {
    return `<button class="icon-btn${mod ? ' ' + mod : ''}" type="button" aria-label="">${icon(name)}</button>`;
  }
  /** Поле ввода (статичное): value / placeholder / hint / error / counter / suffix-иконка */
  function field(o) {
    const st = o.error ? ' input--error' : o.focus ? ' input--focus' : o.disabled ? ' input--disabled' : '';
    const val = o.value != null
      ? `<span class="input__value${o.password ? ' dots' : ''}">${o.password ? '•'.repeat(o.value) : esc(o.value)}${o.focus ? '<span class="caret"></span>' : ''}</span>`
      : `${o.focus ? '<span class="caret"></span>' : ''}<span class="input__ph">${esc(o.placeholder || '')}</span>`;
    const counter = o.counter ? `<span class="field__counter">${o.counter}</span>` : '';
    return `<div class="field${o.error ? ' field--error' : ''}">
      <div class="field__label"><span>${esc(o.label)}</span>${counter}</div>
      <div class="input${st}${o.mono ? ' input--mono' : ''}${o.area ? ' input--area' : ''}">${o.lead ? icon(o.lead) : ''}${val}${o.suffix ? icon(o.suffix) : ''}</div>
      ${o.error ? `<div class="field__error">${icon('alert')}<span>${esc(o.error)}</span></div>` : ''}
      ${o.hint ? `<div class="field__hint">${esc(o.hint)}</div>` : ''}
    </div>`;
  }
  function alert(tone, ic, title, text) {
    return `<div class="alert alert--${tone}">${icon(ic)}<div>${title ? `<div class="alert__title">${esc(title)}</div>` : ''}${text ? `<div class="alert__text">${text}</div>` : ''}</div></div>`;
  }
  function avatar(name, mod) {
    return `<span class="avatar${mod ? ' ' + mod : ''}">${name ? esc(initials(name)) : icon('user', 'i--s')}</span>`;
  }
  function checkbox(on, text) {
    return `<div class="checkbox${on ? ' is-on' : ''}"><span class="checkbox__box">${on ? icon('check') : ''}</span><span>${text}</span></div>`;
  }
  function seg(options, on) {
    return `<div class="seg">${options.map(([id, label, ic]) => `<span class="seg__opt${id === on ? ' is-on' : ''}">${ic ? icon(ic) : ''}${esc(label)}</span>`).join('')}</div>`;
  }

  /* ---------------- Имитация QR-кода ----------------
     Настоящий QR формирует приложение (строка AT1… для сотрудника, id и название для наклейки).
     Здесь рисуется правдоподобный узор нужной плотности: n модулей на сторону. */
  function hashStr(s) {
    let h = 2166136261 >>> 0;
    for (let k = 0; k < s.length; k++) { h ^= s.charCodeAt(k); h = Math.imul(h, 16777619) >>> 0; }
    return h;
  }
  function mulberry32(a) {
    return function () {
      a |= 0; a = (a + 0x6D2B79F5) | 0;
      let t = Math.imul(a ^ (a >>> 15), 1 | a);
      t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t;
      return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
    };
  }
  function qr(seed, n) {
    n = n || 33;
    const rnd = mulberry32(hashStr(seed));
    const m = [], res = [];
    for (let r = 0; r < n; r++) { m.push(new Array(n).fill(0)); res.push(new Array(n).fill(false)); }
    const finder = (r0, c0) => {
      for (let r = -1; r <= 7; r++) for (let c = -1; c <= 7; c++) {
        const rr = r0 + r, cc = c0 + c;
        if (rr < 0 || cc < 0 || rr >= n || cc >= n) continue;
        res[rr][cc] = true;
        const ring = (r === 0 || r === 6 || c === 0 || c === 6) && r >= 0 && r <= 6 && c >= 0 && c <= 6;
        const core = r >= 2 && r <= 4 && c >= 2 && c <= 4;
        m[rr][cc] = ring || core ? 1 : 0;
      }
    };
    finder(0, 0); finder(0, n - 7); finder(n - 7, 0);
    for (let k = 8; k < n - 8; k++) {
      if (!res[6][k]) { m[6][k] = k % 2 === 0 ? 1 : 0; res[6][k] = true; }
      if (!res[k][6]) { m[k][6] = k % 2 === 0 ? 1 : 0; res[k][6] = true; }
    }
    const version = (n - 17) / 4;
    if (version >= 2) {
      const count = Math.floor(version / 7) + 2;
      const last = n - 7, step = Math.round((last - 6) / (count - 1));
      const pos = [];
      for (let k = 0; k < count; k++) pos.push(k === count - 1 ? last : 6 + k * step);
      pos.forEach((r0) => pos.forEach((c0) => {
        for (let r = -2; r <= 2; r++) for (let c = -2; c <= 2; c++) if (res[r0 + r] && res[r0 + r][c0 + c]) return;
        for (let r = -2; r <= 2; r++) for (let c = -2; c <= 2; c++) {
          res[r0 + r][c0 + c] = true;
          m[r0 + r][c0 + c] = Math.max(Math.abs(r), Math.abs(c)) === 1 ? 0 : 1;
        }
      }));
    }
    for (let r = 0; r < n; r++) for (let c = 0; c < n; c++) if (!res[r][c]) m[r][c] = rnd() < 0.47 ? 1 : 0;
    let d = '';
    for (let r = 0; r < n; r++) {
      let c = 0;
      while (c < n) {
        if (!m[r][c]) { c++; continue; }
        const s = c;
        while (c < n && m[r][c]) c++;
        d += `M${s} ${r}h${c - s}v1h${s - c}z`;
      }
    }
    const q = 4;
    return `<svg viewBox="${-q} ${-q} ${n + 2 * q} ${n + 2 * q}" shape-rendering="crispEdges" aria-hidden="true"><rect x="${-q}" y="${-q}" width="${n + 2 * q}" height="${n + 2 * q}" fill="var(--qr-bg)"/><path d="${d}" fill="var(--qr-fg)"/></svg>`;
  }

  /** Наклейка на инструмент: QR (id + название) и крупный инвентарный номер */
  function sticker(tool, o) {
    o = o || {};
    const w = o.width ? ` style="--sticker-w:${o.width}px"` : '';
    return `<div class="sticker${o.thermal ? ' sticker--thermal' : ''}"${w}><div class="sticker__in">
      <div class="sticker__qr">${qr('tool:' + tool.id + ':' + tool.name, 29)}</div>
      <div class="sticker__text">
        <div class="sticker__brand">${logoMark()}AccountThis</div>
        <div class="sticker__label">Инв. номер</div>
        <div class="sticker__no">${invNo(tool.id)}</div>
      </div>
      <div class="sticker__name">${esc(tool.name)}</div>
    </div></div>`;
  }

  /* ---------------- Каркас приложения ---------------- */
  const pendingUsers = D.USERS.filter((u) => u.isActive && !u.isApproved).length;
  const pendingLocal = D.LOCAL.filter((r) => r.status === 'pending').length;
  const NAV = {
    Owner: [
      ['owner-overview', 'grid', 'Обзор'],
      ['tools', 'wrench', 'Инструменты'],
      ['journal', 'list', 'Журнал'],
      ['users', 'users', 'Пользователи', pendingUsers],
    ],
    Issuer: [
      ['issuer-shift', 'clipboard', 'Смена', pendingLocal],
      ['tools', 'wrench', 'Инструменты'],
      ['journal', 'list', 'Журнал'],
    ],
  };

  function rail(role, active, o) {
    o = o || {};
    const online = o.online !== false;
    const s = role === 'Owner' ? D.SESSION.owner : D.SESSION.issuer;
    const me = D.USERS_BY_ID[s.userId];
    // Имени завхоза нет ни в JWT, ни в доступных ему эндпоинтах — показываем номер, с которым он вошёл
    const who = role === 'Owner'
      ? `${avatar(me.fullName)}<div style="min-width:0"><div class="rail__user-name">${esc(short(me.fullName))}</div><div class="rail__user-role">Владелец</div></div>`
      : `${avatar(null)}<div style="min-width:0"><div class="rail__user-name">${esc(phone(s.phone))}</div><div class="rail__user-role">Завхоз</div></div>`;
    return `<aside class="rail">
      <div class="rail__brand">${logo('logo--light')}</div>
      ${role === 'Issuer' ? `<div class="rail__cta">${btn('Сканировать QR', { kind: 'primary', icon: 'scan' })}</div>` : ''}
      <nav class="rail__nav">${NAV[role].map(([id, ic, label, n]) => `<span class="rail__item${id === active ? ' is-on' : ''}">${icon(ic)}<span>${label}</span>${n ? `<span class="count${id === 'users' || id === 'issuer-shift' ? ' count--accent' : ''}">${n}</span>` : ''}</span>`).join('')}</nav>
      <div class="rail__foot">
        <div class="rail__net${online ? '' : ' is-off'}"><span class="net__dot"></span>${online ? 'В сети' : 'Нет сети'}</div>
        <div class="rail__user">${who}${iconBtn('logout')}</div>
      </div>
    </aside>`;
  }

  function tabbar(role, active, pending) {
    const pl = pending == null ? pendingLocal : pending;
    const items = role === 'Owner'
      ? [['owner-overview', 'grid', 'Обзор'], ['tools', 'wrench', 'Инструменты'], ['journal', 'list', 'Журнал'], ['users', 'users', 'Люди', pendingUsers]]
      : [['issuer-shift', 'clipboard', 'Смена', pl], ['issuer-scan', 'scan', 'Сканер'], ['tools', 'wrench', 'Инструменты'], ['journal', 'list', 'Журнал']];
    return `<nav class="tabbar">${items.map(([id, ic, label, n]) => `<span class="tabbar__item${id === active ? ' is-on' : ''}${id === 'issuer-scan' ? ' tabbar__item--scan' : ''}"><span class="tabbar__icon">${icon(ic)}${n ? `<span class="tabbar__badge">${n}</span>` : ''}</span>${label}</span>`).join('')}</nav>`;
  }

  /** Шапка: на телефоне — строка с заголовком; на компьютере — заголовок страницы и действия */
  function topbar(o) {
    const back = o.back ? iconBtn('chev-l') : '';
    const crumb = o.crumb ? `<div class="topbar__crumb only-wide">${o.crumb}</div>` : '';
    return `<header class="topbar${o.back ? ' topbar--back' : ''}">
      <div class="topbar__lead">${o.back ? `<span class="only-narrow">${back}</span>` : ''}${o.lead || ''}
        <div class="topbar__titles">${crumb}<h1 class="topbar__title">${o.titleHtml || esc(o.title)}</h1>${o.sub ? `<p class="topbar__sub">${o.sub}</p>` : ''}</div>
      </div>
      <div class="topbar__actions">${o.actions || ''}</div>
    </header>`;
  }

  /** Экран приложения: боковая панель (компьютер) + шапка + тело + нижние вкладки (телефон) */
  function shell(o) {
    const withRail = !!o.role && o.rail !== false;
    return `<div class="app"><div class="shell${withRail ? ' shell--rail' : ''}">
      ${withRail ? rail(o.role, o.active, o) : ''}
      <div class="shell__main">
        ${o.topbar || ''}
        ${o.banner || ''}
        <main class="shell__body">${o.body}</main>
        ${o.bottom || ''}
        ${o.role && o.tabbar !== false ? tabbar(o.role, o.active, o.pending) : ''}
      </div>
    </div>${o.overlay || ''}</div>`;
  }

  window.AT_UI = {
    ICONS, icon, esc, time, timeS, dm, dayMonth, weekday, when, whenShort, dur, ago, dayIdx,
    phone, short, initials, invNo, plural, nplural,
    logo, logoMark, chip, cond, flag, act, roleChip, userStatus, inv, place, net, btn, iconBtn,
    field, alert, avatar, checkbox, seg, qr, sticker, rail, tabbar, topbar, shell,
    pendingUsers, pendingLocal,
  };
})();
