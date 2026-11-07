// Real local PostgreSQL; synthetic accounts. Controlled GET faults, real POST/DELETE.
import assert from 'node:assert/strict';
import { mkdir,writeFile } from 'node:fs/promises';
const {PHASE5A_CDP:endpoint,PHASE5A_WEB:web,PHASE5B_ARTIFACT_DIR:shared}=process.env;
assert(shared);const artifacts=shared+'/../admin-recovery';await mkdir(artifacts,{recursive:true});
const pages=await(await fetch(endpoint+'/json/list')).json();const ws=new WebSocket(pages.find(p=>p.type==='page').webSocketDebuggerUrl);
await new Promise(resolve=>ws.addEventListener('open',resolve,{once:true}));
let id=0,stage='real',reads=0,posts=0,deletes=0;const pending=new Map(),held=[],measurements=[],transportErrors=[],responseStatuses=[];
ws.addEventListener('message',event=>{
 const m=JSON.parse(event.data),call=pending.get(m.id);
 if(m.method==='Page.javascriptDialogOpening')cdp('Page.handleJavaScriptDialog',{accept:true}).catch(()=>transportErrors.push('dialog failed'));
 if(m.method==='Network.responseReceived'&&new URL(m.params.response.url).pathname.startsWith('/api/admin/admins'))responseStatuses.push(m.params.response.status);
 if(call){pending.delete(m.id);if(m.error)call.reject(new Error(m.error.message));else call.resolve(m.result);}
 if(m.method==='Fetch.requestPaused'){
  const {requestId,request}=m.params;assert(new URL(request.url).pathname.startsWith('/api/admin/admins'));
  if(request.method!=='GET'){
   if(request.method==='POST')posts++;else{assert.equal(request.method,'DELETE');deletes++;}
   cdp('Fetch.continueRequest',{requestId}).catch(()=>transportErrors.push('write failed'));return;
  }
  reads++;
  if(stage==='hold')held.push(requestId);
  else if(stage==='real')cdp('Fetch.continueRequest',{requestId}).catch(()=>transportErrors.push('read failed'));
  else cdp('Fetch.fulfillRequest',{requestId,responseCode:stage==='empty'?200:Number(stage),responseHeaders:[{name:'Content-Type',value:'application/json'},{name:'Cache-Control',value:'no-store'}],body:Buffer.from(JSON.stringify(stage==='empty'?[]:{code:'SYNTHETIC_FAILURE',message:'PRIVATE_DIAGNOSTIC',details:{}})).toString('base64')}).catch(()=>transportErrors.push('fault failed'));
 }
});
function cdp(method,params={}){return new Promise((resolve,reject)=>{const n=++id;pending.set(n,{resolve,reject});ws.send(JSON.stringify({id:n,method,params}));});}
async function evaluate(expression){const r=await cdp('Runtime.evaluate',{expression,awaitPromise:true,returnByValue:true});assert(!r.exceptionDetails,'Browser evaluation failed');return r.result.value;}
const delay=ms=>new Promise(r=>setTimeout(r,ms));
async function until(expression,label){for(let n=0;n<100;n++){if(await evaluate(`Boolean(${expression})`))return;await delay(100);}throw new Error('Timeout: '+label+'; response statuses='+responseStatuses.join(','));}
async function input(selector,value){await evaluate(`(()=>{const e=document.querySelector(${JSON.stringify(selector)});if(!e)throw new Error('Missing input selector');const proto=e.tagName==='SELECT'?HTMLSelectElement.prototype:e.tagName==='TEXTAREA'?HTMLTextAreaElement.prototype:HTMLInputElement.prototype;Object.getOwnPropertyDescriptor(proto,'value').set.call(e,${JSON.stringify(value)});e.dispatchEvent(new Event('input',{bubbles:true}));e.dispatchEvent(new Event('change',{bubbles:true}));})()`);}
async function key(){await cdp('Input.dispatchKeyEvent',{type:'keyDown',key:'Enter',code:'Enter',windowsVirtualKeyCode:13});await cdp('Input.dispatchKeyEvent',{type:'char',key:'Enter',code:'Enter',windowsVirtualKeyCode:13,text:'\r',unmodifiedText:'\r'});await cdp('Input.dispatchKeyEvent',{type:'keyUp',key:'Enter',code:'Enter',windowsVirtualKeyCode:13});}
async function click(label){await evaluate(`(()=>{const b=[...document.querySelectorAll('main button')].find(b=>b.textContent.trim()===${JSON.stringify(label)});if(!b)throw new Error('Missing action');b.focus();})()`);await key();}
async function login(role){await cdp('Network.clearBrowserCookies');await cdp('Page.navigate',{url:web+'/login'});await until("document.querySelector('#email')&&Object.keys(document.querySelector('#email')).some(k=>k.startsWith('__reactProps'))",'hydrated login');await input('#email',role+'@example.com');await input('#password','SyntheticOnly123!');await evaluate("document.querySelector('button[type=submit]').focus()");await key();await until(`location.pathname===${JSON.stringify(role==='student'?'/student':'/admin')}`,'role dashboard');}

async function field(label){await until(`Array.from(document.querySelectorAll('main label')).some(e=>e.textContent.trim()===${JSON.stringify(label)})`,'field '+label);return await evaluate(`(()=>{const l=[...document.querySelectorAll('main label')].find(e=>e.textContent.trim()===${JSON.stringify(label)});return l?'#'+CSS.escape(l.htmlFor):null;})()`);}
async function fill(label,value){await input(await field(label),value);}

async function open(theme){
 stage='real';await evaluate(`localStorage.setItem('ic_theme',JSON.stringify({state:{mode:${JSON.stringify(theme)}}}))`);await cdp('Page.navigate',{url:web+'/admin/admins'});
 await until("document.querySelector('main')?.textContent.includes('admin@example.com')",'authorized list');
}
async function capture(name){await evaluate('document.fonts.ready.then(()=>true)');await evaluate('scrollTo(0,0)');const shot=await cdp('Page.captureScreenshot',{format:'png',captureBeyondViewport:false});await writeFile(`${artifacts}/next-${name}-390.png`,Buffer.from(shot.data,'base64'));}
async function recovered(){await until("document.querySelector('main')?.textContent.includes('admin@example.com')&&!document.querySelector('main [role=alert]')",'read recovery');}
async function retryOne(){
 const before=reads,oldPosts=posts,oldDeletes=deletes;stage='hold';await evaluate("(()=>{const b=document.querySelector('main [role=alert] button');b.click();b.click();})()");
 for(let n=0;n<100&&!held.length;n++)await delay(50);assert.equal(held.length,1);assert.equal(reads-before,1);
 await until("document.querySelector('main [role=alert] button')?.disabled",'retry disabled');
 stage='real';await cdp('Fetch.continueRequest',{requestId:held.shift()});await recovered();assert.equal(posts,oldPosts);assert.equal(deletes,oldDeletes);
}
async function errorReady(){await until("document.querySelector('main [role=alert] button')",'safe read error');assert(!await evaluate("document.querySelector('main form')||document.querySelector('main table')||document.querySelector('main')?.textContent.includes('PRIVATE_DIAGNOSTIC')||[...document.querySelectorAll('main button')].some(b=>['Crear admin','Eliminar'].includes(b.textContent.trim()))"));}
async function save(){await writeFile(`${artifacts}/next-measurements.json`,JSON.stringify({institutional_data:false,production_ready:false,actual_backend:true,measurements},null,2)+'\n');}
try{
 await cdp('Page.enable');await cdp('Network.enable');await cdp('Emulation.setDeviceMetricsOverride',{width:390,height:844,deviceScaleFactor:1,mobile:true});
 await cdp('Fetch.enable',{patterns:[{urlPattern:'*/api/admin/admins*',requestStage:'Request'}]});await login('app_admin');
 for(const theme of ['light','dark']){
  await open(theme);
  for(const status of [403,503]){
   stage=String(status);await click('Actualizar lista');await errorReady();await capture(`get${status}-${theme}`);await retryOne();measurements.push({theme,case:'read_error',status,retry_gets:1,writes_on_retry:0});
  }
  stage='hold';await click('Actualizar lista');for(let n=0;n<100&&!held.length;n++)await delay(50);assert.equal(held.length,1);await until("[...document.querySelectorAll('main button')].filter(b=>['Actualizar lista','Crear admin','Eliminar'].includes(b.textContent.trim())).every(b=>b.disabled)",'busy read');stage='real';await cdp('Fetch.continueRequest',{requestId:held.shift()});await until("[...document.querySelectorAll('main button')].some(b=>b.textContent.trim()==='Crear admin'&&!b.disabled)",'busy clears');
  stage='empty';await click('Actualizar lista');await until("document.querySelector('main')?.textContent.includes('No hay administradores creados')",'successful empty');await capture(`empty-${theme}`);assert(!await evaluate("document.querySelector('main [role=alert]')"));stage='real';await click('Actualizar lista');await recovered();measurements.push({theme,case:'empty_success_and_busy',readable_empty:true,writes_blocked_while_fetching:true});
  await click('Crear admin');const email=`recovery-${theme}@example.com`;
  for(const [label,value]of [['Correo *',email],['Contraseña *','SyntheticOnly123!'],['Programa *','Enfermería'],['Campus *','Bogotá']])await fill(label,value);
  stage='503';let before=posts;await click('Crear');await until("document.querySelector('main [role=status]')?.textContent.includes('se creó')",'confirmed POST versus failed GET');await errorReady();assert.equal(posts-before,1);await capture(`created-read-failed-${theme}`);await retryOne();assert(await evaluate(`document.querySelector('main').textContent.includes(${JSON.stringify(email)})`));assert(!await evaluate("document.querySelector('main [role=status]')?.textContent.includes('se creó')"));measurements.push({theme,case:'confirmed_creation',real_posts:1,failed_read:503,retry_gets:1,writes_on_retry:0});
  stage='503';before=deletes;await evaluate(`(()=>{const r=[...document.querySelectorAll('main tr')].find(r=>r.textContent.includes(${JSON.stringify(email)}));const b=[...r.querySelectorAll('button')].find(b=>b.textContent.trim()==='Eliminar');if(!b)throw new Error('Missing delete action');b.focus();})()`);await key();
  await until("document.querySelector('main [role=status]')?.textContent.includes('se eliminó')",'confirmed DELETE versus failed GET');await errorReady();assert.equal(deletes-before,1);await capture(`removed-read-failed-${theme}`);await retryOne();assert(!await evaluate(`document.querySelector('main').textContent.includes(${JSON.stringify(email)})`));measurements.push({theme,case:'confirmed_removal',real_deletes:1,failed_read:503,retry_gets:1,writes_on_retry:0});await save();
 }
 stage='401';await click('Actualizar lista');await until("location.pathname==='/login'",'existing expiration');measurements.push({case:'existing_expiration',status:401});stage='real';
 for(const role of ['student','admin']){await login(role);const status=await evaluate("fetch('/api/admin/admins').then(r=>r.status)");assert.equal(status,403);measurements.push({role,case:'list_permission',status});}
 assert.equal(transportErrors.length,0);await save();console.log('PASS: real admin creation/removal, failed follow-up reads, one GET-only retry, empty/busy, permissions and existing expiration');
}finally{await Promise.allSettled(held.splice(0).map(requestId=>cdp('Fetch.continueRequest',{requestId})));ws.close();}
