// Production Next BFF + FastAPI + isolated PostgreSQL; synthetic fixtures only.
import assert from 'node:assert/strict';
import { mkdir, writeFile } from 'node:fs/promises';
const { PHASE5A_CDP: endpoint, PHASE5A_WEB: web, PHASE5B_ARTIFACT_DIR: shared, PHASE5A_DOSE: dose } = process.env;
assert(shared && dose);
const artifacts=shared+'/../evidence-recovery';await mkdir(artifacts,{recursive:true});
const pages=await(await fetch(endpoint+'/json/list')).json();
const ws=new WebSocket(pages.find(p=>p.type==='page').webSocketDebuggerUrl);
await new Promise(resolve=>ws.addEventListener('open',resolve,{once:true}));
let id=0,readStage='real',writeStage='real',reads=0,writes=0;
const calls=new Map(),held=[],measurements=[],transportErrors=[];
ws.addEventListener('message',event=>{
 const m=JSON.parse(event.data),call=calls.get(m.id);
 if(call){calls.delete(m.id);if(m.error)call.reject(new Error(m.error.message));else call.resolve(m.result);}
 if(m.method==='Fetch.requestPaused'){
  const {requestId,request}=m.params,read=request.method==='GET';
  if(read){reads++;assert.equal(new URL(request.url).pathname,'/api/evidence/page');}
  else{writes++;assert.equal(request.method,'POST');assert.equal(new URL(request.url).pathname,'/api/evidence/upload');}
  const stage=read?readStage:writeStage;
  if(stage==='hold'){assert(read);held.push(requestId);}
  else if(stage==='real')cdp('Fetch.continueRequest',{requestId}).catch(()=>transportErrors.push('continue failed'));
  else cdp('Fetch.fulfillRequest',{requestId,responseCode:Number(stage),responseHeaders:[{name:'Content-Type',value:'application/json'},{name:'Cache-Control',value:'no-store'}],body:Buffer.from(JSON.stringify({code:'SYNTHETIC_FAILURE',message:'PRIVATE_DIAGNOSTIC',details:{}})).toString('base64')}).catch(()=>transportErrors.push('controlled response failed'));
 }
});
function cdp(method,params={}){return new Promise((resolve,reject)=>{const n=++id;calls.set(n,{resolve,reject});ws.send(JSON.stringify({id:n,method,params}));});}
async function evaluate(expression){const result=await cdp('Runtime.evaluate',{expression,awaitPromise:true,returnByValue:true});assert(!result.exceptionDetails,'Browser evaluation failed');return result.result.value;}
const delay=ms=>new Promise(r=>setTimeout(r,ms));
async function until(expression,label){for(let n=0;n<100;n++){if(await evaluate(`Boolean(${expression})`))return;await delay(100);}throw new Error('Timeout: '+label);}
async function key(key,code,virtualCode,text){await cdp('Input.dispatchKeyEvent',{type:'keyDown',key,code,windowsVirtualKeyCode:virtualCode});if(text)await cdp('Input.dispatchKeyEvent',{type:'char',key,code,windowsVirtualKeyCode:virtualCode,text,unmodifiedText:text});await cdp('Input.dispatchKeyEvent',{type:'keyUp',key,code,windowsVirtualKeyCode:virtualCode});}
async function input(selector,value,kind='HTMLInputElement'){await evaluate(`(()=>{const e=document.querySelector(${JSON.stringify(selector)});Object.getOwnPropertyDescriptor(${kind}.prototype,'value').set.call(e,${JSON.stringify(value)});e.dispatchEvent(new Event('input',{bubbles:true}));})()`);}
const confirmed='Los documentos se subieron, pero no se pudo actualizar la lista.';
const unconfirmed='No se pudo confirmar la carga. Comprueba tus documentos antes de reintentar.';
async function snapshot(name){await evaluate('document.fonts.ready.then(()=>true)');await evaluate('scrollTo(0,0)');await delay(100);const r=await cdp('Page.captureScreenshot',{format:'png',captureBeyondViewport:false});await writeFile(`${artifacts}/next-${name}.png`,Buffer.from(r.data,'base64'));}
async function save(){await writeFile(`${artifacts}/next-measurements.json`,JSON.stringify({institutional_data:false,production_ready:false,actual_backend:true,measurements},null,2)+'\n');}
async function fresh(theme){readStage='real';writeStage='real';await evaluate(`localStorage.setItem('ic_theme',JSON.stringify({state:{mode:${JSON.stringify(theme)}}}))`);await cdp('Page.navigate',{url:web+'/student/evidence?page=2'});await until("document.querySelector('#evidence-dose')?.options.length>1&&document.querySelector('main').textContent.includes('Página 2 de')",'bounded second page ready');}
async function selectDraft(){await evaluate("(()=>{const dt=new DataTransfer();dt.items.add(new File(['%PDF-1.4 synthetic fixture'],'synthetic.pdf',{type:'application/pdf'}));const e=document.querySelector('input[type=file]');e.files=dt.files;e.dispatchEvent(new Event('change',{bubbles:true}));})()");await input('#notes','Synthetic recovery draft','HTMLTextAreaElement');await evaluate(`(()=>{const e=document.querySelector('#evidence-dose');e.value=${JSON.stringify(dose)};e.dispatchEvent(new Event('change',{bubbles:true}));})()`);}
async function submit(){await evaluate("(()=>{const b=[...document.querySelectorAll('main button')].find(b=>b.textContent.trim()==='Subir evidencia');b.click();b.click();})()");}
async function error(){await until("document.querySelector('main [role=alert] button')",'safe read failure');assert(!await evaluate("Boolean(document.querySelector('main input,main select,main textarea'))"));assert(!await evaluate("document.querySelector('main').textContent.includes('PRIVATE_DIAGNOSTIC')"));}
async function retry(){const before=reads;readStage='hold';await evaluate("(()=>{const b=document.querySelector('main [role=alert] button');b.click();b.click();})()");for(let n=0;n<100&&!held.length;n++)await delay(50);assert.equal(held.length,1);assert.equal(reads-before,1);assert(await evaluate("document.querySelector('main [role=alert] button').disabled"));readStage='real';await cdp('Fetch.continueRequest',{requestId:held.shift()});await until("document.querySelector('#notes')&&!document.querySelector('#notes').disabled&&document.querySelector('main').textContent.includes('Página 2 de')",'same page GET recovery');assert.equal(await evaluate("new URLSearchParams(location.search).get('page')"),'2');}
try{
 await cdp('Page.enable');await cdp('Emulation.setDeviceMetricsOverride',{width:390,height:844,deviceScaleFactor:1,mobile:true});await cdp('Page.navigate',{url:web+'/login'});
 await until("document.querySelector('#email')&&Object.keys(document.querySelector('#email')).some(k=>k.startsWith('__reactProps'))",'hydrated login');await input('#email','student@example.com');await input('#password','SyntheticOnly123!');await evaluate("document.querySelector('button[type=submit]').focus()");await key('Enter','Enter',13,'\r');await until("location.pathname==='/student'",'student login');
 const permission=await evaluate("fetch('/api/admin/admins').then(r=>r.status)");assert.equal(permission,403);
 await cdp('Fetch.enable',{patterns:[{urlPattern:'*/api/evidence/page*',requestStage:'Request'},{urlPattern:'*/api/evidence/upload',requestStage:'Request'}]});
 for(const theme of ['light','dark']){
  for(const status of [403,503]){
   await fresh(theme);await selectDraft();const before=writes;readStage=String(status);await submit();await until(`document.querySelector('main [role=status]')?.textContent===${JSON.stringify(confirmed)}`,'confirmed write and safe failed read');await error();assert.equal(writes-before,1);await snapshot(`confirmed-get${status}-${theme}-390`);
   await retry();assert.equal(writes-before,1);assert.equal(await evaluate("document.querySelector('#notes').value"),'');assert.equal(await evaluate("document.querySelectorAll('main button[aria-label^=\"Quitar \" ]').length"),0);
   const saved=await evaluate(`fetch('/api/evidence/page?page=1&size=20').then(async r=>{const p=await r.json();return r.status===200&&p.page_size===20&&p.items.some(b=>b.notes==='Synthetic recovery draft'&&b.dose_id===${JSON.stringify(dose)}&&b.files.some(f=>f.original_filename==='synthetic.pdf'));})`);assert(saved);
   measurements.push({case:'confirmed_post_failed_get',theme,status,writes:writes-before,retry_get_only:true,page:2,page_size:20,actual_upload_verified:true,admin_status:permission});await save();
  }
  await fresh(theme);await selectDraft();const before=writes;readStage='403';writeStage='503';await submit();await until(`document.querySelector('main [role=status]')?.textContent===${JSON.stringify(unconfirmed)}`,'unconfirmed write and failed read');await error();await snapshot(`failed-post-get403-${theme}-390`);assert.equal(writes-before,1);
  await retry();assert.equal(writes-before,1);assert.equal(await evaluate("document.querySelector('#notes').value"),'Synthetic recovery draft');assert.equal(await evaluate("document.querySelector('#evidence-dose').value"),dose);assert.equal(await evaluate("document.querySelectorAll('main button[aria-label^=\"Quitar \" ]').length"),1);
  writeStage='real';await submit();await until("document.querySelector('#notes')&&!document.querySelector('#notes').disabled&&document.querySelector('#notes').value===''",'explicit real upload succeeds');assert.equal(writes-before,2);
  measurements.push({case:'unconfirmed_post_failed_get',theme,controlled_post_status:503,controlled_get_status:403,draft_preserved:true,retry_get_only:true,explicit_upload_real:true,writes:writes-before});await save();
 }
 readStage='401';await evaluate("window.dispatchEvent(new Event('visibilitychange'))");await until("location.pathname==='/login'",'existing expiration removes protected content');assert(!await evaluate("Boolean(document.querySelector('main input,main textarea'))"));measurements.push({case:'expiration',controlled_get_status:401,protected_content_removed:true});await save();
 assert.equal(transportErrors.length,0);console.log('PASS: confirmed and unconfirmed evidence writes recover through GET only, actual permissions, retained context and existing session expiration');
}finally{await Promise.allSettled(held.splice(0).map(requestId=>cdp('Fetch.continueRequest',{requestId})));ws.close();}
