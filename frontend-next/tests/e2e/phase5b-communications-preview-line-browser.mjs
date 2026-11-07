// Compare the message preview in the Next communications list with Flutter's one-line ListTile.
// All API payloads are intercepted and synthetic.
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
const artifactDir = path.resolve(root, '../docs/ui/evidence/phase5b/communications-preview-line');
const temp = await mkdtemp(path.join(os.tmpdir(), 'immuno-communications-preview-'));
const longMessage = 'Synthetic conversation preview that continues beyond one line '.repeat(3).trim();
const student = {
  id: 'synthetic-student', email: 'student@example.invalid', role: 'student', is_active: true,
  must_change_password: false, created_at: '2026-01-01T12:00:00Z', profile: null,
};
const admin = { id: 'synthetic-admin', email: 'admin@example.invalid', name: 'Admin sintético', role: 'admin' };
const thread = {
  id: 'synthetic-thread', subject: 'Asunto sintético', category: 'general', status: 'open',
  student: { id: student.id, email: student.email, name: 'Estudiante sintético', role: 'student' },
  created_by: { id: student.id, email: student.email, name: 'Estudiante sintético', role: 'student' },
  recipient: admin, created_at: '2026-01-01T12:00:00Z', updated_at: '2026-01-01T12:00:00Z',
  last_message_at: '2026-01-01T12:00:00Z', last_message: longMessage, last_message_sender: admin,
};

let server, chrome, socket, appPort, debugPort, callId = 0;
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
    try { const value = await check(); if (value) return value; } catch { /* retry while local services start */ }
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
  let status = 404;
  let payload = { code: 'NOT_FOUND', message: 'No se encontró el recurso solicitado.', details: null };
  if (pathname === '/api/users/me') { status = 200; payload = student; }
  else if (pathname === '/api/notifications/') { status = 200; payload = []; }
  else if (pathname === '/api/communications/threads') { status = 200; payload = [thread]; }
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
    const preview=[...document.querySelectorAll('main p')].find(node=>node.textContent.trim()===${JSON.stringify(longMessage)});
    if(!preview)throw new Error('Synthetic message preview not rendered');
    const style=getComputedStyle(preview),rect=preview.getBoundingClientRect();
    return {viewport:window.innerWidth,documentWidth:document.documentElement.scrollWidth,height:rect.height,lineHeight:parseFloat(style.lineHeight),webkitLineClamp:style.webkitLineClamp,clientWidth:preview.clientWidth,scrollWidth:preview.scrollWidth};
  })()`);
  assert.equal(result.webkitLineClamp, '1', `Message preview should clamp to one line at ${width}px`);
  assert(result.height <= result.lineHeight + 1, `Message preview exceeds one line at ${width}px`);
  assert(result.scrollWidth <= result.clientWidth + 1, `Message preview overflows its box at ${width}px`);
  assert(result.documentWidth <= result.viewport, `Horizontal page overflow at ${width}px`);
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
  await cdp('Page.navigate', { url: `${origin}/student/communications` });
  await waitFor(() => evaluate(`Boolean(document.querySelector('main h1')?.textContent.includes('Comunicaciones')&&[...document.querySelectorAll('main p')].some(node=>node.textContent.trim()===${JSON.stringify(longMessage)}))`), 'synthetic communications list');

  const measurements = [];
  for (const [width, scenario] of [[320, 'mobile-320-css-px'], [640, 'mobile-wide-640-css-px'], [720, '200-percent-reflow-equivalent-720-css-px']]) {
    measurements.push(await measure(width, scenario));
  }
  await mkdir(artifactDir, { recursive: true });
  await writeFile(path.join(artifactDir, 'measurements.json'), JSON.stringify({ synthetic_data_only: true, production_ready: false, flutter_reference_max_lines: 1, measurements }, null, 2) + '\n');
  console.log('PASS: communications preview matches Flutter one-line limit at 320/640/720 CSS px');
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
