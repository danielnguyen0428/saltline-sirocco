// Kiểm chứng bundle đã phục hồi, không sửa game.js.
// Các fixture relay dùng vị trí/invulnerability để cô lập luật tương tác.
const frame = document.querySelector('#game');
const output = document.querySelector('#result');
const report = { mode: 'controlled-runtime-smoke', checks: [], observations: {}, limitations: [
  'Synthetic key events and explicit player placement; not a natural end-to-end win.',
  'Audio disabled in this fixture; mobile touch and gamepad not exercised.'
] };
const wait = ms => new Promise(resolve => setTimeout(resolve, ms));
const until = async (fn, timeout = 15000) => {
  const deadline = performance.now() + timeout;
  while (!fn()) {
    if (performance.now() > deadline) throw Error('Timed out waiting for game state');
    await wait(50);
  }
};
const check = (name, passed, detail) => {
  report.checks.push({ name, passed: !!passed, detail });
  output.textContent = JSON.stringify(report, null, 2);
  if (!passed) throw Error(name);
};
async function run() {
  const w = frame.contentWindow;
  await until(() => w.__ready || w.__fatal, 45000);
  const g = w.__G;
  check('boot', w.__ready && !w.__fatal, { fatal: w.__fatal, state: g?.game.state });
  check('three-r180', g.THREE.REVISION === '180', g.THREE.REVISION);
  check('modules-without-fallback', !['mats','level','ground','backdrop','fx','weapon','enemies','hud'].some(k => g[k].stub), null);
  report.observations.renderer = w.__stats();
  report.observations.viewport = { width: w.innerWidth, height: w.innerHeight };
  const gl = g.renderer.getContext();
  report.observations.webgl = gl.getParameter(gl.VERSION);
  const key = (code, down) => w.dispatchEvent(new w.KeyboardEvent(down ? 'keydown' : 'keyup', {code, bubbles: true}));
  const hold = async (code, ms) => { key(code, true); await wait(ms); key(code, false); await wait(100); };
  g.game.start({ skipIntro: true });
  g.player.invulnerable = true;
  await until(() => g.game.state === 'playing');
  check('initial-state', g.game.run.cut === 0 && g.weapon.ammo === 30 && g.player.health === 100,
    { relays: g.game.run.cut, ammo: g.weapon.ammo, reserve: g.weapon.reserve });
  const before = g.player.pos.clone();
  key('KeyW', true);
  await until(() => g.player.pos.distanceTo(before) > 0.8);
  key('KeyW', false);
  check('movement', g.player.pos.distanceTo(before) > 0.5, { distance: g.player.pos.distanceTo(before) });
  const ammo = g.weapon.ammo;
  key('Enter', true);
  await until(() => g.weapon.ammo < ammo);
  key('Enter', false);
  check('fire', g.weapon.ammo < ammo && g.combat.stats.shots > 0,
    { before: ammo, after: g.weapon.ammo, shots: g.combat.stats.shots });
  await hold('KeyR', 80);
  await until(() => g.weapon.ammo === 30);
  check('reload', g.weapon.reserve < 150, { ammo: g.weapon.ammo, reserve: g.weapon.reserve });
  g.game.pause();
  const pausedTime = g.game.run.time;
  await wait(300);
  check('pause-freezes-mission', g.game.state === 'paused' && g.game.run.time === pausedTime, null);
  g.game.resume();
  await until(() => g.game.state === 'playing');
  check('resume', true, null);

  // Cô lập vị trí và hướng nhìn; giữ nguyên update/game/input/relay của bundle.
  g.player.enabled = false;
  g.player.vel.set(0, 0, 0);
  const relay = g.game.run.relays[0];
  g.player.pos.copy(relay.o.pos).add(new g.THREE.Vector3(0, 0, 1.5));
  g.player.yaw = Math.PI;
  g.player.pitch = 0;
  g.player.forward.set(0, 0, 1);
  await hold('KeyE', 400);
  check('relay-rejects-facing-away', relay.t === 0 && !relay.cut, { progress: relay.t });
  g.player.yaw = 0;
  g.player.forward.set(0, 0, -1);
  key('KeyE', true);
  await until(() => relay.t > 0.15);
  key('KeyE', false);
  check('relay-partial-hold', relay.t > 0 && relay.t < 1 && !relay.cut, { progress: relay.t });
  await until(() => relay.t === 0);
  check('relay-release-decays', !relay.cut, { progress: relay.t });
  for (const r of g.game.run.relays) {
    g.player.pos.copy(r.o.pos).add(new g.THREE.Vector3(0, 0, 1.5));
    g.player.yaw = 0;
    g.player.forward.set(0, 0, -1);
    key('KeyE', true);
    await until(() => r.cut);
    key('KeyE', false);
    await wait(80);
    check('relay-cut-' + r.short, r.cut, { cut: g.game.run.cut });
  }
  check('all-relays-unlock-extraction', g.game.run.allCut && g.game.state === 'playing', { cut: g.game.run.cut });
  g.player.pos.copy(g.level.extraction.pos);
  await until(() => g.game.state === 'complete');
  check('extraction-completes-mission', true, { state: g.game.state });
  g.game.start({ skipIntro: true });
  check('restart-resets-run', g.game.run.cut === 0 && !g.game.run.allCut && g.player.health === 100 && g.weapon.ammo === 30, null);
  g.player.damage(1000, null);
  check('lethal-damage', g.game.state === 'dead' && !g.player.alive, { health: g.player.health });
  await until(() => g.game.menus.screen === 'dead');
  const retry = w.document.querySelector('button[data-act="retry"]');
  check('retry-button-exists', !!retry, null);
  retry.click();
  await until(() => g.game.state === 'playing');
  check('retry-restores-run', g.player.health === 100 && g.game.run.retries === 1 && g.game.run.cut === 0, { retries: g.game.run.retries });
  report.observations.finalRenderer = w.__stats();
  report.observations.errors = [...w.__errors];
  check('no-game-errors', w.__errors.length === 0, w.__errors);
  g.game.pause();
  report.status = 'passed';
}
run().catch(error => {
  report.status = 'failed';
  report.error = String(error.stack || error);
  const g = frame.contentWindow.__G;
  report.failureState = g && { state: g.game.state, pos: g.player.pos, forward: g.player.forward, enabled: g.player.enabled, interact: g.input.down('interact'), relays: g.game.run.relays.map(r => ({ id: r.id, t: r.t, pos: r.o.pos })) };
}).finally(() => {
  output.textContent = JSON.stringify(report, null, 2);
  output.dataset.status = report.status;
  document.title = `Saltline verification: ${report.status}`;
});
