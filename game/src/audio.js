// Sound, synthesized live with WebAudio — no audio assets. An engine hum
// whose pitch follows speed, a two-tone siren while the police are after you,
// and a short blip when a job pays out. The context is created lazily on the
// first user gesture (browsers block audio before that) and suspended on pause.

export function createAudio() {
  let ctx = null;
  let engineOsc = null;
  let engineGain = null;
  let engineFilter = null;
  let sirenOsc = null;
  let sirenGain = null;
  let sirenTimer = null;
  let sirenHigh = false;
  let muted = false;

  function ensure() {
    if (ctx) return true;
    try {
      const AudioCtx = window.AudioContext || window.webkitAudioContext;
      ctx = new AudioCtx();
    } catch {
      return false;
    }
    engineOsc = ctx.createOscillator();
    engineOsc.type = 'sawtooth';
    engineOsc.frequency.value = 55;
    engineFilter = ctx.createBiquadFilter();
    engineFilter.type = 'lowpass';
    engineFilter.frequency.value = 420;
    engineGain = ctx.createGain();
    engineGain.gain.value = 0;
    engineOsc.connect(engineFilter).connect(engineGain).connect(ctx.destination);
    engineOsc.start();

    sirenOsc = ctx.createOscillator();
    sirenOsc.type = 'triangle';
    sirenOsc.frequency.value = 720;
    sirenGain = ctx.createGain();
    sirenGain.gain.value = 0;
    sirenOsc.connect(sirenGain).connect(ctx.destination);
    sirenOsc.start();
    return true;
  }

  return {
    /** Call from a user gesture; safe to call any time. */
    init() {
      if (ensure() && ctx.state === 'suspended') void ctx.resume();
    },
    setMuted(value) {
      muted = value;
      if (ctx) {
        if (muted) {
          if (engineGain) engineGain.gain.value = 0;
          if (sirenGain) sirenGain.gain.value = 0;
        } else {
          void ctx.resume();
        }
      }
    },
    isMuted() {
      return muted;
    },
    /** Engine hum follows how fast the player is moving, 0..1. */
    setEngine(speed01) {
      if (!ctx || muted) {
        if (engineGain) engineGain.gain.value = 0;
        return;
      }
      engineOsc.frequency.value = 55 + speed01 * 130;
      engineFilter.frequency.value = 420 + speed01 * 900;
      engineGain.gain.value = 0.03 + speed01 * 0.05;
    },
    /** Two-tone siren while wanted; call with false to silence it. */
    siren(on) {
      if (!ctx) return;
      if (!on) {
        sirenGain.gain.value = 0;
        if (sirenTimer) {
          clearInterval(sirenTimer);
          sirenTimer = null;
        }
        return;
      }
      if (muted) {
        sirenGain.gain.value = 0;
        return;
      }
      sirenGain.gain.value = 0.035;
      if (sirenTimer) return;
      sirenTimer = setInterval(() => {
        sirenHigh = !sirenHigh;
        sirenOsc.frequency.value = sirenHigh ? 920 : 720;
      }, 380);
    },
    /** Short payout blip when a job completes. */
    blip() {
      if (!ctx || muted) return;
      const osc = ctx.createOscillator();
      const gain = ctx.createGain();
      osc.type = 'sine';
      osc.frequency.value = 880;
      gain.gain.setValueAtTime(0.12, ctx.currentTime);
      gain.gain.exponentialRampToValueAtTime(0.001, ctx.currentTime + 0.25);
      osc.connect(gain).connect(ctx.destination);
      osc.start();
      osc.stop(ctx.currentTime + 0.3);
    },
    suspend() {
      if (ctx && ctx.state === 'running') void ctx.suspend();
    },
    resume() {
      if (ctx && ctx.state === 'suspended' && !muted) void ctx.resume();
    },
  };
}
