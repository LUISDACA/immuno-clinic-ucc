// Controlled read failures and real confirmed writes. Only local synthetic users.
import assert from 'node:assert/strict';
import { mkdir, writeFile } from 'node:fs/promises';
const { PHASE5A_CDP: endpoint, PHASE5A_WEB: web, PHASE5B_ARTIFACT_DIR: shared } = process.env;
assert(shared, 'Explicit artifact directory required');
const artifacts = shared + '/../profile-recovery'; await mkdir(artifacts, { recursive: true });
const pages = await (await fetch(endpoint + '/json/list')).json();
const ws = new WebSocket(pages.find(p => p.type === 'page').webSocketDebuggerUrl);
await new Promise(resolve => ws.addEventListener('open', resolve, { once: true }));
let id=0, readStage='real', putStage='real', readCount=0, putCount=0, restorationReads=0;
const pending=new Map(), heldReads=[], transportErrors=[], measurements=[];
ws.addEventListener('message',event=>{
 const m=JSON.parse(event.data),call=pending.get(m.id);
 if(call){pending.delete(m.id);if(m.error)call.reject(new Error(m.error.message));else call.resolve(m.result);}
 if(m.method==='Fetch.requestPaused'){
  const {requestId,request}=m.params,read=request.method==='GET';
  if(read)readCount++;else{putCount++;assert.equal(request.method,'PUT');assert.equal(new URL(request.url).pathname,'/api/users/me/profile');assert.deepEqual(Object.keys(JSON.parse(request.postData)).sort(),['emergency_contact_name','emergency_contact_phone','eps_affiliation','phone']);}
  const stage=read?(restorationReads-->0?'real':readStage):putStage;
  if(stage==='hold'){assert(read);heldReads.push(requestId);}
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
async function fresh(theme){readStage='real';putStage='real';restorationReads=1;await evaluate(`localStorage.setItem('ic_theme',JSON.stringify({state:{mode:${JSON.stringify(theme)}}}))`);await cdp('Page.navigate',{url:web+'/student/profile'});await until("document.querySelector('main h1')?.textContent==='Mi perfil'",'profile ready');}
async function draft(value){await button('Editar');await evaluate(`(()=>{const e=[...document.querySelectorAll('main label')].find(l=>l.textContent==='Teléfono').control;Object.getOwnPropertyDescriptor(HTMLInputElement.prototype,'value').set.call(e,${JSON.stringify(value)});e.dispatchEvent(new Event('input',{bubbles:true}));})()`);}
async function queryError(){await until("document.querySelector('main [role=alert] button')",'query failure');assert(!await evaluate("document.querySelector('main input')||[...document.querySelectorAll('main button')].some(b=>b.textContent.trim()==='Editar')"),'error hides data/actions');assert(!await evaluate("document.querySelector('main').textContent.includes('PRIVATE_DIAGNOSTIC')"));}
async function retry(){const before=readCount;readStage='hold';await evaluate("(()=>{const b=document.querySelector('main [role=alert] button');b.click();b.click();})()");for(let n=0;n<100&&!heldReads.length;n++)await pause(50);assert.equal(heldReads.length,1);assert.equal(readCount-before,1);assert(await evaluate("document.querySelector('main [role=alert] button').disabled"));readStage='real';await Promise.all(heldReads.splice(0).map(requestId=>cdp('Fetch.continueRequest',{requestId})));}
async function submit(){await evaluate("(()=>{const b=[...document.querySelectorAll('main button')].find(b=>b.textContent.trim()==='Guardar cambios');b.scrollIntoView({block:'center'});b.click();b.click();})()");}
try{
 await cdp('Page.enable');await cdp('Emulation.setDeviceMetricsOverride',{width:390,height:844,deviceScaleFactor:1,mobile:true});
 await cdp('Page.navigate',{url:web+'/login'});await until("document.querySelector('#email')&&Object.keys(document.querySelector('#email')).some(k=>k.startsWith('__reactProps'))",'hydrated login');
 await input('#email','student@example.com');await input('#password','SyntheticOnly123!');await activate('button[type=submit]');await until("location.pathname==='/student'",'student login');
 assert.equal(await evaluate("fetch('/api/admin/admins').then(r=>r.status)"),403);
 await cdp('Fetch.enable',{patterns:[{urlPattern:'*/api/users/me*',requestStage:'Request'}]});
 for(const theme of ['light','dark']){
  for(const status of [403,503]){
   await fresh(theme);await draft('0000000004');const writesBefore=putCount;
   readStage=String(status);await evaluate("window.dispatchEvent(new Event('visibilitychange'))");await queryError();
   await snapshot(`draft-get${status}-${theme}-390`);await retry();await until("document.querySelector('main input')",'edit restored');
   assert.equal(await evaluate("[...document.querySelectorAll('main label')].find(l=>l.textContent==='Teléfono').control.value"),'0000000004');assert.equal(putCount,writesBefore);
   measurements.push({case:'draft_get_error',theme,status,draft_restored:true,retry_writes:0});await save();
   await fresh(theme);await draft('0000000005');const before=putCount;
   readStage=String(status);await submit();await until(`document.querySelector('main [role=status]')?.textContent===${JSON.stringify(confirmed)}`,'confirmed write/read failure');await queryError();
   assert.equal(putCount-before,1);await snapshot(`saved-get${status}-${theme}-390`);
   await retry();await until("document.querySelector('main h1')?.textContent==='Mi perfil'&&[...document.querySelectorAll('main button')].some(b=>b.textContent.trim()==='Editar')",'confirmed view recovered');
   assert.equal(putCount-before,1);assert(await evaluate("document.querySelector('main').textContent.includes('0000000005')"));
   measurements.push({case:'confirmed_put_failed_get',theme,status,writes:putCount-before,real_backend_recovery:true});await save();
  }
  await fresh(theme);await draft('0000000006');const before=putCount;putStage='503';readStage='403';await submit();await queryError();await until("document.querySelector('main [role=status]')?.textContent.includes('No se pudo guardar')",'write failure visible');
  await snapshot(`failed-put-get403-${theme}-390`);await retry();await until("document.querySelector('main input')",'failed write draft restored');
  assert.equal(await evaluate("[...document.querySelectorAll('main label')].find(l=>l.textContent==='Teléfono').control.value"),'0000000006');assert.equal(putCount-before,1);
  putStage='real';await submit();await until("[...document.querySelectorAll('main button')].some(b=>b.textContent.trim()==='Editar')&&document.querySelector('main').textContent.includes('0000000006')",'explicit write succeeds');assert.equal(putCount-before,2);
  measurements.push({case:'failed_put_failed_get',theme,first_write_controlled:true,explicit_retry_confirmed:true,writes:putCount-before});await save();
 }
 readStage='401';await evaluate("window.dispatchEvent(new Event('visibilitychange'))");await until("location.pathname==='/login'",'existing session expiration');assert(!await evaluate("Boolean(document.querySelector('main input'))"));
 measurements.push({case:'expiration',controlled_status:401,protected_content_removed:true,actual_admin_status:403});await save();assert.equal(transportErrors.length,0);
 console.log('PASS: drafts and confirmed/failed writes survive read errors without replaying PUT, actual permissions and existing expiry');
}finally{await Promise.allSettled(heldReads.splice(0).map(requestId=>cdp('Fetch.continueRequest',{requestId})));ws.close();}
