// Controlled read failures and real confirmed writes. Only local synthetic users.
import assert from 'node:assert/strict';
import { mkdir, writeFile } from 'node:fs/promises';
const { PHASE5A_CDP: endpoint, PHASE5A_WEB: web, PHASE5B_ARTIFACT_DIR: shared } = process.env;
assert(shared, 'Explicit artifact directory required');
const artifacts = shared + '/../admin-profile'; await mkdir(artifacts, { recursive: true });
const pages = await (await fetch(endpoint + '/json/list')).json();
const ws = new WebSocket(pages.find(p => p.type === 'page').webSocketDebuggerUrl);
await new Promise(resolve => ws.addEventListener('open', resolve, { once: true }));
let id=0, readStage='real', putStage='real', readCount=0, putCount=0, restorationReads=0;
const pending=new Map(), heldReads=[], heldWrites=[], transportErrors=[], measurements=[];
ws.addEventListener('message',event=>{
 const m=JSON.parse(event.data),call=pending.get(m.id);
 if(call){pending.delete(m.id);if(m.error)call.reject(new Error(m.error.message));else call.resolve(m.result);}
 if(m.method==='Fetch.requestPaused'){
  const {requestId,request}=m.params,read=request.method==='GET';
  if(read)readCount++;else{putCount++;assert.equal(request.method,'PUT');assert.equal(new URL(request.url).pathname,'/api/users/me/profile');assert.deepEqual(Object.keys(JSON.parse(request.postData)).sort(),['first_name','job_title','last_name']);}
  const stage=read?(restorationReads-->0?'real':readStage):putStage;
  if(stage==='hold'){(read?heldReads:heldWrites).push(requestId);}
  else if(stage==='real')cdp('Fetch.continueRequest',{requestId}).catch(()=>transportErrors.push('continue failed'));
  else cdp('Fetch.fulfillRequest',{requestId,responseCode:Number(stage),responseHeaders:[{name:'Content-Type',value:'application/json'},{name:'Cache-Control',value:'no-store'}],body:Buffer.from(JSON.stringify({code:'SYNTHETIC_FAILURE',message:'PRIVATE_DIAGNOSTIC',details:{}})).toString('base64')}).catch(()=>transportErrors.push('controlled response failed'));
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
const confirmed='Los cambios se guardaron, pero no se pudo actualizar el perfil.';
async function snapshot(name){await evaluate('document.fonts.ready.then(()=>true)');const r=await cdp('Page.captureScreenshot',{format:'png',captureBeyondViewport:false});await writeFile(`${artifacts}/next-${name}.png`,Buffer.from(r.data,'base64'));}
async function save(){await writeFile(`${artifacts}/next-measurements.json`,JSON.stringify({institutional_data:false,production_ready:false,measurements},null,2)+'\n');}
async function button(label){await evaluate(`(()=>{const b=[...document.querySelectorAll('main button')].find(b=>b.textContent.trim()===${JSON.stringify(label)});if(!b)throw new Error('Missing action');b.scrollIntoView({block:'center'});b.focus();})()`);await key('Enter','Enter',13,'\r');}
async function fresh(theme){readStage='real';putStage='real';restorationReads=1;await evaluate(`localStorage.setItem('ic_theme',JSON.stringify({state:{mode:${JSON.stringify(theme)}}}))`);await cdp('Page.navigate',{url:web+'/admin/profile'});await until("document.querySelector('main h1')?.textContent==='Mi perfil'",'profile ready');assert(await evaluate("document.querySelector('header')?.parentElement.classList.contains('z-0')"),'profile above decoration');}
async function draft(value){await button('Editar');await evaluate(`(()=>{const e=[...document.querySelectorAll('main label')].find(l=>l.textContent==='Cargo').control;Object.getOwnPropertyDescriptor(HTMLInputElement.prototype,'value').set.call(e,${JSON.stringify(value)});e.dispatchEvent(new Event('input',{bubbles:true}));})()`);}
async function queryError(){await until("document.querySelector('main [role=alert] button')",'query failure');assert(!await evaluate("document.querySelector('main input')||[...document.querySelectorAll('main button')].some(b=>b.textContent.trim()==='Editar')"),'error hides data/actions');assert(!await evaluate("document.querySelector('main').textContent.includes('PRIVATE_DIAGNOSTIC')"));}
async function retry(){const before=readCount;readStage='hold';await evaluate("(()=>{const b=document.querySelector('main [role=alert] button');b.click();b.click();})()");for(let n=0;n<100&&!heldReads.length;n++)await pause(50);assert.equal(heldReads.length,1);assert.equal(readCount-before,1);assert(await evaluate("document.querySelector('main [role=alert] button').disabled"));readStage='real';await Promise.all(heldReads.splice(0).map(requestId=>cdp('Fetch.continueRequest',{requestId})));}
async function submit(){await evaluate("(()=>{const b=[...document.querySelectorAll('main button')].find(b=>b.textContent.trim()==='Guardar cambios');b.scrollIntoView({block:'center'});b.click();b.click();})()");}

async function login(role){await cdp('Fetch.disable');readStage='real';putStage='real';restorationReads=0;await cdp('Network.clearBrowserCookies');await cdp('Page.navigate',{url:web+'/login'});await until("document.querySelector('#email')&&Object.keys(document.querySelector('#email')).some(k=>k.startsWith('__reactProps'))",'hydrated login');await input('#email',role+'@example.com');await input('#password','SyntheticOnly123!');await activate('button[type=submit]');await until("location.pathname==='/admin'",'admin login');}
async function draftValue(){return evaluate("[...document.querySelectorAll('main label')].find(l=>l.textContent==='Cargo').control.value");}
async function waitWrite(){for(let n=0;n<100&&!heldWrites.length;n++)await pause(50);assert.equal(heldWrites.length,1);}
try{
 await cdp('Page.enable');await cdp('Emulation.setDeviceMetricsOverride',{width:390,height:844,deviceScaleFactor:1,mobile:true});
 for(const role of ['admin','app_admin']){
  await login(role);
  if(role==='admin'){
   const status=await evaluate("(async()=>{const csrf=await fetch('/api/auth/csrf').then(r=>r.json());return(await fetch('/api/users/me/profile',{method:'PUT',headers:{'Content-Type':'application/json','X-CSRF-Token':csrf.token},body:JSON.stringify({program:'Enfermería',campus:'Cali'})})).status;})()");assert.equal(status,403);measurements.push({case:'administrative_scope',role,status,actual_backend:true});
  }
  await cdp('Fetch.enable',{patterns:[{urlPattern:'*/api/users/me*',requestStage:'Request'}]});
  for(const theme of ['light','dark']){
   await fresh(theme);await draft('Cargo actualizado');const before=putCount;readStage='503';putStage='hold';await submit();await waitWrite();assert.equal(putCount-before,1);await until("[...document.querySelectorAll('main form input,main form button')].every(e=>e.disabled)",'frozen base form');putStage='real';await cdp('Fetch.continueRequest',{requestId:heldWrites.shift()});await until(`document.querySelector('main [role=status]')?.textContent===${JSON.stringify(confirmed)}`,'committed write/read failure');await queryError();assert(!await evaluate("document.querySelector('main input[type=file]')"),'signature view unmounts as before');await snapshot(`${role}-saved-get503-${theme}-390`);await retry();await until("document.querySelector('main h1')?.textContent==='Mi perfil'&&[...document.querySelectorAll('main button')].some(b=>b.textContent.trim()==='Editar')",'confirmed read recovery');assert.equal(putCount-before,1);assert(await evaluate("document.querySelector('main').textContent.includes('Cargo actualizado')"));measurements.push({case:'confirmed_put_failed_get',role,theme,writes:1,real_postgresql_write:true,retry_get_only:true});await save();
  }
  await fresh('light');await draft('Borrador retenido');let before=putCount;readStage='403';await evaluate("window.dispatchEvent(new Event('visibilitychange'))");await queryError();await retry();await until("document.querySelector('main form input')",'draft recovery');assert.equal(await draftValue(),'Borrador retenido');assert.equal(putCount,before);measurements.push({case:'draft_get_error',role,draft_restored:true,retry_writes:0});
  await fresh('light');await draft('Reintento explicito');before=putCount;putStage='503';readStage='403';await submit();await queryError();await until("document.querySelector('main [role=status]')?.textContent.includes('No se pudo guardar')",'failed write distinct');await retry();await until("document.querySelector('main form input')",'failed-write draft recovery');assert.equal(await draftValue(),'Reintento explicito');assert.equal(putCount-before,1);putStage='real';await submit();await until("[...document.querySelectorAll('main button')].some(b=>b.textContent.trim()==='Editar')&&document.querySelector('main').textContent.includes('Reintento explicito')",'explicit real write');assert.equal(putCount-before,2);measurements.push({case:'failed_put_failed_get',role,first_write_controlled_503:true,explicit_retry_postgresql:true,writes:2});await save();
  readStage='401';await evaluate("window.dispatchEvent(new Event('visibilitychange'))");await until("location.pathname==='/login'",'existing session expiry');measurements.push({case:'expiration',role,controlled_status:401,protected_content_removed:true});await save();
 }
 assert.equal(transportErrors.length,0);console.log('PASS: admin/app_admin drafts, confirmed writes and GET-only recovery; actual scope permission unchanged');
}finally{await Promise.allSettled([...heldReads.splice(0),...heldWrites.splice(0)].map(requestId=>cdp('Fetch.failRequest',{requestId,errorReason:'Aborted'})));ws.close();}
