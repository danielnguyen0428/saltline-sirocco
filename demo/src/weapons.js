// Viewmodel frame: metres, +Y up, muzzle along -Z. Profiles own the silhouettes;
// magazines meet the receiver at y=0.04 and detach only during the reload phase.
const MODEL_SCALE = .68; // Convert the authored rifle profiles to metres once.
const DEFINITIONS = {
  ak: { name: 'AK-47', damage: 36, rpm: 600, reload: 2.4, kick: 0.021, baseSpread: 0.0018 },
  m4: { name: 'M4A1', damage: 33, rpm: 666, reload: 2.2, kick: 0.015, baseSpread: 0.0013 },
};

export function createWeapons(g) {
  const T = g.THREE, E = window.SaltlineEngine;
  E.weaponRain.value = 0;
  const root = new T.Group();
  root.name = 'rifle-viewmodel';
  // Hands are authored in metres by Vv; never rescale them independently of contacts.
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
    glove: g.mats.get('glove_fabric', {triplanar: true, vertexColors: true, scale: 3}),
    brass: g.mats.get('brass', {triplanar:true, vertexColors:true, scale:4}),
  };
  // Four static material buckets per rifle; moving bolt/magazine/round stay separate.
  materials.woodDark=materials.wood; materials.seam=materials.black;
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
      compiled.receiveShadow=true; compiled.frustumCulled=false;
      group.add(compiled);
      for (const item of geometries) item.dispose();
    }
  }
  function mesh(parent, name, geometry, material, pos = [0, 0, 0], unitScale = MODEL_SCALE) {
    geometry.scale(unitScale,unitScale,unitScale);
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
    m.position.set(...pos).multiplyScalar(unitScale);
    m.castShadow = false;
    m.receiveShadow = true;
    m.frustumCulled = false;
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
    if(ak) profile(bolt, 'charging-handle', [[-.12,.12],[-.06,.12],[-.06,.14],[-.12,.14]], .035, materials.steel, .065, .002);
    else {
      profile(bolt,'charging-handle-stem',[[.035,.166],[.14,.166],[.14,.18],[.035,.18]],.020,materials.steel,0,.0015);
      profile(bolt,'charging-handle-T',[[.12,.162],[.145,.162],[.145,.186],[.12,.186]],.115,materials.steel,0,.002);
    }
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
        profile(magazine, 'magazine-stamped-rib', [[-.15+j*.027,-.055],[-.144+j*.027,-.055],[-.19+j*.027,-.24],[-.28+j*.027,-.36],[-.288+j*.027,-.36],[-.20+j*.027,-.24]], .003, materials.steel, x, .001);
      }
      for (const y of [.035,.065,.10]) profile(gun,'handguard-grain',[[-.55,y],[-.42,y+.008],[-.43,y+.013],[-.54,y+.004]],.002,materials.woodDark,.046,.001);
    } else {
      cylinder(gun, 'buffer-tube', .029, .33, materials.steel, [0,.10,.29]);
      profile(gun, 'telescopic-stock', [[.25,.14],[.49,.14],[.53,.10],[.53,-.14],[.45,-.16],[.29,-.025]], .085, materials.black);
      profile(gun, 'stock-pad', [[.525,.10],[.546,.10],[.546,-.14],[.525,-.14]], .091, materials.seam);
      profile(gun, 'railed-handguard', [[-.67,.065],[-.66,.175],[-.39,.175],[-.35,.07],[-.41,.025],[-.64,.025]], .079, materials.black);
      // A continuous Picatinny strip is compiled from repeated real teeth/gaps.
      for (let j=0;j<49;j++) {
        const z=-.66+j*.0159;
        profile(gun,'top-rail-tooth',[[z,.207],[z+.0105,.207],[z+.0105,.223],[z,.223]], .058, materials.edge,0,.0015);
        if(j<17&&j%2===0) for(const x of [-.044,.044]) profile(gun,'handguard-rib',[[z,.045],[z+.012,.045],[z+.012,.17],[z,.17]], .009, materials.black,x,.0015);
      }
      profile(magazine, 'stanag-magazine', [[-.15,.04],[-.025,.04],[-.04,-.19],[-.09,-.30],[-.205,-.28],[-.17,-.16]], .058, materials.edge);
      for (const x of [-.032,.032]) for(let j=0;j<3;j++) profile(magazine,'magazine-rib',[[-.14+j*.032,-.025],[-.13+j*.032,-.025],[-.16+j*.032,-.24],[-.17+j*.032,-.24]], .003, materials.edge,x,.001);
    }
    const rounds=new T.Group();rounds.name='round';magazine.add(rounds);
    for(const x of [-.011,.011]) {
      const bullet=new T.LatheGeometry([[0,-.039],[.006,-.039],[.006,-.006],[.0045,.004],[.0045,.019],[.002,.033],[0,.039]].map(p=>new T.Vector2(...p)),12);
      bullet.rotateX(-Math.PI/2);mesh(rounds,'visible-cartridge',bullet,materials.brass,[x,.035,-.095]);
    }
    compileRigid(rounds);
    compileRigid(magazine);
    compileRigid(bolt);
    compileRigid(gun);
    const v=(x,y,z)=>new T.Vector3(x,y,z);
    gunModels[id] = { root: gun, magazine, bolt, rounds, datums:{
      grip:v(0,-.05,.062), foregrip:v(-.008,-.018,ak?-.32:-.35),
      magazine:v(-.010,-.095,ak?-.092:-.070),
      handle:ak?v(.065,.13,-.09).multiplyScalar(MODEL_SCALE):v(-.04,.175,.135).multiplyScalar(MODEL_SCALE),
      muzzle:v(0,.12,-.895).multiplyScalar(MODEL_SCALE), eject:v(.045,.13,-.125).multiplyScalar(MODEL_SCALE),
      boltTravel:ak?.062:.055,
    }};
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
    forearm: localDirection(triggerQ,[.27,-.44,.86]), sleeve: .34,
  });
  const triggerHand = new T.Group(); triggerHand.name='trigger-hand';
  triggerHand.quaternion.copy(triggerQ); hands.add(triggerHand);
  mesh(triggerHand,'trigger-hand-loft',triggerDef.fabric,materials.glove,[0,0,0],1);
  const triggerFinger = mesh(triggerHand,'trigger-finger',triggerDef.index[0].clone(),materials.glove,[0,0,0],1);
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
    triggerFinger.geometry.normalizeNormals();
  }
  const supportQ = quaternion(0,0,Math.PI/2).multiply(quaternion(.06,0,0));
  const supportDef = E.createWeaponHand({
    mirror:true, fingers:[[1.27,1.42,.75,.02],[1.3,1.45,.75,0],[1.3,1.45,.75,-.02],[1.33,1.45,.75,-.05]],
    thumb:[[0,.25,-.97],[.05,.1,-.99],[0,0,-1]].map(v=>localDirection(supportQ,v,true)),
    forearm:localDirection(supportQ,[-.5,-.35,.79],true), sleeve:.34,
  });
  const supportHand = new T.Group(); supportHand.name='support-hand';
  supportHand.quaternion.copy(supportQ);hands.add(supportHand);
  mesh(supportHand,'support-hand-loft',supportDef.fabric,materials.glove,[0,0,0],1);
  // Source 66923/66973: solve the wrist from a PALM contact, not the mesh origin.
  const gripAnchor=new T.Vector3(.006,-.031,-.085), palmAnchor=new T.Vector3(0,-.015,-.055);
  const rackAnchor=new T.Vector3(0,-.024,-.118);
  const poseAt=(q,point,anchor=palmAnchor)=>({q:q.clone(),p:point.clone().sub(anchor.clone().applyQuaternion(q))});
  const offsetPose=(pose,x,y,z,q=pose.q)=>({q:q.clone(),p:pose.p.clone().add(new T.Vector3(x,y,z))});
  const grabQ=quaternion(0,0,Math.PI/2).multiply(quaternion(.12,0,0));
  const rackQ=quaternion(-.6,0,0).multiply(new T.Quaternion().setFromRotationMatrix(
    new T.Matrix4().makeBasis(new T.Vector3(0,0,1),new T.Vector3(-1,0,0),new T.Vector3(0,-1,0))));
  const flash=E.createMuzzleFlash();flash.name='muzzle-flash';flash.visible=false;root.add(flash);
  const flashLight=new T.PointLight(0xffb45d,0,2.2);root.add(flashLight);
  const smooth=value=>{const x=T.MathUtils.clamp(value,0,1);return x*x*x*(x*(x*6-15)+10);};
  const magazineRotation=new T.Quaternion(),inverseGrabQ=grabQ.clone().invert();
  const OUT=.20,IN=.56,RACK_START=.80,RACK_BACK=.87,RACK_RELEASE=.90;
  for(const model of Object.values(gunModels)) {
    const d=model.datums,rest=poseAt(supportQ,d.foregrip),grab=poseAt(grabQ,d.magazine);
    const near=offsetPose(grab,-.035,-.02,.01),away=offsetPose(grab,-.06,-.30,.13,grabQ.clone().multiply(quaternion(-.5,0,.25)));
    const rack=poseAt(rackQ,d.handle,rackAnchor),back=offsetPose(rack,0,0,d.boltTravel);
    const common=[[0,rest],[.04,rest],[.15,near],[.185,grab],[OUT,grab],[.34,away],[.41,away],
      [.53,offsetPose(grab,0,-.035,.004)],[IN,grab],[.60,offsetPose(grab,-.004,-.06,0)],
      [.63,offsetPose(grab,0,-.012,0)],[.67,grab],[.71,near]];
    model.poses={rest,grab,rack};
    model.reloadKeys=[...common,[.89,rest],[1,rest]];
    model.emptyKeys=[...common,[.78,rack],[RACK_START,rack],[RACK_BACK,back],[RACK_RELEASE,back],[.93,rack],[.96,rack],[1,rest]];
  }
  function reloadPose(model,progress,empty) {
    const keys=empty?model.emptyKeys:model.reloadKeys;
    let index=0;while(index<keys.length-2&&progress>keys[index+1][0])index++;
    const [ta,a]=keys[index],[tb,b]=keys[index+1],blend=smooth((progress-ta)/(tb-ta));
    supportHand.position.copy(a.p).lerp(b.p,blend);supportHand.quaternion.copy(a.q).slerp(b.q,blend);
  }
  const modelStats = {};
  for (const [id, model] of Object.entries(gunModels)) {
    let meshes = 0, triangles = 0;
    model.root.traverse(node => {
      if (node.isMesh) { meshes++; triangles += (node.geometry.index?.count || node.geometry.attributes.position.count) / 3; }
    });
    modelStats[id] = { meshes, triangles };
  }
  root.userData.assetPlan = { units: 'metres', forward: '-Z', magazineSeatY: .04*MODEL_SCALE, modelScale:MODEL_SCALE,
    contacts:{grip:gripAnchor.toArray(),palm:palmAnchor.toArray(),rack:rackAnchor.toArray()},
    datums:Object.fromEntries(Object.entries(gunModels).map(([id,m])=>[id,Object.fromEntries(Object.entries(m.datums).map(([k,v])=>[k,v.toArray?v.toArray():v]))])),
    movingGroups: ['magazine', 'bolt', 'round', 'support-hand', 'trigger-finger'], parts: partPlan };
  root.userData.stats = { models: modelStats, textureSets: [...new Set(Object.values(materials).map(m => m.userData.set).filter(Boolean))], handTechnique:'Saltline Vv section loft with joint bisectors', muzzleQuads:8, springs:9, reload:'smootherstep position + quaternion keyframes' };
  const stores={ak:{ammo:30,reserve:90},m4:{ammo:30,reserve:90}};
  const spring = (k,c) => ({x:0,v:0,k,c});
  const springs={recoilZ:spring(520,30),recoilPitch:spring(380,26),recoilYaw:spring(300,22),recoilRoll:spring(300,20),
    swayYaw:spring(110,15),swayPitch:spring(110,15),jumpY:spring(140,13),jumpPitch:spring(140,13),reloadBump:spring(600,30)};
  let selected='ak', reloadLeft=0, cooldown=0, burst=0, totalShots=0, elapsed=0, flashLeft=0;
  let boltTime=1,bobPhase=0,bobAmount=0,wasGround=true,lastVerticalSpeed=0,fingerWeight=0;
  let magOut=false,magIn=false,racked=false,reloadEmpty=false;
  const state=()=>stores[selected], definition=()=>DEFINITIONS[selected];
  const sound=(name,opts={})=>g.audio?.play(name,opts);
  function spread() {
    return definition().baseSpread+(g.player.speed||0)*.0019+(g.player.onGround?0:.024)+burst*.00065-(g.player.crouching?.0006:0);
  }
  function select(id) {
    if(!DEFINITIONS[id]) return false;
    selected=id; reloadLeft=0; cooldown=.2; burst=0;boltTime=1;
    for(const spring of Object.values(springs)){spring.x=0;spring.v=0;}
    const model=gunModels[id],rest=model.poses.rest;
    triggerHand.position.copy(model.datums.grip).sub(gripAnchor.clone().applyQuaternion(triggerQ));
    supportHand.position.copy(rest.p);supportHand.quaternion.copy(rest.q);poseFinger(0);
    flash.position.copy(model.datums.muzzle);flashLight.position.copy(flash.position);
    for(const [key,model] of Object.entries(gunModels)) {
      model.root.visible=key===id; model.magazine.position.set(0,0,0); model.magazine.rotation.set(0,0,0);model.bolt.position.z=0;
    }
    return true;
  }
  function reload() {
    if(reloadLeft>0 || state().ammo===30 || state().reserve<=0) return;
    reloadLeft=definition().reload;reloadEmpty=state().ammo===0;magOut=false;magIn=false;racked=false;
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
      if(p>=OUT&&!magOut){magOut=true;springs.reloadBump.v-=.25;sound('reload_magout',{gain:.5});}
      if(p>=IN&&!magIn){magIn=true;springs.reloadBump.v+=.55;sound('reload_magin',{gain:.5});
        const n=Math.min(30-state().ammo,state().reserve);state().ammo+=n;state().reserve-=n;}
      if(reloadEmpty&&p>=RACK_RELEASE&&!racked){racked=true;springs.reloadBump.v+=.3;sound('reload_bolt',{gain:.5});}

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
    root.position.set(.18+Math.sin(bobPhase)*.006*bobAmount-springs.swayYaw.x*.06,
      -.19+Math.sin(bobPhase*2)*.0042*bobAmount-dip*.035+springs.jumpY.x+springs.reloadBump.x*.6,
      -.60+springs.recoilZ.x*.55);
    root.rotation.set(.035+springs.recoilPitch.x+springs.swayPitch.x+springs.jumpPitch.x+dip*.18,
      .10+springs.recoilYaw.x+springs.swayYaw.x+dip*.28,
      springs.recoilRoll.x+springs.swayYaw.x*.7-dip*.38,'YXZ');
    const model=gunModels[selected],mag=model.magazine;
    reloadPose(model,reloadProgress,reloadEmpty);
    if(reloadLeft>0&&reloadProgress>=OUT&&reloadProgress<IN){
      magazineRotation.copy(supportHand.quaternion).multiply(inverseGrabQ);
      mag.quaternion.copy(magazineRotation);
      mag.position.copy(model.poses.grab.p).negate().applyQuaternion(magazineRotation).add(supportHand.position);
    }else{mag.position.set(0,0,0);mag.quaternion.identity();}
    let rackTravel=0;
    if(reloadLeft>0&&reloadEmpty&&reloadProgress>=RACK_START)rackTravel=reloadProgress<RACK_BACK?smooth((reloadProgress-RACK_START)/(RACK_BACK-RACK_START)):reloadProgress<RACK_RELEASE?1:1-smooth((reloadProgress-RACK_RELEASE)/.03);
    model.bolt.position.z=rackTravel*model.datums.boltTravel+(boltTime<.072?Math.sin(Math.PI*boltTime/.072)*model.datums.boltTravel:0);
    model.rounds.visible=reloadLeft>0?(reloadProgress>.36||!reloadEmpty):state().ammo>0;
    fingerWeight+=((g.input.fire&&reloadLeft===0?1:0)-fingerWeight)*(1-Math.exp(-30*dt));poseFinger(fingerWeight);
    flash.material.uniforms.uInt.value=flashLeft>0?9.5*Math.sqrt(flashLeft/.045):0;
    flash.material.uniforms.uHeat.value=0;flash.visible=flashLeft>0;flashLight.intensity=flashLeft>0?1.4:0;

  }
  function effectPoint(name,target=new T.Vector3()) {
    root.updateMatrix();target.copy(gunModels[selected].datums[name]).applyMatrix4(root.matrix);
    const ratio=Math.tan(g.camera.fov*Math.PI/360)/Math.tan(g.viewCamera.fov*Math.PI/360);
    target.x*=ratio;target.y*=ratio;
    return target.applyQuaternion(g.camera.quaternion).add(g.camera.position);
  }
  const api={
    effectPoint,
    update,select,
    reset(id='ak'){for(const s of Object.values(stores)){s.ammo=30;s.reserve=90;}totalShots=0;elapsed=0;flashLeft=0;bobPhase=0;bobAmount=0;wasGround=true;lastVerticalSpeed=0;fingerWeight=0;select(id);update(0);},
    setVisible(value){root.visible=value;},
    get ammo(){return state().ammo;},get reserve(){return state().reserve;},
    get reloading(){return reloadLeft>0;},get reloadProgress(){return reloadLeft>0?1-reloadLeft/definition().reload:0;},
    get id(){return selected;},get name(){return definition().name;},get shots(){return totalShots;},
    get root(){return root;},get spread(){return spread();},
    get motion(){const reloadProgress=reloadLeft>0?1-reloadLeft/definition().reload:0;return {reloadEmpty,bolt:gunModels[selected].bolt.position.z,phase:reloadLeft<=0?'idle':reloadProgress<OUT?'reach':reloadProgress<IN?'magazine':reloadProgress<RACK_START?'seat':reloadEmpty?'rack':'return',springs:Object.fromEntries(Object.entries(springs).map(([name,s])=>[name,{position:s.x,velocity:s.v}])),finger: fingerWeight,magazine:gunModels[selected].magazine.position.toArray()};},
  };
  api.reset();
  return api;
}
