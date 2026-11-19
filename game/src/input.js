// Keyboard input: held keys are read every frame, action keys fire once per
// press. WASD and arrows both drive; E steals a car, Space shoves, P pauses,
// M mutes, Enter/Space confirms on the title screen.

export const ACTION_CONFIRM = 1 << 0;
export const ACTION_PAUSE = 1 << 1;
export const ACTION_STEAL = 1 << 2;
export const ACTION_SHOVE = 1 << 3;
export const ACTION_MUTE = 1 << 4;

const ACTION_KEYS = {
  Enter: ACTION_CONFIRM,
  KeyP: ACTION_PAUSE,
  KeyE: ACTION_STEAL,
  KeyF: ACTION_STEAL,
  Space: ACTION_SHOVE,
  KeyM: ACTION_MUTE,
};

export function createInput(canvas) {
  const held = new Set();
  let queued = 0;

  function onKeyDown(event) {
    if (['ArrowUp', 'ArrowDown', 'ArrowLeft', 'ArrowRight', 'Space'].includes(event.code)) {
      event.preventDefault();
    }
    if (event.repeat) return;
    held.add(event.code);
    const action = ACTION_KEYS[event.code];
    if (action) queued |= action;
  }

  function onKeyUp(event) {
    held.delete(event.code);
  }

  function onBlur() {
    held.clear();
  }

  window.addEventListener('keydown', onKeyDown);
  window.addEventListener('keyup', onKeyUp);
  window.addEventListener('blur', onBlur);
  canvas.addEventListener('click', () => {
    queued |= ACTION_CONFIRM;
    canvas.focus();
  });

  return {
    /** Steering -1 (left) .. 1 (right) from the held keys. */
    steer() {
      const left = held.has('ArrowLeft') || held.has('KeyA');
      const right = held.has('ArrowRight') || held.has('KeyD');
      return (right ? 1 : 0) - (left ? 1 : 0);
    },
    /** Throttle 0..1. */
    throttle() {
      return held.has('ArrowUp') || held.has('KeyW') ? 1 : 0;
    },
    /** Brake / reverse 0..1. */
    brake() {
      return held.has('ArrowDown') || held.has('KeyS') ? 1 : 0;
    },
    /** Run modifier: Shift doubles the walking speed. */
    running() {
      return held.has('ShiftLeft') || held.has('ShiftRight');
    },
    /** Actions pressed since the last call, then cleared. */
    takeActions() {
      const actions = queued;
      queued = 0;
      return actions;
    },
    dispose() {
      window.removeEventListener('keydown', onKeyDown);
      window.removeEventListener('keyup', onKeyUp);
      window.removeEventListener('blur', onBlur);
    },
  };
}
