// Porto Alba — synthesised sound. Every sound is built from oscillators and
// filtered noise in WebAudio: no audio files, nothing fetched. Audio starts
// only after the player clicks Play (browsers require a gesture); in shot
// mode the game runs silent and nothing here can throw.

export function createAudio() {
  let ctx = null;
  let master = null;
  let engineOsc = null;
  let engineGain = null;
  let sirenOsc = null;
  let sirenGain = null;
  let sirenTimer = 0;
  let musicTimer = null;
  let musicStep = 0;
  let started = false;

  function ensure() {
    if (ctx) return true;
    try {
      const AC = window.AudioContext || window.webkitAudioContext;
      if (!AC) return false;
      ctx = new AC();
      master = ctx.createGain();
      master.gain.value = 0.5;
      master.connect(ctx.destination);
      return true;
    } catch (e) {
      return false;
    }
  }

  function startEngine() {
    if (!ctx || engineOsc) return;
    engineOsc = ctx.createOscillator();
    engineOsc.type = 'sawtooth';
    engineOsc.frequency.value = 55;
    const filter = ctx.createBiquadFilter();
    filter.type = 'lowpass';
    filter.frequency.value = 420;
    engineGain = ctx.createGain();
    engineGain.gain.value = 0.0;
    engineOsc.connect(filter);
    filter.connect(engineGain);
    engineGain.connect(master);
    engineOsc.start();
  }

  function startSiren() {
    if (!ctx || sirenOsc) return;
    sirenOsc = ctx.createOscillator();
    sirenOsc.type = 'sine';
    sirenOsc.frequency.value = 720;
    sirenGain = ctx.createGain();
    sirenGain.gain.value = 0.0;
    sirenOsc.connect(sirenGain);
    sirenGain.connect(master);
    sirenOsc.start();
  }

  // A short bass-and-hat groove, scheduled step by step. 8 steps a bar,
  // 132 bpm. Nothing but oscillators: kick is a pitch-dropping sine, the
  // hat is short high-passed noise, the bass is a square wave.
  function startMusic() {
    if (!ctx || musicTimer) return;
    const stepDur = 60 / 132 / 2;
    const bassNotes = [55, 0, 55, 65.4, 55, 0, 49, 58.3];
    musicTimer = window.setInterval(() => {
      if (!ctx || ctx.state !== 'running') return;
      const step = musicStep % 8;
      const t = ctx.currentTime + 0.02;
      // Kick on 0 and 4.
      if (step === 0 || step === 4) {
        const o = ctx.createOscillator();
        o.type = 'sine';
        o.frequency.setValueAtTime(120, t);
        o.frequency.exponentialRampToValueAtTime(38, t + 0.12);
        const g = ctx.createGain();
        g.gain.setValueAtTime(0.5, t);
        g.gain.exponentialRampToValueAtTime(0.001, t + 0.14);
        o.connect(g); g.connect(master);
        o.start(t); o.stop(t + 0.16);
      }
      // Hat on every off-beat.
      if (step % 2 === 1) {
        const len = Math.floor(ctx.sampleRate * 0.04);
        const buf = ctx.createBuffer(1, len, ctx.sampleRate);
        const d = buf.getChannelData(0);
        for (let i = 0; i < len; i++) d[i] = (Math.random() * 2 - 1) * (1 - i / len);
        const src = ctx.createBufferSource();
        src.buffer = buf;
        const f = ctx.createBiquadFilter();
        f.type = 'highpass'; f.frequency.value = 6000;
        const g = ctx.createGain();
        g.gain.value = 0.12;
        src.connect(f); f.connect(g); g.connect(master);
        src.start(t);
      }
      // Bass note.
      const note = bassNotes[step];
      if (note > 0) {
        const o = ctx.createOscillator();
        o.type = 'square';
        o.frequency.value = note;
        const f = ctx.createBiquadFilter();
        f.type = 'lowpass'; f.frequency.value = 300;
        const g = ctx.createGain();
        g.gain.setValueAtTime(0.16, t);
        g.gain.exponentialRampToValueAtTime(0.001, t + stepDur * 0.95);
        o.connect(f); f.connect(g); g.connect(master);
        o.start(t); o.stop(t + stepDur);
      }
      musicStep++;
    }, stepDur * 1000);
  }

  function blip(freq, dur, type, vol, slideTo) {
    if (!ctx) return;
    try {
      const t = ctx.currentTime;
      const o = ctx.createOscillator();
      o.type = type || 'sine';
      o.frequency.setValueAtTime(freq, t);
      if (slideTo) o.frequency.exponentialRampToValueAtTime(slideTo, t + dur);
      const g = ctx.createGain();
      g.gain.setValueAtTime(vol || 0.25, t);
      g.gain.exponentialRampToValueAtTime(0.001, t + dur);
      o.connect(g); g.connect(master);
      o.start(t); o.stop(t + dur + 0.02);
    } catch (e) { /* audio is best-effort */ }
  }

  function noiseBurst(dur, vol, filterFreq) {
    if (!ctx) return;
    try {
      const t = ctx.currentTime;
      const len = Math.floor(ctx.sampleRate * dur);
      const buf = ctx.createBuffer(1, len, ctx.sampleRate);
      const d = buf.getChannelData(0);
      for (let i = 0; i < len; i++) d[i] = (Math.random() * 2 - 1) * (1 - i / len);
      const src = ctx.createBufferSource();
      src.buffer = buf;
      const f = ctx.createBiquadFilter();
      f.type = 'lowpass'; f.frequency.value = filterFreq || 1200;
      const g = ctx.createGain();
      g.gain.value = vol || 0.3;
      src.connect(f); f.connect(g); g.connect(master);
      src.start(t);
    } catch (e) { /* audio is best-effort */ }
  }

  return {
    // Called on the Play click. Safe to call repeatedly; starts once.
    unlock() {
      if (started) return;
      started = true;
      if (!ensure()) return;
      if (ctx.state === 'suspended') ctx.resume().catch(() => {});
      startEngine();
      startSiren();
      startMusic();
    },
    // Per-frame: engine pitch follows driving speed, siren wails with wanted.
    update(dt, speedNorm, wanted) {
      if (!ctx || !engineOsc) return;
      try {
        if (ctx.state !== 'running') return;
        engineGain.gain.setTargetAtTime(0.05 + speedNorm * 0.11, ctx.currentTime, 0.08);
        engineOsc.frequency.setTargetAtTime(52 + speedNorm * 130, ctx.currentTime, 0.08);
        const target = wanted > 0 ? 0.05 : 0.0;
        sirenGain.gain.setTargetAtTime(target, ctx.currentTime, 0.2);
        sirenTimer += dt;
        if (wanted > 0 && sirenTimer > 0.55) {
          sirenTimer = 0;
          sirenOsc.frequency.value = sirenOsc.frequency.value > 800 ? 660 : 920;
        }
      } catch (e) { /* audio is best-effort */ }
    },
    pickup() { blip(660, 0.14, 'sine', 0.3, 990); },
    missionDone() {
      blip(523, 0.16, 'triangle', 0.3);
      window.setTimeout(() => blip(659, 0.16, 'triangle', 0.3), 140);
      window.setTimeout(() => blip(784, 0.3, 'triangle', 0.32), 280);
    },
    gunshot() { noiseBurst(0.12, 0.5, 2600); },
    punch() { noiseBurst(0.08, 0.35, 700); },
    crash() { noiseBurst(0.25, 0.5, 500); },
    busted() { blip(220, 0.5, 'sawtooth', 0.25, 110); },
    click() { blip(880, 0.06, 'square', 0.12); },
  };
}
