// Browser reflow check for the admin student mobile card using synthetic data only.
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
const artifactDir = path.resolve(root, '../docs/ui/evidence/phase5b/admin-student-list-reflow');
const temp = await mkdtemp(path.join(os.tmpdir(), 'immuno-admin-student-reflow-'));
const firstName = 'Nombre sintetico de prueba para verificar el reflujo en movil '.repeat(2).trim();
const lastName = 'Apellido extendido de control';
const email = 'student-with-a-deliberately-long-synthetic-address-for-mobile-layout@example.invalid';
const user = {
  id: 'synthetic-admin', email: 'admin@example.invalid', role: 'admin', is_active: true,
  must_change_password: false, created_at: '2026-01-01T12:00:00Z', profile: null,
};
const students = {
  page: 1, page_size: 20, total: 1, total_pages: 1, has_next: false, has_previous: false,
  items: [{
    id: 'synthetic-student', email, role: 'student', is_active: true,
    must_change_password: false, created_at: '2026-01-01T12:00:00Z',
    profile: {
      id: 'synthetic-student-profile', first_name: firstName, last_name: lastName,
      sex: 'female', program: 'Programa sintético', campus: 'Campus de prueba', semester: 1,
    },
    vaccination_status: 'in_review',
  }],
};

let server, chrome, socket, appPort, debugPort, callId = 0;
const intercepted = [];
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
  while (Date.now() < deadline) {
    try { const value = await check(); if (value) return value; } catch { /* retry while services start */ }
    await delay(200);
  }
  throw new Error(`Timed out waiting for ${label}`);
}
function cdp(method, params = {}) {
  return new Promise((resolve, reject) => {
    const id = ++callId;
    pending.set(id, { resolve, reject });
    socket.send(JSON.stringify({ id, method, params }));
  });
}
async function evaluate(expression) {
  const response = await cdp('Runtime.evaluate', { expression, awaitPromise: true, returnByValue: true });
  assert(!response.exceptionDetails, 'Browser evaluation failed');
  return response.result.value;
}
async function fulfill(requestId, url) {
  const pathname = new URL(url).pathname;
  intercepted.push(pathname);
  let status = 404;
  let payload = { code: 'NOT_FOUND', message: 'No se encontró el recurso solicitado.', details: null };
  if (pathname === '/api/users/me') { status = 200; payload = user; }
  else if (pathname === '/api/auth/csrf') { status = 200; payload = { token: 'synthetic-csrf-token' }; }
  else if (pathname === '/api/admin/students/search') { status = 200; payload = students; }
  else if (pathname === '/api/notifications/') { status = 200; payload = []; }
  await cdp('Fetch.fulfillRequest', {
    requestId, responseCode: status,
    responseHeaders: [
      { name: 'Content-Type', value: 'application/json; charset=utf-8' },
      { name: 'Cache-Control', value: 'no-store' },
    ],
    body: Buffer.from(JSON.stringify(payload)).toString('base64'),
  });
}
async function connectBrowser() {
  const targets = await (await fetch(`http://127.0.0.1:${debugPort}/json/list`)).json();
  const page = targets.find(target => target.type === 'page');
  assert(page?.webSocketDebuggerUrl, 'Chrome page target is unavailable');
  socket = new WebSocket(page.webSocketDebuggerUrl);
  await new Promise((resolve, reject) => {
    socket.addEventListener('open', resolve, { once: true });
    socket.addEventListener('error', reject, { once: true });
  });
  socket.addEventListener('message', event => {
    const message = JSON.parse(event.data);
    if (message.method === 'Fetch.requestPaused') {
      void fulfill(message.params.requestId, message.params.request.url).catch(async () => {
        await cdp('Fetch.failRequest', { requestId: message.params.requestId, errorReason: 'Failed' }).catch(() => undefined);
      });
      return;
    }
    const call = pending.get(message.id);
    if (!call) return;
    pending.delete(message.id);
    if (message.error) call.reject(new Error(message.error.message)); else call.resolve(message.result);
  });
}
async function measure(width, scenario) {
  await cdp('Emulation.setDeviceMetricsOverride', { width, height: 900, deviceScaleFactor: 1, mobile: width < 768 });
  await evaluate('window.dispatchEvent(new Event("resize"))');
  const result = await evaluate(`(()=>{
    const main=document.querySelector('main');
    const name=[...main.querySelectorAll('p')].find(node=>node.textContent.trim()===${JSON.stringify(`${firstName} ${lastName}`)});
    const email=[...main.querySelectorAll('p')].find(node=>node.textContent.trim()===${JSON.stringify(email)});
    if(!name||!email)throw new Error('Full synthetic name or email not rendered');
    const info=node=>{const style=getComputedStyle(node),rect=node.getBoundingClientRect();return {
      visible:rect.width>0&&rect.height>0,width:rect.width,height:rect.height,lineHeight:parseFloat(style.lineHeight),
      whiteSpace:style.whiteSpace,textOverflow:style.textOverflow,overflowWrap:style.overflowWrap,
      clientWidth:node.clientWidth,scrollWidth:node.scrollWidth,
    }};
    return {viewport:window.innerWidth,documentWidth:document.documentElement.scrollWidth,name:info(name),email:info(email)};
  })()`);
  assert(result.name.visible && result.email.visible, `Name/email not visible at ${width}px`);
  assert.notEqual(result.name.whiteSpace, 'nowrap', `Name forced to one line at ${width}px`);
  assert.notEqual(result.email.whiteSpace, 'nowrap', `Email forced to one line at ${width}px`);
  assert.notEqual(result.name.textOverflow, 'ellipsis', `Name truncated at ${width}px`);
  assert.notEqual(result.email.textOverflow, 'ellipsis', `Email truncated at ${width}px`);
  assert(result.name.height > result.name.lineHeight, `Name did not wrap at ${width}px`);
  if (width <= 640) assert(result.email.height > result.email.lineHeight, `Email did not wrap at ${width}px`);
  assert(result.name.scrollWidth <= result.name.clientWidth + 1, `Name overflows its box at ${width}px`);
  assert(result.email.scrollWidth <= result.email.clientWidth + 1, `Email overflows its box at ${width}px`);
  assert(result.documentWidth <= result.viewport, `Horizontal overflow at ${width}px`);
  return { scenario, ...result };
}

try {
  appPort = await freePort();
  debugPort = await freePort();
  const origin = `http://127.0.0.1:${appPort}`;
  const safeEnv = {
    PATH: process.env.PATH, HOME: temp, NODE_ENV: 'production', NEXT_TELEMETRY_DISABLED: '1',
    API_INTERNAL_URL: 'http://127.0.0.1:1', BFF_ORIGIN: origin,
    BFF_DATABASE_URL: 'postgresql://127.0.0.1:1/synthetic_unused',
    BFF_SESSION_KEY: randomBytes(32).toString('base64'),
  };
  server = spawn(process.execPath, ['node_modules/next/dist/bin/next', 'start', '--hostname', '127.0.0.1', '--port', String(appPort)], { cwd: root, env: safeEnv, stdio: 'ignore' });
  await waitFor(async () => server.exitCode !== null ? false : fetch(`${origin}/login`).then(response => response.ok), 'Next production server');
  chrome = spawn('/usr/bin/google-chrome', [
    '--headless=new', '--no-sandbox', '--disable-dev-shm-usage', '--no-first-run', '--no-default-browser-check',
    `--remote-debugging-port=${debugPort}`, `--user-data-dir=${path.join(temp, 'chrome')}`, 'about:blank',
  ], { env: { PATH: process.env.PATH, HOME: temp }, stdio: 'ignore' });
  await waitFor(async () => chrome.exitCode !== null ? false : fetch(`http://127.0.0.1:${debugPort}/json/list`).then(response => response.ok), 'Chrome DevTools');
  await connectBrowser();
  await cdp('Page.enable');
  await cdp('Runtime.enable');
  await cdp('Fetch.enable', { patterns: [{ urlPattern: `${origin}/api/*`, requestStage: 'Request' }] });
  await cdp('Emulation.setDeviceMetricsOverride', { width: 320, height: 900, deviceScaleFactor: 1, mobile: true });
  await cdp('Page.navigate', { url: `${origin}/admin/students` });
  try {
    await waitFor(() => evaluate(`Boolean(document.querySelector('main h1')?.textContent.includes('Estudiantes')&&[...document.querySelectorAll('main p')].some(node=>node.textContent.trim()===${JSON.stringify(`${firstName} ${lastName}`)}))`), 'admin student list with synthetic data');
  } catch (error) {
    const snapshot = await evaluate(`JSON.stringify({url:location.href,main:document.querySelector('main')?.innerText.slice(0,180),title:document.title})`);
    throw new Error(`${error.message}; intercepted=${intercepted.join(',')}; snapshot=${snapshot}`);
  }

  const measurements = [];
  for (const [width, scenario] of [[320, 'mobile-320-css-px'], [640, 'mobile-wide-640-css-px'], [720, '200-percent-reflow-equivalent-720-css-px']]) {
    measurements.push(await measure(width, scenario));
  }
  await mkdir(artifactDir, { recursive: true });
  await writeFile(path.join(artifactDir, 'measurements.json'), JSON.stringify({ synthetic_data_only: true, production_ready: false, measurements }, null, 2) + '\n');
  console.log('PASS: synthetic student name and email remain fully visible at 320/640/720 CSS px without horizontal overflow');
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
