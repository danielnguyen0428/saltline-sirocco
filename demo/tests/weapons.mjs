import {chromium} from '/Users/meow/rea/trumviahe/node_modules/playwright/index.mjs';
import fs from 'node:fs/promises';
const out=new URL('../artifacts/hands-weapons/',import.meta.url);await fs.mkdir(out,{recursive:true});
const report={checks:[],errors:[],captures:[],limits:['Fixed-clock fixtures isolate contacts and reload.','Studio views disable postprocessing and use neutral lighting.']};
const browser=await chromium.launch({channel:'chrome',headless:true});const page=await browser.newPage({viewport:{width:1280,height:720}});
page.on('pageerror',e=>report.errors.push(e.message));page.on('console',m=>{if(m.type()==='error')report.errors.push(m.text());});
function check(name,ok,detail){report.checks.push({name,passed:!!ok,detail});if(!ok)throw Error(name+' '+JSON.stringify(detail));}
const advance=ms=>page.evaluate(ms=>advanceTime(ms),ms);
async function shot(name){await page.screenshot({path:new URL(name+'.png',out).pathname});report.captures.push(name);}
try{
 await page.goto('http://127.0.0.1:5189/demo/?test=1&seed=71&quality=high&dynres=0&mb=0');await page.waitForFunction(()=>__ready,null,{timeout:90000});await page.click('#start');
 await page.evaluate(()=>{const g=__test.g;g.bots.update=()=>{};g.bots.raycast=()=>null;g.player.invulnerable=true;advanceTime(300);});
 for(let i=0;i<24;i++)await advance(0);
 await page.evaluate(()=>{
  const g=__test.g,T=g.THREE;
  window.weaponAudit=(root,id)=>{
   root.updateMatrixWorld(true);
   const hand=root.getObjectByName('trigger-hand'),support=root.getObjectByName('support-hand'),finger=root.getObjectByName('trigger-finger');
   const v=(p,node)=>new T.Vector3(...p).applyMatrix4(node.matrixWorld).applyMatrix4(root.matrixWorld.clone().invert());
   const grip=v([.006,-.031,-.085],hand),palm=v([0,-.015,-.055],support);
   const trigger=root.userData.assetPlan.parts.find(p=>p.group===id+'-assembly'&&p.name==='trigger');
   const box=new T.Box3(new T.Vector3(...trigger.min),new T.Vector3(...trigger.max));let fingerGap=Infinity;
   const a=finger.geometry.attributes.position;
   for(let i=0;i<a.count;i++){const p=new T.Vector3().fromBufferAttribute(a,i).applyMatrix4(finger.matrixWorld).applyMatrix4(root.matrixWorld.clone().invert());fingerGap=Math.min(fingerGap,box.distanceToPoint(p));}
   return {grip:grip.toArray(),palm:palm.toArray(),handScale:hand.scale.toArray(),fingerGap,trigger:trigger,models:root.userData.stats.models};
  };
  window.weaponStudio=(side)=>{
   const scene=new T.Scene();scene.background=new T.Color(.14,.16,.18);
   const clone=g.weapon.root.clone();clone.position.set(0,0,0);clone.rotation.set(0,0,0);clone.scale.setScalar(1);scene.add(clone);
   const hemi=new T.HemisphereLight(0xe4efff,0x6e6260,2.5),key=new T.DirectionalLight(0xffe1b6,3);key.position.set(-1,2,1);scene.add(hemi,key);
   const camera=new T.PerspectiveCamera(40,1280/720,.01,10);camera.layers.enableAll();
   const views={right:[[1.1,.1,.38],[0,-.03,-.14]],left:[[-1.1,.16,.2],[0,-.03,-.14]],top:[[.40,1.2,.15],[0,-.04,-.14]],hands:[[.44,-.12,.42],[0,-.04,-.04]]};
   camera.position.fromArray(views[side][0]);camera.lookAt(...views[side][1]);
   g.renderer.setRenderTarget(null);g.renderer.render(scene,camera);
  };
 });
 report.baseline=await page.evaluate(async()=>{
  const g=__test.g,T=g.THREE,{createWeapons}=await import('/demo/artifacts/hands-weapons-before/weapons.js');
  const old=createWeapons({...g,viewScene:new T.Group(),shoot:()=>{}});old.update(.3);g.input.fire=true;old.update(.02);g.input.fire=false;old.update(.2);
  const data=weaponAudit(old.root,'ak');return data;
 });
 for(const id of ['ak','m4']){
  await page.evaluate(id=>{__test.g.weapon.reset(id);advanceTime(300);},id);
  await shot(id+'-idle');
  for(const view of ['right','left','top']){await page.evaluate(view=>weaponStudio(view),view);await shot(id+'-'+view);}
  await advance(0);await page.keyboard.down('Enter');await advance(34);await page.keyboard.up('Enter');await advance(45);
  const contact=await page.evaluate(id=>weaponAudit(__test.g.weapon.root,id),id);
  check(id+'-metre-hand-scale',contact.handScale.every(v=>v===1),contact);
  check(id+'-trigger-contact',contact.fingerGap<.009,contact);
  check(id+'-seven-buckets',contact.models[id].meshes===7,contact.models[id]);
  const datums=await page.evaluate(()=>{const g=__test.g,T=g.THREE,r=g.weapon.root,d=r.userData.assetPlan.datums[g.weapon.id],a=weaponAudit(r,g.weapon.id);return {gripError:new T.Vector3(...a.grip).distanceTo(new T.Vector3(...d.grip)),palmError:new T.Vector3(...a.palm).distanceTo(new T.Vector3(...d.foregrip))};});
  check(id+'-grip-palm-anchors',datums.gripError<1e-6&&datums.palmError<1e-6,datums);
  const projection=await page.evaluate(()=>{
   const g=__test.g,T=g.THREE,r=g.weapon.root;g.camera.updateMatrixWorld(true);g.viewCamera.updateMatrixWorld(true);r.updateMatrixWorld(true);
   const flash=r.getObjectByName('muzzle-flash').getWorldPosition(new T.Vector3()).project(g.viewCamera),fx=g.weapon.effectPoint('muzzle').project(g.camera);
   return {pixelError:Math.hypot((flash.x-fx.x)*640,(flash.y-fx.y)*360),muzzle:g.weapon.effectPoint('muzzle').toArray(),eject:g.weapon.effectPoint('eject').toArray()};
  });check(id+'-effect-projection',projection.pixelError<.1,projection);
  // Tactical then empty reload: track actual hand/magazine/bolt transforms.
  for(const empty of [false,true]){
   if(empty){await page.keyboard.down('Enter');await advance(4500);await page.keyboard.up('Enter');}
   const ammoBefore=await page.evaluate(()=>__test.g.weapon.ammo);check(id+'-'+(empty?'empty':'tactical')+'-fixture',empty?ammoBefore===0:ammoBefore>0&&ammoBefore<30,ammoBefore);
   await page.keyboard.down('r');await advance(1000/60);await page.keyboard.up('r');
   const samples=[];let previous=1/60;const duration=id==='ak'?2.4:2.2;
   for(const t of [.18,.20,.21,.34,.55,.56,.57,.80,.85,.87,.90,.94,1.01]){
    await advance(Math.max(0,(t*duration-previous)*1000));previous=Math.ceil(t*duration*60)/60;
    samples.push(await page.evaluate(()=>{
     const g=__test.g,T=g.THREE,w=g.weapon,r=w.root,m=r.getObjectByName(w.id+'-assembly'),hand=r.getObjectByName('support-hand'),mag=m.getObjectByName('magazine'),d=r.userData.assetPlan.datums[w.id];
     const relative=new T.Vector3(...d.magazine).applyQuaternion(mag.quaternion).add(mag.position);
     const palm=new T.Vector3(0,-.015,-.055).applyQuaternion(hand.quaternion).add(hand.position);
     const rack=new T.Vector3(0,-.024,-.118).applyQuaternion(hand.quaternion).add(hand.position);
     const handle=new T.Vector3(...d.handle).add(m.getObjectByName('bolt').position);
     return {p:w.reloadProgress,ammo:w.ammo,reloading:w.reloading,...w.motion,palmMagError:palm.distanceTo(relative),rackError:rack.distanceTo(handle)};
    }));
    if([.18,.34,.56,.85,.87,.94,1.01].includes(t)){await shot(id+'-'+(empty?'empty':'tactical')+'-'+t);if(t===.34||t===.87){await page.evaluate(()=>weaponStudio('right'));await shot(id+'-'+(empty?'empty':'tactical')+'-'+t+'-side');await advance(0);}}
   }
   check(id+'-'+(empty?'empty':'tactical')+'-magazine-contact',samples.filter(s=>s.p>=.20&&s.p<.56).every(s=>s.palmMagError<1e-6),samples);
   check(id+'-'+(empty?'empty':'tactical')+'-refill-at-seat',samples.find(s=>s.p>=.56&&s.p<.60)?.ammo===30,samples.map(s=>({p:s.p,ammo:s.ammo})));
   check(id+'-'+(empty?'empty':'tactical')+'-bolt',empty?samples.some(s=>s.bolt>.04&&s.rackError<1e-6):samples.every(s=>s.bolt===0),samples.filter(s=>s.p>=.8));
   check(id+'-'+(empty?'empty':'tactical')+'-finish',samples.at(-1).ammo===30&&!samples.at(-1).reloading&&samples.at(-1).magazine.every(v=>Math.abs(v)<1e-6));
  }
 }
 await page.goto('http://127.0.0.1:5189/demo/?test=1&quality=high&post=0');await page.waitForFunction(()=>__ready,null,{timeout:90000});await page.click('#start');await page.evaluate(()=>advanceTime(0));await shot('no-post');
 check('no-runtime-errors',!report.errors.length,report.errors);report.status='passed';
}catch(error){report.status='failed';report.failure=String(error);console.error(error);process.exitCode=1;}
finally{await fs.writeFile(new URL('report.json',out),JSON.stringify(report,null,2));await browser.close();console.log(JSON.stringify({status:report.status,checks:report.checks.length,failure:report.failure,errors:report.errors}));}
