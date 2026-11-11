import { createMap } from './map.js';
import { createWeapons } from './weapons.js';
import { createBots } from './bots.js';
import { createAudio } from './audio.js';

const E = window.SaltlineEngine, T = E.THREE;
const $ = id => document.getElementById(id);
const params = Object.fromEntries(new URLSearchParams(location.search));
const testMode = params.test === '1';
const textureSize = params.quality === 'low' ? 512 : 1024;
const keys = new Set();
const game = {phase:'menu', role:'attack', weapon:'ak', round:1, score:{ct:0,t:0}, time:105, kills:0, armor:100,
  hold:0, bomb:{planted:false,pos:null,site:null,time:40,defuseProgress:0}, result:null};
const g = {THREE:T, params:{wet:0,tex:textureSize,seed:+(params.seed||71)},quality:{tex:textureSize},events:E.createEvents(),rng:E.createRng(+(params.seed||71)),
  time:{t:0}, game, render:{post:{}}, ground:{isPuddle:()=>false}};
window.__ready = false;
const effects = [];
const effectCapacity = 32;
let effectCursor = 0;
const debugMaterials = {};
let accumulator=0, last=performance.now(), manualClock=false, hitTime=0, beep=0, uiTimer=0, freezeTimer=0;
let elapsedFrames=0, measuredMs=0, interactSite=null;
const roundLength=105, fuseLength=40, plantSeconds=3.2, defuseSeconds=5;
let renderer, camera, scene, viewScene, viewCamera, bombRoot, bombLed, radar;

async function boot() {
  renderer = new T.WebGLRenderer({canvas:$('view'),antialias:true,powerPreference:'high-performance'});
  renderer.setPixelRatio(Math.min(devicePixelRatio,1.5));
  renderer.outputColorSpace=T.SRGBColorSpace; renderer.toneMapping=T.ACESFilmicToneMapping; renderer.toneMappingExposure=1.1;
  renderer.shadowMap.enabled=true; renderer.shadowMap.type=T.PCFSoftShadowMap; renderer.autoClear=false;
  scene=new T.Scene();scene.background=new T.Color(0xa6cad8);scene.fog=new T.Fog(0xc8d4ce,55,155);
  camera=new T.PerspectiveCamera(75,1,.06,180);
  scene.add(new T.HemisphereLight(0xd8edff,0xa58a65,2.2));
  const sun=new T.DirectionalLight(0xffe3af,3.0);sun.position.set(-25,45,18);sun.castShadow=true;
  sun.shadow.mapSize.set(2048,2048);Object.assign(sun.shadow.camera,{left:-42,right:42,top:42,bottom:-42,near:.5,far:120});
  sun.shadow.bias=-.0004;sun.shadow.normalBias=.025;scene.add(sun);
  viewScene=new T.Scene(); viewCamera=new T.PerspectiveCamera(54,1,.02,5);
  const environmentCanvas=document.createElement('canvas');environmentCanvas.width=128;environmentCanvas.height=64;
  const ec=environmentCanvas.getContext('2d'),sky=ec.createLinearGradient(0,0,0,64);
  sky.addColorStop(0,'#c8dfeb');sky.addColorStop(.45,'#f7edd6');sky.addColorStop(.55,'#bcaa84');sky.addColorStop(1,'#695e4c');ec.fillStyle=sky;ec.fillRect(0,0,128,64);
  const environment=new T.CanvasTexture(environmentCanvas);environment.mapping=T.EquirectangularReflectionMapping;environment.colorSpace=T.SRGBColorSpace;
  scene.environment=environment;viewScene.environment=environment;
  viewScene.add(new T.HemisphereLight(0xd9eafb,0xb49a72,2));
  const fill=new T.DirectionalLight(0xffe7c5,2.6);fill.position.set(-2,4,1);viewScene.add(fill);
  Object.assign(g,{renderer,scene,camera,viewScene,viewCamera});
  $('boot-msg').textContent='Dựng vật liệu và bản đồ…';
  g.mats=await E.createMaterials(g);g.mats.uniforms.wet.value=0;g.props=E.createProps(g);g.physics=E.createPhysics(g);
  g.physics.bounds.min.set(-28,0,-28);g.physics.bounds.max.set(28,20,28);
  g.level=createMap(g);g.physics.build();
  g.input=E.createInput(g);g.player=E.createPlayer(g);g.player.reset(g.level.playerStart);g.player.enabled=false;
  g.events.on('player:dead',()=>finishRound(game.role==='attack'?'ct':'t','Bạn đã bị hạ gục'));
  Object.assign(g.player.tuning,{walk:4.6,sprint:4.6,crouch:1.8,ads:4.6,fovSprint:0,fovAds:75,regenRate:0,bobY:.012,bobX:.008});
  g.player.setFov(75);g.audio=createAudio(g);
  Object.assign(g,{shoot,onPlayerHit,trace,onBotKilled,onBotDefuse});
  g.weapon=createWeapons(g);g.weapon.ads=0;g.weapon.setVisible(false);
  g.bots=createBots(g);g.bots.reset('attack',g.level.botSpawns);
  makeBomb();createTracerPool();setSurfaceDebug(params.debug);radar=$('radar').getContext('2d');
  wireUI(); resize();setMenuCamera();
  $('boot').hidden=true;$('start').disabled=false;$('start').textContent='BẮT ĐẦU NHIỆM VỤ';
  renderer.setAnimationLoop(loop);window.__ready=true;
  window.render_game_to_text=()=>JSON.stringify(snapshot());
  window.advanceTime=ms=>{manualClock=true;for(let n=0;n<Math.ceil(ms/(1000/60));n++)step(1/60);render();};
  window.__THREE_GAME_DIAGNOSTICS__={renderer:renderer.info,get state(){return snapshot();}};
  if(testMode) window.__test={g,setSurfaceDebug,start:startRound,step:window.advanceTime,pause:togglePause,
    place(x,z,yaw=0){g.player.pos.set(x,0,z);g.player.vel.set(0,0,0);g.player.yaw=yaw;g.player.pitch=0;g.player.update(0);},
    damage:onPlayerHit,finish:finishRound};
  if(params.autostart==='1')startRound(false);
}
function setMenuCamera(){camera.position.set(9,12,23);camera.lookAt(-5,3,-6);camera.fov=60;camera.updateProjectionMatrix();}
function resize(){renderer.setSize(innerWidth,innerHeight);camera.aspect=innerWidth/innerHeight;camera.updateProjectionMatrix();viewCamera.aspect=camera.aspect;viewCamera.updateProjectionMatrix();}
function wireUI(){
  document.querySelectorAll('[data-role]').forEach(btn=>btn.onclick=()=>{game.role=btn.dataset.role;document.querySelectorAll('[data-role]').forEach(b=>b.classList.toggle('selected',b===btn));});
  document.querySelectorAll('[data-weapon]').forEach(btn=>btn.onclick=()=>{game.weapon=btn.dataset.weapon;document.querySelectorAll('[data-weapon]').forEach(b=>b.classList.toggle('selected',b===btn));});
  $('start').onclick=()=>{game.round=1;game.score={ct:0,t:0};startRound();};
  $('next').onclick=()=>{game.round++;startRound();};
  $('pause').onclick=togglePause;$('resume').onclick=togglePause;
  $('restart').onclick=()=>{game.round=1;game.score={ct:0,t:0};startRound();};
  $('back').onclick=returnMenu;$('result-back').onclick=returnMenu;
  $('sound').onclick=()=>{g.audio.mute(!g.audio.muted);$('sound').textContent=g.audio.muted?'ÂM: TẮT':'ÂM: BẬT';};
  window.addEventListener('resize',resize);
  window.addEventListener('keydown',event=>{
    keys.add(event.code);
    if(event.code==='KeyF'&&!event.repeat){if(document.fullscreenElement)document.exitFullscreen();else $('app').requestFullscreen?.().catch(()=>{});}
  });
  window.addEventListener('keyup',event=>keys.delete(event.code));
  window.addEventListener('blur',()=>{keys.clear();if(game.phase==='playing')togglePause();});
  document.addEventListener('visibilitychange',()=>{if(document.hidden&&game.phase==='playing')togglePause();});
}
function startRound(lock=true){
  game.phase='playing';game.time=roundLength;game.hold=0;game.kills=0;game.armor=100;game.result=null;freezeTimer=0;
  game.bomb={planted:false,pos:null,site:null,time:fuseLength,defuseProgress:0};
  g.rng=E.createRng(71+game.round);g.player.reset(game.role==='attack'?g.level.playerStart:g.level.defenderStart);
  g.player.enabled=true;g.player.invulnerable=false;g.weapon.reset(game.weapon);g.weapon.setVisible(true);
  g.bots.reset(game.role,g.level.botSpawns);bombRoot.visible=false;
  if(game.role==='defend'){
    const site=g.level.sites[(game.round-1)%2];plantBomb(site);game.bomb.time=55;
  }
  g.input.setGameplay(true);keys.clear();g.audio.resume().catch(()=>{});
  if(lock)g.input.requestLock();
  for(const id of ['menu','pause-menu','result'])$(id).hidden=true;
  $('hud').hidden=false;$('feed').replaceChildren();beep=0;hitTime=0;clearEffects();updateHUD();
}
function returnMenu(){game.phase='menu';g.input.setGameplay(false);g.input.exitLock();g.weapon.setVisible(false);g.audio.pause(true);$('menu').hidden=false;$('hud').hidden=true;$('pause-menu').hidden=true;$('result').hidden=true;setMenuCamera();}
function togglePause(){
  if(game.phase!=='playing'&&game.phase!=='paused')return;
  const pause=game.phase==='playing';game.phase=pause?'paused':'playing';g.input.setGameplay(!pause);keys.clear();
  $('pause-menu').hidden=!pause;g.audio.pause(pause);if(pause)g.input.exitLock();else g.input.requestLock();
}
function finishRound(winner,reason){
  if(game.phase!=='playing')return;
  game.phase='result';game.score[winner]++;game.result={winner,reason};g.input.setGameplay(false);g.input.exitLock();
  const won=winner===(game.role==='attack'?'t':'ct');
  $('result-team').textContent=winner==='t'?'TẤN CÔNG THẮNG':'PHÒNG THỦ THẮNG';
  $('result-title').textContent=won?'NHIỆM VỤ HOÀN THÀNH':'ROUND KẾT THÚC';
  $('result-detail').textContent=reason+' · '+game.kills+' hạ gục · '+g.weapon.shots+' phát bắn';
  $('result').hidden=false;g.audio.play(won?'complete':'death',{gain:.3});updateHUD();
}
function makeBomb(){
  bombRoot=new T.Group();bombRoot.name='planted-device';scene.add(bombRoot);bombRoot.visible=false;
  const body=new T.Mesh(E.beveledBox(.44,.16,.32,.015),g.mats.get('polymer_tan',{triplanar:true,interior:true}));body.position.y=.13;bombRoot.add(body);
  for(let i=0;i<4;i++){const c=new T.Mesh(new T.CylinderGeometry(.037,.037,.36,10),g.mats.get('paint_grey',{color:0x8b6b3c,triplanar:true,interior:true}));c.rotation.z=Math.PI/2;c.position.set(0,.06,(i-1.5)*.067);bombRoot.add(c);}
  const display=new T.Mesh(new T.PlaneGeometry(.18,.07),new T.MeshBasicMaterial({color:0x98db7a}));display.rotation.x=-Math.PI/2;display.position.set(0,.215,0);bombRoot.add(display);
  bombLed=new T.Mesh(new T.SphereGeometry(.024,8,6),new T.MeshBasicMaterial({color:0xff2b13}));bombLed.position.set(.16,.23,0);bombRoot.add(bombLed);
}
function plantBomb(site){game.bomb.planted=true;game.bomb.pos=site.pos.clone();game.bomb.site=site.id;game.bomb.time=fuseLength;game.hold=0;bombRoot.position.copy(site.pos);bombRoot.visible=true;g.audio.play('objective_all',{gain:.35});}
function updateObjective(dt){
  interactSite=null;
  if(!game.bomb.planted){
    game.time-=dt;
    if(game.time<=0){finishRound('ct','Hết thời gian đặt bom');return;}
    if(game.role==='attack')interactSite=g.level.sites.find(s=>Math.hypot(g.player.pos.x-s.pos.x,g.player.pos.z-s.pos.z)<s.radius&&g.player.pos.y<.4);
  }else{
    game.bomb.time-=dt;beep-=dt;bombLed.visible=Math.sin(g.time.t*12)>0;
    if(beep<=0){beep=Math.max(.12,game.bomb.time/42);g.audio.play('ui_hover',{pos:game.bomb.pos,gain:.25,pitch:1.6});}
    if(game.bomb.time<=0){trace(game.bomb.pos.clone().add(new T.Vector3(0,1,0)),game.bomb.pos.clone().add(new T.Vector3(0,7,0)),0xffad42);finishRound('t','Bom đã phát nổ');return;}
    if(game.role==='defend'&&g.player.pos.distanceTo(game.bomb.pos)<2.2&&g.physics.lineOfSight(g.player.eye,game.bomb.pos.clone().add(new T.Vector3(0,.25,0))))interactSite={id:game.bomb.site};
  }
  const holding=g.player.alive&&!!interactSite&&g.input.down('interact')&&g.player.onGround;
  if(holding){
    game.hold+=dt;g.player.vel.x=g.player.vel.z=0;
    if(game.hold>=(game.role==='attack'?plantSeconds:defuseSeconds)){
      if(game.role==='attack')plantBomb(interactSite);else finishRound('ct','Đã gỡ bom an toàn');
    }
  }else game.hold=0;
  g.player.enabled=!holding; if(holding)g.input.fire=false;
}
function onBotDefuse(dt,botId=null){
  if(game.phase!=='playing'||game.role!=='attack'||!game.bomb.planted)return;
  if(dt===0){game.bomb.defuseProgress=0;game.bomb.defuser=null;return;}
  if(game.bomb.defuser!==botId){game.bomb.defuseProgress=0;game.bomb.defuser=botId;}
  game.bomb.defuseProgress+=dt;
  if(game.bomb.defuseProgress>=10)finishRound('ct','Đối phương đã gỡ bom');
}
function onPlayerHit(amount,from){
  if(game.phase!=='playing'||!g.player.alive)return;
  const absorbed=Math.min(game.armor,amount*.45);game.armor-=absorbed;g.player.damage(amount-absorbed,from);
  g.audio.play('hurt',{gain:.35});
  if(!g.player.alive)finishRound(game.role==='attack'?'ct':'t','Bạn đã bị hạ gục');
}
function onBotKilled(bot,headshot){
  game.kills++;addFeed(`${headshot?'HEADSHOT · ':''}${g.weapon.name} → ${bot.name||'Đối phương'}`);g.audio.play('impact_enemy',{gain:.4});
  if(g.bots.aliveCount===0&&game.role==='attack')finishRound('t','Đã loại toàn bộ đội phòng thủ');
}
function shoot({damage,spread,range,weapon}){
  if(game.phase!=='playing'||game.hold>0)return;
  const origin=g.player.eye.clone(), direction=g.player.forward.clone();
  direction.x+=(g.rng()-.5)*spread*2;direction.y+=(g.rng()-.5)*spread*2;direction.z+=(g.rng()-.5)*spread*2;direction.normalize();
  const wall=g.physics.raycast(origin,direction,range), hit=g.bots.raycast(origin,direction,wall?wall.dist:range);
  const end=hit?hit.point:wall?wall.point:origin.clone().addScaledVector(direction,range);
  const muzzle=origin.clone().add(new T.Vector3(.22,-.17,0).applyQuaternion(camera.quaternion));
  trace(muzzle,end,0xffdf94);g.bots.alert?.(origin);
  if(hit){hitTime=.12;g.bots.damage(hit,damage*(hit.headshot?4:1));}
  else if(wall){g.audio.play('impact_'+(wall.surface==='metal'?'metal':'concrete'),{pos:wall.point,gain:.2});}
}
function createTracerPool() {
  for (let index = 0; index < effectCapacity; index++) {
    const geometry = new T.BufferGeometry();
    geometry.setAttribute('position', new T.BufferAttribute(new Float32Array(6), 3).setUsage(T.DynamicDrawUsage));
    const material = new T.LineBasicMaterial({color: 0xffd28b, transparent: true, opacity: .7, depthWrite: false});
    const mesh = new T.Line(geometry, material);
    mesh.name = 'tracer-' + index;
    mesh.frustumCulled = false;
    mesh.visible = false;
    scene.add(mesh);
    effects.push({mesh, life: 0});
  }
}
function trace(from, to, color = 0xffd28b) {
  const effect = effects[effectCursor];
  effectCursor = (effectCursor + 1) % effectCapacity;
  const positions = effect.mesh.geometry.attributes.position;
  positions.setXYZ(0, from.x, from.y, from.z);
  positions.setXYZ(1, to.x, to.y, to.z);
  positions.needsUpdate = true;
  effect.mesh.material.color.setHex(color);
  effect.mesh.visible = true;
  effect.life = .065;
}
function clearEffects() {
  for (const effect of effects) {
    effect.life = 0;
    effect.mesh.visible = false;
  }
  effectCursor = 0;
}
function setSurfaceDebug(mode = 'final') {
  if (mode === 'clay' || mode === 'normals') {
    debugMaterials[mode] ||= mode === 'clay'
      ? new T.MeshStandardMaterial({color: 0xb7b7b7, roughness: .85})
      : new T.MeshNormalMaterial();
    scene.overrideMaterial = viewScene.overrideMaterial = debugMaterials[mode];
  } else {
    scene.overrideMaterial = viewScene.overrideMaterial = null;
  }
}
function addFeed(text){const item=document.createElement('div');item.textContent=text;$('feed').prepend(item);while($('feed').children.length>4)$('feed').lastChild.remove();}
function step(dt){
  g.input.update(dt);
  if(g.input.pressed('pause'))togglePause();
  if(game.phase==='playing'){
    g.time.t+=dt;
    g.player.tuning.walk=(keys.has('ShiftLeft')||keys.has('ShiftRight'))?2.2:4.6;g.input.sprint=false;g.input.ads=false;
    g.player.update(dt);updateObjective(dt);
    if(game.phase==='playing'){g.weapon.update(dt);g.bots.update(dt);}
    for (const effect of effects) {
      if (effect.life <= 0) continue;
      effect.life = Math.max(0, effect.life - dt);
      effect.mesh.visible = effect.life > 0;
    }
    hitTime=Math.max(0,hitTime-dt);g.level.update?.(dt);
  }
  g.mats.update(dt);g.input.endFrame();uiTimer+=dt;if(uiTimer>.05){updateHUD();uiTimer=0;}
}
function loop(now){
  const delta=Math.min(.1,(now-last)/1000);last=now;
  if(!manualClock){accumulator+=delta;while(accumulator>=1/60){step(1/60);accumulator-=1/60;}}
  render();elapsedFrames++;measuredMs+=delta*1000;
}
function render(){
  renderer.info.reset();renderer.info.autoReset=false;renderer.clear();renderer.render(scene,camera);
  if(g.weapon.root.visible){renderer.clearDepth();renderer.render(viewScene,viewCamera);}
}
function drawRadar(){
  const c=radar;c.clearRect(0,0,220,220);const sc=3.3,xy=p=>[110+p.x*sc,110+p.z*sc];
  c.strokeStyle='#a9b2ad80';c.lineWidth=1;c.strokeRect(110-28*sc,110-28*sc,56*sc,56*sc);
  c.fillStyle='#a3a49a65';for(const r of g.level.radarRects||[])c.fillRect(110+(r.x-r.w/2)*sc,110+(r.z-r.d/2)*sc,r.w*sc,r.d*sc);
  c.font='bold 15px Arial';c.textAlign='center';for(const s of g.level.sites){const[x,z]=xy(s.pos);c.fillStyle='#e1bd75';c.fillText(s.id,x,z+5);}
  if(game.bomb.planted){const[x,z]=xy(game.bomb.pos);c.fillStyle='#ef674b';c.fillRect(x-4,z-4,8,8);}
  const[x,z]=xy(g.player.pos);c.save();c.translate(x,z);c.rotate(-g.player.yaw);c.fillStyle='#edf6f3';c.beginPath();c.moveTo(0,-8);c.lineTo(-5,5);c.lineTo(5,5);c.closePath();c.fill();c.restore();
  for(const b of g.bots.list){if(!b.alive)continue;const pos=b.pos||b.root?.position;if(!pos)continue;
    if(g.player.pos.distanceTo(pos)<25&&g.physics.lineOfSight(g.player.eye,pos.clone().add(new T.Vector3(0,1.5,0)))){const[x,z]=xy(pos);c.fillStyle='#ed7559';c.beginPath();c.arc(x,z,3,0,Math.PI*2);c.fill();}}
}
function updateHUD(){
  if(!g.player)return;
  $('health').textContent=Math.ceil(g.player.health);$('armor').textContent=Math.ceil(game.armor);$('ammo').textContent=g.weapon.ammo;$('reserve').textContent=g.weapon.reserve;$('weapon-name').textContent=g.weapon.name;
  $('reload-state').textContent=g.weapon.reloading?'ĐANG NẠP ĐẠN':g.weapon.ammo===0?'R · NẠP ĐẠN':'';
  const remaining=Math.ceil(Math.max(0,game.bomb.planted?game.bomb.time:game.time));$('timer').textContent=Math.floor(remaining/60)+':'+String(remaining%60).padStart(2,'0');
  $('round').textContent='ROUND '+game.round;$('ct-score').textContent=game.score.ct;$('t-score').textContent=game.score.t;
  document.querySelector('.score').classList.toggle('planted',game.bomb.planted);
  $('objective').textContent=game.bomb.planted?(game.role==='attack'?`BOM ĐÃ ĐẶT · GIỮ KHU ${game.bomb.site}`:`BOM TẠI ${game.bomb.site} · TIẾP CẬN VÀ GIỮ E`):'ĐẶT BOM TẠI A HOẶC B';
  if(game.bomb.defuseProgress>0&&game.role==='attack')$('objective').textContent='ĐỐI PHƯƠNG ĐANG GỠ BOM — NGĂN CHÚNG LẠI';
  $('interact').hidden=!interactSite||game.phase!=='playing';$('prompt').textContent='GIỮ E · '+(game.role==='attack'?'ĐẶT BOM':'GỠ BOM');
  $('hold-progress').style.width=Math.min(100,game.hold/(game.role==='attack'?plantSeconds:defuseSeconds)*100)+'%';
  $('crosshair').style.setProperty('--gap',(5+g.weapon.spread*380)+'px');$('hitmarker').style.opacity=hitTime>0?'1':'0';
  $('hurt').style.opacity=String(g.player.hurtPulse*.55);
  const zone=g.level.zones?.find(z=>g.player.pos.x>=z.min[0]&&g.player.pos.x<=z.max[0]&&g.player.pos.z>=z.min[1]&&g.player.pos.z<=z.max[1]);
  $('location').textContent=zone?.name||'SIROCCO';if(radar)drawRadar();
}
function snapshot(){return {phase:game.phase,role:game.role,round:game.round,score:game.score,time:+game.time.toFixed(2),
  coordinates:'metres; x east, y up, z south; north is -z',player:{pos:g.player.pos.toArray().map(n=>+n.toFixed(3)),yaw:g.player.yaw,hp:g.player.health,armor:game.armor,onGround:g.player.onGround},
  weapon:{id:g.weapon.id,ammo:g.weapon.ammo,reserve:g.weapon.reserve,reloading:g.weapon.reloading,shots:g.weapon.shots,spread:g.weapon.spread},
  bomb:{...game.bomb,pos:game.bomb.pos?.toArray()},hold:game.hold,sites:g.level.sites.map(s=>({id:s.id,pos:s.pos.toArray()})),
  bots:g.bots.list.map(b=>({name:b.name,alive:b.alive,hp:b.health,pos:(b.pos||b.root.position).toArray()})),
  result:game.result,audio:g.audio.debug(),assets:{quality:params.quality==='low'?'low':'high',textureSize,materials:g.mats.stats(),map:g.level.root.userData.stats,
    weapon:g.weapon.root.userData.stats,
    bot:{joints:g.bots.list[0].root.userData.asset.joints,meshes:g.bots.list[0].root.userData.asset.meshes,triangles:g.bots.list[0].root.userData.asset.triangles},
    tracerPool:effects.length,activeTracers:effects.filter(effect=>effect.life>0).length},render:{calls:renderer.info.render.calls,triangles:renderer.info.render.triangles,geometries:renderer.info.memory.geometries,textures:renderer.info.memory.textures},errors:window.__errors};}
boot().catch(error=>{$('fatal').hidden=false;$('fatal').textContent='Không thể mở demo: '+error.stack;$('boot').hidden=true;console.error(error);});
