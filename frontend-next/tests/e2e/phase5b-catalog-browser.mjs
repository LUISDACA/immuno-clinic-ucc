// Real production modal + synthetic PostgreSQL. One controlled 503 tests UI recovery;
// the retry reaches FastAPI/PostgreSQL. No institutional data, tokens or IDs exported.
import assert from 'node:assert/strict';
import { mkdir, writeFile } from 'node:fs/promises';
const {PHASE5A_CDP:cdpUrl,PHASE5A_WEB:web,PHASE5B_ARTIFACT_DIR:shared}=process.env;
assert(shared,'Explicit artifact directory required');
const artifacts=shared+'/../catalog-dialog';await mkdir(artifacts,{recursive:true});
const pages=await (await fetch(cdpUrl+'/json/list')).json();
const ws=new WebSocket(pages.find(p=>p.type==='page').webSocketDebuggerUrl);
await new Promise(r=>ws.addEventListener('open',r,{once:true}));
let id=0, heldRequest=null, postCount=0;
const pending=new Map(),measurements=[],transportErrors=[];
ws.addEventListener('message',event=>{
  const m=JSON.parse(event.data),call=pending.get(m.id);
  if(call){pending.delete(m.id);if(m.error)call.reject(new Error(m.error.message));else call.resolve(m.result);}
  if(m.method==='Fetch.requestPaused'){
    if(m.params.request.method==='POST' && ++postCount===1)heldRequest=m.params.requestId;
    else cdp('Fetch.continueRequest',{requestId:m.params.requestId}).catch(()=>transportErrors.push('continue failed'));
  }
});
function cdp(method,params={}){return new Promise((resolve,reject)=>{const n=++id;pending.set(n,{resolve,reject});ws.send(JSON.stringify({id:n,method,params}));});}
async function evaluate(expression){const r=await cdp('Runtime.evaluate',{expression,awaitPromise:true,returnByValue:true});assert(!r.exceptionDetails,'Browser evaluation failed');return r.result.value;}
async function until(expression,label){for(let i=0;i<100;i++){if(await evaluate(expression))return;await new Promise(r=>setTimeout(r,100));}throw new Error('Timeout: '+label);}
async function key(key,code,virtualCode,text,shift=false){
  await cdp('Input.dispatchKeyEvent',{type:'keyDown',key,code,windowsVirtualKeyCode:virtualCode,modifiers:shift?8:0});
  if(text)await cdp('Input.dispatchKeyEvent',{type:'char',text,unmodifiedText:text,key,code,windowsVirtualKeyCode:virtualCode});
  await cdp('Input.dispatchKeyEvent',{type:'keyUp',key,code,windowsVirtualKeyCode:virtualCode,modifiers:shift?8:0});
}
async function enter(){await key('Enter','Enter',13,'\r');}
async function activate(selector){await evaluate(`document.querySelector(${JSON.stringify(selector)}).focus()`);await enter();}
async function screenshot(name){await evaluate('document.fonts.ready.then(()=>true)');const r=await cdp('Page.captureScreenshot',{format:'png',captureBeyondViewport:false});await writeFile(artifacts+'/'+name+'.png',Buffer.from(r.data,'base64'));}
async function input(selector,value){await evaluate(`(()=>{const e=document.querySelector(${JSON.stringify(selector)});Object.getOwnPropertyDescriptor(HTMLInputElement.prototype,'value').set.call(e,${JSON.stringify(value)});e.dispatchEvent(new Event('input',{bubbles:true}));})()`);}
const field=label=>`document.getElementById(Array.from(document.querySelectorAll('dialog label')).find(l=>l.textContent.replaceAll('*','').trim()===${JSON.stringify(label)}).htmlFor)`;
async function fill(label,value){await evaluate(`(()=>{const e=${field(label)};Object.getOwnPropertyDescriptor(HTMLInputElement.prototype,'value').set.call(e,${JSON.stringify(value)});e.dispatchEvent(new Event('input',{bubbles:true}));})()`);}
async function buttonText(text){await evaluate(`Array.from(document.querySelectorAll('dialog button')).find(b=>b.textContent.trim()===${JSON.stringify(text)}).focus()`);await enter();}
async function login(role){
  await cdp('Network.clearBrowserCookies');await cdp('Page.navigate',{url:web+'/login'});
  await until("document.querySelector('#email')&&Object.keys(document.querySelector('#email')).some(k=>k.startsWith('__reactProps'))",'hydrated login');
  await input('#email',role+'@example.com');await input('#password','SyntheticOnly123!');await activate('button[type="submit"]');
  await until(`location.pathname===${JSON.stringify(role==='student'?'/student':'/admin')}`,'synthetic login');
}
const rgb=value=>value.match(/[\d.]+/g).slice(0,3).map(Number);
function luminance(color){const c=color.map(v=>v/255).map(v=>v<=.04045?v/12.92:((v+.055)/1.055)**2.4);return c[0]*.2126+c[1]*.7152+c[2]*.0722;}
function contrast(a,b){const l=[luminance(rgb(a)),luminance(rgb(b))].sort((x,y)=>y-x);return (l[0]+.05)/(l[1]+.05);}
async function color(expression,background){
  const value=await evaluate(`(()=>{const s=getComputedStyle(${expression});return {foreground:s.color,background:s.backgroundColor};})()`);
  const effectiveBackground=background?await evaluate(`(()=>{const c=document.createElement('canvas');c.width=c.height=1;const x=c.getContext('2d');x.fillStyle=${JSON.stringify(background)};x.fillRect(0,0,1,1);x.fillStyle=getComputedStyle(${expression}).backgroundColor;x.fillRect(0,0,1,1);const d=x.getImageData(0,0,1,1).data;return 'rgb('+Array.from(d).slice(0,3).join(', ')+')';})()`):value.background;
  const ratio=contrast(value.foreground,effectiveBackground);assert(ratio>=4.5,'rendered text contrast');return {...value,effectiveBackground,contrast:ratio};
}
async function openCreate(){await activate('[data-catalog-create]');await until("Boolean(document.querySelector('dialog[open]'))",'create dialog');assert(await evaluate(`document.activeElement===${field('Nombre')}`),'initial focus on name');}
async function tagCreate(){await until("Array.from(document.querySelectorAll('button')).some(b=>b.textContent.trim()==='+ Nueva vacuna')",'loaded catalog');await evaluate("Array.from(document.querySelectorAll('button')).find(b=>b.textContent.trim()==='+ Nueva vacuna').setAttribute('data-catalog-create','')");}
async function closed(){await until("!document.querySelector('dialog')",'closed modal');assert(await evaluate("document.activeElement===document.querySelector('[data-catalog-create]')"),'focus returns to create trigger');}
async function backdrop(){await cdp('Input.dispatchMouseEvent',{type:'mousePressed',x:2,y:2,button:'left',clickCount:1});await cdp('Input.dispatchMouseEvent',{type:'mouseReleased',x:2,y:2,button:'left',clickCount:1});}
try {
  await cdp('Page.enable');await cdp('Emulation.setDeviceMetricsOverride',{width:1440,height:900,deviceScaleFactor:1,mobile:false});
  await login('app_admin');await cdp('Page.navigate',{url:web+'/admin/vaccines'});
  for(const [preference,os] of [['light','dark'],['dark','light']]){
    await cdp('Emulation.setEmulatedMedia',{features:[{name:'prefers-color-scheme',value:os}]});
    await evaluate(`localStorage.setItem('ic_theme',JSON.stringify({state:{mode:${JSON.stringify(preference)}}}))`);await cdp('Page.reload');
    await until(`document.documentElement.dataset.theme===${JSON.stringify(preference)}`,'restored catalog theme');await tagCreate();await openCreate();
    const dialog=await color("document.querySelector('dialog')");assert.equal(dialog.background,preference==='light'?'rgb(255, 255, 255)':'rgb(14, 32, 35)');
    const name=await color(field('Nombre'));
    assert(await evaluate("(()=>{const d=document.querySelector('dialog');return d.getAttribute('aria-modal')==='true'&&document.getElementById(d.getAttribute('aria-labelledby')).textContent==='Nueva vacuna'&&Array.from(d.querySelectorAll('label')).every(l=>l.htmlFor?!!document.getElementById(l.htmlFor):!!l.querySelector('input'));})()"),'named dialog and linked labels');
    await evaluate("document.querySelector('[data-catalog-create]').focus()");assert(await evaluate("document.querySelector('dialog').contains(document.activeElement)"),'native background inertness');
    await evaluate("Array.from(document.querySelectorAll('dialog button,dialog input,dialog select')).filter(e=>!e.matches(':disabled')).at(-1).focus()");
    await key('Tab','Tab',9);assert(await evaluate("document.activeElement===document.querySelector('dialog button')"),'Tab wraps to first control; focus='+await evaluate("JSON.stringify({tag:document.activeElement.tagName,inside:document.querySelector('dialog').contains(document.activeElement),input:document.activeElement instanceof HTMLInputElement,dialog:document.activeElement instanceof HTMLDialogElement})"));
    await key('Tab','Tab',9,undefined,true);assert(await evaluate("document.activeElement===Array.from(document.querySelectorAll('dialog button,dialog input,dialog select')).filter(e=>!e.matches(':disabled')).at(-1)"),'Shift+Tab wraps to last control');
    await buttonText('Anual');assert(await evaluate("Array.from(document.querySelectorAll('dialog button')).find(b=>b.textContent.trim()==='Anual').getAttribute('aria-pressed')==='true'"),'chip explicit state');
    await evaluate("Array.from(document.querySelectorAll('dialog button')).find(b=>b.textContent.trim()==='Anual').setAttribute('data-catalog-chip','')");
    await until(`getComputedStyle(document.querySelector('[data-catalog-chip]')).color===${JSON.stringify(preference==='light'?'rgb(0, 101, 117)':'rgb(69, 210, 223)')}`,'selected chip transition finished');
    const chip=await color("document.querySelector('[data-catalog-chip]')",dialog.background);
    await buttonText('Agregar');assert(await evaluate("document.querySelectorAll('[data-dose-row]')[1].contains(document.activeElement)"),'added row focus');
    await activate('[aria-label="Eliminar configuración de dosis 2"]');assert(await evaluate("document.querySelector('[data-dose-row]').contains(document.activeElement)"),'removed row focus');
    await evaluate("document.querySelector('dialog').scrollTop=0");await screenshot('after-catalog-editor-'+preference+'-os-'+os);
    const geometry=[];
    for(const [width,height,mobile] of [[320,568,true],[390,844,true],[768,1024,true],[1440,900,false]]){
      await cdp('Emulation.setDeviceMetricsOverride',{width,height,deviceScaleFactor:1,mobile});
      let doseSelectors=null;
      if(width===320){
        await evaluate("document.querySelectorAll('dialog select')[1].focus()");
        await key('ArrowDown','ArrowDown',40);
        assert.equal(await evaluate("document.querySelectorAll('dialog select')[1].value"),'booster','dose type selector is operable at 320px');
        await key('ArrowUp','ArrowUp',38);
        assert.equal(await evaluate("document.querySelectorAll('dialog select')[1].value"),'standard','dose type selector returns to initial value');
        await evaluate("document.querySelectorAll('dialog select')[2].focus()");
        await key('ArrowDown','ArrowDown',40);
        assert.equal(await evaluate("document.querySelectorAll('dialog select')[2].value"),'female','dose applicability selector is operable at 320px');
        await key('ArrowUp','ArrowUp',38);
        assert.equal(await evaluate("document.querySelectorAll('dialog select')[2].value"),'all','dose applicability selector returns to initial value');
        doseSelectors={type_keyboard:true,applies_to_keyboard:true,restored_initial_values:true};
      }
      const value=await evaluate("(()=>{const d=document.querySelector('dialog'),r=d.getBoundingClientRect();return {viewport:innerWidth,root:document.documentElement.scrollWidth,left:r.left,right:r.right,width:d.clientWidth,scrollWidth:d.scrollWidth,height:d.clientHeight,scrollHeight:d.scrollHeight};})()");
      assert.equal(value.viewport,width);assert(value.root<=width);assert(value.left>=0&&value.right<=width);assert(value.scrollWidth<=value.width,'dialog horizontal overflow');
      await evaluate("document.querySelector('dialog').scrollTop=0");
      geometry.push({requestedWidth:width,requestedHeight:height,...value,...(doseSelectors?{doseSelectors}:{})});
      if(width===390){
        await screenshot('after-catalog-editor-'+preference+'-mobile');
        await evaluate("Array.from(document.querySelectorAll('dialog button')).at(-1).focus()");
        assert(await evaluate("(()=>{const d=document.querySelector('dialog'),b=Array.from(d.querySelectorAll('button')).at(-1),r=d.getBoundingClientRect(),s=b.getBoundingClientRect();return d.scrollTop>0&&s.top>=r.top&&s.bottom<=r.bottom;})()"),'long editor submit reachable through scrolling');
        await screenshot('after-catalog-editor-'+preference+'-mobile-bottom');
      }
    }
    await key('Escape','Escape',27);await closed();
    await openCreate();await backdrop();await closed();
    measurements.push({screen:'catalog-editor',preference,os,dialog,name,chip,geometry,keyboard:true,background_inert:true,escape:true,backdrop:true,return_focus:true});
    await activate('[aria-label="Editar vacuna Synthetic vaccine"]');
    await until("Boolean(document.querySelector('dialog'))",'edit modal');
    assert(await evaluate(`${field('Código (A-Z, 0-9, _)')}.disabled`),'existing code immutable');
    await evaluate("Array.from(document.querySelectorAll('dialog div')).find(e=>e.textContent.startsWith('Al guardar se regenerará')&&e.children.length===0).setAttribute('data-catalog-warning','')");
    const warning=await color("document.querySelector('[data-catalog-warning]')");
    await screenshot('after-catalog-edit-'+preference+'-os-'+os);await buttonText('Cancelar');
    await activate('[aria-label="Desactivar vacuna Synthetic vaccine"]');await until("Boolean(document.querySelector('dialog'))",'toggle confirmation');
    assert(await evaluate("document.activeElement.textContent.trim()==='Cancelar'"),'safe initial toggle focus');
    const toggle=await color("document.querySelector('dialog')");await screenshot('after-catalog-toggle-'+preference+'-os-'+os);
    await key('Escape','Escape',27);await until("!document.querySelector('dialog')",'toggle Escape');
    measurements.push({screen:'catalog-edit-toggle',preference,os,warning,toggle,immutable_code:true,cancelled:true});
  }
  // Real native busy controls + a controlled safe 503. Retry performs a real POST.
  await tagCreate();await openCreate();await fill('Nombre','Synthetic UI catalog');await fill('Código (A-Z, 0-9, _)','SYNTHETIC_UI');
  await cdp('Fetch.enable',{patterns:[{urlPattern:web+'/api/admin/vaccines',requestStage:'Request'}]});
  await buttonText('Crear');for(let i=0;i<100&&!heldRequest;i++)await new Promise(r=>setTimeout(r,20));assert(heldRequest,'synthetic request held');
  assert(await evaluate("document.querySelector('dialog').getAttribute('aria-busy')==='true'&&Array.from(document.querySelectorAll('dialog button,dialog input,dialog select')).every(e=>e.matches(':disabled'))"),'all write controls disabled');
  await key('Escape','Escape',27);await backdrop();assert(await evaluate("Boolean(document.querySelector('dialog[open]'))"),'busy modal cannot dismiss');await enter();assert.equal(postCount,1,'no duplicate submit');
  await screenshot('after-catalog-saving-dark');
  await cdp('Fetch.fulfillRequest',{requestId:heldRequest,responseCode:503,responseHeaders:[{name:'Content-Type',value:'application/json'}],body:Buffer.from(JSON.stringify({code:'SERVICE_UNAVAILABLE',message:'El servicio no está disponible temporalmente.',details:{}})).toString('base64')});heldRequest=null;
  await until("Boolean(document.querySelector('dialog [role=alert]'))",'recoverable error');
  assert.equal(await evaluate(`${field('Nombre')}.value`),'Synthetic UI catalog');
  const error=await color("document.querySelector('dialog [role=alert]')",(await color("document.querySelector('dialog')")).background);
  await screenshot('after-catalog-error-dark');await buttonText('Crear');
  await until("!document.querySelector('dialog')&&document.body.textContent.includes('Synthetic UI catalog')",'real PostgreSQL create and list refresh');assert.equal(postCount,2,'one failed request and one explicit retry');
  await cdp('Fetch.disable');assert.equal(transportErrors.length,0);
  measurements.push({screen:'catalog-save',controlled_503:true,real_create_retry:true,post_count:postCount,error,pending_close_blocked:true});
  await login('admin');await cdp('Page.navigate',{url:web+'/admin/vaccines'});
  await until("location.pathname==='/admin'&&document.body.textContent.includes('Dashboard')",'normal admin route guard');
  assert.equal(await evaluate("fetch('/api/admin/vaccines').then(r=>r.status)"),403,'normal admin catalog permission enforced by FastAPI');
  assert(!await evaluate("Array.from(document.querySelectorAll('button')).some(b=>b.textContent.trim()==='+ Nueva vacuna')"),'normal admin cannot edit');
  await login('student');assert.equal(await evaluate("fetch('/api/admin/vaccines').then(r=>r.status)"),403,'student catalog permission enforced by FastAPI');
  measurements.push({screen:'catalog-permissions',normal_admin:'route redirect + API 403',student:'API 403',writer:'app_admin'});
  await writeFile(artifacts+'/measurements.json',JSON.stringify({stage:'verified-after',measurements},null,2)+'\n');
  console.log('PASS: native catalog dialogs, keyboard/inertness, themes/reflow, controlled error, real PostgreSQL create/retry and role permissions.');
} finally { ws.close(); }
