// The HUD: wanted stars, the current objective, a mission banner, speed and
// cash, plus a high-contrast minimap with a player arrow. Screens (title,
// paused, game over) live here too, so the boot loop only ever asks the HUD
// to show one.

import { PALETTE, WORLD } from './config.js';
import { starsText } from './wanted.js';

export const SCREEN_TITLE = 'title';
export const SCREEN_PLAY = 'play';
export const SCREEN_PAUSED = 'paused';
export const SCREEN_OVER = 'over';

export function createHud(doc) {
  const root = doc.getElementById('hud');
  const starsEl = doc.getElementById('wanted');
  const objectiveEl = doc.getElementById('objective');
  const bannerEl = doc.getElementById('banner');
  const speedEl = doc.getElementById('speed');
  const cashEl = doc.getElementById('cash');
  const map = doc.getElementById('minimap');
  const mapCtx = map.getContext('2d');
  const status = doc.getElementById('status');
  const screens = {
    [SCREEN_TITLE]: doc.getElementById('screen-title'),
    [SCREEN_PAUSED]: doc.getElementById('screen-paused'),
    [SCREEN_OVER]: doc.getElementById('screen-over'),
  };
  let bannerTimer = 0;

  function showScreen(name) {
    for (const [key, el] of Object.entries(screens)) {
      if (el) el.hidden = key !== name;
    }
    root.classList.toggle('playing', name === SCREEN_PLAY || name === SCREEN_PAUSED);
  }

  return {
    showScreen,
    setStars(stars) {
      starsEl.textContent = starsText(stars);
      starsEl.classList.toggle('hot', stars >= 2);
    },
    setObjective(text) {
      objectiveEl.textContent = `JOB — ${text}`;
    },
    setSpeed(kmh) {
      speedEl.textContent = `${Math.round(kmh)} km/h`;
    },
    setCash(cash) {
      cashEl.textContent = `$${cash.toLocaleString('en-US')}`;
    },
    banner(text, seconds = 3) {
      bannerEl.textContent = text;
      bannerEl.hidden = false;
      bannerTimer = seconds;
    },
    tickBanner(dt) {
      if (bannerTimer > 0) {
        bannerTimer -= dt;
        if (bannerTimer <= 0) bannerEl.hidden = true;
      }
    },
    announce(message) {
      status.textContent = message;
    },
    /**
     * High-contrast minimap: near-black ground, bright roads, the player as a
     * white arrow, the objective as a gold ring, police as red dots.
     */
    drawMinimap(state) {
      const size = map.width;
      const scale = size / (WORLD.half * 2 + 40);
      const toMap = (x, z) => [(x + WORLD.half + 20) * scale, (z + WORLD.half + 20) * scale];
      mapCtx.fillStyle = '#0c1018';
      mapCtx.fillRect(0, 0, size, size);
      mapCtx.strokeStyle = '#5a6272';
      mapCtx.lineWidth = 3;
      for (const axis of state.axes) {
        const [x1, y1] = toMap(axis, -WORLD.half - 20);
        const [x2, y2] = toMap(axis, WORLD.half + 20);
        mapCtx.beginPath();
        mapCtx.moveTo(x1, y1);
        mapCtx.lineTo(x2, y2);
        mapCtx.stroke();
        const [x3, y3] = toMap(-WORLD.half - 20, axis);
        const [x4, y4] = toMap(WORLD.half + 20, axis);
        mapCtx.beginPath();
        mapCtx.moveTo(x3, y3);
        mapCtx.lineTo(x4, y4);
        mapCtx.stroke();
      }
      // Objective beacon: a pulsing gold ring (pulse from sim time, so it is deterministic).
      const [ox, oy] = toMap(state.objective.x, state.objective.z);
      const pulse = 6 + 2 * Math.sin(state.time * 3);
      mapCtx.strokeStyle = PALETTE.hudAccent;
      mapCtx.lineWidth = 2;
      mapCtx.beginPath();
      mapCtx.arc(ox, oy, pulse, 0, Math.PI * 2);
      mapCtx.stroke();
      mapCtx.fillStyle = PALETTE.hudAccent;
      mapCtx.beginPath();
      mapCtx.arc(ox, oy, 2.5, 0, Math.PI * 2);
      mapCtx.fill();
      // Police as red dots.
      mapCtx.fillStyle = '#ff4d4d';
      for (const cop of state.police) {
        if (!cop.active) continue;
        const [px, py] = toMap(cop.x, cop.z);
        mapCtx.beginPath();
        mapCtx.arc(px, py, 3, 0, Math.PI * 2);
        mapCtx.fill();
      }
      // The target car as a teal dot.
      if (state.target && !state.targetTaken) {
        const [tx, ty] = toMap(state.target.x, state.target.z);
        mapCtx.fillStyle = '#18b5a6';
        mapCtx.beginPath();
        mapCtx.arc(tx, ty, 3.5, 0, Math.PI * 2);
        mapCtx.fill();
      }
      // The player as a white arrow, rotated by heading. The canvas y axis
      // points down like the world's +z, so the arrow turns by (PI - heading).
      const [px, py] = toMap(state.player.x, state.player.z);
      mapCtx.save();
      mapCtx.translate(px, py);
      mapCtx.rotate(Math.PI - state.player.heading);
      mapCtx.fillStyle = '#ffffff';
      mapCtx.beginPath();
      mapCtx.moveTo(0, -7);
      mapCtx.lineTo(5, 6);
      mapCtx.lineTo(-5, 6);
      mapCtx.closePath();
      mapCtx.fill();
      mapCtx.restore();
    },
  };
}
