import { createGround } from './ground.js';

// Sirocco: an authored three-lane layout, built from local procedural geometry.
// Dimensions and material slots are planned before static meshes are compiled.
export function createMap(g) {
  const T = g.THREE;
  const root = new T.Group();
  root.name = 'sirocco';
  const radarRects = [];
  const collisionStart = g.physics.boxes.length;
  const batches = new Map();
  const transform = new T.Object3D();
  const bounds = { min: new T.Vector3(-28, 0, -28), max: new T.Vector3(28, 20, 28) };
  g.physics.bounds = bounds;

  const buildings = [
    { id: 'south-west', x: -10.5, z: 9.5, w: 11, d: 15, h: 7.4, color: 'ochre' },
    { id: 'south-east', x: 10.5, z: 10.5, w: 11, d: 13, h: 8.5, color: 'plaster' },
    { id: 'north-west', x: -8, z: -10.5, w: 8, d: 13, h: 8.8, color: 'plaster' },
    { id: 'north-east', x: 8, z: -10.5, w: 8, d: 13, h: 7.2, color: 'rose' },
  ];
  const sites = [
    { id: 'A', pos: new T.Vector3(19, 0, -17), radius: 3.2 },
    { id: 'B', pos: new T.Vector3(-19, 0, -17), radius: 3.2 },
  ];

  const assetSeed = Number(g.params.seed || 731) >>> 0;
  let seed = assetSeed;
  const rand = () => {
    seed = (Math.imul(seed, 1664525) + 1013904223) >>> 0;
    return seed / 4294967296;
  };
  // The original GPU factory owns shared albedo, ORM and normal textures.
  // Triplanar sampling uses metre coordinates after geometry compilation.
  const surface = (preset, color) => g.mats.get(preset, {
    color, triplanar: true, vertexColors: true,
  });
  const stone = color => {
    const material = surface('concrete', color);
    material.color.multiplyScalar(2.5);
    material.normalScale.setScalar(.65);
    return material;
  };
  const mats = {
    plaster: stone(0xe5d1a6), ochre: stone(0xc8a170), rose: stone(0xc5a08a),
    trim: stone(0xf0dbb3), base: stone(0x9c8767),
    brick: surface('brick', 0xd9b689), roof: stone(0xd9bd91),
    wood: surface('wood_pallet', 0xc7a377),
    shutter: surface('paint_teal', 0x365950),
    dark: surface('polymer_black', 0x29322d),
    metal: surface('steel_worn', 0x49463c),
    dome: surface('paint_teal', 0x648a83),
    red: surface('paint_red', 0xa7472b),
  };
  const materialSlots = new Map(Object.entries(mats).map(([slot, material]) => [material, slot]));
  const masonry = new Set(['plaster', 'ochre', 'rose', 'trim', 'base', 'brick', 'roof']);
  const facadePlan = buildings.flatMap(building => {
    const placements = [];
    for (const side of [-1, 1]) {
      const frontCount = Math.floor(building.w / 2.7);
      for (let bay = 0; bay < frontCount; bay++) placements.push({
        owner: building.id, side: side < 0 ? 'north' : 'south', bay,
        x: building.x - building.w / 2 + building.w * (bay + 0.5) / frontCount,
        y: 4.7, z: building.z + side * (building.d / 2 + 0.015),
        yaw: side < 0 ? Math.PI : 0,
      });
      const sideCount = Math.floor(building.d / 3.1);
      for (let bay = 0; bay < sideCount; bay++) placements.push({
        owner: building.id, side: side < 0 ? 'west' : 'east', bay,
        x: building.x + side * (building.w / 2 + 0.015), y: 4.7,
        z: building.z - building.d / 2 + building.d * (bay + 0.5) / sideCount,
        yaw: side * Math.PI / 2,
      });
    }
    return placements;
  });
  const portalPlan = [
    { x: 0, z: 10.4, width: 10, radius: 3, spring: 2.9, height: 6.6, depth: 1, doors: true },
    { x: 0, z: -10.2, width: 8, radius: 2.8, spring: 2.8, height: 6.1, depth: 0.9, doors: true },
    { x: -21.8, z: 0, width: 10.4, radius: 3.1, spring: 2.8, height: 6.5, depth: 1, doors: false },
    { x: 21.8, z: -4, width: 10.4, radius: 3.1, spring: 2.8, height: 6.5, depth: 1, doors: false },
  ];
  const cratePlan = [
    [-17.8,14.8,2.3,1.9,2.2,0], [18.6,13.1,2.2,2.4,2.5,0],
    [-2.4,1.8,1.9,1.6,2.2,0], [2.35,-18.7,2,1.8,2.2,0],
    [-14.6,-20.7,2.8,2,2.4,0], [-14.6,-20.7,1.7,1.4,1.6,2],
    [23.5,-13.2,2.4,2.1,3.4,0], [14.5,-22.5,2.5,1.6,2.3,0],
    [-24,-13.6,2.1,1.5,2.7,0],
  ];
  let emittedParts = 0;

  function emit(geometry, material, x = 0, y = 0, z = 0, rx = 0, ry = 0, rz = 0, worldUV = false, raw = false) {
    const geo = geometry.index ? geometry.toNonIndexed() : geometry;
    if (geo !== geometry) geometry.dispose();
    transform.position.set(x, y, z);
    transform.rotation.set(rx, ry, rz);
    transform.scale.set(1, 1, 1);
    transform.updateMatrix();
    geo.applyMatrix4(transform.matrix);
    let batch = batches.get(material);
    if (!batch) { batch = { pos: [], normal: [], uv: [], color: [], parts: 0 }; batches.set(material, batch); }
    batch.parts++;
    emittedParts++;
    const slot = materialSlots.get(material);
    const p = geo.attributes.position, n = geo.attributes.normal, uv = geo.attributes.uv;
    const sourceColor = geo.attributes.color;
    const noise = SaltlineEngine.valueNoise3, variationSeed = assetSeed * 3.71;
    for (let i = 0; i < p.count; i++) {
      const px = p.getX(i), py = p.getY(i), pz = p.getZ(i);
      const nx = n.getX(i), ny = n.getY(i), nz = n.getZ(i);
      batch.pos.push(px, py, pz);
      batch.normal.push(nx, ny, nz);
      // Same two-octave dirt + hemispherical AO + 20 cm base band as Saltline
      // Kn.finish(), source 44635. Preserve authored prop colors before batching.
      const coarse = noise(px * 1.9 + variationSeed, py * 1.9, pz * 1.9 + 5.3);
      const fine = noise(px * 9 + 2.1, py * 9 + variationSeed, pz * 9);
      const foot = Math.max(0, Math.min(1, 1 - py / .2));
      let shade = (0.82 + .18 * coarse) * (.92 + .08 * fine) *
        (.76 + .24 * Math.max(0, Math.min(1, ny * .6 + .62)));
      shade *= 1 - .42 * foot * foot * (.55 + .45 * fine);
      const grime = raw ? 0 : masonry.has(slot) ? .65 : .35;
      shade = 1 + (shade - 1) * grime;
      batch.color.push((sourceColor ? sourceColor.getX(i) : 1) * shade,
        (sourceColor ? sourceColor.getY(i) : 1) * shade * (1 - .05 * foot * grime),
        (sourceColor ? sourceColor.getZ(i) : 1) * shade * (1 - .12 * foot * grime));
      if (worldUV) {
        const axis = Math.abs(ny) > 0.7 ? 1 : Math.abs(nx) > Math.abs(nz) ? 0 : 2;
        batch.uv.push(axis === 0 ? pz : px, axis === 1 ? pz : py);
      } else batch.uv.push(uv ? uv.getX(i) : 0, uv ? uv.getY(i) : 0);
    }
    geo.dispose();
  }
  function box(x, y, z, w, h, d, mat = mats.plaster, yaw = 0) {
    const bevel = Math.min(0.025, Math.min(w, h, d) * 0.12);
    const geometry = window.SaltlineEngine.beveledBox(w, h, d, bevel);
    emit(geometry, mat, x, y, z, 0, yaw, 0, true);
  }
  function collider(x, z, w, d, h, surfaceType = 'concrete', y = 0, radar = true) {
    g.physics.addBox([x - w / 2, y, z - d / 2], [x + w / 2, y + h, z + d / 2], { surface: surfaceType });
    if (radar) radarRects.push({ x, z, w, d });
  }
  function wall(x, z, w, d, h, material = mats.ochre) {
    box(x, h / 2, z, w, h, d, material);
    box(x, h + 0.12, z, w + 0.12, 0.24, d + 0.12, mats.trim);
    box(x, 0.25, z, w + 0.05, 0.5, d + 0.05, mats.base);
    collider(x, z, w, d, h + 0.24);
  }

  const ground = createGround(g, buildings);
  g.ground = ground;
  root.add(ground.mesh);
  ground.setDebug(g.params.grounddebug === 'mask');
  // Four solid masses leave continuous side lanes and two broad cross streets.
  for (const b of buildings) {
    wall(b.x, b.z, b.w, b.d, b.h, mats[b.color]);
    box(b.x, b.h - 0.4, b.z, b.w + 0.18, 0.16, b.d + 0.18, mats.trim);
    box(b.x, b.h + 0.44, b.z - b.d / 2 + 0.18, b.w, 0.55, 0.35, mats.roof);
    box(b.x, b.h + 0.44, b.z + b.d / 2 - 0.18, b.w, 0.55, 0.35, mats.roof);
    box(b.x - b.w / 2 + 0.18, b.h + 0.44, b.z, 0.35, 0.55, b.d, mats.roof);
    box(b.x + b.w / 2 - 0.18, b.h + 0.44, b.z, 0.35, 0.55, b.d, mats.roof);
    for (const bay of facadePlan.filter(placement => placement.owner === b.id)) {
      windowBay(bay.x, bay.y, bay.z, bay.yaw);
    }
    // Corner stones and drainpipes give the flat masses a readable construction.
    for (const dx of [-1, 1]) for (const dz of [-1, 1]) {
      const x = b.x + dx * (b.w / 2 - 0.1), z = b.z + dz * (b.d / 2 - 0.1);
      for (let j = 0; j < Math.floor(b.h / 0.55); j++) {
        box(x, 0.3 + j * 0.55, z, j % 2 ? 0.48 : 0.28, 0.35, j % 2 ? 0.28 : 0.48, mats.trim);
      }
    }
  }

  function localBox(x, y, z, yaw, lx, ly, lz, w, h, d, mat) {
    const c = Math.cos(yaw), s = Math.sin(yaw);
    box(x + lx * c + lz * s, y + ly, z - lx * s + lz * c, w, h, d, mat, yaw);
  }
  function windowBay(x, y, z, yaw) {
    const b = (lx, ly, lz, w, h, d, mat) => localBox(x, y, z, yaw, lx, ly, lz, w, h, d, mat);
    b(0, 0, 0.035, 1.16, 1.65, 0.08, mats.dark);
    b(0, -0.9, 0.1, 1.55, 0.18, 0.34, mats.trim);
    b(0, 0.9, 0.06, 1.48, 0.18, 0.2, mats.trim);
    for (const s of [-1, 1]) {
      b(s * 0.68, 0, 0.07, 0.14, 1.85, 0.18, mats.trim);
      b(s * 0.29, 0, 0.09, 0.54, 1.55, 0.07, mats.shutter);
      for (let j = 0; j < 8; j++) b(s * 0.29, -0.63 + j * 0.18, 0.14, 0.48, 0.065, 0.06, mats.dark);
    }
  }

  wall(-28, 0, 1, 57, 5.4);
  wall(28, 0, 1, 57, 5.2);
  wall(0, -28, 55, 1, 6.2, mats.plaster);
  wall(0, 28, 55, 1, 5.6, mats.rose);

  // Arched portals have separate piers and a genuine opening; no hidden wall.
  function arch(x, z, width = 10, radius = 3, spring = 2.9, height = 6.6, depth = 0.9, doors = false) {
    const pier = (width - radius * 2) / 2;
    for (const side of [-1, 1]) {
      wall(x + side * (radius + pier / 2), z, pier, depth, height, mats.ochre);
      box(x + side * (radius + 0.16), spring / 2, z, 0.3, spring, depth + 0.22, mats.trim);
    }
    const shape = new T.Shape();
    shape.moveTo(-radius, height);
    shape.lineTo(radius, height);
    shape.lineTo(radius, spring);
    for (let n = 1; n <= 24; n++) {
      const a = n / 24 * Math.PI;
      shape.lineTo(Math.cos(a) * radius, spring + Math.sin(a) * radius);
    }
    shape.closePath();
    emit(new T.ExtrudeGeometry(shape, { depth, bevelEnabled: false, steps: 1 }), mats.ochre, x, 0, z - depth / 2);
    for (let n = 0; n < 12; n++) {
      const a = n / 12 * Math.PI + 0.012, b = (n + 1) / 12 * Math.PI - 0.012;
      const band = new T.Shape();
      band.absarc(0, spring, radius + 0.32, a, b, false);
      band.absarc(0, spring, radius, b, a, true);
      band.closePath();
      emit(new T.ExtrudeGeometry(band, { depth: depth + 0.12, bevelEnabled: false, curveSegments: 3 }), mats.trim, x, 0, z - depth / 2 - 0.06);
      const left = -radius + n / 12 * radius * 2, right = left + radius * 2 / 12;
      const near = Math.abs(left) < Math.abs(right) ? left : right;
      const bottom = spring + Math.sqrt(Math.max(0, radius * radius - near * near));
      collider(x + (left + right) / 2, z, right - left, depth, height - bottom, 'concrete', bottom, false);
    }
    box(x, height + 0.25, z, width + 0.2, 0.26, depth + 0.24, mats.trim);
    if (doors) {
      for (const side of [-1, 1]) {
        const dx = x + side * (radius - 0.12), dz = z + 1.05;
        box(dx, 1.42, dz, 0.17, 2.84, 2.5, mats.wood);
        collider(dx, dz, 0.17, 2.5, 2.84, 'wood');
        for (const y of [0.4, 1.35, 2.35]) box(dx, y, dz, 0.2, 0.15, 2.55, mats.metal);
        for (let n = 0; n < 7; n++) box(dx + side * 0.095, 1.42, dz - 1.06 + n * 0.35, 0.015, 2.7, 0.018, mats.dark);
      }
    }
  }
  for (const portal of portalPlan) {
    arch(portal.x, portal.z, portal.width, portal.radius, portal.spring, portal.height, portal.depth, portal.doors);
  }

  // The skyline is deliberately asymmetrical: dome above B, tower above A.
  box(-8, 9.55, -11, 6.1, 1.3, 6.1, mats.plaster);
  emit(new T.SphereGeometry(2.9, 24, 12, 0, Math.PI * 2, 0, Math.PI / 2), mats.dome, -8, 10.2, -11);
  emit(new T.CylinderGeometry(0.07, 0.11, 1.25, 8), mats.metal, -8, 13.4, -11);
  emit(new T.SphereGeometry(0.18, 10, 6), mats.metal, -8, 14, -11);
  box(9.4, 10, -13.5, 3, 5.6, 3, mats.ochre);
  box(9.4, 12.95, -13.5, 3.7, 0.35, 3.7, mats.trim);
  for (const dx of [-1, 1]) for (const dz of [-1, 1]) box(9.4 + dx * 1.15, 13.65, -13.5 + dz * 1.15, 0.36, 1.15, 0.36, mats.plaster);
  emit(new T.ConeGeometry(2.15, 1.5, 4), mats.roof, 9.4, 14.7, -13.5, 0, Math.PI / 4);
  // Shallow balconies project above players, not into movement collision.
  for (const [x, z, yaw] of [[5, 8, -Math.PI / 2], [-5, 10, Math.PI / 2], [8, -4, 0]]) {
    localBox(x, 0, z, yaw, 0, 3.3, 0.58, 2.8, 0.2, 1.25, mats.trim);
    localBox(x, 0, z, yaw, 0, 4.25, 1.16, 2.75, 0.08, 0.08, mats.metal);
    for (let n = 0; n < 9; n++) localBox(x, 0, z, yaw, -1.25 + n * 0.3125, 3.78, 1.16, 0.05, 0.9, 0.05, mats.metal);
  }

  function crate(x, z, w = 1.8, h = 1.8, d = 1.8, y = 0) {
    box(x, y + h / 2, z, w, h, d, mats.wood);
    collider(x, z, w, d, h, 'wood', y);
    for (const side of [-1, 1]) {
      for (const dy of [0.12, h - 0.12]) box(x, y + dy, z + side * (d / 2 + 0.02), w, 0.16, 0.08, mats.base);
      for (const dx of [-w / 2 + 0.12, w / 2 - 0.12]) box(x + dx, y + h / 2, z + side * (d / 2 + 0.04), 0.16, h, 0.1, mats.base);
      box(x + side * (w / 2 + 0.02), y + h / 2, z, 0.08, 0.14, d, mats.metal);
    }
  }
  // Original soft-form builders retain their deformation, welded normals,
  // metre UVs and source material/color fields. Bake transforms before emission.
  const softProps = [];
  function softCover(name, x, y, z, w, h, d, options = {}) {
    const prop = g.props.build(name, {seed: assetSeed + softProps.length * 31, ...options});
    const size = prop.userData.size;
    prop.position.set(x, y, z); prop.scale.set(w / size[0], h / size[1], d / size[2]);
    prop.updateMatrixWorld(true);
    let triangles = 0;
    prop.traverse(node => {
      if (!node.isMesh) return;
      if (!materialSlots.has(node.material)) materialSlots.set(node.material, 'prop-' + name + '-' + node.material.name);
      const geometry = node.geometry.clone().applyMatrix4(node.matrixWorld);
      triangles += (geometry.index?.count || geometry.attributes.position.count) / 3;
      emit(geometry, node.material, 0, 0, 0, 0, 0, 0, false, true);
    });
    softProps.push({name, bounds: [x-w/2,y,z-d/2,x+w/2,y+h,z+d/2], triangles});
  }
  for (const placement of cratePlan) {
    if (placement[0] === 18.6) {
      const [x,z,w,h,d,y] = placement;
      softCover('tarp_cargo',x,y,z,w,h,d);
      collider(x,z,w,d,h,'wood',y);
    } else crate(...placement);
  }
  // Same two cover AABBs as before. Seven courses fill the existing height.
  for (const [x,z,w,h] of [[-20.5,-24,6.5,1.3],[19.5,-23.8,5.5,1.2]]) {
    for (let section = 0; section < 3; section++)
      softCover('sandbags',x+(section-1)*w/3,0,z,w/3,h,.8,{courses:7});
    collider(x,z,w,.8,h,'dirt');
  }

  const labelNames = ['A', 'B', 'A →', '← B'];
  const labelCanvas = document.createElement('canvas');
  labelCanvas.width = 1024; labelCanvas.height = 512;
  const labelContext = labelCanvas.getContext('2d');
  const labelPadding = 16, labelWidth = 480, labelHeight = 224;
  labelNames.forEach((text, index) => {
    const cell = document.createElement('canvas'); cell.width = labelWidth; cell.height = labelHeight;
    const ctx = cell.getContext('2d');
    // Stencil cuts and seeded wear are authored before atlas packing (38303).
    ctx.fillStyle = '#9d4329'; ctx.font = '900 160px sans-serif';
    ctx.textAlign = 'center'; ctx.textBaseline = 'middle';
    ctx.fillText(text, labelWidth / 2, labelHeight / 2 + 4);
    ctx.globalCompositeOperation = 'destination-out';
    ctx.fillRect(labelWidth / 2 - 3, 8, 6, labelHeight - 16);
    const random = SaltlineEngine.createRng(assetSeed + index * 733);
    for (let n = 0; n < 110; n++) {
      const x = random() * labelWidth, y = random() * labelHeight;
      ctx.fillRect(x, y, 1 + random() * 7, .8 + random() * 2);
    }
    ctx.globalCompositeOperation = 'destination-over';
    ctx.fillStyle = 'rgba(157,67,41,.004)'; ctx.fillRect(0,0,labelWidth,labelHeight);
    const x = index % 2 * 512 + labelPadding, y = Math.floor(index / 2) * 256 + labelPadding;
    // Expanded border + exact inner copy, matching the source shelf atlas padding.
    labelContext.drawImage(cell, x-labelPadding, y-labelPadding, labelWidth+2*labelPadding, labelHeight+2*labelPadding);
    labelContext.clearRect(x,y,labelWidth,labelHeight);
    labelContext.drawImage(cell,x,y);
  });
  const labelTexture = new T.CanvasTexture(labelCanvas);
  labelTexture.name = 'sirocco-wayfinding-atlas';
  labelTexture.colorSpace = T.SRGBColorSpace;
  labelTexture.anisotropy = Math.min(8, g.renderer.capabilities.getMaxAnisotropy());
  const labelMaterial = new T.MeshStandardMaterial({ map: labelTexture, transparent: true, depthWrite: false,
    roughness: 1, polygonOffset: true, polygonOffsetFactor: -2, polygonOffsetUnits: -2 });
  materialSlots.set(labelMaterial, 'wayfinding');
  function decal(text, x, y, z, w, h, yaw = 0, ground = false) {
    const index = labelNames.indexOf(text);
    const geometry = new T.PlaneGeometry(w, h);
    const uv = geometry.attributes.uv;
    for (let vertex = 0; vertex < uv.count; vertex++) {
      uv.setXY(vertex, ((index % 2) * 512 + labelPadding + uv.getX(vertex) * labelWidth) / 1024,
        1 - (Math.floor(index / 2) * 256 + labelPadding + (1 - uv.getY(vertex)) * labelHeight) / 512);
    }
    emit(geometry, labelMaterial, x, y, z, ground ? -Math.PI / 2 : 0, yaw, 0, false, true);
  }
  for (const site of sites) {
    emit(new T.RingGeometry(2.9, 3.05, 48), mats.red, site.pos.x, 0.012, site.pos.z, -Math.PI / 2);
    decal(site.id, site.pos.x, 0.018, site.pos.z, 3.5, 3.5, 0, true);
  }
  decal('A →', 8, 2.3, 17.025, 2.4, 1.2);
  decal('← B', -8, 2.3, 17.025, 2.4, 1.2);
  decal('A', 18.5, 2.5, -27.48, 2, 2);
  decal('B', -18.5, 2.5, -27.48, 2, 2);

  // Utility details stay on façades; they do not introduce invisible blockers.
  for (const b of buildings) {
    for (const side of [-1, 1]) {
      emit(new T.CylinderGeometry(0.045, 0.045, b.h - 0.5, 6), mats.metal,
        b.x + side * (b.w / 2 + 0.06), b.h / 2, b.z + b.d / 2 - 0.7);
    }
  }
  for (const z of [20, -1, -22]) {
    const curve = new T.CatmullRomCurve3([
      new T.Vector3(-17, 6.9, z), new T.Vector3(0, 5.9, z + 0.2), new T.Vector3(17, 7.3, z),
    ]);
    emit(new T.TubeGeometry(curve, 16, 0.022, 4, false), mats.dark);
  }
  // Sparse chipped courses around the boundary break long blank wall faces.
  for (let n = 0; n < 45; n++) {
    const side = n % 2 ? -1 : 1, z = -25 + rand() * 50;
    box(side * 27.48, 0.35 + rand() * 1.4, z, 0.04, 0.24, 0.45 + rand() * 0.5, mats.brick);
  }

  let triangleCount = 2;
  for (const [material, batch] of batches) {
    const geometry = new T.BufferGeometry();
    geometry.setAttribute('position', new T.Float32BufferAttribute(batch.pos, 3));
    geometry.setAttribute('normal', new T.Float32BufferAttribute(batch.normal, 3));
    geometry.setAttribute('uv', new T.Float32BufferAttribute(batch.uv, 2));
    geometry.setAttribute('color', new T.Float32BufferAttribute(batch.color, 3));
    geometry.computeBoundingBox(); geometry.computeBoundingSphere();
    const mesh = new T.Mesh(geometry, material);
    mesh.name = 'map-slot-' + materialSlots.get(material);
    mesh.userData.sourceParts = batch.parts;
    mesh.castShadow = material !== mats.red && material !== labelMaterial;
    mesh.receiveShadow = true;
    root.add(mesh);
    triangleCount += batch.pos.length / 9;
  }
  root.userData.plan = { seed: assetSeed, unit: 'metre', buildings, facades: facadePlan,
    portals: portalPlan, crates: cratePlan, softProps, ground: ground.stats, bounds: [-28, -28, 28, 28],
    lanes: [-21, 0, 21], crossovers: [22, 0, -22],
    materials: Object.fromEntries(Object.entries(mats).map(([slot, material]) => [slot, {
      preset: material.name, textureSet: material.userData.set, tileMetres: material.userData.tile,
    }])),
    labels: { atlas: [1024, 512], cells: labelNames.length, paddingPixels: labelPadding, stencil: true },
  };
  root.userData.stats = { staticDrawCalls: root.children.length, triangles: triangleCount,
    emittedParts, materialSlots: batches.size, labelTextures: 1, groundTextures: 3, softProps: softProps.length,
    facadeBays: facadePlan.length, colliders: g.physics.boxes.length - collisionStart };
  g.scene.add(root);
  g.physics.build();
  return {
    root,
    playerStart: { pos: new T.Vector3(0, 0, 23), yaw: 0 },
    defenderStart: { pos: new T.Vector3(0, 0, -23), yaw: Math.PI },
    sites,
    botSpawns: [new T.Vector3(22, 0, -20), new T.Vector3(-22, 0, -20), new T.Vector3(0, 0, -19), new T.Vector3(22, 0, -8), new T.Vector3(-21, 0, -8)],
    zones: [
      { name: 'Sân xuất phát', min: [-27, 18], max: [27, 27] },
      { name: 'Đường giữa', min: [-4, -20], max: [4, 18] },
      { name: 'Lối A', min: [16, -11], max: [27, 18] },
      { name: 'Lối B', min: [-27, -11], max: [-16, 18] },
      { name: 'Khu A', min: [12, -27], max: [27, -11] },
      { name: 'Khu B', min: [-27, -27], max: [-12, -11] },
      { name: 'Giao lộ', min: [-16, -4], max: [16, 4] },
    ],
    radarRects,
    groundSurfaceAt: ground.surfaceAt,
    interiorBoxes: [],
    update() {},
  };
}
