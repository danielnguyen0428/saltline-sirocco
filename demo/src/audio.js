// Saltline DSP recipes and sliced synthesis; dry-map routing instead of harbor ambience.
export function createAudio(g) {
  const E=window.SaltlineEngine, definitions=E.audioDefinitions;
  const stems=['music_drone','music_ost','music_perc','music_brass','music_motif'];
  const initial=['rifle_shot','rifle_tail_out','rifle_tail_in','rifle_dry','reload_magout','reload_magin','reload_bolt',
    'shell_bounce','step_concrete','step_metal','jump','land','hurt','impact_concrete','impact_metal','impact_wood','impact_enemy','ui_hover','ui_click'];
  let ctx,master,compressor,clip,dry,reverbs,muted=false,paused=false,workTimer,musicStarted=false,combat=0;
  const buffers=new Map(),roundRobin=new Map(),active=new Set(),queue=[],queued=new Set(),loops=[];
  const stats={played:0,failed:0,stolen:0,peakVoices:0,generated:0};
  const rng=E.createRng(8731);
  function store(name,variant,data){
    const buffer=ctx.createBuffer(data.ch.length,data.ch[0].length,data.sr);
    data.ch.forEach((channel,i)=>buffer.copyToChannel(channel,i));buffers.set(name+'#'+variant,buffer);stats.generated++;
    if(name==='ir_outdoor')reverbs[0].convolver.buffer=buffer;
    if(name==='ir_shed')reverbs[1].convolver.buffer=buffer;
    return buffer;
  }
  function request(name,variant=0){
    if(!definitions[name])return;
    const key=name+'#'+variant;if(buffers.has(key)||queued.has(key))return;
    queued.add(key);queue.push({name,variant,steps:null});
  }
  function generateSlice(){
    const start=performance.now();
    while(queue.length){
      const item=queue[0];
      item.steps ||= E.synthesizeSteps(item.name,item.variant,definitions[item.name].ir?ctx.sampleRate:undefined);
      const data=item.steps.step();
      if(data){store(item.name,item.variant,data);queued.delete(item.name+'#'+item.variant);queue.shift();}
      if(performance.now()-start>=6)break;
    }
    startLoops();
    if(queue.length)workTimer=setTimeout(generateSlice,0);else workTimer=null;
  }
  function init(){
    if(ctx)return;
    ctx=new (window.AudioContext||window.webkitAudioContext)();
    master=ctx.createGain();master.gain.value=muted?0:.42;
    compressor=ctx.createDynamicsCompressor();compressor.threshold.value=-16;compressor.knee.value=16;compressor.ratio.value=4;compressor.attack.value=.003;compressor.release.value=.15;
    clip=ctx.createWaveShaper();const curve=new Float32Array(2048);for(let i=0;i<curve.length;i++)curve[i]=Math.tanh((i/(curve.length-1)*2-1)*1.2)/Math.tanh(1.2);
    clip.curve=curve;clip.oversample='2x';master.connect(compressor);compressor.connect(clip);clip.connect(ctx.destination);
    dry=ctx.createGain();dry.connect(master);
    reverbs=[0,1].map(index=>{const convolver=ctx.createConvolver(),gain=ctx.createGain();gain.gain.value=index?0:.14;convolver.connect(gain);gain.connect(master);return {convolver,gain};});
    // First rifle response is ready inside the gesture; remaining work yields at 6 ms.
    store('rifle_shot',0,E.synthesize('rifle_shot',0));
    for(const name of [...initial,'ir_outdoor','ir_shed','objective_all','complete','death','explosion','wind',...stems]){
      if(!definitions[name])continue;
      for(let variant=0;variant<definitions[name].n;variant++)request(name,variant);
    }
    generateSlice();
  }
  function startLoops(){
    if(musicStarted||!stems.every(name=>buffers.has(name+'#0'))||!buffers.has('wind#0'))return;
    const time=ctx.currentTime+.08;
    for(const name of [...stems,'wind']){
      const source=ctx.createBufferSource(),gain=ctx.createGain();source.buffer=buffers.get(name+'#0');source.loop=true;
      gain.gain.value=0;source.connect(gain);gain.connect(master);source.start(time);loops.push({name,source,gain});
    }
    musicStarted=true;
  }
  function play(name,options={}){
    if(!ctx||ctx.state!=='running'||paused||muted)return false;
    const def=definitions[name];if(!def){stats.failed++;return false;}
    const variant=(roundRobin.get(name)||0)%def.n;roundRobin.set(name,variant+1);
    let buffer=buffers.get(name+'#'+variant);
    if(!buffer)buffer=store(name,variant,E.synthesize(name,variant));
    const priority=def.pri||2;
    if(active.size>=45){
      const victim=[...active].sort((a,b)=>a.priority-b.priority||a.started-b.started)[0];
      if(victim.priority>priority)return false;victim.source.stop();active.delete(victim);stats.stolen++;
    }
    const source=ctx.createBufferSource(),gain=ctx.createGain();source.buffer=buffer;
    source.playbackRate.value=(options.pitch||1)*(1+(rng()-.5)*.018);gain.gain.value=options.gain??.5;source.connect(gain);
    let tail=gain,panner;
    if(options.pos){
      panner=ctx.createPanner();panner.panningModel='HRTF';panner.distanceModel='inverse';panner.refDistance=def.ref||5;panner.rolloffFactor=def.roll||1;panner.maxDistance=180;
      const pos=options.pos;panner.positionX.value=pos.x;panner.positionY.value=pos.y;panner.positionZ.value=pos.z;gain.connect(panner);tail=panner;
    }
    tail.connect(dry);for(const bus of reverbs)tail.connect(bus.convolver);
    const voice={source,priority,started:ctx.currentTime};active.add(voice);
    source.onended=()=>{active.delete(voice);source.disconnect();gain.disconnect();panner?.disconnect();};
    source.start();stats.played++;stats.peakVoices=Math.max(stats.peakVoices,active.size);
    if(name==='rifle_shot'){
      combat=1;
      const interior=g.level.interiorBoxes?.some(box=>box.containsPoint?.(g.player.eye));
      const tailName=interior?'rifle_tail_in':'rifle_tail_out';
      if(definitions[tailName])play(tailName,{...options,gain:(options.gain??.5)*.24});
    }
    return true;
  }
  function update(dt){
    if(!ctx||paused)return;
    combat=Math.max(0,combat-dt*.16);
    const listener=ctx.listener,eye=g.player.eye,forward=g.player.forward;
    for(const [key,value] of Object.entries({positionX:eye.x,positionY:eye.y,positionZ:eye.z,forwardX:forward.x,forwardY:forward.y,forwardZ:forward.z,upX:0,upY:1,upZ:0}))listener[key]?.setValueAtTime(value,ctx.currentTime);
    const inside=g.level.interiorBoxes?.some(box=>eye.x>box.min.x&&eye.x<box.max.x&&eye.z>box.min.z&&eye.z<box.max.z&&eye.y<box.max.y)?1:0;
    reverbs[0].gain.gain.setTargetAtTime(.14*Math.sqrt(1-inside),ctx.currentTime,.2);reverbs[1].gain.gain.setTargetAtTime(.18*Math.sqrt(inside),ctx.currentTime,.2);
    const weights=g.game.phase==='playing'?[.3,.2*combat,.3*combat*combat,.15*Math.max(0,combat-.6),0]:[.3,0,0,0,.2];
    for(const loop of loops){const index=stems.indexOf(loop.name);const level=index<0?.055:weights[index]*.05;loop.gain.gain.setTargetAtTime(level,ctx.currentTime,.4);}
  }
  function resetRound(){
    combat=0;
    for(const voice of active)voice.source.stop();
    active.clear();
    if(!ctx)return;
    // Replacing each convolver discards the old round's pending reverb tail.
    for(const bus of reverbs){
      const buffer=bus.convolver.buffer;bus.convolver.disconnect();
      bus.convolver=ctx.createConvolver();bus.convolver.buffer=buffer;bus.convolver.connect(bus.gain);
    }
  }
  g.events.on('shell:bounce',event=>play('shell_bounce',{pos:event.pos,gain:.18}));
  g.events.on('player:step',event=>play(event?.surface==='metal'?'step_metal':'step_concrete',{gain:.24}));
  g.events.on('player:land',()=>play('land',{gain:.22}));
  return {play,update,resetRound,
    resume(){init();paused=false;return ctx.resume();},
    pause(value){paused=value;if(ctx)value?ctx.suspend():ctx.resume();},
    mute(value){muted=value;if(master)master.gain.setTargetAtTime(value?0:.42,ctx.currentTime,.015);},
    get muted(){return muted;},
    debug(){return {state:ctx?.state||'uninitialized',muted,paused,buffers:buffers.size,voices:active.size,capacity:45,
      reverb:reverbs?.map(bus=>!!bus.convolver.buffer)||[],stems:loops.filter(loop=>stems.includes(loop.name)).length,
      pending:queue.length,compressor:!!compressor,softClip:!!clip,...stats};},
  };
}
