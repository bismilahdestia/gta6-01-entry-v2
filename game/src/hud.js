// Porto Alba — hud.js
// The HUD: health bar, wanted stars, speed, objective chip, money, ammo and
// the high-contrast minimap. Banners show long in shot mode (30 s, top 9%)
// and briefly in normal play (5 s, 28%). One clear job: what the player sees.

import { CONFIG } from './config.js';
import { starsText } from './wanted.js';
import { speedKmh, clamp } from './util.js';

const MAP_BG = '#232d38';
const MAP_ROAD = '#d7dde5';
const MAP_BUILDING = '#5a6b7d';
const MAP_WATER = '#4aa3d8';

/** Cache the HUD DOM nodes. */
export function initHud(G) {
  const $ = (id) => document.getElementById(id);
  G.hud = {
    healthFill: $('hud-health-fill'),
    healthText: $('hud-health-text'),
    stars: $('hud-stars'),
    speed: $('hud-speed'),
    money: $('hud-money'),
    ammo: $('hud-ammo'),
    objective: $('hud-objective'),
    banner: $('hud-banner'),
    bannerTitle: $('hud-banner-title'),
    bannerText: $('hud-banner-text'),
    minimap: $('hud-minimap'),
    hint: $('hud-hint'),
    saveNote: $('hud-save-note'),
  };
  G.hud.mapCtx = G.hud.minimap.getContext('2d');
  G.bannerTimer = null;
  return G.hud;
}

/** Show the mission banner. Shot mode: 30 s at top 9%; normal: 5 s at 28%. */
export function showBanner(G, title, text) {
  const h = G.hud;
  if (!h || !h.banner) return;
  h.bannerTitle.textContent = title;
  h.bannerText.textContent = text || '';
  h.banner.style.opacity = '1';
  h.banner.style.top = G.shotMode ? '9%' : '28%';
  if (G.bannerTimer) clearTimeout(G.bannerTimer);
  const hold = G.shotMode ? 30000 : 5000;
  G.bannerTimer = setTimeout(() => {
    h.banner.style.opacity = '0';
  }, hold);
}

/** Set the objective chip text (empty hides the chip via CSS). */
export function setObjective(G, text) {
  if (G.hud?.objective) G.hud.objective.textContent = text || '';
}

/** Refresh the numeric HUD once per frame. */
export function updateHud(G) {
  const h = G.hud;
  if (!h) return;
  const hp = clamp(G.player.health, 0, CONFIG.PLAYER_HEALTH);
  h.healthFill.style.width = `${hp}%`;
  h.healthFill.style.background = hp > 50 ? '#3fbf5a' : hp > 25 ? '#e8b13c' : '#d92323';
  h.healthText.textContent = `${Math.round(hp)} HP`;
  h.stars.textContent = starsText(G.wanted ? G.wanted.stars : 0);
  h.stars.style.color = G.wanted && G.wanted.stars > 0 ? '#ffd23c' : '#ffffff';
  const speed = G.player.onFoot ? 0 : Math.abs(G.player.speed || 0);
  h.speed.textContent = G.player.onFoot ? 'ON FOOT' : `${speedKmh(speed)} km/h`;
  h.money.textContent = `$${G.player.money}`;
  h.ammo.textContent = G.weapon ? `AMMO ${G.weapon.ammo}/${G.weapon.magSize}` : '';
  if (G.saveNote && h.saveNote) {
    h.saveNote.textContent = G.saveNote;
    G.saveNote = '';
  }
  drawMinimap(G);
}

/** High-contrast minimap: near-white roads on slate, bright water, clear dots. */
export function drawMinimap(G) {
  const h = G.hud;
  if (!h || !h.mapCtx) return;
  const ctx = h.mapCtx;
  const S = h.minimap.width; // square canvas
  const scale = S / (CONFIG.MAP_SIZE + 40); // world -220..220 -> canvas
  const toMap = (x, z) => [(x + 220) * scale, (z + 220) * scale];

  // Slate background.
  ctx.fillStyle = MAP_BG;
  ctx.fillRect(0, 0, S, S);

  // Water: a brighter band along the south (bottom) edge.
  const [, wy] = toMap(0, 185);
  ctx.fillStyle = MAP_WATER;
  ctx.fillRect(0, wy, S, S - wy);

  // Buildings: mid-slate blocks.
  ctx.fillStyle = MAP_BUILDING;
  for (const b of G.city.buildings) {
    const [bx, bz] = toMap(b.x - b.w / 2, b.z - b.d / 2);
    ctx.fillRect(bx, bz, Math.max(2, b.w * scale), Math.max(2, b.d * scale));
  }

  // Warehouse: a gold-outlined block so the mission target reads on the map.
  const [whx, why] = toMap(G.city.warehouse.x - 17, G.city.warehouse.z - 11);
  ctx.strokeStyle = '#ffc93c';
  ctx.lineWidth = 2;
  ctx.strokeRect(whx, why, 34 * scale, 22 * scale);

  // Roads: near-white, width 5, drawn over the buildings.
  ctx.strokeStyle = MAP_ROAD;
  ctx.lineWidth = 5;
  ctx.lineCap = 'round';
  for (const a of G.city.axes) {
    const [x1, y1] = toMap(a, -200);
    const [x2, y2] = toMap(a, 200);
    ctx.beginPath();
    ctx.moveTo(x1, y1);
    ctx.lineTo(x2, y2);
    ctx.stroke();
    const [x3, y3] = toMap(-200, a);
    const [x4, y4] = toMap(200, a);
    ctx.beginPath();
    ctx.moveTo(x3, y3);
    ctx.lineTo(x4, y4);
    ctx.stroke();
  }

  // Mission marker: gold dot with a white ring.
  if (G.mission?.dest) {
    const [mx, my] = toMap(G.mission.dest.x, G.mission.dest.z);
    ctx.beginPath();
    ctx.arc(mx, my, 7, 0, Math.PI * 2);
    ctx.fillStyle = '#ffc93c';
    ctx.fill();
    ctx.lineWidth = 2;
    ctx.strokeStyle = '#ffffff';
    ctx.stroke();
  }

  // Traffic: white 3px dots.
  ctx.fillStyle = '#ffffff';
  for (const car of G.cars.traffic) {
    if (!car.active) continue;
    const [cx, cy] = toMap(car.mesh.position.x, car.mesh.position.z);
    ctx.beginPath();
    ctx.arc(cx, cy, 3, 0, Math.PI * 2);
    ctx.fill();
  }

  // Police: red dots with white rings.
  for (const car of G.cars.police) {
    if (!car.active) continue;
    const [cx, cy] = toMap(car.mesh.position.x, car.mesh.position.z);
    ctx.beginPath();
    ctx.arc(cx, cy, 5, 0, Math.PI * 2);
    ctx.fillStyle = '#d92323';
    ctx.fill();
    ctx.lineWidth = 2;
    ctx.strokeStyle = '#ffffff';
    ctx.stroke();
  }

  // Player: a larger arrow with a dark outline, rotated to the heading.
  const [px, py] = toMap(G.player.pos.x, G.player.pos.z);
  ctx.save();
  ctx.translate(px, py);
  // Map heading 0 faces -Z (up on the minimap); canvas rotation matches.
  ctx.rotate(Math.PI - G.player.heading);
  ctx.beginPath();
  ctx.moveTo(0, -10);
  ctx.lineTo(7, 8);
  ctx.lineTo(0, 4);
  ctx.lineTo(-7, 8);
  ctx.closePath();
  ctx.fillStyle = '#1f8a8a';
  ctx.fill();
  ctx.lineWidth = 2.5;
  ctx.strokeStyle = '#10151b';
  ctx.stroke();
  ctx.restore();
}
