// Porto Alba — wanted.js
// The wanted level: 0-5 stars, heat that decays while the player stays calm
// and unseen, and one police interceptor per star that spawns in to chase.
// One clear job: heat and the police response to it.

import { CONFIG } from './config.js';
import { clamp } from './util.js';
import { spawnPoliceCar } from './cars.js';

/** Create the wanted state. */
export function initWanted(G) {
  G.wanted = {
    stars: 0,
    heat: 0, // 0..1 within the current star; drains, then a star drops
    quietTimer: 0, // seconds since the last crime
  };
  return G.wanted;
}

/** Raise the wanted level by n stars (clamped to the 0-5 range). */
export function addHeat(G, n = 1) {
  const w = G.wanted;
  w.stars = clamp(w.stars + n, 0, CONFIG.WANTED_MAX);
  w.heat = 1;
  w.quietTimer = 0;
  syncPolice(G);
  G.audio?.siren?.();
  return w.stars;
}

/** Set the wanted level outright (used by shot staging). */
export function setWanted(G, stars) {
  const w = G.wanted;
  w.stars = clamp(stars, 0, CONFIG.WANTED_MAX);
  w.heat = w.stars > 0 ? 1 : 0;
  w.quietTimer = 0;
  syncPolice(G);
  return w.stars;
}

/** Keep the interceptor count at exactly one per star. */
export function syncPolice(G) {
  const want = G.wanted.stars * CONFIG.POLICE_PER_STAR;
  // Add missing interceptors, spawning them on a road near the player.
  while (G.cars.police.filter((c) => c.active).length < want) {
    const angle = (G.cars.police.length / Math.max(1, want)) * Math.PI * 2;
    const x = G.player.pos.x + Math.cos(angle) * 40;
    const z = G.player.pos.z + Math.sin(angle) * 40;
    spawnPoliceCar(G, clamp(x, -190, 190), clamp(z, -190, 190));
  }
  // Park the extras instead of deleting them (cheap, keeps meshes pooled).
  let active = G.cars.police.filter((c) => c.active);
  while (active.length > want) {
    const extra = active.pop();
    extra.active = false;
    extra.mesh.visible = false;
  }
  // Reactivate pooled cars if stars rise again.
  for (const car of G.cars.police) {
    if (!car.active && G.cars.police.filter((c) => c.active).length < want) {
      car.active = true;
      car.mesh.visible = true;
      car.mesh.position.set(
        clamp(G.player.pos.x + 40, -190, 190),
        0,
        clamp(G.player.pos.z + 20, -190, 190),
      );
      car.speed = 10;
    }
  }
}

/** Per-frame wanted update: heat drains while quiet, stars fall with it. */
export function updateWanted(G, dt) {
  const w = G.wanted;
  if (w.stars === 0) return;
  w.quietTimer += dt;
  // Heat only cools once the player has been quiet for a few seconds.
  if (w.quietTimer > 4) {
    w.heat -= CONFIG.HEAT_DECAY_PER_SEC * dt * 2;
    if (w.heat <= 0) {
      w.stars = Math.max(0, w.stars - 1);
      w.heat = w.stars > 0 ? 1 : 0;
      w.quietTimer = 0;
      syncPolice(G);
      if (w.stars === 0) G.audio?.blip?.(); // all clear — a soft all-clear blip
    }
  }
  // Mission 2 completes the moment the player is clean again.
  if (w.stars === 0 && G.mission && G.mission.index === 1 && !G.mission.completed.includes(2)) {
    G.completeMission?.();
  }
}

/** Render the stars as text: filled ★ and empty ☆, five in all. */
export function starsText(stars) {
  let out = '';
  for (let i = 0; i < CONFIG.WANTED_MAX; i++) out += i < stars ? '★' : '☆';
  return out;
}
