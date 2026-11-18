// Porto Alba — keyboard and mouse input. Tracks held keys, edge-triggered
// presses (consumed by the game loop), and a drag-to-orbit camera.

export function createInput(canvas) {
  const keys = new Set();
  const pressed = new Set();
  let lookDX = 0, lookDY = 0;
  let dragging = false;
  let lastX = 0, lastY = 0;
  let mouseDown = false;
  let mouseClicked = false;

  function code(e) {
    return e.code;
  }

  window.addEventListener('keydown', (e) => {
    if (e.target && (e.target.tagName === 'INPUT' || e.target.tagName === 'TEXTAREA')) return;
    if (!keys.has(code(e))) pressed.add(code(e));
    keys.add(code(e));
    if (['Space', 'ArrowUp', 'ArrowDown', 'ArrowLeft', 'ArrowRight'].includes(code(e))) {
      e.preventDefault();
    }
  });
  window.addEventListener('keyup', (e) => keys.delete(code(e)));
  window.addEventListener('blur', () => { keys.clear(); dragging = false; });

  canvas.addEventListener('mousedown', (e) => {
    dragging = true; mouseDown = true;
    lastX = e.clientX; lastY = e.clientY;
  });
  window.addEventListener('mouseup', (e) => {
    dragging = false;
    if (mouseDown && Math.abs(e.clientX - lastX) < 5 && Math.abs(e.clientY - lastY) < 5) {
      mouseClicked = true;
    }
    mouseDown = false;
  });
  window.addEventListener('mousemove', (e) => {
    if (!dragging) return;
    lookDX += e.clientX - lastX;
    lookDY += e.clientY - lastY;
    lastX = e.clientX; lastY = e.clientY;
  });

  return {
    // Held keys.
    held(name) { return keys.has(name); },
    // True once, on the frame the key went down. Consumed by endFrame().
    wasPressed(name) { return pressed.has(name); },
    // Mouse orbit deltas since last frame (pixels). Consumed by endFrame().
    takeLook() {
      const d = { dx: lookDX, dy: lookDY };
      lookDX = 0; lookDY = 0;
      return d;
    },
    // True once when the mouse was clicked (not dragged). Consumed by endFrame().
    takeClick() {
      const c = mouseClicked;
      mouseClicked = false;
      return c;
    },
    // Movement axes: -1..1, camera-relative.
    moveAxis() {
      let x = 0, z = 0;
      if (keys.has('KeyW') || keys.has('ArrowUp')) z -= 1;
      if (keys.has('KeyS') || keys.has('ArrowDown')) z += 1;
      if (keys.has('KeyA') || keys.has('ArrowLeft')) x -= 1;
      if (keys.has('KeyD') || keys.has('ArrowRight')) x += 1;
      return { x, z };
    },
    sprint() { return keys.has('ShiftLeft') || keys.has('ShiftRight'); },
    endFrame() { pressed.clear(); },
  };
}
