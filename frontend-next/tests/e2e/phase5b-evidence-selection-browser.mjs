// Actual Chrome -> Next production BFF -> FastAPI -> isolated PostgreSQL.
// No institutional data; file bytes and metadata remain local test fixtures.
import assert from 'node:assert/strict';
import { mkdir, writeFile } from 'node:fs/promises';
const { PHASE5A_CDP: endpoint, PHASE5A_WEB: web, PHASE5B_ARTIFACT_DIR: shared, PHASE5A_DOSE: dose } = process.env;
assert(shared && dose);
const artifacts = shared + '/../evidence-selection'; await mkdir(artifacts, { recursive: true });
const pages = await (await fetch(endpoint + '/json/list')).json();
const ws = new WebSocket(pages.find(p => p.type === 'page').webSocketDebuggerUrl);
await new Promise(resolve => ws.addEventListener('open', resolve, { once: true }));
let id=0, stage='real', writes=0;
const calls=new Map(), held=[], measurements=[], transportErrors=[];
ws.addEventListener('message',event=>{
 const message=JSON.parse(event.data),call=calls.get(message.id);
 if(call){calls.delete(message.id);if(message.error)call.reject(new Error(message.error.message));else call.resolve(message.result);}
 if(message.method==='Fetch.requestPaused'){
  const {requestId,request}=message.params; assert.equal(request.method,'POST'); writes++;
  if(stage==='hold')held.push(requestId);
  else if(stage==='503')cdp('Fetch.fulfillRequest',{requestId,responseCode:503,responseHeaders:[{name:'Content-Type',value:'application/json'},{name:'Cache-Control',value:'no-store'}],body:Buffer.from(JSON.stringify({code:'SYNTHETIC_FAILURE',message:'No se pudo cargar.',details:{}})).toString('base64')}).catch(()=>transportErrors.push('controlled response failed'));
  else cdp('Fetch.continueRequest',{requestId}).catch(()=>transportErrors.push('continue failed'));
 }
});
function cdp(method,params={}){return new Promise((resolve,reject)=>{const n=++id;calls.set(n,{resolve,reject});ws.send(JSON.stringify({id:n,method,params}));});}
async function evaluate(expression){const result=await cdp('Runtime.evaluate',{expression,awaitPromise:true,returnByValue:true});assert(!result.exceptionDetails,'Browser evaluation failed');return result.result.value;}
const delay=ms=>new Promise(r=>setTimeout(r,ms));
async function until(expression,label){for(let n=0;n<100;n++){if(await evaluate(`Boolean(${expression})`))return;await delay(100);}throw new Error('Timeout: '+label);}
async function key(key,code,virtualCode,text){await cdp('Input.dispatchKeyEvent',{type:'keyDown',key,code,windowsVirtualKeyCode:virtualCode});if(text)await cdp('Input.dispatchKeyEvent',{type:'char',key,code,windowsVirtualKeyCode:virtualCode,text,unmodifiedText:text});await cdp('Input.dispatchKeyEvent',{type:'keyUp',key,code,windowsVirtualKeyCode:virtualCode});}
async function input(selector,value,kind='HTMLInputElement'){await evaluate(`(()=>{const e=document.querySelector(${JSON.stringify(selector)});Object.getOwnPropertyDescriptor(${kind}.prototype,'value').set.call(e,${JSON.stringify(value)});e.dispatchEvent(new Event('input',{bubbles:true}));})()`);}
async function selectFiles(){await evaluate(`(()=>{const dt=new DataTransfer();for(const name of ['synthetic.pdf','synthetic-other.pdf'])dt.items.add(new File(['%PDF-1.4\\n%synthetic fixture\\n%%EOF'],name,{type:'application/pdf'}));const e=document.querySelector('input[type=file]');e.files=dt.files;e.dispatchEvent(new Event('change',{bubbles:true}));})()`);await until("document.querySelectorAll('main button[aria-label^=\"Quitar \" ]').length===2",'two selected');}
async function setDraft(){await input('#notes','Synthetic draft','HTMLTextAreaElement');await evaluate(`(()=>{const e=document.querySelector('#evidence-dose');e.value=${JSON.stringify(dose)};e.dispatchEvent(new Event('change',{bubbles:true}));})()`);}
async function snapshot(name){await evaluate('document.fonts.ready.then(()=>true)');await evaluate('scrollTo(0,0)');await delay(100);const clip=await evaluate("(()=>{const r=document.querySelector('input[type=file]').parentElement.parentElement.getBoundingClientRect();return{x:r.x+scrollX,y:r.y+scrollY,width:r.width,height:r.height,scale:1};})()");const r=await cdp('Page.captureScreenshot',{format:'png',captureBeyondViewport:true,clip});await writeFile(`${artifacts}/next-${name}.png`,Buffer.from(r.data,'base64'));}
async function save(){await writeFile(`${artifacts}/next-measurements.json`,JSON.stringify({institutional_data:false,production_ready:false,actual_backend:true,measurements},null,2)+'\n');}
async function submit(){await evaluate("(()=>{const b=[...document.querySelectorAll('main button')].find(b=>b.textContent.trim()==='Subir evidencia');b.click();b.click();})()");}
async function fresh(theme){stage='real';await evaluate(`localStorage.setItem('ic_theme',JSON.stringify({state:{mode:${JSON.stringify(theme)}}}))`);await cdp('Page.navigate',{url:web+'/student/evidence'});await until("document.querySelector('#evidence-dose')?.options.length>1&&document.querySelector('main h1')?.textContent==='Cargar evidencia'",'evidence page ready');}
try{
 await cdp('Page.enable');await cdp('Emulation.setDeviceMetricsOverride',{width:390,height:844,deviceScaleFactor:1,mobile:true});
 await cdp('Page.navigate',{url:web+'/login'});await until("document.querySelector('#email')&&Object.keys(document.querySelector('#email')).some(k=>k.startsWith('__reactProps'))",'hydrated login');
 await input('#email','student@example.com');await input('#password','SyntheticOnly123!');await evaluate("document.querySelector('button[type=submit]').focus()");await key('Enter','Enter',13,'\r');await until("location.pathname==='/student'",'student login');
 const forbidden=await evaluate("fetch('/api/admin/admins').then(r=>r.status)");assert.equal(forbidden,403);
 await cdp('Fetch.enable',{patterns:[{urlPattern:'*/api/evidence/upload',requestStage:'Request'}]});
 for(const theme of ['light','dark']){
  await fresh(theme);await selectFiles();await setDraft();await snapshot(`${theme}-selected-390`);
  // Enter removes one selected occurrence without issuing a POST.
  const before=writes;await evaluate("document.querySelector('main button[aria-label=\"Quitar synthetic-other.pdf\"]').focus()");await key('Enter','Enter',13,'\r');
  assert.equal(writes,before);assert.equal(await evaluate("document.querySelectorAll('main button[aria-label^=\"Quitar \" ]').length"),1);
  // Reselect same filenames; held request proves every form control stays frozen.
  await selectFiles();stage='hold';await submit();for(let n=0;n<100&&!held.length;n++)await delay(50);
  assert.equal(held.length,1);assert.equal(writes-before,1);
  assert(await evaluate("document.querySelector('input[type=file]').disabled&&document.querySelector('#notes').disabled&&document.querySelector('#evidence-dose').disabled&&[...document.querySelectorAll('main button[aria-label^=\"Quitar \" ]')].every(b=>b.disabled)&&[...document.querySelectorAll('main button')].find(b=>b.textContent.includes('Haz clic o arrastra')).disabled"));
  await snapshot(`${theme}-sending-390`);
  // Dropping a late selection during the held request cannot replace the draft.
  await evaluate("(()=>{const b=[...document.querySelectorAll('main button')].find(b=>b.textContent.includes('Haz clic o arrastra'));const dt=new DataTransfer();dt.items.add(new File(['%PDF-late'],'synthetic-late.pdf',{type:'application/pdf'}));b.dispatchEvent(new DragEvent('drop',{bubbles:true,dataTransfer:dt}));})()");
  assert(!await evaluate("document.querySelector('main').textContent.includes('synthetic-late.pdf')"));
  stage='real';await cdp('Fetch.continueRequest',{requestId:held.shift()});
  await until("!document.querySelector('#notes').disabled&&document.querySelector('#notes').value===''",'real upload confirmed');
  const saved=await evaluate(`fetch('/api/evidence/page?page=1&size=20').then(async r=>{if(r.status!==200)throw new Error('Read failed');const p=await r.json();const b=p.items.find(b=>b.notes==='Synthetic draft'&&b.dose_id===${JSON.stringify(dose)}&&b.files.length===2);return{found:Boolean(b),names:b?.files.map(f=>f.original_filename).sort(),page:p.page,page_size:p.page_size,total:p.total};})`);
  assert(saved.found);assert.deepEqual(saved.names,['synthetic-other.pdf','synthetic.pdf']);assert.equal(saved.page,1);assert.equal(saved.page_size,20);
  measurements.push({case:'confirmed_upload',theme,keyboard_remove:true,duplicate_submit_writes:writes-before,frozen_controls:true,late_drop_ignored:true,exact_files_and_dose_confirmed:true,page_size:20,admin_permission:forbidden});await save();
  // Controlled rejection preserves draft; explicit retry then reaches the real API.
  await selectFiles();await setDraft();stage='503';const failedBefore=writes;await submit();for(let n=0;n<100&&writes===failedBefore;n++)await delay(50);
  await until("!document.querySelector('#notes').disabled&&document.querySelector('#notes').value==='Synthetic draft'",'failed upload restores controls');
  assert.equal(writes-failedBefore,1);assert.equal(await evaluate("document.querySelectorAll('main button[aria-label^=\"Quitar \" ]').length"),2);assert.equal(await evaluate("document.querySelector('#evidence-dose').value"),dose);
  stage='real';await submit();await until("!document.querySelector('#notes').disabled&&document.querySelector('#notes').value===''",'explicit retry confirmed');assert.equal(writes-failedBefore,2);
  measurements.push({case:'controlled_failure_explicit_retry',theme,controlled_status:503,draft_preserved:true,explicit_retry_real:true,writes:writes-failedBefore});await save();
 }
 assert.equal(transportErrors.length,0);console.log('PASS: evidence selection, frozen payload, single real writes, failure preservation, explicit retry and actual student permissions');
}finally{await Promise.allSettled(held.splice(0).map(requestId=>cdp('Fetch.continueRequest',{requestId})));ws.close();}
