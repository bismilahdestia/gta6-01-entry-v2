// Porto Alba — cars.js
// Traffic, parked cars, the player's car and police interceptors. Arcade
// driving (accelerate / steer / brake / handbrake), traffic AI that follows
// its lane at a slow cruise, and stealing that only ever targets parked cars
// — never the player's own teal car.

import * as THREE from 'three';
import { CONFIG } from './config.js';
import { makeRng, randRange, randInt, pick, clamp, turnToward, dist2D } from './util.js';
import { throttleInput, steerInput } from './input.js';

const C = CONFIG.COLORS;

/** Build a boxy car mesh: body, cabin, windows, four wheels, headlights. */
export function buildCarMesh(color, isPolice) {
  const group = new THREE.Group();
  const bodyMat = new THREE.MeshLambertMaterial({ color });
  const body = new THREE.Mesh(new THREE.BoxGeometry(2.1, 0.75, 4.4), bodyMat);
  body.position.y = 0.55;
  group.add(body);
  const cabin = new THREE.Mesh(
    new THREE.BoxGeometry(1.8, 0.65, 2.2),
    new THREE.MeshLambertMaterial({ color: isPolice ? 0xf2f2f2 : 0x222a33 }),
  );
  cabin.position.set(0, 1.2, -0.2);
  group.add(cabin);
  const wheelGeo = new THREE.CylinderGeometry(0.42, 0.42, 0.35, 10);
  const wheelMat = new THREE.MeshLambertMaterial({ color: 0x141414 });
  for (const [wx, wz] of [[-1.0, 1.45], [1.0, 1.45], [-1.0, -1.45], [1.0, -1.45]]) {
    const wheel = new THREE.Mesh(wheelGeo, wheelMat);
    wheel.rotation.z = Math.PI / 2;
    wheel.position.set(wx, 0.42, wz);
    group.add(wheel);
  }
  // Headlights.
  const lightMat = new THREE.MeshBasicMaterial({ color: 0xfff2b0 });
  for (const wx of [-0.7, 0.7]) {
    const lamp = new THREE.Mesh(new THREE.BoxGeometry(0.4, 0.2, 0.1), lightMat);
    lamp.position.set(wx, 0.6, 2.22);
    group.add(lamp);
  }
  if (isPolice) {
    // Roof light bar: red + blue.
    const red = new THREE.Mesh(new THREE.BoxGeometry(0.7, 0.25, 0.5), new THREE.MeshBasicMaterial({ color: 0xff2222 }));
    red.position.set(-0.4, 1.65, -0.2);
    group.add(red);
    const blue = new THREE.Mesh(new THREE.BoxGeometry(0.7, 0.25, 0.5), new THREE.MeshBasicMaterial({ color: 0x2255ff }));
    blue.position.set(0.4, 1.65, -0.2);
    group.add(blue);
  }
  return group;
}

/** Wrap a mesh into a car record the systems share. */
export function makeCarRecord(mesh, kind, opts = {}) {
  return {
    mesh,
    kind, // 'traffic' | 'parked' | 'police' | 'player'
    isPlayer: kind === 'player',
    heading: opts.heading ?? 0,
    speed: opts.speed ?? 0,
    cruise: opts.cruise ?? CONFIG.SPEEDS.trafficCruise,
    axis: opts.axis ?? 'x', // traffic lane axis
    lane: opts.lane ?? 2.5, // lateral offset from the road centre
    dir: opts.dir ?? 1,
    color: opts.color ?? 0xffffff,
    active: true,
  };
}

/** Spawn the traffic fleet: lane-following cruisers on the road grid. */
export function spawnTraffic(G) {
  const rng = makeRng(CONFIG.SHOT_SEED + 7);
  const axes = G.city.axes;
  const palette = [0xd8d8d8, 0x3d7ad9, 0xe8b13c, 0x7a4a9e, 0x4a4a4a, 0xd94f3d, 0x3f8f4f, 0xe8e0cc];
  G.cars.traffic = [];
  for (let i = 0; i < CONFIG.TRAFFIC_COUNT; i++) {
    const axis = pick(rng, axes);
    const along = randRange(rng, -180, 180);
    const dir = rng() < 0.5 ? 1 : -1;
    const useX = rng() < 0.5;
    const color = pick(rng, palette);
    const mesh = buildCarMesh(color, false);
    const x = useX ? along : axis + dir * 2.5;
    const z = useX ? axis + dir * 2.5 : along;
    mesh.position.set(x, 0, z);
    // Heading: along +X is -PI/2 for our forward (-Z) car model... cars face
    // their local -Z; heading 0 means facing -Z (north on the map).
    const heading = useX ? (dir > 0 ? -Math.PI / 2 : Math.PI / 2) : dir > 0 ? Math.PI : 0;
    mesh.rotation.y = heading;
    G.scene.add(mesh);
    G.cars.traffic.push(
      makeCarRecord(mesh, 'traffic', {
        heading,
        speed: randRange(rng, 7, 11),
        cruise: randRange(rng, 7, 11),
        axis: useX ? 'x' : 'z',
        lane: dir * 2.5,
        dir,
        color,
      }),
    );
  }
  return G.cars.traffic;
}

/** Spawn parked cars at the kerb. The first one is red, for mission 1. */
export function spawnParked(G) {
  const rng = makeRng(CONFIG.SHOT_SEED + 21);
  const axes = G.city.axes;
  G.cars.parked = [];
  for (let i = 0; i < CONFIG.PARKED_COUNT; i++) {
    const axis = pick(rng, axes);
    const along = randRange(rng, -160, 160);
    const useX = rng() < 0.5;
    const side = rng() < 0.5 ? 1 : -1;
    const color = i === 0 ? C.parkedRed : pick(rng, [0xd8d8d8, 0x3d7ad9, 0xe8b13c, 0x4a4a4a, 0x3f8f4f]);
    const mesh = buildCarMesh(color, false);
    const kerb = 6.8; // just off the asphalt, on the sidewalk edge
    const x = useX ? along : axis + side * kerb;
    const z = useX ? axis + side * kerb : along;
    mesh.position.set(x, 0, z);
    const heading = useX ? (side > 0 ? -Math.PI / 2 : Math.PI / 2) : side > 0 ? Math.PI : 0;
    mesh.rotation.y = heading;
    G.scene.add(mesh);
    G.cars.parked.push(makeCarRecord(mesh, 'parked', { heading, color }));
  }
  return G.cars.parked;
}

/** Spawn Rook's own teal car — the one steal must NEVER target. */
export function spawnPlayerCar(G, x = 0, z = -30) {
  const mesh = buildCarMesh(C.playerCar, false);
  mesh.position.set(x, 0, z);
  mesh.rotation.y = 0;
  G.scene.add(mesh);
  const car = makeCarRecord(mesh, 'player', { heading: 0, color: C.playerCar });
  G.cars.playerCar = car;
  return car;
}

/** Move every traffic car along its lane; wrap at the map edge. */
export function updateTraffic(G, dt) {
  for (const car of G.cars.traffic) {
    if (!car.active) continue;
    const step = car.cruise * car.dir * dt;
    if (car.axis === 'x') {
      car.mesh.position.x += step;
      if (car.mesh.position.x > 195) car.mesh.position.x = -195;
      if (car.mesh.position.x < -195) car.mesh.position.x = 195;
    } else {
      car.mesh.position.z += step;
      if (car.mesh.position.z > 195) car.mesh.position.z = -195;
      if (car.mesh.position.z < -195) car.mesh.position.z = 195;
    }
    // Gentle speed wobble so the flow feels alive, never a stop.
    car.cruise += Math.sin(G.elapsed * 0.3 + car.mesh.position.x * 0.05) * 0.002;
    car.cruise = clamp(car.cruise, 6, 12);
  }
}

/** Arcade driving for the player's car: throttle, steering, brake, handbrake. */
export function updatePlayerCar(G, dt) {
  const car = G.cars.playerCar;
  if (!car || G.player.onFoot) return;
  const throttle = throttleInput(G);
  const steer = steerInput(G);
  const handbrake = !!G.input.keys.Space;
  if (throttle > 0) car.speed += CONFIG.SPEEDS.carAccel * dt;
  else if (throttle < 0) {
    car.speed -= (car.speed > 0.5 ? CONFIG.SPEEDS.carBrake : CONFIG.SPEEDS.carAccel * 0.6) * dt;
  } else {
    car.speed -= Math.sign(car.speed) * 6 * dt;
    if (Math.abs(car.speed) < 0.2) car.speed = 0;
  }
  if (handbrake) car.speed *= Math.max(0, 1 - 3.5 * dt);
  car.speed = clamp(car.speed, -CONFIG.SPEEDS.carReverseMax, CONFIG.SPEEDS.carMax);
  // Steering bites harder at speed, and reverses when reversing.
  const steerAuthority = clamp(Math.abs(car.speed) / 8, 0, 1);
  car.heading -= steer * CONFIG.SPEEDS.turnRate * steerAuthority * Math.sign(car.speed || 1) * dt;
  car.mesh.rotation.y = car.heading;
  // Forward is local -Z: x -= sin(heading), z -= cos(heading).
  car.mesh.position.x -= Math.sin(car.heading) * car.speed * dt;
  car.mesh.position.z -= Math.cos(car.heading) * car.speed * dt;
  car.mesh.position.x = clamp(car.mesh.position.x, -196, 196);
  car.mesh.position.z = clamp(car.mesh.position.z, -196, 196);
  // Keep the player state glued to the car.
  G.player.pos.copy(car.mesh.position);
  G.player.heading = car.heading;
  G.player.speed = car.speed;
}

/**
 * Steal the NEAREST parked car within reach. The player's own car is never in
 * the parked list and isPlayer cars are skipped by construction — stealing
 * your own teal car was a real bug, and this guard is the fix.
 */
export function stealNearestParkedCar(G) {
  if (!G.player.onFoot) return null;
  let best = null;
  let bestD = 7;
  for (const car of G.cars.parked) {
    if (!car.active || car.isPlayer) continue;
    const d = dist2D(G.player.pos.x, G.player.pos.z, car.mesh.position.x, car.mesh.position.z);
    if (d < bestD) {
      bestD = d;
      best = car;
    }
  }
  if (!best) return null;
  // Take it out of the parked pool and make it the player's car.
  best.kind = 'player';
  best.isPlayer = true;
  best.cruise = 0; // a stolen car never drifts off on its old cruise speed
  G.cars.parked = G.cars.parked.filter((c) => c !== best);
  G.cars.playerCar = best;
  G.player.onFoot = false;
  G.player.car = best;
  G.player.heading = best.heading;
  G.player.speed = 0;
  G.player.mesh.visible = false;
  G.audio?.blip?.();
  return best;
}

/** Get out of the car on foot, leaving it parked where it stands. */
export function exitCar(G) {
  const car = G.cars.playerCar;
  if (!car || G.player.onFoot) return;
  G.player.onFoot = true;
  G.player.car = null;
  car.speed = 0;
  // Step out to the driver's side.
  G.player.pos.set(car.mesh.position.x + 2.2, 0, car.mesh.position.z);
  G.player.mesh.visible = true;
  G.player.mesh.position.copy(G.player.pos);
}

/** Spawn one police interceptor at a road position near the player. */
export function spawnPoliceCar(G, x, z) {
  const mesh = buildCarMesh(C.police, true);
  mesh.position.set(x, 0, z);
  G.scene.add(mesh);
  const car = makeCarRecord(mesh, 'police', { heading: 0, speed: 0, color: C.police });
  G.cars.police.push(car);
  return car;
}

/** Police chase AI: steer toward the player and close in fast. */
export function updatePolice(G, dt) {
  for (const car of G.cars.police) {
    if (!car.active) continue;
    const dx = G.player.pos.x - car.mesh.position.x;
    const dz = G.player.pos.z - car.mesh.position.z;
    const target = Math.atan2(-dx, -dz); // heading that faces the player
    car.heading = turnToward(car.heading, target, 2.6 * dt);
    car.speed = Math.min(car.speed + 22 * dt, CONFIG.SPEEDS.policeMax);
    car.mesh.rotation.y = car.heading;
    car.mesh.position.x -= Math.sin(car.heading) * car.speed * dt;
    car.mesh.position.z -= Math.cos(car.heading) * car.speed * dt;
    // A bump slows both sides — the chase never insta-kills the player.
    const d = dist2D(car.mesh.position.x, car.mesh.position.z, G.player.pos.x, G.player.pos.z);
    if (d < 3.2 && !G.player.onFoot) {
      car.speed *= 0.6;
      if (G.cars.playerCar) G.cars.playerCar.speed *= 0.85;
    }
  }
}
