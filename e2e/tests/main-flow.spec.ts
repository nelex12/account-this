import { expect, test, type BrowserContext, type Page } from '@playwright/test';
import { readFileSync } from 'node:fs';
import { errorAlert, openSettled, loginOk, login, makeRunData, openAs, register, row, type Person } from '../helpers/app';
import { showToCamera } from '../helpers/fakeCamera';

test.describe.configure({ mode: 'serial' });

const D = makeRunData();
const P = D.people;

type Actor = { context: BrowserContext; page: Page };
let owner: Actor, issuer: Actor, worker: Actor, worker2: Actor;
let companyId = '';
const stickers: Record<string, Buffer> = {};

test.beforeAll(async ({ browser }) => {
  owner = await openAs(browser, 'desktop');
  issuer = await openAs(browser, 'phone');
  worker = await openAs(browser, 'phone');
  worker2 = await openAs(browser, 'phone');
});

test.afterAll(async () => {
  for (const a of [owner, issuer, worker, worker2]) await a?.context.close();
});

// helpers

async function gotoNav(page: Page, label: string) {
  await page.getByRole('link', { name: label }).or(page.getByRole('button', { name: label, exact: true })).first().click();
}

async function downloadSticker(toolName: string): Promise<Buffer> {
  const page = owner.page;
  await page.goto('/tools');
  await page.getByRole('button', { name: 'Печать/Загрузка наклеек' }).click();
  const dialog = page.getByRole('dialog', { name: 'Печать/Загрузка наклеек' });
  await dialog.getByRole('checkbox', { name: toolName, exact: true }).check();
  const [download] = await Promise.all([page.waitForEvent('download'), dialog.getByRole('button', { name: 'Скачать' }).click()]);
  expect(download.suggestedFilename()).toMatch(/\.png$/);
  const png = readFileSync(await download.path());
  await dialog.getByRole('button', { name: 'Закрыть' }).click();
  return png;
}

async function workerCreatesQr(
  w: Actor,
  toolName: string,
  opts: { action: 'Беру' | 'Возвращаю'; condition: 'Исправен' | 'Поврежден' | 'Сломан'; fromHeld?: boolean },
): Promise<Buffer> {
  const page = w.page;
  if (opts.fromHeld) {
    await page.goto('/overview');
    await page.getByRole('button', { name: new RegExp(toolName) }).click();
  } else {
    await page.goto('/overview');
    await page.getByRole('button', { name: 'Сканировать QR-код' }).click();
    await expect(page).toHaveURL(/\/scan$/);
    await showToCamera(page, stickers[toolName]);
  }
  await expect(page).toHaveURL(/\/operation$/);
  await expect(page.getByText(toolName)).toBeVisible();
  await page.getByRole('radio', { name: opts.action }).check();
  await page.getByRole('radio', { name: opts.condition }).check();
  await page.getByRole('button', { name: 'Создать qr-код' }).click();
  await expect(page).toHaveURL(/\/qr$/);
  const qr = page.getByRole('img', { name: 'QR-код операции для завхоза' });
  await expect(qr).toBeVisible();
  await expect(page.getByRole('timer')).toContainText('Действителен ещё');
  return qr.screenshot();
}

async function issuerScans(png: Buffer) {
  const page = issuer.page;
  if (!page.url().endsWith('/scan')) {
    await page.goto('/overview');
    await page.getByRole('button', { name: /Сканировать/ }).click();
    await expect(page).toHaveURL(/\/scan$/);
  }
  await showToCamera(page, png);
}

// 1. Вход и регистрация

test('1.1 Гость: защищённые страницы перенаправляют на /login', async () => {
  for (const url of ['/overview', '/tools', '/users', '/journal']) {
    await owner.page.goto(url);
    await expect(owner.page).toHaveURL(/\/login$/);
  }
  await expect(owner.page.getByRole('heading', { name: 'Вход' })).toBeVisible();
  const html = owner.page.locator('html');
  await expect(html).toHaveAttribute('lang', 'ru');
  await expect(html).toHaveAttribute('translate', 'no');
  await expect(owner.page.locator('meta[name="google"]')).toHaveAttribute('content', 'notranslate');
});

test('1.2 Регистрация: проверки формы на клиенте', async () => {
  const page = owner.page;
  await page.goto('/register');
  await page.getByRole('button', { name: 'Отправить заявку' }).click();
  await expect(page.getByText('Укажите ФИО')).toBeVisible();
  await expect(page.getByText('Укажите телефон')).toBeVisible();
  await page.getByLabel('Пароль', { exact: true }).fill('short');
  await page.getByLabel('Повторите пароль').fill('other');
  await page.getByRole('button', { name: 'Отправить заявку' }).click();
  await expect(page.getByText('Не менее 8 символов')).toBeVisible();
  await expect(page.getByText('Пароли не совпадают')).toBeVisible();
  await expect(page.getByText('Укажите ID компании')).toBeVisible(); // роль по умолчанию — Сотрудник
});

test('1.3 Владелец регистрирует компанию и входит', async () => {
  const page = owner.page;
  await register(page, P.owner, { name: D.companyName });
  await expect(page).toHaveURL(/\/login$/);
  await expect(page.getByText('Регистрация прошла успешно. Войдите')).toBeVisible();
  await loginOk(page, P.owner);
  for (const item of ['Обзор', 'Инструменты', 'Журнал', 'Пользователи', 'Профиль']) {
    await expect(page.getByRole('link', { name: item }).first()).toBeVisible();
  }
});

test('1.4 Неверный пароль и неизвестный телефон не пускают', async ({ browser }) => {
  const { context, page } = await openAs(browser, 'desktop');
  await login(page, { phone: P.owner.phone, password: P.owner.password + 'x' });
  await expect(errorAlert(page)).toBeVisible();
  await expect(page).toHaveURL(/\/login$/);
  await login(page, { phone: '+70000000000', password: 'whatever-123' });
  await expect(errorAlert(page)).toBeVisible();
  await expect(page).toHaveURL(/\/login$/);
  await context.close();
});

test('1.5 Повторная регистрация на тот же телефон — ошибка 409 (другой формат номера)', async ({ browser }) => {
  const { context, page } = await openAs(browser, 'desktop');
  // +7XXXXXXXXXX и 8XXXXXXXXXX — один номер
  const samePhone = '8' + P.owner.phone.slice(2);
  await register(page, { ...P.owner, phone: samePhone, fullName: 'Дубликат' }, { name: 'Другая компания' });
  await expect(page).toHaveURL(/\/register$/);
  await expect(page.getByText(/уже существует/i)).toBeVisible();
  await context.close();
});

test('1.6 Сбой из-за переводчика браузера: вместо технической ошибки — понятный экран', async ({ browser }) => {
  const { context, page } = await openAs(browser, 'phone');
  await page.goto('/login');
  await expect(page.getByRole('button', { name: 'Войти' })).toBeVisible();

  await page.evaluate(() => {
    const walker = document.createTreeWalker(document.getElementById('root')!, NodeFilter.SHOW_TEXT);
    const nodes: Text[] = [];
    while (walker.nextNode()) if (walker.currentNode.nodeValue?.trim()) nodes.push(walker.currentNode as Text);
    for (const node of nodes) {
      const font = document.createElement('font');
      font.style.verticalAlign = 'inherit';
      font.textContent = node.nodeValue;
      node.replaceWith(font);
    }
  });
  await page.getByLabel('Телефон').fill('+79990000000');
  await page.getByLabel('Пароль').fill('whatever-123');
  await page.getByRole('button', { name: 'Войти' }).click(); // кнопка вставляет индикатор загрузки перед текстом

  await expect(page.getByRole('heading', { name: 'Что-то пошло не так' })).toBeVisible();
  await expect(page.getByText(/перевёл браузер/)).toBeVisible();
  await expect(page.getByText('Unexpected Application Error')).toHaveCount(0);
  await page.getByRole('button', { name: 'Подробности для разработчика' }).click();
  await expect(page.locator('pre')).toContainText(/insertBefore|NotFoundError/);

  await page.getByRole('button', { name: 'Перезагрузить' }).click();
  await expect(page.getByRole('heading', { name: 'Вход' })).toBeVisible();
  await context.close();
});

// 2. Пользователи

test('2.1 Владелец видит id компании на странице «Пользователи»', async () => {
  const page = owner.page;
  await page.goto('/users');
  const info = page.getByRole('alert').filter({ hasText: 'сообщите ему id компании' });
  await expect(info).toContainText(D.companyName);
  companyId = (await info.locator('b').textContent())!.trim();
  expect(companyId).toMatch(/^[0-9a-f-]{36}$/);
});

test('2.2 Регистрация с несуществующим id компании отклоняется', async () => {
  await register(worker.page, P.worker, { id: '00000000-0000-4000-8000-000000000000' });
  await expect(worker.page).toHaveURL(/\/register$/);
  await expect(worker.page.getByText(/не найдена/i)).toBeVisible();
});

test('2.3 Завхоз и сотрудники подают заявки', async ({ browser }) => {
  for (const [a, p] of [
    [issuer, P.issuer],
    [worker, P.worker],
    [worker2, P.worker2],
  ] as [Actor, Person][]) {
    await register(a.page, p, { id: companyId });
    await expect(a.page).toHaveURL(/\/login$/);
    await expect(a.page.getByText('после того, как владелец компании подтвердит')).toBeVisible();
  }
  const extra = await openAs(browser, 'phone');
  await register(extra.page, P.rejected, { id: companyId });
  await expect(extra.page).toHaveURL(/\/login$/);
  await extra.context.close();
});

test('2.4 Неподтверждённый сотрудник не может войти', async () => {
  await login(worker.page, P.worker);
  await expect(errorAlert(worker.page)).toBeVisible();
  await expect(worker.page).toHaveURL(/\/login$/);
});

test('2.5 Владельцу приходят уведомления о заявках (outbox → RabbitMQ → worker)', async () => {
  const page = owner.page;
  await expect(async () => {
    await openSettled(page, '/overview');
    await expect(page.getByText('Ожидает подтверждения').first()).toBeVisible({ timeout: 3_000 });
    await expect(page.getByText(P.worker.fullName).first()).toBeVisible({ timeout: 2_000 });
  }).toPass({ timeout: 30_000 });
});

test('2.6 Владелец принимает три заявки и отклоняет одну', async () => {
  const page = owner.page;
  await page.goto('/users');
  await expect(page.getByRole('tab', { name: 'Заявки (4)' })).toBeVisible();
  for (const p of [P.issuer, P.worker, P.worker2]) {
    await row(page, p.fullName).getByRole('button', { name: 'Принять' }).click();
    await expect(row(page, p.fullName)).toHaveCount(0);
  }
  await row(page, P.rejected.fullName).getByRole('button', { name: 'Отклонить' }).click();
  const dlg = page.getByRole('dialog', { name: 'Отклонить заявку?' });
  await dlg.getByRole('button', { name: 'Отклонить' }).click();
  await expect(page.getByRole('tab', { name: 'Заявки (0)' })).toBeVisible();
  await expect(page.getByRole('tab', { name: 'Пользователи (4)' })).toBeVisible();
  await expect(page.getByRole('tab', { name: 'Уволены (1)' })).toBeVisible();

  await page.getByRole('tab', { name: /Пользователи/ }).click();
  for (const p of [P.owner, P.issuer, P.worker, P.worker2]) await expect(row(page, p.fullName)).toBeVisible();
  // владелец не может уволить сам себя
  await expect(row(page, P.owner.fullName).getByRole('button', { name: 'Уволить' })).toHaveCount(0);
});

test('2.7 Отклонённый не может войти', async ({ browser }) => {
  const { context, page } = await openAs(browser, 'phone');
  await login(page, P.rejected);
  await expect(errorAlert(page)).toBeVisible();
  await expect(page).toHaveURL(/\/login$/);
  await context.close();
});

test('2.8 Роли: каждый входит и видит только своё', async () => {
  await loginOk(issuer.page, P.issuer);
  await loginOk(worker.page, P.worker);
  await loginOk(worker2.page, P.worker2);

  // Сотрудник: свой экран, сертификат для работы без сети
  await expect(worker.page.getByText(P.worker.fullName)).toBeVisible();
  await expect(worker.page.getByText(/QR-коды без интернета: можно до/)).toBeVisible();
  await expect(worker.page.getByText('У вас нет инструментов на руках')).toBeVisible();
  for (const url of ['/users', '/tools', '/journal']) {
    await worker.page.goto(url);
    await expect(worker.page).toHaveURL(/\/overview$/);
  }

  // Завхоз: инструменты и журнал есть, пользователей нет
  await expect(issuer.page.getByText('Выдано сегодня')).toBeVisible();
  await issuer.page.goto('/users');
  await expect(issuer.page).toHaveURL(/\/overview$/);
  await issuer.page.goto('/tools');
  await expect(issuer.page).toHaveURL(/\/tools$/);

  // Владелец не сканирует
  await owner.page.goto('/scan');
  await expect(owner.page).toHaveURL(/\/overview$/);
});

// 3. Инструменты

test('3.1 Владелец добавляет инструменты, проверка пустого названия', async () => {
  const page = owner.page;
  await page.goto('/tools');
  await page.getByRole('button', { name: 'Добавить инструмент' }).click();
  const dlg = page.getByRole('dialog', { name: 'Добавить инструмент' });
  await expect(dlg.getByRole('button', { name: 'Добавить' })).toBeDisabled();
  for (const name of [D.tool1, D.tool2]) {
    if (!(await dlg.isVisible())) await page.getByRole('button', { name: 'Добавить инструмент' }).click();
    await dlg.getByLabel('Название').fill(name);
    await dlg.getByRole('button', { name: 'Добавить' }).click();
    await expect(dlg).toBeHidden();
    await expect(row(page, name)).toContainText('На месте');
  }
});

test('3.2 Завхоз тоже добавляет инструмент (мобильный экран)', async () => {
  const page = issuer.page;
  await page.goto('/tools');
  await page.getByRole('button', { name: 'Добавить инструмент' }).click();
  const dlg = page.getByRole('dialog', { name: 'Добавить инструмент' });
  await dlg.getByLabel('Название').fill(D.tool3);
  await dlg.getByRole('button', { name: 'Добавить' }).click();
  await expect(dlg).toBeHidden();
  await expect(page.getByText(D.tool3)).toBeVisible();
});

test('3.3 Поиск и фильтры в списке инструментов', async () => {
  const page = owner.page;
  await page.goto('/tools');
  await page.getByLabel('Название').fill('Перфоратор');
  await expect(row(page, D.tool2)).toBeVisible();
  await expect(row(page, D.tool1)).toHaveCount(0);
  await page.getByLabel('Название').fill('');
  await page.getByRole('button', { name: 'На руках' }).click();
  await expect(page.getByText(D.tool1)).toHaveCount(0);
  await page.getByRole('button', { name: 'Все' }).click();
  await expect(row(page, D.tool3)).toBeVisible();
});

test('3.4 Владелец скачивает PNG-наклейки с QR', async () => {
  for (const t of [D.tool1, D.tool2]) {
    stickers[t] = await downloadSticker(t);
    expect(stickers[t].subarray(1, 4).toString()).toBe('PNG');
  }
});

// 4. Выдача и возврат по QR

let takeQr: Buffer;

test('4.1 Выдача: сотрудник сканирует наклейку, завхоз сканирует QR сотрудника', async () => {
  takeQr = await workerCreatesQr(worker, D.tool1, { action: 'Беру', condition: 'Исправен' });

  await issuerScans(takeQr);
  const dlg = issuer.page.getByRole('dialog', { name: 'Выдача инструмента' });
  await expect(dlg).toBeVisible();
  await expect(dlg).toContainText(P.worker.fullName);
  await expect(dlg).toContainText(D.tool1);
  await expect(dlg).toContainText('Исправен');
  await dlg.getByRole('button', { name: 'Подтвердить' }).click();
  await expect(issuer.page.getByText(`Выдано: ${D.tool1}`)).toBeVisible();

  await worker.page.getByRole('button', { name: 'Завхоз принял' }).click();
  await expect(worker.page).toHaveURL(/\/overview$/);
  await expect(worker.page.getByRole('button', { name: new RegExp(D.tool1) })).toBeVisible();
});

test('4.2 Повторный показ того же QR отклоняется (защита от повтора)', async () => {
  await showToCamera(issuer.page, null);
  await issuer.page.waitForTimeout(2_500); // сканер повторяет один и тот же текст не чаще раза в 2 с
  await showToCamera(issuer.page, takeQr);
  await expect(issuer.page.getByText('Этот QR уже был принят')).toBeVisible();
  await expect(issuer.page.getByRole('dialog')).toHaveCount(0);
});

test('4.3 Выдача видна на сервере: инструменты, журнал, обзор завхоза', async () => {
  await expect(async () => {
    await openSettled(owner.page, '/tools');
    await expect(row(owner.page, D.tool1)).toContainText(`На руках · ${P.worker.fullName}`, { timeout: 3_000 });
  }).toPass({ timeout: 30_000 });

  await owner.page.goto('/journal');
  const r = row(owner.page, D.tool1);
  await expect(r).toContainText('Выдача');
  await expect(r).toContainText(P.worker.fullName);
  await expect(r).toContainText('Проверено'); // сервер проверил обе подписи

  await issuer.page.goto('/overview');
  await expect(issuer.page.getByText('Отправлена').first()).toBeVisible();
});

test('4.4 Чужие QR: завхоз сканирует наклейку, сотрудник — QR другого сотрудника', async () => {
  await issuerScans(stickers[D.tool2]);
  await expect(issuer.page.getByText('Это не QR сотрудника')).toBeVisible();

  await worker2.page.goto('/scan');
  await showToCamera(worker2.page, takeQr);
  await expect(worker2.page.getByText('Это не наклейка инструмента')).toBeVisible();
});

test('4.5 Возврат с повреждением: предупреждения и смена состояния', async () => {
  const qr = await workerCreatesQr(worker, D.tool1, { action: 'Возвращаю', condition: 'Поврежден', fromHeld: true });
  await issuerScans(qr);
  const dlg = issuer.page.getByRole('dialog', { name: 'Возврат инструмента' });
  await expect(dlg).toContainText(P.worker.fullName);
  await expect(dlg).toContainText(/Поврежд[её]н/);
  await expect(dlg.getByText(/Осмотрите инструмент/)).toBeVisible();
  await dlg.getByRole('button', { name: 'Подтвердить' }).click();
  await expect(issuer.page.getByText(`Принято: ${D.tool1}`)).toBeVisible();

  await worker.page.getByRole('button', { name: 'Завхоз принял' }).click();
  await expect(worker.page.getByText('У вас нет инструментов на руках')).toBeVisible();

  await expect(async () => {
    await openSettled(owner.page, '/tools');
    const r = row(owner.page, D.tool1);
    await expect(r).toContainText('На месте', { timeout: 3_000 });
    await expect(r).toContainText(/Поврежд[её]н/, { timeout: 1_000 });
  }).toPass({ timeout: 30_000 });
  await owner.page.goto('/journal');
  await expect(row(owner.page, D.tool1).filter({ hasText: 'Возврат' })).toBeVisible();
});

test('4.6 Отклонение операции завхозом ничего не записывает', async () => {
  const qr = await workerCreatesQr(worker, D.tool2, { action: 'Беру', condition: 'Исправен' });
  await issuerScans(qr);
  const dlg = issuer.page.getByRole('dialog', { name: 'Выдача инструмента' });
  await expect(dlg).toBeVisible();

  await dlg.getByRole('button', { name: 'Отклонить' }).click();
  await issuer.page.waitForTimeout(1_500);
  const reopened = await dlg.isVisible();
  test.info().annotations.push({
    type: 'observation',
    description: reopened
      ? 'QR остался в кадре: после «Отклонить» диалог сразу открылся снова'
      : 'QR остался в кадре: после «Отклонить» диалог не открылся снова',
  });

  // Завхоз убирает камеру от телефона сотрудника и отклоняет
  await showToCamera(issuer.page, null);
  await issuer.page.waitForTimeout(500); // пустой кадр доходит до <video>
  if (!(await dlg.isVisible())) {
    await showToCamera(issuer.page, qr);
    await expect(dlg).toBeVisible();
    await showToCamera(issuer.page, null);
    await issuer.page.waitForTimeout(500);
  }
  await dlg.getByRole('button', { name: 'Отклонить' }).click();
  await expect(dlg).toBeHidden();
  await issuer.page.waitForTimeout(1_000);
  await expect(dlg).toBeHidden();
  await worker.page.getByRole('button', { name: 'Отмена' }).click();
  await owner.page.goto('/tools');
  await expect(row(owner.page, D.tool2)).toContainText('На месте');
});

test('4.7 Просроченный QR (прошло 2 минуты, завхоз без сети) отклоняется', async ({ browser }) => {
  const late = await openAs(browser, 'phone');
  await late.page.clock.install();
  await loginOk(late.page, P.issuer);
  await expect(late.page.getByText('Выдано сегодня')).toBeVisible();
  await late.page.waitForTimeout(1_500); // успевает скачать ключ сервера и реестр

  const qr = await workerCreatesQr(worker, D.tool2, { action: 'Беру', condition: 'Исправен' });
  await late.page.goto('/scan');
  await late.context.setOffline(true);
  await late.page.clock.fastForward('02:00');
  await showToCamera(late.page, qr);
  await expect(late.page.getByText(/Время в QR сильно отличается/)).toBeVisible();
  await expect(late.page.getByRole('dialog')).toHaveCount(0);
  await worker.page.getByRole('button', { name: 'Отмена' }).click();
  await late.context.close();
});

// 5. Работа без сети

let offlineQr: Buffer;

test('5.1 Без сети у обоих: сотрудник делает QR, завхоз принимает, запись ждёт отправки', async () => {
  await issuer.page.goto('/overview');
  await expect(issuer.page.getByText('Выдано сегодня')).toBeVisible();
  await worker.page.goto('/overview');
  await expect(worker.page.getByText(/QR-коды без интернета/)).toBeVisible();

  await issuer.context.setOffline(true);
  await worker.context.setOffline(true);

  offlineQr = await workerCreatesQr(worker, D.tool2, { action: 'Беру', condition: 'Исправен' });
  await issuerScans(offlineQr);
  const dlg = issuer.page.getByRole('dialog', { name: 'Выдача инструмента' });
  await expect(dlg).toContainText(P.worker.fullName);
  await dlg.getByRole('button', { name: 'Подтвердить' }).click();
  await expect(issuer.page.getByText(`Выдано: ${D.tool2}`)).toBeVisible();
  await worker.page.getByRole('button', { name: 'Завхоз принял' }).click();
  await expect(worker.page.getByRole('button', { name: new RegExp(D.tool2) })).toBeVisible();

  await issuer.page.getByRole('link', { name: 'Обзор' }).first().click();
  await expect(issuer.page.getByText('Не отправлена').first()).toBeVisible();
  await owner.page.goto('/tools');
  await expect(row(owner.page, D.tool2)).toContainText('На месте');
});

test('5.2 Сеть вернулась: журнал завхоза уходит на сервер', async () => {
  await worker.context.setOffline(false);
  await issuer.context.setOffline(false);
  const sendNow = issuer.page.getByRole('button', { name: 'Отправить сейчас' });
  if (await sendNow.isVisible().catch(() => false)) await sendNow.click().catch(() => {});
  await expect(issuer.page.getByText('Не отправлена')).toHaveCount(0, { timeout: 30_000 });

  await expect(async () => {
    await openSettled(owner.page, '/tools');
    await expect(row(owner.page, D.tool2)).toContainText(`На руках · ${P.worker.fullName}`, { timeout: 3_000 });
  }).toPass({ timeout: 30_000 });
});

// 6. Увольнение и подозрительная запись

test('6.1 Увольнение: уволенный теряет доступ', async () => {
  await worker2.page.goto('/overview');
  await expect(worker2.page.getByText(/QR-коды без интернета/)).toBeVisible();

  const page = owner.page;
  await page.goto('/users');
  await page.getByRole('tab', { name: /Пользователи/ }).click();
  await row(page, P.worker2.fullName).getByRole('button', { name: 'Уволить' }).click();
  await page.getByRole('dialog', { name: 'Уволить сотрудника?' }).getByRole('button', { name: 'Уволить' }).click();
  await page.getByRole('tab', { name: /Уволены/ }).click();
  await expect(row(page, P.worker2.fullName)).toContainText('Уволен');

  // новая попытка входа отклоняется
  const fresh = await openAs(owner.context.browser()!, 'phone');
  await login(fresh.page, P.worker2);
  await expect(errorAlert(fresh.page)).toBeVisible();
  await expect(fresh.page).toHaveURL(/\/login$/);
  await fresh.context.close();
});

test('6.2 Уволенный без сети показывает QR — завхоз принимает, сервер помечает запись подозрительной', async () => {
  await worker2.context.setOffline(true);
  const qr = await workerCreatesQr(worker2, D.tool1, { action: 'Беру', condition: 'Исправен' });
  await issuerScans(qr);
  const dlg = issuer.page.getByRole('dialog', { name: 'Выдача инструмента' });
  await expect(dlg).toContainText(P.worker2.fullName);
  await dlg.getByRole('button', { name: 'Подтвердить' }).click();
  await expect(issuer.page.getByText(`Выдано: ${D.tool1}`)).toBeVisible();

  await expect(async () => {
    await openSettled(owner.page, '/overview');
    await expect(owner.page.getByText('Подозрительная синхронизация').first()).toBeVisible({ timeout: 3_000 });
  }).toPass({ timeout: 45_000 });

  await owner.page.goto('/journal');
  const r = row(owner.page, P.worker2.fullName);
  await expect(r).toBeVisible();
  await expect(r).toContainText('Сотрудник уволен'); // флаг проверки WORKER_DEACTIVATED
});

test('6.3 Открытая сессия уволенного обрывается при выходе в сеть', async () => {
  await worker2.context.setOffline(false);
  await worker2.page.goto('/profile');
  await expect(worker2.page).toHaveURL(/\/login$/, { timeout: 20_000 });
});

// 7. Профиль, пароль, выход

test('7.1 Профиль показывает данные пользователя', async () => {
  await worker.page.goto('/profile');
  await expect(worker.page.getByText(P.worker.fullName)).toBeVisible();
  await expect(worker.page.getByLabel('Компания')).toHaveValue(D.companyName);
  await expect(worker.page.getByLabel('Телефон')).toHaveValue(/999/);
  await expect(worker.page.getByText('Сотрудник').first()).toBeVisible();
});

test('7.2 Смена пароля (через API — в интерфейсе пока нет формы): старый не работает, новый работает', async ({ request }) => {
  const base = process.env.E2E_BASE_URL ?? 'http://localhost';
  const loginRes = await request.post(`${base}/api/auth/login`, { data: { phone: P.issuer.phone, password: P.issuer.password } });
  expect(loginRes.status()).toBe(200);
  const { accessToken } = await loginRes.json();
  const newPassword = P.issuer.password + '-new';

  const same = await request.post(`${base}/api/auth/change-password`, {
    headers: { Authorization: `Bearer ${accessToken}` },
    data: { currentPassword: P.issuer.password, newPassword: P.issuer.password },
  });
  expect(same.status()).toBe(400);
  const wrong = await request.post(`${base}/api/auth/change-password`, {
    headers: { Authorization: `Bearer ${accessToken}` },
    data: { currentPassword: 'definitely-wrong', newPassword },
  });
  expect(wrong.status()).toBe(400);
  const ok = await request.post(`${base}/api/auth/change-password`, {
    headers: { Authorization: `Bearer ${accessToken}` },
    data: { currentPassword: P.issuer.password, newPassword },
  });
  expect(ok.status()).toBe(200);

  // через интерфейс: старый пароль — нет, новый — да
  const fresh = await openAs(owner.context.browser()!, 'phone');
  await login(fresh.page, P.issuer);
  await expect(errorAlert(fresh.page)).toBeVisible();
  await loginOk(fresh.page, { ...P.issuer, password: newPassword });
  await fresh.context.close();
  P.issuer.password = newPassword;
});

test('7.3 Выход: после «Выйти» назад в приложение не попасть', async () => {
  const page = worker.page;
  await page.goto('/profile');
  await page.getByRole('button', { name: 'Выйти' }).click();
  await expect(page).toHaveURL(/\/login$/);
  await page.goto('/overview');
  await expect(page).toHaveURL(/\/login$/);
  await page.reload();
  await expect(page).toHaveURL(/\/login$/);
});

test('7.4 Сессия переживает перезагрузку страницы (refresh cookie)', async () => {
  await openSettled(owner.page, '/tools'); // страница загрузилась полностью (гонку проверяет 9.1)
  await expect(row(owner.page, D.tool2)).toBeVisible();
  await owner.page.reload();
  await expect(owner.page).toHaveURL(/\/tools$/);
  await expect(row(owner.page, D.tool2)).toBeVisible();
});

// 8. Карточка инструмента

test('8.1 Владелец меняет состояние и комментарий, затем списывает инструмент', async () => {
  const page = owner.page;
  await page.goto('/tools');
  await row(page, D.tool3).getByRole('button', { name: 'Подробнее' }).click();
  await expect(page.getByText('Данные инструмента')).toBeVisible();
  await page.getByRole('combobox', { name: 'Состояние' }).click();
  await page.getByRole('option', { name: 'Сломан' }).click();
  await page.getByLabel('Комментарий').fill('Сломан при e2e-проверке');
  await page.getByRole('button', { name: 'Сохранить' }).click();
  await expect(page.getByText('Сохранено')).toBeVisible();
  await page.getByRole('button', { name: 'Списать' }).click();
  await page.getByRole('dialog', { name: 'Списать инструмент?' }).getByRole('button', { name: 'Списать' }).click();
  await page.goto('/tools');
  await expect(row(page, D.tool3)).toHaveCount(0);
});

// 9. Устойчивость сессии

test('9.1 Потерянный ответ на обновление сессии не должен разлогинивать', async ({ browser, request }) => {
  const base = process.env.E2E_BASE_URL ?? 'http://localhost';
  const { context, page } = await openAs(browser, 'desktop');
  await loginOk(page, P.owner);
  await openSettled(page, '/tools');

  const cookie = (await context.cookies()).find((c) => c.name === 'refresh_token');
  expect(cookie, 'refresh cookie в браузере').toBeTruthy();
  const lost = await request.post(`${base}/api/auth/refresh`, { headers: { Cookie: `refresh_token=${cookie!.value}` } });
  expect(lost.status()).toBe(200);

  await page.reload();
  await page.waitForLoadState('networkidle');
  test.info().annotations.push({ type: 'observation', description: `после перезагрузки открыт ${new URL(page.url()).pathname}` });
  await expect(page).toHaveURL(/\/tools$/);
  await context.close();
});
