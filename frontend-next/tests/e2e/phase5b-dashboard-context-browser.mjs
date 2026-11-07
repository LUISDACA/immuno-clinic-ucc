// Synthetic PostgreSQL and real Next/FastAPI. No session values or PII exported.
import assert from 'node:assert/strict';
import { mkdir, readFile, writeFile } from 'node:fs/promises';
const {PHASE5A_CDP:cdpUrl,PHASE5A_WEB:web,PHASE5B_ARTIFACT_DIR:shared}=process.env;
assert(shared,'Explicit artifact directory required');
const artifacts=shared+'/../dashboard-context';await mkdir(artifacts,{recursive:true});
const fixture=JSON.parse(await readFile('../docs/ui/fixtures/phase5b-admin-dashboard.json','utf8'));
const pages=await (await fetch(cdpUrl+'/json/list')).json();
const ws=new WebSocket(pages.find(p=>p.type==='page').webSocketDebuggerUrl);
await new Promise(r=>ws.addEventListener('open',r,{once:true}));
let id=0,holdOld=false,unexpectedMutation=0;
const pending=new Map(),held=[],requests=[],transportErrors=[],results=[];
ws.addEventListener('message',event=>{
  const m=JSON.parse(event.data),call=pending.get(m.id);
  if(call){pending.delete(m.id);if(m.error)call.reject(new Error(m.error.message));else call.resolve(m.result);}
  if(m.method==='Fetch.requestPaused'){
    const request=m.params.request,semester=new URL(request.url).searchParams.get('semester');
    if(request.method!=='GET')unexpectedMutation++;
    requests.push(semester);
    if(holdOld&&semester==='1')held.push(m.params.requestId);
    else cdp('Fetch.continueRequest',{requestId:m.params.requestId}).catch(()=>transportErrors.push('continue failed'));
  }
});
function cdp(method,params={}){return new Promise((resolve,reject)=>{const n=++id;pending.set(n,{resolve,reject});ws.send(JSON.stringify({id:n,method,params}));});}
async function evaluate(expression){const r=await cdp('Runtime.evaluate',{expression,awaitPromise:true,returnByValue:true});assert(!r.exceptionDetails,'Browser evaluation failed');return r.result.value;}
async function until(expression,label){for(let n=0;n<100;n++){if(await evaluate(expression))return;await new Promise(r=>setTimeout(r,100));}throw new Error('Timeout: '+label);}
const pause=ms=>new Promise(r=>setTimeout(r,ms));
async function input(selector,value){await evaluate(`(()=>{const e=document.querySelector(${JSON.stringify(selector)});Object.getOwnPropertyDescriptor(HTMLInputElement.prototype,'value').set.call(e,${JSON.stringify(value)});e.dispatchEvent(new Event('input',{bubbles:true}));})()`);}
async function activate(selector){await evaluate(`document.querySelector(${JSON.stringify(selector)}).focus()`);await cdp('Input.dispatchKeyEvent',{type:'keyDown',key:'Enter',code:'Enter',windowsVirtualKeyCode:13});await cdp('Input.dispatchKeyEvent',{type:'char',key:'Enter',code:'Enter',text:'\r',windowsVirtualKeyCode:13});await cdp('Input.dispatchKeyEvent',{type:'keyUp',key:'Enter',code:'Enter',windowsVirtualKeyCode:13});}
async function login(role){
  await cdp('Network.clearBrowserCookies');await cdp('Page.navigate',{url:web+'/login'});
  await until("document.querySelector('#email')&&Object.keys(document.querySelector('#email')).some(k=>k.startsWith('__reactProps'))",'hydrated login');
  await input('#email',role+'@example.com');await input('#password','SyntheticOnly123!');await activate('button[type=submit]');
  await until(`location.pathname===${JSON.stringify(role==='student'?'/student':'/admin')}`,'synthetic role login');
}
async function ready(semester){
  await until(`document.querySelector('#semester')?.value===${JSON.stringify(semester)}&&document.querySelector('main section')?.getAttribute('aria-busy')==='false'`, 'semester '+(semester||'Todos')+' ready');
}
async function select(semester){
  await evaluate(`(()=>{const e=document.querySelector('#semester');e.value=${JSON.stringify(semester)};e.dispatchEvent(new Event('change',{bubbles:true}));})()`);
}
async function countersMatch(semester){
  const expected=await evaluate(`fetch('/api/admin/statistics${semester?'?semester='+semester:''}').then(r=>r.json())`);
  const counters=await evaluate("[...document.querySelectorAll('main span.uppercase')].map(e=>({label:e.textContent,value:Number(e.parentElement.lastElementChild.textContent)}))");
  for(const [label,value] of [['Totales',expected.total_students],['Activos',expected.active_students],['Desactivados',expected.inactive_students],['Esquema 100%',expected.vaccination_status.approved],['Pendientes',expected.vaccination_status.pending]])assert.equal(counters.find(c=>c.label===label)?.value,value,'real backend aggregate '+label);
}
try{
  await cdp('Page.enable');await cdp('Emulation.setDeviceMetricsOverride',{width:390,height:844,deviceScaleFactor:1,mobile:true});
  await login('admin');await ready('');
  await cdp('Fetch.enable',{patterns:[{urlPattern:'*/api/admin/statistics*',requestStage:'Request'}]});
  await cdp('Page.navigate',{url:web+'/admin?semester=3'});await ready('3');await countersMatch('3');
  results.push({case:'deep_link',semester:3,real_backend:true});
  await cdp('Page.reload');await ready('3');await countersMatch('3');results.push({case:'reload',semester:3,real_backend:true});
  const href=await evaluate("document.querySelector('main span.uppercase').closest('a').getAttribute('href')");assert.equal(href,'/admin/students?semester=3');
  await activate('main a[href="/admin/students?semester=3"]');await until("location.pathname==='/admin/students'&&location.search==='?semester=3'",'filtered list');
  await until("document.querySelector('#student-list-semester')?.value==='3'||[...document.querySelectorAll('select')].some(e=>e.value==='3')",'list reads semester');
  await evaluate('history.back()');await ready('3');await countersMatch('3');results.push({case:'list_and_back',semester:3,real_backend:true});
  await select('1');await ready('1');assert.equal(await evaluate('location.search'),'?semester=1');await countersMatch('1');
  await select('3');await ready('3');await evaluate('history.back()');await ready('1');await evaluate('history.forward()');await ready('3');await countersMatch('3');
  results.push({case:'filter_back_forward',semester:3,real_backend:true});
  await select('');await ready('');assert.equal(await evaluate('location.search'),'');await countersMatch('');results.push({case:'Todos',real_backend:true});
  holdOld=true;await select('1');await until("document.querySelector('#semester')?.value==='1'",'old selection');for(let n=0;n<100&&!held.length;n++)await pause(50);assert(held.length>0,'old statistics GET held');
  await select('3');await ready('3');await countersMatch('3');
  const oldPayload={...fixture.empty,total_students:777,active_students:777,vaccination_status:{approved:0,pending:777}};
  holdOld=false;await Promise.all(held.splice(0).map(requestId=>cdp('Fetch.fulfillRequest',{requestId,responseCode:200,responseHeaders:[{name:'Content-Type',value:'application/json'},{name:'Cache-Control',value:'no-store'}],body:Buffer.from(JSON.stringify(oldPayload)).toString('base64')})));
  await pause(250);await ready('3');await countersMatch('3');assert(!await evaluate("document.querySelector('main span.uppercase').parentElement.textContent.includes('777')"),'late prior response cannot overwrite current semester');
  results.push({case:'late_previous_response',semester:3,controlled_old_response:true,current_real_backend:true});
  await cdp('Fetch.disable');await login('app_admin');await cdp('Page.navigate',{url:web+'/admin?semester=3'});
  await until("document.querySelector('main')?.textContent.includes('Vacunas al dia vs pendientes')",'global dashboard');
  assert(!await evaluate("Boolean(document.querySelector('#semester'))"),'app_admin remains global');assert.equal(await evaluate("fetch('/api/admin/admins').then(r=>r.status)"),200,'app_admin authority');
  results.push({case:'app_admin_global',real_backend:true});
  await login('student');await cdp('Page.navigate',{url:web+'/admin?semester=3'});await until("location.pathname==='/student'",'student redirected by existing auth gate');
  assert.equal(await evaluate("fetch('/api/admin/statistics?semester=3').then(r=>r.status)"),403,'student denied by actual backend');assert(!await evaluate("Boolean(document.querySelector('#semester'))"),'student has no admin filter');
  results.push({case:'student_denied',http_status:403,real_backend:true});
  assert.equal(unexpectedMutation,0,'statistics requests remain GET');assert.equal(transportErrors.length,0,'transport');
  await writeFile(artifacts+'/results.json',JSON.stringify({institutional_data:false,production_ready:false,results,requested_semesters:requests,unexpected_mutations:unexpectedMutation},null,2)+'\n');
  console.log('PASS: dashboard URL, deep link, reload, list/back, history, Todos, late response and role permissions');
}finally{await Promise.allSettled(held.splice(0).map(requestId=>cdp('Fetch.continueRequest',{requestId})));ws.close();}
