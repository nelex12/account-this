// Нагрузочный тест прода (k6). Только открытые без входа запросы: тестовые пользователи есть лишь на локальной копии.
// Запуск (из корня репозитория):
//   docker run --rm -v "%cd%/loadtest:/scripts" -e RUN=run2 grafana/k6:1.3.0 run --out csv=/scripts/results/run2/raw.csv.gz /scripts/load.js
// SMOKE=1 — короткая проверка одним пользователем вместо полного профиля.
import http from 'k6/http';
import { check, sleep, group } from 'k6';

const BASE = __ENV.BASE_URL || 'https://stackalg.tech';

// Профиль: ступени по 20, 50 и 100 одновременных пользователей
const stages = __ENV.SMOKE
  ? [{ duration: '30s', target: 1 }]
  : [
      { duration: '30s', target: 20 },
      { duration: '2m', target: 20 },
      { duration: '30s', target: 50 },
      { duration: '1m', target: 50 },
      { duration: '30s', target: 100 },
      { duration: '1m', target: 100 },
      { duration: '30s', target: 0 },
    ];

export const options = {
  scenarios: { users: { executor: 'ramping-vus', startVUs: 1, stages, gracefulRampDown: '10s' } },
  thresholds: {
    http_req_failed: [{ threshold: 'rate<0.01', abortOnFail: true, delayAbortEval: '30s' }],
    http_req_duration: ['p(95)<500', 'p(99)<1000'],
    'http_req_duration{name:server-key}': ['p(95)<300'],
    checks: ['rate>0.99'],
  },
  summaryTrendStats: ['avg', 'min', 'med', 'p(90)', 'p(95)', 'p(99)', 'max'],
};

// Сам k6 сжатие не запрашивает и качал бы JS-бандл несжатым (850 КБ вместо ~275 КБ); браузер всегда шлёт этот заголовок
const params = (name, extra = {}) => ({ headers: { 'Accept-Encoding': 'gzip, deflate, br, zstd' }, tags: { name }, ...extra });

// Имена бандлов меняются при каждой сборке, поэтому берём их из index.html
function assets(html) {
  return [...html.matchAll(/(?:src|href)="(\/assets\/[^"]+)"/g)].map((m) => m[1]);
}

export default function () {
  group('page', () => {
    const res = http.get(`${BASE}/`, params('index'));
    check(res, { 'index 200': (r) => r.status === 200 });
    for (const a of assets(res.body || '')) {
      // Браузер с кэшем перекачивает только мелкий CSS; JS-бандл (~275 КБ) качает каждый десятый — «новый» посетитель
      if (a.endsWith('.js') && Math.random() > 0.1) continue;
      const r = http.get(`${BASE}${a}`, params(a.endsWith('.js') ? 'asset-js' : 'asset-css'));
      check(r, { 'asset 200': (x) => x.status === 200 });
    }
  });

  group('api', () => {
    const key = http.get(`${BASE}/api/auth/server-key`, params('server-key'));
    check(key, { 'server-key 200': (r) => r.status === 200 && r.json('serverPublicKey') !== undefined });
    // Защищённый эндпоинт без токена: проверяет, что backend под нагрузкой быстро отвечает 401, а не 5xx
    const tools = http.get(`${BASE}/api/tools`, params('tools-unauth', { responseCallback: http.expectedStatuses(401) }));
    check(tools, { 'tools 401': (r) => r.status === 401 });
  });

  sleep(1 + Math.random()); // «думает» 1–2 с между действиями
}

export function handleSummary(data) {
  return { [`/scripts/results/${__ENV.RUN || 'run'}/summary.json`]: JSON.stringify(data, null, 2) };
}
