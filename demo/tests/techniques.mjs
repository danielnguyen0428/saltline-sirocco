import {chromium} from '/Users/meow/rea/trumviahe/node_modules/playwright/index.mjs';
import fs from 'node:fs/promises';
const out=new URL('../artifacts/techniques/',import.meta.url);await fs.mkdir(out,{recursive:true});
const report={reference:'TECHNIQUES.md',checks:[],errors:[],captures:[],limits:['Objective tests use isolated fixtures.','Wall-clock intervals are not GPU timings.','FX random variations are not used for pixel equality.']};
const browser=await chromium.launch({channel:'chrome',headless:true});
const page=await browser.newPage({viewport:{width:1280,height:720}});
page.on('pageerror',e=>report.errors.push(e.message));page.on('console',m=>{if(m.type()==='error')report.errors.push(m.text());});
function check(name,ok,detail){report.checks.push({name,passed:!!ok,detail});if(!ok)throw Error(name+': '+JSON.stringify(detail));}
const state=()=>page.evaluate(()=>JSON.parse(render_game_to_text()));
const advance=ms=>page.evaluate(ms=>advanceTime(ms),ms);
async function shot(name){await page.screenshot({path:new URL(name+'.png',out).pathname});report.captures.push(name);}
async function open(query='quality=high'){
 await page.goto('http://127.0.0.1:5189/demo/?test=1&seed=71&'+query);await page.waitForFunction(()=>window.__ready,null,{timeout:90000});
 await page.click('#start');await page.evaluate(()=>{const g=__test.g;g.bots.actualUpdate=g.bots.update;g.bots.update=()=>{};g.player.invulnerable=true;advanceTime(30);});
 // Stabilize exposure without moving the physics fixture.
 for(let i=0;i<24;i++)await advance(0);
}
try{
 await open();await shot('final');report.state=await state();
 report.frameSamples=[];for(let i=0;i<6;i++){await advance(0);report.frameSamples.push((await state()).render);}
 report.renderTargets=await page.evaluate(()=>__test.g.renderDiagnostics.stats().targets);
 const pipeline=report.state.pipeline;
 check('original-HDR-PCSS',pipeline.advanced&&pipeline.softShadows,pipeline);
 const names=pipeline.passes.map(p=>p.name);
 check('actual-post-pass-graph',['post-depthhalf','post-ao','post-vol','post-final'].every(n=>names.includes(n)),names);
 check('post-tuning-reaches-shaders',pipeline.passes.find(p=>p.name==='post-ao').tuning.uRadius===.65&&pipeline.passes.find(p=>p.name==='post-vol').tuning.uSigma===.0018&&pipeline.passes.find(p=>p.name==='post-composite').tuning.uAoStrength===.7);
 const hdr=pipeline.passes.find(p=>p.name==='world');check('HDR-depth-MSAA',hdr.hdr&&hdr.depth&&hdr.samples===4,hdr);
 check('frame-budget',report.state.render.calls<=300&&report.state.render.triangles<750000,report.state.render);
 const geometry=await page.evaluate(()=>{
  const g=__test.g,T=g.THREE,seen=new Set(),dynamic=new Set();g.fx.root.traverse(n=>{if(n.geometry)dynamic.add(n.geometry);});let invalid=0,degenerate=0,normalErrors=0,vertices=0,dynamicTemplates=0;
  g.scene.traverse(node=>{
   if(!node.isMesh||seen.has(node.geometry)||node.geometry.isInstancedBufferGeometry)return;const geo=node.geometry;seen.add(geo);
   for(const a of Object.values(geo.attributes))for(const x of a.array)if(!Number.isFinite(x))invalid++;
   if(dynamic.has(geo)){dynamicTemplates++;return;}
   const p=geo.attributes.position,n=geo.attributes.normal;if(!p)return;vertices+=p.count;
   if(n)for(let i=0;i<n.count;i++){const length=Math.hypot(n.getX(i),n.getY(i),n.getZ(i));if(length<.8||length>1.2)normalErrors++;}
   const a=new T.Vector3(),b=new T.Vector3(),c=new T.Vector3();const count=geo.index?.count||p.count;
   for(let i=0;i<count;i+=3){a.fromBufferAttribute(p,geo.index?geo.index.getX(i):i);b.fromBufferAttribute(p,geo.index?geo.index.getX(i+1):i+1);c.fromBufferAttribute(p,geo.index?geo.index.getX(i+2):i+2);if(b.sub(a).cross(c.sub(a)).lengthSq()<1e-20)degenerate++;}
  });return {invalid,degenerate,normalErrors,geometries:seen.size,vertices,dynamicTemplates};
 });check('valid-geometry',geometry.invalid===0&&geometry.degenerate===0&&geometry.normalErrors===0,geometry);
 const rig=await page.evaluate(()=>{
  const g=__test.g,T=g.THREE,list=g.bots.list,b=list[0],geo=b.mesh.geometry,weights=geo.attributes.skinWeight,ids=geo.attributes.skinIndex;
  let bad=0;for(let i=0;i<weights.count;i++)if(weights.getX(i)!==1||weights.getY(i)!==0||ids.getX(i)>=b.skeleton.bones.length)bad++;
  const knee=b.knees[0],boneIndex=b.skeleton.bones.indexOf(knee),points=[];
  for(let i=0;i<ids.count;i++)if(ids.getX(i)===boneIndex)points.push(i);
  b.root.updateMatrixWorld(true);b.skeleton.update();
  const before=points.map(i=>b.mesh.getVertexPosition(i,new T.Vector3()).clone());
  knee.rotation.x=.65;b.root.updateMatrixWorld(true);b.skeleton.update();
  let delta=0;points.forEach((i,j)=>{delta=Math.max(delta,b.mesh.getVertexPosition(i,new T.Vector3()).distanceTo(before[j]));});
  knee.rotation.x=0;b.root.updateMatrixWorld(true);b.skeleton.update();
  return {shared:new Set(list.map(b=>b.mesh.geometry)).size,skeletons:new Set(list.map(b=>b.skeleton)).size,
   materialArrays:new Set(list.map(b=>b.mesh.material)).size,skinned:list.every(b=>b.mesh.isSkinnedMesh),bad,delta,bones:b.skeleton.bones.length,groups:geo.groups.length};
 });check('shared-rigid-skin-independent-skeleton',rig.shared===1&&rig.skeletons===4&&rig.materialArrays===4&&rig.skinned&&rig.bad===0&&rig.delta>.05,rig);
 const assets=report.state.assets;check('loft-spring-quad-weapon',assets.weapon.springs===9&&assets.weapon.muzzleQuads===8&&assets.weapon.handTechnique.includes('loft'),assets.weapon);
 check('ground-mask-softprops-atlas',assets.ground.maskResolution===512&&assets.map.softProps===7&&assets.map.labelTextures===1&&assets.map.colliders===79,{ground:assets.ground,map:assets.map});
 const samples=await page.evaluate(()=>{const ground=__test.g.ground;return [[0,23],[5.1,10],[100,100],[-100,-100]].map(([x,z])=>({x,z,values:[0,1,2,3].map(c=>ground.sample(x,z,c)),surface:ground.surfaceAt(x,z),wet:ground.wetnessAt(x,z)}));});
 check('ground-CPU-mask-queries',samples.every(p=>p.values.every(v=>Number.isFinite(v)&&v>=0&&v<=1)&&p.wet===0)&&samples[0].values[1]!==samples[1].values[1],samples);
 for(const mode of ['clay','normals']){await page.evaluate(mode=>{__test.setSurfaceDebug(mode);advanceTime(0);},mode);await shot(mode);}
 await page.evaluate(()=>{__test.setSurfaceDebug('final');advanceTime(0);});
 for(const mode of ['post-depthhalf','post-ao','post-vol']){await page.evaluate(mode=>{__test.setDebugPass(mode);advanceTime(0);},mode);await shot(mode);}
 await page.evaluate(()=>{__test.setDebugPass('final');__test.g.ground.setDebug(true);advanceTime(0);});await shot('ground-mask');
 await page.evaluate(()=>{__test.g.ground.setDebug(false);__test.place(17,-17,-1.3);advanceTime(0);});await shot('site-a');
 await page.evaluate(()=>{__test.place(0,23);const g=__test.g;g.bots.list[0].pos.set(0,0,19);g.bots.list[0].root.rotation.y=Math.PI;advanceTime(0);});await shot('bot-front');
 // Actual controller moves/poses the bot, without shooting the player.
 const motion=[];
 await page.evaluate(()=>{const g=__test.g,b=g.bots.list[0];b.pos.set(0,0,17);b.goal.set(0,0,12);b.wait=-1;b.planTime=-1;g.physics.originalLOS=g.physics.lineOfSight;g.physics.lineOfSight=()=>false;g.bots.update=g.bots.actualUpdate;});
 for(let i=0;i<5;i++){await advance(100);await shot('walk-'+i);motion.push(await page.evaluate(()=>{const b=__test.g.bots.list[0];return {pos:b.pos.toArray(),legs:b.legs.map(b=>b.rotation.x)};}));}
 check('controller-walk-motion',Math.abs(motion[4].pos[2]-motion[0].pos[2])>.3&&motion[4].legs[0]!==motion[0].legs[0],motion);
 await page.evaluate(()=>{const g=__test.g;g.physics.lineOfSight=g.physics.originalLOS;__test.start(false);g.bots.update=()=>{};g.player.invulnerable=true;advanceTime(250);});
 await page.keyboard.down('Enter');await advance(330);await page.keyboard.up('Enter');await shot('fire');
 const fire=await page.evaluate(()=>__test.g.weapon.motion);check('spring-recoil-impulse',Math.abs(fire.springs.recoilZ.position)>.001&&fire.finger>.5,fire);
 await page.keyboard.down('r');await advance(20);await page.keyboard.up('r');const reload=[];
 for(const [name,time] of [['reach',450],['out',450],['in',800],['done',900]]){await advance(time);await shot('reload-'+name);reload.push(await page.evaluate(()=>({motion:__test.g.weapon.motion,reloading:__test.g.weapon.reloading,ammo:__test.g.weapon.ammo})));}
 check('magazine-detaches-reseats',reload[1].motion.magazine[1]<-.1&&reload[3].motion.magazine.every(v=>Math.abs(v)<1e-6)&&!reload[3].reloading&&reload[3].ammo===30,reload.map(s=>({mag:s.motion.magazine,ammo:s.ammo,reloading:s.reloading})));
 await advance(1600);const settle=await page.evaluate(()=>__test.g.weapon.motion.springs);check('springs-settle',Object.values(settle).every(s=>Math.abs(s.position)<.001&&Math.abs(s.velocity)<.001),settle);
 await page.evaluate(()=>{__test.g.weapon.select('m4');advanceTime(100);});await shot('m4');
 await page.evaluate(()=>{const g=__test.g,T=g.THREE;g.fx.explosion(new T.Vector3(0,.2,16),1.6);g.events.emit('impact',{point:new T.Vector3(-2,1,12),normal:new T.Vector3(0,0,1),surface:'concrete',dir:new T.Vector3(0,0,-1)});advanceTime(100);});await shot('explosion');
 const pool=await page.evaluate(()=>{
  const g=__test.g,T=g.THREE,a=new T.Vector3(0,1,22),b=new T.Vector3(0,1,16);
  for(let i=0;i<64;i++){g.fx.tracer(a,b);g.fx.shell(a,new T.Vector3(1,2,0));}advanceTime(20);
  const before={...g.renderer.info.memory};for(let i=0;i<600;i++)g.fx.tracer(a,b);advanceTime(0);
  const peak=g.fx.stats();advanceTime(22000);const after={...g.renderer.info.memory};
  return {before,after,peak,end:g.fx.stats(),batches:g.fx.root.children.length};
 });check('five-batch-FX-bounded',pool.batches===5&&pool.peak.tracers<=48&&pool.before.geometries===pool.after.geometries&&pool.end.tracers===0&&pool.end.lit===0&&pool.end.add===0,pool);
 await page.waitForFunction(()=>__test.g.audio.debug().pending===0,null,{timeout:60000});
 const audio=await page.evaluate(()=>__test.g.audio.debug());check('DSP-reverb-stems-master',audio.reverb.length===2&&audio.reverb.every(Boolean)&&audio.stems===5&&audio.capacity===45&&audio.compressor&&audio.softClip&&audio.failed===0,audio);
 // The last shot may end a round inside weapon.fire; visual TTL must still decay.
 const resultFX=await page.evaluate(()=>{const g=__test.g;__test.start(false);g.bots.update=()=>{};g.input.fire=true;advanceTime(250);g.input.fire=false;__test.finish('t','QA');advanceTime(250);return {phase:g.game.phase,visible:g.weapon.root.getObjectByName('muzzle-flash').visible};});
 check('result-muzzle-TTL',resultFX.phase==='result'&&!resultFX.visible,resultFX);
 const resetAudio=await page.evaluate(()=>{const g=__test.g;g.audio.play('explosion',{gain:.1});const before=g.audio.debug().voices;__test.start(false);return {before,after:g.audio.debug().voices,stems:g.audio.debug().stems};});
 check('round-clears-audio-voices',resetAudio.before>0&&resetAudio.after===0&&resetAudio.stems===5,resetAudio);
 await page.setViewportSize({width:390,height:844});await advance(0);await shot('narrow');
 check('resize-HDR',await page.evaluate(()=>Math.abs(__test.g.camera.aspect-390/844)<.001&&__test.g.render.resolution.x>0));
 await page.setViewportSize({width:1280,height:720});
 for(const [name,query] of [['no-post','quality=high&post=0'],['low','quality=low'],['seed-993','quality=medium&seed=993']]){
  await open(query);await shot(name);const s=await state();
  check(name,name==='no-post'?!s.pipeline.advanced:name==='low'?s.assets.textureSize===512&&s.pipeline.passes.find(p=>p.name==='world')?.samples===0:s.pipeline.advanced,{render:s.render,pipeline:s.pipeline,ground:s.assets.ground});
 }
 check('no-runtime-errors',report.errors.length===0,report.errors);report.status='passed';
}catch(error){report.status='failed';report.error=String(error.stack);try{await shot('failure');}catch{}}
finally{await fs.writeFile(new URL('report.json',out),JSON.stringify(report,null,2));console.log(JSON.stringify({status:report.status,checks:report.checks.length,error:report.error,errors:report.errors.slice(0,3)}));await browser.close();if(report.status!=='passed')process.exitCode=1;}
