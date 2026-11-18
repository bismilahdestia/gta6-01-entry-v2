// Porto Alba — combat. Fists and a pistol. Left click punches when unarmed
// and fires when the pistol is out (press 1 to draw it, 2 to holster). Shots
// are hitscan from the camera through the crosshair: a rival, a pedestrian
// or a police car can be hit. Rivals are the armed gang members the story
// spawns; they shoot back with poor aim.

import * as THREE from '../vendor/three/three.module.min.js';
import { dist2 } from './util.js';

export function createCombat(G) {
  const raycaster = new THREE.Raycaster();
  const rivals = [];
  let tracer = null;
  let tracerLife = 0;
  let muzzle = null;

  function addRival(x, z) {
    const mesh = makeRivalMesh();
    mesh.group.position.set(x, 0, z);
    G.scene.add(mesh.group);
    const rival = {
      mesh, x, z, heading: 0,
      health: 60, shootCooldown: 1 + Math.random() * 1.5,
      down: 0, walkPhase: 0,
    };
    rivals.push(rival);
    return rival;
  }

  function makeRivalMesh() {
    const g = new THREE.Group();
    const coat = new THREE.MeshLambertMaterial({ color: 0x1f1f24 });
    const skin = new THREE.MeshLambertMaterial({ color: 0xc98d5f });
    const torso = new THREE.Mesh(new THREE.BoxGeometry(0.64, 0.74, 0.38), coat);
    torso.position.y = 1.05;
    g.add(torso);
    const head = new THREE.Mesh(new THREE.SphereGeometry(0.26, 10, 8), skin);
    head.position.y = 1.66;
    g.add(head);
    const cap = new THREE.Mesh(
      new THREE.BoxGeometry(0.5, 0.12, 0.5),
      new THREE.MeshLambertMaterial({ color: 0x8a1f1f })
    );
    cap.position.y = 1.86;
    g.add(cap);
    const legL = new THREE.Mesh(new THREE.BoxGeometry(0.24, 0.68, 0.26), coat);
    legL.position.set(-0.16, 0.34, 0);
    g.add(legL);
    const legR = legL.clone();
    legR.position.x = 0.16;
    g.add(legR);
    const gun = new THREE.Mesh(
      new THREE.BoxGeometry(0.1, 0.1, 0.5),
      new THREE.MeshLambertMaterial({ color: 0x111111 })
    );
    gun.position.set(0.3, 1.1, 0.35);
    g.add(gun);
    return { group: g, legL, legR };
  }

  function spawnTracer(from, to) {
    if (tracer) G.scene.remove(tracer);
    const geo = new THREE.BufferGeometry().setFromPoints([
      new THREE.Vector3(from.x, from.y, from.z),
      new THREE.Vector3(to.x, to.y, to.z),
    ]);
    tracer = new THREE.Line(geo, new THREE.LineBasicMaterial({ color: 0xffe08a }));
    G.scene.add(tracer);
    tracerLife = 0.07;
  }

  function muzzleFlash(at) {
    if (!muzzle) {
      muzzle = new THREE.PointLight(0xffc860, 0, 9);
      G.scene.add(muzzle);
    }
    muzzle.position.set(at.x, at.y, at.z);
    muzzle.intensity = 26;
  }

  // What the crosshair points at: rivals first, then pedestrians, then cars.
  function aimTarget(origin, dir) {
    raycaster.set(origin, dir);
    raycaster.far = 70;
    const meshes = [];
    for (const r of rivals) if (r.down <= 0) meshes.push({ obj: r.mesh.group, ref: r, type: 'rival' });
    for (const p of G.people.peds) if (p.down <= 0) meshes.push({ obj: p.mesh.group, ref: p, type: 'ped' });
    for (const c of G.cars.cars) meshes.push({ obj: c.group, ref: c, type: 'car' });
    const hits = raycaster.intersectObjects(meshes.map((m) => m.obj), true);
    if (!hits.length) return null;
    const hitObj = hits[0].object;
    let node = hitObj;
    while (node.parent && node.parent !== G.scene) node = node.parent;
    const found = meshes.find((m) => m.obj === node);
    return found ? { ...found, point: hits[0].point } : { point: hits[0].point, type: 'world' };
  }

  function playerShoot() {
    const p = G.player;
    if (p.shootCooldown > 0 || !p.onFoot || !p.armed) return;
    p.shootCooldown = 0.28;
    G.audio.gunshot();
    const origin = new THREE.Vector3(p.x, 1.5, p.z);
    const dir = new THREE.Vector3();
    G.camera.getWorldDirection(dir);
    const from = new THREE.Vector3(p.x + Math.sin(p.heading) * 0.5, 1.35, p.z + Math.cos(p.heading) * 0.5);
    const target = aimTarget(origin, dir);
    const end = target ? target.point : origin.clone().add(dir.multiplyScalar(60));
    spawnTracer(from, end);
    muzzleFlash(from);
    if (!target) return;
    if (target.type === 'rival') {
      target.ref.health -= 34;
      G.hud.toast('Hit a rival!');
      if (target.ref.health <= 0) {
        target.ref.down = 999;
        target.ref.mesh.group.rotation.x = -Math.PI / 2 + 0.2;
        target.ref.mesh.group.position.y = 0.3;
        G.hud.toast('Rival down.');
      }
    } else if (target.type === 'ped') {
      G.people.knockDown(target.ref, true);
      G.wanted.addHeat(1, 'You shot a pedestrian!');
    } else if (target.type === 'car') {
      target.ref.health -= 12;
      if (target.ref.kind === 'police') G.wanted.addHeat(1, 'You shot at the police!');
      if (target.ref.health <= 0 && target.ref.kind !== 'police') {
        G.hud.toast('That car is wrecked.');
      }
    }
  }

  function playerPunch() {
    const p = G.player;
    if (p.punchCooldown > 0 || !p.onFoot) return;
    p.punchCooldown = 0.45;
    G.audio.punch();
    const reach = 2.2;
    for (const ped of G.people.peds) {
      if (ped.down > 0) continue;
      if (dist2(p.x, p.z, ped.x, ped.z) < reach * reach) {
        G.people.knockDown(ped, false);
        G.wanted.addHeat(1, 'You attacked someone!');
        G.hud.toast('You knocked them down.');
        return;
      }
    }
    for (const r of rivals) {
      if (r.down > 0) continue;
      if (dist2(p.x, p.z, r.x, r.z) < reach * reach) {
        r.health -= 25;
        if (r.health <= 0) {
          r.down = 999;
          r.mesh.group.rotation.x = -Math.PI / 2 + 0.2;
          r.mesh.group.position.y = 0.3;
        }
        return;
      }
    }
  }

  function update(dt) {
    if (tracerLife > 0) {
      tracerLife -= dt;
      if (tracerLife <= 0 && tracer) {
        G.scene.remove(tracer);
        tracer.geometry.dispose();
        tracer = null;
      }
    }
    if (muzzle) muzzle.intensity = Math.max(0, muzzle.intensity - dt * 260);
    // Rivals: face the player and shoot badly at them.
    const p = G.player;
    for (const r of rivals) {
      if (r.down > 0) continue;
      const d2 = dist2(p.x, p.z, r.x, r.z);
      const d = Math.sqrt(d2);
      r.heading = Math.atan2(p.x - r.x, p.z - r.z);
      r.mesh.group.rotation.y = r.heading;
      r.shootCooldown -= dt;
      if (d < 26 && r.shootCooldown <= 0 && p.onFoot) {
        r.shootCooldown = 1.1 + Math.random() * 0.9;
        const from = new THREE.Vector3(r.x, 1.3, r.z);
        const to = new THREE.Vector3(p.x, 1.2, p.z);
        spawnTracer(from, to);
        muzzleFlash(from);
        G.audio.gunshot();
        // Poor aim: hits about a third of the time at close range.
        if (Math.random() < clamp01(0.5 - d * 0.012)) {
          G.damagePlayer(6, 'Shot by a rival!');
        }
      }
      r.mesh.group.position.set(r.x, 0, r.z);
    }
  }

  function clamp01(v) { return v < 0 ? 0 : v > 1 ? 1 : v; }

  function clearRivals() {
    for (const r of rivals) G.scene.remove(r.mesh.group);
    rivals.length = 0;
  }

  return {
    rivals, addRival, clearRivals, playerShoot, playerPunch, update,
  };
}
