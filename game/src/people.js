// Pedestrians: simple two-part figures that stroll the sidewalks and scatter
// when a fast car gets close. They walk a loop of seeded waypoints so their
// movement is deterministic from the same seed.

import * as THREE from 'three';
import { WORLD, PEDS, PALETTE } from './config.js';
import { clamp, dist2d, randPick, randRange } from './util.js';

/** The on-foot figure, also used for the player character. */
export function buildPedMesh(color) {
  const group = new THREE.Group();
  const shirt = new THREE.MeshLambertMaterial({ color });
  const skin = new THREE.MeshLambertMaterial({ color: 0xd9a986 });
  const legs = new THREE.MeshLambertMaterial({ color: 0x3a3f4a });
  const body = new THREE.Mesh(new THREE.BoxGeometry(0.55, 0.8, 0.35), shirt);
  body.position.y = 1.05;
  group.add(body);
  const head = new THREE.Mesh(new THREE.SphereGeometry(0.26, 10, 8), skin);
  head.position.y = 1.68;
  group.add(head);
  const legL = new THREE.Mesh(new THREE.BoxGeometry(0.2, 0.65, 0.22), legs);
  legL.position.set(-0.14, 0.33, 0);
  group.add(legL);
  const legR = new THREE.Mesh(new THREE.BoxGeometry(0.2, 0.65, 0.22), legs);
  legR.position.set(0.14, 0.33, 0);
  group.add(legR);
  return group;
}

export function createPeople(scene, rng, axes) {
  const peds = [];
  for (let i = 0; i < PEDS.count; i += 1) {
    const mesh = buildPedMesh(randPick(rng, PALETTE.ped));
    scene.add(mesh);
    // Waypoints: a loop around two neighbouring blocks, on the sidewalk.
    const axis = randPick(rng, axes);
    const other = randPick(rng, axes);
    const off = WORLD.roadWidth / 2 + WORLD.sidewalk / 2;
    const points = [
      { x: axis + off, z: -WORLD.half + 20 },
      { x: axis + off, z: other },
      { x: other + off, z: other },
      { x: other + off, z: -WORLD.half + 20 },
    ];
    const start = points[Math.floor(rng() * points.length)];
    const ped = {
      mesh,
      x: start.x,
      z: start.z,
      heading: randRange(rng, 0, Math.PI * 2),
      points,
      pointIndex: 0,
      speed: randRange(rng, PEDS.walk * 0.8, PEDS.walk * 1.3),
      fleeing: false,
    };
    mesh.position.set(ped.x, 0, ped.z);
    peds.push(ped);
  }
  return peds;
}

export function updatePeople(peds, dt, cars) {
  for (const ped of peds) {
    // A fast car nearby sends them running the other way.
    let threat = null;
    let threatDist = 7;
    for (const car of cars) {
      if (!car.active || Math.abs(car.speed) < 6) continue;
      const d = dist2d(ped.x, ped.z, car.x, car.z);
      if (d < threatDist) {
        threatDist = d;
        threat = car;
      }
    }
    let targetSpeed = ped.speed;
    let goal;
    if (threat) {
      ped.fleeing = true;
      const away = Math.atan2(ped.x - threat.x, ped.z - threat.z);
      goal = { x: ped.x + Math.sin(away) * 10, z: ped.z + Math.cos(away) * 10 };
      targetSpeed = PEDS.flee;
    } else {
      ped.fleeing = false;
      goal = ped.points[ped.pointIndex];
      if (dist2d(ped.x, ped.z, goal.x, goal.z) < 1.5) {
        ped.pointIndex = (ped.pointIndex + 1) % ped.points.length;
        goal = ped.points[ped.pointIndex];
      }
    }
    const want = Math.atan2(goal.x - ped.x, goal.z - ped.z);
    let turn = want - ped.heading;
    while (turn > Math.PI) turn -= Math.PI * 2;
    while (turn < -Math.PI) turn += Math.PI * 2;
    ped.heading += clamp(turn, -3 * dt, 3 * dt);
    ped.x += Math.sin(ped.heading) * targetSpeed * dt;
    ped.z += Math.cos(ped.heading) * targetSpeed * dt;
    ped.x = clamp(ped.x, -WORLD.half - 10, WORLD.half + 10);
    ped.z = clamp(ped.z, -WORLD.half - 10, WORLD.half + 10);
    ped.mesh.position.set(ped.x, 0, ped.z);
    ped.mesh.rotation.y = ped.heading;
    // A little walk bob so they read as walking, not sliding: it keys off
    // distance travelled, which only grows while the world is stepping.
    ped.mesh.position.y = Math.abs(Math.sin((ped.x + ped.z) * 0.9)) * 0.04;
  }
}
