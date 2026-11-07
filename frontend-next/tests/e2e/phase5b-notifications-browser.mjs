// Real production controls + synthetic PostgreSQL. No institutional data or session values exported.
import assert from 'node:assert/strict';
import { mkdir, readFile, writeFile } from 'node:fs/promises';
const {PHASE5A_CDP:cdpUrl,PHASE5A_WEB:web,PHASE5B_ARTIFACT_DIR:shared}=process.env;
assert(shared,'Explicit artifact directory required');
const artifacts=shared+'/../notifications-comparison';await mkdir(artifacts,{recursive:true});
const refreshArtifacts=shared+'/../notification-refresh';await mkdir(refreshArtifacts,{recursive:true});
const reflowArtifacts=shared+'/../notification-reflow';await mkdir(reflowArtifacts,{recursive:true});
const pages=await (await fetch(cdpUrl+'/json/list')).json();
const ws=new WebSocket(pages.find(p=>p.type==='page').webSocketDebuggerUrl);
await new Promise(r=>ws.addEventListener('open',r,{once:true}));
let id=0;
let stage='real';
let payload=[];
let controlledRequests=0;
const held=[],transportErrors=[];
const pending=new Map(),measurements=[],refreshMeasurements=[],reflowMeasurements=[];
ws.addEventListener('message',event=>{
  const m=JSON.parse(event.data),call=pending.get(m.id);
  if(call){pending.delete(m.id);if(m.error)call.reject(new Error(m.error.message));else call.resolve(m.result);}
  if(m.method==='Fetch.requestPaused'){
    const request=m.params.request;
    if(request.method!=='GET'||stage==='real')cdp('Fetch.continueRequest',{requestId:m.params.requestId}).catch(()=>transportErrors.push('continue failed'));
    else {
      controlledRequests++;
      if(stage==='loading')held.push(m.params.requestId);
      else respond(m.params.requestId,stage).catch(()=>transportErrors.push('response failed'));
    }
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
async function screenshot(name,folder=artifacts){await evaluate('document.fonts.ready.then(()=>true)');const r=await cdp('Page.captureScreenshot',{format:'png',captureBeyondViewport:false});await writeFile(folder+'/'+name+'.png',Buffer.from(r.data,'base64'));}
async function assertReadableNotice(fullMessage=true){
  const geometry=await evaluate(`(()=>{
    const button=document.querySelector('main ul button'), paragraphs=[...button.querySelectorAll('p')];
    return paragraphs.map(p=>{const bounds=p.getBoundingClientRect(),range=document.createRange();range.selectNodeContents(p);
      const fragments=[...range.getClientRects()];const style=getComputedStyle(p);
      return {width:bounds.width,clipped:fragments.some(r=>r.left<bounds.left-1||r.right>bounds.right+1||r.top<bounds.top-1||r.bottom>bounds.bottom+1),ellipsis:style.textOverflow==='ellipsis',clamp:style.webkitLineClamp};});
  })()`);
  assert(geometry.every((p,index)=>index===1&&!fullMessage||!p.clipped&&!p.ellipsis&&p.clamp!=='2'),'notification title, message and date fully readable at narrow width');
  return geometry;
}
async function assertBadgePaint(){
  await evaluate('document.fonts.ready.then(()=>true)');
  const capture=await cdp('Page.captureScreenshot',{format:'png',captureBeyondViewport:false});
  const sample=await evaluate(`(async()=>{
    const badge=document.querySelector('main span.inline-flex'),r=badge.getBoundingClientRect();
    const image=new Image();image.src=${JSON.stringify('data:image/png;base64,'+capture.data)};await image.decode();
    const canvas=document.createElement('canvas');canvas.width=image.width;canvas.height=image.height;
    const context=canvas.getContext('2d');context.drawImage(image,0,0);
    const pixels=[0.5,0.6,0.7].map(fraction=>[...context.getImageData(Math.floor(r.left+r.width*fraction),Math.floor(r.top+1),1,1).data].slice(0,3));
    const expected=getComputedStyle(badge).backgroundColor.match(/\\d+/g).slice(0,3).map(Number);
    return {pixels,expected};
  })()`);
  for(const pixel of sample.pixels)assert.deepEqual(pixel,sample.expected,'decoration must not paint over the opaque unread badge');
  return sample;
}
async function captureReflow(role,theme,state){
  for(const [width,scale] of [[320,1],[390,2],[1280,1]]){
    await cdp('Emulation.setDeviceMetricsOverride',{width,height:844,deviceScaleFactor:1,mobile:width<1280});
    await evaluate(`document.body.style.zoom=${JSON.stringify(String(scale))};document.querySelector('main ul button').scrollIntoView({block:'start'})`);await pause(120);
    const notice=await assertReadableNotice(width<1280),position=await assertBelowHeader('main ul button');
    const keyboardSeparate=await evaluate("(()=>{const open=document.querySelector('main ul button'),mark=document.querySelector('main ul button[title=\"Marcar como leída\"]');return !!mark&&!open.contains(mark);})()");
    assert(keyboardSeparate,'separate native notification actions during reflow');
    assert(await evaluate('document.documentElement.scrollWidth<=innerWidth'),'no document horizontal overflow');
    const badgePaint=width===1280?await assertBadgePaint():null;
    const name=`${state}-${role}-${theme}-${width}-csszoom${scale}`;
    await screenshot(name,reflowArtifacts);
    if(width<1280){
      await evaluate("document.querySelector('main ul button').focus()");await key('Tab','Tab',9);
      assert(await evaluate("document.activeElement===document.querySelector('main ul button[title=\"Marcar como leída\"]')"),'Tab reaches independent mark-read action');
      await evaluate("document.activeElement.scrollIntoView({block:'start'})");await assertBelowHeader('main ul button[title="Marcar como leída"]');
    }
    reflowMeasurements.push({role,theme,state,width,cssZoom:scale,notice,position,keyboardSeparate,badgePaint,source:'controlled-synthetic-response',nativeZoom:false});
  }
  await cdp('Emulation.setDeviceMetricsOverride',{width:390,height:844,deviceScaleFactor:1,mobile:true});
  await evaluate("document.body.style.zoom='1';scrollTo(0,0)");
}
async function assertBelowHeader(selector){
  const geometry=await evaluate(`(()=>{const target=document.querySelector(${JSON.stringify(selector)}),r=target.getBoundingClientRect(),header=document.querySelector('header').getBoundingClientRect();return {top:r.top,headerBottom:header.bottom};})()`);
  assert(geometry.top>=geometry.headerBottom+7,'scrolled content is below the sticky header');
  return geometry;
}
async function input(selector,value){await evaluate(`(()=>{const e=document.querySelector(${JSON.stringify(selector)});Object.getOwnPropertyDescriptor(HTMLInputElement.prototype,'value').set.call(e,${JSON.stringify(value)});e.dispatchEvent(new Event('input',{bubbles:true}));})()`);}
async function login(role){
  await cdp('Network.clearBrowserCookies');await cdp('Page.navigate',{url:web+'/login'});
  await until("document.querySelector('#email')&&Object.keys(document.querySelector('#email')).some(k=>k.startsWith('__reactProps'))",'hydrated login');
  await input('#email',role+'@example.com');await input('#password','SyntheticOnly123!');await activate('button[type="submit"]');
  await until(`location.pathname===${JSON.stringify(role==='student'?'/student':'/admin')}`,'synthetic role dashboard');
}

async function respond(requestId,state){
  const status=({error:503,forbidden:403,expired:401})[state]??200;
  const body=state==='empty'?[]:state==='read'?payload.map(n=>({...n,is_read:true})):status!==200?{code:'SYNTHETIC_ERROR',message:'Synthetic internal diagnostic',details:null}:payload;
  await cdp('Fetch.fulfillRequest',{requestId,responseCode:status,responseHeaders:[{name:'Content-Type',value:'application/json'},{name:'Cache-Control',value:'no-store'}],body:Buffer.from(JSON.stringify(body)).toString('base64')});
}
const pause=ms=>new Promise(r=>setTimeout(r,ms));
async function stateReady(state){
  const expressions={unread:"document.body.textContent.includes('Synthetic notice 1')&&document.body.textContent.includes('No leída')",read:"document.body.textContent.includes('Synthetic notice 1')&&!document.querySelector('button[title=\"Marcar como leída\"]')",empty:"document.body.textContent.includes('No tienes notificaciones')",loading:"document.body.textContent.includes('Cargando...')",error:"Boolean(document.querySelector('[role=\"alert\"]'))&&document.body.textContent.includes('Reintentar')"};
  await until('Boolean(document.body)&&('+expressions[state]+')',state+' visible');
}
try{
  await cdp('Page.enable');
  await cdp('Emulation.setDeviceMetricsOverride',{width:390,height:844,deviceScaleFactor:1,mobile:true});
  const fixture=JSON.parse(await readFile('../docs/ui/fixtures/phase5b-notifications.json','utf8'));
  for(const role of ['student','admin']){
    stage='real';await login(role);await cdp('Page.navigate',{url:web+'/'+role+'/notifications'});await stateReady('unread');
    payload=await evaluate("fetch('/api/notifications/').then(r=>r.json())");
    for(const item of fixture)assert(payload.some(n=>n.title===item.title&&n.message===item.message&&n.created_at.replace('+00:00','Z')===item.created_at),'real backend fixture');
    await cdp('Fetch.enable',{patterns:[{urlPattern:'*/api/notifications/',requestStage:'Request'}]});
    for(const theme of ['light','dark']){
      await evaluate(`localStorage.setItem('ic_theme',JSON.stringify({state:{mode:${JSON.stringify(theme)}}}))`);
      await cdp('Emulation.setEmulatedMedia',{features:[{name:'prefers-color-scheme',value:theme==='light'?'dark':'light'}]});
      for(const state of ['unread','read','empty','loading','error']){
        stage=state;await cdp('Page.reload');await stateReady(state);
        for(const scale of [1,2]){
          // CSS zoom is a controlled layout stress test, not browser zoom or a device.
          await evaluate(`document.body.style.zoom=${JSON.stringify(String(scale))};scrollTo(0,0)`);await pause(120);
          const geometry=await evaluate('({viewport:innerWidth,scrollWidth:document.documentElement.scrollWidth,font:getComputedStyle(document.body).fontFamily})');
          assert.equal(geometry.viewport,390);assert(geometry.scrollWidth<=390,'document overflow at CSS zoom '+scale);
          await screenshot('after-next-notifications-'+role+'-'+state+'-'+theme+'-390-csszoom'+scale);
          if(scale===2){
            await evaluate("(()=>{const target=document.querySelector('main h1')??document.querySelector('main [role=alert]')??document.querySelector('main');target.scrollIntoView({block:'start'});})()");await pause(120);
            const content=await evaluate("(()=>{const target=document.querySelector('main h1')??document.querySelector('main [role=alert]')??document.querySelector('main'),r=target.getBoundingClientRect();return {top:r.top,bottom:r.bottom,scrollY};})()");
            assert(content.top>=-1&&content.top<844,'content reachable by vertical scroll');
            await assertBelowHeader('main h1, main [role=alert]');
            if(state==='unread'||state==='read')await assertReadableNotice();
            await screenshot('after-next-notifications-'+role+'-'+state+'-'+theme+'-390-csszoom2-content');
            measurements.push({role,state,theme,width:390,cssZoom:scale,content_scroll:content});
          }
          measurements.push({role,state,theme,width:390,cssZoom:scale,...geometry,source:state==='unread'?'backend-fixture-response':'controlled-response-for-presentation'});
        }
        await evaluate("document.body.style.zoom='1';scrollTo(0,0)");
        if(state==='loading'){await Promise.all(held.splice(0).map(requestId=>respond(requestId,'empty')));await stateReady('empty');}
      }
      // Trigger the installed Query focus listener, without adding production hooks.
      stage='unread';await cdp('Page.reload');await stateReady('unread');
      await captureReflow(role,theme,'unread');
      const ordinaryPayload=payload;
      payload=payload.map((n,index)=>index===0?{...n,title:'Synthetic notice 1 with a longer title that must remain readable in a narrow notification row',message:'SyntheticLongWordWithoutSpacesForReflowTestingOnly'.repeat(3),action_path:`/${role}/profile`}:n);
      await evaluate("window.dispatchEvent(new Event('visibilitychange'))");
      await until("document.querySelector('main').textContent.includes('longer title')",'long synthetic copy loaded');
      await captureReflow(role,theme,'long-copy');
      payload=ordinaryPayload;
      await evaluate("window.dispatchEvent(new Event('visibilitychange'))");
      await until("!document.querySelector('main').textContent.includes('longer title')",'ordinary synthetic copy restored');
      stage='error';await evaluate("window.dispatchEvent(new Event('visibilitychange'))");await stateReady('error');
      assert.equal(await evaluate("document.querySelectorAll('[role=alert]').length"),1,'one notification error, not duplicated by shell');
      assert(await evaluate("document.querySelector('main').textContent.includes('Synthetic notice 1')&&document.querySelector('main').textContent.includes('Se muestran las últimas notificaciones cargadas.')"),'failed refresh retains notices with warning');
      assert(!await evaluate("document.body.textContent.includes('Synthetic internal diagnostic')"),'safe error message only');
      await screenshot('retained-'+role+'-'+theme+'-390-csszoom1',refreshArtifacts);
      await evaluate("document.body.style.zoom='2';document.querySelector('main [role=alert]').scrollIntoView({block:'start'})");await pause(120);
      assert(await evaluate('document.documentElement.scrollWidth<=innerWidth'),'retained error has no horizontal overflow');
      await assertBelowHeader('main [role=alert]');
      await assertReadableNotice();
      await screenshot('retained-'+role+'-'+theme+'-390-csszoom2-content',refreshArtifacts);
      await evaluate("document.body.style.zoom='1';scrollTo(0,0)");
      await captureReflow(role,theme,'retained');
      stage='loading';const beforeRetry=controlledRequests;
      await evaluate("(()=>{const button=document.querySelector('main [role=alert] button');button.click();button.click();})()");
      await until("Boolean(document.querySelector('main [role=alert] button:disabled'))",'retry disabled while pending');
      await pause(150);const retryRequests=controlledRequests-beforeRetry;assert.equal(retryRequests,1,'double retry shares one request');assert.equal(held.length,1,'one delayed retry');
      assert(await evaluate("document.querySelector('main').textContent.includes('Synthetic notice 1')"),'pending retry retains data');
      await screenshot('retrying-'+role+'-'+theme+'-390',refreshArtifacts);
      stage='read';await Promise.all(held.splice(0).map(requestId=>respond(requestId,'read')));await stateReady('read');
      assert(!await evaluate("Boolean(document.querySelector('main [role=alert]'))"),'successful retry clears warning');
      await screenshot('recovered-'+role+'-'+theme+'-390',refreshArtifacts);
      stage='forbidden';await evaluate("window.dispatchEvent(new Event('visibilitychange'))");await stateReady('error');
      await until("document.querySelector('main').textContent.includes('No tienes permiso para consultar esta información.')",'403 message rendered');
      assert(!await evaluate("document.querySelector('main').textContent.includes('Synthetic notice 1')"),'403 hides cached notices');
      assert(!await evaluate("Boolean(document.querySelector('main button[title=\"Marcar como leída\"]'))"),'403 hides notification actions');
      await screenshot('forbidden-'+role+'-'+theme+'-390',refreshArtifacts);
      stage='error';await evaluate("window.dispatchEvent(new Event('visibilitychange'))");
      await until("document.querySelector('main').textContent.includes('El servicio no está disponible temporalmente.')",'503 after denial');
      assert(!await evaluate("document.querySelector('main').textContent.includes('Synthetic notice 1')"),'503 cannot reverse previous access denial');
      await screenshot('blocked-after-denial-'+role+'-'+theme+'-390',refreshArtifacts);
      await evaluate(`document.querySelector('nav[aria-label="Navegación de módulos"] a[href="/${role}/history"]').click()`);
      await until(`document.querySelector('main h1')?.textContent===${JSON.stringify(role==='student'?'Mi historial':'Historial general')}`,'history navigation');
      await evaluate(`document.querySelector('nav[aria-label="Navegación de módulos"] a[href="/${role}/notifications"]').click()`);
      await until(`location.pathname===${JSON.stringify('/'+role+'/notifications')}`, 'notification remount');await stateReady('error');
      assert(!await evaluate("document.querySelector('main').textContent.includes('Synthetic notice 1')"),'navigation preserves previous access denial');
      stage='unread';await evaluate("window.dispatchEvent(new Event('visibilitychange'))");await stateReady('unread');
      assert(!await evaluate("Boolean(document.querySelector('main [role=alert]'))"),'new successful GET restores presentation');
      refreshMeasurements.push({role,theme,width:390,source:'controlled-CDP-503-delayed-retry-200-403-503-navigation-200',retained:true,retry_requests:retryRequests,forbidden_hides_data:true,denial_survives_transient_error:true,navigation_preserves_denial:true,css_zoom_is_not_native_zoom:true});
    }
    stage='real';await cdp('Fetch.disable');
    await cdp('Page.reload');await stateReady('unread');
    assert.equal(await evaluate("fetch('/api/admin/admins').then(r=>r.status)"),403,'notifications do not confer app_admin permission');
    await cdp('Fetch.enable',{patterns:[{urlPattern:'*/api/notifications/',requestStage:'Request'}]});
    stage='expired';await evaluate("window.dispatchEvent(new Event('visibilitychange'))");
    await until("location.pathname==='/login'",'401 routes to login');
    assert(!await evaluate("document.body.textContent.includes('Synthetic notice 1')"),'expired session hides retained data');
    await cdp('Fetch.disable');stage='real';
  }
  assert.equal(transportErrors.length,0,'CDP transport errors');
  await writeFile(artifacts+'/next-measurements.json',JSON.stringify(measurements,null,2)+'\n');
  await writeFile(refreshArtifacts+'/measurements.json',JSON.stringify(refreshMeasurements,null,2)+'\n');
  await writeFile(reflowArtifacts+'/measurements.json',JSON.stringify(reflowMeasurements,null,2)+'\n');
  console.log('PASS: paired notification fixture, refresh/retry/403/401, themes, CSS zoom and actual permission rejection');
}finally{
  await Promise.allSettled(held.splice(0).map(requestId=>respond(requestId,'empty')));
  ws.close();
}
