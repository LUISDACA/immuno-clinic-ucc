// Real webpack/BFF/login/PostgreSQL; form errors explicitly controlled, never real resets/mail.
import assert from 'node:assert/strict';
import {mkdir,writeFile} from 'node:fs/promises';
const {PHASE5A_CDP:endpoint,PHASE5A_WEB:web,PHASE5B_ARTIFACT_DIR:shared}=process.env;
assert(shared);const artifacts=shared+'/../account-forms';await mkdir(artifacts,{recursive:true});
const pages=await(await fetch(endpoint+'/json/list')).json();const ws=new WebSocket(pages.find(p=>p.type==='page').webSocketDebuggerUrl);
await new Promise(resolve=>ws.addEventListener('open',resolve,{once:true}));
let id=0,status=503,requests=0;const pending=new Map(),held=[],measurements=[],transportErrors=[],responseStatuses=[];
ws.addEventListener('message',event=>{
 const m=JSON.parse(event.data),call=pending.get(m.id);if(call){pending.delete(m.id);if(m.error)call.reject(new Error(m.error.message));else call.resolve(m.result);}
 if(m.method==='Fetch.requestPaused'){
  const {requestId,request}=m.params;assert.equal(request.method,'POST');const path=new URL(request.url).pathname;assert(['/api/auth/forgot-password','/api/auth/reset-password','/api/auth/change-password'].includes(path));requests++;held.push(requestId);
 }
});
function cdp(method,params={}){return new Promise((resolve,reject)=>{const n=++id;pending.set(n,{resolve,reject});ws.send(JSON.stringify({id:n,method,params}));});}
async function evaluate(expression){const r=await cdp('Runtime.evaluate',{expression,awaitPromise:true,returnByValue:true});assert(!r.exceptionDetails,'Browser evaluation failed');return r.result.value;}
const delay=ms=>new Promise(r=>setTimeout(r,ms));
async function until(expression,label){for(let n=0;n<100;n++){if(await evaluate(`Boolean(${expression})`))return;await delay(100);}throw new Error('Timeout: '+label+'; response statuses='+responseStatuses.join(','));}
async function input(selector,value){await evaluate(`(()=>{const e=document.querySelector(${JSON.stringify(selector)});Object.getOwnPropertyDescriptor(HTMLInputElement.prototype,'value').set.call(e,${JSON.stringify(value)});e.dispatchEvent(new Event('input',{bubbles:true}));})()`);}
async function key(){await cdp('Input.dispatchKeyEvent',{type:'keyDown',key:'Enter',code:'Enter',windowsVirtualKeyCode:13});await cdp('Input.dispatchKeyEvent',{type:'char',key:'Enter',code:'Enter',windowsVirtualKeyCode:13,text:'\r',unmodifiedText:'\r'});await cdp('Input.dispatchKeyEvent',{type:'keyUp',key:'Enter',code:'Enter',windowsVirtualKeyCode:13});}
async function login(role){await cdp('Network.clearBrowserCookies');await cdp('Page.navigate',{url:web+'/login'});await until("document.querySelector('#email')&&Object.keys(document.querySelector('#email')).some(k=>k.startsWith('__reactProps'))",'hydrated login');await input('#email',role+'@example.com');await input('#password','SyntheticOnly123!');await evaluate("document.querySelector('#password').focus()");await key();await until(`location.pathname===${JSON.stringify(role==='student'?'/student':'/admin')}`,'role dashboard after Enter from password');}


async function fail(requestId){await cdp('Fetch.fulfillRequest',{requestId,responseCode:status,responseHeaders:[{name:'Content-Type',value:'application/json'},{name:'Cache-Control',value:'no-store'}],body:Buffer.from(JSON.stringify({code:'SYNTHETIC_FAILURE',message:'PRIVATE_DIAGNOSTIC',detail:'PRIVATE_DIAGNOSTIC',details:{}})).toString('base64')});}
async function fill(kind){
 if(kind==='forgot')await input('#email','synthetic@example.com');
 else{if(kind==='change')await input('#current','SyntheticOld123!');await input(kind==='change'?'#next':'#password','SyntheticNew123!');await input('#confirm','SyntheticNew123!');}
}
async function open(kind,theme){
 await evaluate(`localStorage.setItem('ic_theme',JSON.stringify({state:{mode:${JSON.stringify(theme)}}}))`);
 const path=kind==='change'?'/student/change-password':kind==='forgot'?'/forgot-password':'/reset-password?token=synthetic-reset-only';await cdp('Page.navigate',{url:web+path});await until("document.querySelector('form')&&Object.keys(document.querySelector('form')).some(k=>k.startsWith('__reactProps'))",'hydrated account form');
 assert(!await evaluate("document.querySelector('main')?.textContent.includes('tu cédula')"));if(kind==='change')assert(await evaluate("document.querySelector('header')?.parentElement.classList.contains('z-0')"),'change-password content is above decoration');await fill(kind);
}
async function capture(kind,theme){await evaluate('document.fonts.ready.then(()=>true)');await evaluate('scrollTo(0,0)');const shot=await cdp('Page.captureScreenshot',{format:'png',captureBeyondViewport:false});await writeFile(`${artifacts}/next-${kind}-503-${theme}-390.png`,Buffer.from(shot.data,'base64'));}
async function submitOnce(){
 const before=requests;await evaluate("(()=>{const f=document.querySelector('form');f.requestSubmit();f.requestSubmit();})()");for(let n=0;n<100&&!held.length;n++)await delay(50);assert.equal(held.length,1);assert.equal(requests-before,1);await until("[...document.querySelectorAll('form input,form button')].every(e=>e.matches(':disabled'))",'frozen controls');await fail(held.shift());await until("document.querySelector('form [role=alert]')||document.querySelector('[role=alert]')",'safe form error');return requests-before;
}
try{
 await cdp('Page.enable');await cdp('Emulation.setDeviceMetricsOverride',{width:390,height:844,deviceScaleFactor:1,mobile:true});await login('student');
 await cdp('Fetch.enable',{patterns:['forgot-password','reset-password','change-password'].map(name=>({urlPattern:'*/api/auth/'+name,requestStage:'Request'}))});
 for(const kind of ['forgot','reset','change'])for(const theme of ['light','dark']){
  status=503;await open(kind,theme);const count=await submitOnce();assert(await evaluate("document.body.textContent.includes('El servicio no está disponible temporalmente.')"));assert(!await evaluate("document.body.textContent.includes('PRIVATE_DIAGNOSTIC')||document.body.textContent.includes('Token inválido')||document.body.textContent.includes('CORS')||document.body.textContent.includes('backend caído')"));assert(await evaluate("[...document.querySelectorAll('form input')].every(e=>e.value.length>0&&!e.matches(':disabled'))"));assert(await evaluate('document.documentElement.scrollWidth<=innerWidth'));await capture(kind,theme);
  measurements.push({kind,theme,status,posts_on_double_submit:count,draft_retained:true,fields_frozen_while_pending:true,error_safe:true});
 }
 status=400;await open('reset','light');await submitOnce();assert(await evaluate("document.body.textContent.includes('Token inválido o expirado')"));measurements.push({kind:'reset',status,invalid_token_copy:true});
 status=429;await open('forgot','light');await submitOnce();assert(await evaluate("document.body.textContent.includes('Demasiados intentos')"));measurements.push({kind:'forgot',status,rate_limit_copy:true});
 assert.equal(transportErrors.length,0);await writeFile(`${artifacts}/next-measurements.json`,JSON.stringify({institutional_data:false,production_ready:false,actual_login_backend:true,form_responses_controlled:true,real_passwords_changed:false,real_emails_sent:false,measurements},null,2)+'\n');console.log('PASS: safe account-form errors, immutable pending drafts and one controlled POST per double submit');
}finally{await Promise.allSettled(held.splice(0).map(requestId=>fail(requestId)));ws.close();}
