// Real browser -> Next BFF -> FastAPI -> isolated synthetic PostgreSQL.
import assert from 'node:assert/strict';
import { mkdir, writeFile } from 'node:fs/promises';
const { PHASE5A_CDP: cdpUrl, PHASE5A_WEB: web, PHASE5A_STUDENT: studentId, PHASE5B_ARTIFACT_DIR: shared } = process.env;
assert(shared, 'Explicit artifact directory required');
const artifacts = shared + '/../communications-peer';
await mkdir(artifacts, { recursive: true });
const pages = await (await fetch(cdpUrl + '/json/list')).json();
const ws = new WebSocket(pages.find(p => p.type === 'page').webSocketDebuggerUrl);
await new Promise(resolve => ws.addEventListener('open', resolve, { once: true }));
let id = 0;
let loginResponse = null;
const pending = new Map(), results = [];
ws.addEventListener('message', event => {
  const message = JSON.parse(event.data), call = pending.get(message.id);
  if (call) {
    pending.delete(message.id);
    if (message.error) call.reject(new Error(message.error.message));
    else call.resolve(message.result);
  }
  if (message.method === 'Network.responseReceived' && new URL(message.params.response.url).pathname === '/api/auth/login') {
    const response = message.params.response;
    loginResponse = { status: response.status, retryAfter: Number(response.headers['retry-after'] ?? response.headers['Retry-After']) };
  }
});
function cdp(method, params = {}) {
  return new Promise((resolve, reject) => {
    const n = ++id; pending.set(n, { resolve, reject });
    ws.send(JSON.stringify({ id: n, method, params }));
  });
}
async function evaluate(expression) {
  const result = await cdp('Runtime.evaluate', { expression, awaitPromise: true, returnByValue: true });
  assert(!result.exceptionDetails, 'Browser evaluation failed');
  return result.result.value;
}
async function until(expression, label) {
  for (let n = 0; n < 100; n++) {
    if (await evaluate(expression)) return;
    await new Promise(resolve => setTimeout(resolve, 100));
  }
  throw new Error('Timeout: ' + label);
}
async function activate(selector) {
  await evaluate(`document.querySelector(${JSON.stringify(selector)}).focus()`);
  await cdp('Input.dispatchKeyEvent', { type: 'keyDown', key: 'Enter', code: 'Enter', windowsVirtualKeyCode: 13 });
  await cdp('Input.dispatchKeyEvent', { type: 'char', key: 'Enter', code: 'Enter', text: '\r', windowsVirtualKeyCode: 13 });
  await cdp('Input.dispatchKeyEvent', { type: 'keyUp', key: 'Enter', code: 'Enter', windowsVirtualKeyCode: 13 });
}
async function login(role) {
  await cdp('Network.clearBrowserCookies');
  await cdp('Page.navigate', { url: web + '/login' });
  await until("document.querySelector('#email')&&Object.keys(document.querySelector('#email')).some(k=>k.startsWith('__reactProps'))", 'hydrated login');
  for (const [selector, value] of [['#email', role + '@example.com'], ['#password', 'SyntheticOnly123!']]) {
    await evaluate(`(()=>{const e=document.querySelector(${JSON.stringify(selector)});Object.getOwnPropertyDescriptor(HTMLInputElement.prototype,'value').set.call(e,${JSON.stringify(value)});e.dispatchEvent(new Event('input',{bubbles:true}));})()`);
  }
  for (let attempt = 0; attempt < 2; attempt++) {
    loginResponse = null;
    await activate('button[type=submit]');
    for (let n = 0; n < 100; n++) {
      if (await evaluate(`location.pathname===${JSON.stringify(role === 'student' ? '/student' : '/admin')}`)) return;
      if (loginResponse?.status === 429) {
        assert.equal(attempt, 0, 'only one bounded retry after the real rate-limit window');
        const seconds = loginResponse.retryAfter;
        assert(Number.isInteger(seconds) && seconds >= 0 && seconds <= 60, 'real Retry-After bound');
        results.push({ case: 'login_rate_limit_respected', http_status: 429, retry_after_seconds: seconds });
        // Preserve the real limit; do not disable it or change proxy/IP configuration.
        await new Promise(resolve => setTimeout(resolve, seconds * 1000 + 1000));
        break;
      }
      await new Promise(resolve => setTimeout(resolve, 100));
    }
  }
  throw new Error('Synthetic role login did not complete');
}
async function api(path, method = 'GET', body) {
  return await evaluate(`(async()=>{const options=${JSON.stringify({ method, ...(body ? { headers: { 'Content-Type': 'application/json' }, body: JSON.stringify(body) } : {}) })};if(!['GET','HEAD'].includes(options.method)){const csrf=await (await fetch('/api/auth/csrf')).json();options.headers={...options.headers,'X-CSRF-Token':csrf.token};}const r=await fetch(${JSON.stringify('/api' + path)},options);return {status:r.status,data:await r.json()};})()`);
}
async function create(field, recipient, subject) {
  const response = await api('/communications/threads', 'POST', { [field]: recipient, subject, message: 'Synthetic body', category: 'general' });
  assert.equal(response.status, 200, 'actual FastAPI creates synthetic conversation');
  return response.data.id;
}
async function check(role, threadId, peerRole, caseName, capture = false) {
  const response = await api('/communications/threads/' + threadId);
  assert.equal(response.status, 200, 'authorized read');
  const me = (await api('/users/me')).data;
  const thread = response.data;
  const peer = [thread.recipient, thread.created_by, thread.student].find(user => user && user.id !== me.id);
  assert(peer && peer.role === peerRole, 'expected counterpart comes from real backend participants');
  const label = peer.name ?? peer.email;
  const ownLabel = [thread.recipient, thread.created_by, thread.student].find(user => user && user.id === me.id)?.name ?? me.email;
  const base = role === 'student' ? '/student' : '/admin';
  const href = base + '/communications/' + threadId;
  await cdp('Page.navigate', { url: web + base + '/communications' });
  await until(`document.querySelector(${JSON.stringify('main a[href="' + href + '"]')})?.textContent.includes(${JSON.stringify(label)})`, 'list counterpart');
  const subtitle = await evaluate(`document.querySelector(${JSON.stringify('main a[href="' + href + '"]')}).querySelector('p.text-xs').textContent`);
  assert(subtitle.includes(label) && !subtitle.includes(ownLabel), 'list names counterpart rather than viewer');
  if (capture) await screenshot('next-list-student-light.png');
  await activate('main a[href="' + href + '"]');
  await until(`location.pathname===${JSON.stringify(href)}&&document.querySelector('main h2')?.nextElementSibling?.textContent===${JSON.stringify(label)}`, 'detail counterpart');
  const detailLabel = await evaluate("document.querySelector('main h2').nextElementSibling.textContent");
  assert.equal(detailLabel, label, 'same counterpart in detail');
  assert.notEqual(detailLabel, ownLabel, 'detail does not identify viewer as counterpart');
  if (capture) await screenshot('next-detail-student-light.png');
  await cdp('Page.reload');
  await until(`document.querySelector('main h2')?.nextElementSibling?.textContent===${JSON.stringify(label)}`, 'detail reload counterpart');
  results.push({ case: caseName, viewer_role: role, peer_role: peerRole, list: true, detail: true, reload: true, real_backend: true });
}
async function screenshot(name) {
  assert.equal(await evaluate("document.documentElement.dataset.theme"), 'light', 'capture uses explicit light theme');
  const result = await cdp('Page.captureScreenshot', { format: 'png', captureBeyondViewport: true });
  await writeFile(artifacts + '/' + name, Buffer.from(result.data, 'base64'));
}
try {
  await cdp('Page.enable');
  await cdp('Network.enable');
  await cdp('Page.addScriptToEvaluateOnNewDocument', { source: "try{localStorage.setItem('ic_theme',JSON.stringify({state:{mode:'light'}}));}catch{}" });
  await cdp('Emulation.setDeviceMetricsOverride', { width: 390, height: 844, deviceScaleFactor: 1, mobile: true });
  await login('admin');
  const adminId = (await api('/users/me')).data.id;
  const recipients = await api('/communications/recipients/search', 'POST', { target: 'admins', search: 'example.com' });
  assert.equal(recipients.status, 200);
  const appAdminId = recipients.data.find(user => user.role === 'app_admin').id;
  const adminStudent = await create('student_id', studentId, 'Synthetic admin to student');
  const adminApp = await create('admin_id', appAdminId, 'Synthetic admin to app admin');
  await login('app_admin');
  const appAdmin = await create('admin_id', adminId, 'Synthetic app admin to admin');
  await check('app_admin', adminApp, 'admin', 'app_admin_receives_from_admin');
  await check('app_admin', appAdmin, 'admin', 'app_admin_sends_to_admin');
  await login('student');
  const studentAdmin = await create('admin_id', adminId, 'Synthetic student to admin');
  await check('student', adminStudent, 'admin', 'student_receives_from_admin', true);
  await check('student', studentAdmin, 'admin', 'student_sends_to_admin');
  assert.equal((await api('/communications/threads/' + adminApp)).status, 403, 'student denied unrelated administrator thread');
  assert.equal((await api('/communications/threads/' + adminApp + '/status', 'PUT', { status: 'closed' })).status, 403, 'student denied unrelated status mutation');
  results.push({ case: 'unrelated_thread_denied', read_status: 403, update_status: 403, real_backend: true });
  await login('admin');
  await check('admin', adminStudent, 'student', 'admin_sends_to_student');
  await check('admin', studentAdmin, 'student', 'admin_receives_from_student');
  await check('admin', adminApp, 'app_admin', 'admin_sends_to_app_admin');
  await check('admin', appAdmin, 'app_admin', 'admin_receives_from_app_admin');
  await writeFile(artifacts + '/results.json', JSON.stringify({ institutional_data: false, production_ready: false, results }, null, 2) + '\n');
  console.log('PASS: eight real counterpart perspectives, list/detail/reload and object permissions');
} finally { ws.close(); }
