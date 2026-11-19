// Porto Alba — audio.js
// Synthesized WebAudio sound: engine hum, siren, pickup blip, gunshot.
// No audio files anywhere — every sound is built from oscillators and noise
// at run time. All calls are safe before the context exists (for example in
// a headless screenshot run with no user gesture yet).

/** Create the audio engine on G. Safe to call before any user gesture. */
export function initAudio(G) {
  if (G.audio && G.audio.ctx) return G.audio;
  const audio = {
    ctx: null,
    master: null,
    engineOsc: null,
    engineGain: null,
  };
  try {
    const Ctx = window.AudioContext || window.webkitAudioContext;
    if (!Ctx) {
      G.audio = audio;
      return audio;
    }
    const ctx = new Ctx();
    audio.ctx = ctx;
    audio.master = ctx.createGain();
    audio.master.gain.value = 0.35;
    audio.master.connect(ctx.destination);
    // Engine hum: a low sawtooth whose pitch follows the player's speed.
    audio.engineOsc = ctx.createOscillator();
    audio.engineOsc.type = 'sawtooth';
    audio.engineOsc.frequency.value = 55;
    audio.engineGain = ctx.createGain();
    audio.engineGain.gain.value = 0.0;
    const engineFilter = ctx.createBiquadFilter();
    engineFilter.type = 'lowpass';
    engineFilter.frequency.value = 320;
    audio.engineOsc.connect(engineFilter);
    engineFilter.connect(audio.engineGain);
    audio.engineGain.connect(audio.master);
    audio.engineOsc.start();
    // Follow the speed on a timer — no per-frame hook needed.
    setInterval(() => {
      if (!audio.ctx || G.paused) return;
      const speed = Math.abs(G.player?.speed || 0);
      const driving = G.player && !G.player.onFoot;
      audio.engineOsc.frequency.value = 55 + speed * 2.2;
      audio.engineGain.gain.value = driving ? 0.05 + Math.min(0.06, speed * 0.0015) : 0.0;
    }, 120);
  } catch {
    // Headless or blocked audio: the game plays on silently.
    audio.ctx = null;
  }
  // Bind the one-word sound helpers onto the audio object itself, so every
  // system can call G.audio.blip() / .siren() / .gunshot() directly.
  audio.blip = () => blip(G);
  audio.siren = () => siren(G);
  audio.gunshot = () => gunshot(G);
  G.audio = audio;
  return audio;
}

/** Short helper: one oscillator burst with an exponential decay. */
function tone(audio, type, from, to, seconds, volume) {
  if (!audio.ctx) return;
  const ctx = audio.ctx;
  const osc = ctx.createOscillator();
  const gain = ctx.createGain();
  osc.type = type;
  osc.frequency.setValueAtTime(from, ctx.currentTime);
  osc.frequency.exponentialRampToValueAtTime(Math.max(1, to), ctx.currentTime + seconds);
  gain.gain.setValueAtTime(volume, ctx.currentTime);
  gain.gain.exponentialRampToValueAtTime(0.001, ctx.currentTime + seconds);
  osc.connect(gain);
  gain.connect(audio.master);
  osc.start();
  osc.stop(ctx.currentTime + seconds);
}

/** White-noise burst for the gunshot crack. */
function noiseBurst(audio, seconds, volume) {
  if (!audio.ctx) return;
  const ctx = audio.ctx;
  const length = Math.floor(ctx.sampleRate * seconds);
  const buffer = ctx.createBuffer(1, length, ctx.sampleRate);
  const data = buffer.getChannelData(0);
  for (let i = 0; i < length; i++) data[i] = (Math.random() * 2 - 1) * (1 - i / length);
  const src = ctx.createBufferSource();
  src.buffer = buffer;
  const gain = ctx.createGain();
  gain.gain.value = volume;
  src.connect(gain);
  gain.connect(audio.master);
  src.start();
}

/** Pickup / mission-complete blip: two rising sine notes. */
export function blip(G) {
  const audio = G.audio;
  if (!audio) return;
  tone(audio, 'sine', 660, 660, 0.09, 0.25);
  setTimeout(() => tone(audio, 'sine', 990, 990, 0.14, 0.25), 90);
}

/** Police siren: a two-tone wail, up then down. */
export function siren(G) {
  const audio = G.audio;
  if (!audio) return;
  tone(audio, 'triangle', 620, 920, 0.45, 0.16);
  setTimeout(() => tone(audio, 'triangle', 920, 620, 0.45, 0.16), 450);
}

/** Gunshot: noise crack plus a low thump. */
export function gunshot(G) {
  const audio = G.audio;
  if (!audio) return;
  noiseBurst(audio, 0.12, 0.5);
  tone(audio, 'square', 160, 60, 0.1, 0.2);
}

// Bound helpers so other systems can call G.audio.blip() directly.
export function bindAudioHelpers(G) {
  if (!G.audio) return;
  G.audio.blip = () => blip(G);
  G.audio.siren = () => siren(G);
  G.audio.gunshot = () => gunshot(G);
}
