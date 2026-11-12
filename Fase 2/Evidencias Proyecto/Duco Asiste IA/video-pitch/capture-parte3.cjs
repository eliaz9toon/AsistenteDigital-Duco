const {chromium}=require('playwright');
const assert=require('node:assert/strict');
const fs=require('node:fs'),path=require('node:path');
const {randomUUID}=require('node:crypto');const {spawnSync}=require('node:child_process');
const out=path.join(__dirname,'parte3');fs.mkdirSync(path.join(out,'clips'),{recursive:true});
const base='http://127.0.0.1:8765',nonce=randomUUID();
const manifest={nonce,question:`[Demostracion ${nonce.slice(0,8)}] Como localizar informacion con Duco Asiste`,sessions:[]};
const manifestFile=path.join(out,'fixtures.json');
const clips=[],proof={date:new Date().toISOString(),checks:[],fixture:'Temporary, clearly labelled demo records; existing records are not modified.'};let browser;
function save(){fs.writeFileSync(manifestFile,JSON.stringify(manifest,null,2));fs.writeFileSync(path.join(out,'clips.json'),JSON.stringify(clips,null,2));fs.writeFileSync(path.join(out,'demostracion.json'),JSON.stringify(proof,null,2));}
function oracle(mode){save();const r=spawnSync(path.join(__dirname,'../admin-app/.venv/Scripts/python.exe'),[path.join(__dirname,'oracle-demo-parte3.py'),mode,manifestFile],{encoding:'utf8',timeout:60000});if(r.status!==0)throw Error(r.stderr||r.stdout);return JSON.parse(r.stdout);}
async function create(mobile=false){const context=await browser.newContext(mobile?{viewport:{width:375,height:812},hasTouch:true,isMobile:true,recordVideo:{dir:path.join(out,'clips'),size:{width:375,height:812}}}:{viewport:{width:1440,height:810},recordVideo:{dir:path.join(out,'clips'),size:{width:1440,height:810}}});const born=Date.now(),p=await context.newPage();await p.route(/google-analytics|googletagmanager|doubleclick/,r=>r.abort());return {context,p,time:()=>(Date.now()-born)/1000};}
async function ready(p){await p.waitForFunction(()=>window.duco?.aiClient);await p.evaluate(()=>{duco.typewriterSpeed=0;duco.openPanel();});await p.waitForTimeout(650);}
async function cursor(p){await p.evaluate(()=>{const c=document.createElement('div');c.id='pitch-cursor';c.style.cssText='position:fixed;left:740px;top:440px;width:22px;height:22px;border:3px solid white;background:#005bb5;border-radius:50%;box-shadow:0 2px 12px #0005;z-index:2147483647;pointer-events:none';document.body.append(c);addEventListener('mousemove',e=>{c.style.left=e.clientX-11+'px';c.style.top=e.clientY-11+'px';});});}
async function move(p,locator){const b=await locator.boundingBox();if(b)await p.mouse.move(b.x+b.width/2,b.y+b.height/2,{steps:24});}
async function finish(r,name,segments){const video=r.p.video();await r.context.close();const file=path.join(out,'clips',name+'.webm');await video.saveAs(file);segments.forEach(s=>clips.push({...s,file}));save();console.log(JSON.stringify({recording:name,segments:segments.map(s=>s.name)}));}
(async()=>{
 browser=await chromium.launch({headless:true});save();
 try{
  const r=await create(),p=r.p;await p.goto(base+'/duco',{waitUntil:'domcontentloaded'});await ready(p);await cursor(p);
  const session=await p.evaluate(()=>chatHandler.getSessionId());manifest.sessions.push(session);save();
  await p.fill('#duco-input','hola duco');await p.click('#duco-send-btn');await p.waitForFunction(()=>!duco.isProcessing);await p.waitForTimeout(500);
  let start=r.time();await move(p,p.locator('.duco-feedback-btn').last());await p.waitForTimeout(5500);const segments=[{name:'valoraciones',start,duration:r.time()-start}];
  const response=p.waitForResponse(resp=>resp.url().endsWith('/api/duco/feedback')&&resp.request().method()==='POST');await p.locator('.duco-feedback-btn').last().click();assert.equal((await response).status(),201);await p.waitForFunction(()=>document.querySelector('.duco-feedback-status')?.textContent.includes('registrada'));
  start=r.time();await p.waitForTimeout(5800);segments.push({name:'valoracion_guardada',start,duration:r.time()-start});proof.checks.push({name:'Real negative user rating persisted',session});
  const seeded=await p.request.post(base+'/api/duco/proposals',{data:{question:manifest.question,answer:'Puedes pedir a Duco que abra una pagina, encuentre una seccion o destaque texto disponible. Propuesta temporal de demostracion del flujo de revision.'}});assert.equal(seeded.status(),202);
  const list=await (await p.request.get(base+'/api/duco/proposals')).json();const own=list.proposals.find(item=>item.question===manifest.question);assert(own);manifest.proposalId=own.id;save();await finish(r,'valoracion-real',segments);

  const admin=await create(),a=admin.p;await a.goto(base+'/',{waitUntil:'domcontentloaded'});await a.waitForSelector('#tables option[value="CONFIGURACIONES"]',{state:'attached'});await a.selectOption('#tables','CONFIGURACIONES');await a.waitForTimeout(700);await cursor(a);await a.click('#review-proposals');
  const card=a.locator('#proposal-list .proposal').filter({hasText:manifest.question});await card.waitFor();await card.evaluate(el=>el.scrollIntoView({block:'start'}));await a.waitForTimeout(600);
  start=admin.time();await move(a,card.locator('.approve'));await a.waitForTimeout(5800);const adminSegments=[{name:'admin_pendiente',start,duration:admin.time()-start}];
  start=admin.time();await a.waitForTimeout(700);const approved=a.waitForResponse(resp=>resp.url().endsWith('/proposals/'+own.id+'/review'));await card.locator('.approve').click();assert.equal((await approved).status(),200);await a.waitForFunction(()=>document.querySelector('#status').textContent.includes('aprobada'));await a.waitForTimeout(200);adminSegments.push({name:'admin_aprobar',start,duration:admin.time()-start});
  await a.click('#close-proposals');await a.waitForTimeout(300);start=admin.time();await a.waitForTimeout(4500);adminSegments.push({name:'admin_confirmado',start,duration:admin.time()-start});
  const snapshot=oracle('inspect');assert(snapshot.proposal.some(row=>row[1]==='APROBADA')&&snapshot.faq.length===1);proof.oracle=snapshot;proof.checks.push({name:'Approval publishes the own demo proposal only; verified through independent Oracle connection',proposalId:own.id});await finish(admin,'revision-administrativa',adminSegments);

  const mobile=await create(true),m=mobile.p;await m.goto(base+'/duco',{waitUntil:'domcontentloaded'});await ready(m);start=mobile.time();await m.waitForTimeout(1700);await m.fill('#duco-input','Hola Duco');await m.locator('#duco-send-btn').tap();await m.waitForFunction(()=>!duco.isProcessing);await m.waitForTimeout(5300);proof.checks.push({name:'Mobile viewport recording',physicalDevice:false,viewport:[375,812]});await finish(mobile,'vista-movil-emulada',[{name:'movil',start,duration:mobile.time()-start,layout:'mobile'}]);

  const close=await create(),c=close.p;await c.goto(base+'/duco',{waitUntil:'domcontentloaded'});await ready(c);await cursor(c);start=close.time();await c.mouse.move(930,610,{steps:25});await c.waitForTimeout(10500);await finish(close,'duco-cierre',[{name:'despedida',start,duration:close.time()-start}]);proof.passed=true;
 }catch(e){proof.passed=false;proof.error=e.stack;process.exitCode=1;}
 finally{try{proof.cleanup=oracle('cleanup');assert(proof.cleanup.clean);}catch(e){proof.cleanup={clean:false,error:e.stack};proof.passed=false;process.exitCode=1;}save();await browser.close();console.log(JSON.stringify({passed:proof.passed,cleanup:proof.cleanup,output:out,error:proof.error}));}
})().catch(e=>{console.error(e);process.exitCode=1;});
