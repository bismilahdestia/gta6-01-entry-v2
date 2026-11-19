// Porto Alba — combat.js
// Pistol shooting, rivals for the warehouse job, and health / damage.
// Shooting is a camera raycast: click (or tap) and the shot goes where the
// camera looks. Rivals advance on the player and shoot back.

import * as THREE from 'three';
import { CONFIG } from './config.js';
import { makeRng, randRange, pick, clamp, dist2D } from './util.js';

/** Create the weapon + rival state. */
export function initCombat(G) {
  G.weapon = {
    ammo: 12,
    magSize: 12,
    damage: CONFIG.PISTOL_DAMAGE,
    range: CONFIG.PISTOL_RANGE,
    cooldown: 0,
    reloading: false,
  };
  G.rivals = [];
  G.tracer = null;
  return G.weapon;
}

/** Build one rival: a dark-clad figure with a red bandana marker. */
export function buildRivalMesh() {
  const group = new THREE.Group();
  const torso = new THREE.Mesh(
    new THREE.BoxGeometry(0.75, 0.85, 0.45),
    new THREE.MeshLambertMaterial({ color: 0x3a1f1f }),
  );
  torso.position.y = 1.15;
  group.add(torso);
  const head = new THREE.Mesh(
    new THREE.SphereGeometry(0.26, 10, 8),
    new THREE.MeshLambertMaterial({ color: 0xc98d64 }),
  );
  head.position.y = 1.8;
  group.add(head);
  // Red bandana — the rival marker.
  const band = new THREE.Mesh(
    new THREE.BoxGeometry(0.56, 0.14, 0.56),
    new THREE.MeshBasicMaterial({ color: 0xd92323 }),
  );
  band.position.y = 1.92;
  group.add(band);
  for (const sx of [-0.18, 0.18]) {
    const leg = new THREE.Mesh(
      new THREE.BoxGeometry(0.26, 0.75, 0.3),
      new THREE.MeshLambertMaterial({ color: 0x1c2733 }),
    );
    leg.position.set(sx, 0.38, 0);
    group.add(leg);
  }
  // The gun: a small dark box in the right hand.
  const gun = new THREE.Mesh(
    new THREE.BoxGeometry(0.12, 0.12, 0.5),
    new THREE.MeshLambertMaterial({ color: 0x141414 }),
  );
  gun.position.set(0.45, 1.1, 0.3);
  group.add(gun);
  return group;
}

/** Spawn n rivals around a point (the warehouse, for mission 4). */
export function spawnRivals(G, x, z, n = 4) {
  const rng = makeRng(CONFIG.SHOT_SEED + 55);
  for (let i = 0; i < n; i++) {
    const mesh = buildRivalMesh();
    const rx = x + randRange(rng, -14, 14);
    const rz = z + randRange(rng, -10, 10);
    mesh.position.set(rx, 0, rz);
    G.scene.add(mesh);
    G.rivals.push({
      mesh,
      health: CONFIG.RIVAL_HEALTH,
      shootTimer: randRange(rng, 1, 2.5),
      speed: randRange(rng, 2.2, 3.4),
      alive: true,
    });
  }
  return G.rivals;
}

/** Fire the pistol toward a screen point. Returns what was hit, if anything. */
export function fireWeapon(G, clientX, clientY) {
  const w = G.weapon;
  if (!w || w.cooldown > 0 || w.reloading) return null;
  if (w.ammo <= 0) {
    reloadWeapon(G);
    return null;
  }
  w.ammo -= 1;
  w.cooldown = 0.28;
  G.audio?.gunshot?.();
  if (w.ammo === 0) reloadWeapon(G); // last round fired — start the reload now

  // Raycast from the camera through the clicked screen point.
  const ndc = new THREE.Vector2(
    (clientX / window.innerWidth) * 2 - 1,
    -(clientY / window.innerHeight) * 2 + 1,
  );
  const ray = new THREE.Raycaster();
  ray.setFromCamera(ndc, G.camera);
  ray.far = w.range;

  // Tracer: a brief yellow line from the player to the hit point.
  const from = G.player.pos.clone();
  from.y = 1.4;
  const hitPoint = ray.ray.at(w.range, new THREE.Vector3());
  let hitRival = null;
  let bestD = w.range;
  for (const rival of G.rivals) {
    if (!rival.alive) continue;
    const d = dist2D(rival.mesh.position.x, rival.mesh.position.z, G.player.pos.x, G.player.pos.z);
    if (d > w.range) continue;
    // Cheap hit test: is the rival within a narrow cone of the ray?
    const toRival = new THREE.Vector3().subVectors(rival.mesh.position, from).normalize();
    const aim = ray.ray.direction;
    const cos = toRival.dot(aim);
    if (cos > 0.985 && d < bestD) {
      bestD = d;
      hitRival = rival;
      hitPoint.copy(rival.mesh.position).setY(1.3);
    }
  }
  showTracer(G, from, hitPoint);
  if (hitRival) {
    hitRival.health -= w.damage;
    if (hitRival.health <= 0) {
      hitRival.alive = false;
      hitRival.mesh.visible = false;
      G.player.money += 250;
      G.audio?.blip?.();
      checkRivalsCleared(G);
    }
  }
  return hitRival;
}

/** A fading line from muzzle to impact, removed after 90 ms. */
export function showTracer(G, from, to) {
  if (G.tracer) {
    G.scene.remove(G.tracer);
    G.tracer.geometry.dispose();
  }
  const geo = new THREE.BufferGeometry().setFromPoints([from, to]);
  const line = new THREE.Line(geo, new THREE.LineBasicMaterial({ color: 0xffe066 }));
  G.scene.add(line);
  G.tracer = line;
  setTimeout(() => {
    if (G.tracer === line) {
      G.scene.remove(line);
      line.geometry.dispose();
      G.tracer = null;
    }
  }, 90);
}

/** Reload the pistol (R). Takes a beat; ammo refills to a full mag. */
export function reloadWeapon(G) {
  const w = G.weapon;
  if (!w || w.reloading || w.ammo === w.magSize) return;
  w.reloading = true;
  setTimeout(() => {
    w.ammo = w.magSize;
    w.reloading = false;
  }, 650);
}

/** Damage the player; at 0 health the run ends and respawns at the marina. */
export function damagePlayer(G, amount) {
  G.player.health = clamp(G.player.health - amount, 0, CONFIG.PLAYER_HEALTH);
  if (G.player.health <= 0) {
    G.player.health = CONFIG.PLAYER_HEALTH;
    G.player.pos.set(0, 0, 160); // respawn by the promenade
    G.player.onFoot = true;
    if (G.player.mesh) {
      G.player.mesh.visible = true;
      G.player.mesh.position.copy(G.player.pos);
    }
    setWantedLevel(G, 0);
    G.showBanner?.('Busted — back on your feet', 'Rook woke up by the marina. The city is still yours.');
  }
}

/** Rivals advance and shoot back on a timer. */
export function updateRivals(G, dt) {
  for (const rival of G.rivals) {
    if (!rival.alive) continue;
    const dx = G.player.pos.x - rival.mesh.position.x;
    const dz = G.player.pos.z - rival.mesh.position.z;
    const d = Math.sqrt(dx * dx + dz * dz);
    if (d > 6) {
      rival.mesh.position.x += (dx / d) * rival.speed * dt;
      rival.mesh.position.z += (dz / d) * rival.speed * dt;
    }
    rival.mesh.rotation.y = Math.atan2(-dx, -dz);
    rival.shootTimer -= dt;
    if (rival.shootTimer <= 0 && d < 40) {
      rival.shootTimer = randRange(Math.random, 1.6, 3.2);
      damagePlayer(G, 8);
      G.audio?.gunshot?.();
    }
  }
  if (G.weapon.cooldown > 0) G.weapon.cooldown -= dt;
}

/** When the last rival falls during mission 4, the job is done. */
export function checkRivalsCleared(G) {
  if (!G.mission || G.mission.index !== 3) return;
  const alive = G.rivals.filter((r) => r.alive).length;
  if (alive === 0 && !G.mission.completed.includes(4)) {
    G.completeMission?.();
  }
}

// Small local alias so damagePlayer can clear heat without an import cycle.
function setWantedLevel(G, stars) {
  if (G.wanted) {
    G.wanted.stars = stars;
    G.wanted.heat = 0;
  }
  if (G.cars) {
    for (const car of G.cars.police) {
      car.active = false;
      car.mesh.visible = false;
    }
  }
}

export { pick };
