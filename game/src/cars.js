// Porto Alba — cars. A low-poly car factory (body, cabin, wheels, lights),
// arcade driving physics for the player's car, traffic that follows the
// street grid, parked cars to steal, and police interceptors.

import * as THREE from '../vendor/three/three.module.min.js';
import { clamp, dist2, pick, pushOutOfBox } from './util.js';
import { STREETS } from './city.js';

const CAR_COLORS = [
  0xc23b2e, 0x2e6db4, 0xe0a83c, 0x4a4f55, 0xe8e4da, 0x58b368,
  0x7a4a9e, 0xd97b2e, 0x3fa7a0, 0xb8b0a0,
];

export function makeCarMesh(color, isPolice) {
  const g = new THREE.Group();
  const paint = new THREE.MeshLambertMaterial({ color });
  const glass = new THREE.MeshLambertMaterial({ color: 0x1c2733 });
  const dark = new THREE.MeshLambertMaterial({ color: 0x1a1c1e });

  const body = new THREE.Mesh(new THREE.BoxGeometry(2, 0.75, 4.4), paint);
  body.position.y = 0.55;
  g.add(body);
  const cabin = new THREE.Mesh(new THREE.BoxGeometry(1.7, 0.65, 2.2), glass);
  cabin.position.set(0, 1.2, -0.2);
  g.add(cabin);
  // Wheels.
  const wheelGeo = new THREE.CylinderGeometry(0.38, 0.38, 0.3, 10);
  const wheels = [];
  for (const [x, z] of [[-0.95, 1.45], [0.95, 1.45], [-0.95, -1.45], [0.95, -1.45]]) {
    const w = new THREE.Mesh(wheelGeo, dark);
    w.rotation.z = Math.PI / 2;
    w.position.set(x, 0.38, z);
    g.add(w);
    wheels.push(w);
  }
  // Headlights and taillights.
  const lightMat = new THREE.MeshLambertMaterial({ color: 0xfff2b0, emissive: 0x887733 });
  for (const x of [-0.6, 0.6]) {
    const h = new THREE.Mesh(new THREE.BoxGeometry(0.4, 0.2, 0.1), lightMat);
    h.position.set(x, 0.6, 2.21);
    g.add(h);
    const t = new THREE.Mesh(
      new THREE.BoxGeometry(0.4, 0.2, 0.1),
      new THREE.MeshLambertMaterial({ color: 0xaa2222, emissive: 0x550000 })
    );
    t.position.set(x, 0.6, -2.21);
    g.add(t);
  }
  let lightBar = null;
  if (isPolice) {
    const bar = new THREE.Group();
    const red = new THREE.Mesh(
      new THREE.BoxGeometry(0.7, 0.22, 0.5),
      new THREE.MeshLambertMaterial({ color: 0xdd2222, emissive: 0xaa0000 })
    );
    red.position.x = -0.4;
    const blue = new THREE.Mesh(
      new THREE.BoxGeometry(0.7, 0.22, 0.5),
      new THREE.MeshLambertMaterial({ color: 0x2244dd, emissive: 0x0000aa })
    );
    blue.position.x = 0.4;
    bar.add(red); bar.add(blue);
    bar.position.set(0, 1.62, -0.2);
    g.add(bar);
    lightBar = { red, blue, phase: 0 };
  }
  return { group: g, wheels, lightBar };
}

export function createCarSystem(G) {
  const cars = [];
  const rng = G.rng;

  function addCar(kind, x, z, heading) {
    const color = kind === 'police' ? 0xf0f0ea : pick(rng, CAR_COLORS);
    const mesh = makeCarMesh(color, kind === 'police');
    mesh.group.position.set(x, 0, z);
    mesh.group.rotation.y = heading;
    G.scene.add(mesh.group);
    const car = {
      kind, mesh, group: mesh.group,
      x, z, heading,
      speed: 0, health: 100,
      driven: false, // the player is driving it
      parked: kind === 'parked',
      axis: Math.abs(Math.sin(heading)) < 0.5 ? 'z' : 'x',
      street: kind === 'traffic' ? (Math.abs(Math.sin(heading)) < 0.5 ? x : z) : 0,
      dir: 1,
      cruise: 8 + rng() * 4,
      turnCooldown: 0,
      stalled: 0,
      flash: 0,
    };
    cars.push(car);
    return car;
  }

  // Parked cars the player can steal, placed along streets.
  for (let i = 0; i < 12; i++) {
    const street = pick(rng, STREETS);
    const along = -150 + rng() * 300;
    const side = rng() < 0.5 ? -1 : 1;
    const horizontal = rng() < 0.5;
    const x = horizontal ? along : street + side * 4.4;
    const z = horizontal ? street + side * 4.4 : along;
    addCar('parked', x, z, horizontal ? (side > 0 ? Math.PI / 2 : -Math.PI / 2) : (side > 0 ? 0 : Math.PI));
  }
  // Moving traffic.
  for (let i = 0; i < 12; i++) {
    const street = pick(rng, STREETS);
    const along = -160 + rng() * 320;
    const horizontal = rng() < 0.5;
    const x = horizontal ? along : street;
    const z = horizontal ? street : along;
    const car = addCar('traffic', x, z, horizontal ? (rng() < 0.5 ? Math.PI / 2 : -Math.PI / 2) : (rng() < 0.5 ? 0 : Math.PI));
    car.dir = rng() < 0.5 ? 1 : -1;
    car.speed = car.cruise;
  }

  function nearestStealable(x, z, maxD) {
    let best = null, bestD = maxD * maxD;
    for (const car of cars) {
      if (car.kind === 'police' || car.driven) continue;
      const d = dist2(x, z, car.x, car.z);
      if (d < bestD) { bestD = d; best = car; }
    }
    return best;
  }

  function collideCar(car, dt) {
    // Buildings.
    for (const box of G.world.colliders) {
      const hit = pushOutOfBox(car.x, car.z, 1.6, box);
      if (hit) {
        const hard = Math.abs(car.speed) > 8;
        car.x = hit.x; car.z = hit.z;
        if (Math.abs(car.speed) > 3) {
          car.speed *= -0.25;
          if (hard && car.driven) G.onCrash(Math.abs(car.speed));
        } else {
          car.speed *= 0.5;
        }
      }
    }
    // Other cars: soft circle push.
    for (const other of cars) {
      if (other === car) continue;
      const dx = car.x - other.x, dz = car.z - other.z;
      const d2 = dx * dx + dz * dz;
      if (d2 < 12.5 && d2 > 0.001) {
        const d = Math.sqrt(d2);
        const push = (3.6 - d) / 2;
        const nx = dx / d, nz = dz / d;
        car.x += nx * push; car.z += nz * push;
        other.x -= nx * push; other.z -= nz * push;
        const exchange = (car.speed - other.speed) * 0.3;
        car.speed -= exchange;
        other.speed += exchange;
        if (other.kind === 'traffic') other.stalled = 0.8;
        if (car.driven && Math.abs(exchange) > 4) G.onCrash(Math.abs(exchange));
      }
    }
  }

  function drivePlayerCar(car, dt) {
    const input = G.input;
    const forward = input.held('KeyW') || input.held('ArrowUp');
    const back = input.held('KeyS') || input.held('ArrowDown');
    const steerL = input.held('KeyA') || input.held('ArrowLeft');
    const steerR = input.held('KeyD') || input.held('ArrowRight');
    const brake = input.held('Space');
    const accel = 15;
    if (forward) car.speed += accel * dt;
    if (back) car.speed -= (car.speed > 0.5 ? 22 : 9) * dt;
    if (brake) car.speed -= Math.sign(car.speed) * Math.min(Math.abs(car.speed), 26 * dt);
    car.speed = clamp(car.speed, -11, 34);
    if (!forward && !back) car.speed -= Math.sign(car.speed) * Math.min(Math.abs(car.speed), 6 * dt);
    const steer = (steerL ? 1 : 0) - (steerR ? 1 : 0);
    const speedNorm = clamp(Math.abs(car.speed) / 34, 0, 1);
    const grip = brake ? 2.6 : 1.9;
    car.heading += steer * grip * speedNorm * Math.sign(car.speed || 1) * dt * (car.speed < 0 ? -1 : 1);
    car.x += Math.sin(car.heading) * car.speed * dt;
    car.z += Math.cos(car.heading) * car.speed * dt;
    collideCar(car, dt);
    // Wheels spin and front wheels steer a little.
    for (const w of car.mesh.wheels) w.rotation.x += car.speed * dt * 2.2;
    return speedNorm;
  }

  function driveTrafficCar(car, dt) {
    if (car.stalled > 0) {
      car.stalled -= dt;
      car.speed = Math.max(0, car.speed - 20 * dt);
    } else {
      car.speed += (car.cruise - car.speed) * dt * 0.8;
    }
    car.turnCooldown -= dt;
    car.x += Math.sin(car.heading) * car.speed * dt;
    car.z += Math.cos(car.heading) * car.speed * dt;
    // At an intersection, sometimes turn onto the crossing street.
    const nearStreet = (v) => {
      let best = null, bestD = 99;
      for (const s of STREETS) {
        const d = Math.abs(v - s);
        if (d < bestD) { bestD = d; best = s; }
      }
      return bestD < 3 ? best : null;
    };
    if (car.turnCooldown <= 0) {
      const cross = car.axis === 'z' ? nearStreet(car.z) : nearStreet(car.x);
      if (cross !== null && rng() < 0.35) {
        const turn = rng() < 0.5 ? 1 : -1;
        car.heading += turn * Math.PI / 2;
        car.axis = car.axis === 'z' ? 'x' : 'z';
        car.turnCooldown = 2.5;
      }
    }
    // Wrap around the map edges instead of driving into the void.
    if (car.x > 178) { car.x = 178; car.heading = Math.PI; }
    if (car.x < -178) { car.x = -178; car.heading = 0; }
    if (car.z > 178) { car.z = 178; car.heading = -Math.PI / 2; }
    if (car.z < -178) { car.z = -178; car.heading = Math.PI / 2; }
    collideCar(car, dt);
  }

  function update(dt) {
    for (const car of cars) {
      if (car.driven) {
        drivePlayerCar(car, dt);
      } else if (car.kind === 'traffic') {
        driveTrafficCar(car, dt);
      }
      car.group.position.set(car.x, 0, car.z);
      car.group.rotation.y = car.heading;
      if (car.mesh.lightBar) {
        car.flash += dt * 6;
        const on = Math.sin(car.flash) > 0;
        car.mesh.lightBar.red.material.emissive.setHex(on ? 0xdd1111 : 0x330000);
        car.mesh.lightBar.blue.material.emissive.setHex(on ? 0x1111dd : 0x000033);
      }
    }
  }

  return {
    cars,
    addCar,
    nearestStealable,
    update,
    removeCar(car) {
      const i = cars.indexOf(car);
      if (i >= 0) cars.splice(i, 1);
      G.scene.remove(car.group);
    },
  };
}
