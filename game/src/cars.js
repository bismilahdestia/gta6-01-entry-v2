// Cars: the player's car, the teal target, traffic and the police.
// A car is a small mesh plus plain numbers (x, z, heading, speed) — no physics
// engine, just a fixed-step update the whole game shares. Forward is
// (sin(heading), cos(heading)) on the ground plane.

import * as THREE from 'three';
import { WORLD, PLAYER, TRAFFIC, POLICE, PALETTE } from './config.js';
import { clamp, dist2d, randPick, randRange, wrapAngle } from './util.js';

const CAR_RADIUS = 2.3;

function buildCarMesh(color, { police = false, stripe = false } = {}) {
  const group = new THREE.Group();
  const paint = new THREE.MeshLambertMaterial({ color });
  const dark = new THREE.MeshLambertMaterial({ color: 0x22242a });
  const glass = new THREE.MeshLambertMaterial({ color: 0x9fc8d8 });

  const body = new THREE.Mesh(new THREE.BoxGeometry(2.2, 0.7, 4.4), paint);
  body.position.y = 0.55;
  group.add(body);
  const cabin = new THREE.Mesh(new THREE.BoxGeometry(1.9, 0.6, 2.2), glass);
  cabin.position.set(0, 1.15, -0.3);
  group.add(cabin);
  if (stripe) {
    const band = new THREE.Mesh(new THREE.BoxGeometry(2.24, 0.12, 4.42), new THREE.MeshLambertMaterial({ color: 0xf2f0e8 }));
    band.position.y = 0.92;
    group.add(band);
  }
  if (police) {
    const bar = new THREE.Mesh(new THREE.BoxGeometry(1.6, 0.22, 0.5), dark);
    bar.position.set(0, 1.55, -0.3);
    group.add(bar);
    const red = new THREE.Mesh(new THREE.BoxGeometry(0.7, 0.24, 0.52), new THREE.MeshLambertMaterial({ color: 0xd82020 }));
    red.position.set(-0.42, 1.56, -0.3);
    group.add(red);
    const blue = new THREE.Mesh(new THREE.BoxGeometry(0.7, 0.24, 0.52), new THREE.MeshLambertMaterial({ color: 0x2050d8 }));
    blue.position.set(0.42, 1.56, -0.3);
    group.add(blue);
  }
  const wheelGeo = new THREE.CylinderGeometry(0.42, 0.42, 0.35, 12);
  for (const [wx, wz] of [[-1.05, 1.45], [1.05, 1.45], [-1.05, -1.45], [1.05, -1.45]]) {
    const wheel = new THREE.Mesh(wheelGeo, dark);
    wheel.rotation.z = Math.PI / 2;
    wheel.position.set(wx, 0.42, wz);
    group.add(wheel);
  }
  return group;
}

export function createCar(scene, color, options = {}) {
  const mesh = buildCarMesh(color, options);
  scene.add(mesh);
  return {
    mesh,
    kind: options.kind ?? 'traffic',
    x: options.x ?? 0,
    z: options.z ?? 0,
    heading: options.heading ?? 0,
    speed: 0,
    damage: 0,
    cruise: options.cruise ?? TRAFFIC.cruise,
    axis: options.axis ?? 'z',
    lane: options.lane ?? 0,
    dir: options.dir ?? 1,
    active: true,
  };
}

function placeMesh(car) {
  car.mesh.position.set(car.x, 0, car.z);
  car.mesh.rotation.y = car.heading;
}

/** Player driving: throttle, brake and steering, all in fixed steps. */
export function driveCar(car, steer, throttle, brake, dt) {
  if (throttle > 0) car.speed += PLAYER.carAccel * throttle * dt;
  if (brake > 0) {
    car.speed -= (car.speed > 0.5 ? PLAYER.carBrake : PLAYER.carReverse) * brake * dt;
  }
  car.speed -= car.speed * 0.35 * dt; // rolling drag
  car.speed = clamp(car.speed, -PLAYER.carReverse, PLAYER.carTopSpeed);
  const grip = clamp(Math.abs(car.speed) / PLAYER.carTopSpeed, 0, 1);
  car.heading += steer * PLAYER.carTurn * grip * dt * Math.sign(car.speed || 1);
  car.x += Math.sin(car.heading) * car.speed * dt;
  car.z += Math.cos(car.heading) * car.speed * dt;
  car.x = clamp(car.x, -WORLD.half - 6, WORLD.half + 6);
  car.z = clamp(car.z, -WORLD.half - 6, WORLD.half + 6);
  placeMesh(car);
}

/** Traffic: a set of cars that cruise their road, right-hand lane, and wrap around. */
export function createTraffic(scene, rng, axes) {
  const cars = [];
  for (let i = 0; i < TRAFFIC.count; i += 1) {
    const axis = randPick(rng, axes);
    const alongZ = rng() < 0.5;
    const dir = rng() < 0.5 ? 1 : -1;
    const lane = dir * 2.75;
    const car = createCar(scene, randPick(rng, PALETTE.trafficCar), {
      kind: 'traffic',
      x: alongZ ? axis + lane : randRange(rng, -WORLD.half, WORLD.half),
      z: alongZ ? randRange(rng, -WORLD.half, WORLD.half) : axis + lane,
      heading: alongZ ? (dir > 0 ? 0 : Math.PI) : dir > 0 ? Math.PI / 2 : -Math.PI / 2,
      cruise: randRange(rng, TRAFFIC.cruise * 0.8, TRAFFIC.cruise * 1.2),
      axis: alongZ ? 'z' : 'x',
      lane,
      dir,
    });
    car.speed = car.cruise;
    placeMesh(car);
    cars.push(car);
  }
  return cars;
}

function aheadBlocked(car, others, player) {
  const fx = Math.sin(car.heading);
  const fz = Math.cos(car.heading);
  for (const other of others) {
    if (other === car || !other.active) continue;
    const dx = other.x - car.x;
    const dz = other.z - car.z;
    const forward = dx * fx + dz * fz;
    const side = Math.abs(dx * fz - dz * fx);
    if (forward > 0 && forward < TRAFFIC.gap && side < 3) return true;
  }
  if (player) {
    const dx = player.x - car.x;
    const dz = player.z - car.z;
    const forward = dx * fx + dz * fz;
    const side = Math.abs(dx * fz - dz * fx);
    if (forward > 0 && forward < TRAFFIC.gap + 2 && side < 3) return true;
  }
  return false;
}

export function updateTraffic(cars, dt, playerCar) {
  for (const car of cars) {
    if (!car.active) continue;
    const target = aheadBlocked(car, cars, playerCar) ? 0 : car.cruise;
    car.speed += clamp(target - car.speed, -18 * dt, 8 * dt);
    car.x += Math.sin(car.heading) * car.speed * dt;
    car.z += Math.cos(car.heading) * car.speed * dt;
    if (car.axis === 'z' && (car.z > WORLD.half + 8 || car.z < -WORLD.half - 8)) {
      car.z = car.dir > 0 ? -WORLD.half - 8 : WORLD.half + 8;
    }
    if (car.axis === 'x' && (car.x > WORLD.half + 8 || car.x < -WORLD.half - 8)) {
      car.x = car.dir > 0 ? -WORLD.half - 8 : WORLD.half + 8;
    }
    placeMesh(car);
  }
}

/** Police: up to POLICE.max cars that cruise until wanted, then chase the player. */
export function createPolice(scene) {
  const cars = [];
  for (let i = 0; i < POLICE.max; i += 1) {
    const car = createCar(scene, PALETTE.policeCar, { kind: 'police', police: true, x: -200 + i * 40, z: 220, heading: Math.PI });
    car.speed = POLICE.cruise;
    car.active = false;
    car.mesh.visible = false;
    placeMesh(car);
    cars.push(car);
  }
  return cars;
}

export function updatePolice(cars, player, dt, stars) {
  let spawned = 0;
  for (const car of cars) {
    if (stars === 0) {
      car.active = false;
      car.mesh.visible = false;
      continue;
    }
    if (!car.active) {
      // Only as many police as there are stars; the rest stay parked off-screen.
      if (spawned >= stars) continue;
      car.active = true;
      car.mesh.visible = true;
      car.x = clamp(player.x + (spawned % 2 === 0 ? 60 : -60), -WORLD.half, WORLD.half);
      car.z = clamp(player.z - 55, -WORLD.half, WORLD.half);
      car.speed = POLICE.cruise;
    }
    spawned += 1;
    const dist = dist2d(car.x, car.z, player.x, player.z);
    const want = Math.atan2(player.x - car.x, player.z - car.z);
    const turn = wrapAngle(want - car.heading);
    car.heading += clamp(turn, -2.2 * dt, 2.2 * dt);
    const goal = dist > 14 ? POLICE.chase : POLICE.cruise;
    car.speed += clamp(goal - car.speed, -20 * dt, 14 * dt);
    car.x += Math.sin(car.heading) * car.speed * dt;
    car.z += Math.cos(car.heading) * car.speed * dt;
    placeMesh(car);
  }
}

/** Circle collision between two cars: push apart, bleed speed, report the hit. */
export function collideCars(a, b) {
  const d = dist2d(a.x, a.z, b.x, b.z);
  if (d >= CAR_RADIUS * 2 || d === 0) return false;
  const nx = (b.x - a.x) / d;
  const nz = (b.z - a.z) / d;
  const overlap = CAR_RADIUS * 2 - d;
  a.x -= nx * overlap * 0.5;
  a.z -= nz * overlap * 0.5;
  b.x += nx * overlap * 0.5;
  b.z += nz * overlap * 0.5;
  const hitSpeed = Math.abs(a.speed - b.speed);
  a.speed *= 0.55;
  b.speed *= 0.55;
  b.damage += hitSpeed * 0.4;
  placeMesh(a);
  placeMesh(b);
  return hitSpeed > 2;
}
