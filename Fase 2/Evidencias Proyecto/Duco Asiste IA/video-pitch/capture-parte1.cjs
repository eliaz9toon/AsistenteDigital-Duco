const {chromium}=require('playwright');
const fs=require('node:fs'),path=require('node:path');
const out=path.join(__dirname,'parte1');fs.mkdirSync(path.join(out,'clips'),{recursive:true});
const base='http://127.0.0.1:8765';
const only=(process.env.CAPTURE_ONLY || '').split(',').filter(Boolean);
const clips=only.length ? JSON.parse(fs.readFileSync(path.join(out,'clips.json'),'utf8')).filter(c=>!only.includes(c.name)) : [];
let browser;
async function ready(page){
  await page.waitForFunction(()=>window.duco?.aiClient);
  await page.waitForTimeout(900);
  await page.evaluate(()=>{
    if(window.jQuery?.fn?.carousel){window.jQuery('.home.carousel').carousel(0);window.jQuery('.carousel').carousel('pause');}
    if(duco.isOpen)duco.closePanel();
    const pointer=document.createElement('div');pointer.id='pitch-cursor';
    pointer.style.cssText='position:fixed;left:740px;top:430px;width:22px;height:22px;border:3px solid white;background:#005bb5;border-radius:50%;box-shadow:0 2px 12px #0005;z-index:2147483647;pointer-events:none;transition:transform .18s';
    document.body.append(pointer);
    addEventListener('mousemove',e=>{pointer.style.left=(e.clientX-11)+'px';pointer.style.top=(e.clientY-11)+'px';});
    addEventListener('mousedown',()=>{pointer.style.transform='scale(.75)';});
    addEventListener('mouseup',()=>{pointer.style.transform='scale(1)';});
  });
  await page.waitForTimeout(700);
}
async function move(p,selector){const box=await p.locator(selector).first().boundingBox();if(box)await p.mouse.move(box.x+box.width/2,box.y+box.height/2,{steps:24});}
async function capture(name,route,run){
  if(only.length && !only.includes(name))return;
  const context=await browser.newContext({viewport:{width:1440,height:810},recordVideo:{dir:path.join(out,'clips'),size:{width:1440,height:810}}});
  const born=Date.now();const p=await context.newPage();
  await p.route(/google-analytics|googletagmanager|doubleclick|facebook\.com\/tr/,r=>r.abort());
  await p.goto(base+route,{waitUntil:'domcontentloaded'});await ready(p);
  const start=(Date.now()-born)/1000;
  await run(p);
  const duration=(Date.now()-born)/1000-start;
  const video=p.video();await context.close();
  const filename=path.join(out,'clips',name+'.webm');await video.saveAs(filename);
  clips.push({name,file:filename,start,duration,route});fs.writeFileSync(path.join(out,'clips.json'),JSON.stringify(clips,null,2));
  console.log(JSON.stringify(clips.at(-1)));
}
(async()=>{
 browser=await chromium.launch({headless:true});
 try{
  await capture('inicio','/duco',async p=>{
    await p.mouse.move(820,620,{steps:20});await p.waitForTimeout(1600);
    await p.evaluate(()=>window.scrollTo({top:400,behavior:'smooth'}));await p.waitForTimeout(1800);
    await p.evaluate(()=>window.scrollTo({top:0,behavior:'smooth'}));await p.waitForTimeout(2600);
  });
  await capture('busqueda','/carreras.html',async p=>{
    await p.locator('#carrera-search').scrollIntoViewIfNeeded();await p.waitForTimeout(900);await move(p,'#carrera-search');
    await p.click('#carrera-search');await p.locator('#carrera-search').pressSequentially('informatica',{delay:100});await p.waitForTimeout(850);
    await move(p,'.bc-btn-buscar');await p.click('.bc-btn-buscar');await p.waitForTimeout(1700);
    await move(p,'#resultados-carreras .bc-card');await p.waitForTimeout(2200);
  });
  await capture('ficha','/carreras-detalle/ingenieria-en-informatica.html',async p=>{
    await p.mouse.move(690,530,{steps:20});await p.waitForTimeout(1000);
    await p.evaluate(()=>window.scrollTo({top:630,behavior:'smooth'}));await p.waitForTimeout(2100);
    const tab=p.locator('a[role="tab"]').filter({hasText:/perfil de egreso/i}).first();await tab.scrollIntoViewIfNeeded();await p.waitForTimeout(500);
    const r=await tab.boundingBox();await p.mouse.move(r.x+r.width/2,r.y+r.height/2,{steps:24});await tab.click();await p.waitForTimeout(2300);
    await p.evaluate(()=>window.scrollBy({top:300,behavior:'smooth'}));await p.waitForTimeout(2100);
  });
  await capture('menus','/duco',async p=>{
    const offer=p.locator('a').filter({hasText:/^\s*Oferta Acad[e\u00e9]mica\s*$/i}).first();
    const r=await offer.boundingBox();await p.mouse.move(r.x+r.width/2,r.y+r.height/2,{steps:24});
    await p.evaluate(()=>duco.executeFlowAction({type:'dropdown',terms:['Oferta Academica']}));await p.waitForTimeout(2600);
    await p.mouse.move(760,180,{steps:25});await p.waitForTimeout(800);
    await p.evaluate(()=>duco.executeFlowAction({type:'closeDropdown'}));await p.waitForTimeout(800);
    const life=p.locator('a').filter({hasText:/^\s*Vida Estudiantil\s*$/i}).first();const s=await life.boundingBox();await p.mouse.move(s.x+s.width/2,s.y+s.height/2,{steps:24});
    await p.evaluate(()=>duco.executeFlowAction({type:'dropdown',terms:['Vida Estudiantil']}));await p.waitForTimeout(2400);
    await p.mouse.move(780,470,{steps:20});await p.waitForTimeout(1000);
  });
  await capture('pregunta','/carreras.html',async p=>{
    await p.locator('#carrera-search').scrollIntoViewIfNeeded();await p.mouse.move(700,550,{steps:20});
    await p.waitForTimeout(1600);await p.evaluate(()=>window.scrollBy({top:380,behavior:'smooth'}));await p.waitForTimeout(2400);
    await p.evaluate(()=>window.scrollBy({top:300,behavior:'smooth'}));await p.waitForTimeout(3500);
  });
  await capture('duco','/duco',async p=>{
    await p.mouse.move(740,550,{steps:20});await p.waitForTimeout(1100);
    await move(p,'.duco-avatar-button');const box=await p.locator('.duco-avatar-button').boundingBox();await p.mouse.click(box.x+box.width/2,box.y+box.height/2);
    await p.waitForTimeout(1600);await p.mouse.move(970,680,{steps:30});await p.waitForTimeout(6200);
  });
 }finally{await browser?.close();}
})().catch(e=>{console.error(e);process.exitCode=1;});
