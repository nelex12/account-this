import { randomBytes } from 'node:crypto';
import { mkdirSync, writeFileSync } from 'node:fs';
import path from 'node:path';
import { expect, type Browser, type BrowserContext, type Page } from '@playwright/test';
import { installFakeCamera } from './fakeCamera';

export type Role = 'Owner' | 'Issuer' | 'Worker';

export interface Person {
  key: string;
  role: Role;
  fullName: string;
  phone: string;
  password: string;
}

export function makeRunData() {
  const run = Date.now().toString().slice(-6);
  const pwd = () => `E2e-${randomBytes(6).toString('base64url')}`;
  const phone = (n: number) => `+7999${run}${n}`.slice(0, 12);
  const people = {
    owner: { key: 'owner', role: 'Owner', fullName: `Владелец E2E ${run}`, phone: phone(1), password: pwd() },
    issuer: { key: 'issuer', role: 'Issuer', fullName: `Завхоз E2E ${run}`, phone: phone(2), password: pwd() },
    worker: { key: 'worker', role: 'Worker', fullName: `Иванов Работник ${run}`, phone: phone(3), password: pwd() },
    worker2: { key: 'worker2', role: 'Worker', fullName: `Петров Работник ${run}`, phone: phone(4), password: pwd() },
    rejected: { key: 'rejected', role: 'Worker', fullName: `Отказов Кандидат ${run}`, phone: phone(5), password: pwd() },
  } satisfies Record<string, Person>;
  const data = {
    run,
    companyName: `ООО E2E ${run}`,
    tool1: `Дрель E2E ${run}`,
    tool2: `Перфоратор E2E ${run}`,
    tool3: `Болгарка E2E ${run}`,
    people,
  };
  const dir = path.join(import.meta.dirname, '..', '.run');
  mkdirSync(dir, { recursive: true });
  writeFileSync(path.join(dir, 'last-run.json'), JSON.stringify(data, null, 2));
  return data;
}

export const DESKTOP = { viewport: { width: 1440, height: 900 } };
export const PHONE = {
  viewport: { width: 412, height: 915 },
  deviceScaleFactor: 2.6,
  isMobile: true,
  hasTouch: true,
};

export async function openAs(browser: Browser, kind: 'desktop' | 'phone'): Promise<{ context: BrowserContext; page: Page }> {
  const context = await browser.newContext({
    ...(kind === 'desktop' ? DESKTOP : PHONE),
    baseURL: process.env.E2E_BASE_URL ?? 'http://localhost',
    locale: 'ru-RU',
    timezoneId: 'Asia/Yekaterinburg',
    acceptDownloads: true,
    permissions: ['camera'],
  });
  await installFakeCamera(context);
  const page = await context.newPage();
  return { context, page };
}

export async function register(page: Page, p: Person, company: { name?: string; id?: string }) {
  await page.goto('/register');
  await page.getByLabel('ФИО').fill(p.fullName);
  await page.getByLabel('Телефон').fill(p.phone);
  await page.getByLabel('Пароль', { exact: true }).fill(p.password);
  await page.getByLabel('Повторите пароль').fill(p.password);
  const roleLabel = { Owner: 'Владелец', Issuer: 'Заведующий', Worker: 'Сотрудник' }[p.role];
  await page.getByRole('radio', { name: new RegExp(`^${roleLabel}`) }).check();
  if (p.role === 'Owner') await page.getByLabel('Название компании').fill(company.name!);
  else await page.getByLabel('ID компании').fill(company.id!);
  await page.getByRole('button', { name: 'Отправить заявку' }).click();
}

export async function login(page: Page, p: Pick<Person, 'phone' | 'password'>) {
  await page.goto('/login');
  await page.getByLabel('Телефон').fill(p.phone);
  await page.getByLabel('Пароль').fill(p.password);
  await page.getByRole('button', { name: 'Войти' }).click();
}

export async function loginOk(page: Page, p: Person) {
  await login(page, p);
  await expect(page).toHaveURL(/\/overview$/);
}

export function row(page: Page, text: string | RegExp) {
  return page.getByRole('row').filter({ hasText: text });
}

export function errorAlert(page: Page) {
  return page.locator('[role="alert"].MuiAlert-colorError');
}

export async function openSettled(page: Page, url: string) {
  await page.goto(url);
  await page.waitForLoadState('networkidle');
}
