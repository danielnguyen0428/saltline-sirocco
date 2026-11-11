import {chromium} from '/Users/meow/rea/trumviahe/node_modules/playwright/index.mjs';
import fs from 'node:fs/promises';
import {execFileSync} from 'node:child_process';
const out=new URL('../artifacts/techniques/motion/',import.meta.url);await fs.mkdir(out,{recursive:true});
const browser=await chromium.launch({channel:'chrome',headless:true});
const context=await browser.newContext({viewport:{width:1280,height:720}});
const page=await context.newPage(),errors=[],samples=[],frames=[];
async function capture(name){const path=new URL(name+'.png',out).pathname;await page.screenshot({path});frames.push({path,time:performance.now()});}
page.on('pageerror',e=>errors.push(e.message));page.on('console',m=>{if(m.type()==='error')errors.push(m.text());});
try{
 await page.goto('http://127.0.0.1:5189/demo/?test=1&quality=medium&dynres=0');await page.waitForFunction(()=>__ready,null,{timeout:90000});
 await page.click('#start');
 await page.evaluate(()=>{
  const g=__test.g;g.player.invulnerable=true;g.physics.originalLOS=g.physics.lineOfSight;g.physics.lineOfSight=()=>false;
  const b=g.bots.list[0];b.pos.set(0,0,18);b.home.set(0,0,15);b.goal.set(0,0,13);b.wait=-1;b.planTime=-1;
 });
 for(let i=0;i<8;i++){
  await page.waitForTimeout(250);await capture('walk-'+i);
  samples.push(await page.evaluate(()=>({time:__test.g.time.t,pos:__test.g.bots.list[0].pos.toArray(),legs:__test.g.bots.list[0].legs.map(b=>b.rotation.x)})));
 }
 await page.evaluate(()=>{const g=__test.g;g.physics.lineOfSight=g.physics.originalLOS;g.bots.update=()=>{};});
 await page.keyboard.down('Enter');await page.waitForTimeout(350);await page.keyboard.up('Enter');
 await page.keyboard.press('r');
 for(let i=0;i<12;i++){await page.waitForTimeout(200);await capture('reload-'+i);}
 await page.keyboard.down('w');await page.waitForTimeout(700);await page.keyboard.up('w');await page.keyboard.press('Space');await page.waitForTimeout(900);
 const state=await page.evaluate(()=>JSON.parse(render_game_to_text()));
 if(errors.length||state.weapon.reloading||samples[7].time<=samples[0].time)throw Error(JSON.stringify({errors,state}));
 await fs.writeFile(new URL('report.json',out),JSON.stringify({status:'passed',mode:'unpaused requestAnimationFrame; actual keyboard fire/reload/walk/jump; LOS fixture suppresses combat during bot patrol',samples,state,errors,frames},null,2));
 console.log(JSON.stringify({status:'passed',samples:samples.length,ammo:state.weapon.ammo,errors}));
}catch(error){console.log(String(error));process.exitCode=1;}
finally{
 await context.close();await browser.close();
 if(frames.length){
  const timeline=frames.map((frame,index)=>"file '"+frame.path+"'\nduration "+((frames[index+1]?.time||frame.time+250)-frame.time)/1000).join('\n');
  const path=new URL('timeline.txt',out).pathname;await fs.writeFile(path,timeline+'\n');
  execFileSync('/opt/homebrew/bin/ffmpeg',['-hide_banner','-loglevel','error','-y','-f','concat','-safe','0','-i',path,'-vf','fps=30','-c:v','libx264','-pix_fmt','yuv420p','-movflags','+faststart',new URL('live-motion.mp4',out).pathname]);
 }
}
