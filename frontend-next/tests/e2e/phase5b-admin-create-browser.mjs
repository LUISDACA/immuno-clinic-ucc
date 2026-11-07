// Synthetic accounts; real webpack/BFF/FastAPI/PostgreSQL. No institutional data.
import assert from 'node:assert/strict';
import { mkdir,writeFile } from 'node:fs/promises';
const {PHASE5A_CDP:endpoint,PHASE5A_WEB:web,PHASE5B_ARTIFACT_DIR:shared}=process.env;
assert(shared);const artifacts=shared+'/../admin-create';await mkdir(artifacts,{recursive:true});
const pages=await(await fetch(endpoint+'/json/list')).json();const ws=new WebSocket(pages.find(p=>p.type==='page').webSocketDebuggerUrl);
await new Promise(resolve=>ws.addEventListener('open',resolve,{once:true}));
let id=0,hold=false,writes=0,reads=0;const pending=new Map(),held=[],measurements=[],transportErrors=[],responseStatuses=[];
ws.addEventListener('message',event=>{
 const m=JSON.parse(event.data),call=pending.get(m.id);if(m.method==='Network.responseReceived'&&new URL(m.params.response.url).pathname==='/api/admin/admins')responseStatuses.push(m.params.response.status);if(call){pending.delete(m.id);if(m.error)call.reject(new Error(m.error.message));else call.resolve(m.result);}
 if(m.method==='Fetch.requestPaused'){
  const {requestId,request}=m.params;assert.equal(new URL(request.url).pathname,'/api/admin/admins');
  if(request.method==='GET')reads++;else{assert.equal(request.method,'POST');writes++;}
  if(request.method==='POST'&&hold)held.push(requestId);
  else cdp('Fetch.continueRequest',{requestId}).catch(()=>transportErrors.push('continue failed'));
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
 await evaluate(`localStorage.setItem('ic_theme',JSON.stringify({state:{mode:${JSON.stringify(theme)}}}))`);
 await cdp('Page.navigate',{url:web+'/admin/admins'});
 await until("document.querySelector('main')?.textContent.includes('admin@example.com')&&[...document.querySelectorAll('main button')].some(b=>b.textContent.trim()==='Crear admin')",'admin list ready');
 await click('Crear admin');await until("document.querySelector('main form')",'creation form');
}
async function capture(name){await evaluate('document.fonts.ready.then(()=>true)');await evaluate('scrollTo(0,0)');const shot=await cdp('Page.captureScreenshot',{format:'png',captureBeyondViewport:false});await writeFile(`${artifacts}/next-${name}-390.png`,Buffer.from(shot.data,'base64'));}
async function save(){await writeFile(`${artifacts}/next-measurements.json`,JSON.stringify({institutional_data:false,production_ready:false,actual_backend:true,measurements},null,2)+'\n');}
try{
 await cdp('Page.enable');await cdp('Network.enable');await cdp('Emulation.setDeviceMetricsOverride',{width:390,height:844,deviceScaleFactor:1,mobile:true});
 await cdp('Fetch.enable',{patterns:[{urlPattern:'*/api/admin/admins',requestStage:'Request'}]});
 await login('app_admin');
 for(const theme of ['light','dark']){
  await open(theme);assert(await evaluate('document.documentElement.scrollWidth<=innerWidth'));await capture('form-'+theme);
  const before=writes;await click('Crear');await delay(200);assert.equal(writes,before);assert(!await evaluate("document.querySelector('main form').checkValidity()"));
  measurements.push({case:'required',theme,post_count:0});
 }
 await fill('Correo *','invalid');await fill('Programa *','Enfermería');await fill('Campus *','Bogotá');await fill('Contraseña *','SyntheticOnly123!');
 let before=writes;await click('Crear');await delay(200);assert.equal(writes,before);assert(await evaluate(`document.querySelector(${JSON.stringify(await field('Correo *'))}).validity.typeMismatch`));
 measurements.push({case:'malformed_email',post_count:0});
 await fill('Correo *','created-admin@example.com');
 // Trusted insertText triggers browser minLength validation; a JS value setter alone does not.
 const passwordSelector=await field('Contraseña *');await input(passwordSelector,'');await evaluate(`document.querySelector(${JSON.stringify(passwordSelector)}).focus()`);await cdp('Input.insertText',{text:'short'});
 before=writes;await click('Crear');await delay(200);assert.equal(writes,before);assert(await evaluate(`document.querySelector(${JSON.stringify(passwordSelector)}).validity.tooShort`));
 measurements.push({case:'short_password',post_count:0});
 await fill('Contraseña *','SyntheticOnly123!');
 for(const label of ['Nombres','Apellidos','Cargo']){await fill(label,'Temporary');await fill(label,'');}
 const beforeReads=reads;hold=true;before=writes;await evaluate("(()=>{const f=document.querySelector('main form');f.requestSubmit();f.requestSubmit();})()");
 for(let n=0;n<100&&!held.length;n++)await delay(50);assert.equal(held.length,1);assert.equal(writes-before,1);
 await until("[...document.querySelectorAll('main form input')].every(e=>e.matches(':disabled'))",'frozen form');
 assert(await evaluate("[...document.querySelectorAll('main button')].filter(b=>['Cancelar','Eliminar'].includes(b.textContent.trim())).every(b=>b.disabled)"));
 await capture('pending-dark');
 hold=false;await cdp('Fetch.continueRequest',{requestId:held.shift()});
 await until("!document.querySelector('main form')&&document.querySelector('main')?.textContent.includes('created-admin@example.com')",'real creation and refreshed list');
 assert.equal(writes-before,1);assert.equal(reads-beforeReads,1);await capture('success-dark');
 await click('Crear admin');assert.equal(await evaluate(`document.querySelector(${JSON.stringify(await field('Contraseña *'))}).value`),'');
 measurements.push({case:'creation',role:'app_admin',posts:1,list_refreshes:1,fields_frozen:true,optional_blank_names_omitted:true,password_cleared:true});
 for(const role of ['student','admin']){
  await login(role);
  const status=await evaluate("(async()=>{const csrf=await fetch('/api/auth/csrf').then(r=>r.json());return (await fetch('/api/admin/admins',{method:'POST',headers:{'Content-Type':'application/json','X-CSRF-Token':csrf.token},body:JSON.stringify({email:'forbidden-admin@example.com',password:'SyntheticOnly123!',program:'Enfermería',campus:'Bogotá'})})).status;})()");
  assert.equal(status,403);measurements.push({case:'creation_permission',role,status});
 }
 assert.equal(transportErrors.length,0);await save();console.log('PASS: native validation, immutable pending form, single POST/GET refresh, optional names and real role permissions');
}finally{await Promise.allSettled(held.splice(0).map(requestId=>cdp('Fetch.continueRequest',{requestId})));ws.close();}
