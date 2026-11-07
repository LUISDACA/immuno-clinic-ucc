// Real browser responsive rendering with synthetic profile values only.
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
const artifactDir = path.resolve(root, '../docs/ui/evidence/phase5b/admin-profile-reflow');
const temp = await mkdtemp(path.join(os.tmpdir(), 'immuno-admin-profile-'));
const synthetic = {
  id: 'synthetic-admin-profile',
  email: `admin-${'long-segment-'.repeat(8)}@example.invalid`,
  role: 'admin',
  is_active: true,
  must_change_password: false,
  created_at: '2026-01-01T12:00:00Z',
  profile: {
    id: 'synthetic-admin-profile-data',
    first_name: 'Synthetic Long Administrator Name '.repeat(4),
    last_name: 'Synthetic Extended Family Name '.repeat(4),
    job_title: 'Synthetic Administrative Position '.repeat(8),
    sex: 'female',
    program: 'Synthetic Academic Program '.repeat(8),
    campus: 'Synthetic Campus Location '.repeat(8),
  },
};
const apiFixture = JSON.stringify(synthetic);
const apiFixtureBase64 = Buffer.from(apiFixture).toString('base64');
let server;
let chrome;
let socket;
let port;
let debugPort;
let nextId = 0;
const pending = new Map();

async function freePort() {
  const probe = net.createServer();
  await new Promise((resolve, reject) => probe.once('error', reject).listen(0, '127.0.0.1', resolve));
  const { port: chosen } = probe.address();
  await new Promise(resolve => probe.close(resolve));
  return chosen;
}

async function waitFor(check, label, timeoutMs = 30_000) {
  const deadline = Date.now() + timeoutMs;
  let lastError;
  while (Date.now() < deadline) {
    try {
      const value = await check();
      if (value) return value;
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

async function until(expression, label) {
  await waitFor(async () => evaluate(`Boolean(${expression})`), label, 30_000);
}

async function fulfillApi(requestId, url) {
  const pathname = new URL(url).pathname;
  let status = 404;
  let body = JSON.stringify({ code: 'NOT_FOUND', message: 'No se encontró el recurso solicitado.', details: null });
  if (pathname === '/api/users/me') {
    status = 200;
    body = Buffer.from(apiFixtureBase64, 'base64').toString('utf8');
  } else if (pathname === '/api/certificates/signature/active') {
    status = 404;
  }
  await cdp('Fetch.fulfillRequest', {
    requestId,
    responseCode: status,
    responseHeaders: [
      { name: 'Content-Type', value: 'application/json; charset=utf-8' },
      { name: 'Cache-Control', value: 'no-store' },
    ],
    body: Buffer.from(body).toString('base64'),
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

async function measure(width, scenario) {
  await cdp('Emulation.setDeviceMetricsOverride', {
    width,
    height: 900,
    deviceScaleFactor: 1,
    mobile: width < 600,
  });
  await evaluate('window.dispatchEvent(new Event("resize"))');
  const metrics = await evaluate(`(()=>{
    const main=document.querySelector('main');
    const hero=main?.querySelector('.ucc-brand-gradient');
    const name=hero?.querySelector('p.text-xl');
    const email=hero?.querySelector('p.flex span');
    const title=hero&&[...hero.querySelectorAll('p')].find(node=>node.classList.contains('mt-0.5'));
    const labels=['Correo','Cargo','Programa','Sede','Rol'];
    const tiles=labels.map(label=>{
      const labelNode=[...main.querySelectorAll('p')].find(node=>node.textContent.trim()===label);
      return labelNode?.parentElement?.querySelectorAll('p')[1]??null;
    });
    const nodes=[name,email,title,...tiles].filter(Boolean);
    return {
      viewport:window.innerWidth,
      documentWidth:document.documentElement.scrollWidth,
      mainWidth:main?.getBoundingClientRect().width??0,
      text:nodes.map(node=>{
        const style=getComputedStyle(node);
        const rect=node.getBoundingClientRect();
        return {
          visible:rect.width>0&&rect.height>0,
          whiteSpace:style.whiteSpace,
          textOverflow:style.textOverflow,
          overflowWrap:style.overflowWrap,
          clientWidth:node.clientWidth,
          scrollWidth:node.scrollWidth,
          clientHeight:node.clientHeight,
          scrollHeight:node.scrollHeight,
        };
      }),
    };
  })()`);
  assert.equal(metrics.text.length, 8, `Expected header and five profile values at ${width}px`);
  assert(metrics.text.every(item => item.visible), `A profile value is not visible at ${width}px`);
  assert(metrics.text.every(item => item.whiteSpace !== 'nowrap'), `Text is forced onto one line at ${width}px`);
  assert(metrics.text.every(item => item.textOverflow !== 'ellipsis'), `Text is truncated at ${width}px`);
  assert(metrics.text.every(item => item.scrollWidth <= item.clientWidth + 1), `Text overflows its container at ${width}px`);
  assert(metrics.documentWidth <= metrics.viewport, `Horizontal page overflow at ${width}px`);
  return { scenario, ...metrics };
}

try {
  port = await freePort();
  debugPort = await freePort();
  const web = `http://127.0.0.1:${port}`;
  const safeEnv = {
    PATH: process.env.PATH,
    HOME: temp,
    NODE_ENV: 'production',
    NEXT_TELEMETRY_DISABLED: '1',
    API_INTERNAL_URL: 'http://127.0.0.1:1',
    BFF_ORIGIN: web,
    BFF_DATABASE_URL: 'postgresql://127.0.0.1:1/synthetic_unused',
    BFF_SESSION_KEY: randomBytes(32).toString('base64'),
  };
  server = spawn(process.execPath, ['node_modules/next/dist/bin/next', 'start', '--hostname', '127.0.0.1', '--port', String(port)], {
    cwd: root,
    env: safeEnv,
    stdio: 'ignore',
  });
  await waitFor(async () => {
    if (server.exitCode !== null) throw new Error('Next production server exited');
    const response = await fetch(`${web}/login`);
    return response.ok;
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
  await cdp('Fetch.enable', { patterns: [{ urlPattern: `${web}/api/*`, requestStage: 'Request' }] });
  await cdp('Emulation.setDeviceMetricsOverride', { width: 320, height: 900, deviceScaleFactor: 1, mobile: true });
  await cdp('Page.navigate', { url: `${web}/admin/profile` });
  await until("document.querySelector('main h1')?.textContent==='Mi perfil'&&document.querySelector('main').textContent.includes('Synthetic Academic Program')", 'admin profile with synthetic API data');

  const measurements = [];
  measurements.push(await measure(320, 'mobile-320-css-px'));
  measurements.push(await measure(768, 'tablet-768-css-px'));
  measurements.push(await measure(1440, 'desktop-1440-css-px'));
  measurements.push(await measure(720, '200-percent-reflow-equivalent-720-css-px'));
  await mkdir(artifactDir, { recursive: true });
  await writeFile(path.join(artifactDir, 'measurements.json'), JSON.stringify({ synthetic_data_only: true, production_ready: false, measurements }, null, 2) + '\n');
  console.log('PASS: admin profile wraps synthetic long values at 320/768/1440px and 200%-equivalent 720px with no horizontal overflow');
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
