// Dry adaptation of Saltline's CPU mask/detail -> patched StandardMaterial ground.
// Shared mask bytes drive both shading and gameplay queries (TECHNIQUES §4).
export function createGround(g, buildings) {
  const T = g.THREE, size = 90, origin = -size / 2;
  const resolution = g.quality.tex <= 512 ? 256 : 512;
  const seed = Number(g.params.seed || 71) >>> 0;
  const clamp = value => Math.max(0, Math.min(1, value));
  const noise = SaltlineEngine.valueNoise3;
  const bytes = new Uint8Array(resolution * resolution * 4);
  const smooth = (a, b, value) => { const t = clamp((value - a) / (b - a)); return t * t * (3 - 2 * t); };
  for (let z = 0; z < resolution; z++) for (let x = 0; x < resolution; x++) {
    const wx = origin + (x + .5) * size / resolution;
    const wz = origin + (z + .5) * size / resolution;
    let distance = Math.min(Math.abs(Math.abs(wx) - 27.5), Math.abs(Math.abs(wz) - 27.5));
    for (const building of buildings) {
      const dx = Math.abs(wx - building.x) - building.w / 2;
      const dz = Math.abs(wz - building.z) - building.d / 2;
      const outside = Math.hypot(Math.max(0, dx), Math.max(0, dz));
      distance = Math.min(distance, outside);
    }
    const broad = noise(wx * .24 + seed * .017, 0, wz * .24);
    const fine = noise(wx * 1.7, seed * .031, wz * 1.7);
    const lane = Math.min(Math.abs(wx), Math.abs(wx - 21), Math.abs(wx + 21),
      Math.abs(wz - 22), Math.abs(wz), Math.abs(wz + 22));
    const traffic = (1 - smooth(1.0, 3.8, lane)) * (.76 + broad * .24);
    const deposit = clamp((1 - smooth(.05, 1.9, distance)) * .8 + broad * .35 - traffic * .3);
    const i = (z * resolution + x) * 4;
    bytes[i] = Math.round(clamp(.42 + deposit * .33 + (fine - .5) * .07) * 255);
    bytes[i + 1] = Math.round(deposit * 255);
    bytes[i + 2] = Math.round(clamp((1 - smooth(.08, .8, distance)) * (.2 + broad * .5)) * 255);
    bytes[i + 3] = Math.round(traffic * 255);
  }
  function dataTexture(data, n, name, repeat = false) {
    const texture = new T.DataTexture(data, n, n, T.RGBAFormat, T.UnsignedByteType);
    texture.name = name;
    texture.wrapS = texture.wrapT = repeat ? T.RepeatWrapping : T.ClampToEdgeWrapping;
    texture.minFilter = T.LinearMipmapLinearFilter; texture.magFilter = T.LinearFilter;
    texture.generateMipmaps = true; texture.colorSpace = T.NoColorSpace;
    texture.anisotropy = Math.min(8, g.renderer.capabilities.getMaxAnisotropy());
    texture.needsUpdate = true;
    return texture;
  }
  const mask = dataTexture(bytes, resolution, 'sirocco-ground-mask');
  const n = 256, detailBytes = new Uint8Array(n * n * 4), slopeBytes = new Uint8Array(n * n * 4);
  const heights = new Float32Array(n * n);
  // Periodic lattice lookup: wrapped integer hashes make every octave tile exactly.
  const hash = (x, y, period) => {
    const wrap = value => ((value % period) + period) % period;
    let h = Math.imul(wrap(x) + seed, 374761393) ^ Math.imul(wrap(y), 668265263);
    h = Math.imul(h ^ (h >>> 13), 1274126177);
    return ((h ^ (h >>> 16)) >>> 0) / 4294967296;
  };
  function tileNoise(u, v, frequency) {
    const x = u * frequency, y = v * frequency, ix = Math.floor(x), iy = Math.floor(y);
    const a = x - ix, b = y - iy, fx = a * a * (3 - 2 * a), fy = b * b * (3 - 2 * b);
    const aa = hash(ix, iy, frequency), ab = hash(ix + 1, iy, frequency);
    const ba = hash(ix, iy + 1, frequency), bb = hash(ix + 1, iy + 1, frequency);
    return (aa + (ab - aa) * fx) * (1 - fy) + (ba + (bb - ba) * fx) * fy;
  }
  for (let y = 0; y < n; y++) for (let x = 0; x < n; x++) {
    const u = x / n, v = y / n, i = y * n + x;
    const grain = tileNoise(u, v, 96) * .6 + tileNoise(u, v, 40) * .4;
    const broad = tileNoise(u, v, 6) * .7 + tileNoise(u, v, 12) * .3;
    const ridge = 1 - Math.abs(tileNoise(u, v, 8) * 2 - 1);
    const crack = smooth(.91, .985, ridge) * smooth(.38, .7, tileNoise(u, v, 3));
    detailBytes[i * 4] = Math.round(grain * 255);
    detailBytes[i * 4 + 1] = Math.round(broad * 255);
    detailBytes[i * 4 + 2] = Math.round(crack * 255);
    detailBytes[i * 4 + 3] = 255;
    heights[i] = grain * .32 + broad * .1 - crack * .45;
  }
  for (let y = 0; y < n; y++) for (let x = 0; x < n; x++) {
    const dx = heights[y * n + (x + 1) % n] - heights[y * n + (x + n - 1) % n];
    const dy = heights[((y + 1) % n) * n + x] - heights[((y + n - 1) % n) * n + x];
    const normal = new T.Vector3(-dx * 2, -dy * 2, 1).normalize(), i = (y * n + x) * 4;
    slopeBytes[i] = Math.round((normal.x * .5 + .5) * 255);
    slopeBytes[i + 1] = Math.round((normal.y * .5 + .5) * 255);
    slopeBytes[i + 2] = Math.round((normal.z * .5 + .5) * 255); slopeBytes[i + 3] = 255;
  }
  const detail = dataTexture(detailBytes, n, 'sirocco-ground-detail', true);
  const slope = dataTexture(slopeBytes, n, 'sirocco-ground-slope', true);
  const material = new T.MeshStandardMaterial({map: detail, roughnessMap: detail,
    normalMap: slope, roughness: .9, metalness: 0});
  material.name = 'dry-sandstone-ground'; material.normalScale.setScalar(.55);
  const uniforms = {uGroundMask: {value: mask}, uGroundDetail: {value: detail}, uGroundDebug: {value: 0}};
  material.onBeforeCompile = shader => {
    Object.assign(shader.uniforms, uniforms);
    shader.vertexShader = shader.vertexShader.replace('#include <common>', '#include <common>\nvarying vec2 vGroundXZ;')
      .replace('#include <begin_vertex>', '#include <begin_vertex>\nvGroundXZ = (modelMatrix * vec4(position, 1.0)).xz;');
    shader.fragmentShader = shader.fragmentShader.replace('#include <common>', `#include <common>
      uniform sampler2D uGroundMask; uniform sampler2D uGroundDetail; uniform float uGroundDebug;
      varying vec2 vGroundXZ;
      float groundHash(vec2 p) { return fract(sin(dot(p, vec2(127.1,311.7))) * 43758.5453); }
    `).replace('#include <map_fragment>', `
      vec4 gm = texture2D(uGroundMask, (vGroundXZ + 45.0) / 90.0);
      vec4 gd = texture2D(uGroundDetail, vGroundXZ * .25);
      vec2 cell = vGroundXZ / vec2(.85,.55);
      cell.x += mod(floor(cell.y), 2.0) * .5;
      vec2 edge = min(fract(cell), 1.0 - fract(cell)) * vec2(.85,.55);
      float aa = max(fwidth(vGroundXZ.x), fwidth(vGroundXZ.y));
      float joint = 1.0 - smoothstep(.005, .012 + aa, min(edge.x, edge.y));
      float sand = clamp(gm.g * 1.3 + .17 + (gd.g - .5) * .24 - gm.a * .2, 0.0, .94);
      vec3 stone = mix(vec3(.29,.235,.17), vec3(.43,.36,.25), groundHash(floor(cell)));
      stone *= 1.0 - joint * .35 - gd.b * .16;
      vec3 sandColor = vec3(.47,.38,.255) * (.9 + gd.r * .2);
      diffuseColor.rgb = mix(stone, sandColor, sand) * (.93 + gd.r * .14) * (1.0 - gm.b * .18);
      if (uGroundDebug > .5) diffuseColor.rgb = gm.rgb;
    `).replace('#include <roughnessmap_fragment>', `
      float roughnessFactor = mix(.78, .97, sand) - gm.a * .04;
    `).replace('#include <normal_fragment_maps>', `#include <normal_fragment_maps>
      normal = normalize(mix(normal, normalize(vNormal), sand * .55));
    `);
  };
  material.customProgramCacheKey = () => 'sirocco-ground-mask-v1';
  const geometry = new T.PlaneGeometry(size, size); geometry.rotateX(-Math.PI / 2);
  const p = geometry.attributes.position, uv = geometry.attributes.uv;
  for (let i = 0; i < p.count; i++) uv.setXY(i, p.getX(i) * .25, p.getZ(i) * .25);
  const mesh = new T.Mesh(geometry, material); mesh.name = 'sirocco-dry-ground';
  mesh.receiveShadow = true;
  function sample(x, z, channel) {
    const u = Math.max(0, Math.min(resolution - 1.001, (x - origin) / size * resolution - .5));
    const v = Math.max(0, Math.min(resolution - 1.001, (z - origin) / size * resolution - .5));
    const ix = Math.floor(u), iz = Math.floor(v), a = u - ix, b = v - iz;
    const offset = (iz * resolution + ix) * 4 + channel, stride = resolution * 4;
    return ((bytes[offset] * (1-a) + bytes[offset+4] * a) * (1-b) +
      (bytes[offset+stride] * (1-a) + bytes[offset+stride+4] * a) * b) / 255;
  }
  const stats = {maskResolution: resolution, detailResolution: n, textures: 3,
    maskChannels: ['relief', 'sand deposit', 'base grime', 'foot traffic'],
    extent: [origin, origin, -origin, -origin], physicalDisplacement: false, dry: true};
  mesh.userData.ground = stats;
  return {mesh, stats, mask, detail, slope, sample,
    surfaceAt: (x,z) => sample(x,z,1) > .42 ? 'dirt' : 'concrete',
    isPuddle: () => false, wetnessAt: () => 0,
    setDebug: enabled => {uniforms.uGroundDebug.value = enabled ? 1 : 0;}, update() {}};
}
