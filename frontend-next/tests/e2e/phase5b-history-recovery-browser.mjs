// Real Next production BFF/FastAPI/PostgreSQL. Synthetic audit fixtures only.
import assert from 'node:assert/strict';
import { mkdir,writeFile } from 'node:fs/promises';
const {PHASE5A_CDP:endpoint,PHASE5A_WEB:web,PHASE5B_ARTIFACT_DIR:shared}=process.env;
assert(shared);const artifacts=shared+'/../history-recovery';await mkdir(artifacts,{recursive:true});
const pages=await(await fetch(endpoint+'/json/list')).json();const ws=new WebSocket(pages.find(p=>p.type==='page').webSocketDebuggerUrl);
await new Promise(resolve=>ws.addEventListener('open',resolve,{once:true}));
let id=0,stage='real',reads=0;const pending=new Map(),held=[],measurements=[],transportErrors=[],documentPaths=[];
ws.addEventListener('message',event=>{
 const m=JSON.parse(event.data),call=pending.get(m.id);if(m.method==='Page.frameNavigated'&&!m.params.frame.parentId&&m.params.frame.url.startsWith(web))documentPaths.push(new URL(m.params.frame.url).pathname);if(call){pending.delete(m.id);if(m.error)call.reject(new Error(m.error.message));else call.resolve(m.result);}
 if(m.method==='Fetch.requestPaused'){
  const {requestId,request}=m.params;assert.equal(request.method,'GET');reads++;
  const path=new URL(request.url);assert(path.pathname==='/api/audit/me/page'||path.pathname==='/api/audit/admin/page');assert.equal(path.searchParams.get('page_size'),'20');
  if(stage==='hold')held.push(requestId);
  else if(stage==='real')cdp('Fetch.continueRequest',{requestId}).catch(()=>transportErrors.push('continue failed'));
  else cdp('Fetch.fulfillRequest',{requestId,responseCode:Number(stage),responseHeaders:[{name:'Content-Type',value:'application/json'},{name:'Cache-Control',value:'no-store'}],body:Buffer.from(JSON.stringify({code:'SYNTHETIC_FAILURE',message:'PRIVATE_DIAGNOSTIC',details:{}})).toString('base64')}).catch(()=>transportErrors.push('controlled response failed'));
 }
});
function cdp(method,params={}){return new Promise((resolve,reject)=>{const n=++id;pending.set(n,{resolve,reject});ws.send(JSON.stringify({id:n,method,params}));});}
async function evaluate(expression){const r=await cdp('Runtime.evaluate',{expression,awaitPromise:true,returnByValue:true});assert(!r.exceptionDetails,'Browser evaluation failed');return r.result.value;}
const delay=ms=>new Promise(r=>setTimeout(r,ms));
async function until(expression,label){for(let n=0;n<100;n++){if(await evaluate(`Boolean(${expression})`))return;await delay(100);}throw new Error('Timeout: '+label);}
async function input(selector,value){await evaluate(`(()=>{const e=document.querySelector(${JSON.stringify(selector)});Object.getOwnPropertyDescriptor(HTMLInputElement.prototype,'value').set.call(e,${JSON.stringify(value)});e.dispatchEvent(new Event('input',{bubbles:true}));})()`);}
async function key(){await cdp('Input.dispatchKeyEvent',{type:'keyDown',key:'Enter',code:'Enter',windowsVirtualKeyCode:13});await cdp('Input.dispatchKeyEvent',{type:'char',key:'Enter',code:'Enter',windowsVirtualKeyCode:13,text:'\r',unmodifiedText:'\r'});await cdp('Input.dispatchKeyEvent',{type:'keyUp',key:'Enter',code:'Enter',windowsVirtualKeyCode:13});}
async function click(label){await evaluate(`(()=>{const b=[...document.querySelectorAll('main button')].find(b=>b.textContent.trim()===${JSON.stringify(label)});if(!b)throw new Error('Missing action');b.focus();})()`);await key();}
async function login(role){stage='real';await cdp('Network.clearBrowserCookies');await cdp('Page.navigate',{url:web+'/login'});await until("document.querySelector('#email')&&Object.keys(document.querySelector('#email')).some(k=>k.startsWith('__reactProps'))",'hydrated login');await input('#email',role+'@example.com');await input('#password','SyntheticOnly123!');await evaluate("document.querySelector('button[type=submit]').focus()");await key();await until(`location.pathname===${JSON.stringify(role==='student'?'/student':'/admin')}`,'role dashboard');}
async function fresh(role,theme){stage='real';await evaluate(`localStorage.setItem('ic_theme',JSON.stringify({state:{mode:${JSON.stringify(theme)}}}))`);await cdp('Page.navigate',{url:web+(role==='student'?'/student':'/admin')+'/history?page=2'});await until("document.querySelector('main')?.textContent.includes('Página 2 de')&&document.querySelector('main')?.textContent.includes('Synthetic authorized history')",'authorized bounded history');}
async function capture(role,theme,status){await evaluate('document.fonts.ready.then(()=>true)');await evaluate('scrollTo(0,0)');const shot=await cdp('Page.captureScreenshot',{format:'png',captureBeyondViewport:false});await writeFile(`${artifacts}/next-${role}-get${status}-${theme}-390.png`,Buffer.from(shot.data,'base64'));}
async function save(){await writeFile(`${artifacts}/next-measurements.json`,JSON.stringify({institutional_data:false,production_ready:false,actual_backend:true,measurements},null,2)+'\n');}
try{
 await cdp('Page.enable');await cdp('Emulation.setDeviceMetricsOverride',{width:390,height:844,deviceScaleFactor:1,mobile:true});
 await cdp('Fetch.enable',{patterns:[{urlPattern:'*/api/audit/*/page*',requestStage:'Request'}]});
 for(const role of ['app_admin','student','admin']){
  await login(role);
  const permission=await evaluate("fetch('/api/audit/admin/page?page=1&page_size=20').then(r=>r.status)");assert.equal(permission,role==='student'?403:200);
  const visibility=await evaluate(`fetch('/api/audit/${role==='student'?'me':'admin'}/page?page=1&page_size=20').then(async r=>{const p=await r.json();return{status:r.status,size:p.page_size,own:p.items.some(e=>e.details?.notes==='Synthetic authorized history'),outside:p.items.some(e=>e.details?.notes==='Synthetic outside scope history')};})`);
  assert.equal(visibility.status,200);assert.equal(visibility.size,20);assert(visibility.own);assert.equal(visibility.outside,role==='app_admin');
  if(role==='app_admin'){
   assert(await evaluate("[...document.querySelectorAll('a')].some(a=>a.getAttribute('href')==='/admin/history'&&a.textContent.includes('Historial'))"),'history navigation is available');
   await fresh(role,'light');
   measurements.push({role,case:'authorized_history_route',api_status:permission,history_route_allowed:true,page:2,page_size:20,outside_visible:visibility.outside});await save();continue;
  }
  for(const theme of ['light','dark']){
   for(const status of [403,503]){
    await fresh(role,theme);stage=String(status);await click('Actualizar lista');await until("document.querySelector('main [role=alert] button')",'safe error');
    assert(!await evaluate("document.querySelector('main')?.textContent.includes('Synthetic authorized history')||document.querySelector('main')?.textContent.includes('No hay cambios registrados')||document.querySelector('main')?.textContent.includes('PRIVATE_DIAGNOSTIC')"));assert(!await evaluate("Boolean(document.querySelector('main nav[aria-label=\"Paginación\"]'))"));await capture(role,theme,status);
    const before=reads;stage='hold';await evaluate("(()=>{const b=document.querySelector('main [role=alert] button');b.click();b.click();})()");for(let n=0;n<100&&!held.length;n++)await delay(50);assert.equal(held.length,1);assert.equal(reads-before,1);assert(await evaluate("document.querySelector('main [role=alert] button').disabled"));stage='real';await cdp('Fetch.continueRequest',{requestId:held.shift()});
    await until("document.querySelector('main')?.textContent.includes('Synthetic authorized history')&&document.querySelector('main')?.textContent.includes('Página 2 de')",'recovered same page');assert.equal(await evaluate("new URLSearchParams(location.search).get('page')"),'2');
    measurements.push({role,theme,status,retry_gets:reads-before,page:2,page_size:20,cached_data_hidden:true,admin_status:permission,outside_visible:visibility.outside});await save();
   }
  }
  // Background refresh must lock page/refresh controls until the real GET returns.
  stage='hold';await click('Actualizar lista');for(let n=0;n<100&&!held.length;n++)await delay(50);assert.equal(held.length,1);await until("[...document.querySelectorAll('main nav[aria-label=\"Paginación\"] button')].every(b=>b.disabled)",'busy pager painted');assert(await evaluate("[...document.querySelectorAll('main nav[aria-label=\"Paginación\"] button')].every(b=>b.disabled)"));stage='real';await cdp('Fetch.continueRequest',{requestId:held.shift()});await until("[...document.querySelectorAll('main button')].some(b=>b.textContent.trim()==='Actualizar lista'&&!b.disabled)",'refresh completes');
 }
 stage='401';await evaluate("window.dispatchEvent(new Event('visibilitychange'))");await until("location.pathname==='/login'",'existing expiration');measurements.push({case:'expiration',controlled_status:401,protected_history_removed:true});await save();assert.equal(transportErrors.length,0);console.log('PASS: real history visibility by role, paginated recovery, one GET retry, busy pager and existing expiration');
}finally{await Promise.allSettled(held.splice(0).map(requestId=>cdp('Fetch.continueRequest',{requestId})));ws.close();}
