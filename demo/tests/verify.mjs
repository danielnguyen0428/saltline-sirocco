import { chromium } from '/Users/meow/rea/trumviahe/node_modules/playwright/index.mjs';
import fs from 'node:fs/promises';
const out=new URL('../artifacts/verification/',import.meta.url);await fs.mkdir(out,{recursive:true});
const report={mode:'real-input plus isolated state fixtures',checks:[],errors:[],limitations:['Waypoint heading and explicit placement isolate map/objective tests. Bot updates disabled for isolated player/objective checks.','Not a natural full-match victory or an acoustic quality assessment. Mobile captures check layout only.']};
const browser=await chromium.launch({headless:true,executablePath:'/Applications/Google Chrome.app/Contents/MacOS/Google Chrome'});
const page=await browser.newPage({viewport:{width:1280,height:720},deviceScaleFactor:1});
page.on('pageerror',e=>report.errors.push(e.message));page.on('console',m=>{if(m.type()==='error')report.errors.push(m.text());});
const assert=(name,ok,detail)=>{report.checks.push({name,passed:!!ok,detail});if(!ok)throw Error(name+': '+JSON.stringify(detail));};
const state=()=>page.evaluate(()=>JSON.parse(render_game_to_text()));
const advance=ms=>page.evaluate(ms=>window.advanceTime(ms),ms);
const key=async(code,ms)=>{await page.keyboard.down(code);await advance(ms);await page.keyboard.up(code);await advance(20);};
const shot=name=>page.screenshot({path:new URL(name+'.png',out).pathname});
async function isolate(role='attack',weapon='ak'){
  await page.evaluate(({role,weapon})=>{const {g,start}=window.__test;g.game.role=role;g.game.weapon=weapon;start(false);window.advanceTime(0);
    g.bots.originalUpdate ||= g.bots.update;g.bots.update=()=>{};g.player.invulnerable=true;}, {role,weapon});
}
try{
  await page.goto('http://127.0.0.1:5189/demo/?test=1');await page.waitForFunction(()=>window.__ready===true,null,{timeout:60000});
  assert('boot-r180',await page.evaluate(()=>SaltlineEngine.THREE.REVISION==='180'&&!document.querySelector('#start').disabled));
  await shot('title-desktop');
  await page.click('#start');await advance(20);assert('deploy-real-click',(await state()).phase==='playing');
  await isolate();
  const paths=await page.evaluate(()=>{const {g}=__test;return g.level.sites.map(s=>({id:s.id,path:g.physics.nav.findPath(g.level.playerStart.pos,s.pos)?.length,walkable:g.physics.nav.isWalkable(s.pos.x,s.pos.z)}));});
  assert('both-sites-connected',paths.every(p=>p.path>0&&p.walkable),paths);
  const before=(await state()).player.pos;await key('w',1000);let s=await state();assert('W-movement',s.player.pos[2]<before[2]-3,s.player.pos);
  await key('Space',150);assert('jump',(await state()).player.pos[1]>.4);await advance(1500);assert('land',(await state()).player.onGround);
  await page.evaluate(()=>__test.place(0,23,Math.PI/2));await key('w',3000);s=await state();assert('world-wall-collision',s.player.pos[0]>-28&&s.player.pos[0]<-10,s.player.pos);
  await page.evaluate(()=>__test.place(0,23));await advance(250);await key('Enter',180);s=await state();assert('fire-consumes-ammo',s.weapon.ammo<30&&s.weapon.shots>0,s.weapon);
  await key('r',50);assert('reload-starts',(await state()).weapon.reloading);await advance(2500);s=await state();assert('reload-conserves-reserve',s.weapon.ammo===30&&s.weapon.reserve<90,s.weapon);
  await key('c',250);assert('crouch-real-key',await page.evaluate(()=>__test.g.player.crouching===false));
  // Verify crouch while held, not after keyup.
  await page.keyboard.down('c');await advance(200);assert('crouch-held',await page.evaluate(()=>__test.g.player.crouching));await page.keyboard.up('c');await advance(100);
  const yaw=await page.evaluate(()=>__test.g.player.yaw);await key('ArrowRight',250);assert('keyboard-look',Math.abs((await state()).player.yaw-yaw)>.1);
  const time=(await state()).time;await key('p',50);await advance(2000);s=await state();assert('pause-freezes',(s.phase==='paused'&&Math.abs(s.time-time)<.1),s.time);await key('p',50);assert('resume',(await state()).phase==='playing');
  await page.evaluate(()=>{__test.g.player.invulnerable=false;__test.damage(30,null);});const hp=(await state()).player.hp;await advance(6000);assert('no-automatic-heal',(await state()).player.hp===hp,hp);
  await isolate('attack','m4');await advance(300);await key('Enter',180);s=await state();assert('M4-fire',s.weapon.id==='m4'&&s.weapon.ammo<30);await shot('m4-mid');
  // Bot hitboxes and wall rejection, with one bot placed in an open test lane.
  await isolate();
  const combat=await page.evaluate(()=>{const {g}=__test,T=g.THREE;const b=g.bots.list[0];b.pos.set(0,0,16);const o=new T.Vector3(0,1.58,23),d=new T.Vector3(0,0,-1);
    const hit=g.bots.raycast(o,d,20);const before=b.health;g.bots.damage(hit,36);const damaged=b.health;
    const block=g.physics.addBox([-.6,0,19],[.6,2,20]);const wallBlocked=g.bots.raycast(o,d,20)===null;g.physics.removeBox(block);
    g.bots.damage(hit,144);return {before,damaged,head:hit?.headshot,wallBlocked,alive:b.alive};});
  assert('head-body-damage-and-wall',combat.before===100&&combat.damaged===64&&combat.head&&combat.wallBlocked&&!combat.alive,combat);
  // Actual bullet input reaches a bot; heading/placement are controlled.
  await isolate();await page.evaluate(()=>{__test.place(0,23);const g=__test.g;g.bots.list[0].pos.set(0,0,17);g.player.pitch=-.014;});await advance(300);await key('Enter',500);assert('real-fire-hits-bot',(await state()).bots[0].hp<100);
  // Exercise bot AI with its original update and real map collision.
  await isolate();await page.evaluate(()=>{const g=__test.g;__test.place(0,23);g.bots.list[0].pos.set(0,0,16);g.bots.update=g.bots.originalUpdate;g.player.invulnerable=false;});
  await advance(300);assert('bot-reaction-delay',(await state()).player.hp===100);await advance(9000);assert('bot-shoots-player',(await state()).player.hp<100);
  // Route traversal: real W input with controlled waypoint heading, invulnerability.
  for(const siteId of ['A','B']){
    await isolate();const route=await page.evaluate(id=>__test.g.physics.nav.findPath(__test.g.player.pos,__test.g.level.sites.find(s=>s.id===id).pos).map(v=>[v.x,v.z]),siteId);
    let steps=0;
    for(const [x,z] of route){
      for(let i=0;i<300;i++){
        const dist=await page.evaluate(([x,z])=>{const p=__test.g.player;p.yaw=Math.atan2(p.pos.x-x,p.pos.z-z);return Math.hypot(p.pos.x-x,p.pos.z-z);},[x,z]);
        if(dist<.38)break;
        await key('w',50);steps++;
      }
    }
    const distance=await page.evaluate(id=>{const g=__test.g;return g.player.pos.distanceTo(g.level.sites.find(s=>s.id===id).pos);},siteId);
    assert('walk-route-'+siteId,distance<1,{distance,steps});await shot('site-'+siteId);
  }
  // Continuous plant hold, cancel, then fuse outcome.
  await isolate();await page.evaluate(()=>{const s=__test.g.level.sites[0];__test.place(s.pos.x,s.pos.z);});await key('e',1000);assert('plant-release-cancels',!(await state()).bomb.planted&&(await state()).hold===0);
  await key('e',3400);s=await state();assert('plant-completes',s.bomb.planted&&s.bomb.site==='A',s.bomb);await shot('bomb-planted');
  await advance(41000);s=await state();assert('fuse-explosion-wins',s.phase==='result'&&s.result.winner==='t',s.result);await shot('round-win');
  await page.click('#next');await advance(30);s=await state();assert('next-round-reset',s.phase==='playing'&&s.round===2&&s.player.hp===100&&s.weapon.ammo===30&&!s.bomb.planted,s);
  await isolate('defend','m4');await page.evaluate(()=>{const p=__test.g.game.bomb.pos;__test.place(p.x,p.z);});await key('e',1500);assert('defuse-release-cancels',(await state()).hold===0&&(await state()).phase==='playing');
  await page.keyboard.down('e');await advance(2500);await shot('defusing');await advance(2700);await page.keyboard.up('e');s=await state();assert('defuse-wins',s.phase==='result'&&s.result.winner==='ct',s.result);
  await isolate('defend');await advance(56000);s=await state();assert('defend-fuse-loss',s.result?.winner==='t');
  await isolate();await advance(106000);assert('attack-timeout-loss',(await state()).result?.winner==='ct');
  await isolate();await page.evaluate(()=>{__test.g.player.invulnerable=false;__test.damage(500,null);});s=await state();assert('player-death-loss',s.phase==='result'&&s.player.hp===0&&s.result.winner==='ct');
  await isolate();await page.evaluate(()=>{__test.g.player.invulnerable=false;__test.g.player.damage(500,null);});assert('direct-player-death-event',(await state()).phase==='result');
  await isolate();await page.evaluate(()=>{__test.g.game.time=59.9;});await advance(70);assert('timer-minute-boundary',await page.locator('#timer').textContent()==='1:00');
  await isolate();const handoff=await page.evaluate(()=>{const g=__test.g;g.game.bomb.planted=true;g.onBotDefuse(4,0);const before=g.game.bomb.defuseProgress;g.onBotDefuse(.1,1);return {before,after:g.game.bomb.defuseProgress};});assert('defuser-change-resets',handoff.before===4&&handoff.after===.1,handoff);
  await isolate();const patrol=await page.evaluate(()=>{const g=__test.g,b=g.bots.list[0];__test.place(0,23);b.pos.set(22,0,-20);b.goal.set(100,0,100);b.planTime=-1;b.wait=0;b.memory=0;const find=g.physics.nav.findPath;g.physics.nav.findPath=()=>null;g.bots.originalUpdate(.02);g.physics.nav.findPath=find;return b.goal.distanceTo(b.pos);});assert('unreachable-patrol-recovers',patrol<.1,patrol);
  await isolate();await page.evaluate(()=>{const g=__test.g;for(const b of g.bots.list)g.bots.damage({bot:b,headshot:false},1000);});assert('elimination-win',(await state()).result?.winner==='t');
  await isolate();await page.evaluate(()=>{const g=__test.g;const site=g.level.sites[0];__test.place(site.pos.x,site.pos.z);});await key('e',3400);
  await page.evaluate(()=>{const g=__test.g;__test.place(0,23);g.bots.list.forEach((b,i)=>{b.alive=i===0;b.root.visible=b.alive;});g.bots.list[0].pos.copy(g.game.bomb.pos);g.bots.update=g.bots.originalUpdate;});
  await advance(11000);assert('bot-defuse-wins',(await state()).result?.winner==='ct');
  await isolate();await page.click('#sound');assert('mute-button',(await state()).audio.muted);await page.click('#sound');await key('Enter',250);s=await state();assert('audio-unlocked-and-playing',s.audio.played>0&&s.audio.failed===0&&s.audio.state==='running',s.audio);
  await page.keyboard.down('p');await advance(30);await page.keyboard.up('p');assert('audio-paused',(await state()).audio.paused);await key('p',30);
  await page.setViewportSize({width:390,height:844});await advance(30);await shot('narrow-gameplay');
  const fit=await page.evaluate(()=>['health','ammo','objective'].every(id=>{const r=document.getElementById(id).getBoundingClientRect();return r.left>=0&&r.right<=innerWidth&&r.top>=0&&r.bottom<=innerHeight;}));assert('narrow-HUD-fit',fit);
  await page.setViewportSize({width:1280,height:720});await isolate();await advance(30);await shot('final-gameplay');
  report.finalState=await state();assert('no-JavaScript-errors',report.errors.length===0&&report.finalState.errors.length===0,report.errors);
  report.status='passed';
}catch(error){report.status='failed';report.error=String(error.stack||error);try{report.failureState=await state();await shot('failure');}catch{}}
finally{await fs.writeFile(new URL('report.json',out),JSON.stringify(report,null,2));console.log(JSON.stringify({status:report.status,checks:report.checks.length,error:report.error,report:new URL('report.json',out).pathname}));await browser.close();if(report.status!=='passed')process.exitCode=1;}
