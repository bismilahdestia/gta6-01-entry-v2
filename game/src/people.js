// Porto Alba — people.js
// Pedestrians: sidewalk walkers on both pavements, simple wander, and a
// habit of stepping clear when a car gets close. One clear job: foot traffic.

import * as THREE from 'three';
import { CONFIG } from './config.js';
import { makeRng, randRange, pick, clamp, dist2D } from './util.js';

const SHIRT = [0xd94f3d, 0x3d7ad9, 0xe8b13c, 0x3f8f4f, 0x7a4a9e, 0xe8e0cc, 0x2e2a26, 0xd9a06b];
const PANTS = [0x2e3a4a, 0x4a4a4a, 0x6b5a48, 0x1c2733];

/** Build one low-poly walker: torso, head, legs, arms. */
export function buildPedMesh(rng) {
  const group = new THREE.Group();
  const shirt = pick(rng, SHIRT);
  const pants = pick(rng, PANTS);
  const torso = new THREE.Mesh(
    new THREE.BoxGeometry(0.7, 0.8, 0.4),
    new THREE.MeshLambertMaterial({ color: shirt }),
  );
  torso.position.y = 1.15;
  group.add(torso);
  const head = new THREE.Mesh(
    new THREE.SphereGeometry(0.26, 10, 8),
    new THREE.MeshLambertMaterial({ color: pick(rng, [0xe8b88a, 0xc98d64, 0x8a5a3b, 0xf0c8a0]) }),
  );
  head.position.y = 1.8;
  group.add(head);
  for (const sx of [-0.18, 0.18]) {
    const leg = new THREE.Mesh(
      new THREE.BoxGeometry(0.26, 0.75, 0.3),
      new THREE.MeshLambertMaterial({ color: pants }),
    );
    leg.position.set(sx, 0.38, 0);
    group.add(leg);
    const arm = new THREE.Mesh(
      new THREE.BoxGeometry(0.18, 0.7, 0.22),
      new THREE.MeshLambertMaterial({ color: shirt }),
    );
    arm.position.set(sx * 2.4, 1.15, 0);
    group.add(arm);
  }
  return group;
}

/** Spawn pedestrians on the sidewalks flanking the roads. */
export function spawnPeds(G) {
  const rng = makeRng(CONFIG.SHOT_SEED + 33);
  const axes = G.city.axes;
  G.peds = [];
  for (let i = 0; i < CONFIG.PED_COUNT; i++) {
    const axis = pick(rng, axes);
    const along = randRange(rng, -180, 180);
    const useX = rng() < 0.5;
    const side = rng() < 0.5 ? 1 : -1;
    const dir = rng() < 0.5 ? 1 : -1;
    const mesh = buildPedMesh(rng);
    const off = CONFIG.ROAD_WIDTH / 2 + CONFIG.SIDEWALK / 2; // pavement centre
    const x = useX ? along : axis + side * off;
    const z = useX ? axis + side * off : along;
    mesh.position.set(x, 0, z);
    mesh.rotation.y = useX ? (dir > 0 ? -Math.PI / 2 : Math.PI / 2) : dir > 0 ? Math.PI : 0;
    G.scene.add(mesh);
    G.peds.push({
      mesh,
      axis: useX ? 'x' : 'z',
      road: axis,
      side,
      dir,
      speed: randRange(rng, 1.2, 2.1),
      heading: mesh.rotation.y,
      wander: randRange(rng, 4, 10), // seconds until a possible turn
      phase: randRange(rng, 0, Math.PI * 2), // walk-cycle phase
    });
  }
  return G.peds;
}

/** Walk every pedestrian along its pavement; dodge cars that get close. */
export function updatePeds(G, dt) {
  for (const ped of G.peds) {
    ped.wander -= dt;
    if (ped.wander <= 0) {
      // At an intersection, sometimes turn onto the crossing road.
      // Uses the shared seeded RNG so staging stays reproducible.
      ped.wander = randRange(G.rng, 5, 12);
      if (G.rng() < 0.25) {
        ped.dir *= -1;
        ped.heading += Math.PI;
        ped.mesh.rotation.y = ped.heading;
      }
    }
    const step = ped.speed * ped.dir * dt;
    if (ped.axis === 'x') ped.mesh.position.x += step;
    else ped.mesh.position.z += step;
    // Wrap at the map edge.
    if (ped.mesh.position.x > 195) ped.mesh.position.x = -195;
    if (ped.mesh.position.x < -195) ped.mesh.position.x = 195;
    if (ped.mesh.position.z > 195) ped.mesh.position.z = -195;
    if (ped.mesh.position.z < -195) ped.mesh.position.z = 195;

    // Keep clear of cars: if a car is close ahead, sidestep to the outer edge.
    for (const car of [...G.cars.traffic, ...G.cars.police]) {
      if (!car.active) continue;
      const d = dist2D(ped.mesh.position.x, ped.mesh.position.z, car.mesh.position.x, car.mesh.position.z);
      if (d < 4) {
        const push = ped.axis === 'x' ? 'z' : 'x';
        ped.mesh.position[push] += ped.side * 2.2 * dt * 3;
        // Clamp back onto the pavement band, never into the road centre.
        const off = CONFIG.ROAD_WIDTH / 2 + CONFIG.SIDEWALK / 2;
        const roadPos = ped.axis === 'x' ? ped.mesh.position.z : ped.mesh.position.x;
        const clamped = clamp(roadPos, ped.road - off - 1.2, ped.road + off + 1.2);
        if (ped.axis === 'x') ped.mesh.position.z = clamped;
        else ped.mesh.position.x = clamped;
        break;
      }
    }

    // Simple walk bob so they read as walking, not sliding.
    ped.phase += dt * 7;
    ped.mesh.position.y = Math.abs(Math.sin(ped.phase)) * 0.06;
    ped.mesh.rotation.z = Math.sin(ped.phase) * 0.03;
  }
}

/** Place a pedestrian at an exact spot (used by shot staging). */
export function placePed(G, x, z, heading = 0) {
  const rng = makeRng(CONFIG.SHOT_SEED + 99);
  const mesh = buildPedMesh(rng);
  mesh.position.set(x, 0, z);
  mesh.rotation.y = heading;
  G.scene.add(mesh);
  const ped = { mesh, axis: 'x', road: 0, side: 1, dir: 1, speed: 0, heading, wander: 99, phase: 0 };
  G.peds.push(ped);
  return ped;
}
