import { defineConfig, devices } from '@playwright/test';

/**
 * E2E-тесты AccountThis. Идут против ЛОКАЛЬНОГО стека из docker-compose.yml (http://localhost),
 * продакшен не трогают. Перед запуском: `docker compose up -d --build` в корне репозитория.
 * Адрес можно поменять: E2E_BASE_URL=http://localhost:5173 npx playwright test
 */
export default defineConfig({
  testDir: './tests',
  // Сценарии идут по порядку и делят одну компанию: Owner -> заявки -> выдача -> возврат...
  fullyParallel: false,
  workers: 1,
  retries: 0,
  timeout: 90_000,
  expect: { timeout: 15_000 },
  reporter: [
    ['list'],
    ['html', { open: 'never', outputFolder: 'playwright-report' }],
    ['json', { outputFile: 'test-results/results.json' }],
  ],
  use: {
    baseURL: process.env.E2E_BASE_URL ?? 'http://localhost',
    locale: 'ru-RU',
    timezoneId: 'Asia/Yekaterinburg',
    trace: 'retain-on-failure',
    screenshot: 'only-on-failure',
    video: 'retain-on-failure',
    acceptDownloads: true,
  },
  projects: [{ name: 'chromium', use: { ...devices['Desktop Chrome'] } }],
});
