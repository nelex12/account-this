#!/usr/bin/env node
/* =====================================================================
   Экспорт досок с макетами в PNG (design/screens/*.png).

     node design/source/export.mjs              — все доски
     node design/source/export.mjs flow login   — только перечисленные (id или имя файла)
     SCALE=2 node design/source/export.mjs      — в двойной плотности

   Нужны Node.js 22+ (встроенный WebSocket) и Chrome или Edge.
   Путь к браузеру можно задать переменной CHROME.
   Шрифты грузятся с Google Fonts — без интернета PNG получатся с системными шрифтами.
   ===================================================================== */
import { spawn } from 'node:child_process';
import { existsSync, mkdirSync, mkdtempSync, rmSync, writeFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { dirname, join, resolve } from 'node:path';
import { fileURLToPath, pathToFileURL } from 'node:url';

const here = dirname(fileURLToPath(import.meta.url));
const outDir = resolve(here, '..', 'screens');
const pageUrl = pathToFileURL(join(here, 'index.html')).href;
const scale = Number(process.env.SCALE || 1);

const chromePath = [
  process.env.CHROME,
  'C:/Program Files/Google/Chrome/Application/chrome.exe',
  'C:/Program Files (x86)/Google/Chrome/Application/chrome.exe',
  'C:/Program Files (x86)/Microsoft/Edge/Application/msedge.exe',
  'C:/Program Files/Microsoft/Edge/Application/msedge.exe',
  '/Applications/Google Chrome.app/Contents/MacOS/Google Chrome',
  '/usr/bin/google-chrome',
  '/usr/bin/chromium',
].find((p) => p && existsSync(p));
if (!chromePath) {
  console.error('Не найден Chrome или Edge. Укажите путь в переменной CHROME.');
  process.exit(1);
}

const sleep = (ms) => new Promise((r) => setTimeout(r, ms));
const port = 9300 + Math.floor(Math.random() * 600);
const profile = mkdtempSync(join(tmpdir(), 'accountthis-export-'));
const chrome = spawn(chromePath, [
  '--headless=new', `--remote-debugging-port=${port}`, `--user-data-dir=${profile}`,
  '--hide-scrollbars', '--no-first-run', '--no-default-browser-check',
  '--force-color-profile=srgb', '--allow-file-access-from-files', 'about:blank',
], { stdio: 'ignore' });

async function json(url) {
  for (let k = 0; k < 100; k++) {
    try { const r = await fetch(url); if (r.ok) return await r.json(); } catch { /* ещё запускается */ }
    await sleep(100);
  }
  throw new Error('Браузер не отвечает на порту ' + port);
}

let ws;
try {
  const target = (await json(`http://127.0.0.1:${port}/json/list`)).find((t) => t.type === 'page');
  ws = new WebSocket(target.webSocketDebuggerUrl);
  await new Promise((r, j) => { ws.addEventListener('open', r, { once: true }); ws.addEventListener('error', j, { once: true }); });

  let seq = 0;
  const waiting = new Map();
  const handlers = new Set();
  ws.addEventListener('message', (e) => {
    const m = JSON.parse(e.data);
    if (m.id && waiting.has(m.id)) {
      const { ok, fail } = waiting.get(m.id);
      waiting.delete(m.id);
      m.error ? fail(new Error(m.error.message)) : ok(m.result);
    } else if (m.method) handlers.forEach((h) => h(m));
  });
  const send = (method, params = {}) => new Promise((ok, fail) => {
    const id = ++seq;
    waiting.set(id, { ok, fail });
    ws.send(JSON.stringify({ id, method, params }));
  });
  const next = (method) => new Promise((r) => {
    const h = (m) => { if (m.method === method) { handlers.delete(h); r(m.params); } };
    handlers.add(h);
  });
  const errors = [];
  handlers.add((m) => {
    if (m.method === 'Runtime.exceptionThrown') errors.push(m.params.exceptionDetails.exception?.description || m.params.exceptionDetails.text);
    if (m.method === 'Runtime.consoleAPICalled' && m.params.type === 'error') errors.push(m.params.args.map((a) => a.value ?? a.description).join(' '));
  });
  const evaluate = async (expression) => {
    const r = await send('Runtime.evaluate', { expression, awaitPromise: true, returnByValue: true });
    if (r.exceptionDetails) throw new Error(r.exceptionDetails.exception?.description || r.exceptionDetails.text);
    return r.result.value;
  };
  const open = async (url) => {
    const loaded = next('Page.loadEventFired');
    await send('Page.navigate', { url });
    await loaded;
  };

  await send('Page.enable');
  await send('Runtime.enable');
  await send('Emulation.setDeviceMetricsOverride', { width: 1600, height: 1000, deviceScaleFactor: scale, mobile: false });

  await open(pageUrl + '?list');
  let boards = await evaluate('window.AT_BOARDS.map((b) => ({ id: b.id, file: b.file }))');
  const only = process.argv.slice(2);
  if (only.length) boards = boards.filter((b) => only.includes(b.id) || only.includes(b.file));
  mkdirSync(outDir, { recursive: true });

  for (const b of boards) {
    const started = Date.now();
    await open(`${pageUrl}?board=${encodeURIComponent(b.id)}`);
    const tLoad = Date.now();
    const size = await evaluate(`document.fonts.ready
      .then(() => new Promise((r) => requestAnimationFrame(() => requestAnimationFrame(r))))
      .then(() => {
        const rc = document.querySelector('.sheet-board').getBoundingClientRect();
        const want = ['600 16px "Unbounded"', '400 16px "Golos Text"', '500 16px "JetBrains Mono"'];
        return Promise.all(want.map((f) => document.fonts.load(f).catch(() => null)))
          .then(() => ({ w: Math.ceil(rc.width), h: Math.ceil(rc.height), missing: want.filter((f) => !document.fonts.check(f)) }));
      })`);
    const tReady = Date.now();
    if (size.missing.length) console.warn(`  ! ${b.file}: не загрузились шрифты ${size.missing.join(', ')} — нет интернета?`);
    await send('Emulation.setDeviceMetricsOverride', { width: size.w, height: size.h, deviceScaleFactor: scale, mobile: false });
    await sleep(200);
    const shot = await send('Page.captureScreenshot', { format: 'png', clip: { x: 0, y: 0, width: size.w, height: size.h, scale: 1 }, captureBeyondViewport: true });
    writeFileSync(join(outDir, b.file + '.png'), Buffer.from(shot.data, 'base64'));
    console.log(`✓ ${b.file}.png  ${size.w}×${size.h}  ${((Date.now() - started) / 1000).toFixed(1)} с` + (process.env.DEBUG ? `  (загрузка ${tLoad - started} мс, шрифты ${tReady - tLoad} мс, снимок ${Date.now() - tReady} мс)` : ''));
  }
  if (errors.length) {
    console.error('\nОшибки на странице:\n' + [...new Set(errors)].join('\n'));
    process.exitCode = 1;
  }
} finally {
  try { ws?.close(); } catch { /* уже закрыт */ }
  chrome.kill();
  await sleep(300);
  try { rmSync(profile, { recursive: true, force: true }); } catch { /* браузер ещё держит файлы */ }
}
