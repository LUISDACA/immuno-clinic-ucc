// Real Chrome -> production Next BFF -> FastAPI -> isolated PostgreSQL.
// Invoked by backend/tests/test_phase5a_browser.py; no external npm dependencies.
import assert from 'node:assert/strict';
import { mkdir, writeFile } from 'node:fs/promises';
const { PHASE5A_CDP, PHASE5A_WEB, PHASE5A_STUDENT, PHASE5A_DOSE, PHASE5B_ARTIFACT_DIR } = process.env;
const tabs = await (await fetch(`${PHASE5A_CDP}/json/list`)).json();
const ws = new WebSocket(tabs.find(t => t.type === 'page').webSocketDebuggerUrl);
await new Promise(resolve => ws.addEventListener('open', resolve, { once: true }));
let id = 0;
const pending = new Map();
const mutations = [];
const requests=[],responses=[],responseBodies=[],pageErrors=[],studentSearchResponses=new Map();
let holdRead=false, pausedRead=null;
ws.addEventListener('message', event => {
  const message = JSON.parse(event.data);
  if (message.id) {
    const request = pending.get(message.id);
    pending.delete(message.id);
    if (message.error) request.reject(new Error(message.error.message));
    else request.resolve(message.result);
  }
  if(message.method==='Fetch.requestPaused') {
    const request=message.params;
    if(holdRead && new URL(request.request.url).pathname==='/api/users/me') {
      holdRead=false;
      void cdp('Fetch.getResponseBody',{requestId:request.requestId}).then(body=>{pausedRead={...request,...body};});
    } else void cdp('Fetch.continueRequest',{requestId:request.requestId});
  }
  const r = message.params?.request;
  if(message.method==='Network.requestWillBeSent')requests.push({path:new URL(r.url).pathname,method:r.method,body:r.postData});
  if(message.method==='Network.responseReceived')responses.push({path:new URL(message.params.response.url).pathname,status:message.params.response.status});
  if(message.method==='Network.responseReceived' && new URL(message.params.response.url).pathname==='/api/admin/students/search')studentSearchResponses.set(message.params.requestId,message.params.response.status);
  if(message.method==='Network.loadingFinished' && studentSearchResponses.has(message.params.requestId))void cdp('Network.getResponseBody',{requestId:message.params.requestId}).then(result=>{try{const body=JSON.parse(result.base64Encoded?Buffer.from(result.body,'base64').toString():result.body);responseBodies.push({status:studentSearchResponses.get(message.params.requestId),keys:Object.keys(body),total:body.total,item_count:Array.isArray(body.items)?body.items.length:null,code:body.code});}catch{responseBodies.push({status:studentSearchResponses.get(message.params.requestId),invalid_json:true});}}).catch(()=>responseBodies.push({status:studentSearchResponses.get(message.params.requestId),body_unavailable:true}));
  if(message.method==='Runtime.exceptionThrown')pageErrors.push(message.params.exceptionDetails.exception?.description?.split('\n')[0]||message.params.exceptionDetails.text);
  if (message.method === 'Network.requestWillBeSent' && r.url.includes('/admin/doses/') && ['PUT','PATCH'].includes(r.method)) {
    mutations.push({ path: new URL(r.url).pathname, method: r.method, body: JSON.parse(r.postData) });
  }
});
function cdp(method, params = {}) {
  return new Promise((resolve, reject) => { const n = ++id; pending.set(n, { resolve, reject }); ws.send(JSON.stringify({ id:n, method, params })); });
}
async function evaluate(expression) {
  const result = await cdp('Runtime.evaluate', { expression, awaitPromise: true, returnByValue:true });
  if (result.exceptionDetails) throw new Error('Browser evaluation failed');
  return result.result.value;
}
const delay = ms => new Promise(resolve => setTimeout(resolve, ms));
async function until(expression, label) {
  for (let i=0; i<100; i++) { if (await evaluate(expression)) return; await delay(100); }
  throw new Error(`Timeout: ${label}`);
}
const button = label => `Array.from(document.querySelectorAll('button')).find(b=>b.innerText.trim()===${JSON.stringify(label)})`;
async function click(label) { await until(`Boolean(${button(label)})`, label); await evaluate(`${button(label)}.click()`); }
async function input(selector, value) {
  await evaluate(`(() => { const e=document.querySelector(${JSON.stringify(selector)}); const proto=e.tagName==='TEXTAREA'?HTMLTextAreaElement.prototype:HTMLInputElement.prototype; Object.getOwnPropertyDescriptor(proto,'value').set.call(e,${JSON.stringify(value)}); e.dispatchEvent(new Event('input',{bubbles:true})); e.dispatchEvent(new Event('change',{bubbles:true})); })()`);
}
async function navigate(path) { await cdp('Page.navigate', { url: PHASE5A_WEB+path }); }
async function login(role) {
  await cdp('Network.clearBrowserCookies');
  await navigate('/login');
  await until("Boolean(document.querySelector('#email')) && Object.keys(document.querySelector('#email')).some(k=>k.startsWith('__reactProps'))", 'hydrated login form');
  await input('#email', `${role}@example.com`);
  await input('#password', 'SyntheticOnly123!');
  await click('Ingresar');
  await until(`location.pathname===${JSON.stringify(role==='student'?'/student':'/admin')}`, `${role} login`);
}
const scheme = `/api/admin/students/${PHASE5A_STUDENT}/scheme`;
const doseExpression = `(async()=>{const s=await (await fetch(${JSON.stringify(scheme)})).json();return s[0].doses[0];})()`;
async function assertDose(status) { assert.equal((await evaluate(doseExpression)).status, status); }
try {
  await cdp('Network.enable');await cdp('Runtime.enable');
  await cdp('Page.enable');
  await login('admin');
  await navigate(`/admin/students/${PHASE5A_STUDENT}?tab=scheme&returnTo=%2Fadmin%2Fstudents%3Factive%3Dtrue`);
  await until("Array.from(document.querySelectorAll('button[aria-expanded]')).some(b=>b.textContent.includes('Synthetic vaccine'))", 'scheme accordion loaded');
  await evaluate("(()=>{const b=Array.from(document.querySelectorAll('button[aria-expanded]')).find(b=>b.textContent.includes('Synthetic vaccine'));if(b.getAttribute('aria-expanded')!=='true')b.click();})()");
  await until("Array.from(document.querySelectorAll('button')).some(b=>b.innerText.trim()==='Editar comentario')", 'dose comment editor visible');
  await click('Editar comentario');
  await input(`textarea[id="comment-${PHASE5A_DOSE}"]`, 'Synthetic browser comment');
  await click('Guardar comentario');
  await until(`document.body.textContent.includes('Synthetic browser comment') && !document.querySelector('textarea[id="comment-${PHASE5A_DOSE}"]')`, 'comment saved');
  await assertDose('in_review');
  assert.equal(mutations.length,1);
  assert.deepEqual(mutations[0], {path:`/api/admin/doses/${PHASE5A_DOSE}/comment`,method:'PATCH',body:{admin_notes:'Synthetic browser comment'}});
  await click('Eliminar comentario');
  assert.equal(mutations.length,1);
  await click('Confirmar eliminación del comentario');
  await until("document.body.textContent.includes('Sin comentario')", 'comment removed');
  await assertDose('in_review');
  assert.equal(mutations.filter(r=>r.method==='PUT').length,0);
  for (const [label, status] of [['Aprobar','approved'],['Denegar','denied']]) {
    const before=mutations.length;
    await click(label);
    assert.equal(mutations.length,before, 'opening confirmation cannot mutate');
    await click(label);
    await until(`!document.body.textContent.includes('¿Confirmar')`, `${status} saved`);
    await assertDose(status);
    assert.equal(mutations.at(-1).method,'PUT');
    assert.equal(mutations.at(-1).body.status,status);
  }
  // More than two real server pages; context survives navigation and reload.
  await navigate('/admin/students?active=true&semester=1');
  try { await until("document.body.textContent.includes('45 registros')",'student totals'); }
  catch { await delay(100);throw new Error('Student list did not reach the expected total: '+await evaluate("JSON.stringify({url:location.pathname+location.search,page_error:document.body.innerText.includes('This page couldn’t load')})")+'; API responses: '+JSON.stringify(responses.filter(r=>r.path.includes('/admin/students')).slice(-8))+'; student payload summaries: '+JSON.stringify(responseBodies)+'; page errors: '+JSON.stringify(pageErrors)); }
  await cdp('Emulation.setDeviceMetricsOverride',{width:320,height:568,deviceScaleFactor:1,mobile:true});
  await until('document.documentElement.clientWidth===320','student list mobile viewport');
  const listGeometry=await evaluate("(()=>{const d=document.querySelector('details'),s=d.querySelector('summary'),r=d.getBoundingClientRect(),sr=s.getBoundingClientRect(),badges=Array.from(s.querySelectorAll('span')).filter(e=>['aprobados','pendientes','denegados'].some(t=>e.textContent.includes(t))).map(e=>{const b=e.getBoundingClientRect();return {text:e.textContent,left:b.left,right:b.right};});return {viewport:document.documentElement.clientWidth,scrollWidth:document.documentElement.scrollWidth,details:{left:r.left,right:r.right},summary:{left:sr.left,right:sr.right},open:d.open,badges};})()");
  assert.equal(listGeometry.viewport,320);assert(listGeometry.scrollWidth<=320,'student list horizontal overflow '+JSON.stringify(listGeometry));
  assert(listGeometry.open,'first semester group is expanded');assert.equal(listGeometry.badges.length,3,'all summary counts remain visible');
  assert(listGeometry.badges.every(b=>b.left>=listGeometry.details.left&&b.right<=listGeometry.details.right),'semester status counts fit the group '+JSON.stringify(listGeometry));
  await input('input[aria-label="Buscar estudiantes"]','Page');
  await until("location.search.includes('ctx=') && document.body.textContent.includes('45 registros')",'private search context');
  await click('Siguiente');
  await until("location.search.includes('page=2') && document.body.textContent.includes('Página 2 de 3')",'second student page');
  const returnUrl=await evaluate('location.pathname+location.search');
  assert(!returnUrl.includes('Page'),'search text must not enter URL');
  const detail=await evaluate("document.querySelector('a[href^=\"/admin/students/\"][href*=\"returnTo=\"]').getAttribute('href')");
  assert.equal(new URLSearchParams(detail.split('?')[1]).get('returnTo'),returnUrl);
  await evaluate("document.querySelector('a[href^=\"/admin/students/\"][href*=\"returnTo=\"]').click()");
  await click('Evidencia');await until("location.search.includes('tab=evidence') && document.body.textContent.includes('Sin evidencias.')",'tab change committed');await cdp('Page.reload');
  await until("location.search.includes('tab=evidence') && document.body.textContent.includes('Sin evidencias.')",'evidence tab reload');
  await evaluate("document.querySelector('button[aria-label=\"Volver\"]').click()");
  await until("document.querySelector('input[aria-label=\"Buscar estudiantes\"]')?.value==='Page' && document.body.textContent.includes('Página 2 de 3')",'return preserves search and page');
  assert.equal(await evaluate('location.pathname+location.search'),returnUrl);
  await evaluate("document.querySelector('a[href^=\"/admin/students/\"][href*=\"returnTo=\"]').click()");
  await until("Boolean(document.querySelector('button[aria-label=\"Volver\"]'))",'detail loaded');
  await evaluate('history.back()');
  await until("location.pathname==='/admin/students' && document.querySelector('input[aria-label=\"Buscar estudiantes\"]')?.value==='Page'",'browser back context');
  const listRequests=requests.filter(r=>r.path==='/api/admin/students/search');
  assert(listRequests.length>0);
  assert(listRequests.every(r=>JSON.parse(r.body).page_size===20),'bounded page requests');
  await navigate(`/admin/students/${PHASE5A_STUDENT}?tab=evidence&evidence_page=2&returnTo=${encodeURIComponent(returnUrl)}`);
  await until("document.body.textContent.includes('Página 2 de 3')",'evidence deep page');
  await cdp('Page.reload');await until("document.body.textContent.includes('Página 2 de 3')",'evidence page reload');
  await click('Siguiente');await until("document.body.textContent.includes('Página 3 de 3')",'last evidence page');
  await click('Actualizar lista');await until("document.body.textContent.includes('Página 3 de 3')",'refresh same evidence page');

  // Hold an actual pre-write query response, then release it after the save.
  await navigate('/admin/profile');await click('Editar');
  await until("Boolean(document.getElementById('Nombres'))",'profile inputs');
  await cdp('Fetch.enable',{patterns:[{urlPattern:'*/api/users/me',requestStage:'Response'}]});
  await evaluate("document.querySelector('a[href=\"/admin\"]').click()");
  await until("location.pathname==='/admin'",'leave cached profile');
  holdRead=true;await evaluate('history.back()');
  await until("location.pathname==='/admin/profile'",'return to cached profile');
  await click('Editar');
  for(let n=0;n<100 && !pausedRead;n++)await delay(100);
  assert(pausedRead,'real profile read must be held before mutation');
  const oldBody=JSON.parse(pausedRead.base64Encoded?Buffer.from(pausedRead.body,'base64').toString():pausedRead.body);
  assert.equal(oldBody.profile.first_name,'Synthetic');
  await input('input[id="Nombres"]','Browser updated');
  await evaluate(`(()=>{const b=${button('Guardar cambios')};b.click();b.click();})()`);
  await until("document.body.textContent.includes('Browser updated admin') && !document.getElementById('Nombres')",'mutation updates rendered profile');
  assert.equal(requests.filter(r=>r.path==='/api/users/me/profile' && r.method==='PUT').length,1,'double click writes once');
  await cdp('Fetch.fulfillRequest',{requestId:pausedRead.requestId,responseCode:200,responseHeaders:[{name:'Content-Type',value:'application/json'}],body:pausedRead.base64Encoded?pausedRead.body:Buffer.from(pausedRead.body).toString('base64')});
  await cdp('Fetch.disable');await delay(500);
  assert(await evaluate("document.body.textContent.includes('Browser updated admin')"),'late response cannot undo update');
  await click('Editar');assert.equal(await evaluate("document.getElementById('Nombres').value"),'Browser updated');
  await cdp('Emulation.setDeviceMetricsOverride',{width:390,height:844,deviceScaleFactor:1,mobile:true});
  assert.equal(await evaluate("getComputedStyle(document.querySelector('nav[aria-label=\"Navegación de módulos\"]')).display !== 'none'"),true);
  await login('student');
  await navigate(`/admin/students/${PHASE5A_STUDENT}?tab=scheme`);
  await until("location.pathname==='/student'", 'student permission redirect');
  assert.equal(await evaluate(`Boolean(${button('Aprobar')})`),false);
  for (const [suffix,method,body] of [['comment','PATCH',{admin_notes:'Forbidden'}],['review','PUT',{status:'approved'}],['review','PUT',{status:'denied'}]]) {
    const result=await evaluate(`(async()=>{const csrf=await(await fetch('/api/auth/csrf')).json();return (await fetch('/api/admin/doses/${PHASE5A_DOSE}/${suffix}',{method:'${method}',headers:{'Content-Type':'application/json','X-CSRF-Token':csrf.token},body:JSON.stringify(${JSON.stringify(body)})})).status;})()`);
    assert.equal(result,403);
  }
  const listArtifacts=PHASE5B_ARTIFACT_DIR+'/../student-list';await mkdir(listArtifacts,{recursive:true});
  await writeFile(listArtifacts+'/measurements.json',JSON.stringify({stage:'verified-after',screen:'admin-student-list',viewport:320,statusMapping:{backend:'in_review',display:'Pendiente'},geometry:listGeometry},null,2)+'\n');
  console.log('PASS: real browser pagination/context/reload, write refresh/double-submit/delayed response, comment permissions and mobile navigation.');
} finally {
  ws.close();
}
