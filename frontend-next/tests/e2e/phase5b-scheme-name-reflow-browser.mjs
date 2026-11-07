// Responsive S05 browser check with a synthetic API fixture only.
import assert from 'node:assert/strict';
import { spawn } from 'node:child_process';
import { mkdtemp, mkdir, rm, writeFile } from 'node:fs/promises';
import net from 'node:net';
import os from 'node:os';
import path from 'node:path';
import { randomBytes } from 'node:crypto';
import { setTimeout as delay } from 'node:timers/promises';

const root = process.cwd();
assert(root.endsWith(`${path.sep}frontend-next`), 'Run this script from frontend-next');
const artifactDir = path.resolve(root, '../docs/ui/evidence/phase5b/scheme-name-reflow');
const temp = await mkdtemp(path.join(os.tmpdir(), 'immuno-scheme-reflow-'));
const longName = 'Vacuna sintética de prueba '.repeat(9).trim();
const user = {
  id: 'synthetic-student',
  email: 'student@example.invalid',
  role: 'student',
  is_active: true,
  must_change_password: false,
  created_at: '2026-01-01T12:00:00Z',
  profile: null,
};
const scheme = {
  total_vaccines: 1,
  approved_vaccines: 0,
  pending_vaccines: 0,
  denied_vaccines: 0,
  in_review_vaccines: 0,
  is_up_to_date: false,
  is_complete: false,
  is_certifiable: false,
  evaluated_on: '2026-10-09',
  scheme_version: 1,
  vaccines: [{
    id: 'synthetic-student-vaccine',
    vaccine_id: 'synthetic-catalog-vaccine',
    status: 'in_review',
    admin_notes: null,
    reviewed_at: null,
    doses: [],
    vaccine: {
      id: 'synthetic-catalog-vaccine',
      name: longName,
      code: 'SYNTHETIC-LONG',
      base_doses: 1,
      has_booster: false,
      has_titer: false,
      has_titer_value: false,
      is_annual: false,
      applies_to: 'all',
      display_order: 0,
      dose_configs: [],
    },
  }],
};

let server;
let chrome;
let socket;
let appPort;
let debugPort;
let nextId = 0;
const pending = new Map();

async function freePort() {
  const probe = net.createServer();
  await new Promise((resolve, reject) => probe.once('error', reject).listen(0, '127.0.0.1', resolve));
  const { port } = probe.address();
  await new Promise(resolve => probe.close(resolve));
  return port;
}

async function waitFor(check, label, timeout = 30_000) {
  const deadline = Date.now() + timeout;
  let lastError;
  while (Date.now() < deadline) {
    try {
      const result = await check();
      if (result) return result;
    } catch (error) {
      lastError = error;
    }
    await delay(200);
  }
  throw new Error(`Timed out waiting for ${label}${lastError ? ` (${lastError.message})` : ''}`);
}

function cdp(method, params = {}) {
  return new Promise((resolve, reject) => {
    const id = ++nextId;
    pending.set(id, { resolve, reject });
    socket.send(JSON.stringify({ id, method, params }));
  });
}

async function evaluate(expression) {
  const result = await cdp('Runtime.evaluate', {
    expression,
    awaitPromise: true,
    returnByValue: true,
  });
  assert(!result.exceptionDetails, 'Browser evaluation failed');
  return result.result.value;
}

async function fulfillApi(requestId, url) {
  const pathname = new URL(url).pathname;
  let status = 404;
  let payload = { code: 'NOT_FOUND', message: 'No se encontró el recurso solicitado.', details: null };
  if (pathname === '/api/users/me') {
    status = 200;
    payload = user;
  } else if (pathname === '/api/scheme/' || pathname === '/api/scheme') {
    status = 200;
    payload = scheme;
  } else if (pathname === '/api/notifications/' || pathname === '/api/notifications') {
    status = 200;
    payload = [];
  }
  await cdp('Fetch.fulfillRequest', {
    requestId,
    responseCode: status,
    responseHeaders: [
      { name: 'Content-Type', value: 'application/json; charset=utf-8' },
      { name: 'Cache-Control', value: 'no-store' },
    ],
    body: Buffer.from(JSON.stringify(payload)).toString('base64'),
  });
}

async function measure(width, scenario) {
  await cdp('Emulation.setDeviceMetricsOverride', {
    width,
    height: 900,
    deviceScaleFactor: 1,
    mobile: width < 600,
  });
  await evaluate('window.dispatchEvent(new Event("resize"))');
  const result = await evaluate(`(()=>{
    const main=document.querySelector('main');
    const title=[...main.querySelectorAll('button p')].find(node=>node.textContent.trim()===${JSON.stringify(longName)});
    if(!title)throw new Error('Full vaccine title not rendered');
    const style=getComputedStyle(title),rect=title.getBoundingClientRect();
    return {
      viewport:window.innerWidth,
      documentWidth:document.documentElement.scrollWidth,
      titleWidth:rect.width,
      titleHeight:rect.height,
      clientWidth:title.clientWidth,
      scrollWidth:title.scrollWidth,
      textOverflow:style.textOverflow,
      whiteSpace:style.whiteSpace,
      overflowWrap:style.overflowWrap,
      visible:rect.width>0&&rect.height>0,
    };
  })()`);
  assert(result.visible, `Vaccine title is not visible at ${width}px`);
  assert.equal(result.textOverflow, 'clip', `Vaccine title uses ellipsis at ${width}px`);
  assert.notEqual(result.whiteSpace, 'nowrap', `Vaccine title is forced onto one line at ${width}px`);
  assert.equal(result.overflowWrap, 'break-word', `Vaccine title cannot wrap at ${width}px`);
  assert(result.scrollWidth <= result.clientWidth + 1, `Vaccine title overflows its box at ${width}px`);
  assert(result.documentWidth <= result.viewport, `Page overflows horizontally at ${width}px`);
  return { scenario, ...result, synthetic_text_length: longName.length };
}

async function connectBrowser() {
  const pages = await (await fetch(`http://127.0.0.1:${debugPort}/json/list`)).json();
  const page = pages.find(target => target.type === 'page');
  assert(page?.webSocketDebuggerUrl, 'Chrome page target is unavailable');
  socket = new WebSocket(page.webSocketDebuggerUrl);
  await new Promise((resolve, reject) => {
    socket.addEventListener('open', resolve, { once: true });
    socket.addEventListener('error', reject, { once: true });
  });
  socket.addEventListener('message', event => {
    const message = JSON.parse(event.data);
    if (message.method === 'Fetch.requestPaused') {
      void fulfillApi(message.params.requestId, message.params.request.url).catch(async () => {
        await cdp('Fetch.failRequest', { requestId: message.params.requestId, errorReason: 'Failed' }).catch(() => undefined);
      });
      return;
    }
    const call = pending.get(message.id);
    if (!call) return;
    pending.delete(message.id);
    if (message.error) call.reject(new Error(message.error.message));
    else call.resolve(message.result);
  });
}

try {
  appPort = await freePort();
  debugPort = await freePort();
  const origin = `http://127.0.0.1:${appPort}`;
  const safeEnv = {
    PATH: process.env.PATH,
    HOME: temp,
    NODE_ENV: 'production',
    NEXT_TELEMETRY_DISABLED: '1',
    API_INTERNAL_URL: 'http://127.0.0.1:1',
    BFF_ORIGIN: origin,
    BFF_DATABASE_URL: 'postgresql://127.0.0.1:1/synthetic_unused',
    BFF_SESSION_KEY: randomBytes(32).toString('base64'),
  };
  server = spawn(process.execPath, ['node_modules/next/dist/bin/next', 'start', '--hostname', '127.0.0.1', '--port', String(appPort)], {
    cwd: root,
    env: safeEnv,
    stdio: 'ignore',
  });
  await waitFor(async () => {
    if (server.exitCode !== null) throw new Error('Next production server exited');
    return fetch(`${origin}/login`).then(response => response.ok);
  }, 'Next production server');

  chrome = spawn('/usr/bin/google-chrome', [
    '--headless=new', '--no-sandbox', '--disable-dev-shm-usage', '--no-first-run',
    '--no-default-browser-check', `--remote-debugging-port=${debugPort}`,
    `--user-data-dir=${path.join(temp, 'chrome')}`, 'about:blank',
  ], { env: { PATH: process.env.PATH, HOME: temp }, stdio: 'ignore' });
  await waitFor(async () => {
    if (chrome.exitCode !== null) throw new Error('Chrome exited');
    return fetch(`http://127.0.0.1:${debugPort}/json/list`).then(response => response.ok);
  }, 'Chrome DevTools');
  await connectBrowser();
  await cdp('Page.enable');
  await cdp('Runtime.enable');
  await cdp('Fetch.enable', { patterns: [{ urlPattern: `${origin}/api/*`, requestStage: 'Request' }] });
  await cdp('Emulation.setDeviceMetricsOverride', { width: 320, height: 900, deviceScaleFactor: 1, mobile: true });
  await cdp('Page.navigate', { url: `${origin}/student/scheme` });
  await waitFor(async () => evaluate(`Boolean(document.querySelector('main h1')?.textContent.includes('Mi esquema')&&[...document.querySelectorAll('main button p')].some(node=>node.textContent.trim()===${JSON.stringify(longName)}))`), 'student scheme with synthetic vaccine');

  const measurements = [
    await measure(320, 'mobile-320-css-px'),
    await measure(768, 'tablet-768-css-px'),
    await measure(1440, 'desktop-1440-css-px'),
    await measure(720, '200-percent-reflow-equivalent-720-css-px'),
  ];
  await mkdir(artifactDir, { recursive: true });
  await writeFile(path.join(artifactDir, 'measurements.json'), JSON.stringify({ synthetic_data_only: true, production_ready: false, measurements }, null, 2) + '\n');
  console.log('PASS: long synthetic vaccine name wraps at 320/768/1440px and 200%-equivalent 720px with no horizontal overflow');
} finally {
  socket?.close();
  for (const child of [chrome, server]) {
    if (!child || child.exitCode !== null) continue;
    child.kill('SIGTERM');
    await Promise.race([new Promise(resolve => child.once('exit', resolve)), delay(3000)]);
    if (child.exitCode === null) child.kill('SIGKILL');
  }
  await rm(temp, { recursive: true, force: true });
}
