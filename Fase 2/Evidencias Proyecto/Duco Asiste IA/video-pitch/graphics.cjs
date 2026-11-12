const {chromium}=require('playwright');
const fs=require('node:fs'),path=require('node:path');
const out=path.join(__dirname,'parte1','graphics');fs.mkdirSync(out,{recursive:true});
(async()=>{const browser=await chromium.launch({headless:true});try{
 const p=await browser.newPage({viewport:{width:1920,height:1080}});
 const styles={
  hook:'background:linear-gradient(90deg,rgba(6,28,49,.98) 0%,rgba(6,28,49,.94) 42%,rgba(6,28,49,.56) 77%,rgba(6,28,49,.28) 100%);',
  lower:'background:linear-gradient(0deg,rgba(3,19,34,.95) 0%,rgba(3,19,34,.80) 14%,rgba(3,19,34,.04) 38%,transparent 55%);',
  question:'background:radial-gradient(ellipse at 80% 5%,rgba(15,110,189,.4),transparent 65%),linear-gradient(115deg,rgba(4,23,41,.98),rgba(4,29,52,.95));',
  final:'background:radial-gradient(ellipse at 20% 40%,rgba(7,82,143,.35),transparent 50%),linear-gradient(90deg,rgba(4,24,42,1) 0%,rgba(4,24,42,.99) 44%,rgba(4,24,42,.86) 58%,transparent 73%);'
 };
 for(const [name,css]of Object.entries(styles)){
  await p.setContent(`<style>*{box-sizing:border-box}html,body{margin:0;width:1920px;height:1080px;overflow:hidden;background:transparent}.shade{width:100%;height:100%;${css}}.ring{position:absolute;width:850px;height:850px;border:1px solid #ffffff10;border-radius:50%;right:-180px;top:-250px}.ring:after{content:'';position:absolute;inset:70px;border:1px solid #ffffff0c;border-radius:50%}</style><div class="shade"></div>${name==='question'?'<div class="ring"></div>':''}`);
  await p.screenshot({path:path.join(out,name+'.png'),omitBackground:true});
 }
}finally{await browser.close();}})().catch(e=>{console.error(e);process.exitCode=1;});
