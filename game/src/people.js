// Porto Alba — people. A low-poly person factory, the on-foot player with
// third-person movement, and pedestrians who wander the sidewalks. A person
// who is hit by a car falls over and gets back up; a pedestrian the player
// shoves or shoots also falls, which the wanted system notices.

import * as THREE from '../vendor/three/three.module.min.js';
import { clamp, dist2, pick, pushOutOfBox } from './util.js';

const SHIRTS = [0xd95f4b, 0x4b8fd9, 0x58b368, 0xe0a83c, 0x9e6fb8, 0xeeeeee, 0x3fa7a0, 0xd97b2e];
const SKINS = [0xe8b98a, 0xc98d5f, 0x8a5a3b, 0xf2c9a0];
const PANTS = [0x2e3a4a, 0x4a4f55, 0x6b5a44, 0x24303e];

export function makePersonMesh(shirt, skin, pants) {
  const g = new THREE.Group();
  const shirtMat = new THREE.MeshLambertMaterial({ color: shirt });
  const skinMat = new THREE.MeshLambertMaterial({ color: skin });
  const pantsMat = new THREE.MeshLambertMaterial({ color: pants });

  const torso = new THREE.Mesh(new THREE.BoxGeometry(0.62, 0.72, 0.36), shirtMat);
  torso.position.y = 1.05;
  g.add(torso);
  const head = new THREE.Mesh(new THREE.SphereGeometry(0.26, 10, 8), skinMat);
  head.position.y = 1.66;
  g.add(head);
  const hair = new THREE.Mesh(
    new THREE.SphereGeometry(0.27, 10, 6, 0, Math.PI * 2, 0, Math.PI / 2),
    new THREE.MeshLambertMaterial({ color: 0x2a2018 })
  );
  hair.position.y = 1.7;
  g.add(hair);
  const legL = new THREE.Mesh(new THREE.BoxGeometry(0.24, 0.68, 0.26), pantsMat);
  legL.position.set(-0.16, 0.34, 0);
  g.add(legL);
  const legR = legL.clone();
  legR.position.x = 0.16;
  g.add(legR);
  const armL = new THREE.Mesh(new THREE.BoxGeometry(0.18, 0.6, 0.2), shirtMat);
  armL.position.set(-0.42, 1.08, 0);
  g.add(armL);
  const armR = armL.clone();
  armR.position.x = 0.42;
  g.add(armR);
  return { group: g, legL, legR, armL, armR, head };
}

export function createPeopleSystem(G) {
  const peds = [];
  const rng = G.rng;

  function addPed(x, z) {
    const mesh = makePersonMesh(pick(rng, SHIRTS), pick(rng, SKINS), pick(rng, PANTS));
    mesh.group.position.set(x, 0, z);
    G.scene.add(mesh.group);
    const ped = {
      mesh, x, z, heading: rng() * Math.PI * 2,
      speed: 1.2 + rng() * 0.9,
      target: null, down: 0, walkPhase: rng() * 6,
      scared: 0,
    };
    peds.push(ped);
    return ped;
  }

  for (let i = 0; i < 22; i++) {
    addPed(-160 + rng() * 320, -160 + rng() * 320);
  }

  function newTarget(ped) {
    // A point on a sidewalk: near a street line, offset to the side.
    const street = pick(rng, G.world.streets);
    const along = -160 + rng() * 320;
    const side = rng() < 0.5 ? -8.5 : 8.5;
    if (rng() < 0.5) {
      ped.target = { x: along, z: street + side };
    } else {
      ped.target = { x: street + side, z: along };
    }
  }

  function knockDown(ped, hard) {
    if (ped.down > 0) return;
    ped.down = hard ? 2.5 : 1.4;
    ped.mesh.group.rotation.x = -Math.PI / 2 + 0.2;
    ped.mesh.group.position.y = 0.3;
  }

  function update(dt, playerPos, playerSpeed) {
    for (const ped of peds) {
      if (ped.down > 0) {
        ped.down -= dt;
        if (ped.down <= 0) {
          ped.mesh.group.rotation.x = 0;
          ped.mesh.group.position.y = 0;
        }
        continue;
      }
      if (!ped.target) newTarget(ped);
      const dx = ped.target.x - ped.x, dz = ped.target.z - ped.z;
      const d = Math.sqrt(dx * dx + dz * dz);
      if (d < 1.5) {
        ped.target = null;
        continue;
      }
      // Flee from a fast car nearby.
      let speed = ped.speed;
      let tx = dx / d, tz = dz / d;
      if (playerSpeed > 6 && dist2(ped.x, ped.z, playerPos.x, playerPos.z) < 100) {
        const away = Math.atan2(ped.x - playerPos.x, ped.z - playerPos.z);
        tx = Math.sin(away); tz = Math.cos(away);
        speed = ped.speed * 2.2;
      }
      const targetHeading = Math.atan2(tx, tz);
      let dh = targetHeading - ped.heading;
      while (dh > Math.PI) dh -= Math.PI * 2;
      while (dh < -Math.PI) dh += Math.PI * 2;
      ped.heading += clamp(dh, -3 * dt, 3 * dt);
      ped.x += Math.sin(ped.heading) * speed * dt;
      ped.z += Math.cos(ped.heading) * speed * dt;
      for (const box of G.world.colliders) {
        const hit = pushOutOfBox(ped.x, ped.z, 0.5, box);
        if (hit) { ped.x = hit.x; ped.z = hit.z; ped.target = null; }
      }
      ped.walkPhase += dt * speed * 5;
      const swing = Math.sin(ped.walkPhase) * 0.5;
      ped.mesh.legL.rotation.x = swing;
      ped.mesh.legR.rotation.x = -swing;
      ped.mesh.armL.rotation.x = -swing * 0.7;
      ped.mesh.armR.rotation.x = swing * 0.7;
      ped.mesh.group.position.set(ped.x, 0, ped.z);
      ped.mesh.group.rotation.y = ped.heading;
    }
  }

  return { peds, addPed, knockDown, update };
}

// The player on foot: third-person movement relative to the camera yaw,
// sprinting, and a simple walk cycle. Cars and buildings push the player out.
export function createPlayer(G) {
  const mesh = makePersonMesh(0x2e6db4, 0xe8b98a, 0x2e3a4a);
  // Rook Calloway stands out: a red jacket.
  mesh.group.children[0].material = new THREE.MeshLambertMaterial({ color: 0xb03030 });
  G.scene.add(mesh.group);
  const player = {
    mesh, x: -140, z: 30, heading: Math.PI / 2,
    speed: 0, health: 100, money: 250,
    onFoot: true, car: null, walkPhase: 0,
    armed: false, // pistol out
    punchCooldown: 0, shootCooldown: 0,
  };
  mesh.group.position.set(player.x, 0, player.z);

  function update(dt, camYaw) {
    if (!player.onFoot) return;
    const move = G.input.moveAxis();
    const sprint = G.input.sprint();
    const maxSpeed = sprint ? 9 : 5;
    const mx = move.x, mz = move.z;
    const len = Math.sqrt(mx * mx + mz * mz);
    let vx = 0, vz = 0;
    if (len > 0.01) {
      // Camera-relative: forward is away from the camera.
      const fx = Math.sin(camYaw), fz = Math.cos(camYaw);
      const rx = Math.cos(camYaw), rz = -Math.sin(camYaw);
      vx = (fx * -mz + rx * mx) / len * maxSpeed;
      vz = (fz * -mz + rz * mx) / len * maxSpeed;
      const targetHeading = Math.atan2(vx, vz);
      let dh = targetHeading - player.heading;
      while (dh > Math.PI) dh -= Math.PI * 2;
      while (dh < -Math.PI) dh += Math.PI * 2;
      player.heading += clamp(dh, -10 * dt, 10 * dt);
    }
    player.speed = Math.sqrt(vx * vx + vz * vz);
    player.x += vx * dt;
    player.z += vz * dt;
    for (const box of G.world.colliders) {
      const hit = pushOutOfBox(player.x, player.z, 0.6, box);
      if (hit) { player.x = hit.x; player.z = hit.z; }
    }
    // Keep clear of cars.
    for (const car of G.cars.cars) {
      const dx = player.x - car.x, dz = player.z - car.z;
      const d2 = dx * dx + dz * dz;
      if (d2 < 4.2 && d2 > 0.001) {
        const d = Math.sqrt(d2);
        player.x = car.x + (dx / d) * 2.05;
        player.z = car.z + (dz / d) * 2.05;
      }
    }
    player.walkPhase += dt * player.speed * 2.2;
    const swing = player.speed > 0.2 ? Math.sin(player.walkPhase) * 0.55 : 0;
    mesh.legL.rotation.x = swing;
    mesh.legR.rotation.x = -swing;
    mesh.armL.rotation.x = -swing * 0.7;
    mesh.armR.rotation.x = swing * 0.7;
    mesh.group.position.set(player.x, 0, player.z);
    mesh.group.rotation.y = player.heading;
    player.punchCooldown = Math.max(0, player.punchCooldown - dt);
    player.shootCooldown = Math.max(0, player.shootCooldown - dt);
  }

  return { player, update };
}
