import {chromium} from '/Users/meow/rea/trumviahe/node_modules/playwright/index.mjs';
import fs from 'node:fs/promises';
const out=new URL('../artifacts/techniques/',import.meta.url);await fs.mkdir(out,{recursive:true});
const browser=await chromium.launch({channel:'chrome',headless:true});
const page=await browser.newPage({viewport:{width:1280,height:720}});const errors=[];
page.on('pageerror',e=>errors.push(e.message));page.on('console',m=>{if(m.type()==='error')errors.push(m.text());});
try{
 await page.goto('http://127.0.0.1:5189/demo/?test=1&quality=high');
 await page.waitForFunction(()=>window.__ready,null,{timeout:90000});
 await page.click('#start');await page.evaluate(()=>{__test.g.player.invulnerable=true;__test.g.bots.update=()=>{};advanceTime(50);});
 await page.screenshot({path:new URL('initial.png',out).pathname});
 const state=await page.evaluate(()=>JSON.parse(render_game_to_text()));
 console.log(JSON.stringify({render:state.render,pipeline:state.pipeline,assets:state.assets,errors}));
 await fs.writeFile(new URL('smoke.json',out),JSON.stringify({state,errors},null,2));
}catch(e){console.log(JSON.stringify({error:String(e),errors}));await page.screenshot({path:new URL('boot-failure.png',out).pathname});process.exitCode=1;}
finally{await browser.close();}
