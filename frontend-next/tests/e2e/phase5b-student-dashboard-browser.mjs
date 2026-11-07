// Synthetic presentation states. Clinical signals are supplied, never evaluated here.
import assert from 'node:assert/strict';
import { mkdir, readFile, writeFile } from 'node:fs/promises';
const {PHASE5A_CDP:cdpUrl,PHASE5A_WEB:web,PHASE5B_ARTIFACT_DIR:shared}=process.env;
assert(shared,'Explicit artifact folder required');
const artifacts=shared+'/../student-dashboard';await mkdir(artifacts,{recursive:true});
const fixture=JSON.parse(await readFile('../docs/ui/fixtures/phase5b-student-dashboard.json','utf8'));
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
  const body=status!==200?{code:'SYNTHETIC_ERROR',message:'Synthetic unsafe diagnostic',details:null}:state==='up-to-date'?{...fixture.data,is_up_to_date:true,is_complete:false,is_certifiable:true}:fixture[state]??fixture.data;
  await cdp('Fetch.fulfillRequest',{requestId,responseCode:status,responseHeaders:[{name:'Content-Type',value:'application/json'},{name:'Cache-Control',value:'no-store'}],body:Buffer.from(JSON.stringify(body)).toString('base64')});
}
async function stateReady(state){
  const expressions={data:"document.querySelector('main section')?.textContent.includes('10')&&document.querySelector('main').textContent.includes('Requiere atención')",empty:"document.querySelector('main section')?.textContent.includes('Denegadas')&&!document.querySelector('main section').textContent.includes('…')",loading:"document.querySelector('main section')?.getAttribute('aria-busy')==='true'&&document.querySelector('main section').textContent.includes('…')",error:"Boolean(document.querySelector('main [role=alert]'))",'up-to-date':"document.querySelector('main').textContent.includes('Al día')"};
  await until('Boolean(document.body)&&('+expressions[state]+')',state+' ready');
}
async function layout(){
  const geometry=await evaluate(`(()=>{
    const texts=[...document.querySelectorAll('main h1, main h2, main h3, main section span.uppercase')];
    return {viewport:innerWidth,scrollWidth:document.documentElement.scrollWidth,labels:texts.map(p=>{const b=p.getBoundingClientRect(),range=document.createRange();range.selectNodeContents(p);return {width:b.width,clipped:[...range.getClientRects()].some(r=>r.left<b.left-1||r.right>b.right+1||r.top<b.top-1||r.bottom>b.bottom+1)};})};
  })()`);
  assert(geometry.labels.every(p=>!p.clipped),'dashboard titles and counter labels readable');
  assert(geometry.scrollWidth<=geometry.viewport,'dashboard has no horizontal overflow');
  return geometry;
}
try{
  await cdp('Page.enable');await cdp('Emulation.setDeviceMetricsOverride',{width:390,height:844,deviceScaleFactor:1,mobile:true});
  await cdp('Page.navigate',{url:web+'/login'});
  await until("document.querySelector('#email')&&Object.keys(document.querySelector('#email')).some(k=>k.startsWith('__reactProps'))",'hydrated login');
  await input('#email','student@example.com');await input('#password','SyntheticOnly123!');await activate('button[type=submit]');
  await until("location.pathname==='/student'&&Boolean(document.querySelector('main section'))",'real student dashboard');
  const real=await evaluate("fetch('/api/scheme/').then(r=>r.json())");
  const realCounters=await evaluate("[...document.querySelectorAll('main section span.uppercase')].map(e=>({label:e.textContent,value:Number(e.parentElement.lastElementChild.textContent)}))");
  for(const [label,field] of [['Total','total_vaccines'],['Aprobadas','approved_vaccines'],['Pendientes','pending_vaccines'],['Denegadas','denied_vaccines'],['En revisión','in_review_vaccines']]){
    assert.equal(realCounters.find(c=>c.label===label)?.value,real[field],'real backend counter '+label);
  }
  assert.equal(await evaluate("fetch('/api/admin/admins').then(r=>r.status)"),403,'student has no administrative permission');
  await cdp('Fetch.enable',{patterns:[{urlPattern:'*/api/scheme/',requestStage:'Request'}]});
  for(const theme of ['light','dark']){
    await evaluate(`localStorage.setItem('ic_theme',JSON.stringify({state:{mode:${JSON.stringify(theme)}}}))`);
    await cdp('Emulation.setEmulatedMedia',{features:[{name:'prefers-color-scheme',value:theme==='light'?'dark':'light'}]});
    for(const state of ['data','empty','loading','error']){
      stage=state;await cdp('Page.reload');await stateReady(state);
      assert(await evaluate("document.querySelector('main').textContent.includes('Acciones rápidas')"),'quick actions survive every state');
      if(['loading','error'].includes(state))assert(!await evaluate("document.querySelector('main').textContent.includes('Requiere atención')||document.querySelector('main').textContent.includes('Al día')"),'no clinical signal without successful data');
      assert(!await evaluate("document.body.textContent.includes('Synthetic unsafe diagnostic')"),'only safe errors displayed');
      for(const [width,scale] of [[390,1],[390,2],[1280,1]]){
        await cdp('Emulation.setDeviceMetricsOverride',{width,height:844,deviceScaleFactor:1,mobile:width<1280});
        await evaluate(`document.body.style.zoom=${JSON.stringify(String(scale))};scrollTo(0,0)`);await evaluate('document.fonts.ready.then(()=>true)');await pause(120);
        const geometry=await layout();assert.equal(geometry.viewport,width,'viewport has not auto-shrunk');
        const statsPosition=await revealHeading('main section h2');
        await screenshot(`after-next-dashboard-${state}-${theme}-${width}-csszoom${scale}-stats`);
        const actionsPosition=await revealHeading('main section ~ div h2');
        await screenshot(`after-next-dashboard-${state}-${theme}-${width}-csszoom${scale}-actions`);
        measurements.push({state,theme,width,cssZoom:scale,...geometry,statsPosition,actionsPosition,source:'controlled-synthetic-aggregate-presentation',nativeZoom:false});
      }
      await evaluate("document.body.style.zoom='1';scrollTo(0,0)");
      if(state==='loading'){stage='data';await Promise.all(held.splice(0).map(requestId=>respond(requestId,'data')));await stateReady('data');}
    }
    stage='data';await cdp('Page.reload');await stateReady('data');
    stage='loading';const before=controlledRequests;
    await evaluate("(()=>{const b=document.querySelector('main button[aria-label=\"Actualizar estadísticas\"]');b.click();b.click();})()");
    await until("document.querySelector('main button[aria-label=\"Actualizar estadísticas\"]')?.disabled",'refresh disabled');
    assert.equal(controlledRequests-before,1,'double refresh shares one GET');
    stage='up-to-date';await Promise.all(held.splice(0).map(requestId=>respond(requestId,'up-to-date')));await stateReady('up-to-date');
    stage='forbidden';await evaluate("window.dispatchEvent(new Event('visibilitychange'))");await stateReady('error');
    await until("document.querySelector('main').textContent.includes('No tienes permiso')",'denial visible');
    assert(!await evaluate("Boolean(document.querySelector('main section span.uppercase'))"),'denial hides cached counters');
    stage='data';await activate('main [role=alert] button');await stateReady('data');
  }
  stage='error';await cdp('Page.reload');await stateReady('error');
  await activate('main a[href="/student/evidence"]');
  await until("location.pathname==='/student/evidence'",'error retains evidence navigation');
  stage='data';await cdp('Page.navigate',{url:web+'/student'});await stateReady('data');
  stage='expired';await evaluate("window.dispatchEvent(new Event('visibilitychange'))");await until("location.pathname==='/login'",'401 uses existing session expiry');
  assert(!await evaluate("document.body.textContent.includes('Estadísticas de vacunas')"),'expiry removes student content');
  assert.equal(unexpectedMutation,0,'dashboard does not mutate scheme');assert.equal(transportErrors.length,0,'CDP transport');
  await writeFile(artifacts+'/next-measurements.json',JSON.stringify(measurements,null,2)+'\n');
  console.log('PASS: student dashboard backend counters, states, refresh, permissions, navigation, themes and responsive presentation');
}finally{
  await Promise.allSettled(held.splice(0).map(requestId=>respond(requestId,'data')));ws.close();
}
