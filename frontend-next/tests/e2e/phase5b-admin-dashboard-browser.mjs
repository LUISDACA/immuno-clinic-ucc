// Synthetic presentation states. Clinical signals are supplied, never evaluated here.
import assert from 'node:assert/strict';
import { mkdir, readFile, writeFile } from 'node:fs/promises';
const {PHASE5A_CDP:cdpUrl,PHASE5A_WEB:web,PHASE5B_ARTIFACT_DIR:shared}=process.env;
assert(shared,'Explicit artifact folder required');
const artifacts=shared+'/../admin-dashboard';await mkdir(artifacts,{recursive:true});
const fixture=JSON.parse(await readFile('../docs/ui/fixtures/phase5b-admin-dashboard.json','utf8'));
const pages=await(await fetch(cdpUrl+'/json/list')).json();
const ws=new WebSocket(pages.find(p=>p.type==='page').webSocketDebuggerUrl);
await new Promise(r=>ws.addEventListener('open',r,{once:true}));
let id=0,stage='real',controlledRequests=0,unexpectedMutation=0;
const pending=new Map(),held=[],transportErrors=[],measurements=[];
ws.addEventListener('message',event=>{
  const m=JSON.parse(event.data),call=pending.get(m.id);
  if(call){pending.delete(m.id);if(m.error)call.reject(new Error(m.error.message));else call.resolve(m.result);}
  if(m.method==='Fetch.requestPaused'){
    const request=m.params.request;
    if(request.method!=='GET'){unexpectedMutation++;cdp('Fetch.continueRequest',{requestId:m.params.requestId}).catch(()=>transportErrors.push('continue failed'));}
    else if(stage==='real')cdp('Fetch.continueRequest',{requestId:m.params.requestId}).catch(()=>transportErrors.push('continue failed'));
    else {controlledRequests++;if(stage==='loading')held.push(m.params.requestId);else respond(m.params.requestId,stage).catch(()=>transportErrors.push('response failed'));}
  }
});
function cdp(method,params={}){return new Promise((resolve,reject)=>{const n=++id;pending.set(n,{resolve,reject});ws.send(JSON.stringify({id:n,method,params}));});}
async function evaluate(expression){const r=await cdp('Runtime.evaluate',{expression,awaitPromise:true,returnByValue:true});assert(!r.exceptionDetails,'Browser evaluation failed');return r.result.value;}
async function until(expression,label){for(let n=0;n<100;n++){if(await evaluate(expression))return;await new Promise(r=>setTimeout(r,100));}throw new Error('Timeout: '+label);}
const pause=ms=>new Promise(r=>setTimeout(r,ms));
async function key(key,code,virtualCode,text){
  await cdp('Input.dispatchKeyEvent',{type:'keyDown',key,code,windowsVirtualKeyCode:virtualCode});
  if(text)await cdp('Input.dispatchKeyEvent',{type:'char',text,unmodifiedText:text,key,code,windowsVirtualKeyCode:virtualCode});
  await cdp('Input.dispatchKeyEvent',{type:'keyUp',key,code,windowsVirtualKeyCode:virtualCode});
}
async function input(selector,value){await evaluate(`(()=>{const e=document.querySelector(${JSON.stringify(selector)});Object.getOwnPropertyDescriptor(HTMLInputElement.prototype,'value').set.call(e,${JSON.stringify(value)});e.dispatchEvent(new Event('input',{bubbles:true}));})()`);}
async function activate(selector){await evaluate(`document.querySelector(${JSON.stringify(selector)}).focus()`);await key('Enter','Enter',13,'\r');}
async function screenshot(name){await evaluate('document.fonts.ready.then(()=>true)');const r=await cdp('Page.captureScreenshot',{format:'png',captureBeyondViewport:false});await writeFile(artifacts+'/'+name+'.png',Buffer.from(r.data,'base64'));}
async function revealHeading(selector){
  await evaluate(`(()=>{const e=document.querySelector(${JSON.stringify(selector)}),h=document.querySelector('header');scrollTo(0,e.getBoundingClientRect().top+scrollY-h.getBoundingClientRect().height-16);})()`);
  await pause(120);
  const position=await evaluate(`(()=>{const e=document.querySelector(${JSON.stringify(selector)}).getBoundingClientRect(),h=document.querySelector('header').getBoundingClientRect();return {headingTop:e.top,headerBottom:h.bottom};})()`);
  assert(position.headingTop>=position.headerBottom-1,'capture heading is visible below the sticky header');
  return position;
}
async function respond(requestId,state){
  const status=({error:503,forbidden:403,expired:401})[state]??200;
  const body=status!==200?{code:'SYNTHETIC_ERROR',message:'Synthetic unsafe diagnostic',details:null}:state==='updated'?{...fixture.data,total_students:101,active_students:91,vaccine_compliance:fixture.data.vaccine_compliance.map(v=>({...v,name:v.name+' actualizada'}))}:fixture[state]??fixture.data;
  await cdp('Fetch.fulfillRequest',{requestId,responseCode:status,responseHeaders:[{name:'Content-Type',value:'application/json'},{name:'Cache-Control',value:'no-store'}],body:Buffer.from(JSON.stringify(body)).toString('base64')});
}
async function login(role){
  await cdp('Network.clearBrowserCookies');await cdp('Page.navigate',{url:web+'/login'});
  await until("document.querySelector('#email')&&Object.keys(document.querySelector('#email')).some(k=>k.startsWith('__reactProps'))",'hydrated login');
  await input('#email',role+'@example.com');await input('#password','SyntheticOnly123!');await activate('button[type=submit]');
  await until(`location.pathname===${JSON.stringify(role==='student'?'/student':'/admin')}`,'synthetic role login');
}
async function stateReady(state){
  const expressions={data:"document.querySelector('main')?.textContent.includes('Vacuna sintética 1')",empty:"document.querySelector('main')?.textContent.includes('Sin datos.')",loading:"document.querySelector('main section')?.getAttribute('aria-busy')==='true'",error:"Boolean(document.querySelector('main [role=alert]'))",updated:"document.querySelector('main')?.textContent.includes('Vacuna sintética 1 actualizada')"};
  await until('Boolean(document.body)&&('+expressions[state]+')',state+' ready');
}
async function layout(){
  return evaluate(`(()=>{const labels=[...document.querySelectorAll('main h1,main h2,main h3,main span.uppercase')];return {viewport:innerWidth,scrollWidth:document.documentElement.scrollWidth,clientWidth:document.documentElement.clientWidth,bodyWidth:document.body.getBoundingClientRect().width,containerWidth:document.querySelector("main > div")?.getBoundingClientRect().width,outsideLayoutBounds:[...document.querySelectorAll("main *")].map(e=>({tag:e.tagName,className:typeof e.className==="string"?e.className:"svg",right:e.getBoundingClientRect().right,width:e.getBoundingClientRect().width,scrollWidth:e.scrollWidth,clientWidth:e.clientWidth})).filter(e=>e.right>document.documentElement.clientWidth+1).slice(-30),labels:labels.map(e=>{const b=e.getBoundingClientRect(),r=document.createRange();r.selectNodeContents(e);return {tag:e.tagName,width:b.width,clipped:[...r.getClientRects()].some(f=>f.left<b.left-1||f.right>b.right+1||f.top<b.top-1||f.bottom>b.bottom+1)};})};})()`);
}
try{
  await cdp('Page.enable');await cdp('Emulation.setDeviceMetricsOverride',{width:390,height:844,deviceScaleFactor:1,mobile:true});
  for(const role of ['admin','app_admin']){
    stage='real';await login(role);await until("document.querySelector('main').textContent.includes('Vacunas al dia vs pendientes')",'real dashboard data');
    const real=await evaluate("fetch('/api/admin/statistics').then(r=>({status:r.status,body:r.json()})).then(async r=>({status:r.status,body:await r.body}))");assert.equal(real.status,200,'real statistics authority');
    if(role==='admin'){
      const counters=await evaluate("[...document.querySelectorAll('main span.uppercase')].map(e=>({label:e.textContent,value:Number(e.parentElement.lastElementChild.textContent)}))");
      for(const [label,value] of [['Totales',real.body.total_students],['Activos',real.body.active_students],['Desactivados',real.body.inactive_students],['Esquema 100%',real.body.vaccination_status.approved],['Pendientes',real.body.vaccination_status.pending]])assert.equal(counters.find(c=>c.label===label)?.value,value,'real backend aggregate '+label);
    }
    assert.equal(await evaluate("fetch('/api/admin/admins').then(r=>r.status)"),role==='admin'?403:200,'existing role permissions');
    await cdp('Fetch.enable',{patterns:[{urlPattern:'*/api/admin/statistics*',requestStage:'Request'}]});
    for(const theme of ['light','dark']){
      await evaluate(`localStorage.setItem('ic_theme',JSON.stringify({state:{mode:${JSON.stringify(theme)}}}))`);
      await cdp('Emulation.setEmulatedMedia',{features:[{name:'prefers-color-scheme',value:theme==='light'?'dark':'light'}]});
      for(const state of ['data','empty','loading','error']){
        stage=state;await cdp('Page.reload');await stateReady(state);
        assert(await evaluate("Boolean(document.querySelector('main a[href=\"/admin/communications\"]'))"),'role navigation survives all states');
        assert(!await evaluate("document.body.textContent.includes('Synthetic unsafe diagnostic')"),'safe error presentation');
        assert.equal(await evaluate("Boolean(document.querySelector('main a[href=\"/admin/admins\"]'))"),role==='app_admin','app admin capability not added to ordinary dashboard');
        for(const [width,scale] of [[390,1],[390,2],[1280,1]]){
          await cdp('Emulation.setDeviceMetricsOverride',{width,height:844,deviceScaleFactor:1,mobile:width<1280});
          await evaluate(`document.body.style.zoom=${JSON.stringify(String(scale))};scrollTo(0,0)`);await evaluate('document.fonts.ready.then(()=>true)');await pause(120);
          const geometry=await layout();
          if(geometry.labels.some(p=>p.clipped)||geometry.scrollWidth>width){await screenshot(`before-next-diagnostic-${role}-${theme}-${width}-csszoom${scale}`);await writeFile(artifacts+'/diagnostic-layout.json',JSON.stringify({role,theme,width,cssZoom:scale,...geometry},null,2)+'\n');}
          assert.equal(geometry.viewport,width,'requested viewport');assert(geometry.labels.every(p=>!p.clipped),'dashboard headings and counters readable');assert(geometry.scrollWidth<=width,'no horizontal overflow');
          const statsPosition=await revealHeading('main section h2');await screenshot(`after-next-${role}-${state}-${theme}-${width}-csszoom${scale}-stats`);
          const actionsPosition=await revealHeading(role==='admin'?'main a[href="/admin/students/create"]':'main a[href="/admin/admins"]');await screenshot(`after-next-${role}-${state}-${theme}-${width}-csszoom${scale}-actions`);
          measurements.push({role,state,theme,width,cssZoom:scale,...geometry,statsPosition,actionsPosition,source:'controlled-synthetic-aggregate-presentation',nativeZoom:false});
        }
        await evaluate("document.body.style.zoom='1';scrollTo(0,0)");
        if(state==='loading'){stage='data';await Promise.all(held.splice(0).map(requestId=>respond(requestId,'data')));await stateReady('data');}
      }
      stage='data';await cdp('Page.reload');await stateReady('data');
      if(role==='admin'){
        await evaluate("(()=>{const e=document.querySelector('#semester');e.value='3';e.dispatchEvent(new Event('change',{bubbles:true}));})()");await pause(200);
        const queries=await evaluate("[...document.querySelectorAll('main span.uppercase')].map(e=>new URL(e.closest('a').href).searchParams.get('semester'))");assert.equal(queries.length,5);assert(queries.every(v=>v==='3'),'all statistic links preserve semester');
      }
      stage='loading';const before=controlledRequests;await evaluate("(()=>{const b=document.querySelector('main button[aria-label=\"Actualizar estadísticas\"]');b.click();b.click();})()");await until("document.querySelector('main button[aria-label=\"Actualizar estadísticas\"]')?.disabled",'refresh pending');assert.equal(controlledRequests-before,1,'double refresh shares one GET');
      stage='updated';await Promise.all(held.splice(0).map(requestId=>respond(requestId,'updated')));await stateReady('updated');
      stage='forbidden';await evaluate("window.dispatchEvent(new Event('visibilitychange'))");await stateReady('error');
      assert(!await evaluate("document.querySelector('main').textContent.includes('Vacuna sintética')||document.querySelector('main').textContent.includes('Completo (60)')||document.querySelector('main').textContent.includes('Campus sintético')"),'403 hides every old analysis');
      stage='data';await activate('main [role=alert] button');await stateReady('data');
      await activate('main button[aria-controls]');assert(await evaluate("document.querySelector('main button[aria-controls]').getAttribute('aria-expanded')==='true'"),'ranking expanded by explicit keyboard activation');
    }
    stage='expired';await evaluate("window.dispatchEvent(new Event('visibilitychange'))");await until("location.pathname==='/login'",'existing expiry handling');await cdp('Fetch.disable');
  }
  stage='real';await login('student');assert.equal(await evaluate("fetch('/api/admin/statistics').then(r=>r.status)"),403,'student denied statistics by real API');
  assert.equal(unexpectedMutation,0,'statistics never mutate');assert.equal(transportErrors.length,0,'CDP transport');await writeFile(artifacts+'/next-measurements.json',JSON.stringify(measurements,null,2)+'\n');
  console.log('PASS: administrative dashboards, role permissions, states, refresh, filters, safe errors, themes, keyboard and session handling');
}finally{await Promise.allSettled(held.splice(0).map(requestId=>respond(requestId,'data')));ws.close();}
