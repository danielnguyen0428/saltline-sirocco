import {chromium} from '/Users/meow/rea/trumviahe/node_modules/playwright/index.mjs';
import fs from 'node:fs/promises';
const browser=await chromium.launch({channel:'chrome',headless:true});
const page=await browser.newPage({viewport:{width:1280,height:720}}),errors=[];
page.on('pageerror',e=>errors.push(e.message));page.on('console',m=>{if(m.type()==='error')errors.push(m.text());});
try{
 await page.goto('http://127.0.0.1:5191/demo/?test=1&quality=medium&dynres=0');await page.waitForFunction(()=>window.__ready,null,{timeout:60000});
 await page.evaluate(()=>{__test.start(false);__test.g.bots.update=()=>{};__test.g.player.invulnerable=true;advanceTime(50);});
 await page.screenshot({path:new URL('ak.png',import.meta.url).pathname});
 await page.keyboard.down('Enter');await page.evaluate(()=>advanceTime(400));await page.keyboard.up('Enter');
 await page.screenshot({path:new URL('fire.png',import.meta.url).pathname});
 await page.keyboard.down('r');await page.evaluate(()=>advanceTime(20));await page.keyboard.up('r');
 for(const [name,time] of [['reach',500],['out',500],['in',650],['done',900]]){await page.evaluate(t=>advanceTime(t),time);await page.screenshot({path:new URL(`reload-${name}.png`,import.meta.url).pathname});}
 await page.evaluate(()=>{__test.g.weapon.select('m4');advanceTime(200);});await page.screenshot({path:new URL('m4.png',import.meta.url).pathname});
 const state=await page.evaluate(()=>({stats:__test.g.weapon.root.userData.stats,motion:__test.g.weapon.motion,ammo:__test.g.weapon.ammo,reserve:__test.g.weapon.reserve,errors:window.__errors}));
 console.log(JSON.stringify({state,errors}));await fs.writeFile(new URL('report.json',import.meta.url),JSON.stringify({state,errors},null,2));
}catch(e){console.log(JSON.stringify({error:String(e),errors}));await page.screenshot({path:new URL('failure.png',import.meta.url).pathname});process.exitCode=1;}finally{await browser.close();}
