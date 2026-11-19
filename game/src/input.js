// Porto Alba — input.js
// Keyboard + mouse input. WASD/arrows drive and walk, E steals/interacts,
// P or F pauses, R reloads, Space is the handbrake, mouse drag orbits the
// camera and click fires the pistol. One clear job: reading the player.

/** Attach all listeners and return the live input state. */
export function initInput(G) {
  const input = {
    keys: {},
    orbitDelta: 0, // accumulated mouse-drag orbit, consumed by the camera
    dragging: false,
    lastX: 0,
  };
  G.input = input;

  window.addEventListener('keydown', (e) => {
    if (e.repeat) return;
    // Arrows and Space would scroll the page — the game owns those keys.
    if (['ArrowUp', 'ArrowDown', 'ArrowLeft', 'ArrowRight', 'Space'].includes(e.code)) e.preventDefault();
    input.keys[e.code] = true;
    if (e.code === 'KeyE') G.queueSteal = true;
    if (e.code === 'KeyP' || e.code === 'KeyF') G.togglePause();
    if (e.code === 'KeyR') G.reloadWeapon?.();
    if (e.code === 'Space') e.preventDefault();
    if (e.code === 'Enter' && G.onStartScreen) G.startGame();
  });

  window.addEventListener('keyup', (e) => {
    input.keys[e.code] = false;
  });

  // Mouse drag orbits the chase camera; a click (no drag) fires the pistol.
  const canvas = G.renderer.domElement;
  let downX = 0;
  let downY = 0;
  let moved = false;
  canvas.addEventListener('mousedown', (e) => {
    input.dragging = true;
    moved = false;
    downX = e.clientX;
    downY = e.clientY;
    input.lastX = e.clientX;
  });
  window.addEventListener('mousemove', (e) => {
    if (!input.dragging) return;
    const dx = e.clientX - input.lastX;
    input.lastX = e.clientX;
    input.orbitDelta += dx * 0.005;
    if (Math.abs(e.clientX - downX) + Math.abs(e.clientY - downY) > 6) moved = true;
  });
  window.addEventListener('mouseup', (e) => {
    if (input.dragging && !moved && G.started && !G.paused) G.fireWeapon?.(e.clientX, e.clientY);
    input.dragging = false;
  });

  // Keep focus so keys keep working after a click on the HUD.
  window.addEventListener('blur', () => {
    input.keys = {};
  });

  return input;
}

/** True while any of the given codes is held. */
export function anyDown(G, ...codes) {
  return codes.some((c) => G.input.keys[c]);
}

/** Driving throttle: +1 forward (W/Up), -1 reverse (S/Down). */
export function throttleInput(G) {
  let t = 0;
  if (G.input.keys.KeyW || G.input.keys.ArrowUp) t += 1;
  if (G.input.keys.KeyS || G.input.keys.ArrowDown) t -= 1;
  return t;
}

/** Steering: -1 left (A/Left), +1 right (D/Right). */
export function steerInput(G) {
  let s = 0;
  if (G.input.keys.KeyA || G.input.keys.ArrowLeft) s -= 1;
  if (G.input.keys.KeyD || G.input.keys.ArrowRight) s += 1;
  return s;
}
