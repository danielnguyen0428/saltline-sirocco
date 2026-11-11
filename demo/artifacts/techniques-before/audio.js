// Reuse the recovered synthesis recipes without Saltline's rain/sea/music buses.
export function createAudio(g) {
  let ctx, master, muted = false, paused = false;
  const buffers = new Map(), active = new Set();
  const stats = { played: 0, failed: 0 };
  function init() {
    if (!ctx) {
      ctx = new (window.AudioContext || window.webkitAudioContext)();
      master = ctx.createGain(); master.gain.value = .48; master.connect(ctx.destination);
    }
    return ctx;
  }
  function play(name, options = {}) {
    if (!ctx || ctx.state !== 'running' || paused || muted || active.size > 20) return false;
    let buffer = buffers.get(name);
    if (!buffer) {
      const data = window.SaltlineEngine.synthesize(name, 0);
      if (!data) { stats.failed++; return false; }
      buffer = ctx.createBuffer(data.ch.length, data.ch[0].length, data.sr);
      data.ch.forEach((channel, i) => buffer.copyToChannel(channel, i));
      buffers.set(name, buffer);
    }
    const source = ctx.createBufferSource(), gain = ctx.createGain();
    source.buffer = buffer; source.playbackRate.value = options.pitch || 1;
    let volume = options.gain ?? .5;
    if (options.pos && g.player) volume *= Math.min(1, 7 / Math.max(1, g.player.eye.distanceTo(options.pos)));
    gain.gain.value = volume; source.connect(gain); gain.connect(master);
    active.add(source); source.onended = () => {active.delete(source); source.disconnect(); gain.disconnect();};
    source.start(); stats.played++; return true;
  }
  return {
    play,
    resume() { init(); paused = false; return ctx.resume(); },
    pause(value) { paused = value; if (ctx) value ? ctx.suspend() : ctx.resume(); },
    mute(value) { muted = value; if (master) master.gain.value = value ? 0 : .48; },
    get muted() { return muted; },
    debug() { return {state: ctx?.state || 'uninitialized', muted, paused, buffers: buffers.size, voices: active.size, ...stats}; },
  };
}
