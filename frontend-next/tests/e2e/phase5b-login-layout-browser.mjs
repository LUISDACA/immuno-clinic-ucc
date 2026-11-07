// Real Chromium layout check for login and the shared recovery-page shell.
// Uses a synthetic 503 for anonymous session restoration; no credentials/API mutations.
import assert from 'node:assert/strict';
import { mkdir, writeFile } from 'node:fs/promises';

const { PHASE5B_CDP: endpoint, PHASE5B_WEB: web, PHASE5B_ARTIFACT_DIR: artifacts } = process.env;
assert(endpoint && web && artifacts, 'Set PHASE5B_CDP, PHASE5B_WEB and PHASE5B_ARTIFACT_DIR');
await mkdir(artifacts, { recursive: true });

const targets = await (await fetch(`${endpoint}/json/list`)).json();
const target = targets.find((item) => item.type === 'page');
assert(target, 'Chrome page target not found');
const ws = new WebSocket(target.webSocketDebuggerUrl);
await new Promise((resolve, reject) => {
  ws.addEventListener('open', resolve, { once: true });
  ws.addEventListener('error', reject, { once: true });
});

let nextId = 0;
let sessionRestorationResponses = 0;
const pending = new Map();
ws.addEventListener('message', async ({ data }) => {
  const message = JSON.parse(data);
  const callback = pending.get(message.id);
  if (callback) {
    pending.delete(message.id);
    if (message.error) callback.reject(new Error(message.error.message));
    else callback.resolve(message.result);
  }
  if (message.method === 'Fetch.requestPaused') {
    const { requestId, request } = message.params;
    assert.equal(new URL(request.url).pathname, '/api/users/me');
    assert.equal(request.method, 'GET');
    sessionRestorationResponses += 1;
    await cdp('Fetch.fulfillRequest', {
      requestId,
      responseCode: 503,
      responseHeaders: [{ name: 'Content-Type', value: 'application/json' }],
      body: Buffer.from(JSON.stringify({ code: 'SYNTHETIC_UNAVAILABLE', message: 'Unavailable' })).toString('base64'),
    });
  }
});

function cdp(method, params = {}) {
  return new Promise((resolve, reject) => {
    const id = ++nextId;
    pending.set(id, { resolve, reject });
    ws.send(JSON.stringify({ id, method, params }));
  });
}

const delay = (ms) => new Promise((resolve) => setTimeout(resolve, ms));
async function evaluate(expression) {
  const result = await cdp('Runtime.evaluate', { expression, awaitPromise: true, returnByValue: true });
  assert(!result.exceptionDetails, 'Browser evaluation failed');
  return result.result.value;
}
async function until(expression, label) {
  for (let attempt = 0; attempt < 100; attempt += 1) {
    if (await evaluate(`Boolean(${expression})`)) return;
    await delay(50);
  }
  throw new Error(`Timeout waiting for ${label}`);
}
async function capture(name) {
  const screenshot = await cdp('Page.captureScreenshot', { format: 'png', captureBeyondViewport: false });
  await writeFile(`${artifacts}/next-${name}-393x873.png`, Buffer.from(screenshot.data, 'base64'));
}

try {
  await cdp('Page.enable');
  await cdp('Runtime.enable');
  await cdp('Emulation.setDeviceMetricsOverride', { width: 393, height: 873, deviceScaleFactor: 1, mobile: true });
  await cdp('Fetch.enable', { patterns: [{ urlPattern: '*/api/users/me', requestStage: 'Request' }] });
  await cdp('Page.navigate', { url: `${web}/login` });
  await until("document.querySelector('.auth-login-card') && document.querySelector('#password')", 'hydrated login');
  await until('document.fonts.status === "loaded"', 'web fonts');
  await until('document.querySelector(".auth-brand-header")', 'shared auth header');
  for (let attempt = 0; attempt < 100 && sessionRestorationResponses === 0; attempt += 1) await delay(50);
  assert(sessionRestorationResponses > 0, 'Anonymous session restoration was not controlled');

  const login = await evaluate(`(() => {
    const card = document.querySelector('.auth-login-card');
    const content = document.querySelector('.auth-layout-content');
    const brand = document.querySelector('.auth-brand-header');
    const button = card.querySelector('button[type="submit"]');
    const rect = (element) => { const { x, y, width, height } = element.getBoundingClientRect(); return { x, y, width, height }; };
    return {
      viewport: { width: innerWidth, height: innerHeight, scrollWidth: document.documentElement.scrollWidth },
      card: rect(card), cardRadius: getComputedStyle(card).borderTopLeftRadius,
      contentMaxWidth: getComputedStyle(content).maxWidth,
      externalBrandDisplay: getComputedStyle(brand).display,
      logo: rect(card.querySelector('img')),
      email: rect(card.querySelector('#email')), password: rect(card.querySelector('#password')),
      emailLabel: rect(card.querySelector('label[for="email"]')),
      submit: rect(button), sessionErrorVisible: document.body.textContent.includes('Tu sesión expiró'),
    };
  })()`);
  assert.equal(login.externalBrandDisplay, 'none');
  assert.equal(login.cardRadius, '24px');
  assert.equal(login.card.x, 24);
  assert.equal(login.logo.width, 118);
  assert(Math.abs((login.emailLabel.y + login.emailLabel.height / 2) - (login.email.y + login.email.height / 2)) < 3);
  assert(login.submit.height >= 52);
  assert.equal(login.viewport.scrollWidth, login.viewport.width);
  assert.equal(login.sessionErrorVisible, false, '503 session restoration must not become an expired-session banner');
  await cdp('Page.bringToFront');
  const floatedLabel = await evaluate(`(async () => {
    const label = document.querySelector('label[for="email"]');
    const container = label.closest('.auth-floating-field');
    container.dataset.filled = 'true';
    await new Promise((resolve) => setTimeout(resolve, 160));
    const style = getComputedStyle(label);
    const result = { top: style.top, fontSize: style.fontSize, populated: container.dataset.filled === 'true', transitionDuration: style.transitionDuration };
    container.dataset.filled = 'false';
    return result;
  })()`);
  assert.equal(floatedLabel.top, '0px');
  assert.equal(floatedLabel.fontSize, '12px');
  assert.equal(floatedLabel.populated, true);
  await capture('login-light');

  await cdp('Page.navigate', { url: `${web}/forgot-password` });
  await until("document.querySelector('.auth-brand-header') && document.querySelector('form')", 'forgot-password');
  const recovery = await evaluate(`(() => ({
    brandDisplay: getComputedStyle(document.querySelector('.auth-brand-header')).display,
    contentMaxWidth: getComputedStyle(document.querySelector('.auth-layout-content')).maxWidth,
    scrollWidth: document.documentElement.scrollWidth,
    viewportWidth: innerWidth,
  }))()`);
  assert.notEqual(recovery.brandDisplay, 'none', 'Recovery keeps the shared brand header');
  assert.equal(recovery.contentMaxWidth, '448px');
  assert.equal(recovery.scrollWidth, recovery.viewportWidth);
  await capture('forgot-password-light');

  await writeFile(`${artifacts}/measurements.json`, `${JSON.stringify({
    syntheticOnly: true,
    credentialsUsed: false,
    apiMutations: 0,
    sessionRestorationResponses,
    login,
    floatedLabel,
    recovery,
  }, null, 2)}\n`);
  console.log('PASS: login composition and recovery shell at 393x873; no horizontal overflow');
} finally {
  ws.close();
}
