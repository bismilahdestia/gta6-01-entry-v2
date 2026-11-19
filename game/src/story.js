// Porto Alba — story.js
// The four missions: briefings, objectives, the gold beacon, mission flow
// and banner text. One clear job: the story arc from first wheels to the
// warehouse job.

import * as THREE from 'three';
import { CONFIG } from './config.js';
import { dist2D } from './util.js';
import { addHeat } from './wanted.js';
import { spawnRivals } from './combat.js';

const C = CONFIG.COLORS;

/** Mission destinations by index: 0 parked car, 1 none, 2 drop-off, 3 warehouse. */
export function destinationFor(G, index) {
  if (index === 0) {
    const red = G.cars.parked[0];
    if (red) return { x: red.mesh.position.x, z: red.mesh.position.z };
    return { x: 0, z: -20 };
  }
  if (index === 1) return null; // lose the heat — no destination
  if (index === 2) return { x: CONFIG.DROP_OFF.x, z: CONFIG.DROP_OFF.z };
  return { x: CONFIG.WAREHOUSE.x, z: CONFIG.WAREHOUSE.z };
}

/** Create the mission state and the gold beacon (diamond + light column). */
export function initStory(G) {
  const beacon = new THREE.Group();
  // Gold diamond floating at y=11 above the destination.
  const diamond = new THREE.Mesh(
    new THREE.OctahedronGeometry(1.6),
    new THREE.MeshBasicMaterial({ color: C.beacon }),
  );
  diamond.position.y = 11;
  beacon.add(diamond);
  // Light column, opacity 0.38, rising from the ground to the diamond.
  const column = new THREE.Mesh(
    new THREE.CylinderGeometry(1.1, 1.6, 11, 12, 1, true),
    new THREE.MeshBasicMaterial({
      color: C.beacon,
      transparent: true,
      opacity: 0.38,
      side: THREE.DoubleSide,
      depthWrite: false,
    }),
  );
  column.position.y = 5.5;
  beacon.add(column);
  beacon.visible = false;
  G.scene.add(beacon);

  G.mission = {
    index: 0,
    completed: [],
    beacon,
    diamond,
    column,
    dest: null,
    rivalsSpawned: false,
    bannerShownFor: -1,
  };
  return G.mission;
}

/** Move the beacon to a mission destination (or hide it when there is none). */
export function moveBeacon(G, dest) {
  const m = G.mission;
  m.dest = dest;
  if (!dest) {
    m.beacon.visible = false;
    return;
  }
  m.beacon.position.set(dest.x, 0, dest.z);
  m.beacon.visible = true;
}

/** Start (or restart) a mission: briefing banner + objective + beacon. */
export function setMission(G, index) {
  const m = G.mission;
  m.index = index;
  m.rivalsSpawned = false;
  const def = CONFIG.MISSIONS[index];
  moveBeacon(G, destinationFor(G, index));
  // Mission 4 names the rival count so the player knows what is waiting.
  const objective = index === 3 ? 'Reach the warehouse and clear out the rivals (4 rivals)' : def.objective;
  G.setObjective?.(objective);
  G.showBanner?.(def.title, def.briefing);
  return def;
}

/** Mark the current mission done, pay out, and advance to the next one. */
export function completeMission(G) {
  const m = G.mission;
  const def = CONFIG.MISSIONS[m.index];
  if (m.completed.includes(def.id)) return;
  m.completed.push(def.id);
  const reward = [0, 500, 800, 2500][m.index] || 0;
  G.player.money += reward;
  G.showBanner?.(
    `Mission complete — ${def.title}`,
    reward > 0 ? `+$${reward} — Rook banks the cut.` : 'Clean. The city is still yours.',
  );
  G.audio?.blip?.();
  if (m.index < CONFIG.MISSIONS.length - 1) {
    setMission(G, m.index + 1);
  } else {
    // Story done: free roam with the whole city open.
    moveBeacon(G, null);
    G.setObjective?.('Free roam — Porto Alba is yours');
    G.showBanner?.('Porto Alba complete', 'Every job done. The city is yours, Rook.');
  }
  G.saveGameNow?.();
}

/** Called when the player steals a car during mission 1. */
export function onCarStolen(G) {
  if (G.mission.index === 0) {
    completeMission(G);
    // The steal puts heat on Rook — mission 2 begins with 1 star.
    addHeat(G, 1);
  } else {
    addHeat(G, 1);
  }
}

/** Per-frame mission checks: arrivals, warehouse rivals, beacon spin. */
export function updateStory(G, dt) {
  const m = G.mission;
  if (!m) return;
  // The beacon diamond spins slowly so it catches the eye.
  if (m.beacon.visible) {
    m.diamond.rotation.y += dt * 1.2;
    m.diamond.position.y = 11 + Math.sin(G.elapsed * 1.5) * 0.4;
  }
  if (m.index === 2 && !G.player.onFoot) {
    // Delivery: arrive at the drop-off in the car.
    const d = dist2D(G.player.pos.x, G.player.pos.z, CONFIG.DROP_OFF.x, CONFIG.DROP_OFF.z);
    if (d < 12) completeMission(G);
  }
  if (m.index === 3) {
    const d = dist2D(G.player.pos.x, G.player.pos.z, CONFIG.WAREHOUSE.x, CONFIG.WAREHOUSE.z);
    if (d < 26 && !m.rivalsSpawned) {
      m.rivalsSpawned = true;
      spawnRivals(G, CONFIG.WAREHOUSE.x, CONFIG.WAREHOUSE.z - 16, 4);
      G.showBanner?.('Ambush!', 'Rivals are guarding the vault — take them down.');
      addHeat(G, 2);
    }
  }
}
