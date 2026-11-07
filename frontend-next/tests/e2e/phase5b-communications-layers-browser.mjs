// Actual production rendering. Only synthetic local PostgreSQL fixtures.
import assert from 'node:assert/strict';
import { mkdir, writeFile } from 'node:fs/promises';
const { PHASE5A_CDP: endpoint, PHASE5A_WEB: web, PHASE5A_STUDENT: studentId, PHASE5B_ARTIFACT_DIR: shared } = process.env;
assert(shared, 'Explicit artifact directory required');
const artifacts = shared + '/../communications-layers'; await mkdir(artifacts, { recursive: true });
const stage = process.env.PHASE5B_LAYER_BASELINE === '1' ? 'before' : 'after';
const pages = await (await fetch(endpoint + '/json/list')).json();
const ws = new WebSocket(pages.find(p => p.type === 'page').webSocketDebuggerUrl);
await new Promise(resolve => ws.addEventListener('open', resolve, { once: true }));
let sequence = 0, unintendedWrites = 0;
const calls = new Map(), measurements = [];
ws.addEventListener('message', event => {
  const message = JSON.parse(event.data), call = calls.get(message.id);
  if (call) { calls.delete(message.id); if (message.error) call.reject(new Error(message.error.message)); else call.resolve(message.result); }
  if (message.method === 'Network.requestWillBeSent') {
    const { method, url } = message.params.request, path = new URL(url).pathname;
    if (['POST', 'PUT', 'PATCH', 'DELETE'].includes(method) && (path.endsWith('/messages') || path.endsWith('/status') || path.includes('/admin/doses/'))) unintendedWrites++;
  }
});
function cdp(method, params = {}) { return new Promise((resolve, reject) => { const id = ++sequence; calls.set(id, { resolve, reject }); ws.send(JSON.stringify({ id, method, params })); }); }
async function evaluate(expression) {
  const result = await cdp('Runtime.evaluate', { expression, awaitPromise: true, returnByValue: true });
  assert(!result.exceptionDetails, 'Browser evaluation failed'); return result.result.value;
}
async function until(expression, label) {
  for (let n = 0; n < 100; n++) { if (await evaluate(expression)) return; await new Promise(resolve => setTimeout(resolve, 100)); }
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
  return await evaluate(`(async()=>{const options=${JSON.stringify({ method, ...(body ? { headers: { 'Content-Type': 'application/json' }, body: JSON.stringify(body) } : {}) })};if(methodNeedsCsrf(options.method)){const csrf=await (await fetch('/api/auth/csrf')).json();options.headers={...options.headers,'X-CSRF-Token':csrf.token};}const r=await fetch(${JSON.stringify('/api' + path)},options);return {status:r.status,data:await r.json()};function methodNeedsCsrf(m){return !['GET','HEAD'].includes(m);}})()`);
}
async function paint(selector) {
  await evaluate(`document.querySelector(${JSON.stringify(selector)}).scrollIntoView({block:'center'});document.fonts.ready.then(()=>true)`);
  const capture = await cdp('Page.captureScreenshot', { format: 'png', captureBeyondViewport: false });
  const sample = await evaluate(`(async()=>{const selected=document.querySelector(${JSON.stringify(selector)}),element=selected.closest('.rounded-lg')??selected,r=element.getBoundingClientRect(),style=getComputedStyle(element);
    const image=new Image();image.src=${JSON.stringify('data:image/png;base64,' + capture.data)};await image.decode();const canvas=document.createElement('canvas');canvas.width=image.width;canvas.height=image.height;const ctx=canvas.getContext('2d');ctx.drawImage(image,0,0);
    const expected=style.backgroundColor.match(/\\d+/g).slice(0,3).map(Number),pixels=[];
    for(let column=1;column<20;column++)for(const inset of [6,8,10])pixels.push([...ctx.getImageData(Math.floor(r.left+r.width*column/20),Math.floor(r.bottom-inset),1,1).data].slice(0,3));
    return {expected,pixels,fully_visible:r.top>=0&&r.bottom<=innerHeight,overflow:document.documentElement.scrollWidth>innerWidth,content_hidden:!!element.closest('[aria-hidden=true]'),content_clipped:!!element.closest('.overflow-hidden'),shell_position:getComputedStyle(document.querySelector('header').parentElement).position,shell_z:getComputedStyle(document.querySelector('header').parentElement).zIndex};})()`);
  return { capture, sample, mismatches: sample.pixels.filter(pixel => pixel.some((value, channel) => value !== sample.expected[channel])).length };
}
async function record(role, screen, theme, width, selector) {
  await cdp('Emulation.setDeviceMetricsOverride', { width, height: 844, deviceScaleFactor: 1, mobile: width < 768 });
  const { capture, sample, mismatches } = await paint(selector);
  const item = { role, screen, theme, width, ...sample, mismatched_pixels: mismatches, source: 'real-backend-synthetic-data' }; measurements.push(item);
  if (width === 390) await writeFile(`${artifacts}/${stage}-${role}-${screen}-${theme}-390.png`, Buffer.from(capture.data, 'base64'));
  await writeFile(artifacts + '/' + stage + '-measurements.json', JSON.stringify({ institutional_data: false, production_ready: false, measurements }, null, 2) + '\n');
  assert.equal(mismatches, 0, 'decoration must not paint over opaque communication content');
  assert(sample.fully_visible && !sample.overflow && !sample.content_hidden && !sample.content_clipped, 'visible content without horizontal overflow or decorative clipping');
  assert.equal(sample.shell_position, 'relative'); assert.equal(sample.shell_z, '0');
}
try {
  await cdp('Page.enable'); await cdp('Network.enable');
  await cdp('Page.addScriptToEvaluateOnNewDocument', { source: "try{if(!localStorage.getItem('ic_theme'))localStorage.setItem('ic_theme',JSON.stringify({state:{mode:'light'}}));}catch{}" });
  let adminId, studentThread;
  for (const role of ['admin', 'student', 'app_admin']) {
    await login(role);
    if (role === 'admin') adminId = (await api('/users/me')).data.id;
    let threadId = studentThread;
    if (role !== 'student') {
      const response = await api('/communications/threads', 'POST', { [role === 'admin' ? 'student_id' : 'admin_id']: role === 'admin' ? studentId : adminId, subject: 'Synthetic conversation', message: 'Synthetic body', category: 'general' });
      assert.equal(response.status, 200, 'authorized synthetic conversation creation'); threadId = response.data.id;
      if (role === 'admin') studentThread = threadId;
    }
    const base = role === 'student' ? '/student' : '/admin';
    for (const theme of ['light', 'dark']) {
      await evaluate(`localStorage.setItem('ic_theme',JSON.stringify({state:{mode:${JSON.stringify(theme)}}}))`);
      for (const screen of ['detail', 'list']) {
        await cdp('Page.navigate', { url: web + base + '/communications' + (screen === 'detail' ? '/' + threadId : '') });
        const selector = screen === 'detail' ? '#thread-reply' : 'main ul li a > div';
        await until(`Boolean(document.querySelector(${JSON.stringify(selector)}))&&document.documentElement.dataset.theme===${JSON.stringify(theme)}`, 'rendered communication scene');
        for (const width of [390, 320, 768, 1440]) await record(role, screen, theme, width, selector);
        if (screen === 'detail') {
          await evaluate("document.querySelector('#thread-reply').focus()"); await cdp('Input.insertText', { text: 'Synthetic draft' });
          await key('Tab', 'Tab', 9);
          assert(await evaluate("document.querySelector('#thread-reply').value==='Synthetic draft'&&document.activeElement?.textContent.trim()==='Enviar'"), 'keyboard keeps draft and reaches the send action');
        }
      }
    }
  }
  assert.equal(unintendedWrites, 0, 'presentation and keyboard traversal do not send replies, change status or review doses');
  console.log('PASS: communications paint, layers, reflow and keyboard in 48 real scenes');
} finally { ws.close(); }
