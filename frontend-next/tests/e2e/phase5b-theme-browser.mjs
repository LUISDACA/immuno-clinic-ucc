// Actual production Next CSS and components over the synthetic PostgreSQL harness.
import assert from 'node:assert/strict';
import { mkdir, writeFile } from 'node:fs/promises';
const {PHASE5A_CDP:cdpUrl,PHASE5A_WEB:web,PHASE5B_ARTIFACT_DIR:artifacts}=process.env;
assert(artifacts,'An explicit artifact directory is required');
await mkdir(artifacts,{recursive:true});
const tabs=await (await fetch(cdpUrl+'/json/list')).json();
const ws=new WebSocket(tabs.find(t=>t.type==='page').webSocketDebuggerUrl);
await new Promise(r=>ws.addEventListener('open',r,{once:true}));
let id=0;
const pending=new Map(), measurements=[];
ws.addEventListener('message',event=>{
  const m=JSON.parse(event.data), call=pending.get(m.id);
  if(call){pending.delete(m.id);if(m.error)call.reject(new Error(m.error.message));else call.resolve(m.result);}
});
function cdp(method,params={}){return new Promise((resolve,reject)=>{const n=++id;pending.set(n,{resolve,reject});ws.send(JSON.stringify({id:n,method,params}));});}
async function evaluate(expression){const r=await cdp('Runtime.evaluate',{expression,awaitPromise:true,returnByValue:true});assert(!r.exceptionDetails,'Browser evaluation failed');return r.result.value;}
const delay=ms=>new Promise(r=>setTimeout(r,ms));
async function until(expression,label){for(let i=0;i<100;i++){if(await evaluate(expression))return;await delay(100);}throw new Error('Timeout: '+label);}
async function ready(){await until("document.querySelector('#email') && Object.keys(document.querySelector('#email')).some(k=>k.startsWith('__reactProps'))",'hydrated login');await evaluate('document.fonts.ready.then(()=>true)');}
async function mode(value,os){await cdp('Emulation.setEmulatedMedia',{features:[{name:'prefers-color-scheme',value:os}]});await evaluate(`localStorage.setItem('ic_theme',JSON.stringify({state:{mode:${JSON.stringify(value)}}}))`);await cdp('Page.reload');await until(`document.documentElement.dataset.theme===${JSON.stringify(['light','dark','system'].includes(value)?value:'system')}`,'restored theme');}
async function screenshot(name,directory=artifacts){await evaluate('document.fonts.ready.then(()=>true)');const r=await cdp('Page.captureScreenshot',{format:'png',captureBeyondViewport:false});await writeFile(directory+'/'+name+'.png',Buffer.from(r.data,'base64'));}
function luminance(rgb){const c=rgb.map(v=>v/255).map(v=>v<=.04045?v/12.92:((v+.055)/1.055)**2.4);return c[0]*.2126+c[1]*.7152+c[2]*.0722;}
function ratio(fg,bg){const l=[luminance(fg),luminance(bg)].sort((a,b)=>b-a);return (l[0]+.05)/(l[1]+.05);}
async function colors(selector){return await evaluate(`(()=>{const e=document.querySelector(${JSON.stringify(selector)});if(!e)return null;const s=getComputedStyle(e);return {foreground:s.color,background:s.backgroundColor};})()`);}
const rgb=v=>v.match(/[\d.]+/g).slice(0,3).map(Number);
async function checkColor(name,selector,expected){const value=await colors(selector);assert(value,name+' exists');if(expected)assert.equal(value.background,expected);const contrast=ratio(rgb(value.foreground),rgb(value.background));assert(contrast>=4.5,name+' contrast '+contrast);return {...value,contrast};}
async function input(selector,value){await evaluate(`(()=>{const e=document.querySelector(${JSON.stringify(selector)});Object.getOwnPropertyDescriptor(HTMLInputElement.prototype,'value').set.call(e,${JSON.stringify(value)});e.dispatchEvent(new Event('input',{bubbles:true}));})()`);}
async function clickText(text){await until(`Array.from(document.querySelectorAll('button')).some(b=>b.textContent.trim()===${JSON.stringify(text)})`,'button '+text);await evaluate(`Array.from(document.querySelectorAll('button')).find(b=>b.textContent.trim()===${JSON.stringify(text)}).click()`);}
async function key(key,code,virtualCode,text){
  await cdp('Input.dispatchKeyEvent',{type:'keyDown',key,code,windowsVirtualKeyCode:virtualCode});
  if(text)await cdp('Input.dispatchKeyEvent',{type:'char',text,unmodifiedText:text,key,code,windowsVirtualKeyCode:virtualCode});
  await cdp('Input.dispatchKeyEvent',{type:'keyUp',key,code,windowsVirtualKeyCode:virtualCode});
}
async function loginRole(role){
  await cdp('Network.clearBrowserCookies');await cdp('Page.navigate',{url:web+'/login'});await ready();
  await input('#email',role+'@example.com');await input('#password','SyntheticOnly123!');await clickText('Ingresar');
  await until(`location.pathname===${JSON.stringify('/'+role)}`,'synthetic role dashboard');
}
async function tagAccordion(expanded=true){
  await until("Array.from(document.querySelectorAll('button[aria-expanded]')).some(b=>b.textContent.includes('Synthetic vaccine'))",'loaded synthetic vaccine');
  if(expanded){
    await evaluate("(()=>{const b=Array.from(document.querySelectorAll('button[aria-expanded]')).find(b=>b.textContent.includes('Synthetic vaccine'));if(b.getAttribute('aria-expanded')!=='true')b.click();})()");
    await until("Array.from(document.querySelectorAll('button[aria-expanded]')).some(b=>b.textContent.includes('Synthetic vaccine')&&b.getAttribute('aria-expanded')==='true')",'expanded synthetic vaccine');
  }else{
    await until("Array.from(document.querySelectorAll('button[aria-expanded]')).some(b=>b.textContent.includes('Synthetic vaccine')&&b.getAttribute('aria-expanded')==='false')",'collapsed synthetic vaccine');
  }
  await evaluate("(()=>{const b=Array.from(document.querySelectorAll('button[aria-expanded]')).find(b=>b.textContent.includes('Synthetic vaccine'));b.setAttribute('data-phase5b-accordion','');b.parentElement.setAttribute('data-phase5b-card','');Array.from(b.querySelectorAll('span[style]')).find(s=>s.style.color).setAttribute('data-phase5b-status','');})()");
}
async function checkAccordion(expected){
  const state=await evaluate("(()=>{const b=document.querySelector('[data-phase5b-accordion]');const p=document.getElementById(b.getAttribute('aria-controls'));return {expanded:b.getAttribute('aria-expanded'),hidden:p.hidden,labelled:p.getAttribute('aria-labelledby')===b.id,region:p.getAttribute('role')};})()");
  assert.equal(state.expanded,String(expected));assert.equal(state.hidden,!expected);assert.equal(state.labelled,true);assert.equal(state.region,'region');
  return state;
}
async function checkSchemeReflow(screen,preference,directory){
  const geometry=[];
  for(const [width,height,mobile] of [[320,568,true],[390,844,true],[768,1024,true],[1440,900,false]]){
    await cdp('Emulation.setDeviceMetricsOverride',{width,height,deviceScaleFactor:1,mobile});
    await until(`document.documentElement.clientWidth===${width}`,'scheme viewport resize');
    const value=await evaluate('({innerWidth,clientWidth:document.documentElement.clientWidth,scrollWidth:document.documentElement.scrollWidth})');
    assert.equal(value.innerWidth,width);assert(value.scrollWidth<=width,'scheme horizontal overflow');
    geometry.push({width,height,mobile,...value});
    if(width===390)await screenshot('after-'+screen+'-'+preference+'-mobile',directory);
  }
  return geometry;
}
try {
  await cdp('Page.enable');await cdp('Emulation.setDeviceMetricsOverride',{width:1440,height:900,deviceScaleFactor:1,mobile:false});
  await cdp('Page.navigate',{url:web+'/login'});await ready();
  for(const [preference,os] of [['light','dark'],['dark','light'],['system','light'],['system','dark']]){
    await mode(preference,os);await ready();
    const dark=preference==='dark'||(preference==='system'&&os==='dark');
    const body=await colors('body');assert.equal(body.background,dark?'rgb(7, 20, 22)':'rgb(246, 250, 250)');
    const button=await checkColor('primary action','button[type="submit"]',dark?'rgb(69, 210, 223)':'rgb(0, 127, 147)');
    const semantic=await evaluate(`(()=>{const root=getComputedStyle(document.documentElement);return ['success','warning','destructive','info'].map(t=>({tone:t,foreground:root.getPropertyValue('--'+t+'-text').trim(),background:root.getPropertyValue('--'+t+'-light').trim()}));})()`);
    const hex=v=>{const full=v.length===4?'#'+v.slice(1).split('').map(c=>c+c).join(''):v;return [1,3,5].map(i=>parseInt(full.slice(i,i+2),16));};
    for(const value of semantic){value.contrast=ratio(hex(value.foreground),hex(value.background));assert(value.contrast>=4.5,value.tone+' token contrast');}
    const palette=await evaluate(`(()=>{const s=getComputedStyle(document.documentElement);const names={background:'background',surface:'card',surface_variant:'surface-variant',foreground:'foreground',muted_foreground:'muted-foreground',primary:'primary',border:'border',divider:'divider'};return Object.fromEntries(Object.entries(names).map(([key,value])=>[key,s.getPropertyValue('--'+value).trim()]));})()`);
    measurements.push({screen:'login',preference,os,body,button,semantic,palette});
    await screenshot('next-login-'+preference+'-os-'+os);
  }
  // System preference changes through CSS without rewriting the stored mode.
  await cdp('Emulation.setEmulatedMedia',{features:[{name:'prefers-color-scheme',value:'light'}]});
  assert.equal((await colors('body')).background,'rgb(246, 250, 250)');
  assert.equal(await evaluate('document.documentElement.dataset.theme'),'system');
  await mode('sepia','dark');await ready();assert.equal((await colors('body')).background,'rgb(7, 20, 22)');
  await input('#email','student@example.com');await input('#password','SyntheticOnly123!');await clickText('Ingresar');
  await until("location.pathname==='/student' && document.body.textContent.includes('Requiere atención')",'actual student dashboard');
  // Keep this synthetic browser session in memory; do not exceed real login limits.
  const studentSession=(await cdp('Network.getCookies',{urls:[web]})).cookies.map(({name,value,domain,path,secure,httpOnly,sameSite,expires})=>({name,value,domain,path,secure,httpOnly,sameSite,...(expires>=0?{expires}:{})}));
  // Inspect the actual rendered Badge, not an injected palette fixture.
  await evaluate("Array.from(document.querySelectorAll('span')).find(e=>e.textContent.trim()==='Requiere atención').setAttribute('data-phase5b-badge','')");
  const badgeDark=await checkColor('dashboard badge','[data-phase5b-badge]','rgb(61, 44, 0)');
  await screenshot('next-dashboard-student-dark-os-dark');
  await evaluate("document.querySelector('button[aria-label=\"Opciones de usuario\"]').click()");
  await until("Boolean(document.querySelector('[aria-label=\"Tema de apariencia\"]'))",'theme selector');
  await evaluate("document.querySelector('button[aria-label=\"Opciones de usuario\"]').focus()");
  for(let i=0;i<20;i++){
    if(await evaluate("document.activeElement?.textContent.trim()==='Claro'"))break;
    await cdp('Input.dispatchKeyEvent',{type:'keyDown',key:'Tab',code:'Tab',windowsVirtualKeyCode:9});
    await cdp('Input.dispatchKeyEvent',{type:'keyUp',key:'Tab',code:'Tab',windowsVirtualKeyCode:9});
  }
  assert(await evaluate("document.activeElement?.textContent.trim()==='Claro'"),'native keyboard can reach theme choice');
  assert(await evaluate("getComputedStyle(document.activeElement).boxShadow!=='none'"),'visible keyboard focus');
  await cdp('Input.dispatchKeyEvent',{type:'keyDown',key:'Enter',code:'Enter',windowsVirtualKeyCode:13});
  await cdp('Input.dispatchKeyEvent',{type:'char',text:'\r',unmodifiedText:'\r',key:'Enter',code:'Enter',windowsVirtualKeyCode:13});
  await cdp('Input.dispatchKeyEvent',{type:'keyUp',key:'Enter',code:'Enter',windowsVirtualKeyCode:13});
  await until("document.documentElement.dataset.theme==='light' && getComputedStyle(document.querySelector('[data-phase5b-badge]')).backgroundColor==='rgb(255, 246, 214)'",'manual light applied and transition finished');
  assert.equal(await evaluate("document.querySelector('[aria-label=\"Tema de apariencia\"] button[aria-pressed=\"true\"]').textContent.trim()"),'Claro');
  const badgeLight=await checkColor('dashboard badge','[data-phase5b-badge]','rgb(255, 246, 214)');
  measurements.push({screen:'dashboard',preference:'light',os:'dark',badgeLight,badgeDark});
  await screenshot('next-theme-selector-keyboard-light-os-dark');
  await evaluate("document.querySelector('button[aria-label=\"Opciones de usuario\"]').click()");
  await screenshot('next-dashboard-student-light-os-dark');
  // The real 401 path renders the shared error Alert; no credential is institutional.
  await cdp('Network.clearBrowserCookies');await cdp('Page.navigate',{url:web+'/login'});await ready();
  await input('#email','nonexistent@example.invalid');await input('#password','SyntheticInvalid123!');await clickText('Ingresar');
  await until("Boolean(document.querySelector('[role=\"alert\"]'))",'login rejection alert');
  measurements.push({screen:'login-error',preference:'light',os:'dark',alert:await checkColor('error alert','[role="alert"]')});
  await screenshot('next-login-error-light-os-dark');
  // Compare with the requested width: expanded innerWidth can mask overflow.
  for(const [width,height,mobile] of [[320,568,true],[390,844,true],[768,1024,true],[1440,900,false]]){
    await cdp('Emulation.setDeviceMetricsOverride',{width,height,deviceScaleFactor:1,mobile});
    await until(`document.documentElement.clientWidth===${width}`,'viewport resize');
    const geometry=await evaluate('({innerWidth,clientWidth:document.documentElement.clientWidth,scrollWidth:document.documentElement.scrollWidth})');
    assert.equal(geometry.innerWidth,width,'actual viewport width');
    assert(geometry.scrollWidth<=geometry.innerWidth,'horizontal overflow');
    assert(geometry.scrollWidth<=width,'content must fit requested viewport');
    measurements.push({screen:'login-error-responsive',viewport:{width,height,mobile},geometry});
    if(width===390)await screenshot('next-login-error-mobile-light-os-dark');
  }
  // Containing decoration must preserve vertical scrolling of a long form.
  await cdp('Emulation.setDeviceMetricsOverride',{width:320,height:400,deviceScaleFactor:1,mobile:true});
  await until('document.documentElement.clientWidth===320','short viewport resize');
  assert(await evaluate('document.scrollingElement.scrollHeight>innerHeight'),'long form needs vertical scroll');
  await evaluate('scrollTo(0,document.scrollingElement.scrollHeight)');
  await until('document.scrollingElement.scrollTop>0','vertical scroll preserved');
  assert(await evaluate("(()=>{const b=document.querySelector('button[type=\"submit\"]').getBoundingClientRect();return b.top>=0&&b.bottom<=innerHeight;})()"),'submit stays reachable after scrolling');
  // Block 2: inspect real detail/scheme controls. No clinical mutation is sent.
  const detailArtifacts=artifacts+'/../detail-scheme', detailMeasurements=[];
  await mkdir(detailArtifacts,{recursive:true});
  await cdp('Emulation.setDeviceMetricsOverride',{width:1440,height:900,deviceScaleFactor:1,mobile:false});
  await loginRole('admin');
  const context=new URLSearchParams({tab:'scheme',evidence_page:'2',returnTo:'/admin/students?page=2&active=true'});
  await cdp('Page.navigate',{url:web+'/admin/students/'+process.env.PHASE5A_STUDENT+'?'+context});
  for(const [preference,os] of [['light','dark'],['dark','light']]){
    await mode(preference,os);await tagAccordion();
    await evaluate("document.querySelector('[aria-label=\"Volver\"]').closest('.min-h-screen').setAttribute('data-phase5b-detail','')");
    const dark=preference==='dark';
    const root=await checkColor('detail root','[data-phase5b-detail]',dark?'rgb(7, 20, 22)':'rgb(246, 250, 250)');
    const card=await checkColor('admin vaccine card','[data-phase5b-card]',dark?'rgb(14, 32, 35)':'rgb(255, 255, 255)');
    const status=await colors('[data-phase5b-status]');
    const statusContrast=ratio(rgb(status.foreground),rgb(card.background));assert(statusContrast>=4.5,'admin status contrast');
    await evaluate("(()=>{const c=document.querySelector('[data-phase5b-card]');Array.from(c.querySelectorAll('p')).find(p=>p.textContent.trim()==='First').setAttribute('data-phase5b-dose-label','');Array.from(c.querySelectorAll('p')).find(p=>p.textContent==='Comentario del administrador').parentElement.setAttribute('data-phase5b-comment','');})()");
    const doseLabel=await colors('[data-phase5b-dose-label]'), labelContrast=ratio(rgb(doseLabel.foreground),rgb(card.background));assert(labelContrast>=4.5,'dose label must stay readable on light card');
    const comment=await checkColor('dose comment','[data-phase5b-comment]');
    const reviewActions=[];
    for(const action of ['Aprobar','Denegar']){
      await evaluate(`Array.from(document.querySelector('[data-phase5b-card]').querySelectorAll('button')).find(b=>b.title===${JSON.stringify(action==='Aprobar'?'Aprobar dosis':'Rechazar dosis')}).setAttribute('data-phase5b-action','')`);
      const actionColor=await checkColor('review action','[data-phase5b-action]');
      await evaluate("(()=>{const b=document.querySelector('[data-phase5b-action]');b.focus();b.removeAttribute('data-phase5b-action');})()");await key('Enter','Enter',13,'\r');
      await until("document.querySelector('[data-phase5b-card]').textContent.includes('¿Confirmar')",'explicit review confirmation');
      await evaluate("Array.from(document.querySelector('[data-phase5b-card]').querySelectorAll('p')).find(p=>p.textContent.startsWith('¿Confirmar')).parentElement.setAttribute('data-phase5b-confirmation','')");
      const confirmation=await checkColor('review confirmation','[data-phase5b-confirmation]');
      await clickText('Cancelar');
      await until("document.querySelector('[data-phase5b-card]').textContent.includes('Editar comentario')",'cancel restores comment editor');
      await evaluate("Array.from(document.querySelector('[data-phase5b-card]').querySelectorAll('p')).find(p=>p.textContent==='Comentario del administrador').parentElement.setAttribute('data-phase5b-comment','')");
      reviewActions.push({action,actionColor,confirmation,cancelled:true});
    }
    detailMeasurements.push({screen:'admin-detail-scheme',preference,os,root,card,status:{foreground:status.foreground,contrast:statusContrast},doseLabel:{foreground:doseLabel.foreground,contrast:labelContrast},comment,reviewActions,accordion:await checkAccordion(true),reflow:await checkSchemeReflow('admin-detail-scheme',preference,detailArtifacts)});
    await screenshot('after-detail-admin-scheme-'+preference+'-os-'+os,detailArtifacts);
  }
  assert(await evaluate("(()=>{const tabs=Array.from(document.querySelectorAll('[role=tab]'));return tabs.length===3&&tabs.every(b=>{const p=document.getElementById(b.getAttribute('aria-controls'));return p?.getAttribute('role')==='tabpanel'&&p.getAttribute('aria-labelledby')===b.id&&p.hidden===(b.getAttribute('aria-selected')!=='true');});})()"),'all tabs linked to panels');
  await evaluate("document.querySelector('[role=tab][aria-selected=true]').focus()");
  await key('ArrowRight','ArrowRight',39);
  assert.equal(await evaluate('document.activeElement.textContent.trim()'),'Evidencia');
  assert.equal(await evaluate("document.querySelector('[role=tab][aria-selected=true]').textContent.trim()"),'Esquema');
  assert.equal(await evaluate("new URLSearchParams(location.search).get('tab')"),'scheme');
  await key('Enter','Enter',13,'\r');
  await until("new URLSearchParams(location.search).get('tab')==='evidence' && document.querySelector('[role=tab][aria-selected=true]').textContent.trim()==='Evidencia' && document.body.textContent.includes('Página 2')",'explicit evidence tab and retained page');
  assert(await evaluate("(()=>{const p=new URLSearchParams(location.search);const r=new URL(p.get('returnTo'),location.origin);return p.get('evidence_page')==='2'&&r.pathname==='/admin/students'&&r.searchParams.get('page')==='2'&&r.searchParams.get('active')==='true';})()"),'retained list context');
  await cdp('Page.reload');
  await until("document.querySelector('[role=tab][aria-selected=true]')?.textContent.trim()==='Evidencia' && document.body.textContent.includes('Página 2')",'deep link reload');
  const width=320,height=568,mobile=true;
  await cdp('Emulation.setDeviceMetricsOverride',{width,height,deviceScaleFactor:1,mobile});
  await until(`document.documentElement.clientWidth===${width}`,'evidence viewport resize 320');
  const geometry=await evaluate(`(()=>{const tab=document.querySelector('[role=tab][aria-selected=true]');const panel=document.getElementById(tab.getAttribute('aria-controls'));const filename=Array.from(panel.querySelectorAll('button')).find(b=>b.textContent.startsWith('evidencia_sintetica_'));if(!filename)return {viewport:document.documentElement.clientWidth,scrollWidth:document.documentElement.scrollWidth,panel:null,filename:null};const p=panel.getBoundingClientRect(),f=filename.getBoundingClientRect();return {viewport:document.documentElement.clientWidth,scrollWidth:document.documentElement.scrollWidth,panel:{left:p.left,right:p.right},filename:{left:f.left,right:f.right,scrollWidth:filename.scrollWidth,clientWidth:filename.clientWidth}};})()`);
  assert.equal(geometry.viewport,width);assert(geometry.scrollWidth<=width,'evidence document horizontal overflow '+JSON.stringify(geometry));
  assert(geometry.panel&&geometry.panel.left>=0&&geometry.panel.right<=width,'evidence panel fits viewport');
  assert(geometry.filename&&geometry.filename.left>=0&&geometry.filename.right<=width,'long evidence filename fits viewport');
  detailMeasurements.push({screen:'admin-detail-evidence',long_filename_reflow:{width,height,mobile,...geometry}});
  await evaluate("document.querySelector('[role=tab][aria-selected=true]').focus()");
  await key('ArrowLeft','ArrowLeft',37);await key('Enter','Enter',13,'\r');await tagAccordion();
  await evaluate("document.querySelector('[data-phase5b-accordion]').focus()");
  await key('Enter','Enter',13,'\r');await checkAccordion(false);
  assert(await evaluate("document.activeElement===document.querySelector('[data-phase5b-accordion]')"),'accordion keeps focus');
  await key(' ','Space',32,' ');await checkAccordion(true);
  detailMeasurements.push({screen:'admin-detail-navigation',manual_activation:true,reload_context:true,accordion_keyboard:true});
  await cdp('Network.clearBrowserCookies');await cdp('Network.setCookies',{cookies:studentSession});
  await cdp('Page.navigate',{url:web+'/student/scheme'});
  await until("location.pathname==='/student/scheme'&&document.querySelector('main')?.textContent.includes('Mi esquema de vacunación')",'student scheme route loaded');
  for(const [preference,os] of [['light','dark'],['dark','light']]){
    await mode(preference,os);await tagAccordion(false);
    const card=await checkColor('student vaccine card','[data-phase5b-card]',preference==='dark'?'rgb(14, 32, 35)':'rgb(255, 255, 255)');
    await checkAccordion(false);await evaluate("document.querySelector('[data-phase5b-accordion]').focus()");
    await key('Enter','Enter',13,'\r');await checkAccordion(true);
    await until("document.querySelector('[data-phase5b-card]').textContent.includes('First')",'student dose visible');
    assert(!await evaluate("Array.from(document.querySelectorAll('button')).some(b=>['Aprobar','Denegar'].includes(b.textContent.trim()))"),'student lacks review actions');
    const status=await colors('[data-phase5b-status]'), contrast=ratio(rgb(status.foreground),rgb(card.background));assert(contrast>=4.5,'student status contrast');
    detailMeasurements.push({screen:'student-scheme',preference,os,card,status:{foreground:status.foreground,contrast},accordion:await checkAccordion(true),reflow:await checkSchemeReflow('student-scheme',preference,detailArtifacts)});
    await screenshot('after-student-scheme-'+preference+'-os-'+os,detailArtifacts);
    await key(' ','Space',32,' ');await checkAccordion(false);
    assert(await evaluate("document.activeElement===document.querySelector('[data-phase5b-accordion]')"),'student accordion keeps focus');
  }
  await writeFile(detailArtifacts+'/measurements.json',JSON.stringify({stage:'verified-after',viewport:{width:1440,height:900},measurements:detailMeasurements},null,2)+'\n');
  await writeFile(artifacts+'/measurements.json',JSON.stringify({stage:'verified-after',viewport:{width:1440,height:900},measurements},null,2)+'\n');
  console.log('PASS: production themes, contrast, responsive, detail tabs/context/reload, admin/student accordions; no clinical writes.');
} finally { ws.close(); }
