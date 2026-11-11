// Viewmodel frame: metres, +Y up, muzzle along -Z. Profiles own the silhouettes;
// magazines meet the receiver at y=0.04 and detach only during the reload phase.
const DEFINITIONS = {
  ak: { name: 'AK-47', damage: 36, rpm: 600, reload: 2.4, kick: 0.021, baseSpread: 0.0018 },
  m4: { name: 'M4A1', damage: 33, rpm: 666, reload: 2.2, kick: 0.015, baseSpread: 0.0013 },
};

export function createWeapons(g) {
  const T = g.THREE, E = window.SaltlineEngine;
  E.weaponRain.value = 0;
  const root = new T.Group();
  root.name = 'rifle-viewmodel';
  root.scale.setScalar(.72);
  g.viewScene.add(root);
  // Saltline's object-space detail shader owns manufactured metal/polymer.
  // Keeping it separate from the GPU texture factory preserves both shader patches.
  const surface = (name, color, scale = 1) => g.mats.get(name, {
    color, scale, triplanar: true, vertexColors: true, interior: true,
  });
  const detailed = (name, color, roughness, metalness, kind) => {
    const material = new T.MeshStandardMaterial({
      color: new T.Color(...color), roughness, metalness, vertexColors: true,
    });
    material.name = name;
    material.userData.detailKind = kind;
    E.applyWeaponDetail(material, kind);
    return material;
  };
  const materials = {
    steel: detailed('phosphated-steel', [.026,.030,.036], .50, .70, 1),
    edge: detailed('machined-steel', [.13,.15,.17], .34, .85, 1),
    black: detailed('moulded-polymer', [.016,.019,.022], .62, 0, 2),
    anodized: detailed('anodized-aluminium', [.018,.021,.025], .40, .45, 0),
    wood: surface('wood_dark', 0xc99b68, 2),
    woodDark: surface('wood_dark', 0x956c43, 2),
    glove: g.mats.get('glove_fabric', {triplanar: true, vertexColors: true, scale: 3}),
    seam: detailed('rubber-buttpad', [.012,.014,.012], .90, 0, 2),
  };
  const partPlan = [];
  function vertexFinish(geometry, material) {
    if (!material.vertexColors || geometry.attributes.color) return;
    const positions = geometry.attributes.position;
    const normals = geometry.attributes.normal;
    const color = new Float32Array(positions.count * 3);
    const metal = material === materials.steel || material === materials.edge || material === materials.anodized;
    for (let i = 0; i < positions.count; i++) {
      const x = positions.getX(i), y = positions.getY(i), z = positions.getZ(i);
      const variation = Math.sin(x * 117.3 + y * 83.9 + z * 71.1) * 0.025;
      const axial = Math.max(Math.abs(normals.getX(i)), Math.abs(normals.getY(i)), Math.abs(normals.getZ(i)));
      const edge = metal ? Math.max(0, 1 - axial) * 0.22 : 0;
      const shade = 0.94 + variation + edge;
      color.set([shade, shade, shade], i * 3);
    }
    geometry.setAttribute('color', new T.BufferAttribute(color, 3));
  }
  // Compile direct rigid children only. Child groups retain the coordinate
  // frame used by reload and wrist animation, including their local textures.
  function compileRigid(group) {
    const buckets = new Map();
    const parts = group.children.filter(child => child.isMesh && !child.userData.moving);
    for (const part of parts) {
      part.updateMatrix();
      const geometry = part.geometry.index ? part.geometry.toNonIndexed() : part.geometry.clone();
      geometry.applyMatrix4(part.matrix);
      geometry.computeBoundingBox();
      partPlan.push({ group: group.name, name: part.name, material: part.material.name,
        min: geometry.boundingBox.min.toArray(), max: geometry.boundingBox.max.toArray(),
        triangles: geometry.attributes.position.count / 3 });
      if (!buckets.has(part.material)) buckets.set(part.material, []);
      buckets.get(part.material).push(geometry);
      group.remove(part);
      part.geometry.dispose();
    }
    for (const [material, geometries] of buckets) {
      const geometry = new T.BufferGeometry();
      for (const attribute of ['position', 'normal', 'uv', 'color']) {
        const size = attribute === 'uv' ? 2 : 3;
        const count = geometries.reduce((total, item) => total + item.attributes.position.count, 0);
        const data = new Float32Array(count * size);
        let offset = 0;
        for (const item of geometries) {
          const source = item.attributes[attribute];
          if (source) data.set(source.array, offset);
          else if (attribute === 'color') data.fill(1, offset, offset + item.attributes.position.count * size);
          offset += item.attributes.position.count * size;
        }
        geometry.setAttribute(attribute, new T.BufferAttribute(data, size));
      }
      geometry.computeBoundingBox();
      geometry.computeBoundingSphere();
      const compiled = new T.Mesh(geometry, material);
      compiled.name = group.name + ':' + material.name;
      group.add(compiled);
      for (const item of geometries) item.dispose();
    }
  }
  function mesh(parent, name, geometry, material, pos = [0, 0, 0]) {
    // Capsule poles can emit zero-area faces. Remove them before rigid batching.
    const positions = geometry.attributes.position;
    const originalIndex = geometry.index;
    const count = originalIndex?.count || positions.count;
    const indices = [];
    const a = new T.Vector3(), b = new T.Vector3(), c = new T.Vector3();
    for (let index = 0; index < count; index += 3) {
      const ia = originalIndex ? originalIndex.getX(index) : index;
      const ib = originalIndex ? originalIndex.getX(index + 1) : index + 1;
      const ic = originalIndex ? originalIndex.getX(index + 2) : index + 2;
      a.fromBufferAttribute(positions, ia);
      b.fromBufferAttribute(positions, ib).sub(a);
      c.fromBufferAttribute(positions, ic).sub(a);
      if (b.cross(c).lengthSq() >= 1e-20) indices.push(ia, ib, ic);
    }
    if (indices.length !== count) geometry.setIndex(indices);
    vertexFinish(geometry, material);
    const m = new T.Mesh(geometry, material);
    m.name = name;
    m.position.set(...pos);
    m.castShadow = false;
    m.receiveShadow = false;
    parent.add(m);
    return m;
  }
  function profile(parent, name, points, width, material, x = 0, bevel = 0.004, holes = []) {
    const s = new T.Shape();
    points.forEach(([z, y], i) => i ? s.lineTo(z, y) : s.moveTo(z, y));
    s.closePath();
    for (const points of holes) {
      const hole = new T.Path();
      points.forEach(([z, y], i) => i ? hole.lineTo(z, y) : hole.moveTo(z, y));
      hole.closePath(); s.holes.push(hole);
    }
    const geo = new T.ExtrudeGeometry(s, { depth: width, bevelEnabled: !!bevel,
      bevelThickness: bevel, bevelSize: bevel, bevelSegments: 2, steps: 1, curveSegments: 8 });
    geo.translate(0, 0, -width / 2);
    geo.rotateY(-Math.PI / 2);
    return mesh(parent, name, geo, material, [x, 0, 0]);
  }
  function cylinder(parent, name, radius, length, material, pos, segments = 14) {
    // A stepped lathe profile gives the turned part a small edge break.
    const b = Math.min(radius * .14, length * .08);
    const geo = new T.LatheGeometry([
      [0,-length/2], [radius-b,-length/2], [radius,-length/2+b],
      [radius,length/2-b], [radius-b,length/2], [0,length/2],
    ].map(p => new T.Vector2(...p)), segments);
    geo.rotateX(Math.PI / 2);
    return mesh(parent, name, geo, material, pos);
  }
  function ring(parent, name, radius, tube, material, pos) {
    return mesh(parent, name, new T.TorusGeometry(radius, tube, 6, 18), material, pos);
  }
  const gunModels = {};
  for (const id of Object.keys(DEFINITIONS)) {
    const ak = id === 'ak';
    const gun = new T.Group();
    gun.name = id + '-assembly';
    root.add(gun);
    profile(gun, 'receiver', ak
      ? [[-.40,.07],[-.37,.17],[.05,.17],[.16,.10],[.12,.025],[-.34,.025]]
      : [[-.38,.055],[-.36,.19],[.11,.19],[.16,.13],[.14,.025],[-.08,.025],[-.08,-.015],[-.22,-.015],[-.24,.045]],
      .078, ak ? materials.steel : materials.anodized, 0, .003,
      [[[-.205,.105],[-.205,.15],[-.055,.15],[-.055,.105]]]);
    profile(gun, 'dust-cover', [[-.35,.17], [-.31,.205], [.03,.205], [.10,.165]], .064, materials.black);
    profile(gun, 'pistol-grip', [[.035,.035], [.13,.025], [.20,-.20], [.10,-.235], [.035,-.08]], .055, ak ? materials.woodDark : materials.black);
    // Trigger guard is a swept open aperture, not a solid dark panel.
    const guardPath = new T.CatmullRomCurve3([
      new T.Vector3(0,.025,-.08), new T.Vector3(0,-.075,-.07),
      new T.Vector3(0,-.095,.045), new T.Vector3(0,.015,.065),
    ]);
    mesh(gun, 'trigger-guard', new T.TubeGeometry(guardPath, 12, .006, 6, false), materials.steel);
    profile(gun, 'trigger', [[-.005,.025], [.013,.025], [.02,-.05], [.005,-.05]], .012, materials.edge, 0, .001);
    cylinder(gun, 'barrel', .014, .48, materials.steel, [0,.12,-.61]);
    cylinder(gun, 'gas-tube', .017, .29, materials.steel, [0,.17,-.49]);
    const muzzleProfile = [[.013,-.035],[.020,-.035],[.022,-.031],[.022,.029],[.020,.035],[.013,.035],[.013,-.035]];
    const muzzleShell = new T.LatheGeometry(muzzleProfile.map(p => new T.Vector2(...p)), 20);
    muzzleShell.rotateX(Math.PI / 2);
    mesh(gun, 'hollow-muzzle-brake', muzzleShell, materials.anodized, [0,.12,-.86]);
    ring(gun, 'front-sight-ring', .028, .005, materials.steel, [0,.21,-.77]);
    profile(gun, 'front-sight-base', [[-.80,.12], [-.74,.12], [-.75,.205], [-.79,.205]], .03, materials.steel);
    profile(gun, 'front-sight-post', [[-.775,.19], [-.765,.19], [-.765,.23], [-.775,.23]], .006, materials.edge, 0, .001);
    for (const x of [-.033,.033]) {
      profile(gun, 'rear-sight-ear', [[-.19,.195], [-.13,.195], [-.14,.235], [-.18,.235]], .012, materials.black, x);
    }
    for (const z of [-.26,-.16,-.05,.04]) {
      const pin = cylinder(gun, 'receiver-pin', .009, .083, materials.edge, [0,.08,z], 10);
      pin.rotation.y = Math.PI / 2;
    }
    profile(gun, 'ejection-port-lip', [[-.215,.095],[-.045,.095],[-.045,.16],[-.215,.16]], .006,
      materials.anodized, .045, .001, [[[-.205,.105],[-.205,.15],[-.055,.15],[-.055,.105]]]);
    profile(gun, 'selector-lever', [[-.015,.067],[.085,.092],[.097,.084],[.015,.051]], .008, materials.edge, .045, .001);
    const bolt = new T.Group(); bolt.name = 'bolt'; gun.add(bolt);
    profile(bolt, 'bolt-carrier', [[-.205,.102],[-.05,.102],[-.05,.15],[-.205,.15]], .025, materials.steel, 0, .001);
    profile(bolt, 'charging-handle', [[-.17,.12], [-.04,.12], [-.04,.14], [-.17,.14]], .025, materials.edge, .052, .002);
    const magazine = new T.Group();
    magazine.name = 'magazine'; gun.add(magazine);
    if (ak) {
      profile(gun, 'wood-stock', [[.13,.12], [.39,.06], [.55,.055], [.55,-.13], [.39,-.15], [.22,-.035], [.13,.035]], .073, materials.wood);
      profile(gun, 'stock-buttplate', [[.548,.055], [.568,.055], [.568,-.13], [.548,-.13]], .078, materials.black);
      profile(gun, 'wood-handguard', [[-.59,.075], [-.57,.145], [-.39,.15], [-.35,.07], [-.40,.005], [-.55,.015]], .083, materials.wood);
      profile(gun, 'upper-handguard', [[-.56,.16], [-.54,.20], [-.40,.20], [-.39,.16]], .060, materials.woodDark);
      const magProfile = [[-.14,.04],[-.04,.04],[-.055,-.14],[-.13,-.31],[-.23,-.44],[-.34,-.39],[-.24,-.27],[-.17,-.11]];
      profile(magazine, 'curved-steel-magazine', magProfile, .060, materials.steel);
      for (const x of [-.034,.034]) for (let j=0;j<3;j++) {
        profile(magazine, 'magazine-stamped-rib', [[-.15+j*.027,-.055],[-.144+j*.027,-.055],[-.19+j*.027,-.24],[-.28+j*.027,-.36],[-.288+j*.027,-.36],[-.20+j*.027,-.24]], .003, materials.edge, x, .001);
      }
      for (const y of [.035,.065,.10]) profile(gun,'handguard-grain',[[-.55,y],[-.42,y+.008],[-.43,y+.013],[-.54,y+.004]],.002,materials.woodDark,.046,.001);
    } else {
      cylinder(gun, 'buffer-tube', .029, .33, materials.steel, [0,.10,.29]);
      profile(gun, 'telescopic-stock', [[.25,.14],[.49,.14],[.53,.10],[.53,-.14],[.45,-.16],[.29,-.025]], .085, materials.black);
      profile(gun, 'stock-pad', [[.525,.10],[.546,.10],[.546,-.14],[.525,-.14]], .091, materials.seam);
      profile(gun, 'railed-handguard', [[-.67,.065],[-.66,.175],[-.39,.175],[-.35,.07],[-.41,.025],[-.64,.025]], .079, materials.black);
      for (let j=0;j<9;j++) {
        const z=-.64+j*.029;
        profile(gun,'top-rail-tooth',[[z,.18],[z+.016,.18],[z+.016,.205],[z,.205]], .058, materials.edge,0,.0015);
        for(const x of [-.044,.044]) profile(gun,'handguard-slot',[[z,.08],[z+.018,.08],[z+.018,.115],[z,.115]], .003, materials.steel,x,.001);
      }
      profile(magazine, 'stanag-magazine', [[-.15,.04],[-.025,.04],[-.04,-.19],[-.09,-.30],[-.205,-.28],[-.17,-.16]], .058, materials.edge);
      for (const x of [-.032,.032]) for(let j=0;j<3;j++) profile(magazine,'magazine-rib',[[-.14+j*.032,-.025],[-.13+j*.032,-.025],[-.16+j*.032,-.24],[-.17+j*.032,-.24]], .003, materials.steel,x,.001);
    }
    compileRigid(magazine);
    compileRigid(bolt);
    compileRigid(gun);
    gunModels[id] = { root: gun, magazine, bolt };
  }
  const hands = new T.Group(); hands.name = 'gloved-hands'; root.add(hands);
  const quaternion = (x,y,z) => new T.Quaternion().setFromEuler(new T.Euler(x,y,z));
  const localDirection = (q, v, mirror = false) => {
    const direction = new T.Vector3(...v).normalize().applyQuaternion(q.clone().invert());
    if (mirror) direction.x *= -1;
    return direction.toArray();
  };
  const triggerQ = quaternion(-.24,0,0).multiply(quaternion(0,0,-Math.PI/2));
  // Original Vv builds palm, cuff, sleeve and five fingers from section rings.
  // Finger joints slerp their frames and clip to the angle-bisector plane.
  const triggerDef = E.createWeaponHand({
    mirror: false, fingers: [null,[.62,1.72,.8,0],[.68,1.7,.8,-.03],[.74,1.66,.8,-.09]],
    indexPoses: [[.1,.16,.1,.05],[.46,1.15,.5,0]],
    thumb: [[-.85,.05,-.5],[-.6,-.05,-.8],[-.05,-.2,-.97]].map(v => localDirection(triggerQ,v)),
    forearm: localDirection(triggerQ,[.27,-.44,.86]), sleeve: .39,
  });
  const triggerHand = new T.Group(); triggerHand.name='trigger-hand';
  triggerHand.quaternion.copy(triggerQ); triggerHand.scale.setScalar(1.45);
  triggerHand.position.set(.035,-.10,.12); hands.add(triggerHand);
  mesh(triggerHand,'trigger-hand-loft',triggerDef.fabric,materials.glove);
  const triggerFinger = mesh(triggerHand,'trigger-finger',triggerDef.index[0].clone(),materials.glove);
  triggerFinger.geometry.attributes.position.setUsage(T.DynamicDrawUsage);
  triggerFinger.geometry.attributes.normal.setUsage(T.DynamicDrawUsage);
  let fingerPose = -1;
  function poseFinger(weight) {
    if (Math.abs(weight-fingerPose)<.004) return;
    fingerPose=weight;
    for (const name of ['position','normal']) {
      const target=triggerFinger.geometry.attributes[name], a=triggerDef.index[0].attributes[name].array, b=triggerDef.index[1].attributes[name].array;
      for (let index=0;index<a.length;index++) target.array[index]=a[index]+(b[index]-a[index])*weight;
      target.needsUpdate=true;
    }
  }
  const supportQ = quaternion(0,0,Math.PI/2).multiply(quaternion(.06,0,0));
  const supportDef = E.createWeaponHand({
    mirror:true, fingers:[[1.27,1.42,.75,.02],[1.3,1.45,.75,0],[1.3,1.45,.75,-.02],[1.33,1.45,.75,-.05]],
    thumb:[[0,.25,-.97],[.05,.1,-.99],[0,0,-1]].map(v=>localDirection(supportQ,v,true)),
    forearm:localDirection(supportQ,[-.5,-.35,.79],true), sleeve:.42,
  });
  const supportHand = new T.Group(); supportHand.name='support-hand';
  supportHand.quaternion.copy(supportQ);supportHand.scale.setScalar(1.45);
  supportHand.position.set(-.025,.005,-.46);hands.add(supportHand);
  mesh(supportHand,'support-hand-loft',supportDef.fabric,materials.glove);
  const supportRest=supportHand.position.clone();
  const flash=E.createMuzzleFlash(); flash.name='muzzle-flash';flash.position.set(0,.12,-.895);
  flash.visible=false;root.add(flash);
  const flashLight=new T.PointLight(0xffb45d,0,2.2); flashLight.position.copy(flash.position); root.add(flashLight);
  const reloadGrip=new T.Vector3(-.025,-.12,-.13);
  const reloadQ=supportQ.clone().multiply(quaternion(-.18,0,.10));
  const key = (t,p,q=supportQ) => ({t,p:new T.Vector3(...p),q:q.clone()});
  const reloadKeys = [
    key(0,supportRest.toArray()), key(.08,supportRest.toArray()),
    key(.16,reloadGrip.toArray(),reloadQ), key(.24,reloadGrip.toArray(),reloadQ),
    key(.39,[-.10,-.49,.015],reloadQ.clone().multiply(quaternion(-.25,0,.18))),
    key(.47,[-.10,-.49,.015],reloadQ.clone().multiply(quaternion(-.25,0,.18))),
    key(.68,reloadGrip.toArray(),reloadQ), key(.72,[-.025,-.14,-.13],reloadQ),
    key(.79,[-.025,-.105,-.13],reloadQ), key(.86,reloadGrip.toArray(),reloadQ),
    key(.99,supportRest.toArray()), key(1,supportRest.toArray()),
  ];
  const smooth = value => {const x=T.MathUtils.clamp(value,0,1);return x*x*x*(x*(x*6-15)+10);};
  function reloadPose(progress) {
    let index=0;while(index<reloadKeys.length-2&&progress>reloadKeys[index+1].t)index++;
    const a=reloadKeys[index],b=reloadKeys[index+1],blend=smooth((progress-a.t)/(b.t-a.t));
    supportHand.position.copy(a.p).lerp(b.p,blend);supportHand.quaternion.copy(a.q).slerp(b.q,blend);
  }
  const inverseReloadQ=reloadQ.clone().invert(), magazineRotation=new T.Quaternion();
  const modelStats = {};
  for (const [id, model] of Object.entries(gunModels)) {
    let meshes = 0, triangles = 0;
    model.root.traverse(node => {
      if (node.isMesh) { meshes++; triangles += (node.geometry.index?.count || node.geometry.attributes.position.count) / 3; }
    });
    modelStats[id] = { meshes, triangles };
  }
  root.userData.assetPlan = { units: 'metres', forward: '-Z', magazineSeatY: .04,
    movingGroups: ['magazine', 'bolt', 'support-hand', 'trigger-finger'], parts: partPlan };
  root.userData.stats = { models: modelStats, textureSets: [...new Set(Object.values(materials).map(m => m.userData.set).filter(Boolean))], handTechnique:'Saltline Vv section loft with joint bisectors', muzzleQuads:8, springs:9, reload:'smootherstep position + quaternion keyframes' };
  const stores={ak:{ammo:30,reserve:90},m4:{ammo:30,reserve:90}};
  const spring = (k,c) => ({x:0,v:0,k,c});
  const springs={recoilZ:spring(520,30),recoilPitch:spring(380,26),recoilYaw:spring(300,22),recoilRoll:spring(300,20),
    swayYaw:spring(110,15),swayPitch:spring(110,15),jumpY:spring(140,13),jumpPitch:spring(140,13),reloadBump:spring(600,30)};
  let selected='ak', reloadLeft=0, cooldown=0, burst=0, totalShots=0, elapsed=0, flashLeft=0;
  let boltTime=1,bobPhase=0,bobAmount=0,wasGround=true,lastVerticalSpeed=0,fingerWeight=0;
  let magOut=false, magIn=false;
  const state=()=>stores[selected], definition=()=>DEFINITIONS[selected];
  const sound=(name,opts={})=>g.audio?.play(name,opts);
  function spread() {
    return definition().baseSpread+(g.player.speed||0)*.0019+(g.player.onGround?0:.024)+burst*.00065-(g.player.crouching?.0006:0);
  }
  function select(id) {
    if(!DEFINITIONS[id]) return false;
    selected=id; reloadLeft=0; cooldown=.2; burst=0;boltTime=1;
    for(const spring of Object.values(springs)){spring.x=0;spring.v=0;}
    supportHand.position.copy(supportRest);supportHand.quaternion.copy(supportQ);poseFinger(0);
    for(const [key,model] of Object.entries(gunModels)) {
      model.root.visible=key===id; model.magazine.position.set(0,0,0); model.magazine.rotation.set(0,0,0);model.bolt.position.z=0;
    }
    return true;
  }
  function reload() {
    if(reloadLeft>0 || state().ammo===30 || state().reserve<=0) return;
    reloadLeft=definition().reload; magOut=false; magIn=false;
  }
  function fire() {
    if(cooldown>0 || reloadLeft>0) return;
    if(state().ammo<=0) {sound('rifle_dry',{gain:.4});cooldown=.3;return;}
    const def=definition(); state().ammo--; totalShots++;
    cooldown=60/def.rpm;flashLeft=.045;boltTime=0;
    const kick=selected==='ak'?1:.75;
    springs.recoilZ.v+=1.5*kick;springs.recoilPitch.v+=1.5*kick;
    springs.recoilYaw.v+=((g.rng?.()??.5)-.5)*kick;springs.recoilRoll.v+=((g.rng?.()??.5)-.5)*1.8*kick;
    flash.material.uniforms.uSeed.value=(g.rng?.()??.5)*100;
    flash.material.uniforms.uJet.value=.6+(g.rng?.()??.5)*.6;
    flash.rotation.z=((g.rng?.()??.5)-.5)*.4;
    g.shoot({damage:def.damage,spread:spread(),range:180,weapon:def.name});
    const n=(g.rng?g.rng():.5)-.5;
    g.player.addRecoil(def.kick*(1+Math.min(burst,8)*.055), n*.011+Math.sin(burst*.8)*.004);
    burst=Math.min(14,burst+1);
    sound('rifle_shot',{gain:selected==='ak'?.7:.58,pitch:selected==='ak'?.9:1.08});
  }
  function update(dt) {
    elapsed+=dt; cooldown=Math.max(0,cooldown-dt); flashLeft=Math.max(0,flashLeft-dt);boltTime+=dt;
    const playing=g.game?.phase==='playing';
    if(playing && g.input.pressed('reload')) reload();
    if(reloadLeft>0) {
      reloadLeft=Math.max(0,reloadLeft-dt);
      const p=1-reloadLeft/definition().reload;
      if(p>.24&&!magOut){magOut=true;springs.reloadBump.v-=.25;sound('reload_magout',{gain:.5});}
      if(p>.68&&!magIn){magIn=true;springs.reloadBump.v+=.55;sound('reload_magin',{gain:.5});}
      if(reloadLeft===0){const n=Math.min(30-state().ammo,state().reserve);state().ammo+=n;state().reserve-=n;sound('reload_bolt',{gain:.5});}
    } else if(playing && g.input.fire) fire();
    if(!g.input.fire) burst=Math.max(0,burst-dt*9);
    const reloadProgress=reloadLeft>0?1-reloadLeft/definition().reload:0;
    const dip=reloadLeft>0?Math.min(smooth(reloadProgress/.14),1-smooth((reloadProgress-.82)/.18)):0;
    const speed=g.player.speed||0,ground=g.player.onGround!==false,vertical=g.player.vel?.y||0;
    bobAmount+=(Math.min(1,speed/3.6)*(ground?1:0)-bobAmount)*(1-Math.exp(-8*dt));
    bobPhase+=dt*(speed>.3&&ground?5.2+speed*1.55:0);
    const look=g.input.look||{dx:0,dy:0};
    springs.swayYaw.v+=T.MathUtils.clamp(look.dx,-.2,.2)*3.2;
    springs.swayPitch.v+=T.MathUtils.clamp(look.dy,-.2,.2)*2.6;
    if(wasGround&&!ground&&vertical>1){springs.jumpY.v-=.22;springs.jumpPitch.v+=.7;}
    if(!wasGround&&ground){const landing=T.MathUtils.clamp(-lastVerticalSpeed*.06,0,.6);springs.jumpY.v-=landing;springs.jumpPitch.v-=landing*3.2;}
    wasGround=ground;if(!ground)lastVerticalSpeed=vertical;
    for(const spring of Object.values(springs))E.stepSpring(spring,0,dt);
    springs.swayYaw.x=T.MathUtils.clamp(springs.swayYaw.x,-.09,.09);
    springs.swayPitch.x=T.MathUtils.clamp(springs.swayPitch.x,-.07,.07);
    root.position.set(.24+Math.sin(bobPhase)*.006*bobAmount-springs.swayYaw.x*.06,
      -.22+Math.sin(bobPhase*2)*.0042*bobAmount-dip*.035+springs.jumpY.x+springs.reloadBump.x*.6,
      -.82+springs.recoilZ.x*.55);
    root.rotation.set(.035+springs.recoilPitch.x+springs.swayPitch.x+springs.jumpPitch.x+dip*.18,
      .14+springs.recoilYaw.x+springs.swayYaw.x+dip*.28,
      springs.recoilRoll.x+springs.swayYaw.x*.7-dip*.38,'YXZ');
    const mag=gunModels[selected].magazine;
    reloadPose(reloadProgress);
    if(reloadLeft>0&&reloadProgress>=.24&&reloadProgress<.68){
      magazineRotation.copy(supportHand.quaternion).multiply(inverseReloadQ);
      mag.quaternion.copy(magazineRotation);
      mag.position.copy(reloadGrip).negate().applyQuaternion(magazineRotation).add(supportHand.position);
    }else{mag.position.set(0,0,0);mag.quaternion.identity();}
    gunModels[selected].bolt.position.z=boltTime<.072?Math.sin(Math.PI*boltTime/.072)*.04:0;
    fingerWeight+=((g.input.fire&&reloadLeft===0?1:0)-fingerWeight)*(1-Math.exp(-30*dt));poseFinger(fingerWeight);
    flash.material.uniforms.uInt.value=flashLeft>0?9.5*Math.sqrt(flashLeft/.045):0;
    flash.material.uniforms.uHeat.value=0;flash.visible=flashLeft>0;flashLight.intensity=flashLeft>0?1.4:0;

  }
  const api={
    update,select,
    reset(id='ak'){for(const s of Object.values(stores)){s.ammo=30;s.reserve=90;}totalShots=0;elapsed=0;flashLeft=0;bobPhase=0;bobAmount=0;wasGround=true;lastVerticalSpeed=0;fingerWeight=0;select(id);update(0);},
    setVisible(value){root.visible=value;},
    get ammo(){return state().ammo;},get reserve(){return state().reserve;},
    get reloading(){return reloadLeft>0;},get reloadProgress(){return reloadLeft>0?1-reloadLeft/definition().reload:0;},
    get id(){return selected;},get name(){return definition().name;},get shots(){return totalShots;},
    get root(){return root;},get spread(){return spread();},
    get motion(){return {springs:Object.fromEntries(Object.entries(springs).map(([name,s])=>[name,{position:s.x,velocity:s.v}])),finger: fingerWeight,magazine:gunModels[selected].magazine.position.toArray()};},
  };
  api.reset();
  return api;
}
