// Real production controls + synthetic PostgreSQL. No institutional data or session values exported.
import assert from 'node:assert/strict';
import { mkdir, writeFile } from 'node:fs/promises';
const {PHASE5A_CDP:cdpUrl,PHASE5A_WEB:web,PHASE5B_ARTIFACT_DIR:shared}=process.env;
assert(shared,'Explicit artifact directory required');
const artifacts=shared+'/../controls';await mkdir(artifacts,{recursive:true});
const pages=await (await fetch(cdpUrl+'/json/list')).json();
const ws=new WebSocket(pages.find(p=>p.type==='page').webSocketDebuggerUrl);
await new Promise(r=>ws.addEventListener('open',r,{once:true}));
let id=0;
const reads=[];
const pending=new Map(),measurements=[];
ws.addEventListener('message',event=>{
  const m=JSON.parse(event.data),call=pending.get(m.id);
  if(call){pending.delete(m.id);if(m.error)call.reject(new Error(m.error.message));else call.resolve(m.result);}
  if(m.method==='Network.requestWillBeSent'&&m.params.request.method==='PUT'&&new URL(m.params.request.url).pathname.match(/\/notifications\/[^/]+\/read$/)) reads.push(new URL(m.params.request.url).pathname);
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
async function login(role){
  await cdp('Network.clearBrowserCookies');await cdp('Page.navigate',{url:web+'/login'});
  await until("document.querySelector('#email')&&Object.keys(document.querySelector('#email')).some(k=>k.startsWith('__reactProps'))",'hydrated login');
  await input('#email',role+'@example.com');await input('#password','SyntheticOnly123!');await activate('button[type="submit"]');
  await until(`location.pathname===${JSON.stringify(role==='student'?'/student':'/admin')}`,'synthetic role dashboard');
}
async function clickLabel(label){
  const coordinates=await evaluate(`(()=>{const l=Array.from(document.querySelectorAll('label')).find(l=>l.textContent.trim()===${JSON.stringify(label)});return l?{id:l.htmlFor,x:l.getBoundingClientRect().left+3,y:l.getBoundingClientRect().top+3}:null;})()`);
  assert(coordinates?.id,'label names a control');
  await cdp('Input.dispatchMouseEvent',{type:'mousePressed',x:coordinates.x,y:coordinates.y,button:'left',clickCount:1});
  await cdp('Input.dispatchMouseEvent',{type:'mouseReleased',x:coordinates.x,y:coordinates.y,button:'left',clickCount:1});
  assert.equal(await evaluate('document.activeElement.id'),coordinates.id,'native label click focuses control');
}
async function labels(){
  const value=await evaluate("(()=>{const labels=Array.from(document.querySelectorAll('label')),ids=Array.from(document.querySelectorAll('input,select')).map(e=>e.id);return {count:labels.length,linked:labels.every(l=>l.htmlFor&&document.getElementById(l.htmlFor)),unique:new Set(ids).size===ids.length,allIds:ids.every(Boolean)};})()");
  assert(value.count>0&&value.linked&&value.unique&&value.allIds,'field labels linked to unique IDs');return value;
}
const button=text=>`Array.from(document.querySelectorAll('button')).find(b=>b.textContent.trim()===${JSON.stringify(text)})`;
const notice=(number,mark=false)=>`button[aria-label="${mark?'Marcar como leída: ':'Notificación '}Synthetic notice ${number}"]`;
const menu='button[aria-label="Opciones de usuario"]';
async function menuChecks(role){
  await activate(menu);
  await until(`Boolean(document.getElementById(document.querySelector(${JSON.stringify(menu)}).getAttribute('aria-controls')))`,'open account panel');
  assert(await evaluate(`(()=>{const b=document.querySelector(${JSON.stringify(menu)}),p=document.getElementById(b.getAttribute('aria-controls'));return b.getAttribute('aria-expanded')==='true'&&p.getAttribute('aria-labelledby')===b.id&&!document.querySelector('[role=menu]');})()`),'disclosure semantics');
  await key('Tab','Tab',9);
  assert(await evaluate(`document.activeElement.getAttribute('href')===${JSON.stringify((role==='student'?'/student':'/admin')+'/profile')}`),'native Tab reaches profile');
  await key('Escape','Escape',27);
  assert(await evaluate(`document.activeElement===document.querySelector(${JSON.stringify(menu)})&&document.activeElement.getAttribute('aria-expanded')==='false'`),'Escape restores trigger');
  await enter();await evaluate(`${button('Oscuro')}.focus()`);await enter();
  assert(await evaluate(`${button('Oscuro')}.getAttribute('aria-pressed')==='true'`),'keyboard theme selection');
  await key('Escape','Escape',27);await enter();
  await evaluate("document.querySelector('main a,aside a').focus()");
  assert(await evaluate(`document.querySelector(${JSON.stringify(menu)}).getAttribute('aria-expanded')==='false'`),'focus leaving closes without trapping');
}
try {
  await cdp('Page.enable');await cdp('Network.enable');
  await cdp('Emulation.setDeviceMetricsOverride',{width:1440,height:900,deviceScaleFactor:1,mobile:false});
  for(const role of ['student','admin']){
    await login(role);const base=role==='student'?'/student':'/admin';
    await cdp('Page.navigate',{url:web+base+'/notifications'});
    await until(`Boolean(document.querySelector(${JSON.stringify(notice(1))}))`,'synthetic notices loaded');
    for(const [preference,os] of [['light','dark'],['dark','light']]){
      await cdp('Emulation.setEmulatedMedia',{features:[{name:'prefers-color-scheme',value:os}]});
      await evaluate(`localStorage.setItem('ic_theme',JSON.stringify({state:{mode:${JSON.stringify(preference)}}}))`);await cdp('Page.reload');
      await until(`Boolean(document.querySelector(${JSON.stringify(notice(1))}))`,'notices reload');
      assert(await evaluate(`(()=>{const b=document.querySelector(${JSON.stringify(notice(1))}),m=document.querySelector(${JSON.stringify(notice(1,true))});return b.tagName==='BUTTON'&&m.tagName==='BUTTON'&&!b.contains(m);})()`),'native sibling actions');
      await screenshot('after-notifications-'+role+'-'+preference);
      await activate(menu);await screenshot('after-user-panel-'+role+'-'+preference);await key('Escape','Escape',27);
      const geometry=[];
      for(const [width,height,mobile] of [[320,568,true],[390,844,true],[768,1024,true],[1440,900,false]]){
        await cdp('Emulation.setDeviceMetricsOverride',{width,height,deviceScaleFactor:1,mobile});await activate(menu);
        const value=await evaluate(`(()=>{const b=document.querySelector(${JSON.stringify(menu)}),p=document.getElementById(b.getAttribute('aria-controls')),r=p.getBoundingClientRect();return {viewport:innerWidth,scrollWidth:document.documentElement.scrollWidth,left:r.left,right:r.right};})()`);
        assert.equal(value.viewport,width);assert(value.scrollWidth<=width,'no horizontal overflow');assert(value.left>=0&&value.right<=width,'panel fits viewport');
        geometry.push({width,height,...value});if(width===390)await screenshot('after-user-panel-'+role+'-'+preference+'-mobile');
        await key('Escape','Escape',27);
      }
      measurements.push({role,preference,os,geometry,sibling_buttons:true});
    }
    await menuChecks(role);
    const unread=await evaluate("Array.from(document.querySelectorAll('span')).find(e=>/^\\d+ nueva\\(s\\)$/.test(e.textContent.trim()))?.textContent");
    const count=reads.length;await activate(notice(1,true));
    await until(`!document.querySelector(${JSON.stringify(notice(1,true))})`,'read row refresh');
    assert.equal(await evaluate('location.pathname'),base+'/notifications','mark read cannot navigate');assert.equal(reads.length,count+1,'one read mutation');
    if(unread)await until(`!Array.from(document.querySelectorAll('span')).some(e=>e.textContent.trim()===${JSON.stringify(unread)})`,'unread count refresh');
    const secondCount=reads.length;await evaluate(`document.querySelector(${JSON.stringify(notice(2))}).focus()`);await key(' ','Space',32,' ');
    await until(`location.pathname===${JSON.stringify(role==='student'?'/student/profile':'/admin')}`,'notification destination from backend');assert.equal(reads.length,secondCount+1,'opening unread notice marks it once');
    await cdp('Page.navigate',{url:web+base+'/notifications'});
    await until(`Boolean(document.querySelector(${JSON.stringify(notice(2))}))&&!document.querySelector(${JSON.stringify(notice(2,true))})`,'persisted read after reload');
    await screenshot('after-notifications-read-'+role);
    measurements.push({role,read_only_no_navigation:true,read_count_refreshed:true,open_preserves_backend_destination:true,persisted_after_reload:true});
    if(role==='admin'){
      await cdp('Page.navigate',{url:web+'/admin/students?active=true&page=2'});await until("document.querySelectorAll('label').length===5",'list filters');
      await clickLabel('Estado');measurements.push({screen:'student-filters',...await labels()});assert.equal(await evaluate('new URLSearchParams(location.search).get("page")'),'2');await screenshot('after-student-filters');
      await cdp('Page.navigate',{url:web+'/admin/students/create'});await until("Array.from(document.querySelectorAll('label')).some(l=>l.textContent==='Sexo *')",'create fields');
      await clickLabel('Sexo *');measurements.push({screen:'student-create',...await labels()});await screenshot('after-student-create-labels');
      await cdp('Page.navigate',{url:web+'/admin/students/'+process.env.PHASE5A_STUDENT+'?tab=info&returnTo=%2Fadmin%2Fstudents%3Fpage%3D2'});
      await until(`${button('Editar datos')}!==undefined`,'student detail');await evaluate(`${button('Editar datos')}.click()`);await until("Array.from(document.querySelectorAll('label')).some(l=>l.textContent==='Sexo')",'edit fields');
      await clickLabel('Nombre');measurements.push({screen:'student-edit',...await labels()});await screenshot('after-student-edit-labels');
    }
    await activate(menu);await evaluate(`${button('Cerrar sesión')}.focus()`);await enter();await until("location.pathname==='/login'",'coordinated logout');
    assert.equal(await evaluate("fetch('/api/users/me').then(r=>r.status)"),401,'session unusable after logout');
  }
  await login('app_admin');await cdp('Page.navigate',{url:web+'/admin/admins'});await until(`${button('Crear admin')}!==undefined`,'admin management');await evaluate(`${button('Crear admin')}.click()`);
  await until("Array.from(document.querySelectorAll('label')).some(l=>l.textContent.trim()==='Contraseña *')",'admin creation fields');
  await clickLabel('Contraseña *');measurements.push({screen:'admin-create',...await labels()});await screenshot('after-admin-create-labels');
  await writeFile(artifacts+'/measurements.json',JSON.stringify(measurements,null,2)+'\n');
  console.log('PASS: sibling actions, count refresh, role destinations, labels, disclosure keyboard, logout and reflow');
} finally {ws.close();}
