// Metres, +Y up, -Z forward. Saltline's rigid-weight rig: one shared geometry,
// material groups, and an independent Skeleton for each active opponent.
export function createBots(g) {
  const T = g.THREE, E = window.SaltlineEngine, random = () => g.rng();
  const surface = (name, color) => g.mats.get(name, {color, triplanar: true, vertexColors: true, interior: true});
  const mats = {
    navy: surface('glove_fabric', 0x30465a), tan: surface('glove_fabric', 0xb09b73),
    vest: surface('glove_fabric', 0x59604d), black: surface('polymer_black', 0x34383a),
    steel: surface('gunmetal', 0x687078),
    skin: new T.MeshStandardMaterial({color: 0xb98766, roughness: .85, vertexColors: true}),
    lens: new T.MeshStandardMaterial({color: 0x344b55, roughness: .22, metalness: .35, vertexColors: true}),
    patch: surface('glove_fabric', 0xb7c2a7),
  };
  const slots = {uniform:mats.navy, webbing:mats.vest, polymer:mats.black, metal:mats.steel, skin:mats.skin, lens:mats.lens, patch:mats.patch};
  const builder = new E.RigBuilder(), sourceParts = [];
  function bone(name, parent, x = 0, y = 0, z = 0) { builder.bone(name, parent, x, y, z); return name; }
  function add(joint, name, geometry, slot, pos = [0,0,0], color = [1,1,1], rotation = [0,0,0]) {
    geometry.applyMatrix4(new T.Matrix4().makeRotationFromEuler(new T.Euler(...rotation)));
    geometry.translate(...pos);
    builder.add(slot, joint, geometry, color);
    sourceParts.push({name, joint, slot});
  }
  // Normal welding across UV seams, quantized at 0.5 mm as in Saltline's soft props.
  function weldNormals(geo) {
    geo.computeVertexNormals();
    const p = geo.attributes.position, n = geo.attributes.normal, sums = new Map();
    const key = i => [p.getX(i),p.getY(i),p.getZ(i)].map(v => Math.round(v*2000)).join(',');
    for (let i=0;i<p.count;i++) {
      const k=key(i), sum=sums.get(k)||new T.Vector3();
      sum.add(new T.Vector3(n.getX(i),n.getY(i),n.getZ(i))); sums.set(k,sum);
    }
    for (let i=0;i<p.count;i++) { const v=sums.get(key(i)).normalize(); n.setXYZ(i,v.x,v.y,v.z); }
    return geo;
  }
  function softBox(w,h,d,round = .025, fold = .002) {
    const geo=E.roundedBox(w,h,d,round), p=geo.attributes.position;
    for(let i=0;i<p.count;i++) {
      const x=p.getX(i), y=p.getY(i), z=p.getZ(i), t=y/h+.5;
      const waist=.88+.12*Math.sin(t*Math.PI*.65), ripple=fold*Math.sin(t*17+x*28)*Math.sin(t*Math.PI);
      p.setXYZ(i,x*waist,y,z*(.96+.04*Math.sin(t*Math.PI))+Math.sign(z)*ripple);
    }
    return weldNormals(geo);
  }
  // Closed elliptical loft. Section radii define cloth volume, joints and cuffs.
  function sleeve(length, width, depth, taper = .7) {
    const positions=[],uv=[],indices=[], rings=9, sides=12;
    for(let ring=0;ring<rings;ring++) {
      const t=ring/(rings-1), radius=1+(taper-1)*t+.10*Math.sin(t*Math.PI);
      const fold=.018*Math.sin(t*Math.PI*6)*Math.sin(t*Math.PI);
      for(let side=0;side<=sides;side++) {
        const angle=side/sides*Math.PI*2;
        positions.push(Math.cos(angle)*width*.5*(radius+fold),-t*length,Math.sin(angle)*depth*.5*(radius+fold));
        uv.push(angle*Math.max(width,depth)*.5,t*length);
        if(ring<rings-1 && side<sides) {
          const a=ring*(sides+1)+side,b=a+1,c=a+sides+1,d=c+1;
          indices.push(a,b,c,b,d,c);
        }
      }
    }
    for(const ring of [0,rings-1]) {
      const base=positions.length/3, t=ring/(rings-1);
      positions.push(0,-t*length,0); uv.push(0,0);
      for(let side=0;side<sides;side++) {
        const offset=(ring*(sides+1)+side)*3;
        positions.push(positions[offset],positions[offset+1],positions[offset+2]);
        uv.push(positions[offset],positions[offset+2]);
      }
      for(let side=0;side<sides;side++) {
        const a=base+1+side,b=base+1+(side+1)%sides;
        indices.push(...(ring===0?[base,b,a]:[base,a,b]));
      }
    }
    const geo=new T.BufferGeometry();
    geo.setAttribute('position',new T.Float32BufferAttribute(positions,3));
    geo.setAttribute('uv',new T.Float32BufferAttribute(uv,2));geo.setIndex(indices);geo.computeVertexNormals();
    return geo;
  }
  const pelvis=bone('pelvis',null,0,.89,0), torso=bone('upper-body',pelvis,0,.32,0);
  add(pelvis,'trousers-seat',softBox(.34,.20,.24,.055),'uniform');
  add(pelvis,'belt',E.roundedBox(.365,.042,.25,.015),'polymer',[0,.075,0]);
  add(pelvis,'belt-buckle',E.beveledBox(.055,.04,.012,.004),'metal',[0,.075,-.132]);
  add(torso,'jacket',softBox(.405,.44,.255,.065,.004),'uniform');
  add(torso,'armour-front',softBox(.355,.31,.065,.025),'webbing',[0,-.005,-.145]);
  add(torso,'armour-back',softBox(.355,.30,.06,.025),'webbing',[0,0,.14]);
  add(torso,'daypack',softBox(.27,.32,.14,.045),'webbing',[0,-.02,.23]);
  for(const x of [-.16,.16]) add(torso,'shoulder-strap',E.roundedBox(.047,.34,.024,.008),'polymer',[x,.035,-.155]);
  for(const x of [-.12,0,.12]) {
    add(torso,'magazine-pouch',softBox(.105,.15,.065,.018),'webbing',[x,-.055,-.202]);
    add(torso,'pouch-flap',E.roundedBox(.105,.025,.071,.008),'polymer',[x,.01,-.207]);
  }
  add(torso,'identification-patch',E.beveledBox(.12,.04,.009,.003),'patch',[0,.10,-.184]);
  const head=bone('head',torso,0,.37,0);
  add(head,'balaclava',new T.SphereGeometry(1,16,12).scale(.132,.155,.132),'polymer');
  add(head,'face-exposure',new T.SphereGeometry(1,14,10).scale(.102,.058,.03),'skin',[0,.025,-.115]);
  for(const x of [-.058,.058]) add(head,'goggle-lens',E.roundedBox(.105,.052,.022,.015),'lens',[x,.042,-.14]);
  add(head,'goggle-bridge',E.roundedBox(.035,.021,.026,.007),'polymer',[0,.042,-.144]);
  add(head,'helmet-shell',new T.SphereGeometry(1,16,8,0,Math.PI*2,0,Math.PI/2).scale(.158,.142,.165),'uniform',[0,.035,.008]);
  const rim=new T.TorusGeometry(.155,.009,6,24).scale(1,1.04,1).rotateX(Math.PI/2);
  add(head,'helmet-rim',rim,'polymer',[0,.035,.008]);
  for(const x of [-.14,.14]) add(head,'headset-earcup',E.roundedBox(.038,.082,.06,.018),'polymer',[x,-.02,.005]);
  for(const side of [-1,1]) {
    const suffix=side<0?'left':'right';
    const hip=bone('hip-'+suffix,pelvis,side*.108,-.01,0);
    add(hip,'trouser-upper-'+suffix,sleeve(.39,.178,.215,.80),'uniform');
    add(hip,'cargo-pocket-'+suffix,softBox(.035,.16,.12,.015),'webbing',[side*.09,-.18,.008]);
    const knee=bone('knee-'+suffix,hip,0,-.39,0);
    add(knee,'trouser-lower-'+suffix,sleeve(.34,.143,.164,.68),'uniform');
    add(knee,'kneepad-'+suffix,E.roundedBox(.125,.12,.036,.022),'polymer',[0,-.025,-.086]);
    const ankle=bone('ankle-'+suffix,knee,0,-.34,0);
    add(ankle,'boot-'+suffix,E.roundedBox(.16,.14,.28,.035),'polymer',[0,-.075,-.045]);
    add(ankle,'boot-sole-'+suffix,E.roundedBox(.166,.025,.286,.012),'polymer',[0,-.132,-.045],[.7,.7,.7]);
    const shoulder=bone('shoulder-'+suffix,torso,side*.225,.19,-.005);
    add(shoulder,'sleeve-upper-'+suffix,sleeve(.29,.16,.18,.78),'uniform');
    const elbow=bone('elbow-'+suffix,shoulder,0,-.29,0);
    add(elbow,'sleeve-lower-'+suffix,sleeve(.27,.123,.143,.72),'uniform');
    add(elbow,'elbow-reinforcement-'+suffix,E.roundedBox(.11,.075,.025,.012),'webbing',[0,-.035,.066]);
    const wrist=bone('wrist-'+suffix,elbow,0,-.27,0);
    add(wrist,'glove-'+suffix,softBox(.095,.11,.07,.025),'polymer',[0,-.035,0]);
    add(wrist,'thumb-'+suffix,E.roundedBox(.025,.065,.035,.012),'polymer',[-side*.047,-.025,-.015],[.9,.9,.9],[0,0,side*.4]);
  }
  const gun=bone('held-rifle',torso,.06,0,-.29);
  add(gun,'rifle-receiver',E.beveledBox(.065,.10,.29,.009),'metal');
  add(gun,'rifle-stock',E.roundedBox(.065,.105,.23,.016),'polymer',[0,-.02,.235]);
  add(gun,'rifle-foregrip',E.roundedBox(.07,.08,.23,.015),'polymer',[0,.005,-.23]);
  add(gun,'rifle-grip',E.beveledBox(.05,.12,.065,.008),'polymer',[0,-.09,.075],[1,1,1],[-.2,0,0]);
  add(gun,'rifle-magazine',E.beveledBox(.052,.18,.08,.007),'metal',[0,-.12,-.015],[.7,.7,.7]);
  add(gun,'rifle-sight',E.beveledBox(.04,.025,.075,.004),'polymer',[0,.065,-.09]);
  add(gun,'rifle-barrel',new T.CylinderGeometry(.014,.014,.25,12).rotateX(Math.PI/2),'metal',[0,.012,-.46]);
  const definition=builder.build();
  for(const geometries of Object.values(builder.slots)) for(const geometry of geometries) geometry.dispose();
  definition.geometry.name='sentinel-shared-rigid-skin';
  const uniformSlot=definition.slots.indexOf('uniform');
  const list = [], eye = new T.Vector3(), aim = new T.Vector3(), muzzle = new T.Vector3();
  const end = new T.Vector3(), clipped = new T.Vector3(), step = new T.Vector3(), center = new T.Vector3();
  const ray = new T.Ray(), bounds = new T.Sphere(), contact = new T.Vector3();
  let role = 'attack';
  // Two-bone aiming pose in torso coordinates. Wrist targets are shared rifle datums.
  function holdRifle(bones, suffix, target, bend) {
    const shoulder=bones['shoulder-'+suffix], elbow=bones['elbow-'+suffix], wrist=bones['wrist-'+suffix];
    const start=shoulder.position.clone(), reach=new T.Vector3(...target).sub(start);
    const distance=reach.length(), direction=reach.normalize(), upper=.29, lower=.27;
    const along=(upper*upper-lower*lower+distance*distance)/(2*distance);
    const across=new T.Vector3(...bend).addScaledVector(direction,-new T.Vector3(...bend).dot(direction)).normalize();
    const middle=start.clone().addScaledVector(direction,along).addScaledVector(across,Math.sqrt(Math.max(0,upper*upper-along*along)));
    shoulder.quaternion.setFromUnitVectors(new T.Vector3(0,-1,0),middle.clone().sub(start).normalize());
    const forearm=new T.Quaternion().setFromUnitVectors(new T.Vector3(0,-1,0),new T.Vector3(...target).sub(middle).normalize());
    elbow.quaternion.copy(shoulder.quaternion).invert().multiply(forearm);
    wrist.quaternion.copy(forearm).invert().multiply(new T.Quaternion().setFromAxisAngle(new T.Vector3(1,0,0),Math.PI/2));
  }
  function create(id) {
    const rig=E.createRig(definition,slots,{radius:1.25,center:[0,.9,0]});
    const root=rig.group, bones=rig.bones;
    root.name=`tactical-bot-${id}`;root.visible=false;g.scene.add(root);
    rig.mesh.name='sentinel-skin';
    holdRifle(bones,'right',[.06,-.07,-.21],[1,-1,0]);
    holdRifle(bones,'left',[.04,.01,-.46],[-1,-1,0]);
    const flash=new T.Object3D();flash.name='muzzle-marker';flash.position.set(0,.012,-.595);bones['held-rifle'].add(flash);flash.visible=false;
    const legs=['left','right'].map(side=>bones['hip-'+side]);
    const knees=['left','right'].map(side=>bones['knee-'+side]);
    const arms=['left','right'].map(side=>bones['shoulder-'+side]);
    root.userData.asset={sourceParts,joints:definition.bones.length,meshes:1,triangles:definition.tris,materialGroups:definition.slots.length,sharedGeometry:true,rig:'rigid-weight SkinnedMesh'};
    return {id,name:`SENTINEL ${String(id+1).padStart(2,'0')}`,root,torso:bones['upper-body'],head:bones.head,legs,knees,arms,flash,uniform:[rig.mesh],mesh:rig.mesh,skeleton:rig.skeleton,pos:root.position,
      vel:new T.Vector3(),home:new T.Vector3(),goal:new T.Vector3(),lastSeen:new T.Vector3(),
      health:100,alive:false,state:'patrol',path:[],waypoint:0,patrol:0,wait:0,
      planTime:0,reaction:0,nextShot:0,memory:0,stride:0,flashTime:0};
  }
  for(let i=0;i<4;i++) list.push(create(i));
  function reset(nextRole, spawns) {
    role = nextRole;
    list.forEach((b, i) => {
      b.alive = i < spawns.length; b.root.visible = b.alive; b.health = 100;
      b.pos.copy(spawns[i] || spawns[0] || b.home); b.home.copy(b.pos); b.goal.copy(b.pos); b.lastSeen.copy(b.pos);
      b.vel.set(0, 0, 0); b.root.rotation.set(0, role === 'attack' ? 0 : Math.PI, 0);
      b.state = 'patrol'; b.path = []; b.waypoint = b.patrol = 0; b.wait = .3 + i * .2;
      b.planTime = i * .12; b.reaction = b.nextShot = b.memory = b.stride = b.flashTime = b.stuckTime = 0;
      b.flash.visible = false; b.torso.rotation.set(0, 0, 0); b.head.rotation.set(0, 0, 0);
      b.legs.forEach(l => l.rotation.set(0, 0, 0)); b.knees.forEach(k => k.rotation.set(0, 0, 0));
      b.uniform.forEach(mesh => { mesh.material[uniformSlot] = role === 'attack' ? mats.navy : mats.tan; });
    });
  }
  function alert(pos) {
    for (const b of list) if (b.alive && b.pos.distanceToSquared(pos) < 30 * 30) {
      b.lastSeen.copy(pos); b.memory = 4;
    }
  }
  function look(b, target, dt) {
    const yaw = Math.atan2(b.pos.x - target.x, b.pos.z - target.z);
    const difference = Math.atan2(Math.sin(yaw - b.root.rotation.y), Math.cos(yaw - b.root.rotation.y));
    b.root.rotation.y += difference * Math.min(1, dt * 9); return Math.abs(difference);
  }
  function move(b, target, dt) {
    if (b.planTime <= 0) {
      b.path = g.physics.nav.findPath(b.pos, target) || []; b.waypoint = 0; b.planTime = 1 + random() * .15;
      if (!b.path.length && b.state === 'patrol') { b.goal.copy(b.pos); b.wait = .2; }
    }
    while (b.waypoint < b.path.length && Math.hypot(b.path[b.waypoint].x - b.pos.x, b.path[b.waypoint].z - b.pos.z) < .38) b.waypoint++;
    const point = b.path[b.waypoint]; b.vel.x = b.vel.z = 0;
    if (!point || Math.hypot(target.x - b.pos.x, target.z - b.pos.z) < .35) return;
    step.subVectors(point, b.pos).setY(0).normalize().multiplyScalar(2.3);
    for (const other of list) if (other !== b && other.alive) {
      const dx = b.pos.x - other.pos.x, dz = b.pos.z - other.pos.z, d = Math.hypot(dx, dz);
      if (d > .01 && d < .7) { step.x += dx / d * (.7 - d) * 3; step.z += dz / d * (.7 - d) * 3; }
    }
    step.clampLength(0, 2.3); b.vel.x = step.x; b.vel.z = step.z; look(b, point, dt);
  }
  function fire(b, distance) {
    b.root.updateMatrixWorld(true); b.flash.getWorldPosition(muzzle);
    aim.copy(g.player.eye); aim.y -= .28;
    const hit = random() < Math.max(.16, .68 - distance * .014);
    end.copy(aim);
    if (!hit) { end.x += (random() < .5 ? -1 : 1) * (.55 + random() * .6); end.y += .3 + random() * .6; }
    // Eye visibility is insufficient when a muzzle is still behind cover.
    const clear = g.physics.lineOfSight(muzzle, end);
    if (!clear) {
      let low = 0, high = 1;
      for (let i = 0; i < 8; i++) {
        const mid = (low + high) / 2; clipped.lerpVectors(muzzle, end, mid);
        if (g.physics.lineOfSight(muzzle, clipped)) low = mid; else high = mid;
      }
      end.lerpVectors(muzzle, end, low);
    }
    g.trace(muzzle.clone(), end.clone(), 0xffc384);
    g.fx?.muzzleFlash(muzzle, step.subVectors(end,muzzle).normalize(), {scale:.7});
    g.audio.play('rifle_shot', { pos: muzzle.clone(), gain: .42, pitch: .94 + random() * .1 });
    b.flashTime = .045; b.flash.visible = true; b.nextShot = .45 + random() * .35;
    if (hit && clear) g.onPlayerHit(7 + Math.floor(random() * 4), b.pos);
  }
  function update(dt) {
    if (g.game.phase !== 'playing') return;
    let defuser = null;
    for (const b of list) {
      if (!b.alive) continue;
      b.planTime -= dt; b.nextShot -= dt; b.memory = Math.max(0, b.memory - dt);
      b.flashTime -= dt; b.flash.visible = b.flashTime > 0;
      eye.copy(b.pos).y += 1.58;
      const distance = eye.distanceTo(g.player.eye);
      const sees = g.player.alive && distance <= 35 && g.physics.lineOfSight(eye, g.player.eye);
      const bomb = g.game.bomb;
      b.vel.x = b.vel.z = 0;
      if (sees) {
        b.state = 'engage'; b.reaction += dt; b.lastSeen.copy(g.player.pos); b.memory = 4;
        const angle = look(b, g.player.pos, dt);
        if (b.reaction >= .65 && b.nextShot <= 0 && angle < .22) fire(b, distance);
      } else {
        b.reaction = 0;
        if (bomb.planted && role === 'attack') {
          b.state = 'retake'; b.goal.copy(bomb.pos);
          aim.copy(bomb.pos).y += .25;
          if (b.pos.distanceTo(bomb.pos) < 1.6 && g.physics.lineOfSight(eye, aim)) {
            if (!defuser) defuser = b; look(b, bomb.pos, dt);
          } else move(b, b.goal, dt);
        } else if (b.memory > 0) {
          b.state = 'engage'; b.goal.copy(b.lastSeen); move(b, b.goal, dt);
        } else {
          b.state = 'patrol'; b.wait -= dt;
          if (b.wait <= 0 && b.pos.distanceToSquared(b.goal) < .36) {
            b.patrol = (b.patrol + 1) % 4;
            const angle = b.patrol * Math.PI / 2 + b.id * .7;
            b.goal.copy(b.home).add(step.set(Math.cos(angle) * 2.1, 0, Math.sin(angle) * 2.1)); b.wait = 1.5;
            if (role === 'defend' && bomb.planted && b.home.distanceTo(bomb.pos) > 10)
              b.goal.copy(bomb.pos).add(step.set(Math.cos(angle) * 4, 0, Math.sin(angle) * 4));
          }
          if (b.wait <= 0) move(b, b.goal, dt);
        }
      }
      const oldX=b.pos.x, oldZ=b.pos.z, intendedMove=Math.hypot(b.vel.x,b.vel.z)>.2;
      b.vel.y -= 21 * dt; g.physics.moveCapsule(b.pos, b.vel, dt, .32, 1.8, true);
      const stalled=b.state==='patrol'&&b.wait<=0&&b.pos.distanceToSquared(b.goal)>.36&&(!intendedMove||Math.hypot(b.pos.x-oldX,b.pos.z-oldZ)<dt*.1);
      b.stuckTime=stalled?(b.stuckTime||0)+dt:0;
      if(b.stuckTime>2){b.goal.copy(b.pos);b.wait=.2;b.stuckTime=0;b.planTime=0;}
      const speed = Math.hypot(b.vel.x, b.vel.z); b.stride += speed * dt * 4.3;
      b.legs.forEach((leg, i) => {
        const swing = Math.sin(b.stride + i * Math.PI) * Math.min(.48, speed * .2);
        leg.rotation.x = swing; b.knees[i].rotation.x = Math.max(0, -swing) * 1.2;
      });
      b.torso.rotation.z = Math.sin(b.stride) * speed * .008;
      b.head.rotation.x = sees ? Math.atan2(eye.y - g.player.eye.y, Math.max(1, distance)) * .4 : 0;
    }
    // A single bot contributes progress; the mission owns reset/cancel policy.
    g.onBotDefuse(defuser ? dt : 0, defuser?.id ?? null);
  }
  function raycast(origin, direction, maxDist) {
    ray.set(origin, step.copy(direction).normalize()); let best = null, limit = maxDist;
    for (const b of list) if (b.alive) {
      for (const [height, radius, headshot] of [[1.58, .17, true], [1.22, .28, false], [.84, .27, false], [.43, .24, false]]) {
        center.copy(b.pos).y += height; bounds.set(center, radius);
        if (!ray.intersectSphere(bounds, contact)) continue;
        const dist = origin.distanceTo(contact);
        if (dist < limit && g.physics.lineOfSight(origin, contact)) {
          limit = dist; best = { bot: b, point: contact.clone(), dist, headshot };
        }
      }
    }
    return best;
  }
  function damage(hit, amount) {
    const b = hit?.bot; if (!b?.alive || !(amount > 0)) return;
    b.health = Math.max(0, b.health - amount); b.memory = 4; b.lastSeen.copy(g.player.pos);
    if (b.health === 0) {
      b.alive = false; b.root.visible = false; b.flash.visible = false; b.vel.set(0, 0, 0);
      g.onBotKilled(b, !!hit.headshot);
    }
  }
  return { reset, update, raycast, damage, alert, list, get aliveCount() { return list.filter(b => b.alive).length; } };
}
