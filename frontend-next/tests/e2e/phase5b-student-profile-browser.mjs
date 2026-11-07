// Controlled synthetic profile presentation plus real FastAPI/PostgreSQL recovery and contact write.
import assert from 'node:assert/strict';
import { mkdir, readFile, writeFile } from 'node:fs/promises';
const { PHASE5A_CDP: endpoint, PHASE5A_WEB: web, PHASE5B_ARTIFACT_DIR: shared } = process.env;
assert(shared, 'Explicit artifact directory required');
const artifacts = shared + '/../student-profile', prefix = process.env.PHASE5B_CAPTURE_PREFIX ?? 'after';
await mkdir(artifacts, { recursive: true });
const fixture = JSON.parse(await readFile('../docs/ui/fixtures/phase5b-student-profile.json', 'utf8'));
const pages = await (await fetch(endpoint + '/json/list')).json();
const ws = new WebSocket(pages.find(p => p.type === 'page').webSocketDebuggerUrl);
await new Promise(resolve => ws.addEventListener('open', resolve, { once: true }));
let id = 0, stage = 'real', restorationReads = 0, realUser, controlledReads = 0, writes = 0;
const pending = new Map(), held = [], transportErrors = [], measurements = [];
ws.addEventListener('message', event => {
  const m = JSON.parse(event.data), call = pending.get(m.id);
  if (call) { pending.delete(m.id); if (m.error) call.reject(new Error(m.error.message)); else call.resolve(m.result); }
  if (m.method === 'Fetch.requestPaused') {
    const { requestId, request } = m.params;
    if (request.method !== 'GET') {
      writes++;
      assert.equal(request.method, 'PUT');
      assert.equal(new URL(request.url).pathname, '/api/users/me/profile');
      assert.deepEqual(Object.keys(JSON.parse(request.postData)).sort(), ['emergency_contact_name', 'emergency_contact_phone', 'eps_affiliation', 'phone']);
      cdp('Fetch.continueRequest', { requestId }).catch(() => transportErrors.push('write failed'));
    } else if (stage === 'real' || restorationReads-- > 0) {
      cdp('Fetch.continueRequest', { requestId }).catch(() => transportErrors.push('continue failed'));
    } else {
      controlledReads++;
      if (stage === 'loading') held.push(requestId);
      else respond(requestId, stage).catch(() => transportErrors.push('controlled response failed'));
    }
  }
});
function cdp(method,params={}){return new Promise((resolve,reject)=>{const n=++id;pending.set(n,{resolve,reject});ws.send(JSON.stringify({id:n,method,params}));});}
async function evaluate(expression){const r=await cdp('Runtime.evaluate',{expression,awaitPromise:true,returnByValue:true});assert(!r.exceptionDetails,'Browser evaluation failed');return r.result.value;}
async function until(expression,label){for(let n=0;n<100;n++){if(await evaluate(`Boolean(${expression})`))return;await new Promise(r=>setTimeout(r,100));}throw new Error('Timeout: '+label);}
const pause=ms=>new Promise(r=>setTimeout(r,ms));
async function key(key,code,virtualCode,text){
  await cdp('Input.dispatchKeyEvent',{type:'keyDown',key,code,windowsVirtualKeyCode:virtualCode});
  if(text)await cdp('Input.dispatchKeyEvent',{type:'char',text,unmodifiedText:text,key,code,windowsVirtualKeyCode:virtualCode});
  await cdp('Input.dispatchKeyEvent',{type:'keyUp',key,code,windowsVirtualKeyCode:virtualCode});
}
async function input(selector,value){await evaluate(`(()=>{const e=document.querySelector(${JSON.stringify(selector)});Object.getOwnPropertyDescriptor(HTMLInputElement.prototype,'value').set.call(e,${JSON.stringify(value)});e.dispatchEvent(new Event('input',{bubbles:true}));})()`);}
async function activate(selector){await evaluate(`document.querySelector(${JSON.stringify(selector)}).focus()`);await key('Enter','Enter',13,'\r');}
async function screenshot(name) {
  await evaluate('document.fonts.ready.then(()=>true)');
  const image = await cdp('Page.captureScreenshot', { format: 'png', captureBeyondViewport: false });
  await writeFile(`${artifacts}/${prefix}-next-${name}.png`, Buffer.from(image.data, 'base64'));
}
async function save() { await writeFile(`${artifacts}/${prefix}-next-measurements.json`, JSON.stringify({ institutional_data: false, production_ready: false, native_zoom: false, measurements }, null, 2) + '\n'); }
async function respond(requestId, value) {
  const status = Number(value) || 200;
  const body = status !== 200 ? { code: 'SYNTHETIC_FAILURE', message: 'PRIVATE_DIAGNOSTIC', details: {} } : { ...realUser, email: fixture.email, profile: value === 'absent' ? null : fixture.profile };
  await cdp('Fetch.fulfillRequest', { requestId, responseCode: status, responseHeaders: [{ name: 'Content-Type', value: 'application/json' }, { name: 'Cache-Control', value: 'no-store' }], body: Buffer.from(JSON.stringify(body)).toString('base64') });
}
async function navigate(value) {
  stage = value; restorationReads = 1;
  await cdp('Page.navigate', { url: web + '/student/profile' });
  await until(value === 'loading' ? "document.querySelector('main')?.textContent.includes('Cargando...')" : ['403', '404', '429', '503'].includes(value) ? "document.querySelector('main [role=alert] button')" : "document.querySelector('main h1')?.textContent==='Mi perfil'", value + ' ready');
}
async function geometry() {
  return await evaluate(`(()=>{
    const nodes = [...document.querySelectorAll('main p, main label')];
    return {viewport:innerWidth,clientWidth:document.documentElement.clientWidth,scrollWidth:document.documentElement.scrollWidth,clippedTextCount:nodes.filter(p=>{const b=p.getBoundingClientRect(),range=document.createRange();range.selectNodeContents(p);return [...range.getClientRects()].some(r=>r.left<b.left-1||r.right>b.right+1||r.top<b.top-1||r.bottom>b.bottom+1)}).length};
  })()`);
}
async function button(label) { await evaluate(`(()=>{const b=[...document.querySelectorAll('main button')].find(b=>b.textContent.trim()===${JSON.stringify(label)});if(!b)throw new Error('Missing action');b.focus();})()`); await key('Enter', 'Enter', 13, '\r'); }
try {
  await cdp('Page.enable');
  await cdp('Emulation.setDeviceMetricsOverride', { width: 390, height: 844, deviceScaleFactor: 1, mobile: true });
  await cdp('Page.navigate', { url: web + '/login' });
  await until("document.querySelector('#email')&&Object.keys(document.querySelector('#email')).some(k=>k.startsWith('__reactProps'))", 'hydrated login');
  await input('#email', 'student@example.com'); await input('#password', 'SyntheticOnly123!'); await activate('button[type=submit]');
  await until("location.pathname==='/student'", 'student login');
  realUser = await evaluate("fetch('/api/users/me').then(r=>r.json())");
  assert.equal(realUser.role, 'student');
  assert.equal(await evaluate("fetch('/api/admin/admins').then(r=>r.status)"), 403);
  await cdp('Fetch.enable', { patterns: [{ urlPattern: '*/api/users/me*', requestStage: 'Request' }] });
  for (const theme of ['light', 'dark']) {
    await evaluate(`localStorage.setItem('ic_theme',JSON.stringify({state:{mode:${JSON.stringify(theme)}}}))`);
    await cdp('Emulation.setEmulatedMedia', { features: [{ name: 'prefers-color-scheme', value: theme === 'light' ? 'dark' : 'light' }] });
    await navigate('data');
    for (const [width, zoom] of [[320,1],[390,1],[768,1],[1440,1],[320,2],[390,2],[768,2],[1440,2]]) {
      await cdp('Emulation.setDeviceMetricsOverride', { width, height: 844, deviceScaleFactor: 1, mobile: width < 768 });
      await evaluate(`document.body.style.zoom=${JSON.stringify(String(zoom))};scrollTo(0,0)`); await evaluate('document.fonts.ready.then(()=>true)'); await pause(100);
      const measured = await geometry();
      await screenshot(`data-${theme}-${width}-csszoom${zoom}`);
      measurements.push({ case: 'data_reflow', theme, width, cssZoom: zoom, ...measured, source: 'controlled-synthetic-profile' }); await save();
      assert.equal(measured.viewport, width, 'viewport not auto-shrunk');
      assert(measured.scrollWidth <= width, 'profile has no horizontal overflow');
      assert.equal(measured.clippedTextCount, 0, 'all profile text is readable without truncation');
      await button('Editar');
      const editing = await geometry();
      await screenshot(`editing-${theme}-${width}-csszoom${zoom}`);
      measurements.push({ case: 'editing_reflow', theme, width, cssZoom: zoom, ...editing, source: 'controlled-synthetic-profile' }); await save();
      assert(editing.scrollWidth <= width && editing.clippedTextCount === 0, 'locked fields and labels reflow');
      assert.equal(await evaluate("document.querySelectorAll('main input').length"), 4, 'only existing contact fields editable');
      await button('Cancelar');
    }
    await cdp('Emulation.setDeviceMetricsOverride', { width: 390, height: 844, deviceScaleFactor: 1, mobile: true }); await evaluate("document.body.style.zoom='1'");
    for (const value of ['loading', 'absent', '403', '404', '429', '503']) {
      await navigate(value); await screenshot(`${value}-${theme}-390`);
      assert(!await evaluate("document.querySelector('main').textContent.includes('PRIVATE_DIAGNOSTIC')"));
      if (value === 'absent') assert(await evaluate("document.querySelector('main').textContent.includes('No registrado')"));
      else if (value === 'loading') { stage = 'data'; await Promise.all(held.splice(0).map(requestId => respond(requestId, 'data'))); }
      else {
        stage = 'loading'; const before = controlledReads;
        await evaluate("(()=>{const b=document.querySelector('main [role=alert] button');b.click();b.click();})()");
        await until("document.querySelector('main')?.textContent.includes('Cargando...')", 'query retry loading');
        for (let n = 0; n < 100 && held.length === 0; n++) await pause(50);
        assert.equal(held.length, 1, 'single query retry reached the controlled transport');
        assert.equal(controlledReads - before, 1, 'retry issues a single GET');
        stage = 'real'; await Promise.all(held.splice(0).map(requestId => cdp('Fetch.continueRequest', { requestId })));
      }
      if (value !== 'absent') await until("document.querySelector('main h1')?.textContent==='Mi perfil'", 'recovered profile');
      measurements.push({ case: 'query_state', theme, state: value, controlled_response: true, real_recovery: !['absent', 'loading'].includes(value) }); await save();
    }
  }
  assert.equal(writes, 0, 'presentation traversal never writes');
  stage = 'real'; await navigate('real'); await button('Editar');
  await evaluate("(()=>{const e=[...document.querySelectorAll('main label')].find(l=>l.textContent==='Teléfono').control;Object.getOwnPropertyDescriptor(HTMLInputElement.prototype,'value').set.call(e,'0000000002');e.dispatchEvent(new Event('input',{bubbles:true}));})()");
  await evaluate("(()=>{const b=[...document.querySelectorAll('main button')].find(b=>b.textContent.trim()==='Guardar cambios');b.click();b.click();})()");
  await until("[...document.querySelectorAll('main button')].some(b=>b.textContent.trim()==='Editar')&&document.querySelector('main').textContent.includes('0000000002')", 'real saved profile');
  assert.equal(writes, 1, 'double submit writes once');
  assert.equal(await evaluate("fetch('/api/users/me').then(r=>r.json()).then(u=>u.profile.phone)"), '0000000002');
  measurements.push({ case: 'real_contact_save', writes, server_confirmed: true, actual_admin_status: 403 }); await save();
  stage = '401'; restorationReads = 1; await cdp('Page.navigate', { url: web + '/student/profile' });
  await until("location.pathname==='/login'", 'existing expiration redirect');
  assert(!await evaluate("document.querySelector('main')?.textContent.includes('Mi perfil')"));
  assert.equal(transportErrors.length, 0, 'controlled transport');
  measurements.push({ case: 'expired_session', controlled_status: 401, protected_content_removed: true }); await save();
  console.log('PASS: profile text reflow, query recovery, contact write, permissions and expiration');
} finally {
  await Promise.allSettled(held.splice(0).map(requestId => cdp('Fetch.continueRequest', { requestId }))); ws.close();
}
