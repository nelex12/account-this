# AccountThis: контекст для ИИ-помощника фронтенда

Ты помогаешь писать фронтенд на React + TypeScript. Бэкенд готов и работает как чёрный ящик по описанию ниже.
Не придумывай эндпоинты, поля и коды ответов, которых здесь нет. Полный контракт — в `api.yaml` в корне репозитория.

## Проект

Система учёта и выдачи инструментов внутри компаний. Компании полностью изолированы друг от друга.
Роли: `Owner` (владелец компании), `Issuer` (завхоз, выдаёт инструменты), `Worker` (сотрудник, берёт инструменты).

## Запуск и запросы

- Запуск: `dev-frontend.bat`, фронт открывается на http://localhost:5173.
- Запросы — относительными путями: `fetch('/api/...')`. Отдельный адрес бэкенда не нужен.
- Открывать по `localhost`, а не по IP: иначе не будет работать продление сессии.
- Тела запросов и ответов — JSON, поля в camelCase. id — UUID-строки. Время — Unix time в секундах.
- Телефон принимается в любом виде (`+7 (999) 123-45-67`, `89991234567`), сервер возвращает его как `+7XXXXXXXXXX`.

## Ошибки

Ответ с ошибкой имеет `Content-Type: application/problem+json`:
```ts
interface ProblemDetails {
  status: number;
  title: string;
  detail?: string;                    // текст для пользователя
  errors?: Record<string, string[]>;  // только в 400: ключ — имя поля из запроса
}
```
401 и 403 на защищённых эндпоинтах приходят без тела.

## Сессия

- `POST /api/auth/login` возвращает `accessToken` (JWT на 15 минут). Хранить только в памяти, не в localStorage.
- Вместе с ним сервер ставит HttpOnly-cookie для продления. JS её не видит и не трогает, браузер отправляет её сам.
- Защищённые запросы: заголовок `Authorization: Bearer <accessToken>`.
- 401 на любой запрос: вызвать `POST /api/auth/refresh` и повторить запрос один раз. Если refresh вернул 401 — на экран входа.
- При загрузке приложения вызвать refresh: так сессия восстанавливается после перезагрузки страницы.
- **refresh нельзя вызывать параллельно** (в том числе из разных вкладок). Сервер сочтёт это кражей и завершит сессию.
  Поэтому все вызовы идут через одну функцию с общим промисом и `navigator.locks` (код ниже).
- Payload JWT: `sub` (id пользователя), `role`, `company_id`, `exp`. Роль из токена — только для отображения интерфейса,
  права проверяет сервер.

## Готовые эндпоинты

### POST /api/auth/register — без токена
Owner создаёт компанию и подтверждён сразу. Worker и Issuer присоединяются по `companyId` и ждут подтверждения Owner.
```json
{ "fullName": "Петров Пётр", "phone": "+7 (999) 123-45-67", "password": "pass123", "role": "Owner", "companyName": "ООО Ромашка" }
{ "fullName": "Иванов Иван", "phone": "89991234567", "password": "pass123", "role": "Worker", "companyId": "<uuid>" }
```
`fullName` и `companyName` — до 100 символов. Owner не передаёт `companyId`, Worker и Issuer не передают `companyName`.
- 201 — без тела, токенов не выдаёт (дальше вход).
- 400 — `errors` по полям (в том числе `companyId`, если компании нет).
- 409 — телефон занят.

### POST /api/auth/login — без токена
`{ "phone": "...", "password": "..." }`
- 200 — `{ "accessToken": "eyJ...", "expiresIn": 900 }` + cookie.
- 401 — неверный телефон или пароль.
- 403 — не подтверждён владельцем или уволен (текст в `detail`).

### POST /api/auth/refresh — без токена и без тела
- 200 — как у login.
- 401 — сессии нет, нужен вход.

### POST /api/auth/logout — без токена и без тела
- 204 всегда. После него забыть accessToken.

### GET /api/companies/my — любая роль
- 200 — `{ "id": "<uuid>", "name": "ООО Ромашка" }`. Этот id Owner сообщает сотрудникам для регистрации.

### GET /api/users — только Owner
- 200 — пользователи своей компании, включая неподтверждённых и уволенных:
```json
[{ "id": "<uuid>", "fullName": "Иванов Иван", "phone": "+79991234567", "role": "Worker", "isApproved": false, "isActive": true }]
```
`isApproved: false` — ждёт подтверждения, `isActive: false` — уволен.

### POST /api/users/{id}/approve — только Owner, без тела
- 200 — подтверждён (повторно — тоже 200).
- 404 — нет такого пользователя в компании.

## Ещё не готово (контракт есть в api.yaml, сервер пока отвечает ошибкой)

`DELETE /api/users/{id}` (увольнение), `GET /api/auth/worker-cert`, `/api/tools*`, `/api/sync`, `/api/logs`.

## Готовый модуль сессии

```ts
let accessToken: string | null = null;
let refreshing: Promise<boolean> | null = null;

export async function login(phone: string, password: string) {
  const res = await fetch('/api/auth/login', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ phone, password }),
  });
  if (!res.ok) throw await res.json();
  accessToken = (await res.json()).accessToken;
}

// Один refresh на все вкладки: общий промис внутри вкладки и блокировка между вкладками
export function refresh(): Promise<boolean> {
  refreshing ??= navigator.locks
    .request('auth-refresh', async () => {
      const res = await fetch('/api/auth/refresh', { method: 'POST' });
      accessToken = res.ok ? (await res.json()).accessToken : null;
      return res.ok;
    })
    .finally(() => { refreshing = null; });
  return refreshing;
}

// Все запросы к API — через эту функцию
export async function apiFetch(url: string, init: RequestInit = {}) {
  const send = () => {
    const headers = new Headers(init.headers);
    if (accessToken) headers.set('Authorization', 'Bearer ' + accessToken);
    return fetch(url, { ...init, headers });
  };
  let res = await send();
  if (res.status === 401 && (await refresh())) res = await send();
  return res; // всё ещё 401 — на экран входа
}

export async function logout() {
  await fetch('/api/auth/logout', { method: 'POST' });
  accessToken = null;
}

export function currentRole(): 'Owner' | 'Issuer' | 'Worker' | null {
  if (!accessToken) return null;
  const payload = JSON.parse(atob(accessToken.split('.')[1].replace(/-/g, '+').replace(/_/g, '/')));
  return payload.role;
}
```
