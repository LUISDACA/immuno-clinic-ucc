// Real Next/FastAPI/PostgreSQL. Errors/loading/empty responses are explicitly controlled.
import assert from 'node:assert/strict';
import { mkdir, writeFile } from 'node:fs/promises';
const { PHASE5A_CDP: endpoint, PHASE5A_WEB: web, PHASE5A_STUDENT: studentId, PHASE5B_ARTIFACT_DIR: shared } = process.env;
assert(shared, 'Explicit artifact directory required');
const artifacts = shared + '/../communications-recovery', prefix = process.env.PHASE5B_CAPTURE_PREFIX ?? 'after';
await mkdir(artifacts, { recursive: true });
const pages = await (await fetch(endpoint + '/json/list')).json();
const ws = new WebSocket(pages.find(p => p.type === 'page').webSocketDebuggerUrl);
await new Promise(resolve => ws.addEventListener('open', resolve, { once: true }));
let sequence = 0, readStage = 'real', queryStage = 'real', readCalls = 0;
let threadId, detailPayload, unintendedWrites = 0;
const calls = new Map(), heldReads = [], heldQueries = [], measurements = [], failures = [];
ws.addEventListener('message', event => {
  const message = JSON.parse(event.data), call = calls.get(message.id);
  if (call) { calls.delete(message.id); if (message.error) call.reject(new Error(message.error.message)); else call.resolve(message.result); }
  if (message.method === 'Fetch.requestPaused') {
    const { requestId, request } = message.params, path = new URL(request.url).pathname;
    const isRead = path === '/api/notifications/category/communication/read' && request.method === 'PUT';
    const isQuery = path === '/api/communications/threads' || path === '/api/communications/threads/' + threadId;
    if (isRead) readCalls++;
    if (['POST', 'PUT', 'PATCH', 'DELETE'].includes(request.method) && !isRead) unintendedWrites++;
    const stage = isRead ? readStage : isQuery && request.method === 'GET' ? queryStage : 'real';
    if (stage === 'hold') (isRead ? heldReads : heldQueries).push(requestId);
    else if (stage === 'real') cdp('Fetch.continueRequest', { requestId }).catch(() => failures.push('continue failed'));
    else {
      const status = Number(stage) || 200;
      const body = status !== 200 ? { code: 'SYNTHETIC_FAILURE', message: 'Synthetic unsafe diagnostic', details: {} } : stage === 'empty' ? (path.endsWith('/' + threadId) ? { ...detailPayload, messages: [] } : []) : {};
      cdp('Fetch.fulfillRequest', { requestId, responseCode: status, responseHeaders: [{ name: 'Content-Type', value: 'application/json' }, { name: 'Cache-Control', value: 'no-store' }], body: Buffer.from(JSON.stringify(body)).toString('base64') }).catch(() => failures.push('controlled response failed'));
    }
  }
});
function cdp(method, params = {}) { return new Promise((resolve, reject) => { const id = ++sequence; calls.set(id, { resolve, reject }); ws.send(JSON.stringify({ id, method, params })); }); }
async function evaluate(expression) {
  const result = await cdp('Runtime.evaluate', { expression, awaitPromise: true, returnByValue: true });
  assert(!result.exceptionDetails, 'Browser evaluation failed'); return result.result.value;
}
async function until(expression, label) {
  for (let n = 0; n < 100; n++) { if (await evaluate(`Boolean(${expression})`)) return; await new Promise(resolve => setTimeout(resolve, 100)); }
  throw new Error('Timeout: ' + label);
}
async function key(name, code, number, text) {
  await cdp('Input.dispatchKeyEvent', { type: 'keyDown', key: name, code, windowsVirtualKeyCode: number });
  if (text) await cdp('Input.dispatchKeyEvent', { type: 'char', key: name, code, text, windowsVirtualKeyCode: number });
  await cdp('Input.dispatchKeyEvent', { type: 'keyUp', key: name, code, windowsVirtualKeyCode: number });
}
async function login(role) {
  await cdp('Network.clearBrowserCookies'); await cdp('Page.navigate', { url: web + '/login' });
  await until("document.querySelector('#email')&&Object.keys(document.querySelector('#email')).some(k=>k.startsWith('__reactProps'))", 'hydrated login');
  for (const [selector, value] of [['#email', role + '@example.com'], ['#password', 'SyntheticOnly123!']]) {
    await evaluate(`(()=>{const e=document.querySelector(${JSON.stringify(selector)});Object.getOwnPropertyDescriptor(HTMLInputElement.prototype,'value').set.call(e,${JSON.stringify(value)});e.dispatchEvent(new Event('input',{bubbles:true}));})()`);
  }
  await evaluate("document.querySelector('button[type=submit]').focus()"); await key('Enter', 'Enter', 13, '\r');
  await until(`location.pathname===${JSON.stringify(role === 'student' ? '/student' : '/admin')}`, 'role login');
}
async function api(path, method = 'GET', body) {
  return await evaluate(`(async()=>{const options=${JSON.stringify({ method, ...(body ? { headers: { 'Content-Type': 'application/json' }, body: JSON.stringify(body) } : {}) })};if(!['GET','HEAD'].includes(options.method)){const csrf=await (await fetch('/api/auth/csrf')).json();options.headers={...options.headers,'X-CSRF-Token':csrf.token};}const response=await fetch(${JSON.stringify('/api' + path)},options);return {status:response.status,data:await response.json()};})()`);
}
async function save() { await writeFile(`${artifacts}/${prefix}-next-measurements.json`, JSON.stringify({ institutional_data: false, production_ready: false, measurements }, null, 2) + '\n'); }
async function capture(name) {
  await evaluate('document.fonts.ready.then(()=>true)');
  const screenshot = await cdp('Page.captureScreenshot', { format: 'png', captureBeyondViewport: true });
  await writeFile(`${artifacts}/${prefix}-next-${name}.png`, Buffer.from(screenshot.data, 'base64'));
}
function luminance(color) {
  return color.map(v => { const n = v / 255; return n <= .04045 ? n / 12.92 : ((n + .055) / 1.055) ** 2.4; }).reduce((sum, v, i) => sum + v * [.2126, .7152, .0722][i], 0);
}
async function contrast(role, theme, base) {
  await evaluate(`localStorage.setItem('ic_theme',JSON.stringify({state:{mode:${JSON.stringify(theme)}}}))`);
  await cdp('Page.navigate', { url: web + base + '/communications/' + threadId });
  await until(`document.querySelector('#thread-reply')&&document.documentElement.dataset.theme===${JSON.stringify(theme)}`, 'message scene');
  const sample = await evaluate(`(()=>{const p=[...document.querySelectorAll('main .flex-row-reverse p')].find(e=>e.textContent==='Synthetic own body'),s=getComputedStyle(p),b=getComputedStyle(p.parentElement);return {foreground:s.color.match(/\\d+/g).slice(0,3).map(Number),background:b.backgroundColor.match(/\\d+/g).slice(0,3).map(Number)};})()`);
  const a = luminance(sample.foreground), b = luminance(sample.background), ratio = (Math.max(a, b) + .05) / (Math.min(a, b) + .05);
  measurements.push({ case: 'own_message_contrast', role, theme, ...sample, ratio, source: 'real-backend' });
  await capture(`${role}-messages-${theme}-390`); await save();
  assert(ratio >= 4.5, 'own message text contrast');
}
async function states(role, base, theme) {
  for (const screen of ['list', 'detail']) {
    const path = base + '/communications' + (screen === 'detail' ? '/' + threadId : '');
    for (const state of ['hold', 'empty', '403', '404', '503']) {
      queryStage = state; readStage = 'real';
      await cdp('Page.navigate', { url: web + path });
      if (state === 'hold') await until("document.querySelector('main')?.textContent.includes('Cargando...')", 'loading');
      else if (state === 'empty') await until(`document.querySelector('main')?.textContent.includes(${JSON.stringify(screen === 'list' ? 'No hay conversaciones' : 'No hay mensajes')})`, 'empty');
      else await until("document.querySelector('main [role=alert]')&&document.querySelector('main [role=alert] button')", 'safe query error');
      assert(!await evaluate("document.querySelector('main')?.textContent.includes('Synthetic unsafe diagnostic')"), 'no raw diagnostic');
      await capture(`${role}-${screen}-${state}-${theme}-390`);
      if (state === 'hold') {
        queryStage = 'real'; await Promise.all(heldQueries.splice(0).map(requestId => cdp('Fetch.continueRequest', { requestId })));
      } else if (state !== 'empty') {
        queryStage = 'real'; await evaluate("document.querySelector('main [role=alert] button').click()");
      }
      if (state !== 'empty') await until(screen === 'list' ? "Boolean(document.querySelector('main ul a'))" : "Boolean(document.querySelector('#thread-reply'))", 'recovered real query');
      measurements.push({ case: 'query_state', role, theme, screen, state, controlled_response: true, real_recovery: state !== 'empty' });
    }
  }
  queryStage = 'real';
}
async function readRecovery(role, base) {
  readStage = '503'; queryStage = 'real';
  await cdp('Page.navigate', { url: web + base + '/communications/' + threadId });
  await until("document.querySelector('#thread-reply')&&document.querySelector('main [role=alert] button')", 'read error preserves thread');
  await evaluate("document.querySelector('#thread-reply').focus()"); await cdp('Input.insertText', { text: 'Synthetic unsent draft' });
  const before = readCalls;
  readStage = 'hold';
  await evaluate("(()=>{const button=document.querySelector('main [role=alert] button');button.click();button.click();})()");
  for (let n = 0; n < 100 && !heldReads.length; n++) await new Promise(resolve => setTimeout(resolve, 50));
  assert.equal(heldReads.length, 1, 'one read retry held');
  assert.equal(readCalls - before, 1, 'double click writes once');
  assert(await evaluate("document.querySelector('main [role=alert] button').disabled&&document.querySelector('main [role=alert] button').getAttribute('aria-busy')==='true'&&document.querySelector('#thread-reply').value==='Synthetic unsent draft'"), 'pending retry and draft visible');
  await capture(`${role}-read-retry-pending-light-390`);
  readStage = 'real'; await Promise.all(heldReads.splice(0).map(requestId => cdp('Fetch.continueRequest', { requestId })));
  await until("!document.querySelector('main [role=alert]')", 'real read success');
  assert(await evaluate("document.querySelector('#thread-reply').value==='Synthetic unsent draft'"), 'read success retains unsent draft');
  const notifications = await api('/notifications/');
  assert.equal(notifications.status, 200); assert(notifications.data.filter(n => n.category === 'communication').every(n => n.is_read), 'real backend confirms category read');
  measurements.push({ case: 'read_retry', role, double_click_writes: readCalls - before, draft_retained: true, real_backend_success: true });
}
try {
  await cdp('Page.enable'); await cdp('Emulation.setDeviceMetricsOverride', { width: 390, height: 844, deviceScaleFactor: 1, mobile: true });
  await cdp('Page.addScriptToEvaluateOnNewDocument', { source: "try{if(!localStorage.getItem('ic_theme'))localStorage.setItem('ic_theme',JSON.stringify({state:{mode:'light'}}));}catch{}" });
  await login('admin');
  const created = await api('/communications/threads', 'POST', { student_id: studentId, subject: 'Synthetic conversation', message: 'Synthetic own body', category: 'general' });
  assert.equal(created.status, 200); threadId = created.data.id; detailPayload = created.data;
  for (const role of ['admin', 'student']) {
    if (role === 'student') {
      await cdp('Fetch.disable'); await login(role);
      const sent = await api('/communications/threads/' + threadId + '/messages', 'POST', { message: 'Synthetic own body' });
      assert.equal(sent.status, 200); detailPayload = sent.data;
    }
    const base = role === 'student' ? '/student' : '/admin';
    for (const theme of ['light', 'dark']) await contrast(role, theme, base);
    await cdp('Fetch.enable', { patterns: [{ urlPattern: '*/api/communications/threads*', requestStage: 'Request' }, { urlPattern: '*/api/notifications/category/communication/read', requestStage: 'Request' }] });
    for (const theme of ['light', 'dark']) {
      await evaluate(`localStorage.setItem('ic_theme',JSON.stringify({state:{mode:${JSON.stringify(theme)}}}))`);
      await states(role, base, theme);
    }
    await evaluate("localStorage.setItem('ic_theme',JSON.stringify({state:{mode:'light'}}))"); await readRecovery(role, base);
  }
  assert.equal((await api('/admin/statistics')).status, 403, 'student still denied actual administrative data');
  queryStage = '401'; await cdp('Page.navigate', { url: web + '/student/communications' });
  await until("location.pathname==='/login'", 'existing session-expiration redirect');
  assert(!await evaluate("Boolean(document.querySelector('#thread-reply'))"), 'protected content removed');
  assert.equal(unintendedWrites, 0, 'read retry/state traversal does not send or change conversation status');
  assert.equal(failures.length, 0, 'controlled transport');
  measurements.push({ case: 'permissions_and_expiration', actual_admin_status: 403, controlled_session_status: 401, unintended_writes: unintendedWrites });
  await save(); console.log('PASS: read synchronization, loading/empty/errors/recovery, message contrast and actual permissions');
} finally {
  await Promise.allSettled([...heldReads.splice(0), ...heldQueries.splice(0)].map(requestId => cdp('Fetch.continueRequest', { requestId })));
  ws.close();
}
