// Porto Alba itself: a sun-soaked grid city, built once from a seed.
// Roads, sidewalks, dashes, buildings, sun and clouds. Everything is placed by the
// seeded rng, so the same seed always builds the same city.
//
// The road dashes are the part that bit us before: a dash InstancedMesh whose buffer
// is smaller than the dashes the loop places reads garbage past its end and paints
// the whole road the dash colour. Here the dash transforms are collected first and
// the mesh is allocated with exactly that count, so the two can never disagree.

import * as THREE from 'three';
import { WORLD, DASH, PALETTE } from './config.js';
import { createRandom, randInt, randPick, randRange } from './util.js';

export const AXES = [];
for (let v = -WORLD.half; v <= WORLD.half; v += WORLD.roadEvery) AXES.push(v);

const SPAN = WORLD.half * 2;

function makeMaterial(color, rough = 0.9) {
  return new THREE.MeshLambertMaterial({ color });
}

export function buildCity(scene, rng) {
  scene.background = new THREE.Color(PALETTE.sky);
  scene.fog = new THREE.Fog(PALETTE.sky, 420, 980);

  const sun = new THREE.DirectionalLight(PALETTE.sun, 1.25);
  sun.position.set(190, 280, 130);
  scene.add(sun);
  scene.add(new THREE.HemisphereLight(0xbfd9e8, 0x8a7a5c, 0.85));

  // Sandy base the whole city sits on.
  const ground = new THREE.Mesh(
    new THREE.PlaneGeometry(SPAN + 80, SPAN + 80),
    makeMaterial(PALETTE.ground),
  );
  ground.rotation.x = -Math.PI / 2;
  ground.position.y = -0.05;
  scene.add(ground);

  const roadMat = makeMaterial(PALETTE.road);
  const walkMat = makeMaterial(PALETTE.sidewalk);
  const roadGeoX = new THREE.PlaneGeometry(SPAN, WORLD.roadWidth);
  const roadGeoZ = new THREE.PlaneGeometry(WORLD.roadWidth, SPAN);
  const walkGeoX = new THREE.PlaneGeometry(SPAN, WORLD.sidewalk);
  const walkGeoZ = new THREE.PlaneGeometry(WORLD.sidewalk, SPAN);
  for (const axis of AXES) {
    const rx = new THREE.Mesh(roadGeoX, roadMat);
    rx.rotation.x = -Math.PI / 2;
    rx.position.set(0, 0, axis);
    scene.add(rx);
    const rz = new THREE.Mesh(roadGeoZ, roadMat);
    rz.rotation.x = -Math.PI / 2;
    rz.position.set(axis, 0, 0);
    scene.add(rz);
    for (const side of [-1, 1]) {
      const off = WORLD.roadWidth / 2 + WORLD.sidewalk / 2;
      const wx = new THREE.Mesh(walkGeoX, walkMat);
      wx.rotation.x = -Math.PI / 2;
      wx.position.set(0, 0.01, axis + side * off);
      scene.add(wx);
      const wz = new THREE.Mesh(walkGeoZ, walkMat);
      wz.rotation.x = -Math.PI / 2;
      wz.position.set(axis + side * off, 0.01, 0);
      scene.add(wz);
    }
  }

  // Dashes: collect every transform first, then allocate exactly that many.
  const dashSpots = [];
  const firstDash = -WORLD.half + DASH.offset;
  for (const axis of AXES) {
    for (let along = firstDash; along <= WORLD.half - DASH.offset + 0.001; along += DASH.every) {
      dashSpots.push({ x: along, z: axis, alongX: true });
      dashSpots.push({ x: axis, z: along, alongX: false });
    }
  }
  const dashGeo = new THREE.PlaneGeometry(0.7, 3.2);
  const dashMesh = new THREE.InstancedMesh(dashGeo, makeMaterial(PALETTE.dash), dashSpots.length);
  const dummy = new THREE.Object3D();
  dashSpots.forEach((spot, i) => {
    dummy.position.set(spot.x, 0.02, spot.z);
    dummy.rotation.set(-Math.PI / 2, 0, spot.alongX ? 0 : Math.PI / 2);
    dummy.scale.set(1, 1, 1);
    dummy.updateMatrix();
    dashMesh.setMatrixAt(i, dummy.matrix);
  });
  dashMesh.instanceMatrix.needsUpdate = true;
  scene.add(dashMesh);

  // Buildings fill the blocks between roads: one to three per block, seeded heights.
  const blocks = [];
  for (let ix = 0; ix < AXES.length - 1; ix += 1) {
    for (let iz = 0; iz < AXES.length - 1; iz += 1) {
      blocks.push({ x0: AXES[ix], z0: AXES[iz] });
    }
  }
  const boxGeo = new THREE.BoxGeometry(1, 1, 1);
  const boxMat = new THREE.MeshLambertMaterial({ color: 0xffffff });
  const placements = [];
  const blockRng = createRandom(1337);
  for (const block of blocks) {
    const inner = WORLD.roadEvery - WORLD.roadWidth - WORLD.sidewalk * 2 - 6;
    const count = randInt(blockRng, 1, 3);
    for (let n = 0; n < count; n += 1) {
      const w = randRange(blockRng, 12, inner);
      const d = randRange(blockRng, 12, inner);
      const h = randRange(blockRng, 8, 42);
      const cx = block.x0 + WORLD.roadWidth / 2 + WORLD.sidewalk + 3 + randRange(blockRng, 0, Math.max(1, inner - w));
      const cz = block.z0 + WORLD.roadWidth / 2 + WORLD.sidewalk + 3 + randRange(blockRng, 0, Math.max(1, inner - d));
      placements.push({ x: cx, z: cz, w, d, h, color: randPick(blockRng, PALETTE.building) });
    }
  }
  const buildingMesh = new THREE.InstancedMesh(boxGeo, boxMat, placements.length);
  const color = new THREE.Color();
  placements.forEach((p, i) => {
    dummy.position.set(p.x + p.w / 2, p.h / 2, p.z + p.d / 2);
    dummy.rotation.set(0, 0, 0);
    dummy.scale.set(p.w, p.h, p.d);
    dummy.updateMatrix();
    buildingMesh.setMatrixAt(i, dummy.matrix);
    buildingMesh.setColorAt(i, color.setHex(p.color));
  });
  buildingMesh.instanceMatrix.needsUpdate = true;
  if (buildingMesh.instanceColor) buildingMesh.instanceColor.needsUpdate = true;
  scene.add(buildingMesh);

  // A few slow clouds, placed by the seed and drifted by sim time only.
  const cloudMat = new THREE.MeshLambertMaterial({ color: 0xffffff, transparent: true, opacity: 0.85 });
  const cloudGeo = new THREE.SphereGeometry(1, 12, 8);
  const clouds = [];
  for (let i = 0; i < 9; i += 1) {
    const puff = new THREE.Mesh(cloudGeo, cloudMat);
    const s = randRange(rng, 14, 26);
    puff.scale.set(s, s * 0.32, s * 0.7);
    puff.position.set(randRange(rng, -260, 260), randRange(rng, 85, 115), randRange(rng, -260, 260));
    puff.userData.drift = randRange(rng, 0.4, 1.1);
    scene.add(puff);
    clouds.push(puff);
  }

  return {
    axes: AXES,
    dashCount: dashSpots.length,
    buildingCount: placements.length,
    update(dt) {
      for (const puff of clouds) {
        puff.position.x += puff.userData.drift * dt;
        if (puff.position.x > 300) puff.position.x = -300;
      }
    },
  };
}
